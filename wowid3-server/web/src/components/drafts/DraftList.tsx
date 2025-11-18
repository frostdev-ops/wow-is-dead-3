import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  useDraftsQuery,
  useCreateDraftMutation,
  useDeleteDraftMutation,
  useDuplicateDraftMutation,
} from '../../hooks/queries';
import DraftCard from './DraftCard';
import DraftCardSkeleton from './DraftCardSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DraftListProps } from '../../types/draft';

export default function DraftList({ filter = 'all', onCreateDraft, onEditDraft }: DraftListProps) {
  const draftsQuery = useDraftsQuery();
  const createDraftMutation = useCreateDraftMutation();
  const deleteDraftMutation = useDeleteDraftMutation();
  const duplicateDraftMutation = useDuplicateDraftMutation();

  const drafts = draftsQuery.data || [];
  const loading = draftsQuery.isLoading || createDraftMutation.isPending;
  const error = draftsQuery.error?.message;

  const handleCreateDraft = async () => {
    createDraftMutation.mutate(
      {},
      {
        onSuccess: () => {
          if (onCreateDraft) {
            onCreateDraft();
          }
        },
      }
    );
  };

  const handleEditDraft = (id: string) => {
    if (onEditDraft) {
      onEditDraft(id);
    }
  };

  const handleDuplicateDraft = async (id: string) => {
    duplicateDraftMutation.mutate(id);
  };

  const handleDeleteDraft = async (id: string, version: string) => {
    if (confirm(`Delete draft ${version || 'Untitled Draft'}?`)) {
      deleteDraftMutation.mutate(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Drafts ({drafts.length})</CardTitle>
          <Button onClick={handleCreateDraft} disabled={loading}>
            {loading ? 'Creating...' : '+ Create New Draft'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
          >
            {error}
          </motion.div>
        )}

        {loading && drafts.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <DraftCardSkeleton key={i} />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <Package className="w-12 h-12 mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-4 text-muted-foreground">No drafts yet</p>
            <Button onClick={handleCreateDraft}>
              Create Your First Draft
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {drafts.map((draft, index) => (
              <motion.div
                key={draft.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <DraftCard
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
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
