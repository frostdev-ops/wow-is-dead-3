import { useRef, useCallback } from 'react';

/**
 * Throttles a callback function to execute at most once per specified interval.
 * Useful for scroll events and other high-frequency events.
 *
 * @param callback - The function to throttle
 * @param delay - Minimum time between executions in milliseconds
 * @returns The throttled callback
 *
 * Performance: Prevents excessive function calls during high-frequency events
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 100
): (...args: Parameters<T>) => void {
  const lastRun = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= delay) {
        callback(...args);
        lastRun.current = now;
      } else {
        // Schedule the next call
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    },
    [callback, delay]
  );
}
