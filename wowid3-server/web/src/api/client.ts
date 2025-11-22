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

// ========== Launcher Version API Functions ==========

import type {
  LauncherVersion,
  LauncherVersionsIndex,
  UploadLauncherVersionRequest,
  UploadLauncherVersionResponse,
  MessageResponse,
} from './types';

/**
 * Fetch all launcher versions
 */
export async function getLauncherVersions(): Promise<LauncherVersionsIndex> {
  const response = await api.get<LauncherVersionsIndex>('/launcher/versions');
  return response.data;
}

/**
 * Fetch specific launcher version
 */
export async function getLauncherVersion(version: string): Promise<LauncherVersion> {
  const response = await api.get<LauncherVersion>(`/launcher/${version}`);
  return response.data;
}

/**
 * Upload launcher version file (multi-platform)
 */
export async function uploadLauncherVersionFile(
  data: UploadLauncherVersionRequest
): Promise<UploadLauncherVersionResponse> {
  const formData = new FormData();
  formData.append('version', data.version);
  formData.append('changelog', data.changelog);
  formData.append('mandatory', data.mandatory.toString());
  formData.append('platform', data.platform);
  formData.append('file', data.file);

  const response = await api.post<UploadLauncherVersionResponse>(
    '/admin/launcher/version',
    formData
  );
  return response.data;
}

/**
 * Delete launcher version
 */
export async function deleteLauncherVersion(version: string): Promise<MessageResponse> {
  const response = await api.delete<MessageResponse>(`/admin/launcher/${version}`);
  return response.data;
}
