import { useEffect, useState } from 'react';
import { useModpack, useServer, useTheme } from './hooks';
import LauncherHome from './components/LauncherHome';
import SettingsScreen from './components/SettingsScreen';
import ChristmasBackground from './components/theme/ChristmasBackground';
import { ToastProvider } from './components/ui/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [isMuted, setIsMuted] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [audio] = useState(() => new Audio('/wid3menu.wav'));
  const { checkUpdates, latestManifest } = useModpack();
  const { startPolling } = useServer();
  useTheme(); // Apply theme on mount

  // Mock data for testing
  const mockManifest = {
    version: "1.2.3",
    changelog: [
      { type: "Added", description: "New Christmas themed background with animated snow" },
      { type: "Added", description: "Background music player with mute toggle" },
      { type: "Fixed", description: "Player model now properly sits and is uninteractable" },
      { type: "Changed", description: "Navigation buttons moved to top-left with icon design" },
      { type: "Added", description: "Version display with hover changelog in navigation bar" },
      { type: "Improved", description: "Settings page styling to match Christmas theme" },
      { type: "Removed", description: "Theme settings - Christmas theme is now permanent" },
    ]
  };

  // Use mock data if real manifest isn't available (for testing)
  const displayManifest = latestManifest || mockManifest;

  useEffect(() => {
    // Check for modpack updates on startup
    checkUpdates().catch(console.error);

    // Start server polling
    startPolling(30);

    // Play background music
    audio.loop = true;
    audio.volume = 0.3; // Set volume to 30%
    audio.play().catch(err => {
      console.log('[Audio] Failed to autoplay music:', err);
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    audio.muted = isMuted;
  }, [isMuted, audio]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <ChristmasBackground />
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Navigation Cards - Top Left */}
        <div className="absolute top-12 left-4 z-50 flex gap-3">
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
          <button
            onClick={() => setIsMuted(!isMuted)}
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

          {/* Version Display with Changelog */}
          {displayManifest && (
            <button
              className="p-5 transition-all bg-black bg-opacity-40 text-white hover:bg-opacity-60"
              style={{
                backdropFilter: 'blur(12px)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0',
              }}
              onMouseEnter={() => setShowChangelog(true)}
              onMouseLeave={() => setShowChangelog(false)}
              title="Modpack Version - Hover for changelog"
            >
              <div className="flex items-center gap-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold', color: '#FFD700' }}>
                  v{displayManifest.version}
                </span>
              </div>

              {/* Changelog Tooltip */}
              {showChangelog && Array.isArray(displayManifest.changelog) && displayManifest.changelog.length > 0 && (
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
                      Changelog - v{displayManifest.version}
                    </h3>
                    <div className="space-y-2">
                      {displayManifest.changelog.map((entry: any, index: number) => (
                        <div key={index} className="text-sm">
                          <span className="font-semibold" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                            {entry.type}:
                          </span>
                          <span className="ml-2 text-white" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                            {entry.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'home' && <LauncherHome />}
          {activeTab === 'settings' && <SettingsScreen />}
        </div>
      </div>
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
