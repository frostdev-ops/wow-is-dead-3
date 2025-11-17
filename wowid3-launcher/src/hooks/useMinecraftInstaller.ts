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
    minecraftVersion,
    fabricEnabled: settingsFabricEnabled,
    fabricVersion,
    preferStableFabric,
    setMinecraftVersion,
    setFabricEnabled: setSettingsFabricEnabled,
    setFabricVersion,
  } = useSettingsStore();

  // Version state
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selectedVersion, setSelectedVersionState] = useState<string | null>(minecraftVersion);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Fabric state
  const [fabricEnabled, setFabricEnabledState] = useState(settingsFabricEnabled);
  const [fabricLoaders, setFabricLoaders] = useState<FabricLoader[]>([]);
  const [selectedFabricLoader, setSelectedFabricLoaderState] = useState<string | null>(fabricVersion);
  const [isLoadingFabric, setIsLoadingFabric] = useState(false);

  // Installation state
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Computed version ID
  const versionId = selectedVersion
    ? fabricEnabled && selectedFabricLoader
      ? `fabric-loader-${selectedFabricLoader}-${selectedVersion}`
      : selectedVersion
    : null;

  // Load Minecraft versions (for display/reference only)
  const loadVersions = useCallback(async () => {
    try {
      setIsLoadingVersions(true);
      setError(null);

      const versionList = await listMinecraftVersions('release');
      setVersions(versionList);

      // Note: Version is now preset from settingsStore defaults (1.20.1)
      // No auto-selection needed as versions are driven by modpack requirements
    } catch (err) {
      setError(`Failed to load Minecraft versions: ${err}`);
      console.error('[MinecraftInstaller] Failed to load versions:', err);
    } finally {
      setIsLoadingVersions(false);
    }
  }, []);

  // Load Fabric loaders for a specific game version (for display/reference only)
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

      // Note: Fabric loader version is now preset from settingsStore defaults (0.17.3)
      // No auto-selection needed as versions are driven by modpack requirements
    } catch (err) {
      setError(`Failed to load Fabric loaders: ${err}`);
      console.error('[MinecraftInstaller] Failed to load Fabric loaders:', err);
    } finally {
      setIsLoadingFabric(false);
    }
  }, [preferStableFabric]);

  // Check if version is installed
  const checkInstalled = useCallback(
    async (verId: string) => {
      try {
        const installed = await isVersionInstalled(gameDirectory, verId);
        setIsInstalled(installed);
        return installed;
      } catch (err) {
        console.error('[MinecraftInstaller] Failed to check installation:', err);
        return false;
      }
    },
    [gameDirectory]
  );

  // Install Minecraft
  const install = useCallback(async () => {
    if (!selectedVersion) {
      setError('No Minecraft version selected');
      return;
    }

    try {
      setIsInstalling(true);
      setError(null);
      setInstallProgress(null);

      const config = {
        game_version: selectedVersion,
        fabric_version: fabricEnabled ? selectedFabricLoader || undefined : undefined,
        game_dir: gameDirectory,
      };

      await installMinecraft(config);

      // Check installation status
      if (versionId) {
        await checkInstalled(versionId);
      }

      console.log('[MinecraftInstaller] Installation complete!');
    } catch (err) {
      const errorMessage = String(err);

      // Handle common errors
      if (errorMessage.includes('Failed to fetch')) {
        setError('Network error. Check your internet connection.');
      } else if (errorMessage.includes('No space left')) {
        setError('Insufficient disk space. Need ~500MB free.');
      } else if (errorMessage.includes('SHA1 mismatch')) {
        setError('Download corrupted. Please try again.');
      } else if (errorMessage.includes('not found in manifest')) {
        setError('Minecraft version not available.');
      } else {
        setError(`Installation failed: ${errorMessage}`);
      }

      console.error('[MinecraftInstaller] Installation failed:', err);
    } finally {
      setIsInstalling(false);
      setInstallProgress(null);
    }
  }, [selectedVersion, fabricEnabled, selectedFabricLoader, gameDirectory, versionId, checkInstalled]);

  // Set selected version (with persistence)
  const setSelectedVersion = useCallback(
    (version: string) => {
      setSelectedVersionState(version);
      setMinecraftVersion(version);

      // Load Fabric loaders if Fabric is enabled
      if (fabricEnabled) {
        loadFabricLoaders(version);
      }

      // Check if this version is installed
      const verId = fabricEnabled && selectedFabricLoader
        ? `fabric-loader-${selectedFabricLoader}-${version}`
        : version;
      checkInstalled(verId);
    },
    [fabricEnabled, selectedFabricLoader, setMinecraftVersion, loadFabricLoaders, checkInstalled]
  );

  // Set Fabric enabled (with persistence)
  const setFabricEnabled = useCallback(
    (enabled: boolean) => {
      setFabricEnabledState(enabled);
      setSettingsFabricEnabled(enabled);

      // Load Fabric loaders if enabled and version is selected
      if (enabled && selectedVersion) {
        loadFabricLoaders(selectedVersion);
      }

      // Re-check installation status
      if (selectedVersion) {
        const verId = enabled && selectedFabricLoader
          ? `fabric-loader-${selectedFabricLoader}-${selectedVersion}`
          : selectedVersion;
        checkInstalled(verId);
      }
    },
    [selectedVersion, selectedFabricLoader, setSettingsFabricEnabled, loadFabricLoaders, checkInstalled]
  );

  // Set selected Fabric loader (with persistence)
  const setSelectedFabricLoader = useCallback(
    (version: string) => {
      setSelectedFabricLoaderState(version);
      setFabricVersion(version);

      // Re-check installation status
      if (selectedVersion) {
        const verId = `fabric-loader-${version}-${selectedVersion}`;
        checkInstalled(verId);
      }
    },
    [selectedVersion, setFabricVersion, checkInstalled]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Listen for installation progress events
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<InstallProgress>('minecraft-install-progress', (event) => {
        setInstallProgress(event.payload);
        console.log(`[MinecraftInstaller] Progress: ${event.payload.step} - ${event.payload.message}`);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Auto-load versions on mount
  useEffect(() => {
    loadVersions();
  }, []);

  // Auto-check installation status when version changes
  useEffect(() => {
    if (versionId) {
      checkInstalled(versionId);
    }
  }, [versionId]);

  return {
    // Version management
    versions,
    selectedVersion,
    setSelectedVersion,
    isLoadingVersions,

    // Fabric management
    fabricEnabled,
    setFabricEnabled,
    fabricLoaders,
    selectedFabricLoader,
    setSelectedFabricLoader,
    isLoadingFabric,

    // Installation state
    isInstalled,
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
