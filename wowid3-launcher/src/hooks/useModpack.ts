import { useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { logger, LogCategory } from '../utils/logger';
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

  const { gameDirectory, manifestUrl } = useSettingsStore();

  // Create rate-limited update checker
  const rateLimitedCheck = useMemo(() => 
    createRateLimiter(POLLING_CONFIG.MANIFEST_CHECK_INTERVAL)(checkForUpdates),
  []);

  // Check installed version on mount
  useEffect(() => {
    const checkInstalled = async () => {
      try {
        const version = await getInstalledVersion(gameDirectory);
        setInstalledVersion(version);
      } catch (err) {
        logger.error(LogCategory.MODPACK, 'Failed to get installed version:', err instanceof Error ? err : new Error(String(err)));
      }
    };

    checkInstalled();
  }, [gameDirectory, setInstalledVersion]);

  const checkUpdates = useCallback(async () => {
    try {
      setError(null);
      const manifest = await rateLimitedCheck(manifestUrl);
      setLatestManifest(manifest);

      // Check if update is available
      if (installedVersion && manifest.version !== installedVersion) {
        setUpdateAvailable(true);
      }

      return manifest;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
      throw err;
    }
  }, [manifestUrl, installedVersion, setError, setLatestManifest, setUpdateAvailable, rateLimitedCheck]);

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

      // OPTIMISTIC UPDATE: Update version immediately to feel responsive
      setInstalledVersion(latestManifest.version);
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

        // Confirm update success
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
      setError(err instanceof Error ? err.message : 'Installation failed');
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
        setError(err instanceof Error ? err.message : 'Verification and repair failed');
      }
      if (!silent) {
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
