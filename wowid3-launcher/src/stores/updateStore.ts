import { create } from 'zustand';

export interface LauncherUpdateInfo {
  available: boolean;
  version: string;
  mandatory: boolean;
  changelog: string;
  download_url: string;
  sha256: string;
}

export interface ModpackUpdateInfo {
  available: boolean;
  currentVersion: string;
  newVersion: string;
  changelog?: string;
}

interface UpdateState {
  // Launcher update state
  launcherUpdate: LauncherUpdateInfo | null;
  showLauncherUpdateModal: boolean;

  // Modpack update state
  modpackUpdate: ModpackUpdateInfo | null;
  showModpackUpdateDialog: boolean;

  // Actions
  setLauncherUpdate: (info: LauncherUpdateInfo | null) => void;
  setShowLauncherUpdateModal: (show: boolean) => void;
  setModpackUpdate: (info: ModpackUpdateInfo | null) => void;
  setShowModpackUpdateDialog: (show: boolean) => void;
  clearLauncherUpdate: () => void;
  clearModpackUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  // Initial state
  launcherUpdate: null,
  showLauncherUpdateModal: false,
  modpackUpdate: null,
  showModpackUpdateDialog: false,

  // Actions
  setLauncherUpdate: (info) => set({
    launcherUpdate: info,
    showLauncherUpdateModal: info?.available ?? false
  }),

  setShowLauncherUpdateModal: (show) => set({
    showLauncherUpdateModal: show
  }),

  setModpackUpdate: (info) => set({
    modpackUpdate: info,
    showModpackUpdateDialog: info?.available ?? false
  }),

  setShowModpackUpdateDialog: (show) => set({
    showModpackUpdateDialog: show
  }),

  clearLauncherUpdate: () => set({
    launcherUpdate: null,
    showLauncherUpdateModal: false
  }),

  clearModpackUpdate: () => set({
    modpackUpdate: null,
    showModpackUpdateDialog: false
  }),
}));
