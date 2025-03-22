/**
 * Logger utility to control console output based on environment
 * This allows for easy enabling/disabling of logs in production vs development
 */
/**
 * Logger utility with environment-aware logging
 */
export declare const Logger: {
    /**
     * Log message only in development or when debug mode is enabled
     */
    log: (...args: any[]) => void;
    /**
     * Log warning message only in development or when debug mode is enabled
     */
    warn: (...args: any[]) => void;
    /**
     * Log info message only in development or when debug mode is enabled
     */
    info: (...args: any[]) => void;
    /**
     * Log debug message only in development or when debug mode is enabled
     */
    debug: (...args: any[]) => void;
    /**
     * Always log errors regardless of environment
     */
    error: (...args: any[]) => void;
    /**
     * Enable debug logging
     */
    enableDebugMode: () => void;
    /**
     * Disable debug logging
     */
    disableDebugMode: () => void;
    /**
     * Toggle debug logging
     */
    toggleDebugMode: () => boolean;
    /**
     * Get current debug mode status
     */
    isDebugMode: () => boolean;
};
