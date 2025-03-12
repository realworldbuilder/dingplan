/**
 * Utility for resolving paths correctly in both development and production
 */

/**
 * Gets the base URL for assets and resources
 * 
 * @returns The base URL to use for assets
 */
export function getBaseUrl(): string {
  // In production, assets are in a different location
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    // Determine if we're in a subdirectory deployment
    const pathname = window.location.pathname;
    const baseUrl = pathname.endsWith('/') ? pathname : pathname + '/';
    return baseUrl;
  }
  
  // In development, use the root
  return '/';
}

/**
 * Resolves a path based on the current environment (dev or prod)
 * 
 * @param path The path to resolve
 * @returns The resolved path
 */
export function resolvePath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Combine with base URL
  return `${getBaseUrl()}${cleanPath}`;
} 