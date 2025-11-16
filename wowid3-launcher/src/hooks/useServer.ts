import { useEffect, useRef } from 'react';
import { useServerStore, useSettingsStore } from '../stores';
import { pingServer } from './useTauriCommands';

export const useServer = () => {
  const { status, isPolling, error, setStatus, setPolling, setError } = useServerStore();
  const { serverAddress } = useSettingsStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const ping = async () => {
    try {
      const serverStatus = await pingServer(serverAddress);
      setStatus(serverStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ping server');
    }
  };

  const startPolling = (intervalSeconds: number = 30) => {
    if (intervalRef.current) {
      return; // Already polling
    }

    setPolling(true);

    // Ping immediately
    ping();

    // Then poll on interval
    intervalRef.current = setInterval(() => {
      ping();
    }, intervalSeconds * 1000);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setPolling(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    status,
    isPolling,
    error,
    ping,
    startPolling,
    stopPolling,
  };
};
