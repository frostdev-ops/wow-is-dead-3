import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Folder, File } from 'lucide-react';
import type { FileUploadZoneProps } from '../../types/upload';
import { cn } from '@/lib/utils';

export default function FileUploadZone({
  onFilesSelected,
  disabled = false,
  accept,
  multiple = true,
  webkitdirectory = false,
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-all duration-200",
        dragActive
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDrop={handleDrop}
      onDragOver={handleDrag}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
    >
      <input
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={handleFileSelect}
        id="file-input"
        accept={accept}
        disabled={disabled}
        {...(webkitdirectory ? { webkitdirectory: '' } : {})}
      />
      <label
        htmlFor="file-input"
        className={cn(
          "flex flex-col items-center justify-center p-12 cursor-pointer",
          disabled && "cursor-not-allowed"
        )}
      >
        <AnimatePresence mode="wait">
          {dragActive ? (
            <motion.div
              key="drag-active"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="rounded-full bg-primary/10 p-6">
                <Upload className="h-12 w-12 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Drop files here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Release to upload
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="drag-inactive"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="rounded-full bg-muted p-6">
                {webkitdirectory ? (
                  <Folder className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <File className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {webkitdirectory ? 'Select a folder' : 'Upload files'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {webkitdirectory
                    ? 'Select a folder to upload all modpack files'
                    : 'Upload your modpack files'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>
    </motion.div>
  );
}
