import { useCallback } from 'react';
import { useDrafts } from './useDrafts';
import type { DraftRelease, CreateDraftRequest, UpdateDraftRequest } from '../types/releases';

/**
 * High-level hook for draft operations
 * Wraps useDrafts with additional business logic and error handling
 */
export function useDraftOperations() {
  const {
    drafts,
    currentDraft,
    loading,
    error,
    listDrafts,
    createDraft,
    getDraft,
    updateDraft,
    deleteDraft,
    publishDraft,
    duplicateDraft,
  } = useDrafts();

  const handleCreateDraft = useCallback(async (request?: CreateDraftRequest): Promise<DraftRelease | null> => {
    const draft = await createDraft(request || {});
    if (draft) {
      await listDrafts(); // Refresh the list
    }
    return draft;
  }, [createDraft, listDrafts]);

  const handleUpdateDraft = useCallback(async (
    id: string,
    updates: UpdateDraftRequest
  ): Promise<DraftRelease | null> => {
    return await updateDraft(id, updates);
  }, [updateDraft]);

  const handleDeleteDraft = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteDraft(id);
    if (success) {
      await listDrafts(); // Refresh the list
    }
    return success;
  }, [deleteDraft, listDrafts]);

  const handleDuplicateDraft = useCallback(async (id: string): Promise<DraftRelease | null> => {
    const newDraft = await duplicateDraft(id);
    if (newDraft) {
      await listDrafts(); // Refresh the list
    }
    return newDraft;
  }, [duplicateDraft, listDrafts]);

  const handlePublishDraft = useCallback(async (id: string): Promise<boolean> => {
    const success = await publishDraft(id);
    if (success) {
      await listDrafts(); // Refresh the list
    }
    return success;
  }, [publishDraft, listDrafts]);

  const handleEditDraft = useCallback(async (id: string): Promise<DraftRelease | null> => {
    return await getDraft(id);
  }, [getDraft]);

  return {
    drafts,
    currentDraft,
    loading,
    error,
    listDrafts,
    createDraft: handleCreateDraft,
    editDraft: handleEditDraft,
    updateDraft: handleUpdateDraft,
    deleteDraft: handleDeleteDraft,
    duplicateDraft: handleDuplicateDraft,
    publishDraft: handlePublishDraft,
  };
}
