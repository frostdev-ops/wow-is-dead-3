import { useState, useCallback } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: Error | null;
}

/**
 * Hook for retrying failed operations with exponential backoff and jitter
 *
 * @example
 * ```tsx
 * const { execute, isRetrying, attempt } = useRetry({
 *   maxAttempts: 3,
 *   baseDelay: 1000,
 *   jitter: true,
 * });
 *
 * const handleFetch = async () => {
 *   try {
 *     const result = await execute(() => fetchData());
 *     console.log('Success:', result);
 *   } catch (error) {
 *     console.error('All retries failed:', error);
 *   }
 * };
 * ```
 */
export const useRetry = (options: RetryOptions = {}) => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    onRetry,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null,
  });

  const calculateDelay = useCallback((attemptNumber: number): number => {
    // Calculate exponential backoff delay
    let delay = baseDelay * Math.pow(backoffFactor, attemptNumber - 1);

    // Cap at maximum delay
    delay = Math.min(delay, maxDelay);

    // Add jitter to prevent thundering herd problem
    if (jitter) {
      // Random jitter between 0% and 25% of the delay
      const jitterAmount = delay * 0.25 * Math.random();
      delay = delay + jitterAmount;
    }

    return Math.floor(delay);
  }, [baseDelay, backoffFactor, maxDelay, jitter]);

  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const execute = useCallback(async <T>(
    fn: () => Promise<T>
  ): Promise<T> => {
    setState({ isRetrying: true, attempt: 0, lastError: null });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setState(prev => ({ ...prev, attempt }));
        const result = await fn();
        setState({ isRetrying: false, attempt, lastError: null });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        setState(prev => ({ ...prev, lastError: err }));

        // If this was the last attempt, throw the error
        if (attempt === maxAttempts) {
          setState(prev => ({ ...prev, isRetrying: false }));
          throw err;
        }

        // Calculate delay and notify
        const delay = calculateDelay(attempt);
        onRetry?.(attempt, err);

        // Wait before retrying
        await sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Retry logic error: exceeded max attempts without resolution');
  }, [maxAttempts, calculateDelay, onRetry]);

  const reset = useCallback(() => {
    setState({ isRetrying: false, attempt: 0, lastError: null });
  }, []);

  return {
    execute,
    reset,
    isRetrying: state.isRetrying,
    attempt: state.attempt,
    lastError: state.lastError,
  };
};

/**
 * Standalone retry function without hook
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    onRetry,
  } = options;

  const calculateDelay = (attemptNumber: number): number => {
    let delay = baseDelay * Math.pow(backoffFactor, attemptNumber - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      const jitterAmount = delay * 0.25 * Math.random();
      delay = delay + jitterAmount;
    }

    return Math.floor(delay);
  };

  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw err;
      }

      const delay = calculateDelay(attempt);
      onRetry?.(attempt, err);
      await sleep(delay);
    }
  }

  throw new Error('Retry logic error: exceeded max attempts without resolution');
}
