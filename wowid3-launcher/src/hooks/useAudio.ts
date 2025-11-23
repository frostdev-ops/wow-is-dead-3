import { useEffect, useRef, useCallback } from 'react';
import { logger, LogCategory } from '../utils/logger';
import { useAudioStore } from '../stores/audioStore';

// Bundled audio files (no download needed)
const MAIN_AUDIO_URL = '/8-bit-christmas.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';
const CROSSFADE_DURATION_MS = 2000;
const CROSSFADE_STEPS = 20;

export const useAudio = () => {
  const fallbackRef = useRef<HTMLAudioElement | null>(null);
  const mainRef = useRef<HTMLAudioElement | null>(null);

  const {
    isMuted,
    setMuted,
    audioState,
    setAudioState,
    mainAudioReady,
    setMainAudioReady,
    volume,
    setVolume: setStoreVolume,
    pauseForGame,
    resumeFromGame,
  } = useAudioStore();

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      if (fallbackRef.current) {
        fallbackRef.current.pause();
        fallbackRef.current.src = '';
      }
      if (mainRef.current) {
        mainRef.current.pause();
        mainRef.current.src = '';
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

    const executeCrossfade = () => {
      logger.info(LogCategory.AUDIO, 'Main audio is ready, starting crossfade');
      main.volume = 0;

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
    } else {
      logger.info(LogCategory.AUDIO, 'Waiting for main audio to be ready...');

      const onCanPlayThrough = () => {
        logger.debug(LogCategory.AUDIO, 'Main audio canplaythrough event fired');
        main.removeEventListener('canplaythrough', onCanPlayThrough);
        main.removeEventListener('error', onError);
        executeCrossfade();
      };

      const onError = () => {
        logger.error(LogCategory.AUDIO, 'Main audio error during crossfade setup');
        main.removeEventListener('canplaythrough', onCanPlayThrough);
        main.removeEventListener('error', onError);
        setAudioState('fallback');
      };

      main.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
      main.addEventListener('error', onError, { once: true });
      main.load();
    }
  }, [audioState, setAudioState, volume]);

  // Load main audio from bundled file
  const loadMainAudio = useCallback(() => {
    if (!mainRef.current) return;

    logger.info(LogCategory.AUDIO, 'Loading bundled main audio');

    mainRef.current.onloadeddata = () => {
      logger.info(LogCategory.AUDIO, 'Main audio successfully loaded');
      setMainAudioReady(true);
    };

    mainRef.current.onerror = () => {
      const errorCode = mainRef.current?.error?.code;
      const errorMsg = mainRef.current?.error?.message;
      logger.error(LogCategory.AUDIO, `Main audio failed to load. Code: ${errorCode}, Message: ${errorMsg}`);
      logger.info(LogCategory.AUDIO, 'Will continue with fallback audio');
    };

    mainRef.current.src = MAIN_AUDIO_URL;
    mainRef.current.load();
  }, [setMainAudioReady]);

  // Initialize audio on mount
  useEffect(() => {
    logger.info(LogCategory.AUDIO, 'Initializing audio system');

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
    };
  }, []);

  // Trigger crossfade when main audio is ready
  useEffect(() => {
    if (mainAudioReady && audioState === 'fallback') {
      logger.info(LogCategory.AUDIO, 'Main audio ready, initiating crossfade');
      startCrossfade();
    }
  }, [mainAudioReady, audioState, startCrossfade]);

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
