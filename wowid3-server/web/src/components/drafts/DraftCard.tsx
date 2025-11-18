import { Edit, Copy, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DraftCardProps } from '../../types/draft';

export default function DraftCard({
  id,
  version,
  minecraft_version,
  fabric_loader,
  files,
  updated_at,
  onEdit,
  onDuplicate,
  onDelete,
  isLoading = false,
}: DraftCardProps) {
  return (
    <div
      style={{
        padding: '16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
          {version || 'Untitled Draft'}
        </h3>
        <div style={{ fontSize: '12px', color: '#999', display: 'flex', gap: '16px' }}>
          {minecraft_version && <span>Minecraft {minecraft_version}</span>}
          {fabric_loader && <span>Fabric {fabric_loader}</span>}
          <span>{files.length} files</span>
          <span>Updated {formatDistanceToNow(new Date(updated_at), { addSuffix: true })}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => onEdit(id)}
          disabled={isLoading}
        >
          <Edit style={{ width: '16px', height: '16px', marginRight: '4px' }} /> Edit
        </button>
        <button
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', background: '#6366f1', color: '#fff' }}
          onClick={() => onDuplicate(id, version)}
          disabled={isLoading}
        >
          <Copy style={{ width: '16px', height: '16px', marginRight: '4px' }} /> Duplicate
        </button>
        <button
          className="btn-danger"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => onDelete(id, version)}
          disabled={isLoading}
        >
          <Trash2 style={{ width: '16px', height: '16px', marginRight: '4px' }} /> Delete
        </button>
      </div>
    </div>
  );
}
