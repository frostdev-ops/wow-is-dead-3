import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { logger, LogCategory } from '../utils/logger';

export interface UseWindowManagerReturn {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  centerWindow: () => Promise<void>;
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
}

/**
 * Hook for managing the application window
 */
export function useWindowManager(): UseWindowManagerReturn {
  const minimizeWindow = useCallback(async () => {
    try {
      const appWindow = await getCurrentWindow();
      await appWindow.minimize();
      logger.info(LogCategory.WINDOW, 'Window minimized');
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to minimize window', error as Error);
      throw error;
    }
  }, []);

  const maximizeWindow = useCallback(async () => {
    try {
      const appWindow = await getCurrentWindow();
      await appWindow.maximize();
      logger.info(LogCategory.WINDOW, 'Window maximized');
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to maximize window', error as Error);
      throw error;
    }
  }, []);

  const showWindow = useCallback(async () => {
    try {
      const appWindow = await getCurrentWindow();
      await appWindow.show();
      await appWindow.setFocus();
      logger.info(LogCategory.WINDOW, 'Window shown and focused');
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to show window', error as Error);
      throw error;
    }
  }, []);

  const hideWindow = useCallback(async () => {
    try {
      const appWindow = await getCurrentWindow();
      await appWindow.hide();
      logger.info(LogCategory.WINDOW, 'Window hidden');
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to hide window', error as Error);
      throw error;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const appWindow = await getCurrentWindow();
      const isFullscreen = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!isFullscreen);
      logger.info(LogCategory.WINDOW, `Fullscreen ${!isFullscreen ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to toggle fullscreen', error as Error);
      throw error;
    }
  }, []);

  const centerWindow = useCallback(async () => {
    try {
      const appWindow = await getCurrentWindow();
      await appWindow.center();
      logger.info(LogCategory.WINDOW, 'Window centered');
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to center window', error as Error);
      throw error;
    }
  }, []);

  const setAlwaysOnTop = useCallback(async (alwaysOnTop: boolean) => {
    try {
      const appWindow = await getCurrentWindow();
      await appWindow.setAlwaysOnTop(alwaysOnTop);
      logger.info(LogCategory.WINDOW, `Always on top ${alwaysOnTop ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error(LogCategory.WINDOW, 'Failed to set always on top', error as Error);
      throw error;
    }
  }, []);

  return {
    minimizeWindow,
    maximizeWindow,
    showWindow,
    hideWindow,
    toggleFullscreen,
    centerWindow,
    setAlwaysOnTop,
  };
}