
/**
 * Creates a rate-limited version of an async function.
 * Prevents the function from being called more often than the specified interval.
 *
 * @param interval Minimum time in milliseconds between calls
 * @returns A wrapped function that enforces the rate limit
 */
export function createRateLimiter(interval: number) {
  let lastCall = 0;

  return function rateLimited<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: any[]) => {
      const now = Date.now();
      const elapsed = now - lastCall;

      if (elapsed < interval) {
        const wait = interval - elapsed;
        await new Promise(resolve => setTimeout(resolve, wait));
      }

      lastCall = Date.now();
      return fn(...args);
    }) as T;
  };
}

