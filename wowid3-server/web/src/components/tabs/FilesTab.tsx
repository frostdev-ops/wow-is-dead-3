import React, { useCallback, memo } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import FileBrowser from '../FileBrowser';
import type { DraftRelease } from '../../types/releases';

interface FilesTabProps {
  draft: DraftRelease;
  onUpdate: (draft: DraftRelease) => void;
}

function FilesTab({ draft, onUpdate }: FilesTabProps) {
  const { getDraft } = useDrafts();

  const handleFileChange = useCallback(async () => {
    // Refresh the draft to get updated file list/counts
    const updatedDraft = await getDraft(draft.id);
    if (updatedDraft) {
      onUpdate(updatedDraft);
    }
  }, [draft.id, getDraft, onUpdate]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-card rounded-lg shadow border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            Files ({draft.files.length})
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage files for this release. You can upload, move, rename, and edit files.
          </p>
        </div>

        <div className="p-0">
          <FileBrowser
            draftId={draft.id}
            onFileChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(FilesTab);
