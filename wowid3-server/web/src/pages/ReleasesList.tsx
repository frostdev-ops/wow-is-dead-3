import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrafts } from '../hooks/useDrafts';
import { useAdmin, Release } from '../hooks/useAdmin';
import { Plus, Edit, Trash2, Package, Clock, FileText, Sparkles, Search, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';
import { PageTransition, containerVariants, statsCardVariants } from '@/components/PageTransition';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Performance: Memoized DraftCard component to prevent unnecessary re-renders
const DraftCard = memo(({
  draft,
  index,
  onEdit,
  onDelete
}: {
  draft: any;
  index: number;
  onEdit: (id: string) => void;
  onDelete: (id: string, version: string) => void;
}) => {
  return (
    <motion.div
      variants={statsCardVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-6">
        <div className="flex items-start justify-between">
          {/* Left Content */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-bold">
                {draft.version || 'Untitled Draft'}
              </h3>
              <Badge variant="warning" className="shadow-sm">DRAFT</Badge>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {draft.minecraft_version && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  <span className="font-medium">Minecraft {draft.minecraft_version}</span>
                </div>
              )}
              {draft.fabric_loader && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
                  <span className="font-medium">Fabric {draft.fabric_loader}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>{draft.files.length} files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Updated {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              onClick={() => onEdit(draft.id)}
              variant="ghost"
              size="icon"
              title="Edit"
            >
              <Edit className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => onDelete(draft.id, draft.version)}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Completion</span>
            <span>{Math.min(100, (draft.files.length > 0 ? 33 : 0) + (draft.version ? 33 : 0) + (draft.changelog ? 34 : 0))}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (draft.files.length > 0 ? 33 : 0) + (draft.version ? 33 : 0) + (draft.changelog ? 34 : 0))}%` }}
            ></div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
});

DraftCard.displayName = 'DraftCard';

// Performance: Memoized ReleaseCard component for published releases
const ReleaseCard = memo(({
  release,
  index,
  onDelete
}: {
  release: Release;
  index: number;
  onDelete: (version: string) => void;
}) => {
  return (
    <motion.div
      variants={statsCardVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-6">
        <div className="flex items-start justify-between">
          {/* Left Content */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="text-xl font-bold">
                {release.version}
              </h3>
              <Badge variant="success" className="shadow-sm bg-green-500/10 text-green-500 border-green-500/20">
                PUBLISHED
              </Badge>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                <span className="font-medium">Minecraft {release.minecraft_version}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>{release.file_count} files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Published {formatDistanceToNow(new Date(release.created_at), { addSuffix: true })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                <span>{(release.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => onDelete(release.version)}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
});

ReleaseCard.displayName = 'ReleaseCard';

function ReleasesList() {
  const navigate = useNavigate();
  const { drafts, listDrafts, createDraft, deleteDraft, loading: draftsLoading } = useDrafts();
  const { listReleases, deleteRelease, loading: releasesLoading } = useAdmin();
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<'all' | 'drafts' | 'published'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Performance: Debounce search input (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const loading = draftsLoading || releasesLoading;

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        listDrafts(),
        listReleases().then(setReleases).catch(() => setReleases([]))
      ]);
    };
    fetchData();
  }, []);

  const handleCreateNew = async () => {
    setIsCreating(true);
    const draft = await createDraft({});
    if (draft) {
      navigate(`/releases/${draft.id}/edit`);
    }
    setIsCreating(false);
  };

  // Performance: Memoize callbacks to prevent re-renders
  const handleEdit = useCallback((id: string) => {
    navigate(`/releases/${id}/edit`);
  }, [navigate]);

  const handleDeleteDraft = useCallback(async (id: string, version: string) => {
    if (confirm(`Delete draft ${version || 'Untitled Draft'}?`)) {
      await deleteDraft(id);
      await listDrafts();
    }
  }, [deleteDraft, listDrafts]);

  const handleDeleteRelease = useCallback(async (version: string) => {
    if (confirm(`Delete published release ${version}?\n\nWARNING: Users may still be using this version. This action cannot be undone.`)) {
      await deleteRelease(version);
      const newReleases = await listReleases();
      setReleases(newReleases || []);
    }
  }, [deleteRelease, listReleases]);

  // Performance: Combine and filter drafts and releases with useMemo
  type ListItem = { type: 'draft'; data: any } | { type: 'release'; data: Release };

  const filteredItems = useMemo(() => {
    let items: ListItem[] = [];

    // Add drafts
    if (filter === 'all' || filter === 'drafts') {
      items = items.concat(drafts.map(draft => ({ type: 'draft' as const, data: draft })));
    }

    // Add releases
    if (filter === 'all' || filter === 'published') {
      items = items.concat(releases.map(release => ({ type: 'release' as const, data: release })));
    }

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      items = items.filter(item => {
        if (item.type === 'draft') {
          const draft = item.data;
          return (
            (draft.version && draft.version.toLowerCase().includes(query)) ||
            (draft.minecraft_version && draft.minecraft_version.toLowerCase().includes(query)) ||
            (draft.fabric_loader && draft.fabric_loader.toLowerCase().includes(query))
          );
        } else {
          const release = item.data;
          return (
            release.version.toLowerCase().includes(query) ||
            release.minecraft_version.toLowerCase().includes(query)
          );
        }
      });
    }

    // Sort by date (most recent first)
    items.sort((a, b) => {
      const dateA = a.type === 'draft' ? new Date(a.data.updated_at) : new Date(a.data.created_at);
      const dateB = b.type === 'draft' ? new Date(b.data.updated_at) : new Date(b.data.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    return items;
  }, [drafts, releases, filter, debouncedSearchQuery]);

  // Performance: Virtual scrolling for large lists
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height of each card
    overscan: 3, // Render 3 extra items for smooth scrolling
  });

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Animated Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary rounded-xl shadow-lg">
                  <Package className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">Releases</h1>
                  <p className="text-muted-foreground mt-1">Manage modpack releases and drafts</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreateNew}
              disabled={isCreating}
              size="lg"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create New Release
                </>
              )}
            </Button>
          </div>

          {/* Filter Pills and Search */}
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <Button
                onClick={() => setFilter('all')}
                variant={filter === 'all' ? 'default' : 'outline'}
              >
                All ({drafts.length + releases.length})
              </Button>
              <Button
                onClick={() => setFilter('published')}
                variant={filter === 'published' ? 'default' : 'outline'}
              >
                Published ({releases.length})
              </Button>
              <Button
                onClick={() => setFilter('drafts')}
                variant={filter === 'drafts' ? 'default' : 'outline'}
              >
                Drafts ({drafts.length})
              </Button>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by version, Minecraft, or Fabric..."
                className="w-full pl-10 pr-4 py-2 bg-card rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-muted-foreground font-medium">Loading releases...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-2">
              {filter === 'published' ? 'No published releases' : filter === 'drafts' ? 'No drafts' : 'No releases yet'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {filter === 'published'
                ? 'Publish a draft to create your first release.'
                : 'Create your first release to start managing modpack versions with the intelligent release wizard.'}
            </p>
            <Button onClick={handleCreateNew} size="lg">
              <Plus className="w-5 h-5" />
              Create New Draft
            </Button>
          </Card>
        ) : (
          /* Items Grid - Performance: Virtualized for smooth scrolling */
          <div
            ref={parentRef}
            style={{ height: '70vh', overflow: 'auto' }}
          >
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = filteredItems[virtualItem.index];
                return (
                  <div
                    key={item.type === 'draft' ? item.data.id : item.data.version}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                      padding: '8px 0',
                    }}
                  >
                    {item.type === 'draft' ? (
                      <DraftCard
                        draft={item.data}
                        index={virtualItem.index}
                        onEdit={handleEdit}
                        onDelete={handleDeleteDraft}
                      />
                    ) : (
                      <ReleaseCard
                        release={item.data}
                        index={virtualItem.index}
                        onDelete={handleDeleteRelease}
                      />
                    )}
                  </div>
                );
              })}
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// Performance: Export memoized version
export default memo(ReleasesList);
