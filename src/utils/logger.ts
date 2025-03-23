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

// Frequency limiting for repeated logs
const messageFrequency: Record<string, number> = {};
const MESSAGE_THROTTLE_MS = 1000; // Only log same message once per second
const RENDER_LOG_FREQUENCY = 30; // Only log render messages every 30 frames

// Counter for render method calls
let renderCounter = 0;

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Blacklist of message patterns to filter out entirely
const filteredPatterns = [
  'Drawing selection highlights for 0 tasks',
  'Canvas cleared',
  'Header drawn'
];

/**
 * Checks if a message should be filtered based on content
 */
function shouldFilterMessage(message: string): boolean {
  // Don't log empty selection highlights and other repetitive render messages
  return filteredPatterns.some(pattern => message.includes(pattern));
}

/**
 * Checks if a message should be throttled based on frequency
 */
function shouldThrottleMessage(message: string): boolean {
  const now = Date.now();
  const lastTime = messageFrequency[message] || 0;
  
  if (now - lastTime < MESSAGE_THROTTLE_MS) {
    return true;
  }
  
  messageFrequency[message] = now;
  return false;
}

/**
 * Logger utility with environment-aware logging
 */
export const Logger = {
  /**
   * Log message only in development or when debug mode is enabled
   */
  log: function(...args: any[]): void {
    if (!debugMode) return;

    // Convert message to string for filtering
    const message = String(args[0] || '');
    
    // Filter out noisy messages
    if (shouldFilterMessage(message)) return;
    
    // Throttle frequent identical messages
    if (shouldThrottleMessage(message)) return;
    
    // Special handling for render method messages
    if (message.includes('Render method called')) {
      renderCounter++;
      if (renderCounter % RENDER_LOG_FREQUENCY !== 0) return;
    }
    
    originalConsole.log(...args);
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
   * Log error message (always logged)
   */
  error: function(...args: any[]): void {
    // Always log errors, but limit frequency in production
    if (!debugMode && shouldThrottleMessage(String(args[0] || ''))) {
      return;
    }
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
   * Check if debug mode is enabled
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