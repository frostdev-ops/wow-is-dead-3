import { useState } from 'react';
import type { FileUploadZoneProps } from '../../types/upload';

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
    <div className="card">
      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDrag}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        style={{
          borderColor: dragActive ? '#007bff' : undefined,
          backgroundColor: dragActive ? '#f0f8ff' : undefined,
        }}
      >
        <input
          type="file"
          multiple={multiple}
          hidden
          onChange={handleFileSelect}
          id="file-input"
          accept={accept}
          disabled={disabled}
          {...(webkitdirectory ? { webkitdirectory: '' } : {})}
        />
        <label
          htmlFor="file-input"
          className="upload-label"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <div className="upload-icon">📁</div>
          <div className="upload-text">
            {dragActive ? 'Drop files here' : 'Drag files here or click to select'}
          </div>
          <div className="upload-hint">
            {webkitdirectory
              ? 'Select a folder to upload all modpack files'
              : 'Upload modpack files'}
          </div>
        </label>
      </div>
    </div>
  );
}
