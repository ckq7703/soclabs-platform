import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  Circle,
  Power,
  Clock
} from 'lucide-react';
import api from '../../services/labApi';
import './Workspace.css';

const Workspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeVM, setActiveVM] = useState(null);
  const [flag, setFlag] = useState('');
  const [tasks, setTasks] = useState([]);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [guacError, setGuacError] = useState({});
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const sessionNotFoundRef = React.useRef(false);

  // Auto-focus logic for Guacamole
  useEffect(() => {
    const focusActiveVM = () => {
      if (activeVM) {
        const iframe = document.getElementById(`lab-guac-iframe-${activeVM.id}`);
        if (iframe) {
          iframe.focus();
          try {
            iframe.contentWindow?.focus();
          } catch (e) {
            // Cross-origin might block this
          }
        }
      }
    };

    focusActiveVM();
    window.addEventListener('focus', focusActiveVM);
    
    const handleGlobalKeyDown = (e) => {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (activeVM) {
        const iframe = document.getElementById(`lab-guac-iframe-${activeVM.id}`);
        if (iframe && document.activeElement !== iframe) {
          iframe.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('focus', focusActiveVM);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [activeVM]);

  const fetchTasks = useCallback(async (labId) => {
    try {
      const response = await api.get(`/labs/api/tasks/?lab_id=${labId}`);
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
  }, []);

  const fetchWorkspace = useCallback(async () => {
    try {
      const response = await api.get(`/sessions/${id}/workspace/`);
      const sessionData = response.data;
      setSession(sessionData);

      if (sessionData.expires_at) {
        const expiryDate = new Date(sessionData.expires_at).getTime();
        const now = new Date().getTime();
        const diffInSeconds = Math.floor((expiryDate - now) / 1000);
        setTimeLeft(diffInSeconds > 0 ? diffInSeconds : 0);
      }

      if (sessionData.vms?.length > 0 && !activeVM) {
        setActiveVM(sessionData.vms[0]);
      }
      
      if (sessionData.lab_id) {
        fetchTasks(sessionData.lab_id);
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        // Session đã bị xóa hoặc hết hạn → dừng poll và redirect
        sessionNotFoundRef.current = true;
        setSessionNotFound(true);
        setLoading(false);
        setTimeout(() => navigate('/labs'), 3000);
        return;
      }
      console.error('Failed to fetch workspace', error);
    } finally {
      setLoading(false);
    }
  }, [id, activeVM, fetchTasks, navigate]);

  useEffect(() => {
    fetchWorkspace();
    const interval = setInterval(() => {
      if (!sessionNotFoundRef.current) fetchWorkspace();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchWorkspace]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTaskSubmit = async (taskId, answerOverride) => {
    const submissionValue = answerOverride || flag;
    if (!submissionValue.trim() && !answerOverride) return;
    
    try {
      const response = await api.post(`/labs/api/tasks/${taskId}/submit/`, { 
        submitted_answer: submissionValue 
      });
      
      if (response.data.is_correct === false) {
        alert(response.data.error || 'SAI FLAG');
        return;
      }

      if (session?.lab_id) fetchTasks(session.lab_id);
      setFlag('');
    } catch (error) {
      console.error('Submission failed', error);
      alert('Có lỗi xảy ra khi nộp bài.');
    }
  };

  const handleTerminate = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc bài Lab này?')) {
      return;
    }

    try {
      await api.delete(`/sessions/${id}/`);
      navigate('/labs');
    } catch (error) {
      console.error('Failed to terminate session', error);
      alert('Có lỗi xảy ra khi kết thúc bài Lab.');
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (sessionNotFound) return (
    <div className="lab-workspace-loading">
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
      <span style={{ color: '#f87171', fontWeight: 600 }}>Phiên Lab không tồn tại hoặc đã kết thúc.</span>
      <span style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.875rem' }}>Đang chuyển hướng về trang Labs...</span>
    </div>
  );

  if (loading) return (
    <div className="lab-workspace-loading">
      <div className="lab-loader"></div>
      <span>Đang tải môi trường...</span>
    </div>
  );

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="lab-workspace-root">
      <aside className="lab-tasks-sidebar">
        <div className="lab-tasks-header">
          <span className="lab-sidebar-tag">WORKSPACE</span>
          <h2 className="lab-sidebar-title">{session?.lab_title}</h2>
        </div>

        <div className="lab-tasks-container">
          <div className="lab-tasks-section-header">
            <span>LAB TASKS</span>
            <span className="lab-tasks-progress-count">{completedCount}/{tasks.length}</span>
          </div>

          <div className="lab-tasks-scroll">
            {tasks.map((task, index) => (
              <div 
                key={task.id} 
                className={`lab-task-entry ${index === activeTaskIndex ? 'lab-expanded' : ''} ${task.is_completed ? 'lab-is-done' : ''}`}
                onClick={() => setActiveTaskIndex(index)}
              >
                <div className="lab-task-top">
                  <div className="lab-task-icon">
                    {task.is_completed ? <CheckCircle2 size={16} className="lab-text-green" /> : <Circle size={16} />}
                  </div>
                  <div className="lab-task-title">
                    <span className="lab-task-num">{index + 1}. </span>
                    {task.title}
                  </div>
                </div>
                
                {index === activeTaskIndex && !task.is_completed && (
                  <div className="lab-task-expansion">
                    <div 
                      className="lab-task-instruction"
                      dangerouslySetInnerHTML={{ __html: task.description || '' }}
                    />
                    
                    <div className="lab-task-action">
                      {task.task_type === 'TEXT_INPUT' && (
                        <div className="lab-task-input-group">
                          <input 
                            type="text" 
                            placeholder="Nhập flag..." 
                            value={flag}
                            onChange={(e) => setFlag(e.target.value)}
                          />
                          <button className="lab-submit-btn" onClick={() => handleTaskSubmit(task.id)}>
                            Nộp bài
                          </button>
                        </div>
                      )}

                      {task.task_type === 'CHECKBOX' && (
                        <button className="lab-complete-btn" onClick={() => handleTaskSubmit(task.id, 'done')}>
                          <CheckCircle2 size={16} /> Đánh dấu hoàn thành
                        </button>
                      )}

                      {task.task_type === 'MCQ' && (
                        <div className="lab-mcq-group">
                          <div className="lab-mcq-options">
                            {task.options?.map((option, optIdx) => (
                              <label key={optIdx} className={`lab-mcq-option ${flag === option ? 'lab-selected' : ''}`}>
                                <input 
                                  type="radio" 
                                  name={`task-${task.id}`} 
                                  value={option}
                                  checked={flag === option}
                                  onChange={(e) => setFlag(e.target.value)}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                          <button className="lab-submit-btn" onClick={() => handleTaskSubmit(task.id)}>
                            Xác nhận đáp án
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lab-tasks-footer">
          <div className="lab-footer-info">
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="lab-footer-progress-bar">
            <div className="lab-progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </aside>

      <div className="lab-workspace-main">
        <header className="lab-workspace-header">
          <div className="lab-header-left">
            <div className="lab-identity">
              <span className="lab-header-tag">MISSION</span>
              <h1 className="lab-header-title">{session?.lab_title}</h1>
            </div>
            <div className="lab-header-divider"></div>
            <div className="lab-header-timer">
              <Clock size={14} />
              <span className="lab-mono">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="lab-header-center">
            <div className="lab-vm-selector">
              <span className="lab-selector-hint">NODE:</span>
              <div className="lab-selector-rel">
                <div 
                  className={`lab-selector-box ${isDropdownOpen ? 'lab-open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className="lab-vm-display">
                    <span className="lab-vm-name">{activeVM?.display_name || 'lab-node'}</span>
                    <span className="lab-vm-ip">{activeVM?.ip_address || '10.10.10.x'}</span>
                  </div>
                  <ChevronRight size={14} className={`lab-arrow ${isDropdownOpen ? 'lab-rotate-90' : ''}`} />
                </div>

                {isDropdownOpen && (
                  <div className="lab-vm-dropdown">
                    {session?.vms?.map((vm) => (
                      <div 
                        key={vm.id} 
                        className={`lab-vm-item ${activeVM?.id === vm.id ? 'lab-active' : ''}`}
                        onClick={() => {
                          setActiveVM(vm);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className={`lab-vm-dot ${vm.status === 'running' ? 'lab-online' : ''}`}></div>
                        <div className="lab-vm-item-info">
                          <span className="lab-vm-item-name">{vm.display_name}</span>
                          <span className="lab-vm-item-ip">{vm.ip_address}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lab-header-right">
            <button className="lab-terminate-btn" onClick={handleTerminate}>
              <Power size={14} />
              <span>TERMINATE</span>
            </button>
          </div>
        </header>

        <div 
          className="lab-workspace-viewport"
          onClick={() => {
            const activeIframe = document.getElementById(`lab-guac-iframe-${activeVM?.id}`);
            if (activeIframe) activeIframe.focus();
          }}
        >
          {session?.vms?.map((vm) => (
            <div
              key={vm.id}
              className="lab-vm-wrapper"
              style={{ display: activeVM?.id === vm.id ? 'block' : 'none' }}
            >
              {guacError[vm.id] ? (
                <div className="lab-guac-error">
                  <div className="lab-guac-error-icon">⚠</div>
                  <h3>Không thể kết nối Lab Environment</h3>
                  <p>Lỗi xác thực hoặc kết nối. Vui lòng thử refresh lại trang hoặc liên hệ quản trị viên.</p>
                  <button
                    className="lab-guac-retry-btn"
                    onClick={() => {
                      setGuacError((prev) => ({ ...prev, [vm.id]: false }));
                      // Force reload the iframe by toggling src
                      const iframe = document.getElementById(`lab-guac-iframe-${vm.id}`);
                      if (iframe) {
                        iframe.src = `/guacamole/#/client/${vm.guac_client_id}`;
                      }
                    }}
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <iframe
                  id={`lab-guac-iframe-${vm.id}`}
                  src={`/guacamole/#/client/${vm.guac_client_id}`}
                  className="lab-guac-iframe"
                  title={`Console-${vm.display_name}`}
                  allow="clipboard-read; clipboard-write"
                  onError={() => setGuacError((prev) => ({ ...prev, [vm.id]: true }))}
                />
              )}
            </div>
          ))}

          {!activeVM && (
            <div className="lab-console-placeholder">
              <div className="lab-spinner"></div>
              <p>Vui lòng chọn một máy ảo để bắt đầu...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Workspace;
