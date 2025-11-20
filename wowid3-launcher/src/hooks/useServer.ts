import { useMemo } from 'react';
import { useServerStatus, useServerIsPolling, useServerError, useServerActions, useServerAddress } from '../stores/selectors';
import { pingServer } from './useTauriCommands';
import { createRateLimiter } from '../utils/rateLimit';
import { POLLING_CONFIG } from '../config/polling';

export const useServer = () => {
  const status = useServerStatus();
  const isPolling = useServerIsPolling();
  const error = useServerError();
  const { setStatus, setError } = useServerActions();
  const serverAddress = useServerAddress();

  // Rate limited ping
  const rateLimitedPing = useMemo(() => 
    createRateLimiter(POLLING_CONFIG.SERVER_STATUS_INTERVAL / 2)(pingServer), 
  []);

  const ping = async () => {
    try {
      const serverStatus = await rateLimitedPing(serverAddress);
      setStatus(serverStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ping server');
    }
  };

  return {
    status,
    isPolling,
    error,
    ping,
  };
};
