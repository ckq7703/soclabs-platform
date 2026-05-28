import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/labApi';
import './Labs.css';

const Labs = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await api.get('/labs/api/courses/');
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setCourses(data);
      } catch (error) {
        console.error('Failed to fetch courses', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

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

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="lab-page-root" style={{
      backgroundImage: 'linear-gradient(rgba(250, 250, 250, 0.88), rgba(248, 250, 252, 0.92)), url(/bg-world.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    }}>
      <header className="lab-page-header">
        <div className="lab-header-info">
          <h1 className="lab-page-title">Training Modules</h1>
          <p className="lab-page-subtitle">Select a specialized track to begin your security training.</p>
        </div>
        
        <div className="lab-header-actions">
          <div className="lab-search">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search courses..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="lab-content">
        {loading ? (
          <div className="lab-loading">
            <div className="lab-loader"></div>
            <span>Loading intelligence data...</span>
          </div>
        ) : (
          <>
            <div className="lab-grid">
              {filteredCourses.map((course) => (
                <Link to={`/labs/course/${course.id}`} key={course.id} className="lab-course-card">
                  <div className="lab-card-visual">
                    {course.thumbnail_image ? (
                      <img src={getImageUrl(course.thumbnail_image) || ''} alt={course.title} />
                    ) : (
                      <div className="lab-card-placeholder">
                        <FlaskConical size={32} />
                        <span className="lab-clearance">CLEARANCE: LEVEL {Math.floor(Math.random() * 3) + 1}</span>
                      </div>
                    )}
                    <div className={`lab-enroll-badge ${
                      course.published === false 
                        ? 'expired' 
                        : course.is_enrolled 
                          ? 'active' 
                          : 'available'
                    }`}>
                      {course.published === false 
                        ? (course.is_enrolled ? 'HẾT HẠN' : 'CHƯA MỞ') 
                        : course.is_enrolled 
                          ? 'ĐANG HỌC' 
                          : 'SẴN SÀNG'}
                    </div>
                  </div>
                  
                  <div className="lab-card-body">
                    <h3 className="lab-card-title">{course.title}</h3>
                    <p className="lab-card-desc">{course.description?.substring(0, 100)}...</p>
                    
                    <div className="lab-labs-preview">
                      <div className="lab-preview-label">INCLUDED MISSIONS:</div>
                      <div className="lab-preview-list">
                        {course.modules?.flatMap((m) => m.labs).slice(0, 3).map((lab) => (
                          <div key={lab.id} className="lab-preview-item">
                            <ArrowRight size={12} className="lab-text-orange" />
                            <span>{lab.title}</span>
                          </div>
                        ))}
                        {(course.modules?.reduce((acc, m) => acc + (m.labs?.length || 0), 0) > 3) && (
                          <div className="lab-preview-more">
                            +{course.modules.reduce((acc, m) => acc + (m.labs?.length || 0), 0) - 3} more labs
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lab-card-footer">
                      <div className="lab-meta">
                        <FlaskConical size={14} />
                        <span>{course.modules?.reduce((acc, m) => acc + (m.labs?.length || 0), 0)} Labs</span>
                      </div>
                      <div className={`lab-explore-action ${
                        course.published === false 
                          ? 'action-expired' 
                          : course.is_enrolled 
                            ? 'action-enrolled' 
                            : 'action-explore'
                      }`}>
                        {course.published === false 
                          ? (course.is_enrolled ? 'KHÓA HỌC ĐÃ HẾT HẠN' : 'KHÓA HỌC CHƯA MỞ') 
                          : course.is_enrolled 
                            ? 'VÀO HỌC' 
                            : 'ĐĂNG KÝ NGAY'} <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {filteredCourses.length === 0 && (
              <div className="lab-no-results">
                <Search size={48} />
                <h3>No courses found</h3>
                <p>Try adjusting your search criteria.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Labs;
