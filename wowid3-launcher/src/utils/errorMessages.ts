import { LauncherError } from './errors';

/**
 * Get a user-friendly error message that doesn't expose internal details.
 *
 * @param error The error object (unknown type)
 * @returns A safe, localized error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  // Use LauncherError's built-in userMessage if available
  if (LauncherError.isLauncherError(error)) {
    return error.userMessage;
  }

  // Fallback for generic or unknown errors
  // We specifically avoid showing error.message or stack for unknown errors
  // to prevent information disclosure
  return 'An unexpected error occurred. Please try again.';
}

