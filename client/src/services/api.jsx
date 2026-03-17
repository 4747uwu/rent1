// filepath: src/services/api.js
import axios from 'axios';
import sessionManager from './sessionManager';

// ✅ Use environment variable with correct port
const API_URL = '/api'; 
// const API_URL = 'http://localhost:5000/api';

console.log('🔍 API Service URL:', API_URL);

// Create an axios instance with defaults
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // ✅ ADD: Properly serialize array parameters
  paramsSerializer: {
    serialize: (params) => {
      const parts = [];
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (Array.isArray(value) && value.length > 0) {
          // Send arrays as repeated parameters: radiologists=id1&radiologists=id2
          value.forEach(v => {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
          });
        } else if (value !== undefined && value !== null && value !== '') {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
      });
      return parts.join('&');
    }
  }
});

// ✅ Add request interceptor to include token from sessionManager
api.interceptors.request.use(
  async (config) => {
    // Try to refresh token if needed
    await sessionManager.refreshTokenIfNeeded();
    
    // Get token from sessionManager
    const token = sessionManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log('📤 API Request:', {
      method: config.method,
      url: config.url,
      params: config.params,
      serializedParams: config.paramsSerializer.serialize(config.params || {})
    });
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ Updated response interceptor to use sessionManager
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors (session expired)
    if (error.response && error.response.status === 401) {
      sessionManager.clearSession();
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;