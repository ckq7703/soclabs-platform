import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Shield, 
  Search, 
  AlertTriangle,
  Info,
  X,
  ChevronLeft,
  Globe,
  Clock,
  Lock,
  Calendar,
  Building,
  Server,
  ArrowUp
} from 'lucide-react';
import { 
  scanSSL, 
  getSSLJobStatus, 
  getSSLJobResults 
} from '../services/api';

const SSLAnalyzer = () => {
  const { jobId: urlJobId } = useParams();
  const navigate = useNavigate();

  const [host, setHost] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [jobId, setJobId] = useState(urlJobId || null);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (urlJobId) {
      fetchStatus(urlJobId);
    }
  }, [urlJobId]);

  const fetchStatus = async (id) => {
    try {
      const data = await getSSLJobStatus(id);
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
          const data = await getSSLJobStatus(jobId);
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
      const data = await getSSLJobResults(id);
      setResults(data);
    } catch (err) {
      setError("Failed to fetch results");
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!host) return;

    setError(null);
    setResults(null);
    setStatus(null);
    setIsScanning(true);

    try {
      const data = await scanSSL(host);
      setJobId(data.job_id);
      navigate(`/ssl/results/${data.job_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Scan initiation failed");
    } finally {
      setIsScanning(false);
    }
  };

  const resetScanner = () => {
    setHost('');
    setResults(null);
    setStatus(null);
    setJobId(null);
    setError(null);
    navigate('/ssl');
  };

  const renderSecurityScore = (cert) => {
    const isRisky = cert.expired || cert.revoked || !cert.valid;
    const score = isRisky ? 0 : (cert.type === 'Extended Validation' ? 100 : 90);
    const color = isRisky ? '#f43f5e' : '#10b981';
    const glow = isRisky ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)';

    return (
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="risk-card"
        style={{ 
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          padding: '2rem',
          borderRadius: '24px',
          border: `1px solid ${isRisky ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '260px',
          boxShadow: `0 20px 40px -10px rgba(0,0,0,0.3), 0 0 20px ${glow}`,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, height: '4px', 
          background: `linear-gradient(90deg, transparent, ${color}, transparent)` 
        }} />
        
        <div style={{ position: 'relative', width: '140px', height: '140px' }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
            <motion.circle 
              cx="70" cy="70" r="62" fill="none" stroke={color} strokeWidth="10" 
              strokeDasharray="389.5" 
              initial={{ strokeDashoffset: 389.5 }}
              animate={{ strokeDashoffset: 389.5 * (1 - score / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}
            >
              {score}
            </motion.div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Security Score</div>
          </div>
        </div>
        
        <div style={{ 
          marginTop: '1.5rem', 
          padding: '0.5rem 1.5rem', 
          borderRadius: '50px', 
          background: isRisky ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${color}44`,
          color: color,
          fontWeight: 700,
          fontSize: '1rem',
          letterSpacing: '0.05em'
        }}>
          {isRisky ? 'VULNERABLE CONFIG' : 'ENCRYPTED & SECURE'}
        </div>
      </motion.div>
    );
  };

  if (results) {
    const { certificate_data: cert, validity_data: validity, issuer_data: issuer, subject_data: subject } = results;
    
    return (
      <div className="results-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
        <button onClick={resetScanner} style={{ background: 'rgba(15, 23, 42, 0.05)', border: 'none', color: '#64748b', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', fontSize: '0.9rem', transition: 'all 0.2s' }} className="hover-lift">
          <ChevronLeft size={16} /> New Analysis
        </button>

        <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start', marginBottom: '3rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: (cert.expired || cert.revoked || !cert.valid) ? '#f43f5e' : '#10b981', boxShadow: `0 0 10px ${(cert.expired || cert.revoked || !cert.valid) ? '#f43f5e' : '#10b981'}` }} />
              <span style={{ color: '#f25829', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Trust Report</span>
            </div>
            <h1 style={{ margin: '0 0 1.5rem 0', fontSize: '4rem', letterSpacing: '-0.03em', fontWeight: 800 }}>{results.host}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              <div className="meta-badge">
                <Server size={18} /> Port {results.raw_response?.port || 443}
              </div>
              <div className="meta-badge">
                <Lock size={18} /> {cert.type}
              </div>
              <div className="meta-badge">
                <Clock size={18} /> {new Date(results.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
          {renderSecurityScore(cert)}
        </div>

        <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
          {/* Validity Card */}
          <div className="glass-card">
            <div className="card-header">
              <Calendar size={20} />
              <h3>Certificate Validity</h3>
            </div>
            <div className="intel-grid">
              <div className="intel-item">
                <label>VALID FROM</label>
                <div className="value">{validity.valid_from}</div>
              </div>
              <div className="intel-item">
                <label>VALID TO</label>
                <div className="value" style={{ color: validity.days_left < 30 ? '#f43f5e' : 'inherit' }}>{validity.valid_to}</div>
              </div>
              <div className="intel-item" style={{ gridColumn: 'span 2' }}>
                <div style={{ background: validity.days_left < 30 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: validity.days_left < 30 ? '#f43f5e' : '#10b981', padding: '1rem', borderRadius: '12px', textAlign: 'center', fontWeight: 800, fontSize: '1.25rem' }}>
                  {validity.days_left} DAYS REMAINING
                </div>
              </div>
            </div>
          </div>

          {/* Entity Information Card */}
          <div className="glass-card">
            <div className="card-header">
              <Building size={20} />
              <h3>Entity Information</h3>
            </div>
            <div className="intel-grid">
              <div className="intel-item" style={{ gridColumn: 'span 2' }}>
                <label>ISSUED BY</label>
                <div className="value">{issuer.common_name}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{issuer.organization}</div>
              </div>
              <div className="intel-item" style={{ gridColumn: 'span 2' }}>
                <label>ISSUED TO (SUBJECT)</label>
                <div className="value">{subject.common_name}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{subject.organization}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details Card */}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <Shield size={16} />
            <h3>Technical Fingerprints</h3>
          </div>
          <div className="intel-grid">
            <div className="intel-item" style={{ gridColumn: 'span 2' }}>
              <label>SHA-256 FINGERPRINT</label>
              <div className="value mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                {cert.fingerprint_sha256}
              </div>
            </div>
            <div className="intel-item">
              <label>PUBLIC KEY</label>
              <div className="value">{cert.details?.public_key?.algorithm} {cert.details?.public_key?.size} bits</div>
            </div>
            <div className="intel-item">
              <label>SIGNATURE TYPE</label>
              <div className="value">{cert.details?.signature?.type}</div>
            </div>
          </div>
        </div>

        {/* SAN Card */}
        <div className="glass-card">
          <div className="card-header">
            <Globe size={20} />
            <h3>Alternative Names (SAN)</h3>
          </div>
          <div className="san-grid">
            {subject.alternative_names?.split(', ').map((name, i) => (
              <div key={i} className="san-badge">
                {name}
              </div>
            ))}
          </div>
        </div>

        <style>{`
          .results-container {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            min-height: 100vh;
          }
          .meta-badge {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            background: #fff;
            padding: 0.6rem 1.2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            font-weight: 600;
            color: #475569;
            font-size: 0.95rem;
            border: 1px solid #e2e8f0;
          }
          .glass-card {
            background: #fff;
            border-radius: 24px;
            padding: 2rem;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .glass-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 35px -10px rgba(0,0,0,0.08);
          }
          .card-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 2rem;
            color: #0f172a;
          }
          .card-header h3 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.02em;
          }
          .intel-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem;
          }
          .intel-item label {
            display: block;
            font-size: 0.7rem;
            color: #94a3b8;
            font-weight: 700;
            letter-spacing: 0.1em;
            margin-bottom: 0.5rem;
          }
          .intel-item .value {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1e293b;
          }
          .intel-item .value.mono { font-family: 'JetBrains Mono', monospace; }
          .san-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.75rem;
            max-height: 300px;
            overflow-y: auto;
          }
          .san-badge {
            font-size: 0.8rem;
            padding: 0.6rem 1rem;
            background: #f8fafc;
            border-radius: 10px;
            border: 1px solid #f1f5f9;
            color: #64748b;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }

          @media (max-width: 1024px) {
            .results-grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 768px) {
            h1 { font-size: 2.5rem !important; }
            .intel-grid { grid-template-columns: 1fr !important; }
            .intel-item { grid-column: span 1 !important; }
            .results-container > div:first-of-type { 
              flex-direction: column !important; 
              align-items: center !important;
              text-align: center;
              gap: 2rem !important;
            }
            .meta-badge { justify-content: center; width: 100%; }
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
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Check</span>
        <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 900 }}>
          SSL <span style={{ color: 'var(--accent-red)' }}>Security Analyzer</span>
        </h1>

        <form onSubmit={handleScan} style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto 3rem' }}>
          <input 
            type="text" 
            placeholder="google.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            style={{ 
              width: '100%',
              padding: '1.25rem 4rem 1.25rem 1.5rem',
              borderRadius: '50px',
              border: '1px solid var(--border-color)',
              fontSize: '1.125rem',
              boxShadow: 'var(--shadow-lg)',
              outline: 'none',
              background: '#ffffff',
              color: 'var(--text-primary)',
              transition: 'border-color 0.2s'
            }}
          />
          <button 
            type="submit"
            disabled={isScanning || !host}
            style={{ 
              position: 'absolute',
              right: '8px',
              top: '8px',
              bottom: '8px',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--accent-red)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(244, 63, 94, 0.4)'
            }}
          >
            {isScanning ? (
              <div className="spinner" style={{ width: 20, height: 20, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            ) : (
              <Search size={24} />
            )}
          </button>
        </form>

        {(isScanning || (status && status.status !== 'completed' && status.status !== 'failed')) && (
          <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="text-muted">{status?.current_step || 'Connecting...'}</span>
              <span className="text-accent">{status?.progress || 5}%</span>
            </div>
            <div className="progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
              <div className="progress-fill" style={{ width: `${status?.progress || 5}%`, height: '100%', background: 'var(--accent-red)', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        )}

        {error && (
          <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '1rem auto', borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)' }}>
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          </div>
        )}

        <p className="subtitle" style={{ maxWidth: '600px', marginTop: '3rem', fontSize: '1rem', margin: '3rem auto 0' }}>
          Instantly verify SSL certificate health, expiration, and technical details. 
          Monitor chain of trust and encryption strength.
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: var(--accent-red); }
      `}</style>
    </div>
  );
};

export default SSLAnalyzer;
