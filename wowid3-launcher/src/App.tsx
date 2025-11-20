import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger, LogCategory } from './utils/logger';
import { useModpack, useServer, useTheme } from './hooks';
import { usePolling } from './hooks/usePolling';
import { useSettingsStore } from './stores/settingsStore';
import { useAudioStore } from './stores/audioStore';
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

const AUDIO_SERVER_URL = 'https://wowid-launcher.frostdev.io/assets/wid3menu.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'stats'>('home');
  const [showChangelog, setShowChangelog] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [launcherUpdate, setLauncherUpdate] = useState<LauncherUpdateInfo | null>(null);
  const fallbackRef = useRef<HTMLAudioElement>(null);
  const mainRef = useRef<HTMLAudioElement>(null);
  const retryIntervalRef = useRef<number | null>(null);
  const mainBlobUrlRef = useRef<string | null>(null);
  const { checkUpdates, latestManifest } = useModpack();
  const { ping } = useServer();
  const { initializeGameDirectory } = useSettingsStore();
  const {
    isMuted,
    setMuted,
    audioState,
    setAudioState,
    mainAudioReady,
    setMainAudioReady,
    retryCount,
    incrementRetryCount,
    resetRetryCount,
    canRetry,
    setAudioSource,
    markDownloadSuccess,
    markDownloadFailure,
  } = useAudioStore();
  const { showLogViewer, setShowLogViewer } = useUIStore();
  useTheme(); // Apply theme on mount

  // Initialize OS-specific game directory on mount
  useEffect(() => {
    initializeGameDirectory();
  }, [initializeGameDirectory]);

  // Cleanup Blob URLs on component unmount
  useEffect(() => {
    return () => {
      if (mainBlobUrlRef.current) {
        logger.debug(LogCategory.AUDIO, 'Revoking Blob URL on unmount');
        URL.revokeObjectURL(mainBlobUrlRef.current);
        mainBlobUrlRef.current = null;
      }
    };
  }, []);

  // Crossfade from fallback to main audio
  const startCrossfade = () => {
    if (!fallbackRef.current || !mainRef.current || audioState !== 'fallback') return;

    logger.info(LogCategory.AUDIO, 'Starting crossfade transition');
    setAudioState('transitioning');

    const fallback = fallbackRef.current;
    const main = mainRef.current;

    // Ensure main audio is loaded and ready before starting crossfade
    const startFadeWhenReady = () => {
      // Set volume to 0 before crossfade
      main.volume = 0;

      logger.debug(LogCategory.AUDIO, 'Checking main audio ready state', { metadata: { readyState: main.readyState } });

      // Function to start the actual fade/crossover
      const executeCrossfade = () => {
        logger.info(LogCategory.AUDIO, 'Main audio is ready, starting crossfade');

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
            logger.debug(LogCategory.AUDIO, 'Fallback faded out and paused');

            // Start main audio (already buffered)
            main.play()
              .then(() => {
                logger.debug(LogCategory.AUDIO, 'Main audio started, fading in');

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
                    logger.info(LogCategory.AUDIO, 'Crossfade complete, main audio playing');
                  }
                }, fadeInInterval);
              })
              .catch(err => {
                logger.error(LogCategory.AUDIO, 'Failed to play main audio:', err instanceof Error ? err : new Error(String(err)));
                // Resume fallback if main fails
                fallback.volume = 0.3;
                fallback.play().catch(e => logger.error(LogCategory.AUDIO, 'Failed to resume fallback:', e instanceof Error ? e : new Error(String(e))));
                setAudioState('fallback');
              });
          }
        }, fadeOutInterval);
      };

      // Check if audio is already loaded (readyState >= HAVE_ENOUGH_DATA which is 4)
      // HTMLMediaElement.HAVE_ENOUGH_DATA = 4
      const HTMLMediaElementHAVE_ENOUGH_DATA = 4;
      if (main.readyState >= HTMLMediaElementHAVE_ENOUGH_DATA) {
        logger.debug(LogCategory.AUDIO, 'Audio already loaded, starting crossfade immediately');
        executeCrossfade();
        return;
      }

      // If not loaded yet, wait for canplaythrough event
      logger.info(LogCategory.AUDIO, 'Waiting for main audio to be ready...');
      let eventFired = false;
      let canPlayThroughTimeoutId: number | null = null;

      const onCanPlayThrough = () => {
        logger.debug(LogCategory.AUDIO, 'Main audio canplaythrough event fired');
        eventFired = true;
        main.removeEventListener('canplaythrough', onCanPlayThrough);
        main.removeEventListener('error', onError);
        if (canPlayThroughTimeoutId !== null) clearTimeout(canPlayThroughTimeoutId);
        executeCrossfade();
      };

      const onError = () => {
        logger.error(LogCategory.AUDIO, 'Main audio error during crossfade setup');
        eventFired = true;
        main.removeEventListener('canplaythrough', onCanPlayThrough);
        main.removeEventListener('error', onError);
        if (canPlayThroughTimeoutId !== null) clearTimeout(canPlayThroughTimeoutId);
        setAudioState('fallback');
      };

      // Add event listeners BEFORE calling load()
      main.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
      main.addEventListener('error', onError, { once: true });

      // Set timeout in case event never fires
      canPlayThroughTimeoutId = window.setTimeout(() => {
        if (!eventFired) {
          logger.warn(LogCategory.AUDIO, 'Timeout waiting for canplaythrough, proceeding with crossfade anyway');
          main.removeEventListener('canplaythrough', onCanPlayThrough);
          main.removeEventListener('error', onError);
          eventFired = true;
          // Check if we have enough data despite no event
          if (main.readyState >= HTMLMediaElementHAVE_ENOUGH_DATA) {
            executeCrossfade();
          } else {
            logger.warn(LogCategory.AUDIO, 'Audio still not ready after timeout, reverting to fallback');
            setAudioState('fallback');
          }
        }
      }, 5000); // 5 second timeout

      // Now load the audio (this may fire canplaythrough immediately)
      logger.debug(LogCategory.AUDIO, 'Calling load() to ensure audio is buffered...');
      main.load();
    };

    startFadeWhenReady();
  };

  // Load main audio asynchronously (non-blocking)
  const loadMainAudio = async () => {
    try {
      logger.info(LogCategory.AUDIO, 'Starting main audio load (non-blocking)');

      // Try to read cached audio bytes first
      const cachedBytes = await invoke<number[] | null>('cmd_read_cached_audio_bytes');

      if (cachedBytes) {
        logger.info(LogCategory.AUDIO, 'Found cached audio bytes', { metadata: { size: cachedBytes.length } });
        try {
          // Convert number array to Uint8Array, then create Blob
          const byteArray = new Uint8Array(cachedBytes);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          const blobUrl = URL.createObjectURL(blob);

          logger.debug(LogCategory.AUDIO, 'Created Blob URL for cached audio');

          if (mainRef.current) {
            // Revoke old Blob URL if it exists
            if (mainBlobUrlRef.current) {
              logger.debug(LogCategory.AUDIO, 'Revoking previous Blob URL');
              URL.revokeObjectURL(mainBlobUrlRef.current);
            }
            mainBlobUrlRef.current = blobUrl;

            // CRITICAL: Attach event handlers BEFORE setting src to avoid race condition
            let loadTimeout: number | null = null;
            let handlersAttached = false;

            const setupHandlers = () => {
              if (handlersAttached || !mainRef.current) return;
              handlersAttached = true;

              // Set timeout for load attempt
              loadTimeout = window.setTimeout(() => {
                logger.warn(LogCategory.AUDIO, 'Main audio load timeout, using fallback');
                if (mainRef.current) {
                  mainRef.current.src = '';
                }
              }, 10000);

              mainRef.current.onloadeddata = () => {
                if (loadTimeout !== null) clearTimeout(loadTimeout);
                logger.info(LogCategory.AUDIO, 'Main audio successfully loaded from cached Blob');
                setMainAudioReady(true);
                setAudioSource('cached');
                resetRetryCount();
              };
              mainRef.current.onerror = () => {
                if (loadTimeout !== null) clearTimeout(loadTimeout);
                const errorCode = mainRef.current?.error?.code;
                const errorMsg = mainRef.current?.error?.message;
                logger.error(LogCategory.AUDIO, `Cached Blob audio failed to load. Code: ${errorCode}, Message: ${errorMsg}`);
                if (mainRef.current) mainRef.current.src = '';
                // Revoke on error
                if (mainBlobUrlRef.current === blobUrl) {
                  URL.revokeObjectURL(blobUrl);
                  mainBlobUrlRef.current = null;
                }
              };
            };

            // Attach handlers immediately, BEFORE setting src
            logger.debug(LogCategory.AUDIO, 'Attempting to load cached audio from Blob URL');
            setupHandlers();
            // Now set the src with Blob URL
            mainRef.current.src = blobUrl;
          }
          return;
        } catch (err) {
          logger.error(LogCategory.AUDIO, 'Error creating Blob URL from cached audio:', err instanceof Error ? err : new Error(String(err)));
        }
      }

      // If we get here, download audio
      logger.info(LogCategory.AUDIO, 'No cached bytes, downloading audio from server...');
      try {
        const downloadedPath = await invoke<string>('cmd_download_and_cache_audio', {
          url: AUDIO_SERVER_URL,
        });

        logger.info(LogCategory.AUDIO, 'Download complete at:', { metadata: { path: downloadedPath } });

        // Now read the downloaded file as bytes
        const downloadedBytes = await invoke<number[] | null>('cmd_read_cached_audio_bytes');

        if (downloadedBytes && mainRef.current) {
          logger.info(LogCategory.AUDIO, 'Read downloaded audio bytes', { metadata: { size: downloadedBytes.length } });

          // Convert to Blob URL
          const byteArray = new Uint8Array(downloadedBytes);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          const blobUrl = URL.createObjectURL(blob);

          logger.debug(LogCategory.AUDIO, 'Created Blob URL for downloaded audio');

          // Revoke old Blob URL if it exists
          if (mainBlobUrlRef.current) {
            logger.debug(LogCategory.AUDIO, 'Revoking previous Blob URL');
            URL.revokeObjectURL(mainBlobUrlRef.current);
          }
          mainBlobUrlRef.current = blobUrl;

          // CRITICAL: Attach event handlers BEFORE setting src
          let loadTimeout: number | null = null;
          let handlersAttached = false;

          const setupHandlers = () => {
            if (handlersAttached || !mainRef.current) return;
            handlersAttached = true;

            loadTimeout = window.setTimeout(() => {
              logger.warn(LogCategory.AUDIO, 'Downloaded audio load timeout, using fallback');
              if (mainRef.current) {
                mainRef.current.src = '';
              }
            }, 10000);

            mainRef.current.onloadeddata = () => {
              if (loadTimeout !== null) clearTimeout(loadTimeout);
              logger.info(LogCategory.AUDIO, 'Downloaded audio successfully loaded from Blob');
              setMainAudioReady(true);
              markDownloadSuccess();
            };
            mainRef.current.onerror = () => {
              if (loadTimeout !== null) clearTimeout(loadTimeout);
              const errorCode = mainRef.current?.error?.code;
              const errorMsg = mainRef.current?.error?.message;
              logger.error(LogCategory.AUDIO, `Downloaded Blob audio failed to load. Code: ${errorCode}, Message: ${errorMsg}`);
              if (mainRef.current) mainRef.current.src = '';
              // Revoke on error
              if (mainBlobUrlRef.current === blobUrl) {
                URL.revokeObjectURL(blobUrl);
                mainBlobUrlRef.current = null;
              }
            };
          };

          // Attach handlers immediately, BEFORE setting src
          logger.debug(LogCategory.AUDIO, 'Attempting to load downloaded audio from Blob URL');
          setupHandlers();
          // Now set the src with Blob URL
          mainRef.current.src = blobUrl;
        }
      } catch (downloadErr) {
        const errorMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
        logger.warn(LogCategory.AUDIO, 'Download failed, will use fallback audio:', { metadata: { error: errorMsg } });
        markDownloadFailure(errorMsg);
      }
    } catch (err) {
      logger.error(LogCategory.AUDIO, 'Unexpected error in audio setup:', err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Initialize audio on mount (non-blocking)
  useEffect(() => {
    logger.info(LogCategory.AUDIO, 'Initializing audio system (non-blocking)');

    // Start fallback audio after a short delay
    const fallbackTimer = setTimeout(() => {
      if (fallbackRef.current && audioState === 'loading') {
        fallbackRef.current.volume = 0.3;
        fallbackRef.current.play()
          .then(() => {
            logger.info(LogCategory.AUDIO, 'Fallback audio started');
            setAudioState('fallback');
          })
          .catch(err => {
            logger.error(LogCategory.AUDIO, 'Failed to start fallback audio:', err instanceof Error ? err : new Error(String(err)));
          });
      }
    }, 100); // Tiny delay to ensure DOM is ready

    // Load main audio in background (don't await)
    loadMainAudio();

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

    // Cleanup
    return () => {
      clearTimeout(fallbackTimer);
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, []); // Only run once on component mount

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

  // Clear retry interval when main audio loads successfully
  useEffect(() => {
    if (mainAudioReady && retryIntervalRef.current) {
      logger.debug(LogCategory.AUDIO, 'Main audio loaded, clearing retry interval');
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, [mainAudioReady]);

  // Trigger crossfade when main audio is ready
  useEffect(() => {
    if (mainAudioReady && audioState === 'fallback') {
      logger.info(LogCategory.AUDIO, 'Main audio ready, initiating crossfade');
      startCrossfade();
    }
  }, [mainAudioReady, audioState]);

  // Retry mechanism: if stuck in fallback for too long, attempt to reload main audio
  useEffect(() => {
    const stuckTimeout = 15000; // 15 seconds - if still in fallback after this, retry
    let retryTimeoutRef: number | null = null;

    if (audioState === 'fallback' && !mainAudioReady) {
      logger.debug(LogCategory.AUDIO, 'In fallback state, monitoring for stuck condition...');

      retryTimeoutRef = window.setTimeout(() => {
        if (audioState === 'fallback' && !mainAudioReady && canRetry()) {
          incrementRetryCount();
          logger.warn(LogCategory.AUDIO, `Stuck in fallback (attempt ${retryCount + 1}/3), retrying...`);
          // Retry loading main audio
          loadMainAudio();
        } else if (!canRetry()) {
          logger.warn(LogCategory.AUDIO, 'Max retries reached, will continue with fallback');
        }
      }, stuckTimeout);
    } else if (mainAudioReady || audioState === 'main') {
      // Reset retry counter when we successfully transition
      resetRetryCount();
    }

    return () => {
      if (retryTimeoutRef) {
        clearTimeout(retryTimeoutRef);
      }
    };
  }, [audioState, mainAudioReady, retryCount, canRetry, incrementRetryCount, resetRetryCount]);

  // Handle mute/unmute for both audio elements
  useEffect(() => {
    if (fallbackRef.current) {
      fallbackRef.current.muted = isMuted;
    }
    if (mainRef.current) {
      mainRef.current.muted = isMuted;
    }
    logger.debug(LogCategory.AUDIO, 'Muted set to:', { metadata: { isMuted } });
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
            onClick={() => setMuted(!isMuted)}
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
                console.error('Failed to open map viewer:', err);
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
