import axios from 'axios';

const API_BASE_URL = '';
const API_KEY = import.meta.env.VITE_API_KEY || 'default_key';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
  },
});

export const createJob = async (target, scanType, options = {}) => {
  const response = await api.post('/api/v1/jobs/create', {
    target,
    scan_type: scanType,
    options,
  });
  return response.data;
};

export const getJobStatus = async (jobId) => {
  const response = await api.get(`/api/v1/jobs/${jobId}/status`);
  return response.data;
};

export const getJobResults = async (jobId) => {
  const response = await api.get(`/api/v1/jobs/${jobId}/results`);
  return response.data;
};

export const listJobs = async (params = {}) => {
  const response = await api.get('/api/v1/jobs', { params });
  return response.data;
};

export const cancelJob = async (jobId) => {
  const response = await api.delete(`/api/v1/jobs/${jobId}`);
  return response.data;
};

// Email Security Analyzer APIs
export const scanEmail = async (formData) => {
  const response = await api.post('/api/v1/email/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getEmailJobStatus = async (jobId) => {
  const response = await api.get(`/api/v1/email/jobs/${jobId}/status`);
  return response.data;
};

export const getEmailJobResults = async (jobId) => {
  const response = await api.get(`/api/v1/email/jobs/${jobId}/results`);
  return response.data;
};

// SSL Analyzer APIs
export const scanSSL = async (host) => {
  const response = await api.post('/api/v1/ssl/scan', { host });
  return response.data;
};

export const getSSLJobStatus = async (jobId) => {
  const response = await api.get(`/api/v1/ssl/jobs/${jobId}/status`);
  return response.data;
};

export const getSSLJobResults = async (jobId) => {
  const response = await api.get(`/api/v1/ssl/jobs/${jobId}/results`);
  return response.data;
};

// IP Reputation APIs
export const scanIP = async (ip) => {
  const response = await api.post('/api/v1/ip/scan', { ip });
  return response.data;
};

export const getIPJobStatus = async (jobId) => {
  const response = await api.get(`/api/v1/ip/jobs/${jobId}/status`);
  return response.data;
};

export const getIPJobResults = async (jobId) => {
  const response = await api.get(`/api/v1/ip/jobs/${jobId}/results`);
  return response.data;
};

// Domain Reputation APIs
export const scanDomain = async (host) => {
  const response = await api.post('/api/v1/domain/scan', { host });
  return response.data;
};

export const getDomainJobStatus = async (jobId) => {
  const response = await api.get(`/api/v1/domain/jobs/${jobId}/status`);
  return response.data;
};

export const getDomainJobResults = async (jobId) => {
  const response = await api.get(`/api/v1/domain/jobs/${jobId}/results`);
  return response.data;
};

// CVE Radar APIs
export const getCVETrending = async (page = 1, limit = 10) => {
  const response = await api.get('/api/v1/cve/trending', { params: { page, limit } });
  return response.data;
};

export const searchCVE = async (query, page = 1, limit = 10) => {
  const response = await api.get('/api/v1/cve/search', { params: { query, page, limit } });
  return response.data;
};

export const getCVEDetail = async (cveId) => {
  const response = await api.get(`/api/v1/cve/${cveId}`);
  return response.data;
};

// VirusTotal Malware Scanning APIs
export const scanVT = async (resourceType, resourceValue) => {
  const response = await api.post('/api/v1/vt/scan', { resource_type: resourceType, resource_value: resourceValue });
  return response.data;
};

export const uploadVTFile = async (formData) => {
  const response = await api.post('/api/v1/vt/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getVTJobStatus = async (jobId) => {
  const response = await api.get(`/api/v1/vt/jobs/${jobId}/status`);
  return response.data;
};

export const getVTJobResults = async (jobId) => {
  const response = await api.get(`/api/v1/vt/jobs/${jobId}/results`);
  return response.data;
};

export default api;


