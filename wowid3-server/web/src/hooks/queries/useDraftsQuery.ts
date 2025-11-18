// React Query hooks for draft queries

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { listDrafts, getDraft } from '../../api/drafts';
import type { DraftRelease } from '../../api/types';

/**
 * Query hook to list all drafts
 * Auto-refreshes every 30 seconds
 */
export function useDraftsQuery(): UseQueryResult<DraftRelease[], Error> {
  return useQuery({
    queryKey: queryKeys.drafts.list(),
    queryFn: listDrafts,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Query hook to get a specific draft by ID
 * @param id - Draft ID to fetch
 * @param enabled - Whether the query should run (default: true)
 */
export function useDraftQuery(
  id: string | null,
  enabled: boolean = true
): UseQueryResult<DraftRelease, Error> {
  return useQuery({
    queryKey: id ? queryKeys.drafts.detail(id) : ['drafts', 'detail', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Draft ID is required');
      return getDraft(id);
    },
    enabled: enabled && !!id,
  });
}
