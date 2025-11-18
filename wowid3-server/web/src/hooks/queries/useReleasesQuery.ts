// React Query hooks for release queries

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { listReleases, getBlacklist } from '../../api/releases';
import type { Release } from '../../api/types';

/**
 * Query hook to list all releases
 * Auto-refreshes every 30 seconds
 */
export function useReleasesQuery(): UseQueryResult<Release[], Error> {
  return useQuery({
    queryKey: queryKeys.releases.list(),
    queryFn: listReleases,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Query hook to get blacklist patterns
 */
export function useBlacklistQuery(): UseQueryResult<string[], Error> {
  return useQuery({
    queryKey: queryKeys.blacklist.list(),
    queryFn: getBlacklist,
  });
}
