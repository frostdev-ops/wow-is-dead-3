import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDrafts } from '../../hooks/useDrafts';
import { useReleaseStore } from '../../stores/releaseStore';
import ReactMarkdown from 'react-markdown';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  FileText,
  Package,
} from 'lucide-react';
import type { DraftRelease } from '../../types/releases';

interface ReviewTabProps {
  draft: DraftRelease;
}

export default function ReviewTab({ draft }: ReviewTabProps) {
  const navigate = useNavigate();
  const { publishDraft, loading } = useDrafts();
  const { addValidationError, clearValidationErrors } = useReleaseStore();
  const [publishing, setPublishing] = useState(false);

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!draft.version || draft.version.trim() === '') {
      errors.push('Version is required');
    }
    if (!draft.minecraft_version || draft.minecraft_version.trim() === '') {
      errors.push('Minecraft version is required');
    }
    if (!draft.fabric_loader || draft.fabric_loader.trim() === '') {
      errors.push('Fabric loader version is required');
    }

    // Files
    if (draft.files.length === 0) {
      errors.push('At least one file is required');
    }

    // Changelog
    if (!draft.changelog || draft.changelog.trim() === '') {
      warnings.push('Changelog is empty');
    }

    // Version format check
    const semverRegex = /^\d+\.\d+\.\d+/;
    if (draft.version && !semverRegex.test(draft.version)) {
      warnings.push('Version does not follow semantic versioning (e.g., 1.0.0)');
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }, [draft]);

  const handlePublish = async () => {
    // Update validation errors in store
    clearValidationErrors('review');
    validation.errors.forEach((error) => addValidationError('review', error));

    if (!validation.isValid) {
      return;
    }

    if (!confirm(`Publish release ${draft.version}? This action cannot be undone.`)) {
      return;
    }

    setPublishing(true);
    try {
      const success = await publishDraft(draft.id);
      if (success) {
        navigate('/releases');
      }
    } finally {
      setPublishing(false);
    }
  };

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const totalSize = draft.files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Validation status */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">Validation Status</h2>

        {validation.isValid ? (
          <div className="flex items-center gap-3 text-success bg-success/10 px-4 py-3 rounded border border-success/30">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">All checks passed! Ready to publish.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {validation.errors.map((error, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-destructive bg-destructive/10 px-4 py-3 rounded border border-destructive/30"
              >
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="mt-3 space-y-2">
            {validation.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-warning bg-warning/10 px-4 py-3 rounded border border-warning/30"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata summary */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Release Metadata
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Version</p>
            <p className="text-lg font-bold">{draft.version || '(not set)'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Minecraft</p>
            <p className="text-lg font-bold">{draft.minecraft_version || '(not set)'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Fabric Loader</p>
            <p className="text-lg font-bold">{draft.fabric_loader || '(not set)'}</p>
          </div>
        </div>
      </div>

      {/* Files summary */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Files ({draft.files.length})
        </h2>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Total size: <span className="font-bold">{formatSize(totalSize)}</span>
          </p>
        </div>
        <div className="max-h-64 overflow-auto border border-border rounded-lg">
          {draft.files.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">No files</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-right px-4 py-2 font-medium">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {draft.files.map((file) => (
                  <tr key={file.path} className="hover:bg-muted/50">
                    <td className="px-4 py-2 font-mono text-xs">{file.path}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatSize(file.size)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Changelog preview */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">Changelog</h2>
        {draft.changelog ? (
          <div className="prose prose-sm max-w-none border border-border rounded-lg p-4 bg-muted/20">
            <ReactMarkdown>{draft.changelog}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">No changelog</p>
        )}
      </div>

      {/* Publish button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={() => navigate('/releases')}
          className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handlePublish}
          disabled={!validation.isValid || publishing || loading}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <Upload className="w-5 h-5" />
          {publishing ? 'Publishing...' : 'Publish Release'}
        </button>
      </div>
    </div>
  );
}
