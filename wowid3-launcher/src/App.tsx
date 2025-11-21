import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger, LogCategory } from './utils/logger';
import { useModpack, useServer, useTheme, useAudio, useDiscord } from './hooks';
import { usePolling } from './hooks/usePolling';
import { useSettingsStore } from './stores/settingsStore';
import { useUIStore } from './stores/uiStore';
import { checkLauncherUpdate, LauncherUpdateInfo } from './hooks/useTauriCommands';
import LauncherHome from './components/LauncherHome';
import { SettingsScreen } from './components/SettingsScreen';
import { StatsScreen } from './components/StatsScreen';
import LogViewerModal from './components/LogViewerModal';
import LauncherUpdateModal from './components/LauncherUpdateModal';
import ChristmasBackground from './components/theme/ChristmasBackground';
import { ToastProvider } from './components/ui/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChangelogViewer } from './components/ChangelogViewer';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'stats'>('home');
  const [showChangelog, setShowChangelog] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [launcherUpdate, setLauncherUpdate] = useState<LauncherUpdateInfo | null>(null);
  const { checkUpdates, latestManifest } = useModpack();
  const { ping } = useServer();
  const { initializeGameDirectory } = useSettingsStore();
  const { showLogViewer, setShowLogViewer } = useUIStore();
  const { isMuted, toggleMute, fallbackRef, mainRef, fallbackUrl } = useAudio();
  useTheme(); // Apply theme on mount
  useDiscord(); // Initialize Discord Rich Presence on app startup

  // Initialize OS-specific game directory on mount
  useEffect(() => {
    initializeGameDirectory();
  }, [initializeGameDirectory]);

  // Note: Installed version is now loaded by useModpack hook on mount
  // This legacy effect is no longer needed as useModpack handles version persistence

  // Initialize app (launcher updates, modpack check, server ping)
  useEffect(() => {
    // Check for launcher updates
    checkLauncherUpdate().then(info => {
        if (info.available) {
            setLauncherUpdate(info);
        }
    }).catch(err => {
        logger.error(LogCategory.UPDATER, "Failed to check for launcher updates:", err instanceof Error ? err : new Error(String(err)));
    });

    // Other initialization
    checkUpdates().catch(e => logger.error(LogCategory.MODPACK, 'Initial checkUpdates failed:', e instanceof Error ? e : new Error(String(e))));
    ping(); // Initial ping
  }, [checkUpdates, ping]);

  // Unified Polling
  usePolling({
    name: 'ServerStatus',
    interval: 30000,
    fn: async () => { await ping(); },
    enabled: true,
    exponentialBackoff: true
  });

  usePolling({
    name: 'ModpackUpdate',
    interval: 300000, // 5 minutes
    fn: async () => { await checkUpdates(); },
    enabled: true,
    exponentialBackoff: true
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <ChristmasBackground />

      {/* Fallback Audio (60-second preview) */}
      <audio
        ref={fallbackRef}
        src={fallbackUrl}
        loop
        crossOrigin="anonymous"
      />

      {/* Main Audio (full track from server) */}
      <audio
        ref={mainRef}
        loop
        crossOrigin="anonymous"
      />

      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Navigation Cards - Top Bar */}
        <div className="absolute top-12 left-0 right-0 z-50 px-4 flex justify-between items-start gap-3">
          {/* Left side: Home, Stats, Settings, and Version */}
          <div className="flex flex-col gap-3 w-fit">
          <div className="flex gap-3 w-fit">
          <button
            onClick={() => setActiveTab('home')}
            className={`p-5 transition-all ${
              activeTab === 'home'
                ? 'bg-christmas-gold bg-opacity-90 text-black font-bold'
                : 'bg-black bg-opacity-40 text-white hover:bg-opacity-60'
            }`}
            style={{
              backdropFilter: 'blur(12px)',
              border: activeTab === 'home' ? '2px solid rgba(255, 215, 0, 0.8)' : '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0',
            }}
            title="Home"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`p-5 transition-all ${
              activeTab === 'stats'
                ? 'bg-christmas-gold bg-opacity-90 text-black font-bold'
                : 'bg-black bg-opacity-40 text-white hover:bg-opacity-60'
            }`}
            style={{
              backdropFilter: 'blur(12px)',
              border: activeTab === 'stats' ? '2px solid rgba(255, 215, 0, 0.8)' : '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0',
            }}
            title="Stats"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-5 transition-all ${
              activeTab === 'settings'
                ? 'bg-christmas-gold bg-opacity-90 text-black font-bold'
                : 'bg-black bg-opacity-40 text-white hover:bg-opacity-60'
            }`}
            style={{
              backdropFilter: 'blur(12px)',
              border: activeTab === 'settings' ? '2px solid rgba(255, 215, 0, 0.8)' : '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0',
            }}
            title="Settings"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          </div>

          {/* Version Display - Below Home/Stats/Settings */}
          {latestManifest && (
            <div className="relative w-fit">
              <div
                className="p-5 transition-all text-white cursor-pointer"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(12px)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'}
                onClick={() => latestManifest.changelog && setShowChangelogModal(true)}
                title="Modpack Version - Hover for preview, click for full changelog"
              >
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  <span style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold', color: '#FFD700' }}>
                    v{latestManifest.version}
                  </span>
                </div>
              </div>

              {/* Changelog Tooltip */}
              {showChangelog && latestManifest.changelog && (
                <div
                  className="absolute top-full left-0 mt-2 w-96 max-h-96 overflow-y-auto z-50"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '2px solid rgba(255, 215, 0, 0.8)',
                    borderRadius: '0',
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                  }}
                  onMouseEnter={() => setShowChangelog(true)}
                  onMouseLeave={() => setShowChangelog(false)}
                >
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-3" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
                      Changelog - v{latestManifest.version}
                    </h3>
                    <div className="space-y-2">
                      {latestManifest.changelog.split('\n').slice(0, 7).map((line, index) => {
                        if (!line.trim()) return null;

                        if (line.startsWith('# ')) {
                          return (
                            <h3 key={index} className="text-base font-bold mt-2" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
                              {line.substring(2)}
                            </h3>
                          );
                        } else if (line.startsWith('## ')) {
                          return (
                            <h4 key={index} className="text-sm font-semibold" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                              {line.substring(3)}
                            </h4>
                          );
                        } else if (line.startsWith('- ')) {
                          return (
                            <p key={index} className="text-sm ml-3 text-white" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                              • {line.substring(2)}
                            </p>
                          );
                        } else {
                          return (
                            <p key={index} className="text-sm text-white" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                              {line}
                            </p>
                          );
                        }
                      })}
                      <p className="text-xs mt-3 text-center" style={{ color: '#fde047', fontFamily: "'Trebuchet MS', sans-serif" }}>
                        Click for full changelog
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Right side: Log Viewer, Mute, Map */}
          <div className="flex gap-3 w-fit">
          <button
            onClick={() => setShowLogViewer(true)}
            className="p-5 transition-all bg-black bg-opacity-40 text-white hover:bg-opacity-60"
            style={{
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0',
            }}
            title="View Game Logs"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
          <button
            onClick={toggleMute}
            className="p-5 transition-all bg-black bg-opacity-40 text-white hover:bg-opacity-60"
            style={{
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0',
            }}
            title={isMuted ? 'Unmute Music' : 'Mute Music'}
          >
            {isMuted ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Map Viewer Button */}
          <button
            onClick={() => {
              invoke('cmd_open_map_viewer').catch(err => {
                logger.error(LogCategory.UI, 'Failed to open map viewer:', err instanceof Error ? err : new Error(String(err)));
              });
            }}
            className="p-5 transition-all bg-black bg-opacity-40 text-white hover:bg-opacity-60"
            style={{
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0',
            }}
            title="Open server map viewer"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'home' && <LauncherHome />}
          {activeTab === 'stats' && <StatsScreen />}
          {activeTab === 'settings' && <SettingsScreen />}
        </div>
      </div>

      {/* Changelog Modal */}
      {latestManifest && latestManifest.changelog && (
        <ChangelogViewer
          currentVersion={latestManifest.version}
          manifest={latestManifest}
          isOpen={showChangelogModal}
          onClose={() => setShowChangelogModal(false)}
        />
      )}

      {/* Log Viewer Modal - Global, persists across tabs */}
      <LogViewerModal
        isOpen={showLogViewer}
        onClose={() => setShowLogViewer(false)}
      />

      {/* Launcher Update Modal - Blocks if update available */}
      {launcherUpdate && (
          <LauncherUpdateModal updateInfo={launcherUpdate} />
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
