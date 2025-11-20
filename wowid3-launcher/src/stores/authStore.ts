import { create } from 'zustand';
import { LauncherError } from '../types';

// Session-based profile - tokens are kept in backend only
export interface MinecraftProfile {
  uuid: string;
  username: string;
  session_id: string; // Session ID for backend token lookup
  skin_url?: string;
  expires_at?: string; // ISO 8601 date string from Rust's DateTime<Utc>
}

interface AuthState {
  user: MinecraftProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: LauncherError | null;

  // Tracking state (previously refs in LauncherHome)
  lastAuthError: LauncherError | null;
  hasShownWelcomeToast: boolean;

  // Actions
  setUser: (user: MinecraftProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: LauncherError | null) => void;
  setLastAuthError: (error: LauncherError | null) => void;
  setHasShownWelcomeToast: (shown: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastAuthError: null,
  hasShownWelcomeToast: false,

  setUser: (user) => set({
    user,
    isAuthenticated: user !== null,
    error: null,
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setLastAuthError: (error) => set({ lastAuthError: error }),

  setHasShownWelcomeToast: (shown) => set({ hasShownWelcomeToast: shown }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      hasShownWelcomeToast: false, // Reset welcome toast on logout
    }),
}));
