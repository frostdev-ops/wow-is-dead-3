import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'wid3-admin-theme';

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the stored theme preference or default to system
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Apply the theme class to the document root
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Hook for managing theme state with localStorage persistence
 * and system preference support
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  // Initialize theme on mount (prevents flash of wrong theme)
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  /**
   * Set the theme and persist to localStorage
   */
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  /**
   * Get the actual resolved theme (light or dark)
   */
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  return {
    theme,
    setTheme,
    resolvedTheme,
  };
}

/**
 * Initialize theme before React renders to prevent flash of wrong theme.
 * Call this in index.html or at the very top of your app.
 */
export function initializeTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}
