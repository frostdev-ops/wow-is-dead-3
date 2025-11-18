// React Query hooks for file browser queries

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { browseDirectory, readFile } from '../../api/files';
import type { BrowseResponse, ReadFileResponse } from '../../api/types';

/**
 * Query hook to browse directory contents
 * @param draftId - Draft ID
 * @param path - Directory path to browse
 * @param enabled - Whether the query should run (default: true)
 */
export function useBrowseDirectoryQuery(
  draftId: string | null,
  path: string = '',
  enabled: boolean = true
): UseQueryResult<BrowseResponse, Error> {
  return useQuery({
    queryKey: draftId
      ? queryKeys.files.browse(draftId, path)
      : ['files', 'browse', 'null', path],
    queryFn: () => {
      if (!draftId) throw new Error('Draft ID is required');
      return browseDirectory(draftId, path);
    },
    enabled: enabled && !!draftId,
  });
}

/**
 * Query hook to read file contents
 * @param draftId - Draft ID
 * @param path - File path to read
 * @param enabled - Whether the query should run (default: true)
 */
export function useReadFileQuery(
  draftId: string | null,
  path: string | null,
  enabled: boolean = true
): UseQueryResult<ReadFileResponse, Error> {
  return useQuery({
    queryKey:
      draftId && path
        ? queryKeys.files.read(draftId, path)
        : ['files', 'read', 'null', 'null'],
    queryFn: () => {
      if (!draftId || !path) throw new Error('Draft ID and path are required');
      return readFile(draftId, path);
    },
    enabled: enabled && !!draftId && !!path,
  });
}
