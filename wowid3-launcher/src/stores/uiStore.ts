import { create } from 'zustand';

interface UIState {
  showLogViewer: boolean;

  // Actions
  setShowLogViewer: (show: boolean) => void;
  toggleLogViewer: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  showLogViewer: false,

  setShowLogViewer: (show) => set({ showLogViewer: show }),
  toggleLogViewer: () => set((state) => ({ showLogViewer: !state.showLogViewer })),
}));
