// Comprehensive TypeScript types for all API requests and responses

// ========== Draft Types ==========

export interface DraftRelease {
  id: string;
  version: string;
  minecraft_version: string;
  fabric_loader: string;
  changelog: string;
  files: DraftFile[];
  created_at: string;
  updated_at: string;
}

export interface DraftFile {
  path: string;
  url?: string;
  sha256: string;
  size: number;
}

export interface CreateDraftRequest {
  version?: string;
  upload_id?: string;
}

export interface UpdateDraftRequest {
  version?: string;
  minecraft_version?: string;
  fabric_loader?: string;
  changelog?: string;
}

export interface AddFilesRequest {
  upload_id: string;
}

export interface UpdateFileRequest {
  sha256?: string;
  url?: string;
}

export interface VersionSuggestions {
  minecraft_version?: string;
  fabric_loader?: string;
  suggested_version?: string;
  detected_mods: ModInfo[];
}

export interface ModInfo {
  mod_id: string;
  name: string;
  version: string;
  minecraft_version?: string;
  fabric_loader?: string;
}

export interface GeneratedChangelog {
  markdown: string;
  added: string[];
  changed: string[];
  removed: string[];
}

// ========== Release Types ==========

export interface Release {
  version: string;
  minecraft_version: string;
  created_at: string;
  file_count: number;
  size_bytes: number;
}

export interface ReleasesListResponse {
  releases: Release[];
}

export interface CreateReleaseRequest {
  upload_id: string;
  version: string;
  minecraft_version: string;
  fabric_loader: string;
  changelog: string;
}

export interface CopyReleaseToDraftResponse {
  draft_id: string;
  message: string;
}

// ========== Upload Types ==========

export interface UploadResponse {
  upload_id: string;
  file_name: string;
  file_size: number;
  sha256: string;
  message: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  progress: number;
}

// ========== File Browser Types ==========

export interface BrowseResponse {
  path: string;
  entries: FileEntry[];
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified?: string;
}

export interface ReadFileRequest {
  path: string;
}

export interface ReadFileResponse {
  content: string;
  path: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
}

export interface WriteFileResponse {
  message: string;
  path: string;
}

export interface CreateDirRequest {
  path: string;
}

export interface CreateDirResponse {
  message: string;
  path: string;
}

export interface RenameRequest {
  old_path: string;
  new_path: string;
}

export interface RenameResponse {
  message: string;
}

export interface MoveRequest {
  source: string;
  destination: string;
}

export interface MoveResponse {
  message: string;
}

// ========== Blacklist Types ==========

export interface BlacklistResponse {
  patterns: string[];
}

export interface UpdateBlacklistRequest {
  patterns: string[];
}

// ========== Authentication Types ==========

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  token: string;
}

// ========== Error Response Types ==========

export interface ApiError {
  error: string;
  message?: string;
}

// ========== Common Response Types ==========

export interface MessageResponse {
  message: string;
}

// ========== Launcher Version Types ==========

export interface LauncherFile {
  platform: string;  // "windows", "linux", "macos"
  filename: string;  // e.g., "WOWID3Launcher.exe" or "WOWID3Launcher-x86_64.AppImage"
  url: string;
  sha256: string;
  size: number;
}

export interface LauncherVersion {
  version: string;
  files: LauncherFile[];
  changelog: string;
  mandatory: boolean;
  released_at: string;  // ISO 8601
}

export interface LauncherVersionsIndex {
  versions: string[];  // Semantic versions, newest first
  latest: string;
}

export interface UploadLauncherVersionRequest {
  version: string;
  changelog: string;
  mandatory: boolean;
  platform: string;  // "windows", "linux", "macos"
  file: File;
}

export interface UploadLauncherVersionResponse {
  message: string;
  version: string;
  platform: string;
  platforms: string[];
}
