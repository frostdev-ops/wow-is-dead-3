/**
 * Error Types
 *
 * Typed error system for the WOWID3 launcher.
 */

/**
 * Error codes for launcher errors
 */
export enum LauncherErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',

  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_CANCELLED = 'AUTH_CANCELLED',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',

  // Installation errors
  INSTALL_FAILED = 'INSTALL_FAILED',
  INSTALL_CORRUPTED = 'INSTALL_CORRUPTED',
  INSTALL_DISK_SPACE = 'INSTALL_DISK_SPACE',
  INSTALL_PERMISSION_DENIED = 'INSTALL_PERMISSION_DENIED',

  // Modpack errors
  MODPACK_DOWNLOAD_FAILED = 'MODPACK_DOWNLOAD_FAILED',
  MODPACK_VERIFICATION_FAILED = 'MODPACK_VERIFICATION_FAILED',
  MODPACK_HASH_MISMATCH = 'MODPACK_HASH_MISMATCH',
  MODPACK_MANIFEST_INVALID = 'MODPACK_MANIFEST_INVALID',

  // Server errors
  SERVER_UNREACHABLE = 'SERVER_UNREACHABLE',
  SERVER_TIMEOUT = 'SERVER_TIMEOUT',

  // Game launch errors
  GAME_LAUNCH_FAILED = 'GAME_LAUNCH_FAILED',
  GAME_ALREADY_RUNNING = 'GAME_ALREADY_RUNNING',
  GAME_JAVA_NOT_FOUND = 'GAME_JAVA_NOT_FOUND',

  // Configuration errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',

  // Unknown errors
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Launcher error interface with recovery information
 */
export interface LauncherError {
  /** Error code for programmatic handling */
  code: LauncherErrorCode;

  /** Human-readable error message */
  message: string;

  /** Error severity */
  severity: ErrorSeverity;

  /** Whether the error is recoverable */
  recoverable: boolean;

  /** Whether the operation can be retried */
  retryable: boolean;

  /** Optional context data */
  context?: Record<string, unknown>;

  /** Original error if wrapped */
  cause?: Error;

  /** Timestamp of error */
  timestamp: number;
}

/**
 * Create a LauncherError from an error code and message
 */
export function createLauncherError(
  code: LauncherErrorCode,
  message: string,
  options?: {
    severity?: ErrorSeverity;
    recoverable?: boolean;
    retryable?: boolean;
    context?: Record<string, unknown>;
    cause?: Error;
  }
): LauncherError {
  return {
    code,
    message,
    severity: options?.severity ?? ErrorSeverity.ERROR,
    recoverable: options?.recoverable ?? false,
    retryable: options?.retryable ?? false,
    context: options?.context,
    cause: options?.cause,
    timestamp: Date.now(),
  };
}

/**
 * Parse a string error into a LauncherError
 */
export function parseLauncherError(error: unknown): LauncherError {
  if (isLauncherError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  // Parse common error patterns
  if (message.includes('network') || message.includes('fetch')) {
    return createLauncherError(LauncherErrorCode.NETWORK_ERROR, message, {
      retryable: true,
      recoverable: true,
      cause,
    });
  }

  if (message.includes('timeout')) {
    return createLauncherError(LauncherErrorCode.NETWORK_TIMEOUT, message, {
      retryable: true,
      recoverable: true,
      cause,
    });
  }

  if (message.includes('auth') || message.includes('token')) {
    return createLauncherError(LauncherErrorCode.AUTH_FAILED, message, {
      recoverable: true,
      cause,
    });
  }

  if (message.includes('disk space') || message.includes('No space left')) {
    return createLauncherError(LauncherErrorCode.INSTALL_DISK_SPACE, message, {
      severity: ErrorSeverity.CRITICAL,
      recoverable: false,
      cause,
    });
  }

  if (message.includes('SHA') || message.includes('hash') || message.includes('checksum')) {
    return createLauncherError(LauncherErrorCode.MODPACK_HASH_MISMATCH, message, {
      retryable: true,
      recoverable: true,
      cause,
    });
  }

  if (message.includes('permission') || message.includes('denied')) {
    return createLauncherError(LauncherErrorCode.INSTALL_PERMISSION_DENIED, message, {
      severity: ErrorSeverity.CRITICAL,
      recoverable: false,
      cause,
    });
  }

  // Default to unknown error
  return createLauncherError(LauncherErrorCode.UNKNOWN, message, {
    recoverable: false,
    cause,
  });
}

/**
 * Type guard for LauncherError
 */
export function isLauncherError(error: unknown): error is LauncherError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'severity' in error &&
    'recoverable' in error &&
    'retryable' in error &&
    'timestamp' in error
  );
}

/**
 * Assert that an error is a LauncherError
 */
export function assertLauncherError(error: unknown): asserts error is LauncherError {
  if (!isLauncherError(error)) {
    throw new Error('Expected LauncherError');
  }
}

/**
 * Format a LauncherError for display
 */
export function formatLauncherError(error: LauncherError): string {
  const parts = [`[${error.code}] ${error.message}`];

  if (error.retryable) {
    parts.push('(Retryable)');
  }

  if (error.context) {
    parts.push(`Context: ${JSON.stringify(error.context)}`);
  }

  return parts.join(' ');
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: LauncherError): string {
  switch (error.code) {
    case LauncherErrorCode.NETWORK_ERROR:
      return 'Network error. Check your internet connection.';
    case LauncherErrorCode.NETWORK_TIMEOUT:
      return 'Connection timed out. Please try again.';
    case LauncherErrorCode.AUTH_FAILED:
      return 'Authentication failed. Please try logging in again.';
    case LauncherErrorCode.AUTH_EXPIRED:
      return 'Your session has expired. Please log in again.';
    case LauncherErrorCode.INSTALL_DISK_SPACE:
      return 'Insufficient disk space. Need at least 500MB free.';
    case LauncherErrorCode.INSTALL_PERMISSION_DENIED:
      return 'Permission denied. Check file permissions or run as administrator.';
    case LauncherErrorCode.MODPACK_HASH_MISMATCH:
      return 'Download corrupted. Retrying...';
    case LauncherErrorCode.SERVER_UNREACHABLE:
      return 'Server is unreachable. It may be offline.';
    case LauncherErrorCode.GAME_ALREADY_RUNNING:
      return 'Game is already running.';
    default:
      return error.message;
  }
}
