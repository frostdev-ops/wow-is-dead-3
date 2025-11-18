import { create } from 'zustand';

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
  downloadError: string | null;

  // Retry state
  retryCount: number;
  maxRetries: number;
  lastErrorTimestamp: number | null;

  // Crossfade state
  isCrossfading: boolean;

  // Volume
  fallbackVolume: number;
  mainVolume: number;
  targetVolume: number; // For smooth transitions

  // Actions
  setMuted: (muted: boolean) => void;
  setWasPaused: (paused: boolean) => void;
  setAudioState: (state: AudioState) => void;
  setMainAudioReady: (ready: boolean) => void;
  setAudioSource: (source: AudioSource) => void;
  setIsDownloading: (downloading: boolean) => void;
  setDownloadProgress: (progress: number) => void;
  setDownloadError: (error: string | null) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  setLastErrorTimestamp: (timestamp: number | null) => void;
  setIsCrossfading: (fading: boolean) => void;
  setFallbackVolume: (volume: number) => void;
  setMainVolume: (volume: number) => void;
  setTargetVolume: (volume: number) => void;

  // Computed/helper actions
  canRetry: () => boolean;
  reset: () => void; // Reset to initial state
  markDownloadSuccess: () => void;
  markDownloadFailure: (error: string) => void;
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
  fallbackVolume: 0.3,
  mainVolume: 0.3,
  targetVolume: 0.3,
};

export const useAudioStore = create<AudioStoreState>((set, get) => ({
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
  setFallbackVolume: (volume: number) => set({ fallbackVolume: volume }),
  setMainVolume: (volume: number) => set({ mainVolume: volume }),
  setTargetVolume: (volume: number) => set({ targetVolume: volume }),

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

  markDownloadFailure: (error: string) => set((state: AudioStoreState) => ({
    isDownloading: false,
    downloadError: error,
    retryCount: state.retryCount + 1,
    lastErrorTimestamp: Date.now(),
  })),

  reset: () => set(INITIAL_STATE),
}));
