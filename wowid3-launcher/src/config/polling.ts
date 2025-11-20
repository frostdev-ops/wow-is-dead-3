
export const POLLING_CONFIG = {
  // Update checks
  MANIFEST_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes

  // Server status
  SERVER_STATUS_INTERVAL: 30 * 1000, // 30 seconds

  // Game health
  GAME_HEALTH_CHECK_INTERVAL: 5 * 1000, // 5 seconds

  // Modpack check on startup
  MODPACK_CHECK_DELAY: 2 * 1000, // 2 seconds after auth
  MODPACK_CHECK_MAX_RETRIES: 5,
  MODPACK_CHECK_BACKOFF_BASE: 1000, // 1 second
  MODPACK_CHECK_BACKOFF_MAX: 60 * 1000, // 1 minute

  // Background verification
  BACKGROUND_VERIFY_DELAY: 5 * 1000, // 5 seconds

  // Timeouts
  MANIFEST_FETCH_TIMEOUT: 30 * 1000, // 30 seconds
  GAME_LAUNCH_TIMEOUT: 5 * 60 * 1000, // 5 minutes

  // Retry logic
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BACKOFF_BASE: 1000,
  RETRY_BACKOFF_MAX: 30 * 1000,
  RETRY_JITTER: true,
};

// Environment-specific overrides
const ENV_CONFIG: Record<string, typeof POLLING_CONFIG> = {
  development: {
    ...POLLING_CONFIG,
    MANIFEST_CHECK_INTERVAL: 30 * 1000, // More frequent in dev
    SERVER_STATUS_INTERVAL: 10 * 1000,
  },
  test: {
    ...POLLING_CONFIG,
    MANIFEST_CHECK_INTERVAL: 100, // Very fast in tests
    SERVER_STATUS_INTERVAL: 100,
    GAME_HEALTH_CHECK_INTERVAL: 100,
  },
};

export function getPollingConfig() {
  const env = import.meta.env.MODE || 'production';
  return ENV_CONFIG[env] || POLLING_CONFIG;
}


