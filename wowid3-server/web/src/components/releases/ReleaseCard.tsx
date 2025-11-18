import { Copy } from 'lucide-react';
import type { ReleaseCardProps } from '../../types/release';

export default function ReleaseCard({
  release,
  onDelete,
  onCopyToDraft,
  isLoading = false,
}: ReleaseCardProps) {
  return (
    <tr>
      <td>
        <span className="badge badge-success">{release.version}</span>
      </td>
      <td>{release.minecraft_version}</td>
      <td>{release.file_count}</td>
      <td>{(release.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
      <td>{new Date(release.created_at).toLocaleDateString()}</td>
      <td>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: '#6366f1',
              color: '#fff',
            }}
            onClick={() => onCopyToDraft(release.version)}
            disabled={isLoading}
          >
            <Copy
              style={{
                width: '14px',
                height: '14px',
                marginRight: '4px',
                display: 'inline',
              }}
            />
            Copy to Draft
          </button>
          <button
            className="btn-danger"
            onClick={() => onDelete(release.version)}
            disabled={isLoading}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
