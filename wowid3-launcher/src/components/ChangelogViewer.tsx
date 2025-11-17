import { Manifest } from '../stores';
import { Button } from './ui/Button';

interface ChangelogViewerProps {
  currentVersion?: string;
  manifest: Manifest;
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogViewer = ({
  currentVersion = 'Unknown',
  manifest,
  isOpen,
  onClose,
}: ChangelogViewerProps) => {
  if (!isOpen) return null;

  const lines = (manifest.changelog || '').split('\n');

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 max-h-96 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            Update: v{currentVersion} → v{manifest.version}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Changelog</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {lines.length > 0 ? (
            lines.map((line, idx) => (
              <div key={idx}>
                {line.startsWith('# ') ? (
                  <h3 className="text-lg font-bold text-red-500 mt-3 mb-2">
                    {line.substring(2)}
                  </h3>
                ) : line.startsWith('## ') ? (
                  <h4 className="text-base font-semibold text-red-400 mt-2 mb-1">
                    {line.substring(3)}
                  </h4>
                ) : line.startsWith('- ') ? (
                  <p className="text-sm text-slate-300 ml-3">• {line.substring(2)}</p>
                ) : line.trim() ? (
                  <p className="text-sm text-slate-400">{line}</p>
                ) : (
                  <div className="h-2" />
                )}
              </div>
            ))
          ) : (
            <p className="text-slate-400 text-center py-8">No changelog available</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
};
