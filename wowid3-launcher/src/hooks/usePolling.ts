import { useState, useEffect, useRef } from 'react';
import { logger, LogCategory } from '../utils/logger';

export interface PollConfig {
  name: string;
  interval: number; // milliseconds
  fn: () => Promise<void>;
  enabled?: boolean;
  exponentialBackoff?: boolean;
  maxRetries?: number;
}

export function usePolling(config: PollConfig) {
  const { name, interval, fn, enabled = true, exponentialBackoff = false, maxRetries = 3 } = config;
  const [isRunning, setIsRunning] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const retryCount = useRef(0);
  const fnRef = useRef(fn);

  // Update ref to avoid effect re-triggering on function identity change
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const poll = async () => {
      setIsRunning(true);
      try {
        logger.debug(LogCategory.NETWORK, `Polling: ${name}`);
        await fnRef.current();
        retryCount.current = 0;
        setLastError(null);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setLastError(err);
        logger.warn(LogCategory.NETWORK, `Polling failed: ${name}`, err);

        if (exponentialBackoff && retryCount.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
          retryCount.current++;
          logger.debug(LogCategory.NETWORK, `Polling ${name} retrying in ${delay}ms`);
          timeoutId = setTimeout(() => isMounted && poll(), delay);
          setIsRunning(false);
          return;
        }
      } finally {
        if (isMounted) setIsRunning(false);
      }

      if (isMounted) {
        timeoutId = setTimeout(poll, interval);
      }
    };

    // Start initial poll
    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [enabled, interval, name, exponentialBackoff, maxRetries]);

  return { isRunning, lastError };
}

