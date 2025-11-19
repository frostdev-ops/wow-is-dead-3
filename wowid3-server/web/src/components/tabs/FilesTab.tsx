import React, { useState, useCallback, useMemo, memo } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import { Upload, Trash2, FileText, FileArchive, File, Folder, Loader2, Folder as FolderIcon } from 'lucide-react';
import axios from 'axios';
import FileBrowser from '../FileBrowser';
import type { DraftRelease } from '../../types/releases';

// Performance: Memoized FileItem component to prevent re-renders
const FileItem = memo(({
  file,
  getFileIcon,
  formatSize,
  onRemove,
  loading,
  onDragStart,
  onDragEnd,
  isDragging
}: {
  file: any;
  getFileIcon: (path: string) => React.ReactNode;
  formatSize: (bytes: number) => string;
  onRemove: (path: string) => void;
  loading: boolean;
  onDragStart?: (e: React.DragEvent, path: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, file.path)}
      onDragEnd={onDragEnd}
      className={`px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-move ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1">
        {getFileIcon(file.path)}
        <div className="flex-1">
          <p className="font-medium text-foreground">
            {file.path.split('/').pop()}
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
            <span>{formatSize(file.size)}</span>
            <span className="font-mono text-xs">
              {file.sha256.substring(0, 12)}...
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onRemove(file.path)}
        disabled={loading}
        className="px-3 py-2 text-destructive hover:bg-destructive/10 rounded disabled:opacity-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
});

FileItem.displayName = 'FileItem';

interface FilesTabProps {
  draft: DraftRelease;
  onUpdate: (draft: DraftRelease) => void;
}

// Get auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function FilesTab({ draft, onUpdate }: FilesTabProps) {
  const { addFiles, removeFile, loading } = useDrafts();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [draggingFile, setDraggingFile] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Performance: Memoize icon getter to prevent recreation
  const getFileIcon = useCallback((path: string) => {
    if (path.endsWith('.jar')) return <FileArchive className="w-5 h-5 text-warning" />;
    if (path.endsWith('.json')) return <FileText className="w-5 h-5 text-primary" />;
    if (path.includes('/')) return <Folder className="w-5 h-5 text-warning" />;
    return <File className="w-5 h-5 text-muted-foreground" />;
  }, []);

  // Performance: Memoize size formatter
  const formatSize = useCallback((bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  const uploadFiles = async (files: FileList) => {
    console.log('uploadFiles called with', files.length, 'files');
    setUploading(true);
    setUploadProgress(0);
    try {
      // Step 1: Upload files to get upload_id
      console.log('Step 1: Uploading to /api/admin/upload');
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const uploadResponse = await axios.post('/api/admin/upload', formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      console.log('Upload response:', uploadResponse.data);

      // Check if any files were extracted from zip
      const hasExtractedFiles = uploadResponse.data.some((file: any) =>
        file.message && file.message.includes('Extracted from')
      );

      if (hasExtractedFiles) {
        setExtracting(true);
      }

      const upload_id = uploadResponse.data[0].upload_id;
      console.log('Step 2: Adding files to draft with upload_id:', upload_id);

      // Step 2: Add files to draft using upload_id
      const updatedDraft = await addFiles(draft.id, { upload_id });
      console.log('addFiles result:', updatedDraft);
      if (updatedDraft) {
        onUpdate(updatedDraft);
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      console.error('Error response:', error.response);
      alert(`Upload failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading || loading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
  };

  // Performance: Memoize remove handler
  const handleRemoveFile = useCallback(async (filePath: string) => {
    if (!confirm(`Remove ${filePath}?`)) return;

    const updatedDraft = await removeFile(draft.id, filePath);
    if (updatedDraft) {
      onUpdate(updatedDraft);
    }
  }, [draft.id, removeFile, onUpdate]);

  // Drag-and-drop handlers
  const handleFileDragStart = (e: React.DragEvent, filePath: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', filePath);
    setDraggingFile(filePath);
  };

  const handleFileDragEnd = () => {
    setDraggingFile(null);
    setDropTarget(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(folder);
  };

  const handleFolderDragLeave = () => {
    setDropTarget(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || sourcePath === draggingFile) {
      setDraggingFile(null);
      return;
    }

    const fileName = sourcePath.split('/').pop();
    if (!fileName) return;

    const destPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    try {
      const response = await axios.post(
        `/api/admin/drafts/${draft.id}/move`,
        { source_path: sourcePath, dest_path: destPath },
        { headers: getAuthHeaders() }
      );

      if (response.status === 200) {
        // Refresh draft to get updated file list
        const updatedDraft = { ...draft };
        if (updatedDraft.files) {
          const fileIndex = updatedDraft.files.findIndex(f => f.path === sourcePath);
          if (fileIndex !== -1) {
            updatedDraft.files[fileIndex].path = destPath;
          }
        }
        onUpdate(updatedDraft);
      }
    } catch (error: any) {
      console.error('Failed to move file:', error);
      alert(`Failed to move file: ${error.response?.data?.error || error.message}`);
    } finally {
      setDraggingFile(null);
    }
  };

  // Performance: Group files by directory with useMemo
  const filesByDir = useMemo(() => {
    const grouped: Record<string, typeof draft.files> = {};
    draft.files.forEach((file) => {
      const dir = file.path.includes('/') ? file.path.split('/')[0] : 'root';
      if (!grouped[dir]) {
        grouped[dir] = [];
      }
      grouped[dir].push(file);
    });
    return grouped;
  }, [draft.files]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Upload section */}
      <div className="bg-card rounded-lg shadow p-6 mb-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-foreground">Upload Files</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/10'
              : 'border-border'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            multiple
            accept=".zip,.jar,.json,.toml,.txt,*"
            onChange={handleFileUpload}
            disabled={uploading || loading}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className={`cursor-pointer ${uploading || loading ? 'opacity-50' : ''}`}
          >
            {uploading ? (
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <p className="text-lg font-medium text-foreground mb-2">
              {extracting
                ? 'Extracting zip files...'
                : uploading
                ? `Uploading... ${uploadProgress}%`
                : 'Click to upload files or drag a zip'}
            </p>
            <p className="text-sm text-muted-foreground">
              Upload .zip archives (auto-extracted), mods, configs, or any modpack files
            </p>
          </label>

          {/* Progress bar */}
          {uploading && uploadProgress > 0 && (
            <div className="mt-4 w-full max-w-md mx-auto">
              <div className="bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="bg-card rounded-lg shadow border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            Files ({draft.files.length})
          </h2>
          <button
            onClick={() => setShowFileBrowser(!showFileBrowser)}
            className="px-3 py-1 text-sm bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
          >
            {showFileBrowser ? 'Simple View' : 'File Browser'}
          </button>
        </div>

        {showFileBrowser ? (
          <FileBrowser
            draftId={draft.id}
            onFileChange={() => onUpdate(draft)}
          />
        ) : (
          <>
            {draft.files.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No files uploaded yet</p>
                <p className="text-sm mt-2">Upload files to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {Object.entries(filesByDir).map(([dir, files]) => (
                  <div key={dir}>
                    {/* Directory header */}
                    {dir !== 'root' && (
                      <div
                        className={`px-6 py-2 bg-muted font-medium text-foreground flex items-center gap-2 transition-all ${dropTarget === dir ? 'bg-primary/20 border-2 border-primary border-dashed' : ''}`}
                        onDragOver={(e) => handleFolderDragOver(e, dir)}
                        onDragLeave={handleFolderDragLeave}
                        onDrop={(e) => handleFolderDrop(e, dir)}
                      >
                        <Folder className="w-4 h-4" />
                        {dir}/
                      </div>
                    )}

                    {/* Files in directory - Performance: Use memoized FileItem */}
                    {files.map((file) => (
                      <FileItem
                        key={file.path}
                        file={file}
                        getFileIcon={getFileIcon}
                        formatSize={formatSize}
                        onRemove={handleRemoveFile}
                        loading={loading}
                        onDragStart={handleFileDragStart}
                        onDragEnd={handleFileDragEnd}
                        isDragging={draggingFile === file.path}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Performance: Export memoized version
export default memo(FilesTab);
