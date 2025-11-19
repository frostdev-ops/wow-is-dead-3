import React, { useState, useCallback, memo, useEffect } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Eye, Code, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DraftRelease } from '../../types/releases';

interface ChangelogTabProps {
  draft: DraftRelease;
  onUpdate: (draft: DraftRelease) => void;
}

function ChangelogTab({ draft, onUpdate }: ChangelogTabProps) {
  const { generateChangelog, loading, error } = useDrafts();
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Clear local error when hook error changes
  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  // Performance: Memoize callbacks to prevent re-renders
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onUpdate({ ...draft, changelog: value });
    }
  }, [draft, onUpdate]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setLocalError(null);
    try {
      const result = await generateChangelog(draft.id);
      if (result) {
        // Use the markdown field directly from the backend
        onUpdate({ ...draft, changelog: result.markdown });
      } else {
        setLocalError('Failed to generate changelog. Please try again.');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Failed to generate changelog');
    } finally {
      setGenerating(false);
    }
  }, [draft.id, generateChangelog, draft, onUpdate]);

  return (
    <div className="h-full flex flex-col">
      {/* Error Message */}
      <AnimatePresence>
        {localError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-destructive/10 text-destructive px-6 py-3 border-b border-destructive/20 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span className="text-sm">{localError}</span>
            </div>
            <button
              onClick={() => setLocalError(null)}
              className="p-1 hover:bg-destructive/20 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating || loading || draft.files.length === 0}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Changelog'}
          </button>
          <p className="text-sm text-muted-foreground">
            Auto-generate from file changes or write your own
          </p>
        </div>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent flex items-center gap-2 transition-colors"
        >
          {showPreview ? (
            <>
              <Code className="w-4 h-4" />
              Edit Only
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Show Preview
            </>
          )}
        </button>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Monaco Editor */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} border-r border-border`}>
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={draft.changelog}
            onChange={handleEditorChange}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-1/2 overflow-auto bg-card">
            <div className="p-6">
              <div className="prose prose-sm max-w-none">
                {draft.changelog ? (
                  <ReactMarkdown>{draft.changelog}</ReactMarkdown>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Preview will appear here</p>
                    <p className="text-sm mt-2">Start writing or generate a changelog</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help text */}
      {!draft.changelog && (
        <div className="bg-muted/30 border-t border-border px-6 py-3 text-sm">
          <p>
            <strong>Tip:</strong> Use the "Generate Changelog" button to automatically create a changelog
            from your file changes, or write your own using Markdown formatting.
          </p>
        </div>
      )}
    </div>
  );
}

// Performance: Export memoized version
export default memo(ChangelogTab);
