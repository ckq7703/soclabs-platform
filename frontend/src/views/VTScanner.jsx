import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ExternalLink,
  Hash,
  Globe,
  Upload,
  File as FileIcon,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  PieChart as PieIcon,
  Activity,
  Shield,
  Zap,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import { scanVT, uploadVTFile, getVTJobStatus, getVTJobResults } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const VTScanner = () => {
  const { jobId: urlJobId } = useParams();
  const navigate = useNavigate();
  const [resourceType, setResourceType] = useState('upload'); // 'file', 'url', or 'upload'
  const [resourceValue, setResourceValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [jobId, setJobId] = useState(urlJobId || null);

  useEffect(() => {
    if (urlJobId) {
      setJobId(urlJobId);
      fetchStatus(urlJobId);
    }
  }, [urlJobId]);

  const fetchStatus = async (id) => {
    try {
      const data = await getVTJobStatus(id);
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
          const data = await getVTJobStatus(jobId);
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
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const fetchResults = async (id) => {
    try {
      const data = await getVTJobResults(id);
      setResults(data);
    } catch (err) {
      setError("Failed to fetch results");
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setStatus(null);

    try {
      let data;
      if (resourceType === 'upload') {
        if (!selectedFile) throw new Error('Please select a file');

        // Validation: Size limit 32MB
        if (selectedFile.size > 32 * 1024 * 1024) {
          throw new Error('File is too large. Maximum size allowed is 32MB.');
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        data = await uploadVTFile(formData);
      } else {
        if (!resourceValue) throw new Error('Please enter a value');
        data = await scanVT(resourceType, resourceValue);
      }
      setJobId(data.job_id);
      navigate(`/vt/results/${data.job_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to start scan');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setResourceValue('');
    setSelectedFile(null);
    setResults(null);
    setStatus(null);
    setJobId(null);
    setError(null);
    navigate('/vt');
  };

  if (results) {
    const stats = [
      { name: 'Malicious', value: results.malicious_count, color: '#f43f5e' },
      { name: 'Suspicious', value: results.suspicious_count, color: '#f59e0b' },
      { name: 'Harmless', value: results.harmless_count, color: '#10b981' },
      { name: 'Undetected', value: results.undetected_count, color: '#64748b' },
    ].filter(s => s.value > 0);

    const isMalicious = results.malicious_count > 0;
    const severityColor = isMalicious ? '#f43f5e' : '#10b981';

    return (
      <div className="results-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <button onClick={resetScanner} style={{ background: 'rgba(15, 23, 42, 0.05)', border: 'none', color: '#64748b', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', fontSize: '0.9rem', transition: 'all 0.2s' }} className="hover-lift">
          <ChevronLeft size={16} /> New Analysis
        </button>

        <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start', marginBottom: '3rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: severityColor, boxShadow: `0 0 10px ${severityColor}` }} />
              <span style={{ color: '#f25829', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Security Intel Report</span>
            </div>
            <h1 style={{ margin: '0 0 1.5rem 0', fontSize: '3.5rem', letterSpacing: '-0.03em', fontWeight: 800, wordBreak: 'break-all', color: '#0f172a' }}>
              {results.resource_type === 'file' ? 'File Analysis' : 'URL Scan'}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              <div className="meta-badge">
                {results.resource_type === 'file' ? <Hash size={18} /> : <Globe size={18} />}
                <span style={{ fontFamily: 'monospace' }}>{results.resource_value.substring(0, 32)}...</span>
              </div>
              <div className="meta-badge">
                <Clock size={18} /> {new Date(results.created_at).toLocaleString()}
              </div>
              <div className="meta-badge">
                <Shield size={18} /> {results.malicious_count > 0 ? 'Threats Detected' : 'Clean Scan'}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="score-card"
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              padding: '2.5rem',
              borderRadius: '32px',
              border: `1px solid ${isMalicious ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '320px',
              boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px ${isMalicious ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
            }}
          >
            <div style={{ width: '160px', height: '160px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{results.malicious_count}</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Detections</div>
              </div>
            </div>
            <div style={{
              marginTop: '2rem',
              padding: '0.6rem 1.5rem',
              borderRadius: '50px',
              background: isMalicious ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${severityColor}44`,
              color: severityColor,
              fontWeight: 800,
              fontSize: '0.9rem',
              letterSpacing: '0.1em'
            }}>
              {isMalicious ? 'MALICIOUS DETECTED' : 'NO THREATS FOUND'}
            </div>
          </motion.div>
        </div>

        <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
          <div className="glass-card stat-item">
            <div className="card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><ShieldAlert size={24} /></div>
            <div className="stat-content">
              <label>Malicious</label>
              <div className="value">{results.malicious_count}</div>
            </div>
          </div>
          <div className="glass-card stat-item">
            <div className="card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Zap size={24} /></div>
            <div className="stat-content">
              <label>Suspicious</label>
              <div className="value">{results.suspicious_count}</div>
            </div>
          </div>
          <div className="glass-card stat-item">
            <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><ShieldCheck size={24} /></div>
            <div className="stat-content">
              <label>Harmless</label>
              <div className="value">{results.harmless_count}</div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <Activity size={20} />
            <h3>Detailed Engine Reports</h3>
          </div>
          <div className="engine-grid">
            {Object.entries(results.raw_response?.data?.attributes?.last_analysis_results || {}).map(([engine, data]) => {
              // Simple domain mapping for popular security engines to get favicons
              const domainMap = {
                'Kaspersky': 'kaspersky.com',
                'ESET-NOD32': 'eset.com',
                'ESET': 'eset.com',
                'Microsoft': 'microsoft.com',
                'Google': 'google.com',
                'Symantec': 'broadcom.com',
                'Avast': 'avast.com',
                'BitDefender': 'bitdefender.com',
                'McAfee': 'mcafee.com',
                'Sophos': 'sophos.com',
                'TrendMicro': 'trendmicro.com',
                'FireEye': 'trellix.com',
                'Malwarebytes': 'malwarebytes.com',
                'Fortinet': 'fortinet.com',
                'Paloalto': 'paloaltonetworks.com',
                'CrowdStrike': 'crowdstrike.com',
                'SentinelOne': 'sentinelone.com',
                'Bkav': 'bkav.com.vn',
                'DrWeb': 'drweb.com',
                'F-Secure': 'f-secure.com',
                'GData': 'gdata.de',
                'VBA32': 'anti-virus.by',
                'Zillya': 'zillya.com',
                'ZoneAlarm': 'zonealarm.com',
                'ClamAV': 'clamav.net',
                'AhnLab-V3': 'ahnlab.com',
                'CRDF': 'crdf.fr',
                'DNS8': 'dns8.io',
                'Cyan': 'cyan.com',
                'Lumu': 'lumu.io',
                'Cyble': 'cyble.com',
                'Ermes': 'ermes.company',
                'VIPRE': 'vipre.com',
                'Abusix': 'abusix.com',
                'CTX AI': 'ctx.ai',
                'Lionic': 'lionic.com',
                'Rising': 'rising.com.cn',
                'Acronis': 'acronis.com',
                'Blueliv': 'blueliv.com',
                'Certego': 'certego.net',
                'CyRadar': 'cyradar.com',
                'Quttera': 'quttera.com',
                'Sangfor': 'sangfor.com',
                'URLhaus': 'abuse.ch',
                'Webroot': 'webroot.com',
                'ZeroFox': 'zerofox.com',
                'AlphaSOC': 'alphasoc.com',
                'Emsisoft': 'emsisoft.com',
                'SOCRadar': 'socradar.io',
                'URLQuery': 'urlquery.net',
                'VX Vault': 'vxvault.net',
                'ViriBack': 'viriback.com',
                'Antiy-AVL': 'antiy.com',
                'Cluster25': 'cluster25.io',
                'GreenSnow': 'greensnow.co',
                'GreyNoise': 'greynoise.io',
                'LevelBlue': 'levelblue.com',
                'OpenPhish': 'openphish.com',
                'PhishFort': 'phishfort.com',
                'PhishLabs': 'phishlabs.com',
                'Phishtank': 'phishtank.com',
                'Scantitan': 'scantitan.com',
                'Seclookup': 'seclookup.com',
                'AlienVault': 'alienvault.com',
                'Gridinsoft': 'gridinsoft.com',
                'MalwareURL': 'malwareurl.com',
                'Quick Heal': 'quickheal.com',
                'SafeToOpen': 'safetoopen.com',
                'ADMINUSLabs': 'adminuslabs.com',
                'ChainPatrol': 'chainpatrol.io',
                'Criminal IP': 'criminalip.io',
                'ESTsecurity': 'estsecurity.com',
                'Chong Lua Dao': 'chongluadao.vn',
                'MalwarePatrol': 'malwarepatrol.net',
                'StopForumSpam': 'stopforumspam.com',
                'EmergingThreats': 'proofpoint.com',
                'Sansec eComscan': 'sansec.io',
                'desenmascara.me': 'desenmascara.me',
                'Heimdal Security': 'heimdalsecurity.com',
                'Juniper Networks': 'juniper.net',
                'Sucuri SiteCheck': 'sucuri.net',
                'alphaMountain.ai': 'alphamountain.ai',
                'Bfore.Ai PreCrime': 'bfore.ai',
                'Yandex Safebrowsing': 'yandex.com',
                'Hunt.io Intelligence': 'hunt.io',
                'Snort IP sample list': 'snort.org',
                'Xcitium Verdict Cloud': 'xcitium.com',
                'Forcepoint ThreatSeeker': 'forcepoint.com',
                'Viettel Threat Intelligence': 'viettelcybersecurity.com'
              };

              const domain = domainMap[engine] || `${engine.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
              const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

              return (
                <div key={engine} className={`engine-item ${data.category}`}>
                  <div className="engine-brand">
                    <div className="engine-logo">
                      <img
                        src={faviconUrl}
                        alt=""
                        onError={(e) => { e.target.src = 'https://www.google.com/s2/favicons?domain=virustotal.com&sz=64'; }}
                      />
                    </div>
                    <div className="engine-meta">
                      <div className="engine-name">{engine}</div>
                      <div className="engine-category">{data.category.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="engine-status">
                    {data.category === 'malicious' ? (
                      <span style={{ color: '#f43f5e', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldAlert size={16} /> MALWARE
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldCheck size={16} /> Clean
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <style>{`
          .results-container { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); min-height: 100vh; }
          .meta-badge { display: flex; align-items: center; gap: 0.6rem; background: #fff; padding: 0.6rem 1.2rem; border-radius: 12px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 0.9rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .glass-card { background: #fff; border-radius: 24px; padding: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
          .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; color: #0f172a; }
          .card-header h3 { margin: 0; font-size: 1.25rem; font-weight: 800; }
          .stat-item { display: flex; align-items: center; gap: 1.5rem; }
          .card-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
          .stat-content label { display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; }
          .stat-content .value { font-size: 1.75rem; font-weight: 800; color: #1e293b; line-height: 1; }
          .engine-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; max-height: 500px; overflow-y: auto; padding-right: 1rem; }
          .engine-item { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; transition: all 0.2s; }
          .engine-item.malicious { background: #fff1f2; border-color: #fecdd3; }
          .engine-brand { display: flex; align-items: center; gap: 1rem; }
          .engine-logo { width: 36px; height: 36px; background: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #f1f5f9; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          .engine-logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
          .engine-name { font-weight: 800; color: #334155; font-size: 0.95rem; line-height: 1.2; }
          .engine-category { font-size: 0.65rem; color: #94a3b8; font-weight: 800; letter-spacing: 0.05em; }
          .engine-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; flex-shrink: 0; }
          .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', textAlign: 'center',
      backgroundImage: 'linear-gradient(rgba(248, 250, 252, 0.85), rgba(248, 250, 252, 0.9)), url(/bg-world.jpg)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      width: 'calc(100% + 6rem)', margin: '-2rem -3rem', padding: '2rem'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: '900px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '2px', background: 'var(--accent-red)' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3em' }}>VirusTotal</span>
          <div style={{ width: '40px', height: '2px', background: 'var(--accent-red)' }} />
        </div>

        <h1 style={{ fontSize: '4.5rem', marginBottom: '3rem', color: '#0f172a', fontWeight: 900, letterSpacing: '-0.04em' }}>
          Malware <span style={{ color: 'var(--accent-red)' }}>Intelligence</span>
        </h1>

        <div className="scanner-container" style={{ background: '#fff', borderRadius: '40px', padding: '2.5rem', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0' }}>
          <div className="type-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', justifyContent: 'center' }}>
            {[
              { id: 'upload', label: 'File Upload', icon: Upload },
              { id: 'file', label: 'File Hash', icon: Hash },
              { id: 'url', label: 'URL Scan', icon: Globe }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setResourceType(tab.id)}
                style={{
                  padding: '1rem 2rem', borderRadius: '50px', border: '1px solid #e2e8f0',
                  background: resourceType === tab.id ? 'var(--accent-red)' : 'transparent',
                  color: resourceType === tab.id ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.3s',
                  boxShadow: resourceType === tab.id ? '0 10px 20px -5px rgba(244, 63, 94, 0.4)' : 'none'
                }}
              >
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleScan} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {resourceType === 'upload' ? (
                <div style={{ flex: 1 }}>
                  <input type="file" id="vt-upload" style={{ display: 'none' }} onChange={(e) => setSelectedFile(e.target.files[0])} />
                  <label htmlFor="vt-upload" style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 2rem',
                    background: 'rgba(15, 23, 42, 0.02)', border: '2px dashed #cbd5e1', borderRadius: '50px',
                    color: '#475569', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', flex: 1
                  }}>
                    <FileIcon size={20} />
                    {selectedFile ? selectedFile.name : "Choose a file to analyze..."}
                  </label>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={resourceType === 'file' ? "Enter MD5, SHA1 or SHA256..." : "Enter URL (e.g. google.com)..."}
                  value={resourceValue}
                  onChange={(e) => setResourceValue(e.target.value)}
                  style={{
                    flex: 1, padding: '1.25rem 2rem', borderRadius: '50px', border: '1px solid #cbd5e1',
                    fontSize: '1.1rem', background: '#f8fafc', outline: 'none', transition: 'border-color 0.2s'
                  }}
                />
              )}
              <button
                type="submit"
                disabled={loading || (resourceType === 'upload' && !selectedFile)}
                style={{
                  padding: '0 2.5rem', borderRadius: '50px', background: 'var(--accent-red)',
                  color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem',
                  boxShadow: '0 15px 25px -5px rgba(244, 63, 94, 0.3)'
                }}
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Search size={24} />}
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </form>
        </div>

        {(loading || (status && status.status !== 'completed' && status.status !== 'failed')) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '3rem', maxWidth: '600px', margin: '3rem auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#64748b', fontWeight: 700 }}>
              <span>{status?.current_step || 'Initializing engine...'}</span>
              <span>{status?.progress || 10}%</span>
            </div>
            <div style={{ height: '10px', background: 'rgba(15, 23, 42, 0.05)', borderRadius: '20px', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${status?.progress || 10}%` }}
                style={{ height: '100%', background: 'var(--accent-red)', borderRadius: '20px' }}
              />
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{
            marginTop: '2rem', padding: '1.25rem 2rem', borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', gap: '1rem', color: '#ef4444', textAlign: 'left', maxWidth: '600px', margin: '2rem auto'
          }}>
            <AlertTriangle size={24} />
            <span style={{ fontWeight: 700 }}>{error}</span>
          </motion.div>
        )}

        <p style={{ marginTop: '4rem', color: '#94a3b8', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.6 }}>
          Leverage VirusTotal's multi-engine ecosystem to identify malicious artifacts.<br />
          Supports over 70+ antivirus engines and domain blacklisting services.
        </p>
      </motion.div>

      <style>{`
        input:focus { border-color: var(--accent-red) !important; }
        .type-tabs button:hover { transform: translateY(-2px); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default VTScanner;
