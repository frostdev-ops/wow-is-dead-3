import { create } from 'zustand';

export interface PlayerInfo {
  name: string;
  id: string;
}

export interface ServerStatus {
  online: boolean;
  player_count?: number;
  max_players?: number;
  players: PlayerInfo[];
  version?: string;
  motd?: string;
}

interface ServerState {
  status: ServerStatus;
  isPolling: boolean;
  lastUpdated: Date | null;
  error: string | null;

  // Actions
  setStatus: (status: ServerStatus) => void;
  setPolling: (polling: boolean) => void;
  setError: (error: string | null) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  status: {
    online: false,
    players: [],
  },
  isPolling: false,
  lastUpdated: null,
  error: null,

  setStatus: (status) =>
    set({
      status,
      lastUpdated: new Date(),
      error: null,
    }),

  setPolling: (polling) => set({ isPolling: polling }),

  setError: (error) => set({ error }),
}));
