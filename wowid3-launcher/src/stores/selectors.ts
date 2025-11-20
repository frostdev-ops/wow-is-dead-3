/**
 * Performance-optimized store selectors to prevent unnecessary re-renders
 * These selectors allow components to subscribe to specific store slices
 */

import { useAuthStore } from './authStore';
import { useModpackStore } from './modpackStore';
import { useServerStore } from './serverStore';
import { useSettingsStore } from './settingsStore';
import { useAudioStore } from './audioStore';
import { useUIStore } from './uiStore';
import { useMemo } from 'react';
import { shallow } from 'zustand/shallow';

// Helper type for actions
type ActionSelector<T, U> = (state: T) => U;

// Auth Store Selectors
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthActions = () => useAuthStore((state) => ({
  setUser: state.setUser,
  setLoading: state.setLoading,
  setError: state.setError,
  logout: state.logout,
}), shallow);

// Modpack Store Selectors
export const useInstalledVersion = () => useModpackStore((state) => state.installedVersion);
export const useLatestManifest = () => useModpackStore((state) => state.latestManifest);
export const useUpdateAvailable = () => useModpackStore((state) => state.updateAvailable);
export const useIsDownloading = () => useModpackStore((state) => state.isDownloading);
export const useIsVerifying = () => useModpackStore((state) => state.isVerifying);
export const useIsBlockedForInstall = () => useModpackStore((state) => state.isBlockedForInstall);
export const useDownloadProgress = () => useModpackStore((state) => state.downloadProgress);
export const useModpackError = () => useModpackStore((state) => state.error);

export const useModpackActions = () => useModpackStore((state) => ({
  setInstalledVersion: state.setInstalledVersion,
  setLatestManifest: state.setLatestManifest,
  setUpdateAvailable: state.setUpdateAvailable,
  setDownloading: state.setDownloading,
  setVerifying: state.setVerifying,
  setBlockedForInstall: state.setBlockedForInstall,
  setDownloadProgress: state.setDownloadProgress,
  setError: state.setError,
  reset: state.reset,
}), shallow) as Pick<typeof useModpackStore extends { getState: () => infer S } ? S : never, 
  'setInstalledVersion' | 'setLatestManifest' | 'setUpdateAvailable' | 'setDownloading' | 
  'setVerifying' | 'setBlockedForInstall' | 'setDownloadProgress' | 'setError' | 'reset'>;

// Computed selectors that derive state
export const useModpackStatus = () => {
  const isDownloading = useIsDownloading();
  const isVerifying = useIsVerifying();
  const isBlockedForInstall = useIsBlockedForInstall();
  const updateAvailable = useUpdateAvailable();

  return useMemo(() => ({
    isBusy: isDownloading || isVerifying || isBlockedForInstall,
    needsUpdate: updateAvailable && !isDownloading && !isVerifying,
    isReady: !isDownloading && !isVerifying && !isBlockedForInstall && !updateAvailable,
  }), [isDownloading, isVerifying, isBlockedForInstall, updateAvailable]);
};

// Server Store Selectors
export const useServerStatus = () => useServerStore((state) => state.status);
export const useServerPlayerCount = () => useServerStore((state) => state.status.player_count);
export const useServerMaxPlayers = () => useServerStore((state) => state.status.max_players);
export const useServerIsPolling = () => useServerStore((state) => state.isPolling);
export const useServerError = () => useServerStore((state) => state.error);
export const useServerActions = () => useServerStore((state) => ({
  setStatus: state.setStatus,
  setPolling: state.setPolling,
  setError: state.setError,
}), shallow) as Pick<typeof useServerStore extends { getState: () => infer S } ? S : never, 
  'setStatus' | 'setPolling' | 'setError'>;

// Settings Store Selectors (commonly used settings)
export const useRamAllocation = () => useSettingsStore((state) => state.ramAllocation);
export const useGameDirectory = () => useSettingsStore((state) => state.gameDirectory);
export const useKeepLauncherOpen = () => useSettingsStore((state) => state.keepLauncherOpen);
export const useManifestUrl = () => useSettingsStore((state) => state.manifestUrl);
export const useServerAddress = () => useSettingsStore((state) => state.serverAddress);
export const useTheme = () => useSettingsStore((state) => state.theme);

export const useSettingsActions = () => useSettingsStore((state) => ({
  setRamAllocation: state.setRamAllocation,
  setGameDirectory: state.setGameDirectory,
  setKeepLauncherOpen: state.setKeepLauncherOpen,
  setManifestUrl: state.setManifestUrl,
  setServerAddress: state.setServerAddress,
  setTheme: state.setTheme,
}), shallow);

// Audio Store Selectors
export const useIsMuted = () => useAudioStore((state) => state.isMuted);
export const useVolume = () => useAudioStore((state) => state.volume);
export const useIsPlaying = () => useAudioStore((state) => state.isPlaying);
export const useAudioActions = () => useAudioStore((state) => ({
  setMuted: state.setMuted,
  setVolume: state.setVolume,
  setPlaying: state.setPlaying,
  setWasPaused: state.setWasPaused,
}), shallow);

// UI Store Selectors
export const useShowLogViewer = () => useUIStore((state) => state.showLogViewer);
export const useActiveModal = () => useUIStore((state) => state.activeModal);
export const useIsLoading = () => useUIStore((state) => state.isLoading);
export const useLoadingMessage = () => useUIStore((state) => state.loadingMessage);
export const useUIActions = () => useUIStore((state) => ({
  setShowLogViewer: state.setShowLogViewer,
  setActiveModal: state.setActiveModal,
  setLoading: state.setLoading,
}), shallow);

// Complex computed selectors for play button state
export const usePlayButtonState = () => {
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthUser();
  const installedVersion = useInstalledVersion();
  const updateAvailable = useUpdateAvailable();
  const isDownloading = useIsDownloading();
  const isVerifying = useIsVerifying();
  const isBlockedForInstall = useIsBlockedForInstall();

  return useMemo(() => {
    const canPlay = isAuthenticated && user && installedVersion && !updateAvailable;
    const isBusy = isDownloading || isVerifying || isBlockedForInstall;

    let buttonText = 'Play';
    let buttonDisabled = !canPlay || isBusy;

    if (!isAuthenticated || !user) {
      buttonText = 'Login to Play';
      buttonDisabled = true;
    } else if (!installedVersion) {
      buttonText = 'Install Modpack';
      buttonDisabled = isBusy;
    } else if (updateAvailable) {
      buttonText = 'Update Available';
      buttonDisabled = isBusy;
    } else if (isDownloading) {
      buttonText = 'Downloading...';
      buttonDisabled = true;
    } else if (isVerifying) {
      buttonText = 'Verifying...';
      buttonDisabled = true;
    } else if (isBlockedForInstall) {
      buttonText = 'Installing...';
      buttonDisabled = true;
    }

    return {
      text: buttonText,
      disabled: buttonDisabled,
      canPlay,
      needsAction: !canPlay && !isBusy,
    };
  }, [isAuthenticated, user, installedVersion, updateAvailable, isDownloading, isVerifying, isBlockedForInstall]);
};