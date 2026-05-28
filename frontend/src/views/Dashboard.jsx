import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, 
  ExternalLink,
  Download,
  CheckCircle,
  Clock,
  Link,
  MapPin,
  Cloud,
  File,
  Menu,
  Search,
  ArrowUp,
  Share,
  Target,
  Shield,
  AlignLeft,
  ShieldAlert
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker,
  Annotation
} from "react-simple-maps";
import { getJobStatus, getJobResults } from '../services/api';
import { generatePDFReport } from '../utils/ReportGenerator';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const ResultSection = ({ title, icon: Icon, items, renderItem, limit = 3, label = "items" }) => {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const displayItems = expanded ? items : items.slice(0, limit);
  const showButton = items.length > limit;

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 600, marginBottom: '1.5rem' }}>
        <Icon size={18} /> {title}
      </div>
      {renderItem(displayItems)}
      {showButton && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>{items.length} {label} found</div>
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              padding: '0.6rem 2rem', 
              borderRadius: '8px', 
              fontWeight: 600, 
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            {expanded ? 'Show Less' : 'View More'}
          </button>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ onBack }) => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    let interval;
    
    const fetchData = async () => {
      try {
        const statusData = await getJobStatus(jobId);
        setJob(statusData);
        
        if (statusData.status === 'completed') {
          const resultsData = await getJobResults(jobId);
          setResults(resultsData);
          setLoading(false);
          clearInterval(interval);
        } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
          setLoading(false);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
    interval = setInterval(fetchData, 5000);
    
    return () => clearInterval(interval);
  }, [jobId]);

  if (!job) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      <div className="spinner" style={{ width: 40, height: 40, border: '4px solid #ff4b6b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    </div>
  );

  const ipAddress = results?.results?.subdomain_enum?.subdomains_list?.find(s => s.subdomain === job.target)?.ip || 
                    results?.results?.port_scan?.ports?.[0]?.split(':')[0] || 
                    'N/A';

  const websiteTitle = results?.results?.website_info?.title || 
                       results?.results?.tech_detect?.website_info?.title || 
                       `${job.target} Information`;
                       
  const websiteDescription = results?.results?.website_info?.description || 
                             results?.results?.tech_detect?.website_info?.description || 
                             `${job.target.split('.')[0].toUpperCase()} Cung Cấp Dịch Vụ...`;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem', fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif', color: '#334155', overflowX: 'hidden' }}>
      
      {/* Optional Progress Bar for running jobs */}
      {(job.status === 'running' || job.status === 'queued') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>{job.current_step || 'Scanning in Progress...'}</span>
            <span style={{ fontWeight: 700, color: '#ff4b6b' }}>{job.progress || 0}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${job.progress || 0}%` }}
              transition={{ duration: 0.5 }}
              style={{ height: '100%', background: '#ff4b6b', borderRadius: '4px' }}
            />
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="dashboard-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'minmax(0, 1fr) 320px', 
        gap: '1.5rem' 
      }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top Header Card */}
          <div className="header-card" style={{ background: 'white', borderRadius: '12px', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <Shield size={16} />
                <span>External Attack Surface Report is Here!</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div className="logo-box" style={{ width: 64, height: 64, borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <div style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #94a3b8', padding: '4px' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid #94a3b8' }}></div>
                   </div>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>
                    {job.target.split('.')[0].charAt(0).toUpperCase() + job.target.split('.')[0].slice(1)}
                  </h2>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>{job.target}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.1rem' }}>Scan Date:{new Date(job.created_at).toISOString().split('T')[0]}</div>
                </div>
              </div>
            </div>

            <div className="status-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {new Date() - new Date(job.created_at) > 1000 * 60 * 5 && job.status === 'completed' && (
                  <div style={{ 
                    background: '#f1f5f9', 
                    color: '#64748b', 
                    padding: '0.4rem 1rem', 
                    borderRadius: '6px', 
                    fontSize: '0.85rem', 
                    fontWeight: 600,
                    border: '1px solid #e2e8f0'
                  }}>
                    Cached Result
                  </div>
                )}
                <div style={{ 
                  background: job.status === 'completed' ? '#3b82f6' : '#3b82f6', 
                  color: 'white', 
                  padding: '0.4rem 1rem', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}>
                  {job.status === 'completed' ? 'Status: Completed' : 'Status: Running'}
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                {/* SVG Gauge */}
                <div style={{ position: 'relative', width: 120, height: 60, overflow: 'hidden', margin: '0 auto' }}>
                  <svg width="120" height="60" viewBox="0 0 120 60">
                    <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="url(#gaugeGradient)" strokeWidth="12" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#ff4b6b" />
                      </linearGradient>
                    </defs>
                    {/* Needle */}
                    <line x1="60" y1="60" x2="30" y2="25" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Exposure Level</div>
              </div>
            </div>
          </div>

          {/* Company Details */}
          <div className="company-card" style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', position: 'relative', overflow: 'hidden' }}>
            {/* Interactive World Map Background */}
            <div className="map-container" style={{ position: 'absolute', right: '0', top: '10%', opacity: 1, pointerEvents: 'none', width: '65%', height: '80%' }}>
              <ComposableMap
                projectionConfig={{
                  scale: 220,
                  center: [0, 0]
                }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const isTarget = results?.results?.geo_info?.countryCode === geo.properties.iso_a2 || 
                                       results?.results?.geo_info?.country === geo.properties.name;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={isTarget ? "#ff4b6b" : "#f1f5f9"}
                          stroke={isTarget ? "white" : "#e2e8f0"}
                          strokeWidth={isTarget ? 1 : 0.5}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none" },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
                {results?.results?.geo_info?.lat && results?.results?.geo_info?.lon && (
                  <>
                    <Marker coordinates={[results.results.geo_info.lon, results.results.geo_info.lat]}>
                      <circle r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                    </Marker>
                    <Annotation
                      subject={[results.results.geo_info.lon, results.results.geo_info.lat]}
                      dx={-20}
                      dy={-20}
                      connectorProps={{
                        stroke: "#475569",
                        strokeWidth: 1,
                        strokeLinecap: "round"
                      }}
                    >
                      <text 
                        x="-8" 
                        textAnchor="end" 
                        alignmentBaseline="middle" 
                        fill="#1e293b" 
                        style={{ fontSize: '10px', fontWeight: 600, background: 'white' }}
                      >
                        {results.results.geo_info.country}
                      </text>
                    </Annotation>
                  </>
                )}
              </ComposableMap>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 600 }}>
                <Target size={18} /> Company Details
              </div>
              {job.status === 'completed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.9rem' }}>
                  <CheckCircle size={18} /> Completed
                </div>
              )}
            </div>

            <div className="details-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', zIndex: 1, width: '35%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <Globe size={14} /> Domain
                </div>
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>{job.target}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <Link size={14} /> URL
                </div>
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>https://{job.target}/</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <MapPin size={14} /> IP Address
                </div>
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>{ipAddress}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <Cloud size={14} /> Cloud Provider
                </div>
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>-</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', width: '120px' }}>
                  <File size={14} /> Website Title
                </div>
                 <div 
                   title={websiteTitle}
                   style={{ fontSize: '0.85rem', color: '#334155', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingLeft: '1rem' }}
                 >
                   {websiteTitle}
                 </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', width: '120px' }}>
                  <Menu size={18} /> Description
                </div>
                 <div 
                   title={websiteDescription}
                   style={{ fontSize: '0.85rem', color: '#334155', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingLeft: '1rem' }}
                 >
                   {websiteDescription}
                 </div>
              </div>
            </div>
          </div>

          {/* Subdomain Details */}
          <ResultSection 
            title="Subdomain Enumeration"
            icon={Globe}
            label="subdomain"
            items={results?.results?.subdomain_enum?.subdomains_list}
            renderItem={(displayItems) => (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Subdomain</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Resolved IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', color: '#334155' }}>
                        <td data-label="Subdomain" style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{item.subdomain}</td>
                        <td data-label="Resolved IP" style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>{item.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />

          {/* IP Address Details */}
          <ResultSection 
            title="Identified IP Addresses"
            icon={MapPin}
            label="IP"
            items={[...new Set(results?.results?.subdomain_enum?.subdomains_list?.map(s => s.ip).filter(Boolean))]}
            renderItem={(displayItems) => (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>IP Address</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((ip, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', color: '#334155' }}>
                        <td data-label="IP Address" style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{ip}</td>
                        <td data-label="Status" style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ color: '#10b981', background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>ACTIVE</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />

          {/* Open Ports Details */}
          <ResultSection 
            title="Open Ports & Services"
            icon={Target}
            label="ports"
            items={results?.results?.port_scan?.ports}
            renderItem={(displayItems) => (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Port</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Service</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((port, idx) => {
                       const parts = String(port).split(':');
                       const portNum = parts.length > 1 ? parts[1] : parts[0];
                       const svcMap = { '80':'HTTP','443':'HTTPS','22':'SSH','21':'FTP','3306':'MySQL','9100':'Prometheus' };
                       return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', color: '#334155' }}>
                          <td data-label="Port" style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{portNum}</td>
                          <td data-label="Service" style={{ padding: '0.75rem 0.5rem' }}>{svcMap[portNum] || 'Unknown'}</td>
                          <td data-label="State" style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>OPEN</span>
                          </td>
                        </tr>
                       );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          />

          {/* Technologies Details */}
          <ResultSection 
            title="Products & Technologies"
            icon={AlignLeft}
            label="technologies"
            items={results?.results?.tech_detect?.technologies}
            renderItem={(displayItems) => (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Product / Framework</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((tech, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', color: '#334155' }}>
                        <td data-label="Product / Framework" style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{tech.name}</td>
                        <td data-label="Version" style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>{tech.version || 'Latest'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />

          {/* WAF Details */}
          {results?.results?.waf_detect && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 600, marginBottom: '1.5rem' }}>
                <Cloud size={18} /> Security & Firewall (WAF)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '12px', 
                  background: results.results.waf_detect.waf_detected ? '#fef2f2' : '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: results.results.waf_detect.waf_detected ? '#ef4444' : '#10b981'
                }}>
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    {results.results.waf_detect.waf_detected ? 'WAF Detected' : 'No WAF Detected'}
                  </div>
                  {results.results.waf_detect.waf_detected && (
                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Firewall: <span style={{ color: '#ef4444', fontWeight: 600 }}>{results.results.waf_detect.firewall}</span> 
                      {results.results.waf_detect.manufacturer && ` by ${results.results.waf_detect.manufacturer}`}
                    </div>
                  )}
                  {!results.results.waf_detect.waf_detected && (
                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      The target does not appear to be protected by a Web Application Firewall.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>



        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Download Report Card */}
          <div 
            onClick={async () => {
              if (generatingPDF) return;
              setGeneratingPDF(true);
              try {
                await generatePDFReport(job, results);
              } catch (err) {
                console.error(err);
                alert('Failed to generate PDF. Please try again.');
              } finally {
                setGeneratingPDF(false);
              }
            }}
            style={{ 
              background: 'linear-gradient(135deg, #f25829, #ff7e5f)', 
              borderRadius: '12px', 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(242, 88, 41, 0.3)',
              cursor: generatingPDF ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              opacity: generatingPDF ? 0.8 : 1
            }}
            onMouseOver={(e) => !generatingPDF && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => !generatingPDF && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Download size={64} color="white" style={{ marginBottom: '1rem', animation: generatingPDF ? 'bounce 1s infinite' : 'none' }} />
            <button 
              disabled={generatingPDF}
              style={{ 
                background: 'white', 
                color: '#f25829', 
                border: 'none', 
                padding: '0.6rem 1.5rem', 
                borderRadius: '6px', 
                fontWeight: 600, 
                fontSize: '0.85rem',
                cursor: generatingPDF ? 'wait' : 'pointer'
              }}
            >
              {generatingPDF ? 'Generating PDF...' : 'Download Full Report'}
            </button>
          </div>

          {/* Preview Panel */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <Search size={16} /> Preview
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Related Domain Card */}
              <div style={{ background: '#00b074', borderRadius: '8px', padding: '1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0, 176, 116, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Globe size={32} opacity={0.8} />
                  <Search size={16} style={{ marginLeft: '-12px', marginTop: '16px' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>0</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Related Domain</div>
                </div>
              </div>

              {/* Subdomain Card */}
              <div style={{ background: '#8b5cf6', borderRadius: '8px', padding: '1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)' }}>
                <ArrowUp size={32} opacity={0.8} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{results?.summary?.subdomains || 0}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Subdomain</div>
                </div>
              </div>

              {/* IP Address Card */}
              <div style={{ background: '#475569', borderRadius: '8px', padding: '1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(71, 85, 105, 0.3)' }}>
                <Share size={32} opacity={0.8} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{results?.summary?.ports || 0}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>IP Address</div>
                </div>
              </div>

              {/* Products and Technologies Card */}
              <div style={{ background: '#0ea5e9', borderRadius: '8px', padding: '1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)' }}>
                <Target size={32} opacity={0.8} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{results?.summary?.technologies || 0}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Products and Technologies</div>
                </div>
              </div>

              {/* Open Port Card */}
              <div style={{ background: '#10b981', borderRadius: '8px', padding: '1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}>
                <Target size={32} opacity={0.8} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{results?.summary?.ports || 0}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Open Port</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @media (max-width: 1024px) {
          .dashboard-grid { 
            grid-template-columns: 1fr !important; 
            gap: 1rem !important;
            padding: 0.5rem !important;
          }
          .header-card { 
            flex-direction: column !important; 
            align-items: center !important; 
            text-align: center;
            padding: 2rem 1.5rem !important;
            gap: 1.5rem !important;
          }
          .header-card > div:first-child {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .header-card .logo-box { margin-bottom: 1rem; }
          .status-box {
            align-items: center !important;
            width: 100%;
            border-top: 1px solid #f1f5f9;
            padding-top: 1.5rem;
          }
          .company-card {
            padding: 1.5rem !important;
          }
          .map-container {
            display: none !important;
          }
          .details-list {
            width: 100% !important;
            gap: 1rem !important;
          }
          .details-list > div {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.25rem;
          }
          .details-list > div div:last-child {
            text-align: left !important;
            padding-left: 0 !important;
            font-weight: 600;
          }

          /* Table to List conversion for mobile */
          table, thead, tbody, th, td, tr { 
            display: block !important; 
            width: 100% !important;
          }
          thead { display: none !important; }
          tr { 
            margin-bottom: 1rem; 
            background: #f8fafc; 
            padding: 1rem; 
            border-radius: 10px; 
            border: 1px solid #f1f5f9;
          }
          td { 
            padding: 0.25rem 0 !important; 
            border: none !important;
          }
          td:before {
            content: attr(data-label);
            display: block;
            font-size: 0.7rem;
            color: #94a3b8;
            text-transform: uppercase;
            font-weight: 700;
            margin-bottom: 0.1rem;
          }
        }

        @media (max-width: 768px) {
          .animate-fade-in { padding: 1rem !important; }
          h1 { font-size: 2rem !important; }
          h2 { font-size: 1.25rem !important; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
