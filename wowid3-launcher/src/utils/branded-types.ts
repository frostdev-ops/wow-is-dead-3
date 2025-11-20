/**
 * Branded types for compile-time type safety
 * Ensures validated data cannot be mixed with unvalidated data
 */

/**
 * Brand a primitive type with a unique symbol
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Remove branding from a type
 */
export type Unbrand<T> = T extends Brand<infer U, any> ? U : T;

// Common branded types for the launcher

/**
 * A validated UUID string
 */
export type UUID = Brand<string, 'UUID'>;

/**
 * A validated URL string
 */
export type URL = Brand<string, 'URL'>;

/**
 * A validated email address
 */
export type Email = Brand<string, 'Email'>;

/**
 * Time in milliseconds
 */
export type Milliseconds = Brand<number, 'Milliseconds'>;

/**
 * Time in seconds
 */
export type Seconds = Brand<number, 'Seconds'>;

/**
 * File size in bytes
 */
export type Bytes = Brand<number, 'Bytes'>;

/**
 * File size in megabytes
 */
export type Megabytes = Brand<number, 'Megabytes'>;

/**
 * A validated file path
 */
export type FilePath = Brand<string, 'FilePath'>;

/**
 * A validated directory path
 */
export type DirectoryPath = Brand<string, 'DirectoryPath'>;

/**
 * A validated Minecraft version string (e.g., "1.20.1")
 */
export type MinecraftVersion = Brand<string, 'MinecraftVersion'>;

/**
 * A validated SHA-256 hash
 */
export type SHA256Hash = Brand<string, 'SHA256Hash'>;

/**
 * RAM allocation in MB
 */
export type RamAllocationMB = Brand<number, 'RamAllocationMB'>;

/**
 * A percentage value (0-100)
 */
export type Percentage = Brand<number, 'Percentage'>;

// Validators

/**
 * Validate a UUID string
 */
export const validateUUID = (value: string): UUID | null => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? (value as UUID) : null;
};

/**
 * Validate a URL string
 */
export const validateURL = (value: string): URL | null => {
  try {
    new globalThis.URL(value);
    return value as URL;
  } catch {
    return null;
  }
};

/**
 * Validate a HTTPS URL string
 */
export const validateHTTPSURL = (value: string): URL | null => {
  try {
    const url = new globalThis.URL(value);
    return url.protocol === 'https:' ? (value as URL) : null;
  } catch {
    return null;
  }
};

/**
 * Validate an email address
 */
export const validateEmail = (value: string): Email | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? (value as Email) : null;
};

/**
 * Validate milliseconds (non-negative)
 */
export const validateMilliseconds = (value: number): Milliseconds | null => {
  return value >= 0 ? (value as Milliseconds) : null;
};

/**
 * Validate seconds (non-negative)
 */
export const validateSeconds = (value: number): Seconds | null => {
  return value >= 0 ? (value as Seconds) : null;
};

/**
 * Validate bytes (non-negative)
 */
export const validateBytes = (value: number): Bytes | null => {
  return value >= 0 ? (value as Bytes) : null;
};

/**
 * Validate megabytes (non-negative)
 */
export const validateMegabytes = (value: number): Megabytes | null => {
  return value >= 0 ? (value as Megabytes) : null;
};

/**
 * Validate a Minecraft version string
 */
export const validateMinecraftVersion = (value: string): MinecraftVersion | null => {
  // Format: major.minor.patch (e.g., "1.20.1")
  const versionRegex = /^\d+\.\d+(?:\.\d+)?$/;
  return versionRegex.test(value) ? (value as MinecraftVersion) : null;
};

/**
 * Validate a SHA-256 hash
 */
export const validateSHA256Hash = (value: string): SHA256Hash | null => {
  const sha256Regex = /^[a-f0-9]{64}$/i;
  return sha256Regex.test(value) ? (value as SHA256Hash) : null;
};

/**
 * Validate RAM allocation (1GB to 64GB)
 */
export const validateRamAllocation = (value: number): RamAllocationMB | null => {
  const min = 1024; // 1GB
  const max = 65536; // 64GB
  return value >= min && value <= max ? (value as RamAllocationMB) : null;
};

/**
 * Validate a percentage value (0-100)
 */
export const validatePercentage = (value: number): Percentage | null => {
  return value >= 0 && value <= 100 ? (value as Percentage) : null;
};

/**
 * Validate a file path (basic check - just ensures it's not empty)
 */
export const validateFilePath = (value: string): FilePath | null => {
  return value.trim().length > 0 ? (value as FilePath) : null;
};

/**
 * Validate a directory path (basic check - just ensures it's not empty)
 */
export const validateDirectoryPath = (value: string): DirectoryPath | null => {
  return value.trim().length > 0 ? (value as DirectoryPath) : null;
};

// Conversion utilities

/**
 * Convert seconds to milliseconds
 */
export const secondsToMilliseconds = (seconds: Seconds): Milliseconds => {
  return (seconds * 1000) as Milliseconds;
};

/**
 * Convert milliseconds to seconds
 */
export const millisecondsToSeconds = (ms: Milliseconds): Seconds => {
  return (ms / 1000) as Seconds;
};

/**
 * Convert bytes to megabytes
 */
export const bytesToMegabytes = (bytes: Bytes): Megabytes => {
  return (bytes / 1024 / 1024) as Megabytes;
};

/**
 * Convert megabytes to bytes
 */
export const megabytesToBytes = (mb: Megabytes): Bytes => {
  return (mb * 1024 * 1024) as Bytes;
};

/**
 * Example usage:
 *
 * ```typescript
 * // Type-safe URL handling
 * const rawUrl = "https://example.com/manifest.json";
 * const validUrl = validateHTTPSURL(rawUrl);
 *
 * if (validUrl) {
 *   // TypeScript knows this is a validated URL
 *   fetchManifest(validUrl);
 * }
 *
 * function fetchManifest(url: URL) {
 *   // Can only be called with a validated URL
 *   // Cannot accidentally pass unvalidated string
 * }
 *
 * // Type-safe RAM allocation
 * const ramInput = 4096;
 * const validRam = validateRamAllocation(ramInput);
 *
 * if (validRam) {
 *   setRamAllocation(validRam); // Type-safe
 * }
 * ```
 */
