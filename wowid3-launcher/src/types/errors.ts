/**
 * Error Types Re-export
 *
 * Re-exports error types from utils/errors.ts for use in the types system.
 */

import {
  LauncherErrorCode as ErrorCodeEnum,
  LauncherError as ErrorClass,
  withErrorHandling,
  retryWithBackoff,
} from '../utils/errors';

export {
  ErrorCodeEnum as LauncherErrorCode,
  ErrorClass as LauncherError,
  withErrorHandling,
  retryWithBackoff,
};

export type { LauncherErrorCode as ErrorCode } from '../utils/errors';

/**
 * Error severity levels for UI display
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Create a LauncherError instance
 */
export function createLauncherError(
  code: ErrorCodeEnum,
  message: string,
  options?: {
    recoverable?: boolean;
    retryable?: boolean;
    userMessage?: string;
    technicalDetails?: string;
    context?: Record<string, unknown>;
    cause?: Error;
  }
): ErrorClass {
  return new ErrorClass(code, message, options);
}

/**
 * Parse unknown error into LauncherError
 */
export function parseLauncherError(
  error: unknown,
  defaultCode?: ErrorCodeEnum
): ErrorClass {
  return ErrorClass.from(error, defaultCode);
}

/**
 * Type guard for LauncherError
 */
export function isLauncherError(error: unknown): error is ErrorClass {
  return ErrorClass.isLauncherError(error);
}

/**
 * Assert that an error is a LauncherError
 */
export function assertLauncherError(error: unknown): asserts error is ErrorClass {
  if (!isLauncherError(error)) {
    throw new ErrorClass(
      ErrorCodeEnum.UNKNOWN,
      'Expected LauncherError but got different error type'
    );
  }
}

/**
 * Format LauncherError for display
 */
export function formatLauncherError(error: ErrorClass): string {
  return error.userMessage || error.message;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (isLauncherError(error)) {
    return formatLauncherError(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}
