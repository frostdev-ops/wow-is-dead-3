// Release-specific type definitions

export interface Release {
  version: string;
  minecraft_version: string;
  fabric_loader?: string;
  created_at: string;
  file_count: number;
  size_bytes: number;
  changelog?: string;
}

export interface ReleaseCardProps {
  release: Release;
  onDelete: (version: string) => void;
  onCopyToDraft: (version: string) => void;
  isLoading?: boolean;
}

export interface ReleaseListProps {
  onCreateRelease?: () => void;
  showActions?: boolean;
}

export interface CreateReleaseRequest {
  upload_id: string;
  version: string;
  minecraft_version: string;
  fabric_loader: string;
  changelog: string;
}
