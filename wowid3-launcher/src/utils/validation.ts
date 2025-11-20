/**
 * Input validation utilities for settings and user input
 * All validation rules return explicit error messages
 */

import { Result, Ok, Err } from './result';
import {
  URL,
  RamAllocationMB,
  DirectoryPath,
  validateHTTPSURL,
  validateRamAllocation,
  validateDirectoryPath,
} from './branded-types';

// Validation error types
export type ValidationError = string;

/**
 * Validate manifest URL
 * - Must be valid HTTPS URL
 * - Must end with .json
 * - Must be in allowlist if provided
 */
export const validateManifestUrl = (
  url: string,
  allowlist?: string[]
): Result<URL, ValidationError> => {
  // Check if empty
  if (!url.trim()) {
    return Err('Manifest URL is required');
  }

  // Check if valid HTTPS URL
  const validUrl = validateHTTPSURL(url);
  if (!validUrl) {
    return Err('Manifest URL must be a valid HTTPS URL (e.g., https://example.com/manifest.json)');
  }

  // Check if ends with .json
  if (!url.toLowerCase().endsWith('.json')) {
    return Err('Manifest URL must point to a .json file');
  }

  // Check allowlist if provided
  if (allowlist && allowlist.length > 0) {
    try {
      const urlObj = new globalThis.URL(url);
      const isAllowed = allowlist.some(domain => {
        return urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`);
      });

      if (!isAllowed) {
        return Err(`Manifest URL domain must be one of: ${allowlist.join(', ')}`);
      }
    } catch {
      return Err('Invalid URL format');
    }
  }

  return Ok(validUrl);
};

/**
 * Validate game directory path
 * - Must not be empty
 * - Must be absolute path (basic check)
 * - Should have write permissions (requires Tauri check)
 */
export const validateGameDirectory = (
  path: string
): Result<DirectoryPath, ValidationError> => {
  // Check if empty
  if (!path.trim()) {
    return Err('Game directory path is required');
  }

  // Check if it looks like an absolute path
  const isAbsolute = path.startsWith('/') || /^[A-Z]:\\/i.test(path);
  if (!isAbsolute) {
    return Err('Game directory must be an absolute path (e.g., /home/user/games or C:\\Games)');
  }

  const validPath = validateDirectoryPath(path);
  if (!validPath) {
    return Err('Invalid directory path');
  }

  return Ok(validPath);
};

/**
 * Validate RAM allocation
 * - Must be between 1GB (1024MB) and 64GB (65536MB)
 * - Should be multiple of 512MB for optimal performance
 */
export const validateRamAllocationMB = (
  ram: number
): Result<RamAllocationMB, ValidationError> => {
  const min = 1024; // 1GB
  const max = 65536; // 64GB

  // Check bounds
  if (ram < min) {
    return Err(`RAM allocation must be at least ${min}MB (1GB)`);
  }

  if (ram > max) {
    return Err(`RAM allocation must not exceed ${max}MB (64GB)`);
  }

  const validRam = validateRamAllocation(ram);
  if (!validRam) {
    return Err('Invalid RAM allocation value');
  }

  // Warn if not a multiple of 512MB (not an error, just suboptimal)
  // This could be returned as a warning in the future
  // For now, we just accept it

  return Ok(validRam);
};

/**
 * Get recommended RAM allocation based on system memory
 */
export const getRecommendedRam = (systemMemoryMB: number): RamAllocationMB => {
  // Recommend 25% of system memory, capped between 4GB and 16GB
  const recommended = Math.floor(systemMemoryMB * 0.25);
  const min = 4096; // 4GB
  const max = 16384; // 16GB

  const clamped = Math.max(min, Math.min(max, recommended));

  // Round to nearest 512MB
  const rounded = Math.round(clamped / 512) * 512;

  return rounded as RamAllocationMB;
};

/**
 * Validate server address
 * - Can be IP:port or hostname:port
 * - Port is optional (defaults to 25565)
 */
export const validateServerAddress = (
  address: string
): Result<string, ValidationError> => {
  // Check if empty
  if (!address.trim()) {
    return Err('Server address is required');
  }

  // Split into hostname and port
  const parts = address.split(':');

  if (parts.length > 2) {
    return Err('Invalid server address format (use hostname:port or just hostname)');
  }

  const hostname = parts[0];
  const port = parts[1];

  // Validate hostname (basic check - not empty, no spaces)
  if (!hostname || hostname.includes(' ')) {
    return Err('Invalid hostname');
  }

  // Validate port if provided
  if (port) {
    const portNum = parseInt(port, 10);

    if (isNaN(portNum)) {
      return Err('Port must be a number');
    }

    if (portNum < 1 || portNum > 65535) {
      return Err('Port must be between 1 and 65535');
    }
  }

  return Ok(address);
};

/**
 * Validate a file exists (requires Tauri filesystem check)
 * This is a helper that returns a validation function
 */
export const createFileExistsValidator = (
  checkExists: (path: string) => Promise<boolean>
) => {
  return async (path: string): Promise<Result<string, ValidationError>> => {
    const exists = await checkExists(path);

    if (!exists) {
      return Err('File or directory does not exist');
    }

    return Ok(path);
  };
};

/**
 * Validate a directory has write permissions (requires Tauri filesystem check)
 * This is a helper that returns a validation function
 */
export const createWritableValidator = (
  checkWritable: (path: string) => Promise<boolean>
) => {
  return async (path: string): Promise<Result<DirectoryPath, ValidationError>> => {
    const isWritable = await checkWritable(path);

    if (!isWritable) {
      return Err('Directory is not writable. Please choose a location where you have write permissions.');
    }

    const validPath = validateDirectoryPath(path);
    if (!validPath) {
      return Err('Invalid directory path');
    }

    return Ok(validPath);
  };
};

/**
 * Combine multiple validators with AND logic
 * Returns the first error encountered, or Ok if all pass
 */
export const combineValidators = <T>(
  value: T,
  validators: ((value: T) => Result<T, ValidationError>)[]
): Result<T, ValidationError> => {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.ok) {
      return result;
    }
  }

  return Ok(value);
};

/**
 * Debounced async validation
 * Useful for real-time validation without hammering the backend
 */
export const createDebouncedValidator = <T>(
  validator: (value: T) => Promise<Result<T, ValidationError>>,
  delayMs: number = 300
) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (value: T): Promise<Result<T, ValidationError>> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const result = await validator(value);
        resolve(result);
      }, delayMs);
    });
  };
};
