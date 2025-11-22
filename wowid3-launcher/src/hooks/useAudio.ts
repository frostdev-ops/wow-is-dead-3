import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger, LogCategory } from '../utils/logger';
import { useAudioStore } from '../stores/audioStore';
import { createLauncherError, LauncherErrorCode } from '../types';

// Load audio URL from environment, with fallback
const AUDIO_SERVER_URL = import.meta.env.VITE_AUDIO_SERVER_URL || 'https://wowid-launcher.frostdev.io/api/assets/wid3menu.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';
const CROSSFADE_DURATION_MS = 2000;
const CROSSFADE_STEPS = 20;
const LOAD_TIMEOUT_MS = 10000;
const CANPLAYTHROUGH_TIMEOUT_MS = 5000;
const STUCK_TIMEOUT_MS = 15000;

export const useAudio = () => {
  const fallbackRef = useRef<HTMLAudioElement | null>(null);
  const mainRef = useRef<HTMLAudioElement | null>(null);
  const mainBlobUrlRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);

  const {
    isMuted,
    setMuted,
    audioState,
    setAudioState,
    mainAudioReady,
    setMainAudioReady,
    volume,
    setVolume: setStoreVolume,
    retryCount,
    incrementRetryCount,
    resetRetryCount,
    canRetry,
    setAudioSource,
    markDownloadSuccess,
    markDownloadFailure,
    pauseForGame,
    resumeFromGame,
  } = useAudioStore();

  // Cleanup Blob URLs and audio elements
  useEffect(() => {
    return () => {
      // Pause and clear audio elements
      if (fallbackRef.current) {
        fallbackRef.current.pause();
        fallbackRef.current.src = '';
      }
      if (mainRef.current) {
        mainRef.current.pause();
        mainRef.current.src = '';
      }
      // Revoke blob URLs
      if (mainBlobUrlRef.current) {
        logger.debug(LogCategory.AUDIO, 'Revoking Blob URL on unmount');
        URL.revokeObjectURL(mainBlobUrlRef.current);
        mainBlobUrlRef.current = null;
      }
    };
  }, []);

  // Crossfade from fallback to main audio
  const startCrossfade = useCallback(() => {
    if (!fallbackRef.current || !mainRef.current || audioState !== 'fallback') return;

    logger.info(LogCategory.AUDIO, 'Starting crossfade transition');
    setAudioState('transitioning');

    const fallback = fallbackRef.current;
    const main = mainRef.current;

    const startFadeWhenReady = () => {
      main.volume = 0;
      logger.debug(LogCategory.AUDIO, 'Checking main audio ready state', { metadata: { readyState: main.readyState } });

      const executeCrossfade = () => {
        logger.info(LogCategory.AUDIO, 'Main audio is ready, starting crossfade');

        const fadeOutInterval = CROSSFADE_DURATION_MS / CROSSFADE_STEPS;
        const volumeDecrement = volume / CROSSFADE_STEPS;
        let currentStep = 0;

        const fadeOutTimer = setInterval(() => {
          if (!fallback) {
            clearInterval(fadeOutTimer);
            return;
          }

          currentStep++;
          const newVolume = Math.max(0, volume - (volumeDecrement * currentStep));
          fallback.volume = newVolume;

          if (currentStep >= CROSSFADE_STEPS) {
            clearInterval(fadeOutTimer);
            fallback.pause();
            logger.debug(LogCategory.AUDIO, 'Fallback faded out and paused');

            main.play()
              .then(() => {
                logger.debug(LogCategory.AUDIO, 'Main audio started, fading in');

                let fadeInStep = 0;
                const fadeInInterval = CROSSFADE_DURATION_MS / CROSSFADE_STEPS;
                const volumeIncrement = volume / CROSSFADE_STEPS;

                const fadeInTimer = setInterval(() => {
                  if (!main) {
                    clearInterval(fadeInTimer);
                    return;
                  }

                  fadeInStep++;
                  const newVolume = Math.min(volume, volumeIncrement * fadeInStep);
                  main.volume = newVolume;

                  if (fadeInStep >= CROSSFADE_STEPS) {
                    clearInterval(fadeInTimer);
                    setAudioState('main');
                    logger.info(LogCategory.AUDIO, 'Crossfade complete, main audio playing');
                  }
                }, fadeInInterval);
              })
              .catch(err => {
                logger.error(LogCategory.AUDIO, 'Failed to play main audio:', err instanceof Error ? err : new Error(String(err)));
                fallback.volume = volume;
                fallback.play().catch(e => logger.error(LogCategory.AUDIO, 'Failed to resume fallback:', e instanceof Error ? e : new Error(String(e))));
                setAudioState('fallback');
              });
          }
        }, fadeOutInterval);
      };

      const HTMLMediaElementHAVE_ENOUGH_DATA = 4;
      if (main.readyState >= HTMLMediaElementHAVE_ENOUGH_DATA) {
        logger.debug(LogCategory.AUDIO, 'Audio already loaded, starting crossfade immediately');
        executeCrossfade();
        return;
      }

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

      main.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
      main.addEventListener('error', onError, { once: true });

      canPlayThroughTimeoutId = window.setTimeout(() => {
        if (!eventFired) {
          logger.warn(LogCategory.AUDIO, 'Timeout waiting for canplaythrough, proceeding with crossfade anyway');
          main.removeEventListener('canplaythrough', onCanPlayThrough);
          main.removeEventListener('error', onError);
          eventFired = true;
          if (main.readyState >= HTMLMediaElementHAVE_ENOUGH_DATA) {
            executeCrossfade();
          } else {
            logger.warn(LogCategory.AUDIO, 'Audio still not ready after timeout, reverting to fallback');
            setAudioState('fallback');
          }
        }
      }, CANPLAYTHROUGH_TIMEOUT_MS);

      logger.debug(LogCategory.AUDIO, 'Calling load() to ensure audio is buffered...');
      main.load();
    };

    startFadeWhenReady();
  }, [audioState, setAudioState, volume]);

  // Load main audio asynchronously
  const loadMainAudio = useCallback(async () => {
    try {
      logger.info(LogCategory.AUDIO, 'Starting main audio load (non-blocking)');

      // Prevent multiple simultaneous load attempts
      if (isLoadingRef.current) {
        logger.debug(LogCategory.AUDIO, 'Already loading audio, skipping duplicate load attempt');
        return;
      }

      const cachedBytes = await invoke<number[] | null>('cmd_read_cached_audio_bytes');

      if (cachedBytes) {
        logger.info(LogCategory.AUDIO, 'Found cached audio bytes', { metadata: { size: cachedBytes.length } });
        try {
          isLoadingRef.current = true;
          const byteArray = new Uint8Array(cachedBytes);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          const blobUrl = URL.createObjectURL(blob);

          logger.debug(LogCategory.AUDIO, 'Created Blob URL for cached audio');

          if (mainRef.current) {
            const oldBlobUrl = mainBlobUrlRef.current;
            mainBlobUrlRef.current = blobUrl;

            let loadTimeout: number | null = null;
            let handlersAttached = false;

            const setupHandlers = () => {
              if (handlersAttached || !mainRef.current) return;
              handlersAttached = true;

              loadTimeout = window.setTimeout(() => {
                logger.warn(LogCategory.AUDIO, 'Main audio load timeout, using fallback');
                if (mainRef.current) {
                  mainRef.current.src = '';
                }
                isLoadingRef.current = false;
              }, LOAD_TIMEOUT_MS);

              mainRef.current.onloadeddata = () => {
                if (loadTimeout !== null) clearTimeout(loadTimeout);
                logger.info(LogCategory.AUDIO, 'Main audio successfully loaded from cached Blob');
                // Only revoke old URL after new one is loaded
                if (oldBlobUrl && oldBlobUrl !== blobUrl) {
                  logger.debug(LogCategory.AUDIO, 'Revoking old Blob URL after new audio loaded');
                  URL.revokeObjectURL(oldBlobUrl);
                }
                setMainAudioReady(true);
                setAudioSource('cached');
                resetRetryCount();
                isLoadingRef.current = false;
              };
              mainRef.current.onerror = () => {
                if (loadTimeout !== null) clearTimeout(loadTimeout);
                const errorCode = mainRef.current?.error?.code;
                const errorMsg = mainRef.current?.error?.message;
                logger.error(LogCategory.AUDIO, `Cached Blob audio failed to load. Code: ${errorCode}, Message: ${errorMsg}`);
                if (mainRef.current) mainRef.current.src = '';
                // Only revoke if it's the current URL
                if (mainBlobUrlRef.current === blobUrl) {
                  URL.revokeObjectURL(blobUrl);
                  mainBlobUrlRef.current = null;
                }
                // Revoke old URL if it wasn't revoked yet
                if (oldBlobUrl && oldBlobUrl !== blobUrl) {
                  URL.revokeObjectURL(oldBlobUrl);
                }
                isLoadingRef.current = false;
              };
            };

            logger.debug(LogCategory.AUDIO, 'Attempting to load cached audio from Blob URL');
            setupHandlers();
            mainRef.current.src = blobUrl;
          }
          return;
        } catch (err) {
          logger.error(LogCategory.AUDIO, 'Error creating Blob URL from cached audio:', err instanceof Error ? err : new Error(String(err)));
        }
      }

      logger.info(LogCategory.AUDIO, 'No cached bytes, downloading audio from server...');
      try {
        const downloadedPath = await invoke<string>('cmd_download_and_cache_audio', {
          url: AUDIO_SERVER_URL,
        });

        logger.info(LogCategory.AUDIO, 'Download complete at:', { metadata: { path: downloadedPath } });

        const downloadedBytes = await invoke<number[] | null>('cmd_read_cached_audio_bytes');

        if (downloadedBytes && mainRef.current) {
          logger.info(LogCategory.AUDIO, 'Read downloaded audio bytes', { metadata: { size: downloadedBytes.length } });

          isLoadingRef.current = true;
          const byteArray = new Uint8Array(downloadedBytes);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          const blobUrl = URL.createObjectURL(blob);

          logger.debug(LogCategory.AUDIO, 'Created Blob URL for downloaded audio');

          const oldBlobUrl = mainBlobUrlRef.current;
          mainBlobUrlRef.current = blobUrl;

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
              isLoadingRef.current = false;
            }, LOAD_TIMEOUT_MS);

            mainRef.current.onloadeddata = () => {
              if (loadTimeout !== null) clearTimeout(loadTimeout);
              logger.info(LogCategory.AUDIO, 'Downloaded audio successfully loaded from Blob');
              // Only revoke old URL after new one is loaded
              if (oldBlobUrl && oldBlobUrl !== blobUrl) {
                logger.debug(LogCategory.AUDIO, 'Revoking old Blob URL after new audio loaded');
                URL.revokeObjectURL(oldBlobUrl);
              }
              setMainAudioReady(true);
              markDownloadSuccess();
              isLoadingRef.current = false;
            };
            mainRef.current.onerror = () => {
              if (loadTimeout !== null) clearTimeout(loadTimeout);
              const errorCode = mainRef.current?.error?.code;
              const errorMsg = mainRef.current?.error?.message;
              logger.error(LogCategory.AUDIO, `Downloaded Blob audio failed to load. Code: ${errorCode}, Message: ${errorMsg}`);
              if (mainRef.current) mainRef.current.src = '';
              // Only revoke if it's the current URL
              if (mainBlobUrlRef.current === blobUrl) {
                URL.revokeObjectURL(blobUrl);
                mainBlobUrlRef.current = null;
              }
              // Revoke old URL if it wasn't revoked yet
              if (oldBlobUrl && oldBlobUrl !== blobUrl) {
                URL.revokeObjectURL(oldBlobUrl);
              }
              isLoadingRef.current = false;
            };
          };

          logger.debug(LogCategory.AUDIO, 'Attempting to load downloaded audio from Blob URL');
          setupHandlers();
          mainRef.current.src = blobUrl;
        }
      } catch (downloadErr) {
        isLoadingRef.current = false;
        const errorMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
        logger.warn(LogCategory.AUDIO, 'Download failed, will use fallback audio:', { metadata: { error: errorMsg } });
        const error = createLauncherError(
          LauncherErrorCode.AUDIO_DOWNLOAD_FAILED,
          errorMsg,
          { 
            cause: downloadErr instanceof Error ? downloadErr : undefined,
            context: { originalError: downloadErr }
          }
        );
        markDownloadFailure(error);
      }
    } catch (err) {
      logger.error(LogCategory.AUDIO, 'Unexpected error in audio setup:', err instanceof Error ? err : new Error(String(err)));
      isLoadingRef.current = false;
    }
  }, [setMainAudioReady, setAudioSource, resetRetryCount, markDownloadSuccess, markDownloadFailure]);

  // Initialize audio on mount
  useEffect(() => {
    logger.info(LogCategory.AUDIO, 'Initializing audio system (non-blocking)');

    const fallbackTimer = setTimeout(() => {
      if (fallbackRef.current && audioState === 'loading') {
        fallbackRef.current.volume = volume;
        fallbackRef.current.play()
          .then(() => {
            logger.info(LogCategory.AUDIO, 'Fallback audio started');
            setAudioState('fallback');
          })
          .catch(err => {
            logger.error(LogCategory.AUDIO, 'Failed to start fallback audio:', err instanceof Error ? err : new Error(String(err)));
          });
      }
    }, 100);

    loadMainAudio();

    return () => {
      clearTimeout(fallbackTimer);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Trigger crossfade when main audio is ready
  useEffect(() => {
    if (mainAudioReady && audioState === 'fallback') {
      logger.info(LogCategory.AUDIO, 'Main audio ready, initiating crossfade');
      startCrossfade();
    }
  }, [mainAudioReady, audioState, startCrossfade]);

  // Retry mechanism
  useEffect(() => {
    if (audioState === 'fallback' && !mainAudioReady) {
      logger.debug(LogCategory.AUDIO, 'In fallback state, monitoring for stuck condition...');

      retryTimeoutRef.current = window.setTimeout(() => {
        if (audioState === 'fallback' && !mainAudioReady && canRetry()) {
          incrementRetryCount();
          logger.warn(LogCategory.AUDIO, `Stuck in fallback (attempt ${retryCount + 1}/3), retrying...`);
          loadMainAudio();
        } else if (!canRetry()) {
          logger.warn(LogCategory.AUDIO, 'Max retries reached, will continue with fallback');
        }
      }, STUCK_TIMEOUT_MS);
    } else if (mainAudioReady || audioState === 'main') {
      resetRetryCount();
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [audioState, mainAudioReady, retryCount, canRetry, incrementRetryCount, resetRetryCount, loadMainAudio]);

  // Handle mute/unmute
  useEffect(() => {
    if (fallbackRef.current) {
      fallbackRef.current.muted = isMuted;
    }
    if (mainRef.current) {
      mainRef.current.muted = isMuted;
    }
    logger.debug(LogCategory.AUDIO, 'Muted set to:', { metadata: { isMuted } });
  }, [isMuted]);

  // Handle volume changes
  useEffect(() => {
    if (fallbackRef.current && audioState === 'fallback') {
      fallbackRef.current.volume = volume;
    }
    if (mainRef.current && audioState === 'main') {
      mainRef.current.volume = volume;
    }
    logger.debug(LogCategory.AUDIO, 'Volume set to:', { metadata: { volume } });
  }, [volume, audioState]);

  // Public API
  const play = useCallback(async () => {
    if (audioState === 'fallback' && fallbackRef.current) {
      await fallbackRef.current.play();
    } else if (audioState === 'main' && mainRef.current) {
      await mainRef.current.play();
    }
  }, [audioState]);

  const pause = useCallback(() => {
    if (fallbackRef.current) {
      fallbackRef.current.pause();
    }
    if (mainRef.current) {
      mainRef.current.pause();
    }
  }, []);

  const stop = useCallback(() => {
    if (fallbackRef.current) {
      fallbackRef.current.pause();
      fallbackRef.current.currentTime = 0;
    }
    if (mainRef.current) {
      mainRef.current.pause();
      mainRef.current.currentTime = 0;
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setStoreVolume(clampedVolume);
  }, [setStoreVolume]);

  const toggleMute = useCallback(() => {
    setMuted(!isMuted);
  }, [isMuted, setMuted]);

  return {
    // Playback control
    play,
    pause,
    stop,

    // Volume control
    setVolume,
    setMuted,
    toggleMute,

    // State
    isMuted,
    volume,
    audioState,
    isPlaying: audioState === 'fallback' || audioState === 'main' || audioState === 'transitioning',

    // Refs for audio elements
    fallbackRef,
    mainRef,

    // Fallback and main URLs
    fallbackUrl: FALLBACK_AUDIO_URL,

    // Game launch integration
    pauseForGame,
    resumeFromGame,
  };
};
