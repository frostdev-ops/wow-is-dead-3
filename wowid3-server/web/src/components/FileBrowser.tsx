import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
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
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ duration: 0.15 }}
      className={`flex justify-between items-center px-3 py-3 rounded-md mb-1 cursor-pointer transition-all border ${
        isDragOver
          ? 'bg-primary/10 border-primary border-2 border-dashed'
          : 'border-transparent hover:bg-muted hover:border-primary'
      } group`}
      onDragOver={entry.is_dir && onDragOver ? (e) => onDragOver(e, entry) : undefined}
      onDragLeave={entry.is_dir && onDragLeave ? onDragLeave : undefined}
      onDrop={entry.is_dir && onDrop ? (e) => onDrop(e, entry) : undefined}
    >
      <div className="flex items-center gap-3 flex-1" onClick={() => onOpen(entry)}>
        {entry.is_dir ? (
          <Folder size={20} className="text-warning flex-shrink-0" />
        ) : (
          <FileText size={20} className="text-primary flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground mb-1">{entry.name}</div>
          <div className="text-xs text-muted-foreground flex gap-4">
            {!entry.is_dir && <span>{formatSize(entry.size)}</span>}
            {entry.modified && <span>{entry.modified}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!entry.is_dir && (
          <>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onPreview(entry);
              }}
              className="bg-primary text-primary-foreground p-1.5 rounded hover:bg-primary/90 transition-colors"
              title="Preview"
            >
              <Eye size={14} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(entry);
              }}
              className="bg-primary text-primary-foreground p-1.5 rounded hover:bg-primary/90 transition-colors"
              title="Edit"
            >
              <Edit2 size={14} />
            </motion.button>
          </>
        )}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
          className="bg-destructive text-destructive-foreground p-1.5 rounded hover:bg-destructive/90 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </motion.button>
      </div>
    </motion.div>
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
    <div className="bg-card rounded-lg border border-border overflow-hidden flex flex-col h-[600px]">
      {/* Toolbar */}
      <div className="flex justify-between items-center px-4 py-3 bg-muted border-b border-border">
        <div className="flex items-center gap-1 flex-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentPath('')}
            disabled={!currentPath}
            className="inline-flex items-center gap-1.5 bg-transparent border-none text-primary cursor-pointer px-2 py-1 rounded text-sm transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            <Folder size={16} /> Root
          </motion.button>
          {currentPath.split('/').filter(Boolean).map((part, idx, arr) => (
            <span key={idx} className="flex items-center">
              <ChevronRight size={14} className="text-muted-foreground" />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentPath(arr.slice(0, idx + 1).join('/'))}
                className="bg-transparent border-none text-primary cursor-pointer px-2 py-1 rounded text-sm transition-colors hover:bg-primary/10"
              >
                {part}
              </motion.button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="file"
            id={`file-upload-${draftId}`}
            multiple
            hidden
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById(`file-upload-${draftId}`)?.click()}
            className="bg-primary text-primary-foreground border-none cursor-pointer px-3 py-2 rounded inline-flex items-center gap-1.5 text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            title="Upload Files"
            disabled={uploading}
          >
            <UploadCloud size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCreatingFolder(true)}
            className="bg-primary text-primary-foreground border-none cursor-pointer px-3 py-2 rounded inline-flex items-center gap-1.5 text-sm transition-colors hover:bg-primary/90"
            title="New Folder"
          >
            <FolderPlus size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCreatingFile(true)}
            className="bg-primary text-primary-foreground border-none cursor-pointer px-3 py-2 rounded inline-flex items-center gap-1.5 text-sm transition-colors hover:bg-primary/90"
            title="New File"
          >
            <FilePlus size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => loadDirectory(currentPath)}
            className="bg-primary text-primary-foreground border-none cursor-pointer px-3 py-2 rounded inline-flex items-center gap-1.5 text-sm transition-colors hover:bg-primary/90"
            title="Refresh"
          >
            ↻
          </motion.button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="py-2 px-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {debouncedSearchQuery && (
          <div className="text-xs opacity-70 text-muted-foreground mt-1">
            Found {filteredEntries.length} of {entries.length} files
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 my-2 px-4 py-3 rounded-md bg-destructive/10 border border-destructive text-destructive-foreground text-sm"
          >
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">×</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 my-2 px-4 py-3 rounded-md bg-success/10 border border-success text-success-foreground text-sm"
          >
            {success}
            <button onClick={() => setSuccess(null)} className="float-right font-bold">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Folder Input */}
      <AnimatePresence>
        {creatingFolder && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-3 bg-muted border-b border-border flex gap-2 items-center"
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') {
                  setCreatingFolder(false);
                  setNewFolderName('');
                }
              }}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={createFolder}
              className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90"
            >
              Create
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-secondary/90"
            >
              Cancel
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New File Input */}
      <AnimatePresence>
        {creatingFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-3 bg-muted border-b border-border flex gap-2 items-center"
          >
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="File name"
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFile();
                if (e.key === 'Escape') {
                  setCreatingFile(false);
                  setNewFileName('');
                }
              }}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={createFile}
              className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-primary/90"
            >
              Create
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setCreatingFile(false); setNewFileName(''); }}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm font-semibold hover:bg-secondary/90"
            >
              Cancel
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List - Performance: Virtualized for 1000+ files */}
      <div
        className="file-browser-list flex-1 overflow-auto px-2"
        onDragOver={(e) => handleDragOver(e, currentPath)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleFileDrop(e, currentPath)}
      >
        {loading && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Loading...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-15 text-muted-foreground"
          >
            <Folder size={48} className="opacity-30 mb-3 mx-auto" />
            <p className="text-base">This directory is empty</p>
            <p className="text-xs opacity-70 mt-1">Create a folder or upload files to get started</p>
          </motion.div>
        )}

        {!loading && filteredEntries.length === 0 && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-15 text-muted-foreground"
          >
            <Search size={48} className="opacity-30 mb-3 mx-auto" />
            <p className="text-base">No files match your search</p>
            <p className="text-xs opacity-70 mt-1">Try a different search term</p>
          </motion.div>
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
      <AnimatePresence>
        {editingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-5"
            onClick={() => setEditingFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-muted rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-5 py-4 border-b border-border">
                <div>
                  <h3 className="m-0 text-foreground text-base">Editing: {editingFile.path}</h3>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveFile}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded inline-flex items-center gap-2 font-semibold hover:bg-primary/90 disabled:opacity-50"
                    disabled={savingFile}
                  >
                    <Save size={16} /> {savingFile ? 'Saving...' : 'Save'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditingFile(null)}
                    className="bg-secondary text-secondary-foreground px-4 py-2 rounded inline-flex items-center gap-2 font-semibold hover:bg-secondary/90"
                  >
                    <X size={16} /> Close
                  </motion.button>
                </div>
              </div>
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className="flex-1 p-5 bg-background text-foreground border-none outline-none font-mono text-sm leading-relaxed resize-none min-h-[500px] tab-size-2"
                spellCheck={false}
              />
              <div className="px-5 py-3 border-t border-border flex justify-between text-xs text-muted-foreground">
                <span>Lines: {editingFile.content.split('\n').length}</span>
                <span>Characters: {editingFile.content.length}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <FilePreview
            draftId={draftId}
            filePath={previewFile.path}
            fileName={previewFile.name}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Performance: Export memoized version to prevent unnecessary re-renders
export default memo(FileBrowser);
