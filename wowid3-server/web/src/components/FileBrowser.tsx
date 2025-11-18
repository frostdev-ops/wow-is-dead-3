import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Folder,
  FolderPlus,
  FileText,
  Edit2,
  Trash2,
  ChevronRight,
  Save,
  X,
  UploadCloud,
  FilePlus,
  Search,
  Eye,
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import FilePreview from './preview/FilePreview';
import './FileBrowser.css';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified?: string;
}

interface FileBrowserProps {
  draftId: string;
  onFileChange?: () => void;
}

// Performance: Memoized file entry component to prevent re-renders
const FileEntryItem = memo(({
  entry,
  onOpen,
  onDelete,
  onPreview,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver
}: {
  entry: FileEntry;
  onOpen: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
  onPreview: (entry: FileEntry) => void;
  onDragOver?: (e: React.DragEvent, entry: FileEntry) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, entry: FileEntry) => void;
  isDragOver?: boolean;
}) => {
  const formatSize = useCallback((bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return (
    <div
      className={`file-browser-entry ${entry.is_dir && isDragOver ? 'drag-over' : ''}`}
      onDragOver={entry.is_dir && onDragOver ? (e) => onDragOver(e, entry) : undefined}
      onDragLeave={entry.is_dir && onDragLeave ? onDragLeave : undefined}
      onDrop={entry.is_dir && onDrop ? (e) => onDrop(e, entry) : undefined}
    >
      <div className="file-browser-entry-info" onClick={() => onOpen(entry)}>
        {entry.is_dir ? (
          <Folder size={20} className="file-icon folder" />
        ) : (
          <FileText size={20} className="file-icon file" />
        )}
        <div className="file-browser-entry-details">
          <div className="file-browser-entry-name">{entry.name}</div>
          <div className="file-browser-entry-meta">
            {!entry.is_dir && <span>{formatSize(entry.size)}</span>}
            {entry.modified && <span>{entry.modified}</span>}
          </div>
        </div>
      </div>
      <div className="file-browser-entry-actions">
        {!entry.is_dir && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(entry);
              }}
              className="btn-icon-small"
              title="Preview"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen(entry);
              }}
              className="btn-icon-small"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
          className="btn-icon-small btn-danger-subtle"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

FileEntryItem.displayName = 'FileEntryItem';

function FileBrowser({ draftId, onFileChange }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Performance: Debounce search input (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Editor state
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ path: string; name: string } | null>(null);

  // New folder state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // New file state
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Drag-and-drop state
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const authToken = localStorage.getItem('auth_token');

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  // Performance: Filter entries based on search query (debounced)
  const filteredEntries = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return entries;
    }
    const query = debouncedSearchQuery.toLowerCase();
    return entries.filter(entry =>
      entry.name.toLowerCase().includes(query) ||
      entry.path.toLowerCase().includes(query)
    );
  }, [entries, debouncedSearchQuery]);

  // Performance: Virtual scrolling for large file lists (1000+ files)
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => document.querySelector('.file-browser-list'),
    estimateSize: () => 60, // Estimated height of each file entry
    overscan: 5, // Render 5 extra items for smooth scrolling
  });

  // Performance: Memoize callbacks to prevent re-renders
  const handleOpenFile = useCallback((entry: FileEntry) => {
    openFile(entry);
  }, []);

  const handleDeleteEntry = useCallback((entry: FileEntry) => {
    deleteEntry(entry);
  }, []);

  const handlePreviewFile = useCallback((entry: FileEntry) => {
    setPreviewFile({ path: entry.path, name: entry.name });
  }, []);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const queryParam = path ? `?path=${encodeURIComponent(path)}` : '';
      const response = await fetch(`/api/admin/drafts/${draftId}/browse${queryParam}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to load directory: ${response.statusText}`);
      }

      const data = await response.json();
      setEntries(data.entries || []);
      setCurrentPath(data.current_path || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
      return;
    }

    // Check if it's a text file
    const textExtensions = ['.txt', '.json', '.toml', '.yaml', '.yml', '.md', '.xml', '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.properties', '.json5', '.cfg', '.conf', '.ini'];
    const isTextFile = textExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));

    if (!isTextFile) {
      setError('Can only edit text files');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(entry.path)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`);
      }

      const data = await response.json();
      setEditingFile({ path: entry.path, content: data.content });
    } catch (err: any) {
      setError(err.message || 'Failed to read file');
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;

    setSavingFile(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/write-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: editingFile.path,
          content: editingFile.content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.statusText}`);
      }

      setSuccess('File saved successfully');
      setEditingFile(null);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save file');
    } finally {
      setSavingFile(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    setError(null);

    try {
      const folderPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;

      const response = await fetch(`/api/admin/drafts/${draftId}/create-dir`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: folderPath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.statusText}`);
      }

      setSuccess(`Folder "${newFolderName}" created`);
      setCreatingFolder(false);
      setNewFolderName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
    }
  };

  const createFile = async () => {
    if (!newFileName.trim()) return;

    setError(null);

    try {
      const filePath = currentPath ? `${currentPath}/${newFileName}` : newFileName;

      const response = await fetch(`/api/admin/drafts/${draftId}/write-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          content: '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create file: ${response.statusText}`);
      }

      setSuccess(`File "${newFileName}" created`);
      setCreatingFile(false);
      setNewFileName('');
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create file');
    }
  };

  const deleteEntry = async (entry: FileEntry) => {
    if (!confirm(`Delete ${entry.is_dir ? 'folder' : 'file'} "${entry.name}"?`)) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/files/${encodeURIComponent(entry.path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }

      setSuccess(`Deleted "${entry.name}"`);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const navigateUp = () => {
    if (!currentPath) return;

    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const uploadFilesToPath = async (files: FileList, targetPath: string) => {
    setUploading(true);
    setError(null);

    try {
      // Step 1: Upload files to get upload_id
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const uploadResponse = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      if (!uploadData || uploadData.length === 0) {
        throw new Error('No upload_id received from server');
      }

      const upload_id = uploadData[0].upload_id;

      // Step 2: Add files to draft in target directory
      const addFilesResponse = await fetch(`/api/admin/drafts/${draftId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_id,
          target_path: targetPath || undefined
        }),
      });

      if (!addFilesResponse.ok) {
        throw new Error(`Failed to add files: ${addFilesResponse.statusText}`);
      }

      setSuccess(`Uploaded ${files.length} file(s) to ${targetPath || 'root'}`);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await uploadFilesToPath(files, currentPath);
    e.target.value = ''; // Reset input
  };

  const handleFileDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    await uploadFilesToPath(files, targetPath);
  };

  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(path);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
  };

  return (
    <div className="file-browser">
      {/* Toolbar */}
      <div className="file-browser-toolbar">
        <div className="file-browser-path">
          <button onClick={() => setCurrentPath('')} disabled={!currentPath} className="breadcrumb-btn">
            <Folder size={16} /> Root
          </button>
          {currentPath.split('/').filter(Boolean).map((part, idx, arr) => (
            <span key={idx}>
              <ChevronRight size={14} className="breadcrumb-sep" />
              <button
                onClick={() => setCurrentPath(arr.slice(0, idx + 1).join('/'))}
                className="breadcrumb-btn"
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        <div className="file-browser-actions">
          <input
            type="file"
            id={`file-upload-${draftId}`}
            multiple
            hidden
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <button
            onClick={() => document.getElementById(`file-upload-${draftId}`)?.click()}
            className="btn-icon"
            title="Upload Files"
            disabled={uploading}
          >
            <UploadCloud size={18} />
          </button>
          <button onClick={() => setCreatingFolder(true)} className="btn-icon" title="New Folder">
            <FolderPlus size={18} />
          </button>
          <button onClick={() => setCreatingFile(true)} className="btn-icon" title="New File">
            <FilePlus size={18} />
          </button>
          <button onClick={() => loadDirectory(currentPath)} className="btn-icon" title="Refresh">
            ↻
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="file-browser-search" style={{ padding: '8px 0' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="form-input"
            style={{ paddingLeft: '36px' }}
          />
        </div>
        {debouncedSearchQuery && (
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
            Found {filteredEntries.length} of {entries.length} files
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="alert alert-error" style={{ margin: '8px 0' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right' }}>×</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ margin: '8px 0' }}>
          {success}
          <button onClick={() => setSuccess(null)} style={{ float: 'right' }}>×</button>
        </div>
      )}

      {/* New Folder Input */}
      {creatingFolder && (
        <div className="file-browser-new-item">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="form-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFolder();
              if (e.key === 'Escape') {
                setCreatingFolder(false);
                setNewFolderName('');
              }
            }}
          />
          <button onClick={createFolder} className="btn-primary">Create</button>
          <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}

      {/* New File Input */}
      {creatingFile && (
        <div className="file-browser-new-item">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="File name"
            className="form-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFile();
              if (e.key === 'Escape') {
                setCreatingFile(false);
                setNewFileName('');
              }
            }}
          />
          <button onClick={createFile} className="btn-primary">Create</button>
          <button onClick={() => { setCreatingFile(false); setNewFileName(''); }} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}

      {/* File List - Performance: Virtualized for 1000+ files */}
      <div
        className="file-browser-list"
        style={{ height: '500px', overflow: 'auto' }}
        onDragOver={(e) => handleDragOver(e, currentPath)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleFileDrop(e, currentPath)}
      >
        {loading && <div className="file-browser-loading">Loading...</div>}

        {!loading && entries.length === 0 && (
          <div className="file-browser-empty">
            <Folder size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>This directory is empty</p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>Create a folder or upload files to get started</p>
          </div>
        )}

        {!loading && filteredEntries.length === 0 && entries.length > 0 && (
          <div className="file-browser-empty">
            <Search size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>No files match your search</p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>Try a different search term</p>
          </div>
        )}

        {!loading && filteredEntries.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = filteredEntries[virtualItem.index];
              return (
                <div
                  key={entry.path}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <FileEntryItem
                    entry={entry}
                    onOpen={handleOpenFile}
                    onDelete={handleDeleteEntry}
                    onPreview={handlePreviewFile}
                    onDragOver={(e, entry) => handleDragOver(e, entry.path)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e, entry) => handleFileDrop(e, entry.path)}
                    isDragOver={dragOverPath === entry.path}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File Editor Modal */}
      {editingFile && (
        <div className="file-editor-modal">
          <div className="file-editor-content">
            <div className="file-editor-header">
              <div>
                <h3>Editing: {editingFile.path}</h3>
              </div>
              <div className="file-editor-actions">
                <button onClick={saveFile} className="btn-primary" disabled={savingFile}>
                  <Save size={16} /> {savingFile ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingFile(null)} className="btn-secondary">
                  <X size={16} /> Close
                </button>
              </div>
            </div>
            <textarea
              value={editingFile.content}
              onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
              className="file-editor-textarea"
              spellCheck={false}
            />
            <div className="file-editor-footer">
              <span>Lines: {editingFile.content.split('\n').length}</span>
              <span>Characters: {editingFile.content.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          draftId={draftId}
          filePath={previewFile.path}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

// Performance: Export memoized version to prevent unnecessary re-renders
export default memo(FileBrowser);
