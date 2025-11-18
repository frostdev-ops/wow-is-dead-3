import { useEffect, useState } from 'react';

/**
 * Debounces a value by delaying its update until after a specified delay.
 * Useful for search inputs and auto-save functionality.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms for search, 1000ms for auto-save)
 * @returns The debounced value
 *
 * Performance: Prevents excessive re-renders and API calls
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to cancel the timeout if value changes before delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounces a callback function.
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced callback
 *
 * Performance: Useful for event handlers like search, resize, scroll
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };
}
