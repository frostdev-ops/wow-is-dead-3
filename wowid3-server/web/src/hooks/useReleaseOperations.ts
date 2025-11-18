import { useState, useCallback } from 'react';
import { useAdmin } from './useAdmin';
import type { Release } from '../types/release';

/**
 * High-level hook for release operations
 * Wraps useAdmin with additional business logic and state management
 */
export function useReleaseOperations() {
  const {
    loading,
    error,
    createRelease: createReleaseAPI,
    listReleases: listReleasesAPI,
    deleteRelease: deleteReleaseAPI,
    copyReleaseToDraft: copyReleaseToDraftAPI,
  } = useAdmin();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);

  const listReleases = useCallback(async (): Promise<Release[]> => {
    setLoadingReleases(true);
    try {
      const data = await listReleasesAPI();
      setReleases(data);
      return data;
    } catch (err) {
      console.error('Failed to list releases:', err);
      return [];
    } finally {
      setLoadingReleases(false);
    }
  }, [listReleasesAPI]);

  const createRelease = useCallback(async (
    uploadId: string,
    version: string,
    minecraftVersion: string,
    fabricLoader: string,
    changelog: string
  ): Promise<boolean> => {
    try {
      await createReleaseAPI(uploadId, version, minecraftVersion, fabricLoader, changelog);
      await listReleases(); // Refresh the list
      return true;
    } catch (err) {
      console.error('Failed to create release:', err);
      return false;
    }
  }, [createReleaseAPI, listReleases]);

  const deleteRelease = useCallback(async (version: string): Promise<boolean> => {
    try {
      await deleteReleaseAPI(version);
      await listReleases(); // Refresh the list
      return true;
    } catch (err) {
      console.error('Failed to delete release:', err);
      return false;
    }
  }, [deleteReleaseAPI, listReleases]);

  const copyReleaseToDraft = useCallback(async (version: string): Promise<any> => {
    try {
      const newDraft = await copyReleaseToDraftAPI(version);
      return newDraft;
    } catch (err) {
      console.error('Failed to copy release to draft:', err);
      return null;
    }
  }, [copyReleaseToDraftAPI]);

  return {
    releases,
    loading: loading || loadingReleases,
    error,
    listReleases,
    createRelease,
    deleteRelease,
    copyReleaseToDraft,
  };
}
