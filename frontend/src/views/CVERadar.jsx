import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, 
  Shield, 
  Clock, 
  Calendar,
  ChevronRight,
  AlertTriangle,
  Zap,
  Layout,
  ExternalLink
} from 'lucide-react';
import { getCVETrending, searchCVE } from '../services/api';

const CVERadar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    if (searchResults) {
      handleSearch();
    } else {
      fetchTrending();
    }
  }, [page]);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const data = await getCVETrending(page, limit);
      setTrending(data.trending || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch CVEs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query) {
      setSearchResults(null);
      setPage(1);
      fetchTrending();
      return;
    }
    setLoading(true);
    try {
      const data = await searchCVE(query, page, limit);
      setSearchResults(data.results);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getSeverityInfo = (score) => {
    if (score >= 9) return { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    if (score >= 7) return { label: 'HIGH', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' };
    if (score >= 4) return { label: 'MEDIUM', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    return { label: 'LOW', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
  };

  const renderCVECard = (cve, index) => {
    const sev = getSeverityInfo(cve.cvss_score);
    let meta = cve.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
    }
    
    const metrics = meta?.metrics?.cvssMetricV31?.[0] || meta?.metrics?.cvssMetricV30?.[0] || {};

    return (
      <motion.div 
        key={cve.cve_id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="cve-card glass-card"
        onClick={() => navigate(`/cve/${cve.cve_id}`)}
      >
        <div className="card-top">
          <div className="cve-id-tag">
            <Shield size={14} />
            <span>{cve.cve_id}</span>
          </div>
          <div className="severity-badge" style={{ color: sev.color, background: sev.bg }}>
            {sev.label}
          </div>
        </div>

        <h3 className="cve-title-small">
          {cve.description?.length > 120 ? cve.description.substring(0, 120) + '...' : cve.description}
        </h3>

        <div className="card-metrics">
          <div className="metric-box">
            <span className="m-val" style={{ color: sev.color }}>{cve.cvss_score?.toFixed(1) || 'N/A'}</span>
            <span className="m-lab">CVSS Base</span>
          </div>
          <div className="metric-box">
            <span className="m-val">{metrics.exploitabilityScore?.toFixed(1) || 'N/A'}</span>
            <span className="m-lab">Exploitability</span>
          </div>
          <div className="metric-box">
            <span className="m-val">{metrics.impactScore?.toFixed(1) || 'N/A'}</span>
            <span className="m-lab">Impact</span>
          </div>
        </div>

        <div className="card-footer">
          <div className="date-info">
            <Calendar size={12} />
            <span>Published: {new Date(cve.published_date).toLocaleDateString()}</span>
          </div>
          <ChevronRight size={18} className="arrow-icon" />
        </div>
      </motion.div>
    );
  };

  return (
    <div className="cve-radar-container">
      <div className="radar-header">
        <div className="header-content">
          <div className="radar-icon-box">
            <Zap size={24} className="text-red" />
          </div>
          <div className="header-text">
            <h1>CVE Intelligence</h1>
            <p>Real-time vulnerability feeds and analysis from National Vulnerability Database</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="search-wrap">
          <div className="search-input-box">
            <Search size={18} className="s-icon" />
            <input 
              type="text" 
              placeholder="Search CVE (e.g. CVE-2025-55182 or Fortinet)..." 
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (page !== 1) setPage(1);
              }}
            />
            <button type="submit">Search Database</button>
          </div>
        </form>
      </div>

      <div className="main-feed">
        <div className="feed-controls">
          <div className="tab-group">
            <button className="feed-tab active"><Layout size={16} /> Latest Feed</button>
          </div>
          <div className="sync-status">
            <Clock size={14} />
            <span>Auto-synced with NVD</span>
          </div>
        </div>

        {loading ? (
          <div className="feed-loader">
            <div className="spinner"></div>
            <span>Synchronizing with NVD Intelligence...</span>
          </div>
        ) : (
          <div className="cve-grid-new">
            {(searchResults || trending).map((cve, i) => renderCVECard(cve, i))}
            {!(searchResults || trending).length && (
              <div className="empty-state">
                <AlertTriangle size={48} />
                <h3>No vulnerabilities found</h3>
                <p>Try a different search query or check back later.</p>
              </div>
            )}
          </div>
        )}

        {!loading && total > limit && (
          <div className="pagination-bar">
            <button 
              disabled={page === 1} 
              onClick={() => handlePageChange(page - 1)}
              className="page-btn"
            >
              Previous
            </button>
            <div className="page-info">
              Page <span>{page}</span> of {Math.ceil(total / limit)}
              <small>({total} total records)</small>
            </div>
            <button 
              disabled={page * limit >= total} 
              onClick={() => handlePageChange(page + 1)}
              className="page-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <style>{`
        .cve-radar-container {
          padding: 2.5rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .radar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4rem;
          gap: 2rem;
        }
        .header-content { display: flex; align-items: center; gap: 1.5rem; }
        .radar-icon-box {
          width: 56px; height: 56px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          color: #ef4444;
        }
        .header-text h1 { font-size: 2rem; font-weight: 900; color: #0f172a; margin: 0; }
        .header-text p { color: #64748b; margin: 4px 0 0 0; font-size: 1rem; }

        .search-wrap { flex: 1; max-width: 600px; }
        .search-input-box {
          position: relative;
          display: flex;
          align-items: center;
        }
        .s-icon { position: absolute; left: 1.25rem; color: #94a3b8; }
        .search-input-box input {
          width: 100%;
          padding: 1rem 11rem 1rem 3.5rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 0.95rem;
          outline: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          transition: all 0.3s;
        }
        .search-input-box input:focus {
          border-color: #ef4444;
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.1);
        }
        .search-input-box button {
          position: absolute;
          right: 6px;
          background: #0f172a;
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .search-input-box button:hover { background: #1e293b; }

        .feed-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 1rem;
        }
        .feed-tab {
          display: flex; align-items: center; gap: 0.5rem;
          background: none; border: none;
          color: #0f172a; font-weight: 800; font-size: 1rem;
          position: relative;
          padding-bottom: 1rem;
        }
        .feed-tab.active::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 2px; background: #ef4444;
        }
        .sync-status {
          display: flex; align-items: center; gap: 0.5rem;
          color: #10b981; font-weight: 700; font-size: 0.8rem;
          background: rgba(16, 185, 129, 0.1);
          padding: 0.4rem 0.8rem;
          border-radius: 100px;
        }

        .cve-grid-new {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .cve-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          position: relative;
          overflow: hidden;
        }
        .cve-card:hover {
          transform: translateY(-4px);
          border-color: #ef4444;
          box-shadow: 0 12px 24px rgba(0,0,0,0.06);
        }

        .card-top { display: flex; justify-content: space-between; align-items: center; }
        .cve-id-tag {
          display: flex; align-items: center; gap: 0.4rem;
          color: #64748b; font-weight: 800; font-size: 0.85rem;
        }
        .severity-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.05em;
        }

        .cve-title-small {
          font-size: 1rem;
          line-height: 1.5;
          color: #334155;
          font-weight: 600;
          margin: 0;
          height: 3rem;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .card-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          background: #f8fafc;
          padding: 1rem;
          border-radius: 12px;
        }
        .metric-box { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .m-val { font-size: 1.1rem; font-weight: 800; color: #0f172a; }
        .m-lab { font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid #f1f5f9;
        }
        .date-info { display: flex; align-items: center; gap: 0.4rem; color: #94a3b8; font-size: 0.75rem; font-weight: 600; }
        .arrow-icon { color: #e2e8f0; transition: color 0.2s; }
        .cve-card:hover .arrow-icon { color: #ef4444; }

        .feed-loader {
          padding: 10rem 0;
          display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
          color: #64748b;
        }
        .spinner {
          width: 40px; height: 40px;
          border: 3px solid rgba(239, 68, 68, 0.1);
          border-top-color: #ef4444;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state {
          grid-column: 1 / -1;
          padding: 10rem 0;
          text-align: center;
          color: #94a3b8;
        }
        .empty-state h3 { color: #64748b; margin: 1rem 0 0.5rem; }

        .pagination-bar {
          margin-top: 4rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 2rem;
          padding-bottom: 2rem;
        }
        .page-btn {
          background: white;
          border: 1px solid #e2e8f0;
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.2s;
        }
        .page-btn:hover:not(:disabled) {
          border-color: #ef4444;
          color: #ef4444;
          background: #fff1f2;
        }
        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #f8fafc;
        }
        .page-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #64748b;
          font-weight: 600;
          font-size: 0.9rem;
        }
        .page-info span { color: #ef4444; font-weight: 900; font-size: 1.1rem; }
        .page-info small { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; }

        @media (max-width: 1024px) {
          .radar-header { flex-direction: column; align-items: flex-start; }
          .search-wrap { max-width: 100%; }
        }
        @media (max-width: 768px) {
          .cve-grid-new { grid-template-columns: 1fr; }
          .cve-radar-container { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
};

export default CVERadar;
