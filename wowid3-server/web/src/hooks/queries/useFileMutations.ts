// React Query mutation hooks for file operations

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import {
  writeFile,
  createDirectory,
  renameFile,
  moveFile,
  deleteFile,
} from '../../api/files';
import type {
  WriteFileResponse,
  CreateDirResponse,
  RenameResponse,
  MoveResponse,
  MessageResponse,
} from '../../api/types';

/**
 * Mutation hook to write file contents
 */
export function useWriteFileMutation(): UseMutationResult<
  WriteFileResponse,
  Error,
  { draftId: string; path: string; content: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, path, content }) => writeFile(draftId, path, content),
    onSuccess: (_data, { draftId, path }) => {
      // Invalidate file read cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.files.read(draftId, path),
      });
      // Invalidate draft detail to update file info
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.detail(draftId),
      });
    },
  });
}

/**
 * Mutation hook to create a directory
 */
export function useCreateDirectoryMutation(): UseMutationResult<
  CreateDirResponse,
  Error,
  { draftId: string; path: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, path }) => createDirectory(draftId, path),
    onSuccess: (_data, { draftId }) => {
      // Invalidate all browse queries for this draft
      queryClient.invalidateQueries({
        queryKey: queryKeys.files.all,
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'files' && key[1] === 'browse' && key[2] === draftId;
        },
      });
    },
  });
}

/**
 * Mutation hook to rename a file or directory
 */
export function useRenameFileMutation(): UseMutationResult<
  RenameResponse,
  Error,
  { draftId: string; oldPath: string; newPath: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, oldPath, newPath }) => renameFile(draftId, oldPath, newPath),
    onSuccess: (_data, { draftId }) => {
      // Invalidate all file queries for this draft
      queryClient.invalidateQueries({
        queryKey: queryKeys.files.all,
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'files' && key[2] === draftId;
        },
      });
      // Invalidate draft detail
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.detail(draftId),
      });
    },
  });
}

/**
 * Mutation hook to move a file or directory
 */
export function useMoveFileMutation(): UseMutationResult<
  MoveResponse,
  Error,
  { draftId: string; source: string; destination: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, source, destination }) =>
      moveFile(draftId, source, destination),
    onSuccess: (_data, { draftId }) => {
      // Invalidate all file queries for this draft
      queryClient.invalidateQueries({
        queryKey: queryKeys.files.all,
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'files' && key[2] === draftId;
        },
      });
      // Invalidate draft detail
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.detail(draftId),
      });
    },
  });
}

/**
 * Mutation hook to delete a file or directory
 */
export function useDeleteFileMutation(): UseMutationResult<
  MessageResponse,
  Error,
  { draftId: string; path: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, path }) => deleteFile(draftId, path),
    onSuccess: (_data, { draftId }) => {
      // Invalidate all file queries for this draft
      queryClient.invalidateQueries({
        queryKey: queryKeys.files.all,
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === 'files' && key[2] === draftId;
        },
      });
      // Invalidate draft detail
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts.detail(draftId),
      });
    },
  });
}
