import React, { useState, useCallback, useMemo, memo } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import { Upload, Trash2, FileText, FileArchive, File, Folder, Loader2 } from 'lucide-react';
import axios from 'axios';
import type { DraftRelease } from '../../types/releases';

// Performance: Memoized FileItem component to prevent re-renders
const FileItem = memo(({
  file,
  getFileIcon,
  formatSize,
  onRemove,
  loading
}: {
  file: any;
  getFileIcon: (path: string) => React.ReactNode;
  formatSize: (bytes: number) => string;
  onRemove: (path: string) => void;
  loading: boolean;
}) => {
  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex items-center gap-3 flex-1">
        {getFileIcon(file.path)}
        <div className="flex-1">
          <p className="font-medium text-gray-900">
            {file.path.split('/').pop()}
          </p>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
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
        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
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

  // Performance: Memoize icon getter to prevent recreation
  const getFileIcon = useCallback((path: string) => {
    if (path.endsWith('.jar')) return <FileArchive className="w-5 h-5 text-orange-500" />;
    if (path.endsWith('.json')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (path.includes('/')) return <Folder className="w-5 h-5 text-yellow-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
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
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Upload Files</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300'
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
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            )}
            <p className="text-lg font-medium text-gray-700 mb-2">
              {extracting
                ? 'Extracting zip files...'
                : uploading
                ? `Uploading... ${uploadProgress}%`
                : 'Click to upload files or drag a zip'}
            </p>
            <p className="text-sm text-gray-500">
              Upload .zip archives (auto-extracted), mods, configs, or any modpack files
            </p>
          </label>

          {/* Progress bar */}
          {uploading && uploadProgress > 0 && (
            <div className="mt-4 w-full max-w-md mx-auto">
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">
            Files ({draft.files.length})
          </h2>
        </div>

        {draft.files.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No files uploaded yet</p>
            <p className="text-sm mt-2">Upload files to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {Object.entries(filesByDir).map(([dir, files]) => (
              <div key={dir}>
                {/* Directory header */}
                {dir !== 'root' && (
                  <div className="px-6 py-2 bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
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
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Performance: Export memoized version
export default memo(FilesTab);
