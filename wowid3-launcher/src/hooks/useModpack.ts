import { useEffect } from 'react';
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

  const checkUpdates = async () => {
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
  };

  const install = async () => {
    if (!latestManifest) {
      throw new Error('No manifest available');
    }

    try {
      setDownloading(true);
      setError(null);

      await installModpack(latestManifest, gameDirectory);

      setInstalledVersion(latestManifest.version);
      setUpdateAvailable(false);
      reset();
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
