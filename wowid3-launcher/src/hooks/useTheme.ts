import { useEffect } from 'react';
import { Theme } from '../themes/types';
import christmasTheme from '../themes/christmas.json';
import darkTheme from '../themes/dark.json';
import lightTheme from '../themes/light.json';
import { useSettingsStore } from '../stores';

const themes: Record<string, Theme> = {
  christmas: christmasTheme as Theme,
  dark: darkTheme as Theme,
  light: lightTheme as Theme,
};

export const useTheme = () => {
  const { theme: themeName, setTheme } = useSettingsStore();
  const currentTheme = themes[themeName] || themes.christmas;

  useEffect(() => {
    // Apply theme CSS variables to root
    const root = document.documentElement;
    const colors = currentTheme.colors;

    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-accent', colors.accent);
    if (colors.error) root.style.setProperty('--color-error', colors.error);
    if (colors.success) root.style.setProperty('--color-success', colors.success);
    if (colors.warning) root.style.setProperty('--color-warning', colors.warning);

    // Apply fonts
    const heading = currentTheme.fonts.heading;
    const body = currentTheme.fonts.body;
    root.style.setProperty('--font-heading', heading);
    root.style.setProperty('--font-body', body);
  }, [currentTheme]);

  return {
    currentTheme,
    availableThemes: Object.values(themes),
    applyTheme: (themeId: 'christmas' | 'dark' | 'light') => {
      setTheme(themeId);
    },
  };
};

// Export all available themes for the theme switcher
export const getAllThemes = (): Theme[] => {
  return Object.values(themes);
};
