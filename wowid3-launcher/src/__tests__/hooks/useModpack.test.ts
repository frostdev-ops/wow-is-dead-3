import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useModpack } from '../../hooks/useModpack';
import { useModpackStore } from '../../stores/modpackStore';
import * as tauriCommands from '../../hooks/useTauriCommands';
import { mockTauriListen } from '../utils/tauri-mock';

// Mock Tauri commands
vi.mock('../../hooks/useTauriCommands', () => ({
  checkForUpdates: vi.fn(),
  getInstalledVersion: vi.fn(),
  installModpack: vi.fn(),
  verifyAndRepairModpack: vi.fn(),
  hasManifestChanged: vi.fn(),
}));

// Mock Listen
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event, handler) => {
      return Promise.resolve(() => {});
  }),
}));

describe('useModpack', () => {
  beforeEach(() => {
    // Reset store
    act(() => {
      useModpackStore.setState({
        installedVersion: null,
        latestManifest: null,
        updateAvailable: false,
        isDownloading: false,
        error: null,
      });
    });
    vi.clearAllMocks();
  });

  it('should fetch and validate manifest', async () => {
    const mockManifest = {
      version: '1.0.0',
      minecraft_version: '1.20.1',
      fabric_loader: '0.14.22',
      changelog: 'Initial release',
      files: []
    };

    vi.mocked(tauriCommands.checkForUpdates).mockResolvedValue(mockManifest);
    // getInstalledVersion is called on mount
    vi.mocked(tauriCommands.getInstalledVersion).mockResolvedValue(null);

    const { result } = renderHook(() => useModpack());

    await act(async () => {
      await result.current.checkUpdates();
    });

    expect(result.current.latestManifest).toEqual(mockManifest);
    expect(result.current.error).toBeNull();
  });

  it('should download and verify modpack files', async () => {
    const mockManifest = {
      version: '1.0.0',
      minecraft_version: '1.20.1',
      fabric_loader: '0.14.22',
      changelog: 'Initial release',
      files: []
    };

    useModpackStore.setState({ latestManifest: mockManifest });
    vi.mocked(tauriCommands.getInstalledVersion).mockResolvedValue('1.0.0');
    vi.mocked(tauriCommands.installModpack).mockResolvedValue('installation-complete');
    vi.mocked(tauriCommands.verifyAndRepairModpack).mockResolvedValue('verification-complete');

    const { result } = renderHook(() => useModpack());

    await act(async () => {
      await result.current.install();
    });

    expect(tauriCommands.installModpack).toHaveBeenCalledWith(mockManifest, expect.anything());
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.installedVersion).toBe('1.0.0');
  });

  it('should handle partial install failure', async () => {
     const mockManifest = {
      version: '1.0.0',
      minecraft_version: '1.20.1',
      fabric_loader: '0.14.22',
      changelog: 'Initial release',
      files: []
    };

    useModpackStore.setState({ latestManifest: mockManifest });
    vi.mocked(tauriCommands.installModpack).mockRejectedValue(new Error('Install failed'));

    const { result } = renderHook(() => useModpack());

    await act(async () => {
        try {
            await result.current.install();
        } catch (e) {
            // Expected
        }
    });

    expect(result.current.error).toBe('Install failed');
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.installedVersion).toBeNull(); // Should not be updated
  });

  it('should detect installed version from disk', async () => {
    vi.mocked(tauriCommands.getInstalledVersion).mockResolvedValue('1.0.0');
    vi.mocked(tauriCommands.checkForUpdates).mockResolvedValue({
        version: '1.0.0',
        minecraft_version: '1.20.1',
        files: []
    });

    const { result } = renderHook(() => useModpack());

    // Wait for useEffect to run
    await waitFor(() => {
        expect(result.current.installedVersion).toBe('1.0.0');
    });
  });
});
