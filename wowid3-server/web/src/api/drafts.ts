// Typed API endpoints for draft operations

import api from './client';
import type {
  DraftRelease,
  CreateDraftRequest,
  UpdateDraftRequest,
  AddFilesRequest,
  UpdateFileRequest,
  VersionSuggestions,
  GeneratedChangelog,
  MessageResponse,
} from './types';

const BASE_PATH = '/admin/drafts';

/**
 * List all draft releases
 */
export async function listDrafts(): Promise<DraftRelease[]> {
  const response = await api.get<DraftRelease[]>(BASE_PATH);
  return response.data;
}

/**
 * Get a specific draft by ID
 */
export async function getDraft(id: string): Promise<DraftRelease> {
  const response = await api.get<DraftRelease>(`${BASE_PATH}/${id}`);
  return response.data;
}

/**
 * Create a new draft release
 */
export async function createDraft(
  request: CreateDraftRequest = {}
): Promise<DraftRelease> {
  const response = await api.post<DraftRelease>(BASE_PATH, request);
  return response.data;
}

/**
 * Update draft metadata
 */
export async function updateDraft(
  id: string,
  request: UpdateDraftRequest
): Promise<DraftRelease> {
  const response = await api.put<DraftRelease>(`${BASE_PATH}/${id}`, request);
  return response.data;
}

/**
 * Delete a draft
 */
export async function deleteDraft(id: string): Promise<MessageResponse> {
  const response = await api.delete<MessageResponse>(`${BASE_PATH}/${id}`);
  return response.data;
}

/**
 * Analyze draft files and get version suggestions
 */
export async function analyzeDraft(id: string): Promise<VersionSuggestions> {
  const response = await api.post<VersionSuggestions>(`${BASE_PATH}/${id}/analyze`, {});
  return response.data;
}

/**
 * Generate changelog for draft
 */
export async function generateChangelog(id: string): Promise<GeneratedChangelog> {
  const response = await api.post<GeneratedChangelog>(
    `${BASE_PATH}/${id}/generate-changelog`,
    {}
  );
  return response.data;
}

/**
 * Add files to draft from upload
 */
export async function addFilesToDraft(
  id: string,
  request: AddFilesRequest
): Promise<DraftRelease> {
  const response = await api.post<DraftRelease>(`${BASE_PATH}/${id}/files`, request);
  return response.data;
}

/**
 * Remove a file from draft
 */
export async function removeFileFromDraft(
  id: string,
  filePath: string
): Promise<DraftRelease> {
  const response = await api.delete<DraftRelease>(`${BASE_PATH}/${id}/files/${filePath}`);
  return response.data;
}

/**
 * Update a file in draft
 */
export async function updateFileInDraft(
  id: string,
  filePath: string,
  request: UpdateFileRequest
): Promise<DraftRelease> {
  const response = await api.put<DraftRelease>(
    `${BASE_PATH}/${id}/files/${filePath}`,
    request
  );
  return response.data;
}

/**
 * Publish draft as a release
 */
export async function publishDraft(id: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>(`${BASE_PATH}/${id}/publish`, {});
  return response.data;
}

/**
 * Duplicate a draft
 */
export async function duplicateDraft(id: string): Promise<DraftRelease> {
  const response = await api.post<DraftRelease>(`${BASE_PATH}/${id}/duplicate`, {});
  return response.data;
}
