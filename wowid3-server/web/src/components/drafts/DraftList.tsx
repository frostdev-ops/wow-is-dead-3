import { useEffect } from 'react';
import { Package } from 'lucide-react';
import { useDraftOperations } from '../../hooks/useDraftOperations';
import DraftCard from './DraftCard';
import type { DraftListProps } from '../../types/draft';

export default function DraftList({ filter = 'all', onCreateDraft, onEditDraft }: DraftListProps) {
  const {
    drafts,
    loading,
    error,
    listDrafts,
    createDraft,
    deleteDraft,
    duplicateDraft,
  } = useDraftOperations();

  useEffect(() => {
    listDrafts();
  }, [filter]);

  const handleCreateDraft = async () => {
    await createDraft();
    if (onCreateDraft) {
      onCreateDraft();
    }
  };

  const handleEditDraft = (id: string) => {
    if (onEditDraft) {
      onEditDraft(id);
    }
  };

  const handleDuplicateDraft = async (id: string) => {
    const newDraft = await duplicateDraft(id);
    if (newDraft) {
      // Success message handled by hook
    }
  };

  const handleDeleteDraft = async (id: string, version: string) => {
    if (confirm(`Delete draft ${version || 'Untitled Draft'}?`)) {
      await deleteDraft(id);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>Drafts ({drafts.length})</h2>
        <button className="btn-primary" onClick={handleCreateDraft} disabled={loading}>
          {loading ? 'Creating...' : '+ Create New Draft'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading && drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>Loading drafts...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <Package style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
          <p style={{ fontSize: '16px', marginBottom: '16px' }}>No drafts yet</p>
          <button className="btn-primary" onClick={handleCreateDraft}>
            Create Your First Draft
          </button>
        </div>
      ) : (
        <div>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              id={draft.id}
              version={draft.version}
              minecraft_version={draft.minecraft_version}
              fabric_loader={draft.fabric_loader}
              files={draft.files}
              updated_at={draft.updated_at}
              onEdit={handleEditDraft}
              onDuplicate={handleDuplicateDraft}
              onDelete={handleDeleteDraft}
              isLoading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
