// Typed API endpoints for file browser operations

import api from './client';
import type {
  BrowseResponse,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  CreateDirRequest,
  CreateDirResponse,
  RenameRequest,
  RenameResponse,
  MoveRequest,
  MoveResponse,
  MessageResponse,
} from './types';

/**
 * Browse directory contents in a draft
 */
export async function browseDirectory(
  draftId: string,
  path: string = ''
): Promise<BrowseResponse> {
  const response = await api.get<BrowseResponse>(
    `/admin/drafts/${draftId}/browse`,
    {
      params: { path },
    }
  );
  return response.data;
}

/**
 * Read file contents from a draft
 */
export async function readFile(draftId: string, path: string): Promise<ReadFileResponse> {
  const request: ReadFileRequest = { path };
  const response = await api.get<ReadFileResponse>(
    `/admin/drafts/${draftId}/read-file`,
    {
      params: request,
    }
  );
  return response.data;
}

/**
 * Write file contents to a draft
 */
export async function writeFile(
  draftId: string,
  path: string,
  content: string
): Promise<WriteFileResponse> {
  const request: WriteFileRequest = { path, content };
  const response = await api.post<WriteFileResponse>(
    `/admin/drafts/${draftId}/write-file`,
    request
  );
  return response.data;
}

/**
 * Create a directory in a draft
 */
export async function createDirectory(
  draftId: string,
  path: string
): Promise<CreateDirResponse> {
  const request: CreateDirRequest = { path };
  const response = await api.post<CreateDirResponse>(
    `/admin/drafts/${draftId}/create-dir`,
    request
  );
  return response.data;
}

/**
 * Rename a file or directory in a draft
 */
export async function renameFile(
  draftId: string,
  oldPath: string,
  newPath: string
): Promise<RenameResponse> {
  const request: RenameRequest = { old_path: oldPath, new_path: newPath };
  const response = await api.post<RenameResponse>(
    `/admin/drafts/${draftId}/rename`,
    request
  );
  return response.data;
}

/**
 * Move a file or directory in a draft
 */
export async function moveFile(
  draftId: string,
  source: string,
  destination: string
): Promise<MoveResponse> {
  const request: MoveRequest = { source, destination };
  const response = await api.post<MoveResponse>(`/admin/drafts/${draftId}/move`, request);
  return response.data;
}

/**
 * Delete a file or directory in a draft
 */
export async function deleteFile(draftId: string, path: string): Promise<MessageResponse> {
  const response = await api.delete<MessageResponse>(
    `/admin/drafts/${draftId}/files/${path}`
  );
  return response.data;
}
