/**
 * Security utilities for input validation and sanitization
 */

// Allowed manifest hosts - only these domains can serve manifests
const ALLOWED_MANIFEST_HOSTS = [
  'wowid-launcher.frostdev.io',
  'mc.frostdev.io',
  'localhost',
  '127.0.0.1',
] as const;

// Allowed manifest path patterns
const ALLOWED_MANIFEST_PATHS = [
  '/api/manifest/latest',
  '/api/manifest/v',
  '/manifest.json',
];

/**
 * Validates a manifest URL to ensure it's from an allowed host and uses HTTPS
 * @param url The URL to validate
 * @returns True if valid, false otherwise
 */
export const validateManifestUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);

    // Development exception - allow HTTP for localhost
    const isDev = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    // Require HTTPS in production
    if (!isDev && parsed.protocol !== 'https:') {
      console.warn('[Security] Manifest URL must use HTTPS:', url);
      return false;
    }

    // Check if host is in allowlist
    const isAllowedHost = ALLOWED_MANIFEST_HOSTS.some(host =>
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );

    if (!isAllowedHost) {
      console.warn('[Security] Manifest URL host not in allowlist:', parsed.hostname);
      console.warn('[Security] Allowed hosts:', ALLOWED_MANIFEST_HOSTS.join(', '));
      return false;
    }

    // Validate path doesn't contain traversal attempts
    if (parsed.pathname.includes('../') || parsed.pathname.includes('..\\')) {
      console.warn('[Security] Manifest URL contains path traversal:', url);
      return false;
    }

    // Validate path matches expected patterns
    const hasValidPath = ALLOWED_MANIFEST_PATHS.some(allowedPath => 
      parsed.pathname.startsWith(allowedPath) || parsed.pathname === allowedPath
    );

    if (!hasValidPath) {
      console.warn('[Security] Manifest URL path not in allowlist:', parsed.pathname);
      console.warn('[Security] Allowed paths:', ALLOWED_MANIFEST_PATHS.join(', '));
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[Security] Invalid manifest URL:', url, error);
    return false;
  }
};

/**
 * Validates a game directory path
 * @param path The path to validate
 * @returns True if valid, false otherwise
 */
export const validateGameDirectory = (path: string): boolean => {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Basic path validation - no null bytes, must be absolute
  if (path.includes('\0')) {
    console.warn('[Security] Game directory contains null byte');
    return false;
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\$\{.*\}/,  // Template injection
    /\$\(.*\)/,  // Command substitution
    /`.*`/,      // Backticks
    /%[A-Z_]+%/, // Windows environment variables that shouldn't be here
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(path)) {
      console.warn('[Security] Game directory contains suspicious pattern:', path);
      return false;
    }
  }

  // Path length check (Windows has 260 char limit)
  if (path.length > 260) {
    console.warn('[Security] Game directory path too long');
    return false;
  }

  return true;
};

/**
 * Validates RAM allocation
 * @param ramMB RAM allocation in megabytes
 * @returns True if valid, false otherwise
 */
export const validateRamAllocation = (ramMB: number): boolean => {
  // Must be a number
  if (typeof ramMB !== 'number' || isNaN(ramMB)) {
    return false;
  }

  // Minimum 1GB, maximum 64GB
  const MIN_RAM = 1024;  // 1GB
  const MAX_RAM = 65536; // 64GB

  if (ramMB < MIN_RAM || ramMB > MAX_RAM) {
    console.warn('[Security] RAM allocation out of bounds:', ramMB);
    return false;
  }

  // Must be a multiple of 512MB for JVM efficiency
  if (ramMB % 512 !== 0) {
    console.warn('[Security] RAM allocation should be multiple of 512MB:', ramMB);
    return false;
  }

  return true;
};

/**
 * Validates a server address
 * @param address The server address (hostname:port)
 * @returns True if valid, false otherwise
 */
export const validateServerAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Split into host and port
  const parts = address.split(':');
  if (parts.length > 2) {
    return false; // Too many colons
  }

  const [host, portStr] = parts;

  // Validate host
  if (!host || host.length > 253) {
    return false;
  }

  // Check for invalid characters in hostname
  const validHostRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

  if (!validHostRegex.test(host) && !isIpAddress) {
    console.warn('[Security] Invalid server hostname:', host);
    return false;
  }

  // Validate IP address ranges if it's an IP
  if (isIpAddress) {
    const octets = host.split('.').map(Number);
    if (octets.some(o => o > 255)) {
      return false;
    }
  }

  // Validate port if provided
  if (portStr) {
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.warn('[Security] Invalid server port:', portStr);
      return false;
    }
  }

  return true;
};

/**
 * Sanitizes error messages to remove sensitive information
 * @param error The error to sanitize
 * @returns A safe error message for display
 */
export const sanitizeErrorMessage = (error: unknown): string => {
  if (!error) {
    return 'An unknown error occurred';
  }

  const message = error instanceof Error ? error.message : String(error);

  // Remove file paths
  let sanitized = message.replace(/[A-Z]:\\[^:\s]*/gi, '[PATH]');
  sanitized = sanitized.replace(/\/[^:\s]*/g, '[PATH]');

  // Remove URLs with potential credentials
  sanitized = sanitized.replace(/https?:\/\/[^@]*@[^\s]*/gi, '[URL]');

  // Remove potential tokens/keys (long hex strings)
  sanitized = sanitized.replace(/[a-f0-9]{32,}/gi, '[REDACTED]');

  // Remove stack traces
  sanitized = sanitized.replace(/\n\s*at\s.*/g, '');

  // Limit length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized;
};

/**
 * Generate HMAC for LocalStorage integrity
 * Note: This is a simplified version. In production, use a proper key derivation
 */
export const generateIntegrityHash = async (data: string): Promise<string> => {
  // Use a fixed salt for this session (in production, derive from hardware ID)
  const salt = 'wowid3-launcher-integrity-2024';
  const combined = salt + data;

  // Use Web Crypto API to generate hash
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
};

/**
 * Verify integrity of LocalStorage data
 */
export const verifyIntegrity = async (data: string, expectedHash: string): Promise<boolean> => {
  try {
    const actualHash = await generateIntegrityHash(data);
    return actualHash === expectedHash;
  } catch {
    return false;
  }
};