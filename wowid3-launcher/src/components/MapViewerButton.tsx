import { useState, useEffect } from 'react';
import { useMapViewer } from '../hooks/useMapViewer';
import { Map, Loader } from 'lucide-react';

interface MapViewerButtonProps {
  className?: string;
}

export const MapViewerButton = ({
  className = ''
}: MapViewerButtonProps) => {
  const { isAvailable, isOpening, openMap, error, checkAvailability } = useMapViewer();
  const [localError, setLocalError] = useState<string | null>(null);

  // Refresh availability periodically
  useEffect(() => {
    const interval = setInterval(() => {
      checkAvailability();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [checkAvailability]);

  const handleOpenMap = async () => {
    try {
      setLocalError(null);
      await openMap();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open map viewer';
      setLocalError(message);

      // Clear error after 5 seconds
      setTimeout(() => {
        setLocalError(null);
      }, 5000);
    }
  };

  const displayError = localError || error;

  return (
    <div className={className}>
      <button
        onClick={handleOpenMap}
        disabled={!isAvailable || isOpening}
        title={
          !isAvailable
            ? 'BlueMap is not available. Make sure the server is running with BlueMap enabled.'
            : isOpening
            ? 'Opening server map...'
            : 'Open server map viewer'
        }
        className={`flex items-center justify-center px-4 py-2 rounded font-semibold transition-all ${
          isAvailable && !isOpening
            ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        {isOpening ? <Loader size={20} className="animate-spin" /> : <Map size={20} />}
      </button>
      {displayError && (
        <div
          className="mt-2 text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded px-3 py-2"
          style={{ fontFamily: "'Trebuchet MS', sans-serif" }}
        >
          {displayError}
        </div>
      )}
    </div>
  );
};
