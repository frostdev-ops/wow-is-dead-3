// Typed API endpoints for file upload operations

import api, { createFormData } from './client';
import type { UploadResponse } from './types';

/**
 * Upload files to the server with progress tracking
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  const formData = createFormData(files);

  const response = await api.post<UploadResponse>('/admin/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });

  return response.data;
}
