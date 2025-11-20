import { useEffect } from 'react';
import { logger, LogCategory } from '../utils/logger';
import { useAuthUser, useIsAuthenticated, useAuthLoading, useAuthError, useAuthActions } from '../stores/selectors';
import { getCurrentUser, logout as logoutCommand, refreshToken, getDeviceCode, completeDeviceCodeAuth } from './useTauriCommands';
import type { DeviceCodeInfo } from './useTauriCommands';

export const useAuth = () => {
  const user = useAuthUser();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthLoading();
  const error = useAuthError();
  const { setUser, setLoading, setError, logout: logoutStore } = useAuthActions();

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

      logger.debug(LogCategory.AUTH, 'Starting device code authentication...');
      const deviceCodeInfo = await getDeviceCode();
      logger.debug(LogCategory.AUTH, 'Device code received');

      return deviceCodeInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get device code';
      logger.error(LogCategory.AUTH, 'Device code request failed:', err instanceof Error ? err : new Error(message));
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const finishDeviceCodeAuth = async (deviceCode: string, interval: number) => {
    try {
      logger.debug(LogCategory.AUTH, 'Completing device code authentication...');

      const profile = await completeDeviceCodeAuth(deviceCode, interval);

      logger.info(LogCategory.AUTH, 'Device code authentication successful');

      setUser(profile);
      logger.debug(LogCategory.AUTH, 'User set in store');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      logger.error(LogCategory.AUTH, 'Device code authentication failed:', err instanceof Error ? err : new Error(message));
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info(LogCategory.AUTH, 'Starting Microsoft device code authentication...');
      // Use device code flow
      const deviceCodeInfo = await startDeviceCodeAuth();

      // This will be handled by the UI component showing the modal
      // and calling finishDeviceCodeAuth when ready
      return deviceCodeInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      logger.error(LogCategory.AUTH, 'Authentication failed:', err instanceof Error ? err : new Error(message));
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
