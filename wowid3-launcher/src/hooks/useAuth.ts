import { useEffect } from 'react';
import { useAuthStore } from '../stores';
import { authenticateMinecraft, getCurrentUser, logout as logoutCommand } from './useTauriCommands';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, error, setUser, setLoading, setError, logout: logoutStore } = useAuthStore();

  // Check for existing user on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get user');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [setUser, setLoading, setError]);

  const login = async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await authenticateMinecraft();
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
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
  };
};
