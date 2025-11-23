/**
 * CMS Configuration Schema
 * This defines the structure for all customizable launcher configuration
 * All hardcoded values should be replaced with values from this configuration
 */

export interface CMSConfig {
  version: string; // Schema version for migration support
  branding: BrandingConfig;
  urls: URLConfig;
  theme: ThemeConfig;
  assets: AssetsConfig;
  discord: DiscordConfig;
  localization: LocalizationConfig;
  defaults: DefaultsConfig;
  features: FeaturesConfig;
}

/**
 * Branding configuration
 * Controls the launcher's name, logo, and identity
 */
export interface BrandingConfig {
  appName: string; // e.g., "WOW Is Dead 3!"
  shortName: string; // e.g., "WOWID3"
  tagline?: string; // Optional tagline/description
  publisher?: string; // e.g., "FrostDev"
  supportUrl?: string; // URL for support/help
  websiteUrl?: string; // Main website URL
}

/**
 * URL configuration
 * All external URLs the launcher needs to connect to
 */
export interface URLConfig {
  // Core launcher URLs
  manifestUrl: string; // Modpack manifest API endpoint
  apiBaseUrl: string; // Base URL for launcher API

  // Minecraft server
  serverAddress: string; // e.g., "mc.frostdev.io:25565"

  // External services
  avatarService: string; // e.g., "https://mc-heads.net/avatar"

  // Microsoft OAuth (usually constant but can be customized for self-hosted)
  microsoftClientId: string;

  // Tracker/Stats
  trackerUrl?: string; // Optional tracker service URL
  statsUrl?: string; // Optional stats API URL
}

/**
 * Theme configuration
 * Defines color schemes, fonts, and visual appearance
 */
export interface ThemeConfig {
  // Available themes (user can switch between these)
  themes: ThemeDefinition[];

  // Default theme ID
  defaultTheme: string;
}

export interface ThemeDefinition {
  id: string; // Unique theme identifier
  name: string; // Display name
  colors: ColorPalette;
  fonts: FontConfig;
  animations?: AnimationConfig;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
  // Additional custom colors can be added
  [key: string]: string;
}

export interface FontConfig {
  heading: string; // Font family for headings
  body: string; // Font family for body text
  mono?: string; // Optional monospace font
}

export interface AnimationConfig {
  snowfall?: boolean;
  lights?: boolean;
  particles?: boolean;
  // Custom animation flags
  [key: string]: boolean | undefined;
}

/**
 * Assets configuration
 * URLs to all visual and audio assets
 */
export interface AssetsConfig {
  // Logos and branding images
  logo: string; // Main logo URL
  icon: string; // App icon URL
  favicon?: string;

  // Background images/videos
  backgrounds?: {
    main?: string;
    menu?: string;
    settings?: string;
    [key: string]: string | undefined;
  };

  // Audio files
  audio: {
    mainMusic: string; // Main menu music
    fallbackMusic: string; // Fallback menu music
    soundEffects?: {
      click?: string;
      success?: string;
      error?: string;
      [key: string]: string | undefined;
    };
  };

  // Decorative assets
  decorations?: {
    catTextures?: string[]; // Easter egg cat model textures
    christmas?: {
      cookie?: string;
      [key: string]: string | undefined;
    };
    [key: string]: any;
  };

  // Custom asset categories
  [key: string]: any;
}

/**
 * Discord Rich Presence configuration
 */
export interface DiscordConfig {
  enabled: boolean;
  applicationId: string; // Discord Application ID

  // Asset keys (must match Discord Developer Portal)
  assets: {
    largeImage: string; // Main logo key (e.g., "wowid3-logo")
    dimensions?: {
      overworld?: string;
      nether?: string;
      end?: string;
      [key: string]: string | undefined;
    };
  };

  // Default presence text
  defaultPresence: {
    state: string; // e.g., "Playing WOW Is Dead 3!"
    details: string; // e.g., "In Game"
  };

  // Party size settings
  partyMaxSize?: number; // Max server capacity for party display
}

/**
 * Localization/i18n configuration
 * All UI text strings
 */
export interface LocalizationConfig {
  // Default language
  defaultLanguage: string; // e.g., "en-US"

  // Available languages
  languages: LanguageDefinition[];
}

export interface LanguageDefinition {
  code: string; // e.g., "en-US"
  name: string; // e.g., "English"
  strings: LocalizedStrings;
}

export interface LocalizedStrings {
  // Common UI elements
  common: {
    play: string;
    settings: string;
    logout: string;
    cancel: string;
    confirm: string;
    save: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    [key: string]: string;
  };

  // Authentication
  auth: {
    loginButton: string;
    loggingIn: string;
    loginSuccess: string;
    loginError: string;
    logout: string;
    [key: string]: string;
  };

  // Modpack/Updates
  modpack: {
    checking: string;
    downloading: string;
    installing: string;
    upToDate: string;
    updateAvailable: string;
    verifying: string;
    repairing: string;
    [key: string]: string;
  };

  // Server status
  server: {
    online: string;
    offline: string;
    connecting: string;
    players: string;
    [key: string]: string;
  };

  // Settings
  settings: {
    title: string;
    gameDirectory: string;
    ramAllocation: string;
    serverAddress: string;
    theme: string;
    volume: string;
    [key: string]: string;
  };

  // Errors
  errors: {
    networkError: string;
    authFailed: string;
    downloadFailed: string;
    launchFailed: string;
    [key: string]: string;
  };

  // Custom categories
  [key: string]: Record<string, string>;
}

/**
 * Default settings configuration
 * Defaults for user-configurable settings
 */
export interface DefaultsConfig {
  // Minecraft installation
  minecraftVersion: string; // e.g., "1.20.1"
  fabricEnabled: boolean;
  fabricVersion: string; // e.g., "0.17.3"

  // Performance
  ramAllocation: number; // in MB, e.g., 16384 for 16GB
  minRam: number;
  maxRam: number;

  // Launcher behavior
  keepLauncherOpen: boolean;
  autoUpdate: boolean;

  // Audio defaults
  defaultVolume: number; // 0-1 range

  // Game directory (platform-specific handled by launcher)
  // Theme (handled by ThemeConfig.defaultTheme)
}

/**
 * Feature flags configuration
 * Enable/disable launcher features
 */
export interface FeaturesConfig {
  enableDiscord: boolean;
  enableStats: boolean;
  enableMapViewer: boolean;
  enableAutoUpdate: boolean;
  enableCrashReporting: boolean;
  enableTelemetry: boolean;
  enableVPN: boolean;
  enableResourcePacks: boolean;

  // Custom feature flags
  [key: string]: boolean;
}

/**
 * Type guard to validate CMS config structure
 */
export function isValidCMSConfig(obj: any): obj is CMSConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.version === 'string' &&
    obj.branding &&
    obj.urls &&
    obj.theme &&
    obj.assets &&
    obj.discord &&
    obj.localization &&
    obj.defaults &&
    obj.features
  );
}
