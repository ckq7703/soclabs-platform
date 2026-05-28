import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token
api.interceptors.request.use((config) => {
  // Do not add Authorization header for login/auth requests
  if (config.url && (config.url.includes('/auth/login') || config.url.includes('/auth/login/'))) {
    return config;
  }
  const token = localStorage.getItem('lab_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
