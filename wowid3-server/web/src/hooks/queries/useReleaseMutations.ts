// React Query mutation hooks for release operations

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import {
  createRelease,
  deleteRelease,
  copyReleaseToDraft,
  updateBlacklist,
} from '../../api/releases';
import type {
  Release,
  CreateReleaseRequest,
  CopyReleaseToDraftResponse,
  MessageResponse,
} from '../../api/types';

/**
 * Mutation hook to create a new release
 */
export function useCreateReleaseMutation(): UseMutationResult<
  MessageResponse,
  Error,
  CreateReleaseRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateReleaseRequest) => createRelease(request),
    onSuccess: () => {
      // Invalidate releases list
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.list() });
    },
  });
}

/**
 * Mutation hook to delete a release
 */
export function useDeleteReleaseMutation(): UseMutationResult<
  MessageResponse,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: string) => deleteRelease(version),
    // Optimistic update
    onMutate: async (version) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.releases.list() });

      const previousReleases = queryClient.getQueryData<Release[]>(
        queryKeys.releases.list()
      );

      if (previousReleases) {
        queryClient.setQueryData<Release[]>(
          queryKeys.releases.list(),
          previousReleases.filter((r) => r.version !== version)
        );
      }

      return { previousReleases };
    },
    onError: (_err, _version, context) => {
      if (context?.previousReleases) {
        queryClient.setQueryData(queryKeys.releases.list(), context.previousReleases);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releases.list() });
    },
  });
}

/**
 * Mutation hook to copy a release to draft
 */
export function useCopyReleaseToDraftMutation(): UseMutationResult<
  CopyReleaseToDraftResponse,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: string) => copyReleaseToDraft(version),
    onSuccess: () => {
      // Invalidate drafts list to show new draft
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.list() });
    },
  });
}

/**
 * Mutation hook to update blacklist patterns
 */
export function useUpdateBlacklistMutation(): UseMutationResult<
  MessageResponse,
  Error,
  string[]
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patterns: string[]) => updateBlacklist(patterns),
    // Optimistic update
    onMutate: async (patterns) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.blacklist.list() });

      const previousPatterns = queryClient.getQueryData<string[]>(
        queryKeys.blacklist.list()
      );

      queryClient.setQueryData<string[]>(queryKeys.blacklist.list(), patterns);

      return { previousPatterns };
    },
    onError: (_err, _patterns, context) => {
      if (context?.previousPatterns) {
        queryClient.setQueryData(queryKeys.blacklist.list(), context.previousPatterns);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blacklist.list() });
    },
  });
}
