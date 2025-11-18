// React Query mutation hooks for draft operations

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import {
  createDraft,
  updateDraft,
  deleteDraft,
  analyzeDraft,
  generateChangelog,
  addFilesToDraft,
  removeFileFromDraft,
  updateFileInDraft,
  publishDraft,
  duplicateDraft,
} from '../../api/drafts';
import type {
  DraftRelease,
  CreateDraftRequest,
  UpdateDraftRequest,
  AddFilesRequest,
  UpdateFileRequest,
  VersionSuggestions,
  GeneratedChangelog,
  MessageResponse,
} from '../../api/types';

/**
 * Mutation hook to create a new draft
 */
export function useCreateDraftMutation(): UseMutationResult<
  DraftRelease,
  Error,
  CreateDraftRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateDraftRequest) => createDraft(request),
    onSuccess: () => {
      // Invalidate drafts list to refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}

/**
 * Mutation hook to update draft metadata
 */
export function useUpdateDraftMutation(): UseMutationResult<
  DraftRelease,
  Error,
  { id: string; request: UpdateDraftRequest }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }) => updateDraft(id, request),
    // Optimistic update
    onMutate: async ({ id, request }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.drafts.detail(id) });

      // Snapshot previous value
      const previousDraft = queryClient.getQueryData<DraftRelease>(
        queryKeys.drafts.detail(id)
      );

      // Optimistically update
      if (previousDraft) {
        queryClient.setQueryData<DraftRelease>(queryKeys.drafts.detail(id), {
          ...previousDraft,
          ...request,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousDraft };
    },
    // Rollback on error
    onError: (_err, { id }, context) => {
      if (context?.previousDraft) {
        queryClient.setQueryData(queryKeys.drafts.detail(id), context.previousDraft);
      }
    },
    // Refetch on success or error
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}

/**
 * Mutation hook to delete a draft
 */
export function useDeleteDraftMutation(): UseMutationResult<
  MessageResponse,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    // Optimistic update
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.drafts.list() });

      // Snapshot previous value
      const previousDrafts = queryClient.getQueryData<DraftRelease[]>(
        queryKeys.drafts.list()
      );

      // Optimistically remove from list
      if (previousDrafts) {
        queryClient.setQueryData<DraftRelease[]>(
          queryKeys.drafts.list(),
          previousDrafts.filter((d) => d.id !== id)
        );
      }

      return { previousDrafts };
    },
    // Rollback on error
    onError: (_err, _id, context) => {
      if (context?.previousDrafts) {
        queryClient.setQueryData(queryKeys.drafts.list(), context.previousDrafts);
      }
    },
    // Refetch on success
    onSuccess: (_data, id) => {
      // Remove specific draft from cache
      queryClient.removeQueries({ queryKey: queryKeys.drafts.detail(id) });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}

/**
 * Mutation hook to analyze draft and get version suggestions
 */
export function useAnalyzeDraftMutation(): UseMutationResult<
  VersionSuggestions,
  Error,
  string
> {
  return useMutation({
    mutationFn: (id: string) => analyzeDraft(id),
  });
}

/**
 * Mutation hook to generate changelog
 */
export function useGenerateChangelogMutation(): UseMutationResult<
  GeneratedChangelog,
  Error,
  string
> {
  return useMutation({
    mutationFn: (id: string) => generateChangelog(id),
  });
}

/**
 * Mutation hook to add files to draft
 */
export function useAddFilesMutation(): UseMutationResult<
  DraftRelease,
  Error,
  { id: string; request: AddFilesRequest }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }) => addFilesToDraft(id, request),
    onSuccess: (data, { id }) => {
      // Update draft cache with new data
      queryClient.setQueryData(queryKeys.drafts.detail(id), data);
      // Invalidate list to show updated file count
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}

/**
 * Mutation hook to remove file from draft
 */
export function useRemoveFileMutation(): UseMutationResult<
  DraftRelease,
  Error,
  { id: string; filePath: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, filePath }) => removeFileFromDraft(id, filePath),
    // Optimistic update
    onMutate: async ({ id, filePath }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.drafts.detail(id) });

      const previousDraft = queryClient.getQueryData<DraftRelease>(
        queryKeys.drafts.detail(id)
      );

      if (previousDraft) {
        queryClient.setQueryData<DraftRelease>(queryKeys.drafts.detail(id), {
          ...previousDraft,
          files: previousDraft.files.filter((f) => f.path !== filePath),
        });
      }

      return { previousDraft };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousDraft) {
        queryClient.setQueryData(queryKeys.drafts.detail(id), context.previousDraft);
      }
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(queryKeys.drafts.detail(id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}

/**
 * Mutation hook to update file in draft
 */
export function useUpdateFileMutation(): UseMutationResult<
  DraftRelease,
  Error,
  { id: string; filePath: string; request: UpdateFileRequest }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, filePath, request }) => updateFileInDraft(id, filePath, request),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(queryKeys.drafts.detail(id), data);
    },
  });
}

/**
 * Mutation hook to publish draft as release
 */
export function usePublishDraftMutation(): UseMutationResult<
  MessageResponse,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => publishDraft(id),
    onSuccess: (_data, id) => {
      // Remove draft from cache
      queryClient.removeQueries({ queryKey: queryKeys.drafts.detail(id) });
      // Invalidate both drafts and releases lists
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.list() });
    },
  });
}

/**
 * Mutation hook to duplicate a draft
 */
export function useDuplicateDraftMutation(): UseMutationResult<
  DraftRelease,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => duplicateDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}
