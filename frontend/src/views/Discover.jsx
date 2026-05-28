import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Globe, ChevronRight } from 'lucide-react';
import { createJob } from '../services/api';

const Discover = ({ onJobCreated }) => {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!target) return;

    setLoading(true);
    try {
      const job = await createJob(target, 'full');
      onJobCreated(job.job_id);
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Error creating job. Check console.');
    } finally {
      setLoading(false);
    }
  };

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
      >
        <span style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#64748b',
          display: 'block',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em'
        }}>Discover</span>
        <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 900 }}>
          External <span style={{ color: 'var(--accent-red)' }}>Attack Surface</span>
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto 3rem'
          }}
        >
          <input
            type="text"
            placeholder="example.com"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{
              width: '100%',
              padding: '1.25rem 4rem 1.25rem 1.5rem',
              borderRadius: '50px',
              border: '1px solid var(--border-color)',
              fontSize: '1.125rem',
              boxShadow: 'var(--shadow-lg)',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
          <button
            type="submit"
            disabled={loading}
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
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            ) : (
              <Search size={24} />
            )}
          </button>
        </form>

        {/* <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
          <button className="card" style={{ 
            padding: '0.75rem 1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            cursor: 'pointer',
            fontWeight: 500
          }}>
            <Globe size={18} color="var(--accent-red)" />
            See Sample Report
          </button>
        </div> */}

        <p className="subtitle" style={{ maxWidth: '650px', marginTop: '3rem', fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Get direct visibility into all technology assets facing the internet with
          our advanced internet-wide tracking algorithms.
          Gain visibility into the hackers' perspective.
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: var(--accent-red); }
        
        @media (max-width: 1024px) {
          .animate-fade-in {
             margin: -2rem -2rem !important;
             width: calc(100% + 4rem) !important;
          }
        }

        @media (max-width: 768px) {
          .animate-fade-in {
            margin: -5rem -1rem !important;
            width: calc(100% + 2rem) !important;
            min-height: 100vh !important;
          }
          h1 { font-size: 2.5rem !important; }
          .subtitle { font-size: 0.9rem !important; }
        }
      `}</style>
    </div>
  );
};

export default Discover;
