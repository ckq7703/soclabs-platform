from fastapi import FastAPI, HTTPException, Header, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator, Field
from typing import Optional, List
import redis
import json
import uuid
import hashlib
import base64
import logging
import re
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import requests
import threading
import time
from datetime import timedelta


app = FastAPI(title="Recon API Gateway", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection for job queue
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=6379,
    db=0,
    decode_responses=True
)

# PostgreSQL connection for job metadata
def get_db():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'postgres'),
        database=os.getenv('POSTGRES_DB', 'recon'),
        user=os.getenv('POSTGRES_USER', 'recon'),
        password=os.getenv('POSTGRES_PASSWORD'),
        cursor_factory=RealDictCursor
    )

# Models
class JobCreate(BaseModel):
    target: str = Field(..., description="Target domain or URL (e.g., example.com, https://example.com)", examples=["example.com"])
    scan_type: str = Field(..., description="Type of scan to perform. Options: subdomain, portscan, vuln_scan, tech_detect, waf_detect, full", examples=["subdomain"])
    options: Optional[dict] = Field(default={}, description="Configuration options for the specific scan type", examples=[{"timeout": 300}])
    user_id: Optional[str] = Field(default='anonymous', description="ID of the user initiating the request")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "target": "example.com",
                    "scan_type": "subdomain",
                    "options": {
                        "timeout": 300,
                        "tools": ["subfinder", "amass"]
                    }
                },
                {
                    "target": "https://example.com",
                    "scan_type": "tech_detect",
                    "options": {
                        "timeout": 60,
                        "follow_redirects": True
                    }
                }
            ]
        }
    }
    
    @validator('target')
    def validate_target(cls, v):
        # Basic validation
        if not v or len(v) < 3:
            raise ValueError('Invalid target')
        return v.lower().strip()
    
    @validator('scan_type')
    def validate_scan_type(cls, v):
        valid_types = ['subdomain', 'portscan', 'vuln_scan', 'tech_detect', 'waf_detect', 'full']
        if v not in valid_types:
            raise ValueError(f'scan_type must be one of {valid_types}')
        return v

class JobResponse(BaseModel):
    job_id: str = Field(..., description="Unique identifier for the job")
    status: str = Field(..., description="Current status of the job (queued, running, completed, etc.)")
    created_at: str = Field(..., description="Timestamp when the job was created (ISO 8601)")
    message: str = Field(..., description="Descriptive message about the operation")

class VTMalwareRequest(BaseModel):
    resource_type: str = Field(..., description="'file' for hash or 'url' for link")
    resource_value: str = Field(..., description="The hash or URL to scan")

# API Key Authentication
def verify_api_key(x_api_key: str = Header(...)):
    valid_key = os.getenv('API_KEY')
    if x_api_key != valid_key:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return x_api_key

# --- NVD Sync Logic ---
def sync_nvd_data(days=30):
    """Fetch latest CVEs from NVD and update local cache"""
    try:
        print(f"[*] Starting NVD sync for last {days} days...")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # NVD API Date Format: 2026-04-01T00:00:00.000
        start_str = start_date.strftime("%Y-%m-%dT%H:%M:%S.000")
        end_str = end_date.strftime("%Y-%m-%dT%H:%M:%S.000")
        
        api_url = f"https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate={start_str}&pubEndDate={end_str}"
        
        # Get NVD API Key from env if available
        headers = {}
        nvd_key = os.getenv('NVD_API_KEY')
        if nvd_key:
            headers['apiKey'] = nvd_key
            
        response = requests.get(api_url, headers=headers, timeout=30)
        if response.status_code != 200:
            print(f"[!] NVD API Error: {response.status_code}")
            return
            
        data = response.json()
        vulns = data.get('vulnerabilities', [])
        print(f"[*] Found {len(vulns)} new CVEs from NVD")
        
        conn = get_db()
        cur = conn.cursor()
        
        count = 0
        for item in vulns:
            cve = item.get('cve', {})
            cve_id = cve.get('id')
            desc = ""
            for d in cve.get('descriptions', []):
                if d.get('lang') == 'en':
                    desc = d.get('value')
                    break
            
            # Extract CVSS
            cvss_score = 0.0
            metrics = cve.get('metrics', {})
            v31 = metrics.get('cvssMetricV31', [])
            if v31:
                cvss_score = v31[0].get('cvssData', {}).get('baseScore', 0.0)
            elif metrics.get('cvssMetricV30'):
                cvss_score = metrics.get('cvssMetricV30')[0].get('cvssData', {}).get('baseScore', 0.0)
            elif metrics.get('cvssMetricV2'):
                cvss_score = metrics.get('cvssMetricV2')[0].get('cvssData', {}).get('baseScore', 0.0)

            pub_date = cve.get('published')
            
            # Upsert into cache
            cur.execute("""
                INSERT INTO cve_cache (cve_id, description, cvss_score, mentions_count, svrs_score, published_date, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (cve_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    cvss_score = EXCLUDED.cvss_score,
                    published_date = EXCLUDED.published_date,
                    metadata = EXCLUDED.metadata
            """, (cve_id, desc, cvss_score, 0, int(cvss_score * 10), pub_date, json.dumps(cve)))
            count += 1
            
        conn.commit()
        cur.close()
        conn.close()
        print(f"[+] Sync completed. {count} records updated.")
    except Exception as e:
        print(f"[!] Sync error: {str(e)}")

def periodic_sync():
    """Run sync every 12 hours"""
    while True:
        sync_nvd_data(days=1) # Daily incremental sync
        time.sleep(12 * 3600)

@app.on_event("startup")
async def startup_event():
    # Run initial sync in background thread to not block startup
    print("[*] Initializing CVE sync thread...")
    sync_thread = threading.Thread(target=sync_nvd_data, kwargs={'days': 7}, daemon=True)
    sync_thread.start()
    
    # Start periodic sync thread
    periodic_thread = threading.Thread(target=periodic_sync, daemon=True)
    periodic_thread.start()

# Endpoints
@app.post("/api/v1/jobs/create", response_model=JobResponse, status_code=201)
async def create_job(job: JobCreate, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    # 1. Check for cached results (within last 24 hours)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT job_id, created_at, status 
        FROM jobs 
        WHERE target = %(target)s 
          AND scan_type = %(scan_type)s 
          AND status = 'completed'
          AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 1
    """, {'target': job.target, 'scan_type': job.scan_type})
    
    cached_job = cur.fetchone()
    
    if cached_job:
        cur.close()
        conn.close()
        return JobResponse(
            job_id=cached_job['job_id'],
            status='completed',
            created_at=cached_job['created_at'].isoformat() if isinstance(cached_job['created_at'], datetime) else str(cached_job['created_at']),
            message=f"Results for {job.target} loaded from cache (last scan: {cached_job['created_at']})"
        )

    # 2. Check if a job for this target is already RUNNING or QUEUED to avoid duplication
    cur.execute("""
        SELECT job_id, status, created_at 
        FROM jobs 
        WHERE target = %(target)s 
          AND scan_type = %(scan_type)s 
          AND status IN ('running', 'queued')
        LIMIT 1
    """, {'target': job.target, 'scan_type': job.scan_type})
    
    active_job = cur.fetchone()
    if active_job:
        cur.close()
        conn.close()
        return JobResponse(
            job_id=active_job['job_id'],
            status=active_job['status'],
            created_at=active_job['created_at'].isoformat() if isinstance(active_job['created_at'], datetime) else str(active_job['created_at']),
            message=f"A scan for {job.target} is already in progress. Redirecting to active job."
        )

    # 3. Create new job if no cache or active job found
    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    
    job_data = {
        'job_id': job_id,
        'target': job.target,
        'scan_type': job.scan_type,
        'options': job.options,
        'user_id': job.user_id,
        'status': 'queued',
        'created_at': timestamp,
        'priority': job.options.get('priority', 5)
    }
    
    cur.execute("""
        INSERT INTO jobs (job_id, target, scan_type, options, user_id, status, created_at)
        VALUES (%(job_id)s, %(target)s, %(scan_type)s, %(options)s, %(user_id)s, %(status)s, %(created_at)s)
    """, {
        **job_data,
        'options': json.dumps(job.options)
    })
    conn.commit()
    cur.close()
    conn.close()
    
    # Push to Redis queue
    redis_client.zadd(
        'recon:jobs:queue',
        {json.dumps(job_data): job_data['priority']}
    )
    
    # Publish notification
    redis_client.publish('recon:jobs:new', json.dumps(job_data))
    
    return JobResponse(
        job_id=job_id,
        status='queued',
        created_at=timestamp,
        message=f"Job {job_id} created successfully"
    )

# ─── Email Security Endpoints ─────────────────────────────────────

@app.post("/api/v1/email/scan", status_code=201)
async def scan_email(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(default='anonymous'),
    api_key: str = Header(..., alias="X-API-Key")
):
    verify_api_key(api_key)

    if not file.filename.endswith('.eml'):
        raise HTTPException(status_code=400, detail="Only .eml files are supported")

    content = await file.read()
    file_size = len(content)
    file_hash = hashlib.sha256(content).hexdigest()

    conn = get_db()
    cur = conn.cursor()

    # Cache check
    cur.execute("""
        SELECT job_id, status, created_at FROM email_jobs 
        WHERE file_hash = %s AND status = 'completed' 
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 1
    """, (file_hash,))
    cached = cur.fetchone()

    if cached:
        cur.close()
        conn.close()
        return {
            "job_id": cached['job_id'],
            "status": "completed",
            "message": f"Results loaded from cache"
        }

    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    cur.execute("""
        INSERT INTO email_jobs (job_id, file_name, file_hash, file_size, status, user_id, created_at)
        VALUES (%s, %s, %s, %s, 'queued', %s, %s)
    """, (job_id, file.filename, file_hash, file_size, user_id, timestamp))
    conn.commit()
    cur.close()
    conn.close()

    # Push to Redis
    job_data = {
        'job_id': job_id,
        'scan_type': 'email_scan',
        'file_name': file.filename,
        'eml_base64': base64.b64encode(content).decode('utf-8')
    }
    redis_client.lpush('recon:jobs:email', json.dumps(job_data))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Email uploaded and queued for analysis"
    }

@app.get("/api/v1/email/jobs/{job_id}/status")
async def get_email_job_status(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM email_jobs WHERE job_id = %s", (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    
    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

@app.get("/api/v1/email/jobs/{job_id}/results")
async def get_email_job_results(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT j.*, r.* FROM email_jobs j 
        LEFT JOIN email_results r ON j.job_id = r.job_id 
        WHERE j.job_id = %s
    """, (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed': raise HTTPException(status_code=400, detail="Job not ready")

    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

# ─── SSL Analyzer Endpoints ─────────────────────────────────────

class SSLScanRequest(BaseModel):
    host: str

@app.post("/api/v1/ssl/scan", status_code=201)
async def scan_ssl(request: SSLScanRequest, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO ssl_jobs (job_id, host, status, created_at)
        VALUES (%s, %s, 'queued', %s)
    """, (job_id, request.host, timestamp))
    conn.commit()
    cur.close()
    conn.close()

    # Push to Redis
    job_data = {
        'job_id': job_id,
        'scan_type': 'ssl_scan',
        'host': request.host
    }
    redis_client.lpush('recon:jobs:ssl', json.dumps(job_data))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "SSL scan queued successfully"
    }

@app.get("/api/v1/ssl/jobs/{job_id}/status")
async def get_ssl_job_status(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM ssl_jobs WHERE job_id = %s", (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    
    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

@app.get("/api/v1/ssl/jobs/{job_id}/results")
async def get_ssl_job_results(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT j.*, r.* FROM ssl_jobs j 
        LEFT JOIN ssl_results r ON j.job_id = r.job_id 
        WHERE j.job_id = %s
    """, (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed': raise HTTPException(status_code=400, detail="Job not ready")

    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

# ─── IP Reputation Endpoints ─────────────────────────────────────

class IPScanRequest(BaseModel):
    ip: str

@app.post("/api/v1/ip/scan", status_code=201)
async def scan_ip(request: IPScanRequest, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO ip_jobs (job_id, ip, status, created_at)
        VALUES (%s, %s, 'queued', %s)
    """, (job_id, request.ip, timestamp))
    conn.commit()
    cur.close()
    conn.close()

    # Push to Redis
    job_data = {
        'job_id': job_id,
        'scan_type': 'ip_scan',
        'ip': request.ip
    }
    redis_client.lpush('recon:jobs:ip', json.dumps(job_data))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "IP Reputation scan queued successfully"
    }

@app.get("/api/v1/ip/jobs/{job_id}/status")
async def get_ip_job_status(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM ip_jobs WHERE job_id = %s", (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    
    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

@app.get("/api/v1/ip/jobs/{job_id}/results")
async def get_ip_job_results(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT j.*, r.* FROM ip_jobs j 
        LEFT JOIN ip_results r ON j.job_id = r.job_id 
        WHERE j.job_id = %s
    """, (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed': raise HTTPException(status_code=400, detail="Job not ready")

    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

# ─── Domain Reputation Endpoints ─────────────────────────────────────

class DomainScanRequest(BaseModel):
    host: str

@app.post("/api/v1/domain/scan", status_code=201)
async def scan_domain(request: DomainScanRequest, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO domain_jobs (id, host, status, created_at)
        VALUES (%s, %s, 'queued', %s)
    """, (job_id, request.host, timestamp))
    conn.commit()
    cur.close()
    conn.close()

    # Push to Redis
    job_data = {
        'job_id': job_id,
        'scan_type': 'domain_scan',
        'host': request.host
    }
    redis_client.lpush('recon:jobs:domain', json.dumps(job_data))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Domain Reputation scan queued successfully"
    }

@app.get("/api/v1/domain/jobs/{job_id}/status")
async def get_domain_job_status(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM domain_jobs WHERE id = %s", (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    
    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

@app.get("/api/v1/domain/jobs/{job_id}/results")
async def get_domain_job_results(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT j.*, r.* FROM domain_jobs j 
        LEFT JOIN domain_results r ON j.id = r.job_id 
        WHERE j.id = %s
    """, (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed': raise HTTPException(status_code=400, detail="Job not ready")

    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result


# ─── CVE Radar Endpoints ──────────────────────────────────────────

class CVESearchRequest(BaseModel):
    query: str
    limit: int = 20

@app.get("/api/v1/cve/trending")
async def get_cve_trending(page: int = 1, limit: int = 10, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    
    offset = (page - 1) * limit
    
    # Get total count for pagination
    cur.execute("SELECT COUNT(*) as total FROM cve_cache")
    total = cur.fetchone()['total']
    
    # Get paginated data
    cur.execute("""
        SELECT * FROM cve_cache 
        ORDER BY published_date DESC 
        LIMIT %s OFFSET %s
    """, (limit, offset))
    trending = cur.fetchall()
    
    # Get trend data for the last 30 days for these CVEs
    cve_ids = [t['cve_id'] for t in trending]
    
    trend_data = {}
    if cve_ids:
        cur.execute("""
            SELECT cve_id, date, mentions_count 
            FROM cve_trends 
            WHERE cve_id IN %s AND date > CURRENT_DATE - INTERVAL '30 days'
            ORDER BY date ASC
        """, (tuple(cve_ids),))
        rows = cur.fetchall()
        for row in rows:
            cid = row['cve_id']
            if cid not in trend_data: trend_data[cid] = []
            trend_data[cid].append({
                "date": row['date'].isoformat() if isinstance(row['date'], datetime) else str(row['date']),
                "mentions": row['mentions_count']
            })
            
    # Fallback simulation if no trend data in DB yet
    for t in trending:
        cid = t['cve_id']
        if not trend_data.get(cid):
            trend_data[cid] = []
            base = t['mentions_count'] or int(t['cvss_score'] * 1000)
            import random
            for i in range(30):
                d = (datetime.now() - timedelta(days=(29-i))).date().isoformat()
                trend_data[cid].append({
                    "date": d,
                    "mentions": int(base * (1 + random.uniform(-0.2, 0.2)))
                })

    cur.close()
    conn.close()
    
    return {
        "trending": [dict(t) for t in trending],
        "trends": trend_data,
        "total": total,
        "page": page,
        "limit": limit
    }

@app.get("/api/v1/cve/search")
async def search_cve(query: str, page: int = 1, limit: int = 10, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    
    # Check if exact CVE ID format
    cve_id_pattern = re.compile(r'^CVE-\d{4}-\d{4,}$', re.IGNORECASE)
    is_exact_id = cve_id_pattern.match(query.strip())

    offset = (page - 1) * limit
    
    # If exact ID, check cache first
    if is_exact_id:
        cur.execute("SELECT * FROM cve_cache WHERE cve_id = %s", (query.strip().upper(),))
        exact_match = cur.fetchone()
        
        # If not in cache, fetch from NVD on the fly
        if not exact_match:
            try:
                response = requests.get(f"https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={query.strip().upper()}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    vulns = data.get('vulnerabilities', [])
                    if vulns:
                        item = vulns[0]
                        cve_data = item.get('cve', {})
                        cve_id = cve_data.get('id')
                        description = ""
                        for desc in cve_data.get('descriptions', []):
                            if desc.get('lang') == 'en':
                                description = desc.get('value')
                                break
                        
                        score = 0
                        metrics = cve_data.get('metrics', {})
                        v31 = metrics.get('cvssMetricV31', [])
                        if v31: score = v31[0].get('cvssData', {}).get('baseScore', 0)
                        elif metrics.get('cvssMetricV30'): score = metrics.get('cvssMetricV30')[0].get('cvssData', {}).get('baseScore', 0)
                        
                        published_date = cve_data.get('published')
                        
                        cur.execute("""
                            INSERT INTO cve_cache (cve_id, description, cvss_score, published_date, metadata)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (cve_id) DO UPDATE SET
                                description = EXCLUDED.description,
                                cvss_score = EXCLUDED.cvss_score,
                                metadata = EXCLUDED.metadata
                        """, (cve_id, description, score, published_date, json.dumps(cve_data)))
                        conn.commit()
            except Exception as e:
                print(f"Error fetching exact CVE from NVD: {e}")

    # Get total count for search
    cur.execute("""
        SELECT COUNT(*) as total FROM cve_cache 
        WHERE cve_id ILIKE %s OR description ILIKE %s
    """, (f'%{query}%', f'%{query}%'))
    total = cur.fetchone()['total']

    cur.execute("""
        SELECT * FROM cve_cache 
        WHERE cve_id ILIKE %s OR description ILIKE %s
        ORDER BY published_date DESC LIMIT %s OFFSET %s
    """, (f'%{query}%', f'%{query}%', limit, offset))
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    formatted_results = []
    for r in results:
        res = dict(r)
        for k, v in res.items():
            if isinstance(v, datetime): res[k] = v.isoformat()
        formatted_results.append(res)
        
    return {
        "results": formatted_results,
        "total": total,
        "page": page,
        "limit": limit
    }
@app.get("/api/v1/cve/{cve_id}")
async def get_cve_detail(cve_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM cve_cache WHERE cve_id = %s", (cve_id,))
    cve = cur.fetchone()
    
    if not cve:
        # If not in cache, try to fetch from NVD directly? 
        # For now, just return 404
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="CVE not found in local cache")
        
    # Get trend data
    cur.execute("""
        SELECT date, mentions_count FROM cve_trends 
        WHERE cve_id = %s AND date > CURRENT_DATE - INTERVAL '30 days'
        ORDER BY date ASC
    """, (cve_id,))
    trends = cur.fetchall()
    
    cur.close()
    conn.close()
    
    res = dict(cve)
    for k, v in res.items():
        if isinstance(v, datetime): res[k] = v.isoformat()
        
    res['trends'] = [dict(t) for t in trends]
    return res


# ─── VirusTotal Standalone Endpoints ──────────────────────────────

@app.post("/api/v1/vt/scan", status_code=201)
async def scan_vt_malware(request: VTMalwareRequest, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    if request.resource_type not in ['file', 'url']:
        raise HTTPException(status_code=400, detail="resource_type must be 'file' or 'url'")

    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO vt_malware_jobs (job_id, resource_type, resource_value, status, created_at)
        VALUES (%s, %s, %s, 'queued', %s)
    """, (job_id, request.resource_type, request.resource_value, timestamp))
    conn.commit()
    cur.close()
    conn.close()

    # Push to Redis
    job_data = {
        'job_id': job_id,
        'scan_type': 'vt_malware_scan',
        'resource_type': request.resource_type,
        'resource_value': request.resource_value
    }
    redis_client.lpush('recon:jobs:vt', json.dumps(job_data))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": f"VirusTotal {request.resource_type} scan queued"
    }

@app.post("/api/v1/vt/upload", status_code=201)
async def upload_vt_file(
    file: UploadFile = File(...),
    api_key: str = Header(..., alias="X-API-Key")
):
    verify_api_key(api_key)
    
    # VirusTotal standard upload limit is 32MB
    MAX_FILE_SIZE = 32 * 1024 * 1024 # 32MB
    
    # Check file size (FastAPI/Starlette stores it in file.size if available, 
    # but we can also check by reading or from headers)
    # Using content length header if available for fast check
    content_length = file.size if hasattr(file, 'size') else 0
    if content_length > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size allowed is 32MB.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size allowed is 32MB.")
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    file_hash = hashlib.sha256(content).hexdigest()
    
    job_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO vt_malware_jobs (job_id, resource_type, resource_value, status, created_at)
        VALUES (%s, %s, %s, 'queued', %s)
    """, (job_id, 'file', file_hash, timestamp))
    conn.commit()
    cur.close()
    conn.close()

    # Push to Redis with the file content encoded in base64
    job_data = {
        'job_id': job_id,
        'scan_type': 'vt_malware_scan',
        'resource_type': 'file',
        'resource_value': file_hash,
        'file_name': file.filename,
        'file_content_base64': base64.b64encode(content).decode('utf-8')
    }
    redis_client.lpush('recon:jobs:vt', json.dumps(job_data))

    return {
        "job_id": job_id,
        "status": "queued",
        "message": f"File {file.filename} uploaded and queued for VirusTotal analysis"
    }

@app.get("/api/v1/vt/jobs/{job_id}/status")
async def get_vt_job_status(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM vt_malware_jobs WHERE job_id = %s", (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    
    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result

@app.get("/api/v1/vt/jobs/{job_id}/results")
async def get_vt_job_results(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT j.*, r.* FROM vt_malware_jobs j 
        LEFT JOIN vt_malware_results r ON j.job_id = r.job_id 
        WHERE j.job_id = %s
    """, (job_id,))
    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] != 'completed': raise HTTPException(status_code=400, detail="Job not ready")

    result = dict(job)
    for k, v in result.items():
        if isinstance(v, datetime): result[k] = v.isoformat()
    return result


@app.get("/api/v1/jobs/{job_id}/status")
async def get_job_status(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT job_id, target, scan_type, status, progress, current_step,
               created_at, started_at, completed_at, error_message
        FROM jobs WHERE job_id = %s
    """, (job_id,))

    
    job = cur.fetchone()
    cur.close()
    conn.close()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Convert datetime objects to string
    for k, v in job.items():
        if isinstance(v, datetime):
            job[k] = v.isoformat()
            
    return dict(job)

@app.get("/api/v1/jobs/{job_id}/results")
async def get_job_results(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT j.*, r.results_data, r.file_paths, r.summary
        FROM jobs j
        LEFT JOIN job_results r ON j.job_id = r.job_id
        WHERE j.job_id = %s
    """, (job_id,))
    
    job = cur.fetchone()
    cur.close()
    conn.close()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    return {
        'job_id': job['job_id'],
        'target': job['target'],
        'scan_type': job['scan_type'],
        'results': job['results_data'] if isinstance(job.get('results_data'), (dict, list)) else json.loads(job['results_data']) if job.get('results_data') else {},
        'file_paths': job['file_paths'] if isinstance(job.get('file_paths'), (dict, list)) else json.loads(job['file_paths']) if job.get('file_paths') else [],
        'summary': job['summary'] if isinstance(job.get('summary'), (dict, list)) else json.loads(job['summary']) if job.get('summary') else {}
    }

@app.get("/api/v1/jobs")
async def list_jobs(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    api_key: str = Header(..., alias="X-API-Key")
):
    verify_api_key(api_key)
    
    query = "SELECT * FROM jobs WHERE 1=1"
    params = []
    
    if status:
        query += " AND status = %s"
        params.append(status)
    
    if user_id:
        query += " AND user_id = %s"
        params.append(user_id)
    
    # Needs to handle pagination params securely, but here we just append logic
    # Separate count query
    count_query = "SELECT COUNT(*) as total FROM jobs WHERE 1=1"
    count_params = []
    
    if status:
        count_query += " AND status = %s"
        count_params.append(status)
    if user_id:
        count_query += " AND user_id = %s"
        count_params.append(user_id)

    query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    
    conn = get_db()
    cur = conn.cursor()
    
    # Get total
    cur.execute(count_query, count_params)
    total = cur.fetchone()['total']
    
    # Get items
    cur.execute(query, params + [limit, offset])
    jobs = cur.fetchall()
    
    cur.close()
    conn.close()
    
    # formatting
    formatted_jobs = []
    for job in jobs:
        j = dict(job)
        # Serialize datetimes
        for k, v in j.items():
            if isinstance(v, datetime):
                j[k] = v.isoformat()
        formatted_jobs.append(j)
    
    return {
        'jobs': formatted_jobs,
        'total': total,
        'limit': limit,
        'offset': offset
    }

@app.delete("/api/v1/jobs/{job_id}")
async def cancel_job(job_id: str, api_key: str = Header(..., alias="X-API-Key")):
    verify_api_key(api_key)
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE jobs SET status = 'cancelled', completed_at = NOW()
        WHERE job_id = %s AND status IN ('queued', 'running')
        RETURNING job_id
    """, (job_id,))
    
    result = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")
    
    # Publish cancellation event
    redis_client.publish('recon:jobs:cancel', job_id)
    
    return {'message': f'Job {job_id} cancelled successfully'}

@app.get("/health")
async def health_check():
    try:
        redis_client.ping()
        conn = get_db()
        conn.close()
        return {'status': 'healthy', 'redis': 'ok', 'database': 'ok'}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
