/**
 * Simple logger utility for TrackMate backend
 * Provides consistent logging with environment awareness
 */

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  /**
   * Log informational messages (only in development)
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  info: (message, ...args) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log debug messages (only in development)
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  debug: (message, ...args) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Log error messages (always logged)
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments (typically error object)
   */
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  /**
   * Log success messages (only in development)
   * @param {string} message - Success message
   * @param {...any} args - Additional arguments
   */
  success: (message, ...args) => {
    if (isDev) {
      console.log(`[SUCCESS] ${message}`, ...args);
    }
  }
};

module.exports = logger;
