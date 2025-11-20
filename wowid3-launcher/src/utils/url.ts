/**
 * Extracts the base server URL from a manifest URL.
 * Handles various URL formats:
 * - https://example.com/api/manifest/latest -> https://example.com
 * - https://example.com/custom/manifest -> https://example.com
 * - https://example.com:8080/api/manifest/latest -> https://example.com:8080
 */
export function extractBaseUrl(manifestUrl: string): string {
  try {
    const url = new URL(manifestUrl);
    // Return origin (protocol + host + port if present)
    return url.origin;
  } catch {
    // Fallback: try to extract base URL manually
    // Remove common manifest path patterns
    let baseUrl = manifestUrl
      .replace(/\/api\/manifest\/latest\/?$/, '')
      .replace(/\/manifest\.json\/?$/, '')
      .replace(/\/latest\/?$/, '');
    
    // If no protocol, assume https
    if (!baseUrl.match(/^https?:\/\//)) {
      baseUrl = 'https://' + baseUrl;
    }
    
    // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/+$/, '');
    
    return baseUrl;
  }
}

