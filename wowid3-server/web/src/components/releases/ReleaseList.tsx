import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  useReleasesQuery,
  useDeleteReleaseMutation,
  useCopyReleaseToDraftMutation,
} from '../../hooks/queries';
import { useDraftsQuery, useDeleteDraftMutation } from '../../hooks/queries';
import ReleaseCard from './ReleaseCard';
import ReleaseRowSkeleton from './ReleaseRowSkeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReleaseListProps } from '../../types/release';
import { containerVariants, itemVariants } from '@/components/PageTransition';

export default function ReleaseList({ showActions = true }: ReleaseListProps) {
  const [filter, setFilter] = useState<'all' | 'published' | 'drafts'>('all');

  const releasesQuery = useReleasesQuery();
  const draftsQuery = useDraftsQuery();
  const deleteReleaseMutation = useDeleteReleaseMutation();
  const deleteDraftMutation = useDeleteDraftMutation();
  const copyReleaseMutation = useCopyReleaseToDraftMutation();

  const releases = releasesQuery.data || [];
  const drafts = draftsQuery.data || [];
  const loading = releasesQuery.isLoading || draftsQuery.isLoading;
  const error = releasesQuery.error?.message || draftsQuery.error?.message;

  const handleDeleteRelease = async (version: string) => {
    if (confirm(`Are you sure you want to delete release ${version}?`)) {
      deleteReleaseMutation.mutate(version);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (confirm(`Are you sure you want to delete this draft?`)) {
      deleteDraftMutation.mutate(id);
    }
  };

  const handleCopyReleaseToDraft = async (version: string) => {
    copyReleaseMutation.mutate(version, {
      onSuccess: () => {
        // You might want to navigate to the draft editor here
        // or show a success message
      },
    });
  };

  // Combine and filter items
  type ListItem = { type: 'draft'; data: any } | { type: 'release'; data: any };
  const allItems: ListItem[] = [];

  if (filter === 'all' || filter === 'published') {
    allItems.push(...releases.map(r => ({ type: 'release' as const, data: r })));
  }
  if (filter === 'all' || filter === 'drafts') {
    allItems.push(...drafts.map(d => ({ type: 'draft' as const, data: d })));
  }

  // Sort by date
  allItems.sort((a, b) => {
    const dateA = a.type === 'draft' ? new Date(a.data.updated_at) : new Date(a.data.created_at);
    const dateB = b.type === 'draft' ? new Date(b.data.updated_at) : new Date(b.data.created_at);
    return dateB.getTime() - dateA.getTime();
  });

  if (loading && allItems.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Version</th>
                <th className="text-left py-3 px-4">Minecraft</th>
                <th className="text-left py-3 px-4">Files</th>
                <th className="text-left py-3 px-4">Size</th>
                <th className="text-left py-3 px-4">Created</th>
                {showActions && <th className="text-left py-3 px-4">Action</th>}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <ReleaseRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
      >
        {error}
      </motion.div>
    );
  }

  if (allItems.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-8"
          >
            {filter === 'published' ? 'No published releases yet.' : filter === 'drafts' ? 'No drafts yet.' : 'No releases or drafts yet.'}
          </motion.p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
        >
          All ({releases.length + drafts.length})
        </Button>
        <Button
          onClick={() => setFilter('published')}
          variant={filter === 'published' ? 'default' : 'outline'}
          size="sm"
        >
          Published ({releases.length})
        </Button>
        <Button
          onClick={() => setFilter('drafts')}
          variant={filter === 'drafts' ? 'default' : 'outline'}
          size="sm"
        >
          Drafts ({drafts.length})
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-sm">Version</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Minecraft</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Files</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Size</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Created</th>
                  {showActions && <th className="text-left py-3 px-4 font-semibold text-sm">Action</th>}
                </tr>
              </thead>
              <motion.tbody
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {allItems.map((item) => {
                  if (item.type === 'release') {
                    return (
                      <motion.tr key={`release-${item.data.version}`} variants={itemVariants}>
                        <ReleaseCard
                          release={item.data}
                          onDelete={handleDeleteRelease}
                          onCopyToDraft={handleCopyReleaseToDraft}
                          isLoading={loading}
                        />
                      </motion.tr>
                    );
                  } else {
                    // Draft row
                    return (
                      <motion.tr key={`draft-${item.data.id}`} variants={itemVariants}>
                        <td className="py-3 px-4">{item.data.version || 'Untitled'}</td>
                        <td className="py-3 px-4">
                          <Badge variant="warning">DRAFT</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.data.minecraft_version || '-'}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.data.files?.length || 0}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">-</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(item.data.updated_at).toLocaleDateString()}
                        </td>
                        {showActions && (
                          <td className="py-3 px-4">
                            <Button
                              onClick={() => handleDeleteDraft(item.data.id)}
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                            >
                              Delete
                            </Button>
                          </td>
                        )}
                      </motion.tr>
                    );
                  }
                })}
              </motion.tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
