/**
 * Centralized logging utility for PerspectiveLens
 * Provides consistent logging across all modules
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

export const logger = {
  error: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(LOG_PREFIX, ...args);
    }
  },

  warn: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(LOG_PREFIX, ...args);
    }
  },

  info: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.info(LOG_PREFIX, ...args);
    }
  },

  debug: (...args) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(LOG_PREFIX, ...args);
    }
  },

  group: (label) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.group(LOG_PREFIX, label);
    }
  },

  groupEnd: () => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.groupEnd();
    }
  }
};
