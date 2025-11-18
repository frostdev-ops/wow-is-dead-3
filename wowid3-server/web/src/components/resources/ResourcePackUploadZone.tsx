import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResourcePackUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export default function ResourcePackUploadZone({
  onFilesSelected,
  disabled = false,
  isLoading = false,
}: ResourcePackUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isLoading) return;

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    setSelectedFiles(files);
    onFilesSelected(files);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    onFilesSelected([]);
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-12 transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background',
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          disabled={disabled || isLoading}
          className="hidden"
          accept="*/*"
        />

        <div className="flex flex-col items-center justify-center gap-4">
          <div className="bg-primary/10 rounded-lg p-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">Drag & drop resource packs here</p>
            <p className="text-sm text-muted-foreground">or click the button below</p>
          </div>
          <Button
            onClick={handleClickUpload}
            disabled={disabled || isLoading}
            variant="outline"
          >
            {isLoading ? 'Uploading...' : 'Select Files'}
          </Button>
        </div>
      </Card>

      {selectedFiles.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Selected Files ({selectedFiles.length})</h3>
            <Button
              onClick={handleClearAll}
              variant="ghost"
              size="sm"
              disabled={isLoading}
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  disabled={isLoading}
                  className="ml-4 p-2 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
