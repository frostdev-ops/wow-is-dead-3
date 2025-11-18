// Draft-specific type definitions
// Extends the base DraftRelease type from releases.ts

export interface DraftCardProps {
  id: string;
  version: string;
  minecraft_version?: string;
  fabric_loader?: string;
  files: { path: string; size: number; sha256: string }[];
  updated_at: string;
  onEdit: (id: string) => void;
  onDuplicate: (id: string, version: string) => void;
  onDelete: (id: string, version: string) => void;
  isLoading?: boolean;
}

export interface DraftListProps {
  filter?: 'all' | 'drafts';
  onCreateDraft?: () => void;
  onEditDraft?: (id: string) => void;
}

export interface DraftFormData {
  version: string;
  minecraft_version: string;
  fabric_loader: string;
  changelog: string;
}
