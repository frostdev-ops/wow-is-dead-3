import { create } from 'zustand';

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

interface ModpackState {
  installedVersion: string | null;
  latestManifest: Manifest | null;
  updateAvailable: boolean;
  isDownloading: boolean;
  isVerifying: boolean;
  isBlockedForInstall: boolean;
  downloadProgress: {
    current: number;
    total: number;
  } | null;
  error: string | null;

  // Actions
  setInstalledVersion: (version: string | null) => void;
  setLatestManifest: (manifest: Manifest | null) => void;
  setUpdateAvailable: (available: boolean) => void;
  setDownloading: (downloading: boolean) => void;
  setVerifying: (verifying: boolean) => void;
  setBlockedForInstall: (blocked: boolean) => void;
  setDownloadProgress: (current: number, total: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useModpackStore = create<ModpackState>((set) => ({
  installedVersion: null,
  latestManifest: null,
  updateAvailable: false,
  isDownloading: false,
  isVerifying: false,
  isBlockedForInstall: false,
  downloadProgress: null,
  error: null,

  setInstalledVersion: (version) => set({ installedVersion: version }),

  setLatestManifest: (manifest) => set({ latestManifest: manifest }),

  setUpdateAvailable: (available) => set({ updateAvailable: available }),

  setDownloading: (downloading) =>
    set({
      isDownloading: downloading,
      downloadProgress: downloading ? { current: 0, total: 0 } : null,
    }),

  setVerifying: (verifying) => set({ isVerifying: verifying }),

  setBlockedForInstall: (blocked) => set({ isBlockedForInstall: blocked }),

  setDownloadProgress: (current, total) =>
    set({ downloadProgress: { current, total } }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      downloadProgress: null,
      isDownloading: false,
      isVerifying: false,
      isBlockedForInstall: false,
      error: null,
    }),
}));
