/**
 * Standardized error handling for the launcher application
 */

export enum LauncherErrorCode {
  // Authentication errors (1xxx)
  AUTH_FAILED = 1001,
  AUTH_TOKEN_EXPIRED = 1002,
  AUTH_NETWORK_ERROR = 1003,
  AUTH_DEVICE_CODE_EXPIRED = 1004,
  AUTH_USER_CANCELLED = 1005,

  // Minecraft installation errors (2xxx)
  MC_VERSION_NOT_FOUND = 2001,
  MC_DOWNLOAD_FAILED = 2002,
  MC_INSTALL_FAILED = 2003,
  MC_ALREADY_RUNNING = 2004,
  MC_LAUNCH_FAILED = 2005,
  MC_JAVA_NOT_FOUND = 2006,

  // Modpack errors (3xxx)
  MODPACK_MANIFEST_INVALID = 3001,
  MODPACK_DOWNLOAD_FAILED = 3002,
  MODPACK_VERIFICATION_FAILED = 3003,
  MODPACK_UPDATE_REQUIRED = 3004,
  MODPACK_NOT_INSTALLED = 3005,

  // Network errors (4xxx)
  NETWORK_OFFLINE = 4001,
  NETWORK_TIMEOUT = 4002,
  NETWORK_SERVER_ERROR = 4003,
  NETWORK_INVALID_RESPONSE = 4004,

  // File system errors (5xxx)
  FS_PERMISSION_DENIED = 5001,
  FS_DISK_FULL = 5002,
  FS_FILE_NOT_FOUND = 5003,
  FS_CORRUPT_FILE = 5004,

  // Discord errors (6xxx)
  DISCORD_NOT_RUNNING = 6001,
  DISCORD_CONNECTION_FAILED = 6002,
  DISCORD_RPC_ERROR = 6003,

  // Audio errors (7xxx)
  AUDIO_DOWNLOAD_FAILED = 7001,
  AUDIO_PLAYBACK_FAILED = 7002,

  // Unknown errors
  UNKNOWN = 9999,
}

export class LauncherError extends Error {
  public readonly code: LauncherErrorCode;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: LauncherErrorCode,
    message: string,
    options: {
      recoverable?: boolean;
      retryable?: boolean;
      userMessage?: string;
      technicalDetails?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'LauncherError';
    this.code = code;
    this.recoverable = options.recoverable ?? this.isRecoverable(code);
    this.retryable = options.retryable ?? this.isRetryable(code);
    this.userMessage = options.userMessage ?? this.getDefaultUserMessage(code, message);
    this.technicalDetails = options.technicalDetails;
    this.context = options.context;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LauncherError);
    }
  }

  private isRecoverable(code: LauncherErrorCode): boolean {
    // Most errors are recoverable except for critical system issues
    const nonRecoverableCodes = [
      LauncherErrorCode.FS_DISK_FULL,
      LauncherErrorCode.FS_PERMISSION_DENIED,
      LauncherErrorCode.MC_JAVA_NOT_FOUND,
    ];
    return !nonRecoverableCodes.includes(code);
  }

  private isRetryable(code: LauncherErrorCode): boolean {
    // Network and download errors are typically retryable
    const retryableCodes = [
      LauncherErrorCode.NETWORK_OFFLINE,
      LauncherErrorCode.NETWORK_TIMEOUT,
      LauncherErrorCode.NETWORK_SERVER_ERROR,
      LauncherErrorCode.MC_DOWNLOAD_FAILED,
      LauncherErrorCode.MODPACK_DOWNLOAD_FAILED,
      LauncherErrorCode.DISCORD_CONNECTION_FAILED,
    ];
    return retryableCodes.includes(code);
  }

  private getDefaultUserMessage(code: LauncherErrorCode, message: string): string {
    const userMessages: Partial<Record<LauncherErrorCode, string>> = {
      [LauncherErrorCode.AUTH_FAILED]: 'Authentication failed. Please try logging in again.',
      [LauncherErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [LauncherErrorCode.AUTH_NETWORK_ERROR]: 'Unable to connect to authentication servers. Please check your internet connection.',
      [LauncherErrorCode.AUTH_DEVICE_CODE_EXPIRED]: 'The login code has expired. Please try again.',
      [LauncherErrorCode.AUTH_USER_CANCELLED]: 'Login was cancelled.',

      [LauncherErrorCode.MC_VERSION_NOT_FOUND]: 'The required Minecraft version was not found.',
      [LauncherErrorCode.MC_DOWNLOAD_FAILED]: 'Failed to download Minecraft files. Please try again.',
      [LauncherErrorCode.MC_INSTALL_FAILED]: 'Minecraft installation failed. Please check your disk space and try again.',
      [LauncherErrorCode.MC_ALREADY_RUNNING]: 'Minecraft is already running. Please close it before launching again.',
      [LauncherErrorCode.MC_LAUNCH_FAILED]: 'Failed to launch Minecraft. Please check the logs for details.',
      [LauncherErrorCode.MC_JAVA_NOT_FOUND]: 'Java runtime not found. Please reinstall the launcher.',

      [LauncherErrorCode.MODPACK_MANIFEST_INVALID]: 'The modpack configuration is invalid. Please contact support.',
      [LauncherErrorCode.MODPACK_DOWNLOAD_FAILED]: 'Failed to download modpack files. Please try again.',
      [LauncherErrorCode.MODPACK_VERIFICATION_FAILED]: 'Modpack verification failed. Files may be corrupted.',
      [LauncherErrorCode.MODPACK_UPDATE_REQUIRED]: 'A modpack update is required to play.',
      [LauncherErrorCode.MODPACK_NOT_INSTALLED]: 'The modpack is not installed. Please install it first.',

      [LauncherErrorCode.NETWORK_OFFLINE]: 'No internet connection. Please check your network.',
      [LauncherErrorCode.NETWORK_TIMEOUT]: 'Connection timed out. Please try again.',
      [LauncherErrorCode.NETWORK_SERVER_ERROR]: 'Server error. Please try again later.',
      [LauncherErrorCode.NETWORK_INVALID_RESPONSE]: 'Received invalid response from server.',

      [LauncherErrorCode.FS_PERMISSION_DENIED]: 'Permission denied. Please check folder permissions.',
      [LauncherErrorCode.FS_DISK_FULL]: 'Not enough disk space. Please free up space and try again.',
      [LauncherErrorCode.FS_FILE_NOT_FOUND]: 'Required file not found.',
      [LauncherErrorCode.FS_CORRUPT_FILE]: 'File is corrupted. Please verify and repair.',

      [LauncherErrorCode.DISCORD_NOT_RUNNING]: 'Discord is not running. Please start Discord to enable rich presence.',
      [LauncherErrorCode.DISCORD_CONNECTION_FAILED]: 'Failed to connect to Discord.',
      [LauncherErrorCode.DISCORD_RPC_ERROR]: 'Discord Rich Presence error.',

      [LauncherErrorCode.AUDIO_DOWNLOAD_FAILED]: 'Failed to download background music. Using fallback audio.',
      [LauncherErrorCode.AUDIO_PLAYBACK_FAILED]: 'Failed to play background music.',
    };

    return userMessages[code] ?? message;
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      retryable: this.retryable,
      technicalDetails: this.technicalDetails,
      context: this.context,
      stack: this.stack,
    };
  }

  public static isLauncherError(error: unknown): error is LauncherError {
    return error instanceof LauncherError;
  }

  public static from(error: unknown, defaultCode = LauncherErrorCode.UNKNOWN): LauncherError {
    if (LauncherError.isLauncherError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new LauncherError(defaultCode, error.message, {
        cause: error,
        technicalDetails: error.stack,
      });
    }

    if (typeof error === 'string') {
      return new LauncherError(defaultCode, error);
    }

    return new LauncherError(defaultCode, 'An unknown error occurred', {
      context: { originalError: error },
    });
  }
}

/**
 * Helper function to wrap async functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorCode: LauncherErrorCode
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw LauncherError.from(error, errorCode);
    }
  }) as T;
}

/**
 * Helper to retry operations with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => LauncherError.isLauncherError(error) ? error.retryable : true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}