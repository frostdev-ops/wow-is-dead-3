import { useEffect, useState, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { useModpack, useServer, useTheme } from './hooks';
import LauncherHome from './components/LauncherHome';
import SettingsScreen from './components/SettingsScreen';
import ChristmasBackground from './components/theme/ChristmasBackground';
import { ToastProvider } from './components/ui/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChangelogViewer } from './components/ChangelogViewer';
import './App.css';

const AUDIO_SERVER_URL = 'https://wowid-launcher.frostdev.io/assets/wid3menu.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [isMuted, setIsMuted] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string>(FALLBACK_AUDIO_URL);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { checkUpdates, latestManifest } = useModpack();
  const { startPolling } = useServer();
  useTheme(); // Apply theme on mount

  // Initialize audio on mount
  useEffect(() => {
    const initAudio = async () => {
      try {
        console.log('[Audio] Initializing audio...');

        // Set volume on audio element
        if (audioRef.current) {
          audioRef.current.volume = 0.3;
          console.log('[Audio] Set volume to 0.3');
        }

        // Check for cached audio
        const cachedPath = await invoke<string | null>('cmd_get_cached_audio');
        if (cachedPath) {
          console.log('[Audio] Found cached audio:', cachedPath);
          const audioUrl = convertFileSrc(cachedPath);
          console.log('[Audio] Converted to URL:', audioUrl);
          setAudioSrc(audioUrl);
          return;
        }

        console.log('[Audio] No cached audio, using fallback');
        setAudioSrc(FALLBACK_AUDIO_URL);

        // Download audio in background
        try {
          console.log('[Audio] Starting background download...');
          const downloadedPath = await invoke<string>('cmd_download_and_cache_audio', {
            url: AUDIO_SERVER_URL,
          });
          console.log('[Audio] Download complete:', downloadedPath);
          const audioUrl = convertFileSrc(downloadedPath);
          console.log('[Audio] Converted downloaded to URL:', audioUrl);
          setAudioSrc(audioUrl);
        } catch (err) {
          console.log('[Audio] Download failed, keeping fallback:', err);
        }
      } catch (err) {
        console.log('[Audio] Initialization error:', err);
      }
    };

    // Initialize audio and check for updates
    initAudio();
    checkUpdates().catch(console.error);
    startPolling(30);
  }, []); // Only run once on component mount

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      console.log('[Audio] Muted set to:', isMuted);
    }
  }, [isMuted]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <ChristmasBackground />
      {/* Background Music */}
      <audio
        ref={audioRef}
        src={audioSrc}
        autoPlay
        loop
        crossOrigin="anonymous"
        onLoadStart={() => console.log('[Audio] Load started for:', audioSrc)}
        onCanPlay={() => console.log('[Audio] Can play:', audioSrc)}
        onPlay={() => console.log('[Audio] Playing:', audioSrc)}
        onPause={() => console.log('[Audio] Paused')}
        onError={(e) => console.log('[Audio] Error:', e.currentTarget.error)}
      />
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
          {latestManifest && (
            <div className="relative">
              <div
                className="p-5 transition-all bg-black bg-opacity-40 text-white cursor-pointer hover:bg-opacity-60"
                style={{
                  backdropFilter: 'blur(12px)',
                  border: '2px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '0',
                }}
                onMouseEnter={() => setShowChangelog(true)}
                onMouseLeave={() => setShowChangelog(false)}
                onClick={() => latestManifest.changelog && setShowChangelogModal(true)}
                title="Modpack Version - Hover for preview, click for full changelog"
              >
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
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

        <div className="flex-1 overflow-auto">
          {activeTab === 'home' && <LauncherHome />}
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
