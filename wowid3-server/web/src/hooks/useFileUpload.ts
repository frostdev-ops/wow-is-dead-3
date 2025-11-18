import { useState, useCallback } from 'react';
import { useAdmin } from './useAdmin';
import type { UploadProgress, FileUploadResult } from '../types/upload';

export function useFileUpload() {
  const { uploadFiles: uploadFilesAPI, loading: apiLoading } = useAdmin();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<FileUploadResult[]>([]);

  const uploadFiles = useCallback(async (files: File[]): Promise<FileUploadResult[] | null> => {
    if (files.length === 0) return null;

    setUploading(true);
    setError(null);

    // Initialize progress for all files
    const initialProgress: UploadProgress[] = files.map((file) => ({
      fileName: file.name,
      fileSize: file.size,
      uploadedBytes: 0,
      progress: 0,
      status: 'pending',
    }));
    setUploadProgress(initialProgress);

    try {
      const results = await uploadFilesAPI(files);

      // Mark all as completed
      setUploadProgress(prev =>
        prev.map(p => ({ ...p, progress: 100, status: 'completed' as const }))
      );

      setUploadResults(results);
      return results;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Upload failed';
      setError(errorMessage);

      // Mark all as error
      setUploadProgress(prev =>
        prev.map(p => ({ ...p, status: 'error' as const, error: errorMessage }))
      );

      return null;
    } finally {
      setUploading(false);
    }
  }, [uploadFilesAPI]);

  const clearProgress = useCallback(() => {
    setUploadProgress([]);
    setUploadResults([]);
    setError(null);
  }, []);

  const getTotalProgress = useCallback(() => {
    if (uploadProgress.length === 0) return 0;
    const total = uploadProgress.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(total / uploadProgress.length);
  }, [uploadProgress]);

  return {
    uploadFiles,
    uploadProgress,
    uploading,
    error,
    uploadResults,
    clearProgress,
    getTotalProgress,
    loading: uploading || apiLoading,
  };
}
