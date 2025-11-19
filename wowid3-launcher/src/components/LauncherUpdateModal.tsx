import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { LauncherUpdateInfo, installLauncherUpdate } from '../hooks/useTauriCommands';
import { Card, Button, ProgressBar } from './ui';
import { Rocket, AlertTriangle, Download } from 'lucide-react';

interface LauncherUpdateModalProps {
  updateInfo: LauncherUpdateInfo;
}

interface ProgressEvent {
    current: number;
    total: number;
    percent: number;
}

const LauncherUpdateModal: React.FC<LauncherUpdateModalProps> = ({ updateInfo }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progressState, setProgressState] = useState<{current: number, total: number}>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUpdating) {
      const unlisten = listen<ProgressEvent>('launcher-update-progress', (event) => {
        setProgressState({
            current: event.payload.current,
            total: event.payload.total
        });
      });
      
      return () => {
        unlisten.then(f => f());
      };
    }
  }, [isUpdating]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setError(null);
    
    try {
      await installLauncherUpdate(updateInfo.download_url, updateInfo.sha256);
      // The app should restart automatically, but if not:
      setTimeout(() => {
          window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Update failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsUpdating(false);
    }
  };

  return (
    <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md"
          >
            <Card className="p-6 border-2 border-primary/50 shadow-2xl shadow-primary/20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Rocket className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Launcher Update</h2>
                  <p className="text-primary font-medium">Version {updateInfo.version} Available</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 max-h-48 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Changelog:</h3>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{updateInfo.changelog || "Bug fixes and performance improvements."}</p>
                </div>

                {updateInfo.mandatory && (
                   <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                     <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                     <p className="text-sm text-red-300">This update is mandatory. You must update to continue playing.</p>
                   </div>
                )}
                
                {error && (
                   <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                     <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                     <p className="text-sm text-red-300">Update failed: {error}</p>
                   </div>
                )}
              </div>

              {isUpdating ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Downloading update...</span>
                    <span className="text-primary font-mono">
                        {progressState.total > 0 ? ((progressState.current / progressState.total) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <ProgressBar 
                    current={progressState.current} 
                    total={progressState.total} 
                    className="h-2" 
                  />
                  <p className="text-xs text-center text-gray-500 mt-2">The launcher will restart automatically</p>
                </div>
              ) : (
                <Button 
                  onClick={handleUpdate} 
                  className="w-full py-6 text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Update & Restart
                </Button>
              )}
            </Card>
          </motion.div>
        </div>
    </AnimatePresence>
  );
};

export default LauncherUpdateModal;
