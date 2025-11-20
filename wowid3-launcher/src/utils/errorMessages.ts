import { LauncherError, LauncherErrorCode } from '../types/errors';

/**
 * Get a user-friendly error message that doesn't expose internal details.
 *
 * @param error The error object (unknown type)
 * @returns A safe, localized error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  // specialized handling for known LauncherError types
  if (error instanceof LauncherError || (typeof error === 'object' && error !== null && 'code' in error)) {
    const code = (error as any).code;
    switch (code) {
      case LauncherErrorCode.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection.';
      case LauncherErrorCode.NETWORK_TIMEOUT:
        return 'Connection timed out. Please try again.';
      case LauncherErrorCode.AUTH_FAILED:
        return 'Authentication failed. Please try logging in again.';
      case LauncherErrorCode.AUTH_EXPIRED:
        return 'Your session has expired. Please log in again.';
      case LauncherErrorCode.INSTALL_FAILED:
        return 'Installation failed. Please try again or contact support.';
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
      // Add more specific error mappings as needed
    }
  }

  // Fallback for generic or unknown errors
  // We specifically avoid showing error.message or stack for unknown errors
  // to prevent information disclosure
  return 'An unexpected error occurred. Please try again.';
}

