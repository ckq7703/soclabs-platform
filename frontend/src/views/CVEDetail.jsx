import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Activity,
  Shield, 
  ChevronLeft, 
  ExternalLink, 
  Clock, 
  Globe, 
  AlertTriangle,
  Server,
  Zap,
  Lock,
  Eye,
  Info,
  Calendar,
  Share2,
  Layout
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { getCVEDetail } from '../services/api';

const CVEDetail = () => {
  const { cveId } = useParams();
  const navigate = useNavigate();
  const [cve, setCve] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDetail();
  }, [cveId]);

  const fetchDetail = async () => {
    try {
      const data = await getCVEDetail(cveId);
      // Parse metadata if it's a string
      let parsedMetadata = data.metadata;
      if (typeof data.metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(data.metadata);
        } catch (e) {
          console.error("Metadata parsing error:", e);
        }
      }
      setCve({...data, metadata: parsedMetadata});
    } catch (err) {
      console.error("Failed to fetch CVE detail:", err);
      setError("CVE not found or connection error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state">Initializing intelligence analysis...</div>;
  if (error) return (
    <div className="error-state">
      <AlertTriangle size={48} />
      <h2>{error}</h2>
      <button onClick={() => navigate('/cve-radar')}>Back to Intelligence</button>
    </div>
  );

  const meta = cve.metadata || {};
  const metrics = meta.metrics?.cvssMetricV31?.[0] || meta.metrics?.cvssMetricV30?.[0] || meta.metrics?.cvssMetricV2?.[0] || {};
  const cvssData = metrics.cvssData || {};
  
  const getSeverityColor = (score) => {
    if (score >= 9) return '#ef4444';
    if (score >= 7) return '#f97316';
    if (score >= 4) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="cve-detail-container">
      <motion.button 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/cve-radar')} 
        className="back-nav"
      >
        <ChevronLeft size={20} /> Back to Intelligence
      </motion.button>

      <div className="detail-header">
        <div className="header-left">
          <div className="cve-badge-large">
            <Shield size={24} />
            <h1>{cve.cve_id}</h1>
          </div>
          <div className="header-meta">
            <span><Calendar size={14} /> Published: {new Date(cve.published_date).toLocaleDateString()}</span>
            {meta.lastModified && <span><Clock size={14} /> Last Modified: {new Date(meta.lastModified).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="severity-banner" style={{ background: getSeverityColor(cve.cvss_score) }}>
          <span className="sev-label">{cvssData.baseSeverity || 'UNKNOWN'}</span>
          <span className="sev-score">{cve.cvss_score?.toFixed(1)}</span>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left Column: Metrics & Description */}
        <div className="main-info">
          <section className="glass-card desc-section">
            <h2 className="section-title"><Info size={20} /> Vulnerability Description</h2>
            <p className="description-text">{cve.description}</p>
            {meta.descriptions?.length > 1 && (
              <div className="alt-desc">
                {meta.descriptions.filter(d => d.lang !== 'en').map((d, i) => (
                  <div key={i} className="desc-box">
                    <label>{d.lang.toUpperCase()}</label>
                    <p>{d.value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card metrics-section">
            <h2 className="section-title"><Zap size={20} /> CVSS v{cvssData.version || '3.1'} Breakdown</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <label>Attack Vector</label>
                <div className="value-group">
                  <Globe size={16} />
                  <span>{cvssData.attackVector || 'N/A'}</span>
                </div>
              </div>
              <div className="metric-card">
                <label>Complexity</label>
                <div className="value-group">
                  <Zap size={16} />
                  <span>{cvssData.attackComplexity || 'N/A'}</span>
                </div>
              </div>
              <div className="metric-card">
                <label>Privileges</label>
                <div className="value-group">
                  <Lock size={16} />
                  <span>{cvssData.privilegesRequired || 'N/A'}</span>
                </div>
              </div>
              <div className="metric-card">
                <label>User Interaction</label>
                <div className="value-group">
                  <Eye size={16} />
                  <span>{cvssData.userInteraction || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="score-summary">
              <div className="sub-score">
                <span className="val">{metrics.exploitabilityScore || 'N/A'}</span>
                <span className="lbl">Exploitability Score</span>
              </div>
              <div className="sub-score">
                <span className="val">{metrics.impactScore || 'N/A'}</span>
                <span className="lbl">Impact Score</span>
              </div>
            </div>

            <div className="vector-string">
              <label>Vector String</label>
              <code>{cvssData.vectorString || 'N/A'}</code>
            </div>
          </section>
        </div>

        {/* Right Column: Key Details & References */}
        <div className="side-info">
          {meta.cisaRequiredAction && (
            <section className="glass-card cisa-alert">
              <h2 className="section-title cisa-title"><AlertTriangle size={20} /> CISA Critical Action</h2>
              <p className="cisa-text">{meta.cisaRequiredAction}</p>
              <div className="cisa-meta">
                <span>Added: {meta.cisaExploitAdd}</span>
                <span>Due: {meta.cisaActionDue}</span>
              </div>
            </section>
          )}

          <section className="glass-card weaknesses-section">
            <h2 className="section-title"><Lock size={20} /> Weaknesses (CWE)</h2>
            <div className="cwe-list">
              {meta.weaknesses?.map((w, i) => (
                <div key={i} className="cwe-item">
                  <span className="cwe-id">{w.description?.[0]?.value || 'N/A'}</span>
                  <span className="cwe-source">{w.source || 'NVD'}</span>
                </div>
              ))}
              {!meta.weaknesses?.length && <div className="no-refs">No CWE data available.</div>}
            </div>
          </section>

          <section className="glass-card configurations-section">
            <h2 className="section-title"><Server size={20} /> Affected Platforms</h2>
            <div className="config-list">
              {meta.configurations?.map((config, i) => (
                <div key={i} className="config-group">
                  {config.nodes?.map((node, j) => (
                    <div key={j} className="node-item">
                      {node.cpeMatch?.map((match, k) => (
                        <div key={k} className="cpe-tag" title={match.criteria}>
                          {match.criteria.split(':').slice(3, 5).join(' ')}
                        </div>
                      )).slice(0, 10)}
                    </div>
                  ))}
                </div>
              ))}
              {!meta.configurations?.length && <div className="no-refs">No configuration data available.</div>}
            </div>
          </section>

          <section className="glass-card references-section">
            <h2 className="section-title"><Share2 size={20} /> External References</h2>
            <div className="ref-list">
              {meta.references?.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noreferrer" className="ref-item">
                  <span className="ref-source">{ref.source || 'Official Source'}</span>
                  <ExternalLink size={14} />
                  <div className="ref-url">{ref.url}</div>
                </a>
              ))}
            </div>
          </section>

          <section className="glass-card status-section">
            <h2 className="section-title"><Layout size={20} /> Status Information</h2>
            <div className="status-grid">
              <div className="status-item">
                <label>Analysis Status</label>
                <span>{meta.vulnStatus || 'ANALYZED'}</span>
              </div>
              <div className="status-item">
                <label>Source Identifier</label>
                <span>{meta.sourceIdentifier || 'NVD'}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .cve-detail-container {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          color: #1e293b;
        }
        .back-nav {
          background: transparent;
          border: none;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 2rem;
          transition: color 0.2s;
        }
        .back-nav:hover { color: #ef4444; }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 3rem;
        }
        .cve-badge-large {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .cve-badge-large h1 {
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: -0.05em;
          margin: 0;
        }
        .cve-badge-large svg { color: #ef4444; }
        
        .header-meta {
          display: flex;
          gap: 2rem;
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .header-meta span { display: flex; align-items: center; gap: 0.5rem; }

        .severity-banner {
          padding: 1rem 2rem;
          border-radius: 20px;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .sev-label { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.1em; }
        .sev-score { font-size: 2.5rem; font-weight: 900; line-height: 1; margin-top: 4px; }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 2rem;
        }

        .glass-card {
          background: white;
          border-radius: 24px;
          padding: 2rem;
          border: 1px solid rgba(0,0,0,0.05);
          margin-bottom: 2rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .section-title {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0 0 1.5rem 0;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #0f172a;
        }
        .section-title svg { color: #ef4444; }

        .description-text {
          font-size: 1.1rem;
          line-height: 1.7;
          color: #475569;
        }
        .alt-desc { margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem; }
        .desc-box { background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0; }
        .desc-box label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; display: block; margin-bottom: 0.5rem; }
        .desc-box p { font-size: 0.9rem; color: #64748b; margin: 0; }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .metric-card {
          background: #f8fafc;
          padding: 1.25rem;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .metric-card label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .value-group { display: flex; align-items: center; gap: 0.5rem; color: #0f172a; font-weight: 700; }

        .score-summary {
          display: flex;
          gap: 3rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #0f172a;
          border-radius: 16px;
          color: white;
        }
        .sub-score { display: flex; flex-direction: column; }
        .sub-score .val { font-size: 1.5rem; font-weight: 800; }
        .sub-score .lbl { font-size: 0.8rem; color: #94a3b8; }

        .vector-string { background: #f1f5f9; padding: 1rem; border-radius: 12px; }
        .vector-string label { display: block; font-size: 0.75rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.5rem; }
        .vector-string code { font-family: monospace; font-size: 0.9rem; color: #475569; word-break: break-all; }

        .stat-summary-row { display: flex; gap: 1rem; margin-top: 1.5rem; }
        .stat-pill {
          flex: 1;
          background: #f8fafc;
          padding: 1rem;
          border-radius: 16px;
          text-align: center;
        }
        .stat-pill .num { font-size: 1.25rem; font-weight: 800; display: block; }
        .stat-pill .lab { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

        .ref-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .ref-item {
          padding: 1rem;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          text-decoration: none;
          color: #475569;
          transition: all 0.2s;
          position: relative;
        }
        .ref-item:hover { border-color: #ef4444; background: #fff1f2; }
        .ref-source { font-size: 0.7rem; font-weight: 800; color: #ef4444; text-transform: uppercase; display: block; margin-bottom: 0.4rem; }
        .ref-url { font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.7; }
        .ref-item svg { position: absolute; top: 1rem; right: 1rem; color: #94a3b8; }

        .cisa-alert { background: #fff1f2; border: 1px solid #fda4af; }
        .cisa-title { color: #e11d48 !important; }
        .cisa-text { font-size: 0.95rem; line-height: 1.6; color: #9f1239; margin-bottom: 1rem; }
        .cisa-meta { display: flex; gap: 1rem; font-size: 0.75rem; font-weight: 700; color: #e11d48; opacity: 0.8; }

        .cwe-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .cwe-item { background: #f8fafc; padding: 0.75rem 1rem; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
        .cwe-id { font-weight: 800; color: #0f172a; font-size: 0.9rem; }
        .cwe-source { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

        .config-list { display: flex; flex-direction: column; gap: 1rem; }
        .config-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .cpe-tag { background: #e2e8f0; color: #475569; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }

        .status-grid { display: flex; flex-direction: column; gap: 1rem; }
        .status-item { background: #f8fafc; padding: 1rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
        .status-item label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .status-item span { font-weight: 800; color: #0f172a; font-size: 0.85rem; }

        .loading-state { min-height: 80vh; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
        .error-state { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; }
        .error-state button { background: #ef4444; color: white; border: none; padding: 0.75rem 2rem; border-radius: 100px; font-weight: 700; cursor: pointer; }

        @media (max-width: 1024px) {
          .detail-grid { grid-template-columns: 1fr; }
          .side-info { order: -1; }
        }
        @media (max-width: 768px) {
          .metrics-grid { grid-template-columns: 1fr 1fr; }
          .cve-badge-large h1 { font-size: 2rem; }
          .header-meta { flex-direction: column; gap: 0.5rem; }
          .detail-header { flex-direction: column; gap: 2rem; align-items: center; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default CVEDetail;
