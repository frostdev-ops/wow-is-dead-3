import { create } from 'zustand';
import { LauncherError, LauncherErrorCode } from '../utils/errors';

// Re-export for consumers
export { LauncherError, LauncherErrorCode };

// Keep createLauncherError for backward compatibility if needed, or just rely on LauncherError.from
export const createLauncherError = LauncherError.from;

interface ErrorState {
  errors: LauncherError[];
  addError: (error: LauncherError) => void;
  clearError: (code: LauncherErrorCode) => void;
  clearAllErrors: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  errors: [],
  addError: (error) => set((state) => ({
    errors: [...state.errors, error]
  })),
  clearError: (code) => set((state) => ({
    errors: state.errors.filter((e) => e.code !== code)
  })),
  clearAllErrors: () => set({ errors: [] }),
}));
