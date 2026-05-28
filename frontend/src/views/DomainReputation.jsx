import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Shield, 
  Search, 
  AlertTriangle,
  Globe,
  Clock,
  MapPin,
  Server,
  Activity,
  UserCheck,
  Building,
  ChevronLeft,
  Layout,
  Lock,
  Tag,
  ArrowUp,
  File
} from 'lucide-react';
import { 
  scanDomain, 
  getDomainJobStatus, 
  getDomainJobResults 
} from '../services/api';

const DomainReputation = () => {
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
      const data = await getDomainJobStatus(id);
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
          const data = await getDomainJobStatus(jobId);
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
      const data = await getDomainJobResults(id);
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
      const data = await scanDomain(host);
      setJobId(data.job_id);
      navigate(`/domain/results/${data.job_id}`);
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
    navigate('/domain');
  };

  const renderRiskScore = (scoreData) => {
    const score = scoreData?.result || 0;
    const isRisky = score > 50;
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
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Risk Score</div>
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
          {isRisky ? 'MALICIOUS DOMAIN' : 'TRUSTED DOMAIN'}
        </div>
      </motion.div>
    );
  };

  if (results) {
    const { 
      risk_score: risk, 
      blacklists: bl, 
      server_details: info, 
      category: cat, 
      security_checks: sec, 
      domain_parts: parts 
    } = results;
    
    return (
      <div className="results-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
        <button onClick={resetScanner} style={{ background: 'rgba(15, 23, 42, 0.05)', border: 'none', color: '#64748b', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', fontSize: '0.9rem', transition: 'all 0.2s' }} className="hover-lift">
          <ChevronLeft size={16} /> New Analysis
        </button>

        <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start', marginBottom: '3rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: risk?.result > 50 ? '#f43f5e' : '#10b981', boxShadow: `0 0 10px ${risk?.result > 50 ? '#f43f5e' : '#10b981'}` }} />
              <span style={{ color: '#f25829', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Domain Intelligence</span>
            </div>
            <h1 style={{ margin: '0 0 1.5rem 0', fontSize: '4rem', letterSpacing: '-0.03em', fontWeight: 800 }}>{results.host}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              <div className="meta-badge">
                <Globe size={18} /> {info.country_name}
              </div>
              <div className="meta-badge">
                <Server size={18} /> {info.ip}
              </div>
              <div className="meta-badge">
                <Clock size={18} /> {new Date(results.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
          {renderRiskScore(risk)}
        </div>

        <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
          {/* Server Details Card */}
          <div className="glass-card">
            <div className="card-header">
              <MapPin size={20} />
              <h3>Server Infrastructure</h3>
            </div>
            <div className="intel-grid">
              <div className="intel-item">
                <label>IP ADDRESS</label>
                <div className="value highlight">{info.ip}</div>
              </div>
              <div className="intel-item">
                <label>ISP / ASN</label>
                <div className="value">{info.isp} ({info.asn})</div>
              </div>
              <div className="intel-item" style={{ gridColumn: 'span 2' }}>
                <label>LOCATION</label>
                <div className="value">{info.city_name}, {info.region_name}, {info.country_name}</div>
              </div>
            </div>
          </div>

          {/* Domain Breakdown Card */}
          <div className="glass-card">
            <div className="card-header">
              <Layout size={20} />
              <h3>Domain Structure</h3>
            </div>
            <div className="intel-grid">
              <div className="intel-item">
                <label>ROOT DOMAIN</label>
                <div className="value">{parts.root_domain}</div>
              </div>
              <div className="intel-item">
                <label>TLD</label>
                <div className="value">{parts.tld}</div>
              </div>
              <div className="intel-item" style={{ gridColumn: 'span 2' }}>
                <label>WEBSITE POPULARITY</label>
                <div className="value" style={{ textTransform: 'capitalize' }}>{sec.website_popularity}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Security Checks Card */}
          <div className="glass-card">
            <div className="card-header">
              <Lock size={20} />
              <h3>Security Checks</h3>
            </div>
            <div className="security-table" style={{ gridTemplateColumns: '1fr' }}>
              {[
                { label: 'Blacklisted', value: sec.is_domain_blacklisted },
                { label: 'Suspicious Homoglyph', value: sec.is_suspicious_homoglyph },
                { label: 'Typosquatting', value: sec.is_possible_typosquatting },
                { label: 'Most Abused TLD', value: sec.is_most_abused_tld },
                { label: 'Uncommon Length', value: sec.is_uncommon_host_length },
                { label: 'Risky Category', value: sec.is_risky_category }
              ].map((item, i) => (
                <div key={i} className="security-row" style={{ borderRight: 'none' }}>
                  <span className="label">{item.label}</span>
                  <span className={`status-pill ${item.value ? 'detected' : 'clean'}`}>
                    {item.value ? 'YES' : 'NO'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Analysis Card */}
          <div className="glass-card">
            <div className="card-header">
              <Tag size={20} />
              <h3>Classification</h3>
            </div>
            <div className="security-table" style={{ gridTemplateColumns: '1fr' }}>
              {[
                { label: 'Anonymizer', value: cat.is_anonymizer },
                { label: 'Free Hosting', value: cat.is_free_hosting },
                { label: 'URL Shortener', value: cat.is_url_shortener },
                { label: 'Pastebin', value: cat.is_pastebin },
                { label: 'Free File Sharing', value: cat.is_free_file_sharing },
                { label: 'Form Builder', value: cat.is_form_builder }
              ].map((item, i) => (
                <div key={i} className="security-row" style={{ borderRight: 'none' }}>
                  <span className="label">{item.label}</span>
                  <span className={`status-pill ${item.value ? 'detected' : 'clean'}`}>
                    {item.value ? 'DETECTED' : 'CLEAN'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Blacklist Detections Card */}
        <div className="glass-card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Shield size={20} />
              <h3>Blacklist Intelligence</h3>
            </div>
            <div className={`scan-summary ${bl.detections > 0 ? 'warning' : 'success'}`}>
              {bl.detections} POSITIVE MATCHES / {bl.engines_count} ENGINES
            </div>
          </div>
          
          <div className="engine-grid">
            {Object.values(bl.engines || {}).map((engine, i) => {
              let domain = '';
              try { domain = new URL(engine.reference).hostname; } catch(e) {}
              
              return (
                <div key={i} className={`engine-item ${engine.detected ? 'detected' : ''}`}>
                  <div className="engine-info">
                    <div className="favicon-box">
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                        alt="" 
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="engine-text">
                      <span className="name">{engine.name}</span>
                      <a href={engine.reference} target="_blank" rel="noreferrer">
                        Source <ArrowUp size={10} />
                      </a>
                    </div>
                  </div>
                  {engine.detected ? (
                    <Shield size={14} className="icon-error" />
                  ) : (
                    <ShieldCheck size={14} className="icon-success" />
                  )}
                </div>
              );
            })}
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
          .intel-item .value.mono { font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: #64748b; }
          .intel-item .value.highlight { color: #f25829; font-weight: 800; font-size: 1.5rem; }
          
          .security-table {
            display: grid;
            border: 1px solid #f1f5f9;
            border-radius: 16px;
            overflow: hidden;
          }
          .security-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
          }
          .security-row:last-child { border-bottom: none; }
          .security-row .label { font-weight: 600; color: #475569; font-size: 0.9rem; }
          .status-pill {
            padding: 0.4rem 1rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.05em;
          }
          .status-pill.clean { background: #f0fdf4; color: #16a34a; }
          .status-pill.detected { background: #fef2f2; color: #dc2626; box-shadow: 0 0 15px rgba(220,38,38,0.1); }
          
          .scan-summary {
            padding: 0.5rem 1.25rem;
            border-radius: 50px;
            font-size: 0.8rem;
            font-weight: 700;
          }
          .scan-summary.success { background: #dcfce7; color: #16a34a; }
          .scan-summary.warning { background: #fee2e2; color: #dc2626; }
          
          .engine-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
            max-height: 500px;
            overflow-y: auto;
            padding-right: 10px;
          }
          .engine-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 16px;
            border: 1px solid #f1f5f9;
            transition: all 0.2s;
          }
          .engine-item.detected { background: #fff1f2; border-color: #fecdd3; }
          .engine-info { display: flex; align-items: center; gap: 1rem; }
          .favicon-box {
            width: 36px;
            height: 36px;
            background: #fff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .engine-text { display: flex; flex-direction: column; }
          .engine-text .name { font-size: 0.9rem; font-weight: 700; color: #334155; }
          .engine-text a { font-size: 0.7rem; color: #94a3b8; text-decoration: none; }
          .icon-success { color: #10b981; }
          .icon-error { color: #f43f5e; }
          
          .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }

          @media (max-width: 1024px) {
            .results-grid { grid-template-columns: 1fr !important; }
            .results-container > div:nth-of-type(3) { grid-template-columns: 1fr !important; }
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
            .engine-grid { grid-template-columns: 1fr !important; }
            .card-header { flex-direction: column; align-items: flex-start !important; gap: 1rem; }
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
          Domain <span style={{ color: 'var(--accent-red)' }}>Reputation Intel</span>
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
          Comprehensive domain analysis including blacklist status, security checks, 
          and infrastructure details powered by APIVoid.
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: var(--accent-red); }
      `}</style>
    </div>
  );
};

export default DomainReputation;
