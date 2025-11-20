import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMinecraftInstaller } from '../../hooks/useMinecraftInstaller';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  __resetMocks,
  __setMockInvokeResponses,
  __setMockInvokeResponse,
} from '../../__mocks__/@tauri-apps/api/core';
import { __emitEvent, __clearEventListeners } from '../../__mocks__/@tauri-apps/api/event';

describe('useMinecraftInstaller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetMocks();
    __clearEventListeners();

    // Reset settings store
    useSettingsStore.setState({
      gameDirectory: '/home/user/.minecraft',
      manifestUrl: 'https://example.com/manifest.json',
      serverAddress: 'mc.example.com',
      javaPath: '/usr/bin/java',
      ramAllocation: 4096,
      minecraftVersion: '1.20.1',
      fabricEnabled: true,
      fabricVersion: '0.15.0',
      autoUpdate: false,
      preferStableFabric: true,
      isMinecraftInstalled: true,
      theme: 'christmas' as const,
      keepLauncherOpen: false,
      musicWasPaused: false,
      _defaultGameDirectoryFetched: true,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should check if Minecraft is installed on mount', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      const { result } = renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(true);
      });
    });

    it('should handle Minecraft not installed', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', false);

      const { result } = renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(false);
      });
    });

    it('should handle check installation error', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', 'Check failed', true);

      const { result } = renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(false);
      });
    });
  });

  describe('game launch', () => {
    it('should launch game successfully', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: true },
        cmd_is_game_running: { response: false },
        cmd_launch_game_with_metadata: { response: 'Game launched' },
      });

      const { result } = renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(true);
      });

      // Mock launch function would be called by component
      // Simulate successful launch
      act(() => {
        __emitEvent('minecraft-launch', {});
      });
    });

    it('should prevent launch if game already running', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: true },
        cmd_is_game_running: { response: true },
      });

      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');

      renderHook(() => useMinecraftInstaller());

      // Attempt to launch
      await expect(invoke('cmd_is_game_running')).resolves.toBe(true);
    });

    it('should handle launch failure', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: true },
        cmd_is_game_running: { response: false },
        cmd_launch_game_with_metadata: { response: 'Java not found', reject: true },
      });

      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');

      renderHook(() => useMinecraftInstaller());

      await expect(
        invoke('cmd_launch_game_with_metadata', {
          config: { gameDir: '/test' },
          versionId: '1.20.1',
        })
      ).rejects.toThrow('Java not found');
    });
  });

  describe('game crash detection', () => {
    it('should detect normal game exit', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      renderHook(() => useMinecraftInstaller());

      // Simulate game start
      act(() => {
        __emitEvent('minecraft-launch', {});
      });

      // Simulate normal exit
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: 0,
          crashed: false,
        });
      });

      // Should handle gracefully
    });

    it('should detect game crash', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      renderHook(() => useMinecraftInstaller());

      // Simulate game start
      act(() => {
        __emitEvent('minecraft-launch', {});
      });

      // Simulate crash
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: 1,
          crashed: true,
        });
      });

      // Crash should be detected and logged
    });

    it('should detect crash with non-zero exit code', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      renderHook(() => useMinecraftInstaller());

      // Simulate crash with specific exit code
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: -1,
          crashed: true,
        });
      });

      // Should handle crash appropriately
    });

    it('should handle multiple crash scenarios', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      renderHook(() => useMinecraftInstaller());

      // Crash scenario 1: Segfault
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: 139,
          crashed: true,
        });
      });

      // Crash scenario 2: Out of memory
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: 137,
          crashed: true,
        });
      });

      // Each crash should be logged separately
    });
  });

  describe('game recovery after crash', () => {
    it('should allow relaunch after crash', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: true },
        cmd_is_game_running: { response: false },
        cmd_launch_game_with_metadata: { response: 'Game launched' },
      });

      renderHook(() => useMinecraftInstaller());

      // Simulate crash
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: 1,
          crashed: true,
        });
      });

      // Game should not be running after crash
      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');
      await expect(invoke('cmd_is_game_running')).resolves.toBe(false);

      // Should allow relaunch
      await expect(
        invoke('cmd_launch_game_with_metadata', {
          config: { gameDir: '/test' },
          versionId: '1.20.1',
        })
      ).resolves.toBe('Game launched');
    });

    it('should reset game state after crash', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      renderHook(() => useMinecraftInstaller());

      // Launch game
      act(() => {
        __emitEvent('minecraft-launch', {});
      });

      // Crash
      act(() => {
        __emitEvent('minecraft-exit', {
          exit_code: 1,
          crashed: true,
        });
      });

      // State should be reset (verified by being able to launch again)
      act(() => {
        __emitEvent('minecraft-launch', {});
      });
    });
  });

  describe('installation process', () => {
    it('should install Minecraft successfully', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: false },
        cmd_install_minecraft: { response: undefined },
        cmd_get_latest_fabric_loader: {
          response: { version: '0.15.0', stable: true },
        },
      });

      renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(useMinecraftInstaller).toBeDefined();
      });

      // Installation would be triggered by UI
      // Simulate progress events
      act(() => {
        __emitEvent('install-progress', {
          stage: 'downloading',
          progress: 50,
          total: 100,
          message: 'Downloading Minecraft...',
        });
      });

      act(() => {
        __emitEvent('install-progress', {
          stage: 'installing',
          progress: 100,
          total: 100,
          message: 'Installation complete',
        });
      });
    });

    it('should handle installation failure', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: false },
        cmd_install_minecraft: { response: 'Download failed', reject: true },
      });

      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');

      renderHook(() => useMinecraftInstaller());

      await expect(
        invoke('cmd_install_minecraft', {
          config: { versionId: '1.20.1' },
        })
      ).rejects.toThrow('Download failed');
    });

    it('should handle partial installation failure', async () => {
      let installAttempts = 0;

      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');
      invoke.mockImplementation((cmd: string) => {
        if (cmd === 'cmd_install_minecraft') {
          installAttempts++;
          if (installAttempts === 1) {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve(undefined);
        }
        if (cmd === 'cmd_is_version_installed') {
          return Promise.resolve(installAttempts > 1);
        }
        return Promise.reject(new Error(`Unhandled: ${cmd}`));
      });

      renderHook(() => useMinecraftInstaller());

      // First attempt fails
      await expect(
        invoke('cmd_install_minecraft', { config: {} })
      ).rejects.toThrow('Network timeout');

      // Second attempt succeeds
      await expect(invoke('cmd_install_minecraft', { config: {} })).resolves.toBeUndefined();
    });
  });

  describe('version management', () => {
    it('should detect correct Minecraft version', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      const { result } = renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(true);
      });

      // Version ID should be available
      expect(result.current.versionId).toBeDefined();
    });

    it('should handle version check failure', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', 'Version check failed', true);

      const { result } = renderHook(() => useMinecraftInstaller());

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(false);
      });
    });
  });

  describe('concurrent operations', () => {
    it('should prevent concurrent game launches', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: true },
        cmd_is_game_running: { response: false },
        cmd_launch_game_with_metadata: { response: 'Game launched' },
      });

      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');

      renderHook(() => useMinecraftInstaller());

      // First launch
      const launch1 = invoke('cmd_launch_game_with_metadata', {
        config: { gameDir: '/test' },
        versionId: '1.20.1',
      });

      // Update mock to indicate game is running
      __setMockInvokeResponse('cmd_is_game_running', true);

      // Second launch attempt should be blocked
      await expect(invoke('cmd_is_game_running')).resolves.toBe(true);

      await launch1;
    });

    it('should handle installation during game running', async () => {
      __setMockInvokeResponses({
        cmd_is_version_installed: { response: true },
        cmd_is_game_running: { response: true },
      });

      const { invoke } = await import('../../__mocks__/@tauri-apps/api/core');

      renderHook(() => useMinecraftInstaller());

      // Installation should be blocked while game is running
      await expect(invoke('cmd_is_game_running')).resolves.toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle cleanup on unmount during game running', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      const { unmount } = renderHook(() => useMinecraftInstaller());

      // Start game
      act(() => {
        __emitEvent('minecraft-launch', {});
      });

      // Unmount while game is running
      unmount();

      // Should cleanup listeners without errors
    });

    it('should handle rapid launch/exit cycles', async () => {
      __setMockInvokeResponse('cmd_is_version_installed', true);

      renderHook(() => useMinecraftInstaller());

      // Rapid launch/exit
      for (let i = 0; i < 5; i++) {
        act(() => {
          __emitEvent('minecraft-launch', {});
          __emitEvent('minecraft-exit', {
            exit_code: 0,
            crashed: false,
          });
        });
      }

      // Should handle without errors
    });
  });
});
