import React, { useState } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import { Upload, Trash2, FileText, FileArchive, File, Folder } from 'lucide-react';
import type { DraftRelease } from '../../types/releases';

interface FilesTabProps {
  draft: DraftRelease;
  onUpdate: (draft: DraftRelease) => void;
}

export default function FilesTab({ draft, onUpdate }: FilesTabProps) {
  const { addFiles, removeFile, loading } = useDrafts();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      // Create form data for file upload
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const updatedDraft = await addFiles(draft.id, {
        files: Array.from(files).map((f) => ({ path: f.name })),
      });

      if (updatedDraft) {
        onUpdate(updatedDraft);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = async (filePath: string) => {
    if (!confirm(`Remove ${filePath}?`)) return;

    const updatedDraft = await removeFile(draft.id, filePath);
    if (updatedDraft) {
      onUpdate(updatedDraft);
    }
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith('.jar')) return <FileArchive className="w-5 h-5 text-orange-500" />;
    if (path.endsWith('.json')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (path.includes('/')) return <Folder className="w-5 h-5 text-yellow-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Group files by directory
  const filesByDir: Record<string, typeof draft.files> = {};
  draft.files.forEach((file) => {
    const dir = file.path.includes('/') ? file.path.split('/')[0] : 'root';
    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(file);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Upload section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Upload Files</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            id="file-upload"
            multiple
            onChange={handleFileUpload}
            disabled={uploading || loading}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className={`cursor-pointer ${uploading || loading ? 'opacity-50' : ''}`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {uploading ? 'Uploading...' : 'Click to upload files'}
            </p>
            <p className="text-sm text-gray-500">
              Upload mods, configs, or any files for your modpack
            </p>
          </label>
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

                {/* Files in directory */}
                {files.map((file) => (
                  <div
                    key={file.path}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
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
                      onClick={() => handleRemoveFile(file.path)}
                      disabled={loading}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
