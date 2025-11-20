import { useEffect, useRef, useCallback } from 'react';

interface PollingConfig {
  key: string;
  callback: () => Promise<void>;
  interval: number;
  initialDelay?: number;
  enabled?: boolean;
  maxRetries?: number;
  backoffMultiplier?: number;
}

interface PollState {
  timer?: number;
  retries: number;
  lastRun: number;
  isRunning: boolean;
  currentInterval: number;
}

/**
 * Unified polling manager with request deduplication and exponential backoff
 * Prevents duplicate requests and handles failures gracefully
 */
export const usePollingManager = () => {
  const polls = useRef<Map<string, PollState>>(new Map());
  const activeRequests = useRef<Set<string>>(new Set());

  const executePoll = useCallback(async (config: PollingConfig): Promise<void> => {
    const { key, callback, interval, maxRetries = 3, backoffMultiplier = 2 } = config;

    // Skip if already running (deduplication)
    if (activeRequests.current.has(key)) {
      console.debug(`[Polling] Skipping duplicate request for ${key}`);
      return;
    }

    const state = polls.current.get(key) || {
      retries: 0,
      lastRun: 0,
      isRunning: false,
      currentInterval: interval,
    };

    // Mark as running
    activeRequests.current.add(key);
    state.isRunning = true;

    try {
      await callback();

      // Reset on success
      state.retries = 0;
      state.currentInterval = interval;
      state.lastRun = Date.now();
    } catch (error) {
      console.error(`[Polling] Error in ${key}:`, error);
      state.retries++;

      // Apply exponential backoff on failure
      if (state.retries < maxRetries) {
        state.currentInterval = Math.min(
          interval * Math.pow(backoffMultiplier, state.retries),
          300000 // Max 5 minutes
        );
        console.debug(
          `[Polling] ${key} failed, retry ${state.retries}/${maxRetries}, next in ${state.currentInterval}ms`
        );
      } else {
        console.error(`[Polling] ${key} max retries reached, stopping`);
        // Stop polling after max retries
        if (state.timer) {
          clearInterval(state.timer);
          state.timer = undefined;
        }
      }
    } finally {
      activeRequests.current.delete(key);
      state.isRunning = false;
      polls.current.set(key, state);
    }
  }, []);

  const startPolling = useCallback((config: PollingConfig) => {
    const { key, enabled = true, initialDelay = 0 } = config;

    if (!enabled) return;

    // Clean up existing poll
    const existingState = polls.current.get(key);
    if (existingState?.timer) {
      clearInterval(existingState.timer);
    }

    const state: PollState = {
      retries: 0,
      lastRun: 0,
      isRunning: false,
      currentInterval: config.interval,
    };

    // Initial execution with delay
    if (initialDelay > 0) {
      setTimeout(() => executePoll(config), initialDelay);
    } else {
      executePoll(config);
    }

    // Set up interval with dynamic timing
    const intervalFn = () => {
      const currentState = polls.current.get(key);
      if (currentState && !currentState.isRunning) {
        executePoll(config);
      }
    };

    state.timer = window.setInterval(intervalFn, state.currentInterval);
    polls.current.set(key, state);

    // Return cleanup function
    return () => {
      const state = polls.current.get(key);
      if (state?.timer) {
        clearInterval(state.timer);
        polls.current.delete(key);
      }
    };
  }, [executePoll]);

  const stopPolling = useCallback((key: string) => {
    const state = polls.current.get(key);
    if (state?.timer) {
      clearInterval(state.timer);
      polls.current.delete(key);
      activeRequests.current.delete(key);
    }
  }, []);

  const stopAll = useCallback(() => {
    polls.current.forEach((state, key) => {
      if (state.timer) {
        clearInterval(state.timer);
      }
    });
    polls.current.clear();
    activeRequests.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return {
    startPolling,
    stopPolling,
    stopAll,
  };
};

/**
 * Convenience hook for common polling scenarios
 */
export const usePolling = (
  key: string,
  callback: () => Promise<void>,
  interval: number,
  options?: {
    enabled?: boolean;
    initialDelay?: number;
    maxRetries?: number;
    backoffMultiplier?: number;
  }
) => {
  const { startPolling, stopPolling } = usePollingManager();
  const callbackRef = useRef(callback);

  // Update callback ref to avoid stale closures
  callbackRef.current = callback;

  useEffect(() => {
    const cleanup = startPolling({
      key,
      callback: callbackRef.current,
      interval,
      ...options,
    });

    return cleanup;
  }, [key, interval, options?.enabled, options?.initialDelay, options?.maxRetries, options?.backoffMultiplier, startPolling]);

  return { stop: () => stopPolling(key) };
};