import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

interface AudioLoadState {
  isLoading: boolean;
  error: string | null;
  source: 'cached' | 'server' | 'fallback' | null;
}

const AUDIO_SERVER_URL = 'https://wowid-launcher.frostdev.io/assets/wid3menu.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';

export function useAudio(enabled: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioLoadState>({
    isLoading: true,
    error: null,
    source: null,
  });

  useEffect(() => {
    if (!enabled) {
      console.log('[Audio] Hook disabled');
      return;
    }

    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      console.log('[Audio] Creating audio element');
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
      audioRef.current.crossOrigin = 'anonymous';
      console.log('[Audio] Audio element created with settings - loop:', audioRef.current.loop, 'volume:', audioRef.current.volume);
    }

    const audio = audioRef.current;
    let isMounted = true;

    const loadAudio = async () => {
      try {
        console.log('[Audio] Starting audio loading sequence...');

        // Step 1: Check for cached audio
        console.log('[Audio] Checking for cached audio...');
        const cachedPath = await invoke<string | null>('cmd_get_cached_audio');

        if (isMounted && cachedPath) {
          console.log('[Audio] Found cached audio:', cachedPath);
          audio.src = convertFileSrc(cachedPath);
          console.log('[Audio] Set audio source to:', audio.src);

          const playPromise = audio.play();
          playPromise
            .then(() => {
              console.log('[Audio] Successfully started playing cached audio');
            })
            .catch(err => {
              console.log('[Audio] Failed to autoplay cached music (browser restriction or error):', err);
            });

          setState({
            isLoading: false,
            error: null,
            source: 'cached',
          });

          return;
        }

        // Step 2: No cache found, use fallback while downloading
        console.log('[Audio] No cached audio, using fallback while downloading...');
        audio.src = FALLBACK_AUDIO_URL;
        console.log('[Audio] Set audio source to fallback:', audio.src);

        const fallbackPlayPromise = audio.play();
        fallbackPlayPromise
          .then(() => {
            console.log('[Audio] Successfully started playing fallback audio');
          })
          .catch(err => {
            console.log('[Audio] Failed to autoplay fallback music (browser restriction or error):', err);
          });

        setState({
          isLoading: true,
          error: null,
          source: 'fallback',
        });

        // Step 3: Download and cache audio in background
        console.log('[Audio] Starting background download from:', AUDIO_SERVER_URL);

        try {
          const downloadedPath = await invoke<string>('cmd_download_and_cache_audio', {
            url: AUDIO_SERVER_URL,
          });

          if (isMounted) {
            console.log('[Audio] Download successful, switching to cached audio:', downloadedPath);
            audio.src = convertFileSrc(downloadedPath);
            console.log('[Audio] Set audio source to:', audio.src);
            audio.currentTime = 0;

            const playPromise = audio.play();
            playPromise
              .then(() => {
                console.log('[Audio] Successfully resumed playing downloaded music');
              })
              .catch(err => {
                console.log('[Audio] Failed to resume playing downloaded music:', err);
              });

            setState({
              isLoading: false,
              error: null,
              source: 'cached',
            });
          }
        } catch (downloadError) {
          console.log('[Audio] Download failed, continuing with fallback:', downloadError);

          if (isMounted) {
            setState({
              isLoading: false,
              error: String(downloadError),
              source: 'fallback',
            });
          }
        }
      } catch (error) {
        console.log('[Audio] Error in audio loading sequence:', error);

        if (isMounted) {
          // Fall back to bundled audio
          audio.src = FALLBACK_AUDIO_URL;
          console.log('[Audio] Set audio source to fallback (error recovery):', audio.src);

          const fallbackPlayPromise = audio.play();
          fallbackPlayPromise
            .then(() => {
              console.log('[Audio] Successfully started fallback music (after error)');
            })
            .catch(err => {
              console.log('[Audio] Failed to play fallback music:', err);
            });

          setState({
            isLoading: false,
            error: String(error),
            source: 'fallback',
          });
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  // Return audio element and state (mutable ref for audio control)
  return {
    audio: audioRef.current,
    ...state,
  };
}
