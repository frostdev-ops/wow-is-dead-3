/**
 * Application-wide constants and configuration values
 * This file centralizes all magic numbers and configuration values
 * to make the codebase more maintainable and configurable
 */

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  SERVER_STATUS: 30000, // Check server status every 30 seconds
  TRACKER_STATUS: 60000, // Check tracker status every minute
  HEALTH_CHECK: 5000, // Check if game is running every 5 seconds
  UPDATE_CHECK: 300000, // Check for updates every 5 minutes
  DISCORD_RECONNECT: 10000, // Try to reconnect Discord every 10 seconds
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_DELAY: 1000, // Base delay for exponential backoff
  MAX_DELAY: 60000, // Maximum delay between retries (1 minute)
  BACKOFF_MULTIPLIER: 2,
} as const;

// Timing delays
export const TIMING_DELAYS = {
  BACKGROUND_VERIFY: 5000, // Wait 5 seconds before background verification
  AUTH_POLL_INTERVAL: 5000, // Device code auth polling interval
  TOAST_DURATION: 3000, // Default toast display duration
  ANIMATION_DURATION: 400, // Default animation duration in ms
} as const;

// UI Limits
export const UI_LIMITS = {
  MAX_PLAYER_LIST: 50, // Maximum players to show in list
  MAX_LOG_LINES: 1000, // Maximum lines to keep in log viewer
  MIN_RAM_MB: 2048, // Minimum RAM allocation (2GB)
  MAX_RAM_MB: 32768, // Maximum RAM allocation (32GB)
  DEFAULT_RAM_MB: 4096, // Default RAM allocation (4GB)
} as const;

// Download configuration
export const DOWNLOAD_CONFIG = {
  MAX_CONCURRENT: 4, // Maximum concurrent file downloads
  CHUNK_SIZE: 1024 * 1024, // Download chunk size (1MB)
  RETRY_ATTEMPTS: 3, // Number of retries for failed downloads
  TIMEOUT: 30000, // Download timeout (30 seconds)
} as const;

// File paths and extensions
export const FILE_CONFIG = {
  MANIFEST_FILENAME: 'manifest.json',
  MINECRAFT_JAR_EXT: '.jar',
  LOG_FILE_EXT: '.log',
  RESOURCE_PACK_EXT: '.zip',
  BLACKLIST_PATTERNS: [
    'config/**',
    'saves/**',
    'screenshots/**',
    'logs/**',
    'crash-reports/**',
    '.git/**',
    '*.log',
    '*.tmp',
  ],
} as const;

// External URLs
export const EXTERNAL_URLS = {
  MICROSOFT_AUTH_CLIENT_ID: 'cd1d612b-3203-4622-88d2-4d1f58fb7762',
  MC_HEADS_AVATAR: 'https://mc-heads.net/avatar',
  MINECRAFT_VERSION_MANIFEST: 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
  FABRIC_META: 'https://meta.fabricmc.net',
} as const;

// Environment-based configuration
const isDev = import.meta.env.DEV;

export const ENV_CONFIG = {
  IS_DEV: isDev,
  LOG_LEVEL: isDev ? 'debug' : 'info',
  ENABLE_DEBUG_LOGS: isDev,
  SHOW_DEV_TOOLS: isDev,
  MOCK_API_DELAY: isDev ? 500 : 0,
} as const;

// Animation presets
export const ANIMATION_CONFIG = {
  SPRING: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 17,
  },
  SMOOTH: {
    duration: 0.3,
    ease: 'easeInOut' as const,
  },
  FADE_IN: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  SLIDE_UP: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  SCALE_IN: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
} as const;

// Feature flags
export const FEATURES = {
  ENABLE_DISCORD: true,
  ENABLE_STATS: true,
  ENABLE_MAP_VIEWER: true,
  ENABLE_AUTO_UPDATE: true,
  ENABLE_CRASH_REPORTING: false,
  ENABLE_TELEMETRY: false,
} as const;