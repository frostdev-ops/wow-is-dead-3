import { useEffect } from 'react';
import { useAuthStore } from '../stores';
import { getCurrentUser, logout as logoutCommand, refreshToken, getDeviceCode, completeDeviceCodeAuth } from './useTauriCommands';
import type { DeviceCodeInfo } from './useTauriCommands';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, error, setUser, setLoading, setError, logout: logoutStore } = useAuthStore();

  // Check for existing user and refresh token on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        if (currentUser) {
          // Try to refresh token to ensure it's still valid
          try {
            const refreshedUser = await refreshToken();
            if (refreshedUser) {
              setUser(refreshedUser);
            } else {
              setUser(currentUser);
            }
          } catch (refreshErr) {
            // If refresh fails, use the current user anyway
            setUser(currentUser);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get user');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [setUser, setLoading, setError]);

  const startDeviceCodeAuth = async (): Promise<DeviceCodeInfo> => {
    try {
      setLoading(true);
      setError(null);

      console.log('[Auth] Starting device code authentication...');
      const deviceCodeInfo = await getDeviceCode();
      console.log('[Auth] Device code received:', deviceCodeInfo.user_code);

      return deviceCodeInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get device code';
      console.error('[Auth] Device code request failed:', message, err);
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const finishDeviceCodeAuth = async (deviceCode: string, interval: number) => {
    try {
      console.error('[React Auth] ==== STARTING finishDeviceCodeAuth ====');
      console.error('[React Auth] Device code length:', deviceCode.length, 'Interval:', interval);
      console.log('[Auth] Completing device code authentication...');

      const profile = await completeDeviceCodeAuth(deviceCode, interval);

      console.error('[React Auth] ==== RECEIVED PROFILE FROM RUST ====');
      console.error('[React Auth] Profile:', JSON.stringify(profile, null, 2));
      console.log('[Auth] Device code authentication successful:', profile);

      setUser(profile);
      console.error('[React Auth] ==== setUser() CALLED ====');
      console.log('[Auth] User set in store');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('[React Auth] ==== AUTHENTICATION ERROR ====');
      console.error('[Auth] Device code authentication failed:', message, err);
      setError(message);
      throw err;
    } finally {
      console.error('[React Auth] ==== FINALLY BLOCK - setting loading to false ====');
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[Auth] Starting Microsoft device code authentication...');
      // Use device code flow
      const deviceCodeInfo = await startDeviceCodeAuth();

      // This will be handled by the UI component showing the modal
      // and calling finishDeviceCodeAuth when ready
      return deviceCodeInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('[Auth] Authentication failed:', message, err);
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutCommand();
      logoutStore();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    startDeviceCodeAuth,
    finishDeviceCodeAuth,
  };
};
