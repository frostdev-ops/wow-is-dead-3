// Upload-specific type definitions

export interface UploadSession {
  uploadId: string;
  files: File[];
}

export interface UploadProgress {
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface FileUploadResult {
  upload_id: string;
  file_name: string;
  file_size: number;
  sha256: string;
  message: string;
}

export interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onUpload?: () => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  webkitdirectory?: boolean;
}

export interface UploadProgressDisplayProps {
  files: UploadProgress[];
  totalProgress?: number;
  onCancel?: () => void;
}
