import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        const from = location.state?.from?.pathname || '/labs';
        navigate(from, { replace: true });
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.');
      }
    } catch (err) {
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lab-login-root">
      {/* Left: Login Form */}
      <div className="lab-login-form-panel">
        <div className="lab-login-form-inner">
          {/* Logo */}
          <div className="lab-login-brand">
            <img src={logo} alt="Platform Logo" className="lab-login-logo-img" />
          </div>

          {/* Heading */}
          <div className="lab-login-heading">
            <h1>Đăng nhập Hands-on Labs</h1>
            <p>Nhập thông tin tài khoản để truy cập môi trường thực hành.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="lab-login-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="lab-login-form" onSubmit={handleSubmit}>
            <div className="lab-form-group">
              <label htmlFor="lab-username">Tên đăng nhập</label>
              <div className="lab-input-wrapper">
                <User size={17} className="lab-input-icon" />
                <input
                  id="lab-username"
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="lab-form-group">
              <label htmlFor="lab-password">Mật khẩu</label>
              <div className="lab-input-wrapper">
                <Lock size={17} className="lab-input-icon" />
                <input
                  id="lab-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="lab-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="lab-login-btn"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <span className="lab-btn-spinner" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          <p className="lab-login-note">
            Chỉ tài khoản được cấp phép mới có thể truy cập hệ thống này.
          </p>
        </div>
      </div>

      {/* Right: World Map Visual */}
      <div className="lab-login-visual-panel">
        <div className="lab-login-visual-overlay" />
        <div
          className="lab-login-visual-bg"
          style={{ backgroundImage: 'url(/bg-world.jpg)' }}
        />
        <div className="lab-login-visual-content">
          <div className="lab-visual-badge">CYBER RANGE</div>
          <h2>Nền tảng thực hành<br />An ninh mạng</h2>
          <p>
            Trải nghiệm môi trường lab thực tế với các bài tập bảo mật
            được thiết kế bởi chuyên gia.
          </p>
          <div className="lab-visual-stats">
            <div className="lab-stat">
              <span className="lab-stat-num">50+</span>
              <span className="lab-stat-label">Bài Lab</span>
            </div>
            <div className="lab-stat-divider" />
            <div className="lab-stat">
              <span className="lab-stat-num">10+</span>
              <span className="lab-stat-label">Khóa học</span>
            </div>
            <div className="lab-stat-divider" />
            <div className="lab-stat">
              <span className="lab-stat-num">24/7</span>
              <span className="lab-stat-label">Truy cập</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
