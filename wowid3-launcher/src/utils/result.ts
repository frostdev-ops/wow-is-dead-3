/**
 * Result type pattern for explicit error handling
 * Inspired by Rust's Result<T, E> type
 *
 * Use this instead of throwing errors for graceful error handling
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful Result
 */
export const Ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

/**
 * Create a failed Result
 */
export const Err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/**
 * Check if a Result is Ok
 */
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => {
  return result.ok === true;
};

/**
 * Check if a Result is Err
 */
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => {
  return result.ok === false;
};

/**
 * Unwrap a Result, throwing if it's an error
 * Use sparingly - prefer pattern matching with if (isOk(result))
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};

/**
 * Unwrap a Result or return a default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
};

/**
 * Unwrap a Result or compute a default value from the error
 */
export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T => {
  if (result.ok) {
    return result.value;
  }
  return fn(result.error);
};

/**
 * Map the value of a Result if it's Ok
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result;
};

/**
 * Map the error of a Result if it's Err
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (result.ok) {
    return result;
  }
  return Err(fn(result.error));
};

/**
 * Chain Result-returning operations
 */
export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
};

/**
 * Wrap a function that might throw into a Result-returning function
 */
export const tryCatch = <T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> => {
  try {
    return Ok(fn());
  } catch (error) {
    const mappedError = mapError
      ? mapError(error)
      : (error instanceof Error ? error : new Error(String(error))) as E;
    return Err(mappedError);
  }
};

/**
 * Wrap an async function that might throw into a Result-returning async function
 */
export const tryCatchAsync = async <T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    const mappedError = mapError
      ? mapError(error)
      : (error instanceof Error ? error : new Error(String(error))) as E;
    return Err(mappedError);
  }
};

/**
 * Combine multiple Results into a single Result with an array of values
 * Returns Err with the first error encountered
 */
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      return result;
    }
  }

  return Ok(values);
};

/**
 * Example usage:
 *
 * ```typescript
 * // Instead of this:
 * function divide(a: number, b: number): number {
 *   if (b === 0) throw new Error('Division by zero');
 *   return a / b;
 * }
 *
 * // Use this:
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return Err('Division by zero');
 *   return Ok(a / b);
 * }
 *
 * // Usage:
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   console.log('Result:', result.value); // 5
 * } else {
 *   console.error('Error:', result.error);
 * }
 *
 * // Or use pattern matching:
 * const value = unwrapOr(divide(10, 0), 0); // Returns 0 on error
 *
 * // Chain operations:
 * const result = pipe(
 *   divide(10, 2),
 *   (r) => map(r, (x) => x * 2),
 *   (r) => andThen(r, (x) => divide(x, 5))
 * );
 * ```
 */
