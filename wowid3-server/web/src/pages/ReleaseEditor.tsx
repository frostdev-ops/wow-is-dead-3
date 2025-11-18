import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="relative mb-4">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-600 font-medium">Loading release...</p>
      </div>
    );
  }

  const hasErrors = Object.values(editorState.validationErrors).some(
    (errors) => errors.length > 0
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/releases')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                title="Back to releases"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {currentDraft.version || 'New Release'}
                </h1>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">DRAFT</span>
                  <span>•</span>
                  <span>Created {formatDistanceToNow(new Date(currentDraft.created_at), { addSuffix: true })}</span>
                </p>
              </div>
            </div>

            {/* Auto-save status */}
            <div className="flex items-center gap-3">
              {editorState.hasUnsavedChanges ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">Saving...</span>
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                  </span>
                </div>
              ) : null}

              {hasErrors && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg">
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
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`group relative px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                      : 'bg-white/60 text-gray-600 hover:bg-white hover:shadow-md'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  {tabErrors.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                      {tabErrors.length}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <div className="animate-[fadeIn_0.3s_ease-out]">
          {renderTab()}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
