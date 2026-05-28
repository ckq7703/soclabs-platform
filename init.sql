CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    target VARCHAR(255) NOT NULL,
    scan_type VARCHAR(50) NOT NULL,
    options JSONB DEFAULT '{}',
    user_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX idx_job_id ON jobs(job_id);
CREATE INDEX idx_status ON jobs(status);
CREATE INDEX idx_user_id ON jobs(user_id);
CREATE INDEX idx_created_at ON jobs(created_at);

CREATE TABLE IF NOT EXISTS job_results (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE REFERENCES jobs(job_id) ON DELETE CASCADE,
    results_data JSONB,
    file_paths JSONB,
    summary JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_results_job_id ON job_results(job_id);

-- Email Security Analyzer Tables
CREATE TABLE IF NOT EXISTS email_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_size INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    user_id VARCHAR(100) DEFAULT 'anonymous',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_job_id ON email_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_email_file_hash ON email_jobs(file_hash);

CREATE TABLE IF NOT EXISTS email_results (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE REFERENCES email_jobs(job_id) ON DELETE CASCADE,
    raw_response JSONB,
    metadata JSONB,
    headers JSONB,
    body_text TEXT,
    attachments JSONB,
    ioc JSONB,
    sender_details JSONB,
    security_details JSONB,
    elapsed_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SSL Analyzer Tables
CREATE TABLE IF NOT EXISTS ssl_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    host VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ssl_job_id ON ssl_jobs(job_id);

CREATE TABLE IF NOT EXISTS ssl_results (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE REFERENCES ssl_jobs(job_id) ON DELETE CASCADE,
    raw_response JSONB,
    certificate_data JSONB,
    validity_data JSONB,
    issuer_data JSONB,
    subject_data JSONB,
    elapsed_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP Reputation Tables
CREATE TABLE IF NOT EXISTS ip_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    ip VARCHAR(45) NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ip_job_id ON ip_jobs(job_id);

CREATE TABLE IF NOT EXISTS ip_results (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE REFERENCES ip_jobs(job_id) ON DELETE CASCADE,
    raw_response JSONB,
    risk_score JSONB,
    information JSONB,
    blacklists JSONB,
    anonymity JSONB,
    asn_data JSONB,
    elapsed_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Domain Reputation Tables
CREATE TABLE IF NOT EXISTS domain_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES domain_jobs(id) ON DELETE CASCADE,
    host TEXT NOT NULL,
    risk_score JSONB,
    blacklists JSONB,
    server_details JSONB,
    category JSONB,
    security_checks JSONB,
    domain_parts JSONB,
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CVE Radar Tables
CREATE TABLE IF NOT EXISTS cve_cache (
    id SERIAL PRIMARY KEY,
    cve_id VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    cvss_score DECIMAL(3,1),
    cvss_severity VARCHAR(20),
    published_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    metadata JSONB, -- Storing full NVD detail, links, etc.
    svrs_score INTEGER DEFAULT 0,
    mentions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cve_cache_id ON cve_cache(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_cache_cvss ON cve_cache(cvss_score);

CREATE TABLE IF NOT EXISTS cve_trends (
    id SERIAL PRIMARY KEY,
    cve_id VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    mentions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cve_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cve_trend_date ON cve_trends(date);
CREATE INDEX IF NOT EXISTS idx_cve_trend_id ON cve_trends(cve_id);

-- VirusTotal Malware Detection Tables
CREATE TABLE IF NOT EXISTS vt_malware_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    resource_type VARCHAR(10) NOT NULL, -- 'file' (hash) hoặc 'url'
    resource_value TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_vt_malware_job_id ON vt_malware_jobs(job_id);

CREATE TABLE IF NOT EXISTS vt_malware_results (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE REFERENCES vt_malware_jobs(job_id) ON DELETE CASCADE,
    resource_type VARCHAR(10),
    resource_value TEXT,
    malicious_count INTEGER,
    suspicious_count INTEGER,
    undetected_count INTEGER,
    harmless_count INTEGER,
    raw_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
