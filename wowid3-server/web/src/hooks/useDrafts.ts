import { useState, useCallback } from 'react';
import axios from 'axios';
import type {
  DraftRelease,
  CreateDraftRequest,
  UpdateDraftRequest,
  AddFilesRequest,
  UpdateFileRequest,
  VersionSuggestions,
  GeneratedChangelog,
} from '../types/releases';

const API_BASE = '/api/admin';

// Get auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function useDrafts() {
  const [drafts, setDrafts] = useState<DraftRelease[]>([]);
  const [currentDraft, setCurrentDraft] = useState<DraftRelease | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<DraftRelease[]>(`${API_BASE}/drafts`, {
        headers: getAuthHeaders(),
      });
      setDrafts(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to list drafts');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDraft = useCallback(async (request: CreateDraftRequest = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<DraftRelease>(`${API_BASE}/drafts`, request, {
        headers: getAuthHeaders(),
      });
      setCurrentDraft(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create draft');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<DraftRelease>(`${API_BASE}/drafts/${id}`, {
        headers: getAuthHeaders(),
      });
      setCurrentDraft(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to get draft');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDraft = useCallback(async (id: string, request: UpdateDraftRequest) => {
    setError(null);
    try {
      const response = await axios.put<DraftRelease>(`${API_BASE}/drafts/${id}`, request, {
        headers: getAuthHeaders(),
      });
      setCurrentDraft(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update draft');
      return null;
    }
  }, []);

  const deleteDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/drafts/${id}`, {
        headers: getAuthHeaders(),
      });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (currentDraft?.id === id) {
        setCurrentDraft(null);
      }
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete draft');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentDraft]);

  const analyzeDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<VersionSuggestions>(
        `${API_BASE}/drafts/${id}/analyze`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze draft');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addFiles = useCallback(async (id: string, request: AddFilesRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<DraftRelease>(
        `${API_BASE}/drafts/${id}/files`,
        request,
        {
          headers: getAuthHeaders(),
        }
      );
      setCurrentDraft(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add files');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFile = useCallback(async (id: string, filePath: string) => {
    setError(null);
    try {
      const response = await axios.delete<DraftRelease>(
        `${API_BASE}/drafts/${id}/files/${filePath}`,
        {
          headers: getAuthHeaders(),
        }
      );
      setCurrentDraft(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove file');
      return null;
    }
  }, []);

  const updateFile = useCallback(async (id: string, filePath: string, request: UpdateFileRequest) => {
    setError(null);
    try {
      const response = await axios.put<DraftRelease>(
        `${API_BASE}/drafts/${id}/files/${filePath}`,
        request,
        {
          headers: getAuthHeaders(),
        }
      );
      setCurrentDraft(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update file');
      return null;
    }
  }, []);

  const generateChangelog = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<GeneratedChangelog>(
        `${API_BASE}/drafts/${id}/generate-changelog`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate changelog');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const publishDraft = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `${API_BASE}/drafts/${id}/publish`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setCurrentDraft(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to publish draft');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    drafts,
    currentDraft,
    loading,
    error,
    listDrafts,
    createDraft,
    getDraft,
    updateDraft,
    deleteDraft,
    analyzeDraft,
    addFiles,
    removeFile,
    updateFile,
    generateChangelog,
    publishDraft,
  };
}
