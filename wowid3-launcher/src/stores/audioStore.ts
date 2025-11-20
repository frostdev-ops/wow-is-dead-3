import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LauncherError } from '../types';

export type AudioState = 'loading' | 'fallback' | 'transitioning' | 'main';
export type AudioSource = 'none' | 'fallback' | 'cached' | 'downloaded';

interface AudioStoreState {
  // Playback state
  isMuted: boolean;
  wasPaused: boolean; // Track if audio was paused before game launch
  audioState: AudioState;
  mainAudioReady: boolean;
  audioSource: AudioSource; // Track where the audio came from

  // Download/loading state
  isDownloading: boolean;
  downloadProgress: number; // 0-100
  downloadError: LauncherError | null;

  // Retry state
  retryCount: number;
  maxRetries: number;
  lastErrorTimestamp: number | null;

  // Crossfade state
  isCrossfading: boolean;

  // Volume (persisted)
  volume: number; // 0-1 range

  // Actions
  setMuted: (muted: boolean) => void;
  setWasPaused: (paused: boolean) => void;
  setAudioState: (state: AudioState) => void;
  setMainAudioReady: (ready: boolean) => void;
  setAudioSource: (source: AudioSource) => void;
  setIsDownloading: (downloading: boolean) => void;
  setDownloadProgress: (progress: number) => void;
  setDownloadError: (error: LauncherError | null) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  setLastErrorTimestamp: (timestamp: number | null) => void;
  setIsCrossfading: (fading: boolean) => void;
  setVolume: (volume: number) => void;

  // Computed/helper actions
  canRetry: () => boolean;
  reset: () => void; // Reset to initial state
  markDownloadSuccess: () => void;
  markDownloadFailure: (error: LauncherError) => void;
  
  // Game launch integration
  pauseForGame: () => void; // Pause audio and track state before game launch
  resumeFromGame: () => void; // Resume audio after game closes
}

const INITIAL_STATE = {
  isMuted: false,
  wasPaused: false,
  audioState: 'loading' as AudioState,
  mainAudioReady: false,
  audioSource: 'none' as AudioSource,
  isDownloading: false,
  downloadProgress: 0,
  downloadError: null,
  retryCount: 0,
  maxRetries: 3,
  lastErrorTimestamp: null,
  isCrossfading: false,
  volume: 0.3, // Default volume 30%
};

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // Basic setters
      setMuted: (muted) => set({ isMuted: muted }),
      setWasPaused: (paused) => set({ wasPaused: paused }),
      setAudioState: (state) => set({ audioState: state }),
      setMainAudioReady: (ready) => set({ mainAudioReady: ready }),
      setAudioSource: (source) => set({ audioSource: source }),
      setIsDownloading: (downloading) => set({ isDownloading: downloading }),
      setDownloadProgress: (progress) => set({ downloadProgress: progress }),
      setDownloadError: (error) => set({ downloadError: error }),
      setLastErrorTimestamp: (timestamp: number | null) => set({ lastErrorTimestamp: timestamp }),
      setIsCrossfading: (fading: boolean) => set({ isCrossfading: fading }),
      setVolume: (volume: number) => set({ volume: Math.max(0, Math.min(1, volume)) }),

      // Retry management
      incrementRetryCount: () => set((state: AudioStoreState) => ({
        retryCount: state.retryCount + 1,
        lastErrorTimestamp: Date.now()
      })),

      resetRetryCount: () => set({
        retryCount: 0,
        lastErrorTimestamp: null
      }),

      // Computed helpers
      canRetry: () => {
        const state = get();
        return state.retryCount < state.maxRetries;
      },

      // Complex actions
      markDownloadSuccess: () => set({
        isDownloading: false,
        downloadProgress: 100,
        downloadError: null,
        audioSource: 'downloaded',
        retryCount: 0,
        lastErrorTimestamp: null,
      }),

      markDownloadFailure: (error: LauncherError) => set((state: AudioStoreState) => ({
        isDownloading: false,
        downloadError: error,
        retryCount: state.retryCount + 1,
        lastErrorTimestamp: Date.now(),
      })),

      reset: () => set(INITIAL_STATE),

      // Game launch integration
      pauseForGame: () => set((state: AudioStoreState) => ({
        wasPaused: !state.isMuted, // Track if we should resume later
        isMuted: true, // Mute audio for game
      })),

      resumeFromGame: () => set((state: AudioStoreState) => ({
        isMuted: !state.wasPaused, // Restore previous mute state
        wasPaused: false,
      })),
    }),
    {
      name: 'wowid3-audio-storage', // localStorage key
      partialize: (state) => ({
        // Only persist volume and muted state
        volume: state.volume,
        isMuted: state.isMuted,
      }),
    }
  )
);
