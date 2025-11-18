import { useState } from 'react';
import api from '../api/client';

export interface Release {
  version: string;
  minecraft_version: string;
  created_at: string;
  file_count: number;
  size_bytes: number;
}

export interface BlacklistResponse {
  patterns: string[];
}

export interface UploadResponse {
  upload_id: string;
  file_name: string;
  file_size: number;
  sha256: string;
  message: string;
}

export const useAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/admin/login', { password });
      return response.data.token;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file, file.webkitRelativePath || file.name);
      });

      const response = await api.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createRelease = async (
    uploadId: string,
    version: string,
    minecraftVersion: string,
    fabricLoader: string,
    changelog: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/admin/releases', {
        upload_id: uploadId,
        version,
        minecraft_version: minecraftVersion,
        fabric_loader: fabricLoader,
        changelog,
      });
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Release creation failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listReleases = async (): Promise<Release[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/releases');
      return response.data.releases;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to list releases';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteRelease = async (version: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.delete(`/admin/releases/${version}`);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to delete release';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getBlacklist = async (): Promise<string[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/blacklist');
      return response.data.patterns;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to get blacklist';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateBlacklist = async (patterns: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put('/admin/blacklist', { patterns });
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update blacklist';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const copyReleaseToDraft = async (version: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/admin/releases/${version}/copy-to-draft`);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to copy release to draft';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    login,
    uploadFiles,
    createRelease,
    listReleases,
    deleteRelease,
    copyReleaseToDraft,
    getBlacklist,
    updateBlacklist,
  };
};
