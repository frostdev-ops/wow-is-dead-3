// Typed API endpoints for release operations

import api from './client';
import type {
  Release,
  ReleasesListResponse,
  CreateReleaseRequest,
  CopyReleaseToDraftResponse,
  MessageResponse,
  BlacklistResponse,
  UpdateBlacklistRequest,
} from './types';

const BASE_PATH = '/admin/releases';

/**
 * List all releases
 */
export async function listReleases(): Promise<Release[]> {
  const response = await api.get<ReleasesListResponse>(BASE_PATH);
  return response.data.releases;
}

/**
 * Create a new release
 */
export async function createRelease(
  request: CreateReleaseRequest
): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>(BASE_PATH, request);
  return response.data;
}

/**
 * Delete a release
 */
export async function deleteRelease(version: string): Promise<MessageResponse> {
  const response = await api.delete<MessageResponse>(`${BASE_PATH}/${version}`);
  return response.data;
}

/**
 * Copy a release to draft for editing
 */
export async function copyReleaseToDraft(
  version: string
): Promise<CopyReleaseToDraftResponse> {
  const response = await api.post<CopyReleaseToDraftResponse>(
    `${BASE_PATH}/${version}/copy-to-draft`
  );
  return response.data;
}

/**
 * Get blacklist patterns
 */
export async function getBlacklist(): Promise<string[]> {
  const response = await api.get<BlacklistResponse>('/admin/blacklist');
  return response.data.patterns;
}

/**
 * Update blacklist patterns
 */
export async function updateBlacklist(patterns: string[]): Promise<MessageResponse> {
  const request: UpdateBlacklistRequest = { patterns };
  const response = await api.put<MessageResponse>('/admin/blacklist', request);
  return response.data;
}
