// Type definitions for release wizard

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

export type TabType = 'files' | 'metadata' | 'changelog' | 'review';

export interface ReleaseEditorState {
  currentTab: TabType;
  hasUnsavedChanges: boolean;
  validationErrors: Record<TabType, string[]>;
}
