import { useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { logger, LogCategory } from '../utils/logger';
import { LauncherError, LauncherErrorCode } from '../utils/errors';
import { useSettingsStore } from '../stores';
import {
  useInstalledVersion,
  useLatestManifest,
  useUpdateAvailable,
  useIsDownloading,
  useIsVerifying,
  useIsBlockedForInstall,
  useDownloadProgress,
  useModpackError,
  useModpackActions
} from '../stores/selectors';
import { checkForUpdates, getInstalledVersion, installModpack, verifyAndRepairModpack } from './useTauriCommands';
import { createRateLimiter } from '../utils/rateLimit';
import { POLLING_CONFIG } from '../config/polling';

export const useModpack = () => {
  const installedVersion = useInstalledVersion();
  const latestManifest = useLatestManifest();
  const updateAvailable = useUpdateAvailable();
  const isDownloading = useIsDownloading();
  const isVerifying = useIsVerifying();
  const isBlockedForInstall = useIsBlockedForInstall();
  const downloadProgress = useDownloadProgress();
  const error = useModpackError();

  const {
    setInstalledVersion,
    setLatestManifest,
    setUpdateAvailable,
    setDownloading,
    setVerifying,
    setBlockedForInstall,
    setDownloadProgress,
    setError,
    reset,
  } = useModpackActions();

  const gameDirectory = useSettingsStore(state => state.gameDirectory);
  const manifestUrl = useSettingsStore(state => state.manifestUrl);

  // Create rate-limited update checker
  const rateLimitedCheck = useMemo(() => 
    createRateLimiter(POLLING_CONFIG.MANIFEST_CHECK_INTERVAL)(checkForUpdates),
  []);

  // Check installed version on mount
  useEffect(() => {
    // CRITICAL: This effect must run to load installedVersion from disk
    logger.debug(LogCategory.MODPACK, 'useModpack effect triggered', { 
      metadata: { gameDirectory: gameDirectory || 'EMPTY' } 
    });
    
    // Don't run if gameDirectory isn't set yet
    if (!gameDirectory) {
      logger.debug(LogCategory.MODPACK, 'Skipping version check - gameDirectory not set');
      return;
    }
    
    const checkInstalled = async () => {
      try {
        logger.debug(LogCategory.MODPACK, 'Checking for .wowid3-version file', { 
          metadata: { gameDirectory } 
        });
        
        const version = await getInstalledVersion(gameDirectory);
        
        logger.debug(LogCategory.MODPACK, 'Version check complete', { 
          metadata: { 
            versionFromDisk: version || 'NULL',
            versionInStore: installedVersion || 'NULL' 
          } 
        });
        
        // Only update if we found a version, OR if store is empty
        // This prevents overwriting a valid version with null
        if (version) {
          logger.debug(LogCategory.MODPACK, `Modpack ${version} detected on disk`);
          setInstalledVersion(version);
        } else if (!installedVersion) {
          // Only set to null if store is also empty (first load scenario)
          logger.debug(LogCategory.MODPACK, 'No .wowid3-version file found');
          setInstalledVersion(null);
        } else {
          // File missing but store has version - keep the store version
          logger.debug(LogCategory.MODPACK, `.wowid3-version file missing, keeping store value: ${installedVersion}`);
        }
      } catch (err) {
        logger.error(LogCategory.MODPACK, 'Failed to check installed version', err instanceof Error ? err : new Error(String(err)));
      }
    };

    checkInstalled();
  }, [gameDirectory, installedVersion, setInstalledVersion]);

  const checkUpdates = useCallback(async () => {
    try {
      setError(null);
      
      // First, ensure we have the current installed version from disk
      // This is critical to avoid detecting "NOT_INSTALLED" when we actually have it
      logger.debug(LogCategory.MODPACK, 'Re-checking installed version before update check');
      const currentVersion = await getInstalledVersion(gameDirectory);
      if (currentVersion) {
        logger.info(LogCategory.MODPACK, 'Found installed version', { 
          metadata: { version: currentVersion } 
        });
        setInstalledVersion(currentVersion);
      }
      
      const manifest = await rateLimitedCheck(manifestUrl);
      setLatestManifest(manifest);

      // Check if update is available using the freshly loaded version
      const versionToCheck = currentVersion || installedVersion;
      if (versionToCheck && manifest.version !== versionToCheck) {
        logger.info(LogCategory.MODPACK, 'Update available', {
          metadata: { 
            installed: versionToCheck,
            latest: manifest.version 
          }
        });
        setUpdateAvailable(true);
      } else if (versionToCheck && manifest.version === versionToCheck) {
        logger.info(LogCategory.MODPACK, 'Modpack is up to date');
        setUpdateAvailable(false);
      } else {
        logger.info(LogCategory.MODPACK, 'No modpack installed');
        setUpdateAvailable(false); // Not technically an update if nothing is installed
      }

      return manifest;
    } catch (err) {
      const error = LauncherError.from(err, LauncherErrorCode.MODPACK_MANIFEST_INVALID);
      setError(error);
      throw err;
    }
  }, [manifestUrl, installedVersion, gameDirectory, setError, setLatestManifest, setUpdateAvailable, setInstalledVersion, rateLimitedCheck]);

  const install = useCallback(async (options?: { blockUi?: boolean }) => {
    if (!latestManifest) {
      throw new Error('No manifest available');
    }

    const blockUi = options?.blockUi ?? false;
    const previousVersion = installedVersion; // Capture for rollback

    try {
      // Use blocking state for required installs, downloading state for user-initiated installs
      if (blockUi) {
        setBlockedForInstall(true);
      } else {
        setDownloading(true);
      }
      setError(null);

      // Don't update installedVersion until validation succeeds to prevent race conditions
      // We keep updateAvailable true until finished to prevent UI flickering if using that to hide buttons
      
      // Listen for download progress events
      const unlisten = await listen<{
        current: number;
        total: number;
        filename: string;
        current_bytes: number;
        total_bytes: number;
      }>(
        'download-progress',
        (event) => {
          setDownloadProgress(event.payload.current_bytes, event.payload.total_bytes);
        }
      );

      try {
        await installModpack(latestManifest, gameDirectory);

        // Validate installation before updating state
        try {
          const actualVersion = await getInstalledVersion(gameDirectory);
          if (actualVersion !== latestManifest.version) {
            throw new Error(
              `Installation validation failed: expected ${latestManifest.version}, got ${actualVersion}`
            );
          }
          logger.info(LogCategory.MODPACK, 'Installation validated successfully');
        } catch (validationErr) {
          logger.error(LogCategory.MODPACK, 'Installation validation failed:', validationErr instanceof Error ? validationErr : new Error(String(validationErr)));
          throw new Error(
            `Installation completed but validation failed: ${validationErr instanceof Error ? validationErr.message : 'unknown error'}`
          );
        }

        // Update state to reflect successful installation
        setInstalledVersion(latestManifest.version); // CRITICAL: Update installed version so Play button works!
        setUpdateAvailable(false);

        // After install, run async verification and cleanup (silent, non-blocking)
        // Don't await this - let it run in background
        verifyAndRepairModpack(latestManifest, gameDirectory)
          .then(() => {
            logger.info(LogCategory.MODPACK, 'Post-install verification complete');
          })
          .catch((err) => {
            logger.error(LogCategory.MODPACK, 'Post-install verification failed:', err instanceof Error ? err : new Error(String(err)));
          });

        reset();
      } catch (err) {
        // ROLLBACK on failure
        setInstalledVersion(previousVersion);
        setUpdateAvailable(true);
        throw err;
      } finally {
        // Clean up event listener
        unlisten();
      }
    } catch (err) {
      const error = LauncherError.from(err, LauncherErrorCode.MODPACK_DOWNLOAD_FAILED);
      setError(error);
      throw err;
    } finally {
      if (blockUi) {
        setBlockedForInstall(false);
      } else {
        setDownloading(false);
      }
    }
  }, [latestManifest, gameDirectory, installedVersion, setBlockedForInstall, setDownloading, setError, setDownloadProgress, setInstalledVersion, setUpdateAvailable, reset]);

  const verifyAndRepair = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    try {
      // Use setVerifying for background checks, setDownloading for manual checks
      if (silent) {
        setVerifying(true);
      } else {
        setDownloading(true);
      }

      if (!silent) {
        setError(null);
      }

      // First fetch the latest manifest
      const manifest = await rateLimitedCheck(manifestUrl);

      if (!silent) {
        setLatestManifest(manifest);
      }

      // Listen for download progress events (only for non-silent checks)
      let unlisten: (() => void) | null = null;

      if (!silent) {
        unlisten = await listen<{
          current: number;
          total: number;
          filename: string;
          current_bytes: number;
          total_bytes: number;
        }>(
          'download-progress',
          (event) => {
            setDownloadProgress(event.payload.current_bytes, event.payload.total_bytes);
          }
        );
      }

      try {
        await verifyAndRepairModpack(manifest, gameDirectory);
        if (!silent) {
          logger.info(LogCategory.MODPACK, 'Verification and repair complete');
        }
      } finally {
        // Clean up event listener
        if (unlisten) {
          unlisten();
        }
      }
    } catch (err) {
      if (!silent) {
        const error = LauncherError.from(err, LauncherErrorCode.MODPACK_VERIFICATION_FAILED);
        setError(error);
        throw err;
      }
    } finally {
      if (silent) {
        setVerifying(false);
      } else {
        setDownloading(false);
      }
    }
  }, [manifestUrl, gameDirectory, setDownloading, setVerifying, setError, setLatestManifest, setDownloadProgress, rateLimitedCheck]);

  return {
    installedVersion,
    latestManifest,
    updateAvailable,
    isDownloading,
    isVerifying,
    isBlockedForInstall,
    downloadProgress,
    error,
    checkUpdates,
    install,
    verifyAndRepair,
  };
};
