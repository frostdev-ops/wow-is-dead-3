import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, MinecraftProfile } from '../../stores/authStore';
import { createMockProfile } from '../utils/mockData';
import { LauncherError, LauncherErrorCode } from '../../utils/errors';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const mockProfile = createMockProfile();
      const { setUser } = useAuthStore.getState();

      setUser(mockProfile);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockProfile);
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should clear authentication when user is null', () => {
      // First set a user
      useAuthStore.setState({
        user: createMockProfile(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { setUser } = useAuthStore.getState();
      setUser(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should clear errors when setting user', () => {
      useAuthStore.setState({ 
        error: new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Previous error')
      });

      const { setUser } = useAuthStore.getState();
      setUser(createMockProfile());

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error and stop loading', () => {
      useAuthStore.setState({ isLoading: true });

      const { setError } = useAuthStore.getState();
      const error = new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Authentication failed');
      setError(error);

      const state = useAuthStore.getState();
      expect(state.error).toBe(error);
      expect(state.isLoading).toBe(false);
    });

    it('should clear error when set to null', () => {
      useAuthStore.setState({ 
        error: new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Previous error')
      });

      const { setError } = useAuthStore.getState();
      setError(null);

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      useAuthStore.setState({
        user: createMockProfile(),
        isAuthenticated: true,
        isLoading: false,
        error: new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Some error'),
      });

      const { logout } = useAuthStore.getState();
      logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('state transitions', () => {
    it('should handle login flow state transitions', () => {
      const { setLoading, setUser } = useAuthStore.getState();

      // Start loading
      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Success
      setUser(createMockProfile());
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.error).toBeNull();
    });

    it('should handle failed login flow', () => {
      const { setLoading, setError } = useAuthStore.getState();
      const error = new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Login failed');

      setLoading(true);
      setError(error);

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('data integrity', () => {
    it('should preserve user profile data correctly', () => {
      const mockProfile: MinecraftProfile = {
        uuid: 'test-uuid-123',
        username: 'TestUser',
        session_id: 'test-token',
        skin_url: 'https://example.com/skin.png',
        expires_at: '2025-12-31T23:59:59Z',
      };

      useAuthStore.getState().setUser(mockProfile);

      const storedUser = useAuthStore.getState().user;
      expect(storedUser).toEqual(mockProfile);
      expect(storedUser?.uuid).toBe('test-uuid-123');
      expect(storedUser?.username).toBe('TestUser');
      expect(storedUser?.session_id).toBe('test-token');
    });

    it('should handle partial profile data', () => {
      const partialProfile: MinecraftProfile = {
        uuid: 'test-uuid',
        username: 'TestUser',
        session_id: 'token',
        // Optional fields missing
      };

      useAuthStore.getState().setUser(partialProfile);

      const storedUser = useAuthStore.getState().user;
      expect(storedUser).toEqual(partialProfile);
      expect(storedUser?.skin_url).toBeUndefined();
    });
  });

  describe('concurrent updates', () => {
    it('should handle rapid state updates', () => {
      const { setLoading, setError } = useAuthStore.getState();
      const error1 = new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Error 1');
      const error2 = new LauncherError(LauncherErrorCode.AUTH_FAILED, 'Error 2');

      setLoading(true);
      setLoading(false);
      setLoading(true);
      setError(error1);
      setError(error2);

      // Final state should reflect last update
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false); // setError sets loading to false
      expect(state.error).toBe(error2);
    });

    it('should handle user updates during loading', () => {
      const { setLoading, setUser } = useAuthStore.getState();

      setLoading(true);
      setUser(createMockProfile({ username: 'User1' }));
      setUser(createMockProfile({ username: 'User2' }));

      const state = useAuthStore.getState();
      expect(state.user?.username).toBe('User2');
      expect(state.isAuthenticated).toBe(true);
    });
  });
});
