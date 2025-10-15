/**
 * Centralized logging utility for PerspectiveLens
 * Provides consistent logging across all modules with event broadcasting
 */

const LOG_PREFIX = '[PerspectiveLens]';
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Set to INFO in production, DEBUG in development
const CURRENT_LEVEL = LOG_LEVELS.DEBUG;

/**
 * Broadcast log event to UI components
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {Array} args - Log arguments
 */
function broadcastLog(level, args) {
  // Try to send message to content script via chrome runtime
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      chrome.runtime.sendMessage({
        type: 'LOGGER_EVENT',
        level,
        message: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
        timestamp: Date.now()
      }).catch(() => {
        // Silently fail if no listeners
      });
    } catch (e) {
      // Extension context not available
    }
  }

  // Also dispatch custom event for content scripts
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('perspectivelens:log', {
        detail: {
          level,
          message: args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '),
          timestamp: Date.now()
        }
      }));
    } catch (e) {
      // Window not available (service worker context)
    }
  }
}

export const logger = {
  error: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(LOG_PREFIX, ...args);
      broadcastLog('error', args);
    }
  },

  warn: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(LOG_PREFIX, ...args);
      broadcastLog('warning', args);
    }
  },

  info: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.info(LOG_PREFIX, ...args);
      broadcastLog('info', args);
    }
  },

  debug: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(LOG_PREFIX, ...args);
      broadcastLog('info', args);
    }
  },

  group: (label) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.group(LOG_PREFIX, label);
      broadcastLog('info', [label]);
    }
  },

  groupEnd: () => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.groupEnd();
    }
  }
};

// Expose logger globally for content scripts
if (typeof window !== 'undefined') {
  window.PerspectiveLensLogger = logger;
}
