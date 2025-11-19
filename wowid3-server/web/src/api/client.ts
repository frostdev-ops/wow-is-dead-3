import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from './types';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add token to requests if authenticated
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Remove Content-Type header for FormData to let axios set it automatically with boundary
    if (config.data instanceof FormData && config.headers && 'Content-Type' in config.headers) {
      delete (config.headers as any)['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }

    // Extract error message from response
    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    // Attach formatted error message
    const enhancedError = new Error(errorMessage) as AxiosError<ApiError>;
    enhancedError.response = error.response;
    enhancedError.request = error.request;
    enhancedError.config = error.config;

    return Promise.reject(enhancedError);
  }
);

// Export the configured axios instance
export default api;

// Export helper function for creating multipart form data
export function createFormData(files: File[]): FormData {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file, file.webkitRelativePath || file.name);
  });
  return formData;
}
