import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { CMSConfig } from '../types/cms-config';

interface CMSState {
  // Configuration data
  config: CMSConfig | null;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Error state
  error: string | null;

  // Last fetch timestamp
  lastFetch: number | null;

  // Actions
  fetchConfig: (forceRefresh?: boolean) => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export const useCMSStore = create<CMSState>((set, get) => ({
  // Initial state
  config: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  lastFetch: null,

  // Fetch configuration from backend
  fetchConfig: async (forceRefresh = false) => {
    const state = get();

    // Skip fetch if we have recent data and not forcing refresh
    if (
      !forceRefresh &&
      state.config &&
      state.lastFetch &&
      Date.now() - state.lastFetch < CACHE_DURATION
    ) {
      console.log('[CMS Store] Using cached configuration');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      console.log('[CMS Store] Fetching configuration from backend...');
      const config = await invoke<CMSConfig>('cmd_get_cms_config', {
        forceRefresh,
      });

      console.log('[CMS Store] Configuration loaded successfully:', {
        version: config.version,
        appName: config.branding.appName,
      });

      set({
        config,
        isLoading: false,
        isInitialized: true,
        error: null,
        lastFetch: Date.now(),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[CMS Store] Failed to fetch configuration:', errorMsg);

      set({
        error: errorMsg,
        isLoading: false,
        // Keep isInitialized true if we had config before
        isInitialized: state.config !== null,
      });
    }
  },

  // Initialize the store (fetch config on app startup)
  initialize: async () => {
    const state = get();

    if (state.isInitialized) {
      console.log('[CMS Store] Already initialized');
      return;
    }

    console.log('[CMS Store] Initializing...');
    await state.fetchConfig(false);
  },

  // Clear error state
  clearError: () => set({ error: null }),

  // Reset store to initial state
  reset: () =>
    set({
      config: null,
      isLoading: false,
      isInitialized: false,
      error: null,
      lastFetch: null,
    }),
}));

// Selectors for easier access to specific config sections
export const selectBranding = (state: CMSState) => state.config?.branding;
export const selectUrls = (state: CMSState) => state.config?.urls;
export const selectTheme = (state: CMSState) => state.config?.theme;
export const selectAssets = (state: CMSState) => state.config?.assets;
export const selectDiscord = (state: CMSState) => state.config?.discord;
export const selectLocalization = (state: CMSState) => state.config?.localization;
export const selectDefaults = (state: CMSState) => state.config?.defaults;
export const selectFeatures = (state: CMSState) => state.config?.features;

// Convenience hooks for accessing specific sections
export function useBrandingConfig() {
  return useCMSStore(selectBranding);
}

export function useURLsConfig() {
  return useCMSStore(selectUrls);
}

export function useThemeConfigCMS() {
  return useCMSStore(selectTheme);
}

export function useAssetsConfigCMS() {
  return useCMSStore(selectAssets);
}

export function useDiscordConfigCMS() {
  return useCMSStore(selectDiscord);
}

export function useLocalizationConfigCMS() {
  return useCMSStore(selectLocalization);
}

export function useDefaultsConfigCMS() {
  return useCMSStore(selectDefaults);
}

export function useFeaturesConfigCMS() {
  return useCMSStore(selectFeatures);
}

// Hook for localized strings
export function useLocalizedStrings(languageCode?: string) {
  const localization = useCMSStore(selectLocalization);

  if (!localization) {
    return {
      t: (category: string, key: string, fallback?: string) =>
        fallback || `${category}.${key}`,
      strings: {},
      availableLanguages: [],
    };
  }

  const targetLang = languageCode || localization.defaultLanguage;
  const language = localization.languages.find((l) => l.code === targetLang);

  const strings = language
    ? language.strings
    : localization.languages.find((l) => l.code === localization.defaultLanguage)?.strings || {};

  const t = (category: string, key: string, fallback?: string): string => {
    const categoryStrings = strings[category];
    if (!categoryStrings) {
      return fallback || `${category}.${key}`;
    }

    const value = categoryStrings[key];
    if (!value) {
      return fallback || `${category}.${key}`;
    }

    return value;
  };

  return {
    t,
    strings,
    availableLanguages: localization.languages.map((l) => ({
      code: l.code,
      name: l.name,
    })),
  };
}
