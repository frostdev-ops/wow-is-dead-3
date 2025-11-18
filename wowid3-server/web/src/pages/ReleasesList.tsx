import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDrafts } from '../hooks/useDrafts';
import { Plus, Edit, Trash2, Package, Clock, FileText, Sparkles, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';

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
    <div
      className="group bg-white/80 backdrop-blur-sm rounded-xl shadow-md hover:shadow-xl border border-gray-100 hover:border-blue-200 transition-all duration-300 overflow-hidden"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          {/* Left Content */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">
                {draft.version || 'Untitled Draft'}
              </h3>
              <span className="px-3 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 text-xs font-bold rounded-full shadow-sm">
                DRAFT
              </span>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {draft.minecraft_version && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  <span className="font-medium">Minecraft {draft.minecraft_version}</span>
                </div>
              )}
              {draft.fabric_loader && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
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
            <button
              onClick={() => onEdit(draft.id)}
              className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              title="Edit"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(draft.id, draft.version)}
              className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Completion</span>
            <span>{Math.min(100, (draft.files.length > 0 ? 33 : 0) + (draft.version ? 33 : 0) + (draft.changelog ? 34 : 0))}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (draft.files.length > 0 ? 33 : 0) + (draft.version ? 33 : 0) + (draft.changelog ? 34 : 0))}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
});

DraftCard.displayName = 'DraftCard';

function ReleasesList() {
  const navigate = useNavigate();
  const { drafts, listDrafts, createDraft, deleteDraft, loading } = useDrafts();
  const [filter, setFilter] = useState<'all' | 'drafts'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Performance: Debounce search input (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    listDrafts();
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

  const handleDelete = useCallback(async (id: string, version: string) => {
    if (confirm(`Delete draft ${version || 'Untitled Draft'}?`)) {
      await deleteDraft(id);
      listDrafts();
    }
  }, [deleteDraft, listDrafts]);

  // Performance: Filter and search drafts with useMemo
  const filteredDrafts = useMemo(() => {
    let result = filter === 'drafts' ? drafts : drafts;

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(draft =>
        (draft.version && draft.version.toLowerCase().includes(query)) ||
        (draft.minecraft_version && draft.minecraft_version.toLowerCase().includes(query)) ||
        (draft.fabric_loader && draft.fabric_loader.toLowerCase().includes(query))
      );
    }

    return result;
  }, [drafts, filter, debouncedSearchQuery]);

  // Performance: Virtual scrolling for large lists
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredDrafts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height of each draft card
    overscan: 3, // Render 3 extra items for smooth scrolling
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Animated Header */}
        <div className="mb-8 animate-[slideDown_0.5s_ease-out]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Releases
                  </h1>
                  <p className="text-gray-600 mt-1">Manage modpack releases and drafts</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative flex items-center gap-2">
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create New Release
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Filter Pills and Search */}
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  filter === 'all'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                All Releases
              </button>
              <button
                onClick={() => setFilter('drafts')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  filter === 'drafts'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-white/50 text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                Drafts Only
              </button>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by version, Minecraft, or Fabric..."
                className="w-full pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-600 font-medium">Loading releases...</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          /* Empty State */
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No releases yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first release to start managing modpack versions with the intelligent release wizard.
            </p>
            <button
              onClick={handleCreateNew}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Your First Release
            </button>
          </div>
        ) : (
          /* Drafts Grid - Performance: Virtualized for smooth scrolling */
          <div
            ref={parentRef}
            className="animate-[fadeIn_0.5s_ease-out]"
            style={{ height: '70vh', overflow: 'auto' }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const draft = filteredDrafts[virtualItem.index];
                return (
                  <div
                    key={draft.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                      padding: '8px 0',
                    }}
                  >
                    <DraftCard
                      draft={draft}
                      index={virtualItem.index}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// Performance: Export memoized version
export default memo(ReleasesList);
