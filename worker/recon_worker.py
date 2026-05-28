#!/usr/bin/env python3
import redis
import json
import subprocess
import os
import time
from datetime import datetime
import psycopg2
from pathlib import Path
import logging
import requests
import base64


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReconWorker:
    def __init__(self):
        self.redis = redis.Redis(
            host=os.getenv('REDIS_HOST', 'redis'),
            port=6379,
            decode_responses=True
        )
        
        self.db_config = {
            'host': os.getenv('POSTGRES_HOST', 'postgres'),
            'database': os.getenv('POSTGRES_DB', 'recon'),
            'user': os.getenv('POSTGRES_USER', 'recon'),
            'password': os.getenv('POSTGRES_PASSWORD')
        }
        
        self.output_base = Path('/data/results')
        self.output_base.mkdir(parents=True, exist_ok=True)
        
        self.worker_id = os.getenv('HOSTNAME', 'worker-1')
        
    def get_db(self):
        return psycopg2.connect(**self.db_config)
    
    def update_job_status(self, job_id, status, progress=None, error=None, current_step=None):
        """Update job status in database"""
        conn = self.get_db()
        cur = conn.cursor()
        
        updates = ['status = %s']
        params = [status]
        
        if progress is not None:
            updates.append('progress = %s')
            params.append(progress)
        
        if current_step is not None:
            updates.append('current_step = %s')
            params.append(current_step)
        
        if error:
            updates.append('error_message = %s')
            params.append(error)
        
        if status == 'running':
            updates.append('started_at = NOW()')
        elif status in ['completed', 'failed', 'cancelled']:
            updates.append('completed_at = NOW()')
        
        params.append(job_id)
        
        query = f"UPDATE jobs SET {', '.join(updates)} WHERE job_id = %s"
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
        
        # Publish status update
        self.redis.publish('recon:jobs:status', json.dumps({
            'job_id': job_id,
            'status': status,
            'progress': progress,
            'current_step': current_step,
            'worker_id': self.worker_id
        }))

    def update_email_job_status(self, job_id, status, progress=None, error=None, current_step=None):
        """Update email job status in database"""
        conn = self.get_db()
        cur = conn.cursor()
        updates = ['status = %s']
        params = [status]
        if progress is not None:
            updates.append('progress = %s')
            params.append(progress)
        if current_step is not None:
            updates.append('current_step = %s')
            params.append(current_step)
        if error:
            updates.append('error_message = %s')
            params.append(error)
        if status == 'running':
            updates.append('started_at = NOW()')
        elif status in ['completed', 'failed']:
            updates.append('completed_at = NOW()')
        params.append(job_id)
        query = f"UPDATE email_jobs SET {', '.join(updates)} WHERE job_id = %s"
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()

    def process_email_job(self, job):
        """Process email analysis using APIVoid"""
        job_id = job['job_id']
        file_name = job['file_name']
        eml_base64 = job['eml_base64']
        
        logger.info(f"Processing email job {job_id} for {file_name}")
        self.update_email_job_status(job_id, 'running', 10, current_step='Starting APIVoid Analysis')

        try:
            api_key = os.getenv('APIVOID_API_KEY')
            if not api_key:
                raise ValueError("APIVOID_API_KEY not found in environment")

            # Call APIVoid
            self.update_email_job_status(job_id, 'running', 30, current_step='Calling APIVoid EML Insights')
            
            response = requests.post(
                "https://api.apivoid.com/v2/eml-insights",
                headers={"Content-Type": "application/json", "X-API-Key": api_key},
                json={"eml_base64": eml_base64},
                timeout=30
            )

            if response.status_code != 200:
                raise Exception(f"APIVoid returned status {response.status_code}: {response.text}")

            data = response.json()
            
            # Extract fields for database
            h = data.get("headers", {})
            sec = data.get("security_details", {})
            ioc = data.get("ioc", {})
            meta = data.get("metadata", {})
            body = data.get("body", {}).get("body_text", "")

            # Save results
            self.update_email_job_status(job_id, 'running', 80, current_step='Saving results')
            
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO email_results (
                    job_id, raw_response, metadata, headers, body_text, 
                    attachments, ioc, sender_details, security_details, elapsed_ms
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                job_id,
                json.dumps(data),
                json.dumps(meta),
                json.dumps(h),
                body,
                json.dumps(data.get("attachments", {})),
                json.dumps(ioc),
                json.dumps(data.get("sender_details", {})),
                json.dumps(sec),
                data.get("elapsed_ms", 0)
            ))
            conn.commit()
            cur.close()
            conn.close()

            self.update_email_job_status(job_id, 'completed', 100, current_step='Completed')
            logger.info(f"Email job {job_id} completed successfully")

        except Exception as e:
            logger.error(f"Email job {job_id} failed: {e}")
            self.update_email_job_status(job_id, 'failed', error=str(e))

    def update_ssl_job_status(self, job_id, status, progress=None, error=None, current_step=None):
        """Update SSL job status in database"""
        conn = self.get_db()
        cur = conn.cursor()
        updates = ['status = %s']
        params = [status]
        if progress is not None:
            updates.append('progress = %s')
            params.append(progress)
        if current_step is not None:
            updates.append('current_step = %s')
            params.append(current_step)
        if error:
            updates.append('error_message = %s')
            params.append(error)
        if status == 'running':
            updates.append('started_at = NOW()')
        elif status in ['completed', 'failed']:
            updates.append('completed_at = NOW()')
        params.append(job_id)
        query = f"UPDATE ssl_jobs SET {', '.join(updates)} WHERE job_id = %s"
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()

    def process_ssl_job(self, job):
        """Process SSL analysis using APIVoid"""
        job_id = job['job_id']
        host = job['host']
        
        logger.info(f"Processing SSL job {job_id} for {host}")
        self.update_ssl_job_status(job_id, 'running', 10, current_step='Starting SSL Analysis')

        try:
            api_key = os.getenv('APIVOID_API_KEY')
            
            self.update_ssl_job_status(job_id, 'running', 30, current_step='Calling APIVoid SSL Info')
            
            response = requests.post(
                "https://api.apivoid.com/v2/ssl-info",
                headers={"Content-Type": "application/json", "X-API-Key": api_key},
                json={"host": host},
                timeout=30
            )

            if response.status_code != 200:
                raise Exception(f"APIVoid returned status {response.status_code}: {response.text}")

            data = response.json()
            cert = data.get("certificate", {})
            details = cert.get("details", {})

            # Save results
            self.update_ssl_job_status(job_id, 'running', 80, current_step='Saving results')
            
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO ssl_results (
                    job_id, raw_response, certificate_data, validity_data, 
                    issuer_data, subject_data, elapsed_ms
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                job_id,
                json.dumps(data),
                json.dumps(cert),
                json.dumps(details.get("validity", {})),
                json.dumps(details.get("issuer", {})),
                json.dumps(details.get("subject", {})),
                data.get("elapsed_ms", 0)
            ))
            conn.commit()
            cur.close()
            conn.close()

            self.update_ssl_job_status(job_id, 'completed', 100, current_step='Completed')
            logger.info(f"SSL job {job_id} completed successfully")

        except Exception as e:
            logger.error(f"SSL job {job_id} failed: {e}")
            self.update_ssl_job_status(job_id, 'failed', error=str(e))

    def update_ip_job_status(self, job_id, status, progress=None, error=None, current_step=None):
        """Update IP job status in database"""
        conn = self.get_db()
        cur = conn.cursor()
        updates = ['status = %s']
        params = [status]
        if progress is not None:
            updates.append('progress = %s')
            params.append(progress)
        if current_step is not None:
            updates.append('current_step = %s')
            params.append(current_step)
        if error:
            updates.append('error_message = %s')
            params.append(error)
        if status == 'running':
            # No started_at in ip_jobs schema, let's just use status
            pass
        elif status in ['completed', 'failed']:
            updates.append('completed_at = NOW()')
        params.append(job_id)
        query = f"UPDATE ip_jobs SET {', '.join(updates)} WHERE job_id = %s"
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()

    def process_ip_job(self, job):
        """Process IP Reputation analysis using APIVoid"""
        job_id = job['job_id']
        ip = job['ip']
        
        logger.info(f"Processing IP job {job_id} for {ip}")
        self.update_ip_job_status(job_id, 'running', 10, current_step='Starting IP Reputation Analysis')

        try:
            api_key = os.getenv('APIVOID_API_KEY')
            
            self.update_ip_job_status(job_id, 'running', 30, current_step='Calling APIVoid IP Reputation')
            
            response = requests.post(
                "https://api.apivoid.com/v2/ip-reputation",
                headers={"Content-Type": "application/json", "X-API-Key": api_key},
                json={"ip": ip},
                timeout=30
            )

            if response.status_code != 200:
                raise Exception(f"APIVoid returned status {response.status_code}: {response.text}")

            data = response.json()
            
            # Save results
            self.update_ip_job_status(job_id, 'running', 80, current_step='Saving results')
            
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO ip_results (
                    job_id, raw_response, risk_score, information, 
                    blacklists, anonymity, asn_data, elapsed_ms
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                job_id,
                json.dumps(data),
                json.dumps(data.get("risk_score", {})),
                json.dumps(data.get("information", {})),
                json.dumps(data.get("blacklists", {})),
                json.dumps(data.get("anonymity", {})),
                json.dumps(data.get("asn", {})),
                data.get("elapsed_ms", 0)
            ))
            conn.commit()
            cur.close()
            conn.close()

            self.update_ip_job_status(job_id, 'completed', 100, current_step='Completed')
            logger.info(f"IP job {job_id} completed successfully")

        except Exception as e:
            logger.error(f"IP job {job_id} failed: {e}")
            self.update_ip_job_status(job_id, 'failed', error=str(e))

    def update_domain_job_status(self, job_id, status, progress=None, error=None, current_step=None):
        """Update Domain job status in database"""
        conn = self.get_db()
        cur = conn.cursor()
        updates = ['status = %s']
        params = [status]
        if progress is not None:
            updates.append('progress = %s')
            params.append(progress)
        if current_step is not None:
            updates.append('current_step = %s')
            params.append(current_step)
        if error:
            updates.append('error_message = %s')
            params.append(error)
        if status == 'running':
            pass
        elif status in ['completed', 'failed']:
            updates.append('updated_at = NOW()')
        params.append(job_id)
        query = f"UPDATE domain_jobs SET {', '.join(updates)} WHERE id = %s"
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()

    def process_domain_job(self, job):
        """Process Domain Reputation analysis using APIVoid"""
        job_id = job['job_id']
        host = job['host']
        
        logger.info(f"Processing Domain job {job_id} for {host}")
        self.update_domain_job_status(job_id, 'running', 10, current_step='Starting Domain Reputation Analysis')

        try:
            api_key = os.getenv('APIVOID_API_KEY')
            
            self.update_domain_job_status(job_id, 'running', 30, current_step='Calling APIVoid Domain Reputation')
            
            response = requests.post(
                "https://api.apivoid.com/v2/domain-reputation",
                headers={"Content-Type": "application/json", "X-API-Key": api_key},
                json={"host": host},
                timeout=30
            )

            if response.status_code != 200:
                raise Exception(f"APIVoid returned status {response.status_code}: {response.text}")

            data = response.json()
            
            # Save results
            self.update_domain_job_status(job_id, 'running', 80, current_step='Saving results')
            
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO domain_results (
                    job_id, host, risk_score, blacklists, server_details, 
                    category, security_checks, domain_parts, raw_response
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                job_id,
                host,
                json.dumps(data.get("risk_score", {})),
                json.dumps(data.get("blacklists", {})),
                json.dumps(data.get("server_details", {})),
                json.dumps(data.get("category", {})),
                json.dumps(data.get("security_checks", {})),
                json.dumps(data.get("domain_parts", {})),
                json.dumps(data)
            ))
            conn.commit()
            cur.close()
            conn.close()

            self.update_domain_job_status(job_id, 'completed', 100, current_step='Completed')
            logger.info(f"Domain job {job_id} completed successfully")

        except Exception as e:
            logger.error(f"Domain job {job_id} failed: {e}")
            self.update_domain_job_status(job_id, 'failed', error=str(e))

    # --- VirusTotal Malware Detection ---

    def update_vt_job_status(self, job_id, status, progress=None, error=None, current_step=None):
        """Update VirusTotal job status in database"""
        conn = self.get_db()
        cur = conn.cursor()
        updates = ['status = %s']
        params = [status]
        if progress is not None:
            updates.append('progress = %s')
            params.append(progress)
        if current_step is not None:
            updates.append('current_step = %s')
            params.append(current_step)
        if error:
            updates.append('error_message = %s')
            params.append(error)
        if status == 'running':
            # No started_at in vt_malware_jobs, using current status logic
            pass
        elif status in ['completed', 'failed']:
            updates.append('completed_at = NOW()')
        params.append(job_id)
        query = f"UPDATE vt_malware_jobs SET {', '.join(updates)} WHERE job_id = %s"
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()

    def process_vt_malware_job(self, job):
        """Process standalone VirusTotal Malware job"""
        job_id = job['job_id']
        res_type = job['resource_type']
        res_val = job['resource_value']
        
        logger.info(f"Processing VT job {job_id} for {res_type}:{res_val}")
        self.update_vt_job_status(job_id, 'running', 10, current_step=f'Starting VT {res_type} analysis')

        try:
            if res_type == 'file':
                self.update_vt_job_status(job_id, 'running', 40, current_step='Checking file hash on VirusTotal')
                vt_data = self.vt_check_file_hash(res_val)
                
                # If hash not found and we have file content, upload it
                if (not vt_data or vt_data.get('data', {}).get('attributes', {}).get('last_analysis_stats', {}).get('malicious') is None) \
                   and job.get('file_content_base64'):
                    self.update_vt_job_status(job_id, 'running', 50, current_step='File not seen before, uploading to VirusTotal...')
                    file_content = base64.b64decode(job['file_content_base64'])
                    vt_data = self.vt_upload_file(file_content, job.get('file_name', 'uploaded_file'))
            
            elif res_type == 'url':
                self.update_vt_job_status(job_id, 'running', 40, current_step='Scanning URL on VirusTotal')
                vt_data = self.vt_scan_url(res_val)
            else:
                raise ValueError(f"Invalid resource type: {res_type}")

            if vt_data:
                self.update_vt_job_status(job_id, 'running', 80, current_step='Saving results')
                self.save_vt_malware_result(job_id, res_type, res_val, vt_data)
                self.update_vt_job_status(job_id, 'completed', 100, current_step='Completed')
            else:
                raise Exception("Failed to retrieve data from VirusTotal")

        except Exception as e:
            logger.error(f"VT job {job_id} failed: {e}")
            self.update_vt_job_status(job_id, 'failed', error=str(e))


    def vt_check_file_hash(self, file_hash):
        """Check file hash on VirusTotal"""
        api_key = os.getenv('VIRUSTOTAL_API_KEY')
        if not api_key:
            logger.warning("VIRUSTOTAL_API_KEY not found")
            return None

        url = f"https://www.virustotal.com/api/v3/files/{file_hash}"
        headers = {"x-apikey": api_key}
        
        try:
            response = requests.get(url, headers=headers, timeout=20)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                logger.info(f"File hash {file_hash} not found on VirusTotal")
                return {"data": {"attributes": {"last_analysis_stats": {"malicious": 0, "suspicious": 0}}}}
            else:
                logger.error(f"VirusTotal error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error calling VirusTotal for hash {file_hash}: {e}")
            return None

    def vt_upload_file(self, file_content, file_name):
        """Upload file to VirusTotal and wait for analysis"""
        api_key = os.getenv('VIRUSTOTAL_API_KEY')
        if not api_key: return None

        url = "https://www.virustotal.com/api/v3/files"
        headers = {"x-apikey": api_key}
        files = {"file": (file_name, file_content)}
        
        try:
            # 1. Upload
            response = requests.post(url, headers=headers, files=files, timeout=60)
            if response.status_code != 200:
                logger.error(f"VT Upload failed: {response.status_code} - {response.text}")
                return None
            
            analysis_id = response.json().get('data', {}).get('id')
            if not analysis_id: return None

            # 2. Poll for results (Max 2 minutes)
            analysis_url = f"https://www.virustotal.com/api/v3/analyses/{analysis_id}"
            for _ in range(12): # 12 * 10s = 120s
                time.sleep(10)
                resp = requests.get(analysis_url, headers=headers, timeout=20)
                if resp.status_code == 200:
                    data = resp.json()
                    status = data.get('data', {}).get('attributes', {}).get('status')
                    if status == 'completed':
                        # Get the file report using the hash from analysis metadata
                        file_hash = data.get('meta', {}).get('file_info', {}).get('sha256')
                        return self.vt_check_file_hash(file_hash)
            
            return None
        except Exception as e:
            logger.error(f"Error uploading file to VT: {e}")
            return None

    def vt_scan_url(self, target_url):
        """Scan URL on VirusTotal"""
        api_key = os.getenv('VIRUSTOTAL_API_KEY')
        if not api_key:
            return None

        # Step 1: Submit URL
        submit_url = "https://www.virustotal.com/api/v3/urls"
        headers = {"x-apikey": api_key}
        payload = {"url": target_url}
        
        try:
            # For malware detection, we usually check if it was already scanned
            # or we can force a new scan. Here we'll try to get the report first 
            # by hashing the URL (VT style)
            import hashlib
            url_id = base64.urlsafe_b64encode(target_url.encode()).decode().strip("=")
            report_url = f"https://www.virustotal.com/api/v3/urls/{url_id}"
            
            response = requests.get(report_url, headers=headers, timeout=20)
            if response.status_code == 200:
                return response.json()
            
            # If not found, submit for scanning
            response = requests.post(submit_url, headers=headers, data=payload, timeout=20)
            if response.status_code == 200:
                # In a real worker, we might wait or poll, but for now we return the analysis ID
                return response.json()
            
            return None
        except Exception as e:
            logger.error(f"Error calling VirusTotal for URL {target_url}: {e}")
            return None

    def save_vt_malware_result(self, job_id, resource_type, resource_value, vt_data):
        """Save VirusTotal malware result to database"""
        if not vt_data or 'data' not in vt_data:
            return

        stats = vt_data['data']['attributes'].get('last_analysis_stats', {})
        
        try:
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO vt_malware_results (
                    job_id, resource_type, resource_value, 
                    malicious_count, suspicious_count, undetected_count, harmless_count,
                    raw_response
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                job_id,
                resource_type,
                resource_value,
                stats.get('malicious', 0),
                stats.get('suspicious', 0),
                stats.get('undetected', 0),
                stats.get('harmless', 0),
                json.dumps(vt_data)
            ))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Error saving VT result to DB: {e}")



    
    def run_subdomain_enum(self, target, job_dir, options):
        """Run subdomain enumeration"""
        logger.info(f"Running subdomain enumeration for {target}")
        
        tools = {
            'subfinder': f'subfinder -d {target} -silent',
            'assetfinder': f'assetfinder --subs-only {target}'
        }
        
        results = {'subdomains': set(), 'tool_outputs': {}}
        
        for tool_name, command in tools.items():
            try:
                output_file = job_dir / f'{tool_name}.txt'
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=options.get('timeout', 600)
                )
                
                with open(output_file, 'w') as f:
                    f.write(result.stdout)
                
                subs = [line.strip() for line in result.stdout.split('\n') if line.strip()]
                results['subdomains'].update(subs)
                results['tool_outputs'][tool_name] = str(output_file)
                
            except Exception as e:
                logger.error(f"Error running {tool_name}: {e}")
                results['tool_outputs'][tool_name] = f"Error: {str(e)}"
        
        # Save unique subdomains
        unique_file = job_dir / 'unique_subdomains.txt'
        with open(unique_file, 'w') as f:
            f.write('\n'.join(sorted(results['subdomains'])))
        
        # Resolve IPs for subdomains
        subdomains_with_ips = []
        import socket
        
        logger.info(f"Resolving IPs for {len(results['subdomains'])} subdomains...")
        for sub in sorted(results['subdomains']):
            try:
                ip = socket.gethostbyname(sub)
                subdomains_with_ips.append({'subdomain': sub, 'ip': ip})
            except:
                subdomains_with_ips.append({'subdomain': sub, 'ip': 'N/A'})
        
        return {
            'total_subdomains': len(results['subdomains']),
            'unique_file': str(unique_file),
            'tool_outputs': results['tool_outputs'],
            'subdomains_list': subdomains_with_ips 
        }

    
    def run_port_scan(self, target, job_dir, options):
        """Run port scanning"""
        logger.info(f"Running port scan for {target}")
        
        output_file = job_dir / 'naabu_results.txt'
        
        command = f'naabu -host {target} -top-ports {options.get("top_ports", 1000)} -silent'
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=options.get('timeout', 600)
            )
            
            with open(output_file, 'w') as f:
                f.write(result.stdout)
            
            ports = [line.strip() for line in result.stdout.split('\n') if line.strip()]
            
            return {
                'open_ports': len(ports),
                'ports': ports,
                'output_file': str(output_file)
            }
        except Exception as e:
            logger.error(f"Error running port scan: {e}")
            return {'error': str(e)}
    
    def run_vuln_scan(self, target, job_dir, options):
        """Run vulnerability scanning with Nuclei"""
        logger.info(f"Running vulnerability scan for {target}")
        
        output_file = job_dir / 'nuclei_results.json'
        
        command = f'nuclei -u {target} -severity {options.get("severity", "critical,high,medium")} -json-export {output_file}'

        
        try:
            subprocess.run(
                command,
                shell=True,
                timeout=options.get('timeout', 1800)
            )
            
            if output_file.exists():
                with open(output_file) as f:
                    vulns = [json.loads(line) for line in f if line.strip()]
                
                return {
                    'vulnerabilities_found': len(vulns),
                    'output_file': str(output_file),
                    'summary': {
                        'critical': sum(1 for v in vulns if v.get('info', {}).get('severity') == 'critical'),
                        'high': sum(1 for v in vulns if v.get('info', {}).get('severity') == 'high'),
                        'medium': sum(1 for v in vulns if v.get('info', {}).get('severity') == 'medium')
                    }
                }
            else:
                return {'vulnerabilities_found': 0}
                
        except Exception as e:
            logger.error(f"Error running vuln scan: {e}")
            return {'error': str(e)}
    
    def run_tech_detect(self, target, job_dir, options):
        """Run technology detection with httpx + wappalyzer"""
        logger.info(f"Running technology detection for {target}")
        
        output_file = job_dir / 'tech_detect.json'
        
        # Use httpx with -tech-detect and -title flag
        command = f'httpx -u {target} -silent -td -title -json -o {output_file}'
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=options.get('timeout', 300)
            )
            
            logger.info(f"httpx exit code: {result.returncode}")
            if result.stderr:
                logger.warning(f"httpx stderr: {result.stderr}")
            
            technologies = []
            tech_set = set()  # Use set to avoid duplicates
            
            if output_file.exists():
                logger.info(f"Output file exists: {output_file}")
                with open(output_file) as f:
                    content = f.read()
                    logger.info(f"File content length: {len(content)} bytes")
                    
                    for line in content.split('\n'):
                        if line.strip():
                            try:
                                data = json.loads(line)
                                logger.info(f"Parsed JSON keys: {data.keys()}")
                                
                                # httpx returns 'tech' field as array of strings
                                # Format: "tech":["Bootstrap:4","Google Analytics","Nginx:1.24.0"]
                                if 'tech' in data:
                                    tech_list = data['tech']
                                    if isinstance(tech_list, list):
                                        for tech_item in tech_list:
                                            if isinstance(tech_item, str):
                                                # Parse "Name:Version" or just "Name"
                                                if ':' in tech_item:
                                                    parts = tech_item.split(':', 1)
                                                    tech_set.add((parts[0], parts[1]))
                                                else:
                                                    tech_set.add((tech_item, ''))
                                            
                            except json.JSONDecodeError as e:
                                logger.error(f"JSON decode error: {e} for line: {line[:100]}")
            else:
                logger.warning(f"Output file does not exist: {output_file}")
            
            # Convert set to list format
            technologies = [
                {'name': name, 'version': version} if version else {'name': name}
                for name, version in sorted(tech_set)
            ]
            
            # Extract Website Info (Title)
            website_info = {'title': '', 'description': ''}
            if output_file.exists():
                with open(output_file) as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line)
                            if 'title' in data:
                                website_info['title'] = data['title']
                                break
            
            # Extract Description using requests + regex
            try:
                import requests
                import re
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                # Try HTTPS first, then fallback to HTTP
                protocols = ['https://', 'http://']
                success = False
                
                for proto in protocols:
                    try:
                        response = requests.get(f"{proto}{target}", timeout=10, verify=False, headers=headers, allow_redirects=True)
                        if response.status_code == 200:
                            # 1. Extract Title (if not already found by httpx)
                            if not website_info['title']:
                                title_match = re.search(r'<title>(.*?)</title>', response.text, re.I | re.S)
                                if title_match:
                                    website_info['title'] = title_match.group(1).strip()
                                else:
                                    # Try og:title
                                    og_title = re.search(r'<meta[^>]*?property=["\']og:title["\']\s+content=["\'](.*?)["\']', response.text, re.I)
                                    if og_title:
                                        website_info['title'] = og_title.group(1).strip()

                            # 2. Extract Description
                            # Try meta name="description"
                            desc_match = re.search(r'<meta[^>]*?name=["\']description["\']\s+content=["\'](.*?)["\']', response.text, re.I | re.S)
                            if not desc_match:
                                # Try content before name
                                desc_match = re.search(r'<meta[^>]*?content=["\'](.*?)["\']\s+name=["\']description["\']', response.text, re.I | re.S)
                            
                            if desc_match:
                                website_info['description'] = desc_match.group(1).strip()
                            else:
                                # Try og:description
                                og_desc = re.search(r'<meta[^>]*?property=["\']og:description["\']\s+content=["\'](.*?)["\']', response.text, re.I | re.S)
                                if og_desc:
                                    website_info['description'] = og_desc.group(1).strip()
                            
                            success = True
                            break
                    except Exception as proto_e:
                        logger.warning(f"Failed to fetch metadata with {proto}: {proto_e}")
                        continue
                
            except Exception as e:
                logger.error(f"Error fetching metadata for {target}: {e}")
            
            # Clean up whitespace and HTML entities if any (basic)
            import html
            website_info['title'] = html.unescape(website_info['title']).strip() if website_info['title'] else ''
            website_info['description'] = html.unescape(website_info['description']).strip() if website_info['description'] else ''
            
            logger.info(f"Final Website Info for {target}: {website_info}")
            
            return {
                'technologies_found': len(technologies),
                'technologies': technologies,
                'website_info': website_info,
                'output_file': str(output_file)
            }
                
        except Exception as e:
            logger.error(f"Error running tech detection: {e}")
            return {'error': str(e)}
    
    def run_waf_detect(self, target, job_dir, options):
        """Run WAF detection with wafw00f"""
        logger.info(f"Running WAF detection for {target}")
        
        output_file = job_dir / 'waf_detect.json'
        
        # wafw00f with JSON output
        command = f'wafw00f {target} -f json -o {output_file}'
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=options.get('timeout', 120)
            )
            
            logger.info(f"wafw00f exit code: {result.returncode}")
            if result.stderr:
                logger.warning(f"wafw00f stderr: {result.stderr}")
            
            waf_detected = None
            waf_manufacturer = None
            firewall_name = None
            
            if output_file.exists():
                logger.info(f"Output file exists: {output_file}")
                with open(output_file) as f:
                    try:
                        data = json.load(f)
                        logger.info(f"Parsed JSON type: {type(data)}")
                        
                        # wafw00f JSON format: [{"url": "...", "detected": true, "firewall": "Cloudflare", "manufacturer": "Cloudflare Inc."}]
                        if isinstance(data, list) and len(data) > 0:
                            result_data = data[0]
                            waf_detected = result_data.get('detected', False)
                            waf_manufacturer = result_data.get('manufacturer', 'Unknown')
                            firewall_name = result_data.get('firewall', 'Unknown')
                            
                            logger.info(f"WAF detected: {waf_detected}, Firewall: {firewall_name}")
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error: {e}")
            else:
                logger.warning(f"Output file does not exist: {output_file}")
            
            return {
                'waf_detected': waf_detected if waf_detected is not None else False,
                'firewall': firewall_name if waf_detected else None,
                'manufacturer': waf_manufacturer if waf_detected else None,
                'output_file': str(output_file)
            }
                
        except Exception as e:
            logger.error(f"Error running WAF detection: {e}")
            return {'error': str(e)}

    def run_geoip(self, target):
        """Get geographical info for the target IP"""
        logger.info(f"Running GeoIP for {target}")
        try:
            import socket
            import requests
            
            # Resolve domain to IP
            ip = socket.gethostbyname(target)
            logger.info(f"Resolved {target} to {ip}")
            
            response = requests.get(f"http://ip-api.com/json/{ip}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    geo_info = {
                        'country': data.get('country'),
                        'countryCode': data.get('countryCode'),
                        'regionName': data.get('regionName'),
                        'city': data.get('city'),
                        'lat': data.get('lat'),
                        'lon': data.get('lon'),
                        'isp': data.get('isp'),
                        'query': data.get('query') # This is the IP
                    }
                    logger.info(f"GeoIP result for {target}: {geo_info['country']} ({geo_info['countryCode']})")
                    return geo_info
            return {}
        except Exception as e:
            logger.error(f"Error running GeoIP for {target}: {e}")
            return {}

    
    def process_job(self, job_data):
        """Process a job"""
        job_id = job_data['job_id']
        target = job_data['target']
        scan_type = job_data['scan_type']
        options = job_data.get('options', {})
        
        logger.info(f"Processing job {job_id}: {scan_type} scan for {target}")
        
        # Create job directory
        job_dir = self.output_base / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        
        results = {}
        
        try:
            # Update status to running
            self.update_job_status(job_id, 'running', progress=0)
            
            # Execute scan based on type
            if scan_type == 'subdomain':
                results = self.run_subdomain_enum(target, job_dir, options)
                self.update_job_status(job_id, 'running', progress=100)
                
            elif scan_type == 'portscan':
                results = self.run_port_scan(target, job_dir, options)
                self.update_job_status(job_id, 'running', progress=100)
                
            elif scan_type == 'vuln_scan':
                results = self.run_vuln_scan(target, job_dir, options)
                self.update_job_status(job_id, 'running', progress=100)
                
            elif scan_type == 'tech_detect':
                results = self.run_tech_detect(target, job_dir, options)
                self.update_job_status(job_id, 'running', progress=100)
                
            elif scan_type == 'waf_detect':
                results = self.run_waf_detect(target, job_dir, options)
                self.update_job_status(job_id, 'running', progress=100)
                
            elif scan_type == 'full':
                # Full recon pipeline (4 steps)
                self.update_job_status(job_id, 'running', progress=5, current_step='Initializing scan...')
                
                logger.info("Step 1/4: Subdomain Enumeration")
                self.update_job_status(job_id, 'running', progress=10, current_step='Step 1/4: Subdomain Enumeration')
                subdomain_results = self.run_subdomain_enum(target, job_dir, options)
                
                self.update_job_status(job_id, 'running', progress=35, current_step='Step 2/4: Port Scanning')
                logger.info("Step 2/4: Port Scanning")
                port_results = self.run_port_scan(target, job_dir, options)
                
                self.update_job_status(job_id, 'running', progress=60, current_step='Step 3/4: Technology Detection')
                logger.info("Step 3/4: Technology Detection")
                tech_results = self.run_tech_detect(target, job_dir, options)
                
                self.update_job_status(job_id, 'running', progress=85, current_step='Step 4/4: WAF Detection')
                logger.info("Step 4/4: WAF Detection")
                waf_results = self.run_waf_detect(target, job_dir, options)
                
                self.update_job_status(job_id, 'running', progress=100, current_step='Scan complete')
                
                # Final Step: GeoIP
                self.update_job_status(job_id, 'running', 90, 'Running GeoIP Localization')
                geo_results = self.run_geoip(target)

                results = {
                    'subdomain_enum': subdomain_results,
                    'port_scan': port_results,
                    'tech_detect': tech_results,
                    'waf_detect': waf_results,
                    'website_info': tech_results.get('website_info', {}),
                    'geo_info': geo_results
                }


            else:
                raise ValueError(f"Unknown scan type: {scan_type}")
            
            # Generate Summary for Dashboard
            summary = {
                'completed_at': datetime.now().isoformat(),
                'subdomains': results.get('subdomain_enum', {}).get('total_subdomains', 0) if scan_type in ['subdomain', 'full'] else 0,
                'ports': results.get('port_scan', {}).get('open_ports', 0) if scan_type in ['portscan', 'full'] else 0,
                'vulnerabilities': 0,
                'technologies': results.get('tech_detect', {}).get('technologies_found', 0) if scan_type in ['tech_detect', 'full'] else 0,
                'waf_detected': results.get('waf_detect', {}).get('waf_detected', False) if scan_type in ['waf_detect', 'full'] else False
            }

            # Save results to database
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO job_results (job_id, results_data, file_paths, summary)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (job_id) DO UPDATE SET
                    results_data = EXCLUDED.results_data,
                    file_paths = EXCLUDED.file_paths,
                    summary = EXCLUDED.summary
            """, (
                job_id,
                json.dumps(results),
                json.dumps([str(job_dir)]),
                json.dumps(summary)
            ))

            conn.commit()
            cur.close()
            conn.close()
            
            # Update status to completed
            self.update_job_status(job_id, 'completed', progress=100)
            
            logger.info(f"Job {job_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            self.update_job_status(job_id, 'failed', error=str(e))
    
    def run(self):
        """Main worker loop"""
        logger.info(f"Worker {self.worker_id} started")
        
        # Subscribe to cancellation events
        pubsub = self.redis.pubsub()
        pubsub.subscribe('recon:jobs:cancel')
        
        while True:
            try:
                # Check for cancellation messages first (non-blocking)
                message = pubsub.get_message()
                if message and message['type'] == 'message':
                    cancelled_job_id = message['data']
                    logger.info(f"Received cancellation for job {cancelled_job_id}")
                
                # 1. Check Recon Priority Queue
                job_data = self.redis.bzpopmin('recon:jobs:queue', timeout=2)
                if job_data:
                    _, job_json, priority = job_data
                    job = json.loads(job_json)
                    self.process_job(job)
                    continue

                # 2. Check Email Queue
                email_job_data = self.redis.brpop('recon:jobs:email', timeout=2)
                if email_job_data:
                    _, job_json = email_job_data
                    job = json.loads(job_json)
                    self.process_email_job(job)
                    continue

                # 3. Check SSL Queue
                ssl_job_data = self.redis.brpop('recon:jobs:ssl', timeout=2)
                if ssl_job_data:
                    _, job_json = ssl_job_data
                    job = json.loads(job_json)
                    self.process_ssl_job(job)
                    continue

                # 4. Check IP Reputation Queue
                ip_job_data = self.redis.brpop('recon:jobs:ip', timeout=2)
                if ip_job_data:
                    _, job_json = ip_job_data
                    job = json.loads(job_json)
                    self.process_ip_job(job)
                    continue

                # 5. Check Domain Reputation Queue
                domain_job_data = self.redis.brpop('recon:jobs:domain', timeout=2)
                if domain_job_data:
                    _, job_json = domain_job_data
                    job = json.loads(job_json)
                    self.process_domain_job(job)
                    continue

                # 6. Check VirusTotal Malware Queue
                vt_job_data = self.redis.brpop('recon:jobs:vt', timeout=2)
                if vt_job_data:
                    _, job_json = vt_job_data
                    job = json.loads(job_json)
                    self.process_vt_malware_job(job)
                    continue

                
            except Exception as e:
                logger.error(f"Worker error: {e}")
                time.sleep(1)


if __name__ == "__main__":
    worker = ReconWorker()
    worker.run()
