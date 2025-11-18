import type { UploadProgressDisplayProps } from '../../types/upload';

export default function UploadProgress({
  files,
  totalProgress,
  onCancel,
}: UploadProgressDisplayProps) {
  if (files.length === 0) return null;

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;

  return (
    <div className="card" style={{ marginTop: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <h3 style={{ margin: 0 }}>
            Upload Progress ({completedCount}/{files.length})
          </h3>
          {onCancel && uploadingCount > 0 && (
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>

        {totalProgress !== undefined && (
          <div style={{ marginTop: '12px' }}>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${totalProgress}%`,
                  height: '100%',
                  backgroundColor: '#007bff',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {totalProgress}% complete
            </p>
          </div>
        )}
      </div>

      <div className="file-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {files.map((file, idx) => (
          <div
            key={idx}
            className="file-item"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px',
              borderBottom: '1px solid #eee',
            }}
          >
            <div style={{ flex: 1 }}>
              <span>{file.fileName}</span>
              <span className="file-size" style={{ marginLeft: '8px', color: '#666' }}>
                ({(file.fileSize / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {file.status === 'completed' && (
                <span style={{ color: '#28a745' }}>✓ Completed</span>
              )}
              {file.status === 'uploading' && (
                <span style={{ color: '#007bff' }}>{file.progress}%</span>
              )}
              {file.status === 'error' && (
                <span style={{ color: '#dc3545' }}>✗ Error</span>
              )}
              {file.status === 'pending' && <span style={{ color: '#999' }}>Pending</span>}
            </div>
          </div>
        ))}
      </div>

      {errorCount > 0 && (
        <div className="alert alert-error" style={{ marginTop: '16px' }}>
          {errorCount} file(s) failed to upload
        </div>
      )}
    </div>
  );
}
