import React, { useState, useCallback, memo } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Eye, Code } from 'lucide-react';
import type { DraftRelease } from '../../types/releases';

interface ChangelogTabProps {
  draft: DraftRelease;
  onUpdate: (draft: DraftRelease) => void;
}

function ChangelogTab({ draft, onUpdate }: ChangelogTabProps) {
  const { generateChangelog, loading } = useDrafts();
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Performance: Memoize callbacks to prevent re-renders
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onUpdate({ ...draft, changelog: value });
    }
  }, [draft, onUpdate]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const result = await generateChangelog(draft.id);
      if (result) {
        // Combine generated sections into markdown
        const sections = [];

        if (result.added.length > 0) {
          sections.push('## Added\n' + result.added.map((f) => `- ${f}`).join('\n'));
        }
        if (result.modified.length > 0) {
          sections.push('## Modified\n' + result.modified.map((f) => `- ${f}`).join('\n'));
        }
        if (result.removed.length > 0) {
          sections.push('## Removed\n' + result.removed.map((f) => `- ${f}`).join('\n'));
        }

        const generatedChangelog = sections.join('\n\n');
        onUpdate({ ...draft, changelog: generatedChangelog });
      }
    } finally {
      setGenerating(false);
    }
  }, [draft.id, generateChangelog, draft, onUpdate]);

  return (
    <div className="h-full flex flex-col">
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
