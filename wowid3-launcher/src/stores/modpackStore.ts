import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LauncherError } from '../types';

export interface ModpackFile {
  path: string;
  url: string;
  sha256: string;
  size: number;
}

export interface Manifest {
  version: string;
  minecraft_version: string;
  fabric_loader: string;
  files: ModpackFile[];
  changelog: string;
}

interface ModpackStoreState {
  installedVersion: string | null;
  latestManifest: Manifest | null;
  updateAvailable: boolean;
  isDownloading: boolean;
  isValidating: boolean;
  isVerifying: boolean;
  isBlockedForInstall: boolean;
  downloadProgress: {
    current: number;
    total: number;
  } | null;
  error: LauncherError | null;

  // Lifecycle tracking (previously refs in LauncherHome)
  hasCheckedForModpack: boolean;
  modpackCheckRetries: number;
  lastCheckAttempt: number;
  lastModpackError: LauncherError | null;

  // Actions
  setInstalledVersion: (version: string | null) => void;
  setLatestManifest: (manifest: Manifest | null) => void;
  setUpdateAvailable: (available: boolean) => void;
  setDownloading: (downloading: boolean) => void;
  setValidating: (validating: boolean) => void;
  setVerifying: (verifying: boolean) => void;
  setBlockedForInstall: (blocked: boolean) => void;
  setDownloadProgress: (current: number, total: number) => void;
  setError: (error: LauncherError | null) => void;
  setHasCheckedForModpack: (checked: boolean) => void;
  incrementCheckRetries: () => void;
  resetCheckRetries: () => void;
  setLastCheckAttempt: (timestamp: number) => void;
  setLastModpackError: (error: LauncherError | null) => void;
  reset: () => void;
}

export const useModpackStore = create<ModpackStoreState>()(
  persist(
    (set) => ({
      installedVersion: null,
      latestManifest: null,
      updateAvailable: false,
      isDownloading: false,
      isValidating: false,
      isVerifying: false,
      isBlockedForInstall: false,
      downloadProgress: null,
      error: null,

      // Lifecycle tracking
      hasCheckedForModpack: false,
      modpackCheckRetries: 0,
      lastCheckAttempt: 0,
      lastModpackError: null,

      setInstalledVersion: (version) => set({ installedVersion: version }),

      setLatestManifest: (manifest) => set({ latestManifest: manifest }),

      setUpdateAvailable: (available) => set({ updateAvailable: available }),

      setDownloading: (downloading) =>
        set({
          isDownloading: downloading,
          downloadProgress: downloading ? { current: 0, total: 0 } : null,
        }),

      setValidating: (validating) => set({ isValidating: validating }),

      setVerifying: (verifying) => set({ isVerifying: verifying }),

      setBlockedForInstall: (blocked) => set({ isBlockedForInstall: blocked }),

      setDownloadProgress: (current, total) =>
        set({ downloadProgress: { current, total } }),

      setError: (error) => set({ error }),

      setHasCheckedForModpack: (checked) => set({ hasCheckedForModpack: checked }),

      incrementCheckRetries: () =>
        set((state) => ({ modpackCheckRetries: state.modpackCheckRetries + 1 })),

      resetCheckRetries: () => set({ modpackCheckRetries: 0 }),

      setLastCheckAttempt: (timestamp) => set({ lastCheckAttempt: timestamp }),

      setLastModpackError: (error) => set({ lastModpackError: error }),

      reset: () =>
        set({
          downloadProgress: null,
          isDownloading: false,
          isValidating: false,
          isVerifying: false,
          isBlockedForInstall: false,
          error: null,
          modpackCheckRetries: 0,
        }),
    }),
    {
      name: 'wowid3-modpack-state',
      // Only persist installedVersion - other state is transient
      partialize: (state) => ({ installedVersion: state.installedVersion }),
    }
  )
);
