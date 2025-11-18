import { create } from 'zustand';

interface AudioState {
  isMuted: boolean;
  wasPaused: boolean; // Track if audio was paused before game launch

  // Actions
  setMuted: (muted: boolean) => void;
  setWasPaused: (paused: boolean) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isMuted: false,
  wasPaused: false,

  setMuted: (muted) => set({ isMuted: muted }),
  setWasPaused: (paused) => set({ wasPaused: paused }),
}));
