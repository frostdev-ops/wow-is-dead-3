/**
 * CMS Configuration Fetcher
 * Fetches launcher configuration from the server CMS system
 */

export interface CmsConfig {
  version: number;
  updatedAt: number;
  branding: {
    appName: string;
    tagline: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    discordUrl: string | null;
    websiteUrl: string | null;
  };
  server: {
    defaultServerAddress: string;
    defaultManifestUrl: string;
    minecraftVersion: string;
    fabricVersion: string;
    fabricRequired: boolean;
  };
  ui: {
    defaultTheme: string;
    availableThemes: string[];
    showDiscordToggle: boolean;
    showMusicToggle: boolean;
    defaultVolume: number;
  };
  performance: {
    defaultRamMb: number;
    minRamMb: number;
    maxRamMb: number;
    pollingIntervals: {
      serverStatus: number;
      trackerStatus: number;
      healthCheck: number;
      updateCheck: number;
      discordReconnect: number;
    };
    retryConfig: {
      maxAttempts: number;
      baseDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
    };
    downloadConfig: {
      maxConcurrent: number;
      chunkSize: number;
      retryAttempts: number;
      timeout: number;
    };
  };
  features: {
    enableDiscord: boolean;
    enableStats: boolean;
    enableMapViewer: boolean;
    enableAutoUpdate: boolean;
    enableCrashReporting: boolean;
    enableTelemetry: boolean;
  };
  assets: {
    menuMusic: string | null;
    menuMusicFallback: string | null;
    backgrounds: Record<string, string>;
    logos: Record<string, string>;
    sounds: Record<string, string>;
  };
  themes: any[]; // Theme configurations
}

// Cache for CMS config
let cachedConfig: CmsConfig | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch CMS configuration from server
 * Uses the manifest URL domain to determine the CMS config endpoint
 */
export async function fetchCmsConfig(manifestUrl: string): Promise<CmsConfig | null> {
  // Check cache
  const now = Date.now();
  if (cachedConfig && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    // Extract base URL from manifest URL
    const url = new URL(manifestUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const cmsUrl = `${baseUrl}/api/cms/config`;

    console.log('[CMS] Fetching configuration from:', cmsUrl);

    const response = await fetch(cmsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn('[CMS] Failed to fetch config:', response.status);
      return null;
    }

    const config = await response.json();
    cachedConfig = config;
    lastFetchTime = now;

    console.log('[CMS] Configuration fetched successfully, version:', config.version);
    return config;
  } catch (error) {
    console.warn('[CMS] Error fetching config:', error);
    return null;
  }
}

/**
 * Clear CMS config cache
 */
export function clearCmsConfigCache() {
  cachedConfig = null;
  lastFetchTime = 0;
}
