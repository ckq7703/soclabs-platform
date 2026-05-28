import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Upload, 
  Mail, 
  ShieldCheck, 
  Shield, 
  File, 
  Search, 
  AlertTriangle,
  Info,
  X,
  ChevronLeft,
  Globe,
  Clock,
  Download,
  ArrowUp
} from 'lucide-react';
import { 
  scanEmail, 
  getEmailJobStatus, 
  getEmailJobResults 
} from '../services/api';

const EmailAnalyzer = () => {
  const { jobId: urlJobId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState(urlJobId || null);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Initial fetch if jobId exists in URL
  useEffect(() => {
    if (urlJobId) {
      fetchStatus(urlJobId);
    }
  }, [urlJobId]);

  const fetchStatus = async (id) => {
    try {
      const data = await getEmailJobStatus(id);
      setStatus(data);
      if (data.status === 'completed') {
        fetchResults(id);
      } else if (data.status === 'failed') {
        setError(data.error_message || 'Analysis failed');
      }
    } catch (err) {
      setError("Job not found or connection error");
    }
  };

  useEffect(() => {
    let interval;
    if (jobId && (!status || (status.status !== 'completed' && status.status !== 'failed'))) {
      interval = setInterval(async () => {
        try {
          const data = await getEmailJobStatus(jobId);
          setStatus(data);
          if (data.status === 'completed') {
            fetchResults(jobId);
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setError(data.error_message || 'Analysis failed');
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const fetchResults = async (id) => {
    try {
      const data = await getEmailJobResults(id);
      setResults(data);
    } catch (err) {
      setError("Failed to fetch results");
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0] || e.dataTransfer?.files[0];
    if (!uploadedFile) return;
    if (!uploadedFile.name.endsWith('.eml')) {
      setError("Please upload a valid .eml file");
      return;
    }

    setFile(uploadedFile);
    setError(null);
    setResults(null);
    setStatus(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const data = await scanEmail(formData);
      setJobId(data.job_id);
      navigate(`/email/results/${data.job_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetScanner = () => {
    setFile(null);
    setResults(null);
    setStatus(null);
    setJobId(null);
    setError(null);
    navigate('/email');
  };

  const renderSecurityScore = (sec) => {
    const isRisky = sec.urgency === 'high' || sec.has_risky_file_extensions;
    const score = isRisky ? 35 : 98;
    const color = isRisky ? 'var(--danger)' : 'var(--success)';

    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '220px' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle 
              cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8" 
              strokeDasharray="339.29" 
              strokeDashoffset={339.29 * (1 - score / 100)} 
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{score}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security Score</div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <div style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>{isRisky ? 'POTENTIAL THREAT' : 'HIGHLY SECURE'}</div>
        </div>
      </div>
    );
  };

  if (results) {
    const { headers, security_details, ioc, body_text } = results;
    const isRisky = security_details.urgency === 'high';

    return (
      <div className="results-container animate-fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <button onClick={resetScanner} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', fontSize: '0.9rem' }}>
          <ChevronLeft size={16} /> New Analysis
        </button>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email Security Report</span>
            <h1 style={{ margin: '0.5rem 0 1rem 0', fontSize: '2.5rem' }}>{headers.subject || 'Untitled Email'}</h1>
            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={14} /> {new Date(results.created_at).toLocaleString()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <File size={14} /> {results.file_name}
              </div>
            </div>
          </div>
          {renderSecurityScore(security_details)}
        </div>

        <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
          {/* Detailed Info */}
          <div className="card" style={{ height: '100%' }}>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Info size={18} className="text-accent" /> Sender Details
            </h3>
            <div className="info-grid">
              <div className="info-row">
                <span className="label">From Address</span>
                <span className="value">{headers.from_email}</span>
              </div>
              <div className="info-row">
                <span className="label">Return Path</span>
                <span className="value">{headers.return_path || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="label">Language</span>
                <span className="value">{results.metadata?.detected_language || 'English'}</span>
              </div>
            </div>
          </div>

          {/* Security Protocols */}
          <div className="card" style={{ height: '100%' }}>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Shield size={18} className="text-accent" /> Protocol Validation
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {['spf', 'dkim', 'dmarc'].map(proto => (
                <div key={proto} className="proto-card" style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem' }}>{proto}</span>
                  <div style={{ 
                    color: security_details[`${proto}_status`] === 'pass' ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    {security_details[`${proto}_status`] === 'pass' ? <Shield size={14} /> : <AlertTriangle size={14} />}
                    {security_details[`${proto}_status`]?.toUpperCase() || 'FAIL'}
                  </div>
                </div>
              ))}
              <div className="proto-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem' }}>TLS</span>
                <span style={{ color: security_details.tls_status ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {security_details.tls_status ? 'SECURED' : 'NONE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* IOC Section */}
        <div className="card" style={{ marginBottom: '2rem' }}>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Search size={18} className="text-accent" /> Indicators of Compromise
          </h3>
          <div className="ioc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div className="ioc-column">
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Extracted URLs</h4>
              <div className="ioc-list">
                {ioc.urls?.urls?.length > 0 ? ioc.urls.urls.map((u, i) => (
                  <div key={i} className="ioc-item" title={u}>
                    <Globe size={12} /> <span>{u}</span>
                  </div>
                )) : <div className="text-muted" style={{ fontSize: '0.85rem' }}>No URLs found</div>}
              </div>
            </div>
            <div className="ioc-column">
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Email Handles</h4>
              <div className="ioc-list">
                {ioc.emails?.emails?.length > 0 ? ioc.emails.emails.map((e, i) => (
                  <div key={i} className="ioc-item">
                    <Mail size={12} /> <span>{e}</span>
                  </div>
                )) : <div className="text-muted" style={{ fontSize: '0.85rem' }}>No emails found</div>}
              </div>
            </div>
            <div className="ioc-column">
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Domains</h4>
              <div className="ioc-list">
                {ioc.domains?.domains?.length > 0 ? ioc.domains.domains.map((d, i) => (
                  <div key={i} className="ioc-item">
                    <ArrowUp size={12} /> <span>{d}</span>
                  </div>
                )) : <div className="text-muted" style={{ fontSize: '0.85rem' }}>No domains found</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Body Preview */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <File size={18} className="text-accent" /> Content Analysis
          </h3>
          <div className="body-preview" style={{ 
            background: 'rgba(0,0,0,0.3)', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            fontSize: '0.9rem', 
            lineHeight: 1.6,
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.05)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'Inter, sans-serif'
          }}>
            {body_text || "(Empty body)"}
          </div>
        </div>

        <style>{`
          .info-grid { display: flex; flex-direction: column; gap: 0.75rem; }
          .info-row { display: flex; flex-direction: column; }
          .info-row .label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.2rem; }
          .info-row .value { font-weight: 600; font-size: 0.95rem; word-break: break-all; }
          .ioc-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; }
          .ioc-item { 
            display: flex; 
            align-items: center; 
            gap: 0.6rem; 
            padding: 0.6rem; 
            background: rgba(255,255,255,0.03); 
            border-radius: 8px;
            font-size: 0.8rem;
            color: var(--text-secondary);
            transition: all 0.2s;
          }
          .ioc-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .ioc-item:hover { background: rgba(244, 63, 94, 0.1); color: var(--accent-red); }
          .text-accent { color: var(--accent-red); }

          @media (max-width: 1024px) {
            .results-grid { grid-template-columns: 1fr !important; }
            .ioc-grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 768px) {
            h1 { font-size: 2rem !important; }
            .results-container > div:first-of-type { 
              flex-direction: column !important; 
              align-items: center !important;
              text-align: center;
              gap: 2rem !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      backgroundImage: 'linear-gradient(rgba(248, 250, 252, 0.85), rgba(248, 250, 252, 0.9)), url(/bg-world.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      width: 'calc(100% + 6rem)',
      margin: '-2rem -3rem',
      padding: '2rem'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: '800px' }}
      >
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Analyze</span>
        <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 900 }}>
          Email <span style={{ color: 'var(--accent-red)' }}>Security Analyzer</span>
        </h1>

        <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto 3rem' }}>
          <input type="file" id="eml-upload" accept=".eml" onChange={handleFileUpload} style={{ display: 'none' }} />
          <div 
            onClick={() => document.getElementById('eml-upload').click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFileUpload(e); }}
            style={{ 
              width: '100%', padding: '1.25rem 4rem 1.25rem 1.5rem', borderRadius: '50px', border: '1px solid var(--border-color)', fontSize: '1.125rem', boxShadow: 'var(--shadow-lg)', background: '#ffffff', cursor: 'pointer', textAlign: 'left', color: file ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <span>{file ? file.name : 'Click to select or drop .eml file...'}</span>
            {file && <X size={20} onClick={(e) => { e.stopPropagation(); resetScanner(); }} style={{ marginRight: '1rem' }} />}
          </div>
          <button 
            onClick={() => !file && document.getElementById('eml-upload').click()}
            disabled={isUploading}
            style={{ 
              position: 'absolute', right: '8px', top: '8px', bottom: '8px', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(244, 63, 94, 0.4)'
            }}
          >
            {isUploading ? <div className="spinner" style={{ width: 20, height: 20, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> : <Upload size={24} />}
          </button>
        </div>

        {error && (
          <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '1rem auto', borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)' }}>
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {(isUploading || (status && status.status !== 'completed' && status.status !== 'failed')) && (
          <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="text-muted">{status?.current_step || 'Processing...'}</span>
              <span className="text-accent">{status?.progress || 5}%</span>
            </div>
            <div className="progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
              <div className="progress-fill" style={{ width: `${status?.progress || 5}%`, height: '100%', background: 'var(--accent-red)', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        )}

        <p className="subtitle" style={{ maxWidth: '600px', marginTop: '3rem', fontSize: '1rem', margin: '3rem auto 0' }}>
          Advanced email analysis powered by APIVoid EML Insights. 
          Detect phishing, malware, and BEC with generative AI intelligence.
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default EmailAnalyzer;
