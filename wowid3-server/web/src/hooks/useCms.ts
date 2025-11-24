import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

export interface CmsConfig {
  version: number;
  updatedAt: number;
  branding: BrandingConfig;
  server: ServerConfig;
  ui: UiConfig;
  performance: PerformanceConfig;
  features: FeaturesConfig;
  assets: AssetsConfig;
  themes: ThemeConfig[];
}

export interface BrandingConfig {
  appName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  discordUrl: string | null;
  websiteUrl: string | null;
}

export interface ServerConfig {
  defaultServerAddress: string;
  defaultManifestUrl: string;
  minecraftVersion: string;
  fabricVersion: string;
  fabricRequired: boolean;
}

export interface UiConfig {
  defaultTheme: string;
  availableThemes: string[];
  showDiscordToggle: boolean;
  showMusicToggle: boolean;
  defaultVolume: number;
}

export interface PerformanceConfig {
  defaultRamMb: number;
  minRamMb: number;
  maxRamMb: number;
  pollingIntervals: PollingIntervals;
  retryConfig: RetryConfig;
  downloadConfig: DownloadConfig;
}

export interface PollingIntervals {
  serverStatus: number;
  trackerStatus: number;
  healthCheck: number;
  updateCheck: number;
  discordReconnect: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface DownloadConfig {
  maxConcurrent: number;
  chunkSize: number;
  retryAttempts: number;
  timeout: number;
}

export interface FeaturesConfig {
  enableDiscord: boolean;
  enableStats: boolean;
  enableMapViewer: boolean;
  enableAutoUpdate: boolean;
  enableCrashReporting: boolean;
  enableTelemetry: boolean;
}

export interface AssetsConfig {
  menuMusic: string | null;
  menuMusicFallback: string | null;
  backgrounds: Record<string, string>;
  logos: Record<string, string>;
  sounds: Record<string, string>;
}

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  background: ThemeBackground;
  typography: ThemeTypography;
  animations: ThemeAnimations;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface ThemeBackground {
  type: string;
  color: string;
  image: string | null;
  gradient: string | null;
  animation: string | null;
}

export interface ThemeTypography {
  fontFamily: string;
  headingFont: string;
  fontSizeBase: string;
  fontWeightNormal: number;
  fontWeightBold: number;
}

export interface ThemeAnimations {
  enableAnimations: boolean;
  transitionSpeed: string;
  animationTiming: string;
}

export interface AssetMetadata {
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  category: 'audio' | 'image' | 'video' | 'font' | 'other';
}

export function useCms() {
  const [config, setConfig] = useState<CmsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<CmsConfig>('/api/admin/cms/config');
      setConfig(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch CMS config'));
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<CmsConfig>) => {
    try {
      const response = await apiClient.put<CmsConfig>('/api/admin/cms/config', updates);
      setConfig(response.data);
      return response.data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update CMS config');
    }
  };

  const resetConfig = async () => {
    try {
      const response = await apiClient.post<CmsConfig>('/api/admin/cms/config/reset');
      setConfig(response.data);
      return response.data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to reset CMS config');
    }
  };

  const listAssets = async (): Promise<AssetMetadata[]> => {
    try {
      const response = await apiClient.get<{ assets: AssetMetadata[] }>('/api/admin/cms/assets');
      return response.data.assets;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to list assets');
    }
  };

  const uploadAsset = async (file: File): Promise<{ filename: string; url: string }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<{ filename: string; url: string }>(
        '/api/admin/cms/assets',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload asset');
    }
  };

  const deleteAsset = async (filename: string) => {
    try {
      await apiClient.delete(`/api/admin/cms/assets/${filename}`);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete asset');
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    setConfig,
    isLoading,
    error,
    updateConfig,
    resetConfig,
    listAssets,
    uploadAsset,
    deleteAsset,
    refreshConfig: fetchConfig,
  };
}
