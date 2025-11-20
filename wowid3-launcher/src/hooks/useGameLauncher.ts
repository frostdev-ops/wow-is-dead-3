import { useState, useEffect, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { launchGameWithMetadata, isGameRunning } from './useTauriCommands';
import { useSettingsStore } from '../stores/settingsStore';
import { useAudioStore } from '../stores/audioStore';
import { useUIStore } from '../stores/uiStore';
import { LauncherError, LauncherErrorCode } from '../utils/errors';
import { logger, LogCategory } from '../utils/logger';
import { POLLING_INTERVALS } from '../config/constants';

export interface GameLauncherState {
  isLaunching: boolean;
  isPlaying: boolean;
  exitCode: number | null;
  crashed: boolean;
  error: LauncherError | null;
}

export interface UseGameLauncherReturn extends GameLauncherState {
  launchGame: (params: GameLaunchParams) => Promise<void>;
  checkGameStatus: () => Promise<boolean>;
  clearError: () => void;
}

export interface GameLaunchParams {
  username: string;
  uuid: string;
  accessToken: string;
  versionId: string;
}

export interface MinecraftLogEvent {
  level: string;
  message: string;
}

export interface MinecraftExitEvent {
  exit_code: number;
  crashed: boolean;
}

export interface MinecraftCrashEvent {
  message: string;
}

/**
 * Hook for managing Minecraft game launching and lifecycle
 */
export function useGameLauncher(): UseGameLauncherReturn {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [crashed, setCrashed] = useState(false);
  const [error, setError] = useState<LauncherError | null>(null);

  const { ramAllocation, gameDirectory, keepLauncherOpen } = useSettingsStore();
  const { pauseForGame } = useAudioStore();
  const { setShowLogViewer } = useUIStore();

  /**
   * Launch the game with the provided parameters
   */
  const launchGame = useCallback(
    async (params: GameLaunchParams) => {
      logger.info(LogCategory.MINECRAFT, 'Launching Minecraft', {
        action: 'launch',
        metadata: {
          username: params.username,
          versionId: params.versionId,
          ram: ramAllocation,
        },
      });

      try {
        setIsLaunching(true);
        setError(null);

        // Check if game is already running
        const alreadyRunning = await isGameRunning();
        if (alreadyRunning) {
          throw new LauncherError(
            LauncherErrorCode.MC_ALREADY_RUNNING,
            'Minecraft is already running'
          );
        }

        // Pause and mute background music via audio store
        pauseForGame();

        // Handle window based on settings
        if (!keepLauncherOpen) {
          // Minimize the launcher window
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = await getCurrentWindow();
            await appWindow.minimize();
            logger.info(LogCategory.WINDOW, 'Launcher window minimized');
          } catch (err) {
            logger.error(LogCategory.WINDOW, 'Failed to minimize window', err as Error);
          }
        } else {
          // Show log viewer
          logger.info(LogCategory.UI, 'Showing log viewer');
          setShowLogViewer(true);
        }

        // Launch the game
        await launchGameWithMetadata(
          {
            ram_mb: ramAllocation,
            game_dir: gameDirectory,
            username: params.username,
            uuid: params.uuid,
            session_id: params.accessToken, // Backend expects session_id
          },
          params.versionId
        );

        setIsLaunching(false);
        setIsPlaying(true);
        logger.info(LogCategory.MINECRAFT, 'Game launched successfully');
      } catch (err) {
        const launcherError = LauncherError.from(err, LauncherErrorCode.MC_LAUNCH_FAILED);
        setError(launcherError);
        setIsLaunching(false);
        logger.error(LogCategory.MINECRAFT, 'Failed to launch game', launcherError);
        throw launcherError;
      }
    },
    [ramAllocation, gameDirectory, keepLauncherOpen, pauseForGame, setShowLogViewer]
  );

  /**
   * Check if the game is currently running
   */
  const checkGameStatus = useCallback(async () => {
    try {
      const running = await isGameRunning();
      setIsPlaying(running);
      return running;
    } catch (err) {
      logger.error(LogCategory.MINECRAFT, 'Failed to check game status', err as Error);
      return false;
    }
  }, []);

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Handle game process exit
   */
  const handleGameExit = useCallback(
    async (exitCode: number, crashed: boolean) => {
      logger.info(LogCategory.MINECRAFT, 'Game process exited', {
        action: 'exit',
        metadata: { exitCode, crashed },
      });

      setIsLaunching(false);
      setIsPlaying(false);
      setExitCode(exitCode);
      setCrashed(crashed);

      // Close log viewer if not keeping launcher open
      if (!keepLauncherOpen) {
        setShowLogViewer(false);

        // Show the launcher window again after game exits
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = await getCurrentWindow();
          await appWindow.show();
          logger.info(LogCategory.WINDOW, 'Launcher window shown');
        } catch (err) {
          logger.error(LogCategory.WINDOW, 'Failed to show window', err as Error);
        }
      }

      if (crashed) {
        setError(
          new LauncherError(
            LauncherErrorCode.MC_LAUNCH_FAILED,
            `Game crashed with exit code ${exitCode}`,
            { context: { exitCode } }
          )
        );
      }
    },
    [keepLauncherOpen, setShowLogViewer]
  );

  // Listen for Minecraft events
  useEffect(() => {
    let unlisteners: Array<UnlistenFn> = [];

    const setupListeners = async () => {
      try {
        // Listen for log events
        const unlistenLog = await listen<MinecraftLogEvent>('minecraft-log', (event) => {
          logger.debug(LogCategory.MINECRAFT, event.payload.message, {
            metadata: { level: event.payload.level },
          });

          if (event.payload.level === 'error') {
            logger.error(LogCategory.MINECRAFT, `Game error: ${event.payload.message}`);
          }
        });

        // Listen for exit events
        const unlistenExit = await listen<MinecraftExitEvent>('minecraft-exit', (event) => {
          handleGameExit(event.payload.exit_code, event.payload.crashed);
        });

        // Listen for crash events
        const unlistenCrash = await listen<MinecraftCrashEvent>('minecraft-crash', (event) => {
          logger.error(LogCategory.MINECRAFT, `Game crash: ${event.payload.message}`);
          setError(
            new LauncherError(LauncherErrorCode.MC_LAUNCH_FAILED, event.payload.message)
          );
        });

        unlisteners = [unlistenLog, unlistenExit, unlistenCrash];
      } catch (err) {
        logger.error(LogCategory.MINECRAFT, 'Failed to setup event listeners:', err instanceof Error ? err : new Error(String(err)));
      }
    };

    setupListeners();

    // Cleanup function - properly teardown all event listeners synchronously
    return () => {
      unlisteners.forEach((unlisten) => {
        try {
          unlisten();
        } catch (err) {
          logger.error(LogCategory.MINECRAFT, 'Failed to unlisten from event:', err instanceof Error ? err : new Error(String(err)));
        }
      });
    };
  }, [handleGameExit]);

  // Check if game is already running on mount
  useEffect(() => {
    checkGameStatus().then((running) => {
      if (running) {
        logger.info(LogCategory.MINECRAFT, 'Game is already running on mount');
      }
    });
  }, [checkGameStatus]);

  // Periodic health check for game process
  useEffect(() => {
    if (!isPlaying) return;

    const healthCheckInterval = setInterval(async () => {
      const running = await checkGameStatus();
      if (!running) {
        logger.warn(LogCategory.MINECRAFT, 'Game process died without exit event');
        handleGameExit(-1, false);
      }
    }, POLLING_INTERVALS.HEALTH_CHECK);

    return () => clearInterval(healthCheckInterval);
  }, [isPlaying, checkGameStatus, handleGameExit]);

  return {
    isLaunching,
    isPlaying,
    exitCode,
    crashed,
    error,
    launchGame,
    checkGameStatus,
    clearError,
  };
}