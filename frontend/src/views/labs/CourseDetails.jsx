import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Rocket, ChevronRight, Layers, ShieldCheck, ArrowLeft, Clock, Zap, Lock } from 'lucide-react';
import api from '../../services/labApi';
import './CourseDetails.css';

const CourseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await api.get(`/labs/api/courses/${id}/`);
        setCourse(response.data);
        setIsEnrolled(!!response.data.is_enrolled);
      } catch (error) {
        console.error('Failed to fetch course details', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [id]);

  const handleEnroll = async () => {
    if (!course) return;
    setEnrolling(true);
    try {
      await api.post(`/labs/api/courses/${id}/enroll/`, {});
      setIsEnrolled(true);
    } catch (error) {
      alert(error.response?.data?.error || 'FAILED TO ENROLL IN COURSE');
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartLab = async (labId) => {
    try {
      const response = await api.post('/sessions/', { labId });
      navigate(`/labs/workspace/${response.data.id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'FAILED TO START SESSION');
    }
  };

  const getImageUrl = (url) => {
    if (!url) return null;
    const baseDomain = 'https://lab.smartpro.com.vn';
    
    if (url.startsWith('http')) {
      try {
        const parsed = new URL(url);
        return `${baseDomain}${parsed.pathname}`;
      } catch (e) {
        return url;
      }
    }
    return url.startsWith('/') ? `${baseDomain}${url}` : `${baseDomain}/${url}`;
  };

  if (loading) return (
    <div className="lab-loading-state">
      <div className="lab-loader"></div>
      <span>Decrypting mission data...</span>
    </div>
  );
  
  if (!course) return (
    <div className="lab-error-state">
      <h2>MISSION DATA CORRUPTED</h2>
      <Link to="/labs" className="lab-back-link">Return to Labs</Link>
    </div>
  );

  return (
    <div className="lab-course-details-root">
      <header className="lab-course-header">
        <Link to="/labs" className="lab-back-nav">
          <ArrowLeft size={18} /> <span>Back to Training Modules</span>
        </Link>
      </header>

      <div className="lab-course-content">
        <section className="lab-course-hero">
          <div className="lab-hero-info">
            <div className="lab-mission-badge">OFFICIAL COURSE</div>
            <h1 className="lab-course-title">{course.title}</h1>
            <p className="lab-course-description">{course.description}</p>
            
            <div className="lab-course-stats">
              <div className="lab-stat-item">
                <Layers size={18} /> <span>{course.modules?.length || 0} Modules</span>
              </div>
              <div className="lab-stat-item">
                <Clock size={18} /> <span>Estimated 4-6 Hours</span>
              </div>
              <div className="lab-stat-item">
                <ShieldCheck size={18} /> <span>Authorized Access</span>
              </div>
            </div>

            <div className="lab-hero-actions" style={{ marginTop: '24px' }}>
              {course.published === false ? (
                isEnrolled ? (
                  <div className="lab-enrolled-status-badge lab-expired-badge">
                    <Lock size={18} /> <span>KHÓA HỌC ĐÃ HẾT HẠN</span>
                  </div>
                ) : (
                  <button 
                    className="lab-enroll-premium-btn lab-unpublished-btn" 
                    disabled={true}
                  >
                    KHÓA HỌC CHƯA MỞ
                  </button>
                )
              ) : !isEnrolled ? (
                <button 
                  className="lab-enroll-premium-btn" 
                  onClick={handleEnroll} 
                  disabled={enrolling}
                >
                  {enrolling ? 'ĐANG ĐĂNG KÝ...' : 'ĐĂNG KÝ HỌC NGAY'}
                </button>
              ) : (
                <div className="lab-enrolled-status-badge">
                  <ShieldCheck size={18} /> <span>ĐÃ ĐĂNG KÝ & SẴN SÀNG</span>
                </div>
              )}
            </div>
          </div>
          <div className="lab-hero-visual">
            {course.thumbnail_image ? (
              <div className="lab-hero-img-wrapper">
                <img src={getImageUrl(course.thumbnail_image) || ''} alt={course.title} className="lab-hero-img" />
              </div>
            ) : (
              <div className="lab-abstract-graphic">
                <Rocket size={80} color="#f97316" />
              </div>
            )}
          </div>
        </section>

        <div className="lab-course-main-layout">
          <div className="lab-mission-pathway">
            <h2 className="lab-section-title">Mission Roadmap</h2>
            
            {course.modules?.map((module, mIdx) => (
              <div key={module.id} className="lab-roadmap-module">
                <div className="lab-module-info">
                  <div className="lab-module-index">STAGE {String(mIdx + 1).padStart(2, '0')}</div>
                  <h3 className="lab-module-title">{module.title}</h3>
                </div>

                <div className="lab-module-labs">
                  {module.labs?.map((lab) => (
                    <div key={lab.id} className={`lab-entry ${!isEnrolled ? 'lab-locked-blur' : ''}`}>
                      <div className="lab-main-info">
                        <div className={`lab-thumbnail-wrapper ${lab.active_session_id ? 'lab-active' : ''}`}>
                          {lab.thumbnail_image ? (
                            <img src={getImageUrl(lab.thumbnail_image) || ''} alt={lab.title} className="lab-thumb-img" />
                          ) : (
                            <Zap size={16} />
                          )}
                          {lab.active_session_id && <div className="lab-active-dot"></div>}
                        </div>
                        <div className="lab-text">
                          <h4 className="lab-name">{lab.title}</h4>
                          <p className="lab-excerpt">{lab.description}</p>
                          {lab.max_attempts > 0 && (
                            <div className="lab-attempts-badge">
                              ATTEMPTS: {lab.used_attempts} / {lab.max_attempts}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="lab-action-group">
                        {!isEnrolled ? (
                          <button className="lab-launch-btn lab-locked" disabled>
                            LOCKED <Lock size={16} />
                          </button>
                        ) : course.published === false ? (
                          <button className="lab-launch-btn lab-locked" disabled>
                            EXPIRED <Lock size={16} />
                          </button>
                        ) : lab.active_session_id ? (
                          <button 
                            onClick={() => navigate(`/labs/workspace/${lab.active_session_id}`)}
                            className="lab-launch-btn lab-continue-btn"
                          >
                            CONTINUE MISSION <ChevronRight size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleStartLab(lab.id)}
                            className="lab-launch-btn"
                            disabled={lab.max_attempts > 0 && lab.used_attempts >= lab.max_attempts}
                          >
                            {lab.max_attempts > 0 && lab.used_attempts >= lab.max_attempts 
                              ? 'CLEARANCE REVOKED' 
                              : 'LAUNCH MISSION'} 
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <aside className="lab-course-sidebar">
            <div className="lab-sidebar-card lab-info-card">
              <h3>Security Clearance</h3>
              <p>This lab environment is restricted to authorized personnel. All actions are logged for security purposes.</p>
              <ul className="lab-clearance-list">
                <li>VPN Not Required</li>
                <li>Isolated Sandbox</li>
                <li>Dynamic Provisioning</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CourseDetails;
