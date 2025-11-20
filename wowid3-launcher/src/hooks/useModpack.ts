import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useModpackStore, useSettingsStore } from '../stores';
import { checkForUpdates, getInstalledVersion, installModpack, verifyAndRepairModpack, hasManifestChanged } from './useTauriCommands';

export const useModpack = () => {
  const {
    installedVersion,
    latestManifest,
    updateAvailable,
    isDownloading,
    isVerifying,
    isBlockedForInstall,
    downloadProgress,
    error,
    setInstalledVersion,
    setLatestManifest,
    setUpdateAvailable,
    setDownloading,
    setVerifying,
    setBlockedForInstall,
    setDownloadProgress,
    setError,
    reset,
  } = useModpackStore();

  const { gameDirectory, manifestUrl } = useSettingsStore();

  // Check installed version on mount
  useEffect(() => {
    const checkInstalled = async () => {
      try {
        const version = await getInstalledVersion(gameDirectory);
        setInstalledVersion(version);
      } catch (err) {
        console.error('Failed to get installed version:', err);
      }
    };

    checkInstalled();
  }, [gameDirectory, setInstalledVersion]);

  // Poll for updates every 5 minutes
  useEffect(() => {
    const pollForUpdates = async () => {
      try {
        console.log('[Modpack] Polling for updates...');
        const manifest = await checkForUpdates(manifestUrl);
        setLatestManifest(manifest);

        // Check if update is available
        const versionChanged = installedVersion && manifest.version !== installedVersion;

        // Also check if manifest has changed (file hashes changed even if version same)
        let manifestHasChanged = false;
        if (installedVersion && !versionChanged) {
          try {
            manifestHasChanged = await hasManifestChanged(manifest, gameDirectory);
          } catch (err) {
            console.warn('[Modpack] Could not check manifest changes:', err);
          }
        }

        if (versionChanged || manifestHasChanged) {
          if (versionChanged) {
            console.log('[Modpack] Update available:', manifest.version);
          } else {
            console.log('[Modpack] Manifest changed (files updated)');
          }
          setUpdateAvailable(true);
        } else {
          setUpdateAvailable(false);
        }
      } catch (err) {
        console.error('[Modpack] Update check failed:', err);
      }
    };

    // Check immediately on mount
    pollForUpdates();

    // Then poll every 5 minutes
    const interval = setInterval(pollForUpdates, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [manifestUrl, installedVersion, gameDirectory, setLatestManifest, setUpdateAvailable]);

  const checkUpdates = useCallback(async () => {
    try {
      setError(null);
      const manifest = await checkForUpdates(manifestUrl);
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
  }, [manifestUrl, installedVersion, setError, setLatestManifest, setUpdateAvailable]);

  const install = useCallback(async (options?: { blockUi?: boolean }) => {
    if (!latestManifest) {
      throw new Error('No manifest available');
    }

    const blockUi = options?.blockUi ?? false;

    try {
      // Use blocking state for required installs, downloading state for user-initiated installs
      if (blockUi) {
        setBlockedForInstall(true);
      } else {
        setDownloading(true);
      }
      setError(null);

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

        setInstalledVersion(latestManifest.version);
        setUpdateAvailable(false);

        // After install, run async verification and cleanup (silent, non-blocking)
        // Don't await this - let it run in background
        verifyAndRepairModpack(latestManifest, gameDirectory)
          .then(() => {
            console.log('[Install] Post-install verification complete');
          })
          .catch((err) => {
            console.error('[Install] Post-install verification failed:', err);
          });

        reset();
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
  }, [latestManifest, gameDirectory, setBlockedForInstall, setDownloading, setError, setDownloadProgress, setInstalledVersion, setUpdateAvailable, reset]);

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
      const manifest = await checkForUpdates(manifestUrl);

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
          console.log('[Modpack] Verification and repair complete');
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
  }, [manifestUrl, gameDirectory, setDownloading, setVerifying, setError, setLatestManifest, setDownloadProgress]);

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
