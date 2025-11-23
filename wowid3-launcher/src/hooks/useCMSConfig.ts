import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  CMSConfig,
  BrandingConfig,
  URLConfig,
  ThemeConfig,
  AssetsConfig,
  DiscordConfig,
  LocalizationConfig,
  DefaultsConfig,
  FeaturesConfig,
} from '../types/cms-config';

/**
 * Hook to fetch and manage CMS configuration
 * Automatically fetches on mount and provides refresh functionality
 */
export function useCMSConfig(forceRefresh = false) {
  const [config, setConfig] = useState<CMSConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async (refresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await invoke<CMSConfig>('cmd_get_cms_config', {
        forceRefresh: refresh,
      });
      setConfig(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[CMS Config] Failed to fetch configuration:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    return fetchConfig(true);
  }, [fetchConfig]);

  useEffect(() => {
    fetchConfig(forceRefresh);
  }, [fetchConfig, forceRefresh]);

  return {
    config,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook to fetch branding configuration
 */
export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<BrandingConfig>('cmd_get_cms_branding');
        setBranding(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Branding] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranding();
  }, []);

  return { branding, isLoading, error };
}

/**
 * Hook to fetch URL configuration
 */
export function useURLConfig() {
  const [urls, setUrls] = useState<URLConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUrls = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<URLConfig>('cmd_get_cms_urls');
        setUrls(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS URLs] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUrls();
  }, []);

  return { urls, isLoading, error };
}

/**
 * Hook to fetch theme configuration
 */
export function useThemeConfig() {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<ThemeConfig>('cmd_get_cms_theme');
        setThemeConfig(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Theme] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTheme();
  }, []);

  return { themeConfig, isLoading, error };
}

/**
 * Hook to fetch assets configuration
 */
export function useAssetsConfig() {
  const [assets, setAssets] = useState<AssetsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<AssetsConfig>('cmd_get_cms_assets');
        setAssets(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Assets] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, []);

  return { assets, isLoading, error };
}

/**
 * Hook to fetch Discord configuration
 */
export function useDiscordConfig() {
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiscord = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<DiscordConfig>('cmd_get_cms_discord');
        setDiscordConfig(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Discord] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscord();
  }, []);

  return { discordConfig, isLoading, error };
}

/**
 * Hook to fetch localization configuration
 */
export function useLocalizationConfig() {
  const [localization, setLocalization] = useState<LocalizationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocalization = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<LocalizationConfig>('cmd_get_cms_localization');
        setLocalization(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Localization] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocalization();
  }, []);

  return { localization, isLoading, error };
}

/**
 * Hook to fetch defaults configuration
 */
export function useDefaultsConfig() {
  const [defaults, setDefaults] = useState<DefaultsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<DefaultsConfig>('cmd_get_cms_defaults');
        setDefaults(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Defaults] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefaults();
  }, []);

  return { defaults, isLoading, error };
}

/**
 * Hook to fetch features configuration
 */
export function useFeaturesConfig() {
  const [features, setFeatures] = useState<FeaturesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await invoke<FeaturesConfig>('cmd_get_cms_features');
        setFeatures(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[CMS Features] Failed to fetch:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  return { features, isLoading, error };
}

/**
 * Hook to get localized strings
 * Falls back to default language if requested language is not available
 */
export function useLocalization(languageCode?: string) {
  const { localization, isLoading, error } = useLocalizationConfig();
  const [strings, setStrings] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!localization) return;

    const targetLang = languageCode || localization.defaultLanguage;
    const language = localization.languages.find((l) => l.code === targetLang);

    if (language) {
      setStrings(language.strings);
    } else {
      // Fallback to default language
      const defaultLang = localization.languages.find(
        (l) => l.code === localization.defaultLanguage
      );
      if (defaultLang) {
        setStrings(defaultLang.strings);
        console.warn(
          `[Localization] Language ${targetLang} not found, falling back to ${localization.defaultLanguage}`
        );
      }
    }
  }, [localization, languageCode]);

  /**
   * Get a localized string by category and key
   * @param category - String category (e.g., "common", "auth")
   * @param key - String key (e.g., "play", "loginButton")
   * @param fallback - Optional fallback value if string is not found
   */
  const t = useCallback(
    (category: string, key: string, fallback?: string): string => {
      const categoryStrings = strings[category];
      if (!categoryStrings) {
        console.warn(`[Localization] Category "${category}" not found`);
        return fallback || `${category}.${key}`;
      }

      const value = categoryStrings[key];
      if (!value) {
        console.warn(`[Localization] Key "${key}" not found in category "${category}"`);
        return fallback || `${category}.${key}`;
      }

      return value;
    },
    [strings]
  );

  return {
    strings,
    t,
    isLoading,
    error,
    availableLanguages: localization?.languages.map((l) => ({
      code: l.code,
      name: l.name,
    })) || [],
  };
}
