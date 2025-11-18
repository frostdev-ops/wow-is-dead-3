import { useEffect, useRef } from 'react';

/**
 * Provides an AbortController for cancelling requests when component unmounts.
 *
 * @returns AbortController instance
 *
 * Performance: Prevents memory leaks by cancelling pending requests on unmount
 */
export function useCancellableRequest() {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create a new AbortController on mount
    abortControllerRef.current = new AbortController();

    // Cancel any pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getSignal = () => abortControllerRef.current?.signal;

  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }
  };

  return { getSignal, cancel };
}
