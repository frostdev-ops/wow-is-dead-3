import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useModpackStore, useSettingsStore } from '../stores';
import { checkForUpdates, getInstalledVersion, installModpack } from './useTauriCommands';

export const useModpack = () => {
  const {
    installedVersion,
    latestManifest,
    updateAvailable,
    isDownloading,
    downloadProgress,
    error,
    setInstalledVersion,
    setLatestManifest,
    setUpdateAvailable,
    setDownloading,
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
        if (installedVersion && manifest.version !== installedVersion) {
          console.log('[Modpack] Update available:', manifest.version);
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
  }, [manifestUrl, installedVersion, setLatestManifest, setUpdateAvailable]);

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

  const install = async () => {
    if (!latestManifest) {
      throw new Error('No manifest available');
    }

    try {
      setDownloading(true);
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
        reset();
      } finally {
        // Clean up event listener
        unlisten();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      throw err;
    } finally {
      setDownloading(false);
    }
  };

  return {
    installedVersion,
    latestManifest,
    updateAvailable,
    isDownloading,
    downloadProgress,
    error,
    checkUpdates,
    install,
  };
};
