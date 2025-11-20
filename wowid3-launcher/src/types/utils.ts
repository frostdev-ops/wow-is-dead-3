/**
 * Type Utilities
 *
 * Comprehensive utility types for the WOWID3 launcher.
 */

/**
 * Branded type for compile-time type safety of primitive types
 */
export type Brand<T, TBrand extends string> = T & { __brand: TBrand };

/**
 * UUID type - branded string for type-safe UUIDs
 * @example const uuid: UUID = "550e8400-e29b-41d4-a716-446655440000" as UUID;
 */
export type UUID = Brand<string, 'UUID'>;

/**
 * Milliseconds type - branded number for time values
 * @example const time: Milliseconds = 1000 as Milliseconds;
 */
export type Milliseconds = Brand<number, 'Milliseconds'>;

/**
 * Bytes type - branded number for byte values
 * @example const size: Bytes = 1024 as Bytes;
 */
export type Bytes = Brand<number, 'Bytes'>;

/**
 * SHA256 hash type - branded string for hash values
 * @example const hash: SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as SHA256;
 */
export type SHA256 = Brand<string, 'SHA256'>;

/**
 * ISO8601 date string type
 */
export type ISO8601 = Brand<string, 'ISO8601'>;

/**
 * Nullable type - T or null
 */
export type Nullable<T> = T | null;

/**
 * Optional type - T or undefined
 */
export type Optional<T> = T | undefined;

/**
 * Result type - success or error
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Extract the awaited type from a Promise
 */
export type FromPromise<T> = T extends Promise<infer U> ? U : never;

/**
 * Deep readonly - makes all properties readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends Record<string, unknown>
    ? DeepReadonly<T[P]>
    : T[P] extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T[P];
};

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Extract keys of T where value is of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * NonEmptyArray type - ensures array has at least one element
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Prettify type - expands type for better IDE display
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Type guard for checking if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for checking if a value is null
 */
export function isNull<T>(value: T | null): value is null {
  return value === null;
}

/**
 * Type guard for checking if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for checking if a value is a non-empty array
 */
export function isNonEmptyArray<T>(value: T[] | unknown): value is NonEmptyArray<T> {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

/**
 * Assert that a value is never (exhaustive check)
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Create a branded value (type-safe wrapper)
 */
export function brand<T, TBrand extends string>(value: T): Brand<T, TBrand> {
  return value as Brand<T, TBrand>;
}

/**
 * Unwrap a branded value
 */
export function unbrand<T, TBrand extends string>(value: Brand<T, TBrand>): T {
  return value as T;
}
