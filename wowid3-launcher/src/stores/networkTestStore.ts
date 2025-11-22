import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LatencyTestResult {
  min_ms: number;
  max_ms: number;
  avg_ms: number;
  jitter_ms: number;
  samples: number;
}

export interface SpeedTestResult {
  mbps: number;
  bytes_transferred: number;
  duration_ms: number;
}

export interface PacketLossResult {
  sent: number;
  received: number;
  lost: number;
  loss_percent: number;
}

export interface NetworkTestResult {
  success: boolean;
  timestamp: string;
  game_server_reachable: boolean;
  game_server_latency_ms: number | null;
  latency: LatencyTestResult | null;
  download_speed: SpeedTestResult | null;
  upload_speed: SpeedTestResult | null;
  packet_loss: PacketLossResult | null;
  error_message: string | null;
}

export interface NetworkTestProgress {
  test_name: string;
  progress_percent: number;
  current_step: string;
}

interface NetworkTestState {
  // Current test state
  isRunning: boolean;
  currentTest: string | null;
  progress: NetworkTestProgress | null;

  // Results
  latestResult: NetworkTestResult | null;
  testHistory: NetworkTestResult[];

  // Error state
  error: string | null;

  // Rate limiting
  lastTestTime: number | null;
  canRunTest: () => boolean;

  // Actions
  setRunning: (running: boolean, testName?: string) => void;
  setProgress: (progress: NetworkTestProgress | null) => void;
  setResult: (result: NetworkTestResult) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearResults: () => void;
  exportResults: () => string;
}

const RATE_LIMIT_MS = 60000; // 1 minute
const MAX_HISTORY_ITEMS = 10;

export const useNetworkTestStore = create<NetworkTestState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      currentTest: null,
      progress: null,
      latestResult: null,
      testHistory: [],
      error: null,
      lastTestTime: null,

      canRunTest: () => {
        const { lastTestTime } = get();
        if (!lastTestTime) return true;
        return Date.now() - lastTestTime >= RATE_LIMIT_MS;
      },

      setRunning: (running: boolean, testName?: string) => {
        set({
          isRunning: running,
          currentTest: running ? (testName || null) : null,
          progress: running ? null : get().progress,
          error: running ? null : get().error,
        });

        if (running) {
          set({ lastTestTime: Date.now() });
        }
      },

      setProgress: (progress: NetworkTestProgress | null) => {
        set({ progress });
      },

      setResult: (result: NetworkTestResult) => {
        set((state) => {
          // Add to history (keep only last MAX_HISTORY_ITEMS)
          const newHistory = [result, ...state.testHistory].slice(0, MAX_HISTORY_ITEMS);

          return {
            latestResult: result,
            testHistory: newHistory,
            isRunning: false,
            currentTest: null,
            progress: null,
            error: result.error_message,
          };
        });
      },

      setError: (error: string | null) => {
        set({
          error,
          isRunning: false,
          currentTest: null,
          progress: null,
        });
      },

      clearError: () => set({ error: null }),

      clearResults: () => set({
        latestResult: null,
        testHistory: [],
        error: null,
      }),

      exportResults: () => {
        const { latestResult } = get();
        if (!latestResult) {
          return JSON.stringify({ error: 'No results to export' }, null, 2);
        }
        return JSON.stringify(latestResult, null, 2);
      },
    }),
    {
      name: 'network-test-storage',
      partialize: (state) => ({
        testHistory: state.testHistory,
        lastTestTime: state.lastTestTime,
      }),
    }
  )
);
