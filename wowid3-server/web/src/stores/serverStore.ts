import { create } from "zustand";
import axios from "axios";
import type { ServerStatus, ServerStats, CommandResponse } from "../types/server";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

interface ServerState {
  status: ServerStatus | null;
  stats: ServerStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchStats: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  restartServer: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  status: null,
  stats: null,
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await axios.get<ServerStatus>(`${API_BASE}/server/status`);
      set({ status: response.data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch status",
        isLoading: false,
      });
    }
  },

  fetchStats: async () => {
    try {
      const response = await axios.get<ServerStats>(`${API_BASE}/stats`);
      set({ stats: response.data });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  },

  startServer: async () => {
    try {
      set({ isLoading: true, error: null });
      await axios.post(`${API_BASE}/server/start`);
      await get().fetchStatus();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to start server",
        isLoading: false,
      });
    }
  },

  stopServer: async () => {
    try {
      set({ isLoading: true, error: null });
      await axios.post(`${API_BASE}/server/stop`);
      await get().fetchStatus();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to stop server",
        isLoading: false,
      });
    }
  },

  restartServer: async () => {
    try {
      set({ isLoading: true, error: null });
      await axios.post(`${API_BASE}/server/restart`);
      await get().fetchStatus();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to restart server",
        isLoading: false,
      });
    }
  },

  sendCommand: async (command: string) => {
    try {
      await axios.post<CommandResponse>(`${API_BASE}/server/command`, {
        command,
      });
    } catch (error) {
      console.error("Failed to send command:", error);
      throw error;
    }
  },
}));

