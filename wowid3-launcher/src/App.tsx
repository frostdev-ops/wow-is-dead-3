import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useModpack, useServer, useTheme } from './hooks';
import { useSettingsStore } from './stores/settingsStore';
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
  const [audioState, setAudioState] = useState<'loading' | 'fallback' | 'transitioning' | 'main'>('loading');
  const [mainAudioReady, setMainAudioReady] = useState(false);
  const fallbackRef = useRef<HTMLAudioElement>(null);
  const mainRef = useRef<HTMLAudioElement>(null);
  const retryIntervalRef = useRef<number | null>(null);
  const { checkUpdates, latestManifest } = useModpack();
  const { startPolling } = useServer();
  const { initializeGameDirectory } = useSettingsStore();
  useTheme(); // Apply theme on mount

  // Initialize OS-specific game directory on mount
  useEffect(() => {
    initializeGameDirectory();
  }, [initializeGameDirectory]);

  // Crossfade from fallback to main audio
  const startCrossfade = () => {
    if (!fallbackRef.current || !mainRef.current || audioState !== 'fallback') return;

    console.log('[Audio] Starting crossfade transition');
    setAudioState('transitioning');

    const fallback = fallbackRef.current;
    const main = mainRef.current;

    // Ensure main audio is loaded and ready before starting crossfade
    const startFadeWhenReady = () => {
      // Set volume to 0 before loading
      main.volume = 0;

      // Force load the audio
      console.log('[Audio] Loading main audio before crossfade...');
      main.load();

      // Wait for audio to be ready to play
      const onCanPlayThrough = () => {
        console.log('[Audio] Main audio ready, starting crossfade');
        main.removeEventListener('canplaythrough', onCanPlayThrough);

        // Fade out fallback (0.3 → 0 over 2 seconds)
        const fadeOutSteps = 20;
        const fadeOutInterval = 2000 / fadeOutSteps;
        const volumeDecrement = 0.3 / fadeOutSteps;
        let currentStep = 0;

        const fadeOutTimer = setInterval(() => {
          if (!fallback) {
            clearInterval(fadeOutTimer);
            return;
          }

          currentStep++;
          const newVolume = Math.max(0, 0.3 - (volumeDecrement * currentStep));
          fallback.volume = newVolume;

          if (currentStep >= fadeOutSteps) {
            clearInterval(fadeOutTimer);
            fallback.pause();
            console.log('[Audio] Fallback faded out and paused');

            // Start main audio (already buffered)
            main.play()
              .then(() => {
                console.log('[Audio] Main audio started, fading in');

                // Fade in main (0 → 0.3 over 2 seconds)
                let fadeInStep = 0;
                const fadeInInterval = 2000 / fadeOutSteps;
                const volumeIncrement = 0.3 / fadeOutSteps;

                const fadeInTimer = setInterval(() => {
                  if (!main) {
                    clearInterval(fadeInTimer);
                    return;
                  }

                  fadeInStep++;
                  const newVolume = Math.min(0.3, volumeIncrement * fadeInStep);
                  main.volume = newVolume;

                  if (fadeInStep >= fadeOutSteps) {
                    clearInterval(fadeInTimer);
                    setAudioState('main');
                    console.log('[Audio] Crossfade complete, main audio playing');
                  }
                }, fadeInInterval);
              })
              .catch(err => {
                console.log('[Audio] Failed to play main audio:', err);
                // Resume fallback if main fails
                fallback.volume = 0.3;
                fallback.play().catch(console.error);
                setAudioState('fallback');
              });
          }
        }, fadeOutInterval);
      };

      // Add error handler for load failure
      const onError = () => {
        console.log('[Audio] Failed to load main audio for crossfade');
        main.removeEventListener('canplaythrough', onCanPlayThrough);
        main.removeEventListener('error', onError);
        setAudioState('fallback');
      };

      main.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
      main.addEventListener('error', onError, { once: true });
    };

    startFadeWhenReady();
  };

  // Load main audio asynchronously (non-blocking)
  const loadMainAudio = async () => {
    try {
      console.log('[Audio] Starting main audio load (non-blocking)');

      // Check for cached audio
      const cachedPath = await invoke<string | null>('cmd_get_cached_audio');

      if (cachedPath) {
        console.log('[Audio] Found cached audio:', cachedPath);
        try {
          // Use convertFileSrc to get proper Tauri asset URL (no Blob overhead)
          const assetUrl = convertFileSrc(cachedPath);
          console.log('[Audio] Converted to asset URL:', assetUrl);

          if (mainRef.current) {
            mainRef.current.src = assetUrl;
            setMainAudioReady(true);
            console.log('[Audio] Main audio ready from cache');
          }
          return;
        } catch (err) {
          console.log('[Audio] Failed to load cached audio:', err);
        }
      }

      // Download audio
      console.log('[Audio] Starting background download...');
      const downloadedPath = await invoke<string>('cmd_download_and_cache_audio', {
        url: AUDIO_SERVER_URL,
      });

      console.log('[Audio] Download complete:', downloadedPath);

      // Use convertFileSrc to get proper Tauri asset URL
      const assetUrl = convertFileSrc(downloadedPath);
      console.log('[Audio] Converted to asset URL:', assetUrl);

      if (mainRef.current) {
        mainRef.current.src = assetUrl;
        setMainAudioReady(true);
        console.log('[Audio] Main audio ready from download');
      }
    } catch (err) {
      console.log('[Audio] Failed to load main audio:', err);

      // Set up retry every 5 minutes
      if (!retryIntervalRef.current) {
        console.log('[Audio] Scheduling retry in 5 minutes');
        retryIntervalRef.current = setInterval(() => {
          console.log('[Audio] Retrying download...');
          loadMainAudio();
        }, 5 * 60 * 1000); // 5 minutes
      }
    }
  };

  // Initialize audio on mount (non-blocking)
  useEffect(() => {
    console.log('[Audio] Initializing audio system (non-blocking)');

    // Start fallback audio after a short delay
    const fallbackTimer = setTimeout(() => {
      if (fallbackRef.current && audioState === 'loading') {
        fallbackRef.current.volume = 0.3;
        fallbackRef.current.play()
          .then(() => {
            console.log('[Audio] Fallback audio started');
            setAudioState('fallback');
          })
          .catch(err => {
            console.log('[Audio] Failed to start fallback audio:', err);
          });
      }
    }, 100); // Tiny delay to ensure DOM is ready

    // Load main audio in background (don't await)
    loadMainAudio();

    // Other initialization
    checkUpdates().catch(console.error);
    startPolling(30);

    // Cleanup
    return () => {
      clearTimeout(fallbackTimer);
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, []); // Only run once on component mount

  // Clear retry interval when main audio loads successfully
  useEffect(() => {
    if (mainAudioReady && retryIntervalRef.current) {
      console.log('[Audio] Main audio loaded, clearing retry interval');
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, [mainAudioReady]);

  // Trigger crossfade when main audio is ready
  useEffect(() => {
    if (mainAudioReady && audioState === 'fallback') {
      console.log('[Audio] Main audio ready, initiating crossfade');
      startCrossfade();
    }
  }, [mainAudioReady, audioState]);

  // Handle mute/unmute for both audio elements
  useEffect(() => {
    if (fallbackRef.current) {
      fallbackRef.current.muted = isMuted;
    }
    if (mainRef.current) {
      mainRef.current.muted = isMuted;
    }
    console.log('[Audio] Muted set to:', isMuted);
  }, [isMuted]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <ChristmasBackground />

      {/* Fallback Audio (60-second preview) */}
      <audio
        ref={fallbackRef}
        src={FALLBACK_AUDIO_URL}
        loop
        crossOrigin="anonymous"
        onLoadStart={() => console.log('[Audio] Fallback load started')}
        onCanPlay={() => console.log('[Audio] Fallback can play')}
        onPlay={() => console.log('[Audio] Fallback playing')}
        onPause={() => console.log('[Audio] Fallback paused')}
        onError={(e) => console.log('[Audio] Fallback error:', e.currentTarget.error)}
      />

      {/* Main Audio (full track from server) */}
      <audio
        ref={mainRef}
        loop
        crossOrigin="anonymous"
        onLoadStart={() => console.log('[Audio] Main load started')}
        onCanPlay={() => console.log('[Audio] Main can play')}
        onPlay={() => console.log('[Audio] Main playing')}
        onPause={() => console.log('[Audio] Main paused')}
        onError={(e) => console.log('[Audio] Main error:', e.currentTarget.error)}
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
