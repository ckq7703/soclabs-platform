import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import {
  Globe,
  Shield,
  Mail,
  Lock,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldAlert,
  FlaskConical,
  LogOut,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuth();

  React.useEffect(() => {
    const handleMobileToggle = () => setIsMobileOpen(!isMobileOpen);
    document.addEventListener('mobile-menu-toggle', handleMobileToggle);
    return () => document.removeEventListener('mobile-menu-toggle', handleMobileToggle);
  }, [isMobileOpen]);

  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'discover', path: '/discover', label: 'External Attack Surface', icon: Globe },
    { id: 'email', path: '/email', label: 'Email Security Analyzer', icon: Mail },
    { id: 'ssl', path: '/ssl', label: 'SSL Analyzer', icon: Lock },
    { id: 'ip', path: '/ip', label: 'IP Reputation', icon: Shield },
    { id: 'domain', path: '/domain', label: 'Domain Reputation', icon: Globe },
    { id: 'vt', path: '/vt', label: 'Malware Analyzer', icon: ShieldAlert },
    { id: 'cve', path: '/cve-radar', label: 'CVE Intelligence', icon: Target },
    { id: 'labs', path: '/labs', label: 'Hands-on Labs', icon: FlaskConical },
  ];

  const activeId = menuItems.find(item => location.pathname.startsWith(item.path))?.id ||
    (location.pathname.startsWith('/results') ? 'discover' : '');

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    document.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: !isCollapsed }));
  };

  const handleLabLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate('/labs/login');
  };

  const userInitial = (user?.username || user?.email || 'U').charAt(0).toUpperCase();
  const displayName = user?.username || user?.email || 'Lab User';
  const displayEmail = (user?.email && user?.username) ? user.email : null;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99, backdropFilter: 'blur(4px)'
          }}
        />
      )}

      <div
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{ width: isCollapsed ? '80px' : '260px', transition: 'all 0.3s ease' }}
      >
        {/* Header */}
        <div className="sidebar-header" style={{ padding: isCollapsed ? '1.5rem 0.5rem' : '2rem 1.5rem', justifyContent: 'center', position: 'relative' }}>
          {!isCollapsed && <img src={logo} alt="Recon Platform" style={{ height: '40px', width: 'auto' }} />}
          {isCollapsed && <img src="/favicon.png" alt="RP" style={{ height: '32px', width: 'auto' }} />}

          <button
            className="desktop-only"
            onClick={toggleSidebar}
            style={{
              position: 'absolute', right: isCollapsed ? '-12px' : '12px',
              top: '50%', transform: 'translateY(-50%)',
              background: 'var(--accent-red)', border: 'none', borderRadius: '50%',
              width: '24px', height: '24px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'white', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 101, transition: 'all 0.3s'
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="sidebar-nav" style={{ padding: isCollapsed ? '0 0.5rem' : '0 0.75rem' }}>
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeId === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={isCollapsed ? item.label : ''}
              style={{
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? '0.75rem 0' : '0.75rem 1rem'
              }}
            >
              <item.icon size={20} />
              {!isCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* Lab User Compact Row — only shown when authenticated */}
        {isAuthenticated && (
          <div
            ref={userMenuRef}
            style={{
              margin: isCollapsed ? '8px 0.5rem 0' : '8px 0.75rem 0',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '10px',
              position: 'relative',
            }}
          >
            {/* Clickable user row */}
            <div
              id="lab-user-row"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              title={isCollapsed ? displayName : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? 0 : '10px',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                padding: isCollapsed ? '6px 0' : '8px 10px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: isUserMenuOpen ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isUserMenuOpen ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!isUserMenuOpen) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }
              }}
              onMouseLeave={e => {
                if (!isUserMenuOpen) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: 'white', fontWeight: 800, fontSize: '12px',
              }}>
                {userInitial}
              </div>

              {/* Name + chevron (hidden when collapsed) */}
              {!isCollapsed && (
                <>
                  <span style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {displayName}
                  </span>
                  {isUserMenuOpen
                    ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                  }
                </>
              )}
            </div>

            {/* Dropdown panel */}
            {isUserMenuOpen && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: '#1e2a3a',
                border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: '10px',
                padding: '12px',
                boxShadow: '0 -12px 32px rgba(0,0,0,0.4)',
                zIndex: 200,
                animation: 'labMenuSlide 0.15s ease-out',
              }}>
                {/* Session label */}
                <div style={{
                  fontSize: '9px', fontWeight: 800,
                  color: '#f97316', letterSpacing: '1.5px', marginBottom: '10px',
                }}>
                  LABS SESSION
                </div>

                {/* Avatar + details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'white', fontWeight: 800, fontSize: '15px',
                  }}>
                    {userInitial}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      fontSize: '14px', fontWeight: 700,
                      color: 'rgba(255,255,255,0.92)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {displayName}
                    </div>
                    {displayEmail && (
                      <div style={{
                        fontSize: '11px', color: 'rgba(255,255,255,0.4)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {displayEmail}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '10px' }} />

                {/* Logout */}
                <button
                  id="lab-logout-btn"
                  onClick={handleLabLogout}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px',
                    padding: '9px 12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    color: '#fca5a5', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.5px',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.22)';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                    e.currentTarget.style.color = '#fca5a5';
                  }}
                >
                  <LogOut size={13} />
                  LOGOUT LABS
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!isCollapsed && (
          <div className="sidebar-footer" style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
            &copy; 2026 Cybersecurity Platform
          </div>
        )}

        <style>{`
          @media (max-width: 768px) {
            .desktop-only { display: none !important; }
          }
          @keyframes labMenuSlide {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </>
  );
};

export default Sidebar;
