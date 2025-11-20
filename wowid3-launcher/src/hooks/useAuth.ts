import { useEffect } from 'react';
import { logger, LogCategory } from '../utils/logger';
import { LauncherError, LauncherErrorCode } from '../utils/errors';
import { useAuthUser, useIsAuthenticated, useAuthLoading, useAuthError, useAuthActions } from '../stores/selectors';
import { getCurrentUser, logout as logoutCommand, refreshToken, getDeviceCode, completeDeviceCodeAuth } from './useTauriCommands';
import type { DeviceCodeInfo } from './useTauriCommands';

export const useAuth = () => {
  const user = useAuthUser();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthLoading();
  const error = useAuthError();
  const { setUser, setLoading, setError, logout: logoutStore } = useAuthActions();

  // Check for existing user and refresh token on mount ONCE
  useEffect(() => {
    let mounted = true;
    
    const checkUser = async () => {
      // Guard: Don't run if we already have a user (prevents loop)
      if (user) {
        return;
      }
      
      if (!mounted) return;
      
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        
        if (!mounted) return;
        
        if (currentUser) {
          // Try to refresh token to ensure it's still valid
          try {
            const refreshedUser = await refreshToken();
            if (mounted && refreshedUser) {
              setUser(refreshedUser);
            } else if (mounted) {
              setUser(currentUser);
            }
          } catch (refreshErr) {
            // If refresh fails, use the current user anyway
            if (mounted) {
              setUser(currentUser);
            }
          }
        }
      } catch (err) {
        if (mounted) {
          const error = LauncherError.from(err, LauncherErrorCode.AUTH_FAILED);
          setError(error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkUser();
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount, user check is inside

  const startDeviceCodeAuth = async (): Promise<DeviceCodeInfo> => {
    try {
      setLoading(true);
      setError(null);

      logger.debug(LogCategory.AUTH, 'Starting device code authentication...');
      const deviceCodeInfo = await getDeviceCode();
      logger.debug(LogCategory.AUTH, 'Device code received');

      return deviceCodeInfo;
    } catch (err) {
      const error = LauncherError.from(err, LauncherErrorCode.AUTH_FAILED);
      logger.error(LogCategory.AUTH, 'Device code request failed:', error);
      setError(error);
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
      const error = LauncherError.from(err, LauncherErrorCode.AUTH_FAILED);
      logger.error(LogCategory.AUTH, 'Device code authentication failed:', error);
      setError(error);
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
      const error = LauncherError.from(err, LauncherErrorCode.AUTH_FAILED);
      logger.error(LogCategory.AUTH, 'Authentication failed:', error);
      setError(error);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutCommand();
      logoutStore();
    } catch (err) {
      const error = LauncherError.from(err, LauncherErrorCode.AUTH_FAILED);
      setError(error);
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
