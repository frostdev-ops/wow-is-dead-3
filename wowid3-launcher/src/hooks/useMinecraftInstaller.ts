import { useState, useEffect, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  listMinecraftVersions,
  getFabricLoaders,
  installMinecraft,
  isVersionInstalled,
} from './useTauriCommands';
import { useSettingsStore } from '../stores/settingsStore';
import { VersionInfo, FabricLoader, InstallProgress } from '../types/minecraft';
import { logger, LogCategory } from '../utils/logger';
import { LauncherError, LauncherErrorCode } from '../types/errors';

export interface UseMinecraftInstallerReturn {
  // Version management
  versions: VersionInfo[];
  selectedVersion: string | null;
  setSelectedVersion: (version: string) => void;
  isLoadingVersions: boolean;

  // Fabric management
  fabricEnabled: boolean;
  setFabricEnabled: (enabled: boolean) => void;
  fabricLoaders: FabricLoader[];
  selectedFabricLoader: string | null;
  setSelectedFabricLoader: (version: string) => void;
  isLoadingFabric: boolean;

  // Installation state
  isInstalled: boolean;
  isInstalling: boolean;
  installProgress: InstallProgress | null;
  error: string | null;

  // Actions
  loadVersions: () => Promise<void>;
  loadFabricLoaders: (gameVersion: string) => Promise<void>;
  install: () => Promise<void>;
  checkInstalled: (versionId: string) => Promise<boolean>;
  clearError: () => void;

  // Computed values
  versionId: string | null;  // The full version ID for launching (e.g., "fabric-loader-0.18.0-1.20.1")
}

export function useMinecraftInstaller(): UseMinecraftInstallerReturn {
  const {
    gameDirectory,
    minecraftVersion, // Store is the single source of truth
    fabricEnabled,
    fabricVersion,
    preferStableFabric,
    isMinecraftInstalled,
    setMinecraftVersion,
    setFabricEnabled: setSettingsFabricEnabled,
    setFabricVersion,
    setIsMinecraftInstalled,
  } = useSettingsStore();

  // Version state
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Fabric state
  const [fabricLoaders, setFabricLoaders] = useState<FabricLoader[]>([]);
  const [isLoadingFabric, setIsLoadingFabric] = useState(false);

  // Installation state
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Computed version ID
  const versionId = minecraftVersion
    ? fabricEnabled && fabricVersion
      ? `fabric-loader-${fabricVersion}-${minecraftVersion}`
      : minecraftVersion
    : null;

  // Load Minecraft versions (for display/reference only)
  const loadVersions = useCallback(async () => {
    try {
      setIsLoadingVersions(true);
      setError(null);

      const versionList = await listMinecraftVersions('release');
      setVersions(versionList);
    } catch (err) {
      setError(`Failed to load Minecraft versions: ${err}`);
      logger.error(LogCategory.MINECRAFT, 'Failed to load versions', err as Error);
    } finally {
      setIsLoadingVersions(false);
    }
  }, []);

  // Load Fabric loaders for a specific game version
  const loadFabricLoaders = useCallback(async (gameVersion: string) => {
    try {
      setIsLoadingFabric(true);
      setError(null);

      const loaders = await getFabricLoaders(gameVersion);

      // Filter to stable versions if preferred
      const filteredLoaders = preferStableFabric
        ? loaders.filter((loader) => loader.stable)
        : loaders;

      setFabricLoaders(filteredLoaders);
    } catch (err) {
      setError(`Failed to load Fabric loaders: ${err}`);
      logger.error(LogCategory.MINECRAFT, 'Failed to load Fabric loaders', err as Error);
    } finally {
      setIsLoadingFabric(false);
    }
  }, [preferStableFabric]);

  // Check if version is installed
  const checkInstalled = useCallback(
    async (verId: string) => {
      try {
        const installed = await isVersionInstalled(gameDirectory, verId);
        setIsMinecraftInstalled(installed);
        return installed;
      } catch (err) {
        logger.error(LogCategory.MINECRAFT, 'Failed to check installation', err as Error);
        return false;
      }
    },
    [gameDirectory, setIsMinecraftInstalled]
  );

  // Install Minecraft
  const install = useCallback(async () => {
    if (!minecraftVersion) {
      setError('No Minecraft version selected');
      return;
    }

    try {
      setIsInstalling(true);
      setError(null);
      setInstallProgress(null);

      const config = {
        game_version: minecraftVersion,
        fabric_version: fabricEnabled ? fabricVersion || undefined : undefined,
        game_dir: gameDirectory,
      };

      await installMinecraft(config);

      // Check installation status
      if (versionId) {
        await checkInstalled(versionId);
      }

      logger.info(LogCategory.MINECRAFT, 'Installation complete!');
    } catch (err) {
      const errorMessage = String(err);
      const launcherError = LauncherError.from(err, LauncherErrorCode.INSTALL_FAILED);
      
      // Handle common errors
      if (errorMessage.includes('Failed to fetch')) {
        setError('Network error. Check your internet connection.');
      } else if (errorMessage.includes('No space left')) {
        setError('Insufficient disk space. Need ~500MB free.');
      } else if (errorMessage.includes('SHA1 mismatch')) {
        setError('Download corrupted. Please try again.');
      } else {
        setError(`Installation failed: ${errorMessage}`);
      }

      logger.error(LogCategory.MINECRAFT, 'Installation failed', launcherError);
    } finally {
      setIsInstalling(false);
      setInstallProgress(null);
    }
  }, [minecraftVersion, fabricEnabled, fabricVersion, gameDirectory, versionId, checkInstalled]);

  // Actions (Pure setters now)
  const setSelectedVersion = useCallback(
    (version: string) => {
      setMinecraftVersion(version);
    },
    [setMinecraftVersion]
  );

  const setFabricEnabled = useCallback(
    (enabled: boolean) => {
      setSettingsFabricEnabled(enabled);
    },
    [setSettingsFabricEnabled]
  );

  const setSelectedFabricLoader = useCallback(
    (version: string) => {
      setFabricVersion(version);
    },
    [setFabricVersion]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Side Effects

  // 1. Listen for installation progress
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<InstallProgress>('minecraft-install-progress', (event) => {
        setInstallProgress(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 2. Auto-load versions on mount
  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // 3. Load Fabric loaders when version or fabric enabled state changes
  useEffect(() => {
    if (fabricEnabled && minecraftVersion) {
      loadFabricLoaders(minecraftVersion);
    }
  }, [minecraftVersion, fabricEnabled, loadFabricLoaders]);

  // 4. Check installation status when versionId changes
  useEffect(() => {
    if (versionId) {
      checkInstalled(versionId);
    }
  }, [versionId, checkInstalled]);

  return {
    // Version management
    versions,
    selectedVersion: minecraftVersion,
    setSelectedVersion,
    isLoadingVersions,

    // Fabric management
    fabricEnabled,
    setFabricEnabled,
    fabricLoaders,
    selectedFabricLoader: fabricVersion,
    setSelectedFabricLoader,
    isLoadingFabric,

    // Installation state
    isInstalled: isMinecraftInstalled,
    isInstalling,
    installProgress,
    error,

    // Actions
    loadVersions,
    loadFabricLoaders,
    install,
    checkInstalled,
    clearError,

    // Computed values
    versionId,
  };
}
