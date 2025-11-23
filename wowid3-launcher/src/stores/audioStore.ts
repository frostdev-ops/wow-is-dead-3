import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AudioState = 'loading' | 'fallback' | 'transitioning' | 'main';

interface AudioStoreState {
  // Playback state
  isMuted: boolean;
  wasPaused: boolean; // Track if audio was paused before game launch
  audioState: AudioState;
  mainAudioReady: boolean;

  // Volume (persisted)
  volume: number; // 0-1 range

  // Actions
  setMuted: (muted: boolean) => void;
  setWasPaused: (paused: boolean) => void;
  setAudioState: (state: AudioState) => void;
  setMainAudioReady: (ready: boolean) => void;
  setVolume: (volume: number) => void;
  reset: () => void; // Reset to initial state

  // Game launch integration
  pauseForGame: () => void; // Pause audio and track state before game launch
  resumeFromGame: () => void; // Resume audio after game closes
}

const INITIAL_STATE = {
  isMuted: false,
  wasPaused: false,
  audioState: 'loading' as AudioState,
  mainAudioReady: false,
  volume: 0.3, // Default volume 30%
};

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      // Basic setters
      setMuted: (muted) => set({ isMuted: muted }),
      setWasPaused: (paused) => set({ wasPaused: paused }),
      setAudioState: (state) => set({ audioState: state }),
      setMainAudioReady: (ready) => set({ mainAudioReady: ready }),
      setVolume: (volume: number) => set({ volume: Math.max(0, Math.min(1, volume)) }),

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
