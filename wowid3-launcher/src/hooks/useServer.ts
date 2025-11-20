import { useMemo } from 'react';
import { LauncherError, LauncherErrorCode } from '../utils/errors';
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
      const error = LauncherError.from(err, LauncherErrorCode.NETWORK_SERVER_ERROR);
      setError(error);
    }
  };

  return {
    status,
    isPolling,
    error,
    ping,
  };
};
