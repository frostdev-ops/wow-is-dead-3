import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
  Move,
  CheckSquare,
  Square,
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

// Helper to format file size
const formatSize = (bytes?: number) => {
  if (bytes === undefined) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Helper to format date
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return dateString;
  }
};

// Performance: Memoized file entry component
const FileEntryRow = memo(({
  entry,
  isSelected,
  onSelect,
  onOpen,
  onDelete,
  onRename,
  onMove,
  onPreview,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver
}: {
  entry: FileEntry;
  isSelected: boolean;
  onSelect: (entry: FileEntry, multi: boolean) => void;
  onOpen: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
  onRename: (entry: FileEntry) => void;
  onMove: (entry: FileEntry) => void;
  onPreview: (entry: FileEntry) => void;
  onDragStart: (e: React.DragEvent, entry: FileEntry) => void;
  onDragOver?: (e: React.DragEvent, entryOrPath: FileEntry | string) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, entryOrPath: FileEntry | string) => void;
  isDragOver?: boolean;
}) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entry)}
      onDragOver={entry.is_dir && onDragOver ? (e) => onDragOver(e, entry) : undefined}
      onDragLeave={entry.is_dir && onDragLeave ? onDragLeave : undefined}
      onDrop={entry.is_dir && onDrop ? (e) => onDrop(e, entry) : undefined}
      className={`flex items-center px-4 py-2 border-b border-border hover:bg-muted/50 transition-colors group ${
        isSelected ? 'bg-primary/10' : ''
      } ${isDragOver ? 'bg-primary/20 ring-2 ring-inset ring-primary' : ''}`}
      onClick={(e) => {
        // If clicking the row (not specific buttons), select or open
        if (e.ctrlKey || e.metaKey) {
          onSelect(entry, true);
        } else {
          // Single click selects, double click opens? Or just click to open folders?
          // Let's stick to: click selects, double click opens.
          // But for now, let's make single click on name/icon open folders for ease of use
        }
      }}
    >
      {/* Checkbox */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onSelect(entry, true); }}>
        {isSelected ? (
          <CheckSquare size={18} className="text-primary cursor-pointer" />
        ) : (
          <Square size={18} className="text-muted-foreground/50 cursor-pointer hover:text-muted-foreground" />
        )}
      </div>

      {/* Name & Icon */}
      <div 
        className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
        onClick={() => onOpen(entry)}
      >
        {entry.is_dir ? (
          <Folder size={20} className="text-warning flex-shrink-0" />
        ) : (
          <FileText size={20} className="text-primary flex-shrink-0" />
        )}
        <span className="truncate font-medium text-sm">{entry.name}</span>
      </div>

      {/* Size */}
      <div className="w-24 text-sm text-muted-foreground text-right flex-shrink-0 hidden sm:block">
        {!entry.is_dir && formatSize(entry.size)}
      </div>

      {/* Modified Date */}
      <div className="w-40 text-sm text-muted-foreground text-right flex-shrink-0 px-4 hidden md:block">
        {formatDate(entry.modified)}
      </div>

      {/* Actions */}
      <div className="w-28 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!entry.is_dir && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(entry); }}
            className="p-1.5 hover:bg-primary/10 rounded text-primary transition-colors"
            title="Preview"
          >
            <Eye size={16} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRename(entry); }}
          className="p-1.5 hover:bg-primary/10 rounded text-primary transition-colors"
          title="Rename"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(entry); }}
          className="p-1.5 hover:bg-primary/10 rounded text-primary transition-colors"
          title="Move"
        >
          <Move size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
          className="p-1.5 hover:bg-destructive/10 rounded text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
});

FileEntryRow.displayName = 'FileEntryRow';

function FileBrowser({ draftId, onFileChange }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Performance: Debounce search input
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Editor state
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ path: string; name: string } | null>(null);

  // Rename state
  const [renamingEntry, setRenamingEntry] = useState<FileEntry | null>(null);
  const [newName, setNewName] = useState('');

  // Move state
  const [movingEntry, setMovingEntry] = useState<FileEntry | null>(null);
  const [moveDest, setMoveDest] = useState('');

  // New folder/file state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Drag-and-drop state
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [isDraggingInternal, setIsDraggingInternal] = useState(false);

  const authToken = localStorage.getItem('auth_token');
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDirectory(currentPath);
    setSelectedPaths(new Set()); // Clear selection on path change
  }, [currentPath]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = entries.filter(entry =>
        entry.name.toLowerCase().includes(query) ||
        entry.path.toLowerCase().includes(query)
      );
    }
    // Sort: Folders first, then files
    return result.sort((a, b) => {
      if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
      return a.is_dir ? -1 : 1;
    });
  }, [entries, debouncedSearchQuery]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Height of each row
    overscan: 10,
  });

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryParam = path ? `?path=${encodeURIComponent(path)}` : '';
      const response = await fetch(`/api/admin/drafts/${draftId}/browse${queryParam}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) throw new Error(`Failed to load directory: ${response.statusText}`);

      const data = await response.json();
      setEntries(data.entries || []);
      // Ensure currentPath matches what server thinks, or trust client state?
      // Trusting client state for navigation consistency, but data.current_path is useful
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  // --- Actions ---

  const handleSelect = useCallback((entry: FileEntry, multi: boolean) => {
    setSelectedPaths(prev => {
      const newSet = new Set(multi ? prev : []);
      if (newSet.has(entry.path)) {
        newSet.delete(entry.path);
      } else {
        newSet.add(entry.path);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedPaths.size === filteredEntries.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredEntries.map(e => e.path)));
    }
  };

  const handleOpen = useCallback((entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    } else {
      openFileEditor(entry);
    }
  }, []);

  const openFileEditor = async (entry: FileEntry) => {
    // Check extensions
    const textExtensions = ['.txt', '.json', '.toml', '.yaml', '.yml', '.md', '.xml', '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.properties', '.json5', '.cfg', '.conf', '.ini'];
    const isTextFile = textExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));

    if (!isTextFile) {
      setError('Can only edit text files');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(entry.path)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error('Failed to read file');
      const data = await response.json();
      setEditingFile({ path: entry.path, content: data.content });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/write-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: editingFile.path, content: editingFile.content }),
      });
      if (!response.ok) throw new Error('Failed to save file');
      setSuccess('File saved');
      setEditingFile(null);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingFile(false);
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/files/${encodeURIComponent(entry.path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        
        // Handle non-empty directory
        if (response.status === 400 && data.error === "Directory is not empty") {
          if (confirm(`Directory "${entry.name}" is not empty. Delete recursively?`)) {
            const retryResponse = await fetch(`/api/admin/drafts/${draftId}/files/${encodeURIComponent(entry.path)}?recursive=true`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${authToken}` },
            });
            
            if (!retryResponse.ok) {
              const retryData = await retryResponse.json().catch(() => ({}));
              throw new Error(retryData.error || 'Failed to delete recursively');
            }
            
            setSuccess(`Deleted ${entry.name}`);
            loadDirectory(currentPath);
            onFileChange?.();
            return;
          } else {
            return; // User cancelled
          }
        }
        
        throw new Error(data.error || 'Failed to delete');
      }
      
      setSuccess(`Deleted ${entry.name}`);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPaths.size === 0) return;
    if (!confirm(`Delete ${selectedPaths.size} items?`)) return;

    setLoading(true);
    try {
      // Delete sequentially or parallel? Parallel might overwhelm.
      // Let's do parallel with Promise.all
      const responses = await Promise.all(Array.from(selectedPaths).map(path => 
        fetch(`/api/admin/drafts/${draftId}/files/${encodeURIComponent(path)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        })
      ));

      const failed = responses.filter(r => !r.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length} items failed to delete`);
      }

      setSuccess(`Deleted ${selectedPaths.size} items`);
      setSelectedPaths(new Set());
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message || 'Some items failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = (entry: FileEntry) => {
    setRenamingEntry(entry);
    setNewName(entry.name);
  };

  const submitRename = async () => {
    if (!renamingEntry || !newName.trim() || newName === renamingEntry.name) {
      setRenamingEntry(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/rename`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_path: renamingEntry.path,
          new_path: currentPath ? `${currentPath}/${newName}` : newName
        }),
      });

      if (!response.ok) throw new Error('Failed to rename');
      
      setSuccess(`Renamed to ${newName}`);
      setRenamingEntry(null);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to rename');
    }
  };

  const handleMove = async (sourcePath: string, destFolder: string) => {
    const fileName = sourcePath.split('/').pop();
    if (!fileName) return;
    
    const destPath = destFolder ? `${destFolder}/${fileName}` : fileName;
    if (sourcePath === destPath) return;

    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/move`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source_path: sourcePath, dest_path: destPath }),
      });

      if (!response.ok) throw new Error('Failed to move');
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    }
  };

  const openMoveModal = (entry: FileEntry) => {
    setMovingEntry(entry);
    // Default dest is current path (which is silly as it's already there)
    // Maybe default to parent? Or empty?
    // Let's default to empty string (root) if at root, or parent if deeper?
    // Actually, user wants to move TO somewhere.
    setMoveDest(''); 
  };

  const submitMove = async () => {
    if (!movingEntry) return;
    
    // Normalize dest path (remove trailing slash)
    const destFolder = moveDest.trim().replace(/\/$/, '');
    
    const success = await handleMove(movingEntry.path, destFolder);
    if (success) {
      setSuccess(`Moved to ${destFolder || 'root'}`);
      setMovingEntry(null);
      loadDirectory(currentPath);
      onFileChange?.();
    } else {
      setError('Failed to move');
    }
  };

  // --- Drag & Drop ---

  const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(entry));
    setIsDraggingInternal(true);
  };

  const handleDragOver = (e: React.DragEvent, entryOrPath: FileEntry | string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDraggingInternal) {
      const path = typeof entryOrPath === 'string' ? entryOrPath : entryOrPath.path;
      setDragOverPath(path);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    setIsDraggingInternal(false);

    // Handle internal move
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const entry = JSON.parse(jsonData) as FileEntry;
        if (entry.path === targetPath) return; // Can't drop on self
        
        const success = await handleMove(entry.path, targetPath);
        if (success) {
          setSuccess(`Moved ${entry.name} to ${targetPath || 'root'}`);
          loadDirectory(currentPath);
          onFileChange?.();
        } else {
          setError('Failed to move file');
        }
      } catch (e) {
        console.error('Invalid drag data', e);
      }
      return;
    }

    // Handle external upload
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFilesToPath(files, targetPath);
    }
  };

  const uploadFilesToPath = async (files: FileList, targetPath: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));

      const uploadRes = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const upload_id = uploadData[0].upload_id;

      const addRes = await fetch(`/api/admin/drafts/${draftId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ upload_id, target_path: targetPath || undefined }),
      });
      if (!addRes.ok) throw new Error('Failed to add files');

      setSuccess(`Uploaded ${files.length} files`);
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // --- Creation ---

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const path = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
      const res = await fetch(`/api/admin/drafts/${draftId}/create-dir`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error('Failed to create folder');
      setSuccess(`Created folder ${newFolderName}`);
      setCreatingFolder(false);
      setNewFolderName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    try {
      const path = currentPath ? `${currentPath}/${newFileName}` : newFileName;
      const res = await fetch(`/api/admin/drafts/${draftId}/write-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, content: '' }),
      });
      if (!res.ok) throw new Error('Failed to create file');
      setSuccess(`Created file ${newFileName}`);
      setCreatingFile(false);
      setNewFileName('');
      loadDirectory(currentPath);
      onFileChange?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border flex flex-col h-[700px] shadow-sm">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col gap-4 bg-muted/30">
        <div className="flex justify-between items-center">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm overflow-hidden">
            <button
              onClick={() => setCurrentPath('')}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(''); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(null); }}
              onDrop={(e) => handleDrop(e, '')}
              className={`p-1.5 rounded hover:bg-primary/10 transition-colors ${!currentPath ? 'text-primary font-bold' : 'text-muted-foreground'} ${dragOverPath === '' ? 'bg-primary/20 ring-2 ring-primary' : ''}`}
              title="Root directory - drop files here to move to root"
            >
              <Folder size={18} />
            </button>
            {currentPath.split('/').filter(Boolean).map((part, idx, arr) => {
              const pathForThisLevel = arr.slice(0, idx + 1).join('/');
              return (
                <div key={idx} className="flex items-center">
                  <ChevronRight size={14} className="text-muted-foreground mx-1" />
                  <button
                    onClick={() => setCurrentPath(pathForThisLevel)}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(pathForThisLevel); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(null); }}
                    onDrop={(e) => handleDrop(e, pathForThisLevel)}
                    className={`hover:text-primary hover:underline transition-colors px-2 py-1 rounded ${dragOverPath === pathForThisLevel ? 'bg-primary/20 ring-2 ring-primary' : ''}`}
                    title={`Drop files here to move to ${pathForThisLevel}`}
                  >
                    {part}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {selectedPaths.size > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors text-sm font-medium"
              >
                <Trash2 size={16} /> Delete ({selectedPaths.size})
              </motion.button>
            )}
            
            <div className="h-6 w-px bg-border mx-2" />

            <button
              onClick={() => setCreatingFolder(true)}
              className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors"
              title="New Folder"
            >
              <FolderPlus size={20} />
            </button>
            <button
              onClick={() => setCreatingFile(true)}
              className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors"
              title="New File"
            >
              <FilePlus size={20} />
            </button>
            <label className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors cursor-pointer" title="Upload Files">
              <UploadCloud size={20} />
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadFilesToPath(e.target.files, currentPath)}
              />
            </label>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Creation Inputs */}
      <AnimatePresence>
        {(creatingFolder || creatingFile) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border bg-muted/50 overflow-hidden"
          >
            <div className="p-4 flex items-center gap-2">
              {creatingFolder ? <Folder size={20} className="text-warning" /> : <FileText size={20} className="text-primary" />}
              <input
                type="text"
                value={creatingFolder ? newFolderName : newFileName}
                onChange={(e) => creatingFolder ? setNewFolderName(e.target.value) : setNewFileName(e.target.value)}
                placeholder={creatingFolder ? "Folder Name" : "File Name"}
                className="flex-1 bg-background border border-input rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') creatingFolder ? handleCreateFolder() : handleCreateFile();
                  if (e.key === 'Escape') {
                    setCreatingFolder(false);
                    setCreatingFile(false);
                  }
                }}
              />
              <button
                onClick={() => creatingFolder ? handleCreateFolder() : handleCreateFile()}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium"
              >
                Create
              </button>
              <button
                onClick={() => { setCreatingFolder(false); setCreatingFile(false); }}
                className="px-3 py-1.5 bg-muted text-muted-foreground hover:bg-muted/80 rounded text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-destructive/10 text-destructive px-4 py-2 text-sm flex justify-between items-center border-b border-destructive/20"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-success/10 text-success px-4 py-2 text-sm flex justify-between items-center border-b border-success/20"
          >
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Table Header */}
      <div className="flex items-center px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-10 flex justify-center">
          <div onClick={handleSelectAll} className="cursor-pointer hover:text-foreground">
            {selectedPaths.size > 0 && selectedPaths.size === filteredEntries.length ? (
              <CheckSquare size={18} className="text-primary" />
            ) : (
              <Square size={18} />
            )}
          </div>
        </div>
        <div className="flex-1">Name</div>
        <div className="w-24 text-right hidden sm:block">Size</div>
        <div className="w-40 text-right px-4 hidden md:block">Modified</div>
        <div className="w-28 text-right">Actions</div>
      </div>

      {/* File List */}
      <div 
        className="flex-1 overflow-auto relative" 
        ref={parentRef}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingInternal) setDragOverPath(currentPath);
        }}
        onDrop={(e) => handleDrop(e, currentPath)}
      >
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="animate-spin mr-2"><UploadCloud size={20} /></div> Loading...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
            <Folder size={48} className="mb-2" />
            <p>Empty directory</p>
          </div>
        ) : (
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
                  <FileEntryRow
                    entry={entry}
                    isSelected={selectedPaths.has(entry.path)}
                    onSelect={handleSelect}
                    onOpen={handleOpen}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onMove={openMoveModal}
                    onPreview={(e) => setPreviewFile({ path: e.path, name: e.name })}
                    onDragStart={handleDragStart}
                    onDragOver={(e, entry) => handleDragOver(e, entry)}
                    onDragLeave={() => setDragOverPath(null)}
                    onDrop={(e, entry) => handleDrop(e, typeof entry === 'string' ? entry : entry.path)}
                    isDragOver={dragOverPath === entry.path}
                  />
                </div>
              );
            })}
          </div>
        )}
        
        {/* Drop Zone Overlay */}
        {dragOverPath === currentPath && !isDraggingInternal && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary m-4 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="text-primary font-medium flex flex-col items-center">
              <UploadCloud size={48} className="mb-2" />
              Drop files to upload
            </div>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <AnimatePresence>
        {renamingEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md border border-border"
            >
              <h3 className="text-lg font-bold mb-4">Rename {renamingEntry.is_dir ? 'Folder' : 'File'}</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-background border border-input rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') setRenamingEntry(null);
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRenamingEntry(null)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRename}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Rename
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move Modal */}
      <AnimatePresence>
        {movingEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md border border-border"
            >
              <h3 className="text-lg font-bold mb-4">Move {movingEntry.is_dir ? 'Folder' : 'File'}</h3>
              <p className="text-sm text-muted-foreground mb-2">Current path: {movingEntry.path}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Destination Folder</label>
                <input
                  type="text"
                  value={moveDest}
                  onChange={(e) => setMoveDest(e.target.value)}
                  placeholder="e.g. mods/ or leave empty for root"
                  className="w-full bg-background border border-input rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitMove();
                    if (e.key === 'Escape') setMovingEntry(null);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the folder path to move to.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setMovingEntry(null)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMove}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Move
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editor Modal */}
      <AnimatePresence>
        {editingFile && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-5xl h-[85vh] flex flex-col rounded-lg shadow-2xl border border-border"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="font-mono text-sm">{editingFile.path}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveFile}
                    disabled={savingFile}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save size={16} /> {savingFile ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingFile(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
                  >
                    <X size={16} /> Close
                  </button>
                </div>
              </div>
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className="flex-1 p-4 bg-background font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
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

export default memo(FileBrowser);
