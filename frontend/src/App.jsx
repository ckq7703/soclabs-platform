import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Discover from './views/Discover';
import Dashboard from './views/Dashboard';
import EmailAnalyzer from './views/EmailAnalyzer';
import SSLAnalyzer from './views/SSLAnalyzer';
import IPReputation from './views/IPReputation';
import DomainReputation from './views/DomainReputation';
import CVERadar from './views/CVERadar';
import CVEDetail from './views/CVEDetail';
import VTScanner from './views/VTScanner';
import { Menu } from 'lucide-react';

// Lab Components
import { AuthProvider, useAuth } from './context/AuthContext';
import Labs from './views/labs/Labs';
import CourseDetails from './views/labs/CourseDetails';
import Workspace from './views/labs/Workspace';
import Login from './views/labs/Login';

const LabProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>SECURITY CLEARANCE IN PROGRESS...</div>;
  if (!isAuthenticated) return <Navigate to="/labs/login" />;
  return <>{children}</>;
};

function App() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleToggle = (e) => {
      setIsSidebarCollapsed(e.detail);
    };
    document.addEventListener('sidebar-toggle', handleToggle);
    return () => document.removeEventListener('sidebar-toggle', handleToggle);
  }, []);

  const handleJobCreated = (jobId) => {
    navigate(`/results/${jobId}`);
  };

  return (
    <AuthProvider>
      <div className="app-container">
        <Sidebar />
        
        {/* Mobile Header */}
        <header className="mobile-header" style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'var(--sidebar-bg)',
          zIndex: 98,
          alignItems: 'center',
          padding: '0 1rem',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          <button 
            onClick={() => document.dispatchEvent(new CustomEvent('mobile-menu-toggle'))}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            <Menu size={24} />
          </button>
          <img src="/favicon.png" alt="Logo" style={{ height: '32px' }} />
          <div style={{ width: '24px' }}></div> {/* Spacer */}
        </header>

        <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/discover" />} />
            <Route path="/discover" element={<Discover onJobCreated={handleJobCreated} />} />
            <Route path="/email" element={<EmailAnalyzer />} />
            <Route path="/email/results/:jobId" element={<EmailAnalyzer />} />
            <Route path="/ssl" element={<SSLAnalyzer />} />
            <Route path="/ssl/results/:jobId" element={<SSLAnalyzer />} />
            <Route path="/ip" element={<IPReputation />} />
            <Route path="/ip/results/:jobId" element={<IPReputation />} />
            <Route path="/domain" element={<DomainReputation />} />
            <Route path="/domain/results/:jobId" element={<DomainReputation />} />
            <Route path="/cve-radar" element={<CVERadar />} />
            <Route path="/cve/:cveId" element={<CVEDetail />} />
            <Route path="/vt" element={<VTScanner />} />
            <Route path="/vt/results/:jobId" element={<VTScanner />} />
            <Route path="/results/:jobId" element={<Dashboard onBack={() => navigate('/discover')} />} />

            {/* Lab Routes */}
            <Route path="/labs/login" element={<Login />} />
            <Route path="/labs" element={
              <LabProtectedRoute>
                <Labs />
              </LabProtectedRoute>
            } />
            <Route path="/labs/course/:id" element={
              <LabProtectedRoute>
                <CourseDetails />
              </LabProtectedRoute>
            } />
            <Route path="/labs/workspace/:id" element={
              <LabProtectedRoute>
                <Workspace />
              </LabProtectedRoute>
            } />

            <Route path="*" element={
              <div className="animate-fade-in" style={{ textAlign: 'center', marginTop: '10rem' }}>
                <h2 style={{ color: 'var(--text-muted)' }}>Page not found</h2>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;

