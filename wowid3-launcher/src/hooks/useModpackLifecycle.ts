import { useCallback, useReducer, useRef } from 'react';
import { useModpack } from './useModpack';
import { LauncherError, LauncherErrorCode, retryWithBackoff } from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';
import { RETRY_CONFIG } from '../config/constants';

export enum ModpackInstallPath {
  NOT_INSTALLED = 'NOT_INSTALLED',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  UP_TO_DATE = 'UP_TO_DATE',
}

interface ModpackLifecycleState {
  hasCheckedForModpack: boolean;
  isInstalling: boolean;
  isVerifying: boolean;
  checkAttempts: number;
  lastCheckTime: number;
  installPath: ModpackInstallPath;
  error: LauncherError | null;
  backgroundErrors: LauncherError[];
}

type ModpackLifecycleAction =
  | { type: 'START_CHECK' }
  | { type: 'CHECK_SUCCESS'; path: ModpackInstallPath }
  | { type: 'CHECK_FAILURE'; error: LauncherError }
  | { type: 'START_INSTALL' }
  | { type: 'INSTALL_SUCCESS' }
  | { type: 'INSTALL_FAILURE'; error: LauncherError }
  | { type: 'START_VERIFY' }
  | { type: 'VERIFY_COMPLETE' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'BACKGROUND_ERROR'; error: LauncherError }
  | { type: 'CLEAR_BACKGROUND_ERRORS' };

function modpackLifecycleReducer(
  state: ModpackLifecycleState,
  action: ModpackLifecycleAction
): ModpackLifecycleState {
  switch (action.type) {
    case 'START_CHECK':
      return {
        ...state,
        lastCheckTime: Date.now(),
      };
    case 'CHECK_SUCCESS':
      return {
        ...state,
        hasCheckedForModpack: true,
        checkAttempts: 0,
        installPath: action.path,
        error: null,
      };
    case 'CHECK_FAILURE':
      return {
        ...state,
        checkAttempts: state.checkAttempts + 1,
        error: action.error,
      };
    case 'START_INSTALL':
      return {
        ...state,
        isInstalling: true,
        error: null,
      };
    case 'INSTALL_SUCCESS':
      return {
        ...state,
        isInstalling: false,
        installPath: ModpackInstallPath.UP_TO_DATE,
      };
    case 'INSTALL_FAILURE':
      return {
        ...state,
        isInstalling: false,
        error: action.error,
      };
    case 'START_VERIFY':
      return {
        ...state,
        isVerifying: true,
      };
    case 'VERIFY_COMPLETE':
      return {
        ...state,
        isVerifying: false,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'BACKGROUND_ERROR':
      return {
        ...state,
        backgroundErrors: [...state.backgroundErrors, action.error],
      };
    case 'CLEAR_BACKGROUND_ERRORS':
      return {
        ...state,
        backgroundErrors: [],
      };
    default:
      return state;
  }
}


export interface UseModpackLifecycleReturn {
  state: ModpackLifecycleState;
  checkAndInstall: () => Promise<void>;
  performInstall: (options?: { blockUi?: boolean }) => Promise<void>;
  performVerify: (options?: { silent?: boolean }) => Promise<void>;
  clearError: () => void;
  clearBackgroundErrors: () => void;
}

/**
 * Hook for managing the modpack installation lifecycle
 * Handles checking for updates, installing, and verifying modpack files
 */
export function useModpackLifecycle(
  isAuthenticated: boolean,
  authLoading: boolean
): UseModpackLifecycleReturn {
  const {
    installedVersion,
    latestManifest,
    updateAvailable,
    isDownloading,
    checkUpdates,
    install,
    verifyAndRepair,
  } = useModpack();

  const [state, dispatch] = useReducer(modpackLifecycleReducer, {
    hasCheckedForModpack: false,
    isInstalling: false,
    isVerifying: false,
    checkAttempts: 0,
    lastCheckTime: 0,
    installPath: ModpackInstallPath.NOT_INSTALLED,
    error: null,
    backgroundErrors: [],
  });

  // Use refs to avoid dependency issues in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Determine the current installation path
   */
  const determineInstallPath = useCallback((): ModpackInstallPath => {
    logger.debug(LogCategory.MODPACK, 'Determining install path', {
      metadata: {
        installedVersion: installedVersion || 'null',
        latestVersion: latestManifest?.version || 'null',
        updateAvailable
      }
    });
    
    if (!installedVersion) {
      return ModpackInstallPath.NOT_INSTALLED;
    }
    if (updateAvailable && latestManifest && installedVersion !== latestManifest.version) {
      return ModpackInstallPath.UPDATE_AVAILABLE;
    }
    return ModpackInstallPath.UP_TO_DATE;
  }, [installedVersion, latestManifest, updateAvailable]);

  /**
   * Check for modpack updates with retry logic
   */
  const checkAndInstall = useCallback(async () => {
    // Use ref to get current state without dependency
    const currentState = stateRef.current;
    
    // Guard: Only run once per session after authentication
    if (currentState.hasCheckedForModpack) {
      logger.debug(LogCategory.MODPACK, 'Already checked for modpack');
      return;
    }

    // Guard: Wait for auth to complete
    if (!isAuthenticated || authLoading || isDownloading) {
      logger.debug(LogCategory.MODPACK, 'Waiting for authentication or download to complete');
      return;
    }

    // Exponential backoff
    const now = Date.now();
    const timeSinceLastAttempt = now - currentState.lastCheckTime;
    const backoffDelay = Math.min(
      Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, currentState.checkAttempts) * RETRY_CONFIG.BASE_DELAY,
      RETRY_CONFIG.MAX_DELAY
    );

    if (currentState.checkAttempts > 0 && timeSinceLastAttempt < backoffDelay) {
      const remainingWait = Math.ceil((backoffDelay - timeSinceLastAttempt) / 1000);
      logger.info(LogCategory.MODPACK, `Waiting ${remainingWait}s before retry`, {
        metadata: { attempt: currentState.checkAttempts + 1 },
      });
      return;
    }

    dispatch({ type: 'START_CHECK' });
    logger.info(LogCategory.MODPACK, 'Checking for modpack updates');

    try {
      await retryWithBackoff(
        async () => {
          await checkUpdates();
        },
        {
          maxAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
          baseDelay: RETRY_CONFIG.BASE_DELAY,
          maxDelay: RETRY_CONFIG.MAX_DELAY,
        }
      );

      const path = determineInstallPath();
      dispatch({ type: 'CHECK_SUCCESS', path });
      logger.info(LogCategory.MODPACK, 'Modpack check successful', {
        metadata: { path },
      });
    } catch (error) {
      const launcherError = LauncherError.from(error, LauncherErrorCode.NETWORK_TIMEOUT);
      dispatch({ type: 'CHECK_FAILURE', error: launcherError });
      logger.error(LogCategory.MODPACK, 'Failed to check for updates', launcherError, {
        metadata: { attempt: currentState.checkAttempts },
      });
    }
  }, [
    isAuthenticated,
    authLoading,
    isDownloading,
    checkUpdates,
    determineInstallPath,
  ]);

  /**
   * Perform modpack installation
   */
  const performInstall = useCallback(
    async (options?: { blockUi?: boolean }) => {
      const currentState = stateRef.current;
      
      if (currentState.isInstalling) {
        logger.warn(LogCategory.MODPACK, 'Installation already in progress');
        return;
      }

      dispatch({ type: 'START_INSTALL' });
      logger.info(LogCategory.MODPACK, 'Starting modpack installation', {
        metadata: { blockUi: options?.blockUi },
      });

      try {
        await install(options);
        dispatch({ type: 'INSTALL_SUCCESS' });
        logger.info(LogCategory.MODPACK, 'Modpack installed successfully');
      } catch (error) {
        const launcherError = LauncherError.from(error, LauncherErrorCode.MODPACK_DOWNLOAD_FAILED);
        dispatch({ type: 'INSTALL_FAILURE', error: launcherError });
        logger.error(LogCategory.MODPACK, 'Installation failed', launcherError);
        throw launcherError;
      }
    },
    [install]
  );

  /**
   * Perform modpack verification
   */
  const performVerify = useCallback(
    async (options?: { silent?: boolean }) => {
      const currentState = stateRef.current;
      
      if (currentState.isVerifying) {
        logger.warn(LogCategory.MODPACK, 'Verification already in progress');
        return;
      }

      dispatch({ type: 'START_VERIFY' });
      logger.info(LogCategory.MODPACK, 'Starting modpack verification', {
        metadata: { silent: options?.silent },
      });

      try {
        await verifyAndRepair(options);
        dispatch({ type: 'VERIFY_COMPLETE' });
        logger.info(LogCategory.MODPACK, 'Verification completed');
      } catch (error) {
        logger.error(LogCategory.MODPACK, 'Verification failed', error as Error);
        dispatch({ type: 'VERIFY_COMPLETE' });

        // Track background errors
        if (options?.silent) {
          const launcherError = LauncherError.from(error, LauncherErrorCode.MODPACK_VERIFICATION_FAILED);
          dispatch({ type: 'BACKGROUND_ERROR', error: launcherError });
        }

        // Don't throw for background verification
        if (!options?.silent) {
          throw error;
        }
      }
    },
    [verifyAndRepair]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const clearBackgroundErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_BACKGROUND_ERRORS' });
  }, []);

  /**
   * Smart installation logic based on modpack state
   * CRITICAL: This should only run ONCE after initial check completes
   */
  /**
   * Smart installation logic based on modpack state
   * DISABLED: This automatic install logic causes issues
   * Install/update should be triggered manually by user clicking Play button
   */
  // useEffect removed - install logic now handled by explicit user action in LauncherHome

  return {
    state,
    checkAndInstall,
    performInstall,
    performVerify,
    clearError,
    clearBackgroundErrors,
  };
}