// React Query mutation hook for file uploads with progress

import { useMutation } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { uploadFiles } from '../../api/uploads';
import type { UploadResponse } from '../../api/types';

interface UploadMutationVariables {
  files: File[];
}

/**
 * Mutation hook for uploading files with progress tracking
 * Returns both the mutation and progress state
 */
export function useUploadMutation() {
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const mutation = useMutation<UploadResponse, Error, UploadMutationVariables>({
    mutationFn: async ({ files }) => {
      setUploadProgress(0);
      return uploadFiles(files, (progress) => {
        setUploadProgress(progress);
      });
    },
    onSuccess: () => {
      setUploadProgress(100);
    },
    onError: () => {
      setUploadProgress(0);
    },
  });

  const resetProgress = useCallback(() => {
    setUploadProgress(0);
  }, []);

  return {
    ...mutation,
    uploadProgress,
    resetProgress,
  };
}
