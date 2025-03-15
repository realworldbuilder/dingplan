/**
 * Browser-compatible UUID generation utility
 */

/**
 * Generate a UUID v4 string (browser-compatible)
 * This implementation avoids the use of Node.js crypto module
 */
export function generateUUID(): string {
  // RFC4122 compliant UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Check if the browser supports the native crypto.randomUUID method
 * If available, use it; otherwise, fall back to our implementation
 */
export function uuid(): string {
  // Use native crypto.randomUUID if available (modern browsers)
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  
  // Fall back to our implementation
  return generateUUID();
}

// Default export for convenience
export default uuid; 