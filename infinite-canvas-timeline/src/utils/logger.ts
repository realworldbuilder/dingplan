/**
 * Logger utility to control console output based on environment
 * This allows for easy enabling/disabling of logs in production vs development
 */

// Environment detection
const isDevelopment = () => {
  return (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.local')
  );
};

// Debug mode flag - can be toggled at runtime
let debugMode = isDevelopment();

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

/**
 * Logger utility with environment-aware logging
 */
export const Logger = {
  /**
   * Log message only in development or when debug mode is enabled
   */
  log: function(...args: any[]): void {
    if (debugMode) {
      originalConsole.log(...args);
    }
  },

  /**
   * Log warning message only in development or when debug mode is enabled
   */
  warn: function(...args: any[]): void {
    if (debugMode) {
      originalConsole.warn(...args);
    }
  },

  /**
   * Log info message only in development or when debug mode is enabled
   */
  info: function(...args: any[]): void {
    if (debugMode) {
      originalConsole.info(...args);
    }
  },

  /**
   * Log debug message only in development or when debug mode is enabled
   */
  debug: function(...args: any[]): void {
    if (debugMode) {
      originalConsole.debug(...args);
    }
  },

  /**
   * Always log errors regardless of environment
   */
  error: function(...args: any[]): void {
    // Errors should always be logged
    originalConsole.error(...args);
  },

  /**
   * Enable debug logging
   */
  enableDebugMode: function(): void {
    debugMode = true;
    originalConsole.log('Debug logging enabled');
  },

  /**
   * Disable debug logging
   */
  disableDebugMode: function(): void {
    debugMode = false;
    originalConsole.log('Debug logging disabled');
  },

  /**
   * Toggle debug logging
   */
  toggleDebugMode: function(): boolean {
    debugMode = !debugMode;
    originalConsole.log(`Debug logging ${debugMode ? 'enabled' : 'disabled'}`);
    return debugMode;
  },

  /**
   * Get current debug mode status
   */
  isDebugMode: function(): boolean {
    return debugMode;
  }
};

// Initialize - automatically disable logs in production
if (!isDevelopment()) {
  debugMode = false;
}

// Add to window for easy access in console
(window as any).DingplanLogger = Logger; 