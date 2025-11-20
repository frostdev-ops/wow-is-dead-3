import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import * as tauriCommands from '../../hooks/useTauriCommands';

// Mock the tauri commands
vi.mock('../../hooks/useTauriCommands', () => ({
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  getDeviceCode: vi.fn(),
  completeDeviceCodeAuth: vi.fn(),
}));

describe('useAuth', () => {
  beforeEach(() => {
    // Reset store
    act(() => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    });
    vi.clearAllMocks();
  });

  it('should initiate device code flow', async () => {
    const mockDeviceCode = {
      device_code: 'test-code',
      user_code: 'TEST-USER',
      verification_uri: 'http://test.com',
      expires_in: 600,
      interval: 5,
      message: 'Test message'
    };

    vi.mocked(tauriCommands.getDeviceCode).mockResolvedValue(mockDeviceCode);

    const { result } = renderHook(() => useAuth());

    let deviceCodeInfo;
    await act(async () => {
      deviceCodeInfo = await result.current.startDeviceCodeAuth();
    });

    expect(deviceCodeInfo).toEqual(mockDeviceCode);
    expect(result.current.isLoading).toBe(false);
  });

  it('should poll for user profile on device code auth', async () => {
    const mockProfile = {
      uuid: 'test-uuid',
      username: 'TestUser',
      session_id: 'test-session',
    };

    vi.mocked(tauriCommands.completeDeviceCodeAuth).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.finishDeviceCodeAuth('test-code', 5);
    });

    expect(result.current.user).toEqual(mockProfile);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('should store user after successful auth', async () => {
    const mockProfile = {
      uuid: 'test-uuid',
      username: 'TestUser',
      session_id: 'test-session',
    };

    vi.mocked(tauriCommands.completeDeviceCodeAuth).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.finishDeviceCodeAuth('test-code', 5);
    });

    expect(useAuthStore.getState().user).toEqual(mockProfile);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should handle auth errors gracefully', async () => {
    const errorMessage = 'Auth failed';
    vi.mocked(tauriCommands.completeDeviceCodeAuth).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.finishDeviceCodeAuth('test-code', 5);
      } catch (e) {
        // Expected error
      }
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
