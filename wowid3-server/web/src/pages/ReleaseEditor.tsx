import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrafts } from '../hooks/useDrafts';
import { useReleaseStore } from '../stores/releaseStore';
import { Save, AlertCircle, ArrowLeft, FileText, Settings, BookOpen, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { TabType } from '../types/releases';

// Tab components
import FilesTab from '../components/tabs/FilesTab';
import MetadataTab from '../components/tabs/MetadataTab';
import ChangelogTab from '../components/tabs/ChangelogTab';
import ReviewTab from '../components/tabs/ReviewTab';

export default function ReleaseEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDraft, updateDraft, loading } = useDrafts();
  const {
    currentDraft,
    editorState,
    lastSaved,
    setCurrentDraft,
    setCurrentTab,
    scheduleAutoSave,
    resetEditor,
  } = useReleaseStore();

  // Load draft on mount
  useEffect(() => {
    if (id) {
      getDraft(id).then((draft) => {
        if (draft) {
          setCurrentDraft(draft);
        } else {
          navigate('/releases');
        }
      });
    }

    return () => {
      resetEditor();
    };
  }, [id]);

  // Auto-save when draft changes
  const handleDraftChange = (updatedDraft: typeof currentDraft) => {
    if (!updatedDraft || !id) return;

    setCurrentDraft(updatedDraft);
    scheduleAutoSave(async () => {
      await updateDraft(id, {
        version: updatedDraft.version,
        minecraft_version: updatedDraft.minecraft_version,
        fabric_loader: updatedDraft.fabric_loader,
        changelog: updatedDraft.changelog,
      });
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'files', label: 'Files', icon: <FileText className="w-4 h-4" /> },
    { id: 'metadata', label: 'Metadata', icon: <Settings className="w-4 h-4" /> },
    { id: 'changelog', label: 'Changelog', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'review', label: 'Review & Publish', icon: <CheckCircle className="w-4 h-4" /> },
  ];

  const renderTab = () => {
    if (!currentDraft) return null;

    switch (editorState.currentTab) {
      case 'files':
        return <FilesTab draft={currentDraft} onUpdate={handleDraftChange} />;
      case 'metadata':
        return <MetadataTab draft={currentDraft} onUpdate={handleDraftChange} />;
      case 'changelog':
        return <ChangelogTab draft={currentDraft} onUpdate={handleDraftChange} />;
      case 'review':
        return <ReviewTab draft={currentDraft} />;
      default:
        return null;
    }
  };

  if (loading || !currentDraft) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <div className="relative mb-4">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-foreground font-medium">Loading release...</p>
      </div>
    );
  }

  const hasErrors = Object.values(editorState.validationErrors).some(
    (errors) => errors.length > 0
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/releases')}
                className="p-2 hover:bg-accent rounded-lg transition-colors duration-200"
                title="Back to releases"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {currentDraft.version || 'New Release'}
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs font-medium rounded">DRAFT</span>
                  <span>•</span>
                  <span>Created {formatDistanceToNow(new Date(currentDraft.created_at), { addSuffix: true })}</span>
                </p>
              </div>
            </div>

            {/* Auto-save status */}
            <div className="flex items-center gap-3">
              {editorState.hasUnsavedChanges ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/20 text-warning rounded-lg">
                  <div className="w-2 h-2 bg-warning rounded-full animate-pulse"></div>
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">Saving...</span>
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-success/20 text-success rounded-lg">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                  </span>
                </div>
              ) : null}

              {hasErrors && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/20 text-destructive rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Validation errors</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const tabErrors = editorState.validationErrors[tab.id] || [];
              const isActive = editorState.currentTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  whileHover={!isActive ? { scale: 1.02, y: -1, backgroundColor: 'var(--accent)' } : {}}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  transition={{ duration: 0.15 }}
                  style={{ willChange: 'transform, background-color' }}
                >
                  <motion.span
                    className={isActive ? 'text-primary-foreground' : 'text-muted-foreground'}
                    animate={{
                      color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      scale: isActive ? 1.05 : 1
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    {tab.icon}
                  </motion.span>
                  <motion.span
                    animate={{
                      opacity: isActive ? 1 : 0.8
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    {tab.label}
                  </motion.span>
                  {tabErrors.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center shadow-lg"
                    >
                      {tabErrors.length}
                    </motion.span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/30 rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={editorState.currentTab}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ willChange: 'opacity, transform' }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
