/**
 * Professional Structured Logging System for PerspectiveLens
 * 
 * Features:
 * - Structured logging with rich metadata
 * - Dual-context logging (USER vs SYSTEM)
 * - Request ID tracking for operation flows
 * - Automatic sanitization of sensitive data
 * - Progress tracking integration
 * - Category-based organization
 * - Broadcasting to UI components
 * 
 * Best Practices Based On:
 * - Structured logging patterns (JSON format)
 * - Log level standardization (ERROR > WARN > INFO > DEBUG > TRACE)
 * - Context separation (technical vs user-facing)
 * - Performance optimization (rate limiting, batching)
 */

const LOG_PREFIX = '[PerspectiveLens]';

/**
 * Log Levels (Standard Severity Hierarchy)
 */
const LOG_LEVELS = {
  ERROR: 0,  // Critical failures that stop operation
  WARN: 1,   // Non-critical issues that deserve attention
  INFO: 2,   // Important informational messages
  DEBUG: 3,  // Detailed debugging information
  TRACE: 4   // Ultra-detailed execution traces
};

/**
 * Log Contexts (Dual-audience logging)
 */
const LOG_CONTEXTS = {
  USER: 'USER',     // User-facing messages (frontend)
  SYSTEM: 'SYSTEM', // Technical messages (console/background)
  BOTH: 'BOTH'      // Messages relevant to both audiences
};

/**
 * Log Categories (Operation types)
 */
const LOG_CATEGORIES = {
  GENERAL: 'general',
  EXTRACT: 'extract',
  KEYWORDS: 'keywords',
  SEARCH: 'search',
  FETCH: 'fetch',
  ANALYZE: 'analyze',
  TRANSLATE: 'translate',
  COMPRESS: 'compress',
  VALIDATE: 'validate',
  ERROR: 'error'
};

/**
 * Environment Configuration
 */
const CONFIG = {
  // Console logging level (change to INFO in production)
  consoleLevel: LOG_LEVELS.TRACE,
  
  // User interface logging level (always INFO or higher)
  uiLevel: LOG_LEVELS.INFO,
  
  // Enable/disable broadcasting to UI
  broadcastEnabled: true,
  
  // Rate limiting for repeated logs (ms)
  rateLimitWindow: 1000,
  
  // Maximum log entries to keep in memory
  maxLogHistory: 100,
  
  // Sensitive keys to sanitize
  sensitiveKeys: ['password', 'token', 'apiKey', 'secret', 'auth']
};

/**
 * Global State
 */
const state = {
  // Current request ID for operation tracking
  currentRequestId: null,

  // Current tab ID for targeted messaging
  currentTabId: null,

  // Log history (for debugging and analytics)
  history: [],

  // Rate limiting tracker
  rateLimitTracker: new Map(),

  // Request start times (for duration tracking)
  requestTimings: new Map()
};

/**
 * Generate unique Request ID
 * @returns {string} Unique identifier
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current Request ID or generate new one
 * @returns {string} Current request ID
 */
function getCurrentRequestId() {
  if (!state.currentRequestId) {
    state.currentRequestId = generateRequestId();
  }
  return state.currentRequestId;
}

/**
 * Start a new request tracking session
 * @param {string} operationName - Name of the operation
 * @param {number|null} tabId - Tab ID where the operation is running
 * @returns {string} New request ID
 */
function startRequest(operationName, tabId = null) {
  const requestId = generateRequestId();
  state.currentRequestId = requestId;
  state.currentTabId = tabId;
  state.requestTimings.set(requestId, {
    startTime: Date.now(),
    operation: operationName,
    tabId
  });
  return requestId;
}

/**
 * End request tracking and return duration
 * @param {string} requestId - Request ID to end
 * @returns {number} Duration in milliseconds
 */
function endRequest(requestId) {
  const timing = state.requestTimings.get(requestId);
  if (timing) {
    const duration = Date.now() - timing.startTime;
    state.requestTimings.delete(requestId);
    return duration;
  }
  return null;
}

/**
 * Clear current request context
 */
function clearRequest() {
  state.currentRequestId = null;
  state.currentTabId = null;
}

/**
 * Set tab ID for current context
 * @param {number|null} tabId - Tab ID to set
 */
function setTabId(tabId) {
  state.currentTabId = tabId;
}

/**
 * Get current tab ID
 * @returns {number|null} Current tab ID
 */
function getCurrentTabId() {
  return state.currentTabId;
}

/**
 * Sanitize object by removing sensitive information
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
function sanitizeData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = CONFIG.sensitiveKeys.some(k => lowerKey.includes(k));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Check if log should be rate-limited
 * @param {string} key - Rate limit key
 * @returns {boolean} True if should be rate-limited
 */
function shouldRateLimit(key) {
  const now = Date.now();
  const lastLog = state.rateLimitTracker.get(key);
  
  if (!lastLog) {
    state.rateLimitTracker.set(key, now);
    return false;
  }
  
  if (now - lastLog < CONFIG.rateLimitWindow) {
    return true;
  }
  
  state.rateLimitTracker.set(key, now);
  return false;
}

/**
 * Format log entry with structured metadata
 * @param {string} level - Log level
 * @param {string} context - Log context
 * @param {string} message - Log message
 * @param {Object} options - Additional options
 * @returns {Object} Formatted log entry
 */
function formatLogEntry(level, context, message, options = {}) {
  const {
    category = LOG_CATEGORIES.GENERAL,
    data = null,
    error = null,
    progress = null,
    requestId = getCurrentRequestId()
  } = options;
  
  return {
    level,
    context,
    timestamp: new Date().toISOString(),
    message,
    category,
    requestId,
    progress,
    data: sanitizeData(data),
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : null
  };
}

/**
 * Should log to console based on level and configuration
 * @param {string} level - Log level
 * @returns {boolean} True if should log to console
 */
function shouldLogToConsole(level) {
  return LOG_LEVELS[level] <= CONFIG.consoleLevel;
}

/**
 * Should broadcast to UI based on context and level
 * @param {string} level - Log level
 * @param {string} context - Log context
 * @returns {boolean} True if should broadcast
 */
function shouldBroadcast(level, context) {
  if (!CONFIG.broadcastEnabled) return false;

  // Only broadcast USER and BOTH context logs to UI
  // SYSTEM logs stay in console only
  return context === 'USER' || context === 'BOTH';
}

/**
 * Format message for console output
 * @param {Object} entry - Log entry
 * @returns {Array} Arguments for console method
 */
function formatConsoleOutput(entry) {
  const parts = [LOG_PREFIX, entry.message];

  // Add error details if present - as separate console argument for proper object expansion
  if (entry.error) {
    parts.push('\n  Error:');
    // Format error with stack trace
    const errorInfo = {
      message: entry.error.message || String(entry.error),
      name: entry.error.name,
      stack: entry.error.stack
    };
    parts.push(errorInfo);
  }

  // Add data if present - as separate console argument for proper object expansion
  if (entry.data) {
    parts.push('\n  Data:');
    parts.push(entry.data);
  }

  return parts;
}

/**
 * Send message to specific tab with retry logic
 * @param {number} tabId - Target tab ID
 * @param {Object} message - Message to send
 * @param {number} retries - Number of retries
 * @returns {Promise<boolean>} True if successful
 */
async function sendMessageToTab(tabId, message, retries = 2) {
  if (!tabId) {
    console.warn('[Logger] No tabId provided for message:', message.type);
    return false;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return true;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        console.error('[Logger] Failed to send message after retries:', {
          tabId,
          messageType: message.type,
          error: error.message,
          attempts: attempt + 1
        });
        return false;
      }

      // Wait before retry (exponential backoff: 50ms, 100ms)
      await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
    }
  }

  return false;
}

/**
 * Broadcast log to UI components
 * NOTE: This is deprecated - use logUserProgress() instead for UI updates
 * Kept for backward compatibility but does nothing
 * @param {Object} entry - Log entry
 */
async function broadcastToUI(entry) {
  // LOG_EVENT is deprecated - UI updates should use USER_PROGRESS
  // This function is kept for backward compatibility but does nothing
  // All user-facing logs should use logUserProgress() directly
}

/**
 * Add log to history (for debugging)
 * @param {Object} entry - Log entry
 */
function addToHistory(entry) {
  state.history.push(entry);
  
  // Keep only last N entries
  if (state.history.length > CONFIG.maxLogHistory) {
    state.history.shift();
  }
}

/**
 * Core logging function
 * @param {string} level - Log level
 * @param {string} context - Log context
 * @param {string} message - Log message
 * @param {Object} options - Additional options
 */
function log(level, context, message, options = {}) {
  // Format log entry
  const entry = formatLogEntry(level, context, message, options);

  // Add to history
  addToHistory(entry);

  // Console output
  if (shouldLogToConsole(level)) {
    const consoleArgs = formatConsoleOutput(entry);
    const consoleMethod = level === 'ERROR' ? 'error' :
                         level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](...consoleArgs);
  }

  // Note: UI updates should use logUserProgress() directly, not broadcast
  // broadcastToUI is deprecated and does nothing
}

/**
 * Log progress update (special case for UI progress bars)
 * @param {string} category - Operation category
 * @param {Object} options - Progress options
 */
function logProgress(category, options = {}) {
  const {
    status = 'active',
    userMessage = '',
    systemMessage = '',
    progress = null,
    data = null
  } = options;
  
  // User-facing progress
  if (userMessage) {
    log('INFO', 'USER', userMessage, {
      category,
      progress,
      data: { status, ...data }
    });
  }
  
  // System-level details
  if (systemMessage) {
    log('DEBUG', 'SYSTEM', systemMessage, {
      category,
      progress,
      data
    });
  }
  
  // Broadcast progress event (for compatibility with existing system)
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      chrome.runtime.sendMessage({
        type: 'PROGRESS_UPDATE',
        payload: {
          category,
          status,
          message: userMessage || systemMessage,
          progress
        }
      }).catch(() => {});
    } catch (e) {}
  }
}

/**
 * Public API - User Context Logging
 */
const user = {
  info: (message, options = {}) => 
    log('INFO', 'USER', message, options),
  
  warn: (message, options = {}) => 
    log('WARN', 'USER', message, options),
  
  error: (message, options = {}) => 
    log('ERROR', 'USER', message, options)
};

/**
 * Public API - System Context Logging
 */
const system = {
  trace: (message, options = {}) => 
    log('TRACE', 'SYSTEM', message, options),
  
  debug: (message, options = {}) => 
    log('DEBUG', 'SYSTEM', message, options),
  
  info: (message, options = {}) => 
    log('INFO', 'SYSTEM', message, options),
  
  warn: (message, options = {}) => 
    log('WARN', 'SYSTEM', message, options),
  
  error: (message, options = {}) => 
    log('ERROR', 'SYSTEM', message, options)
};

/**
 * Public API - Both Context Logging
 */
const both = {
  info: (message, options = {}) => 
    log('INFO', 'BOTH', message, options),
  
  warn: (message, options = {}) => 
    log('WARN', 'BOTH', message, options),
  
  error: (message, options = {}) => 
    log('ERROR', 'BOTH', message, options)
};

/**
 * Log user-friendly progress with optional AI indicator
 * @param {string} phase - Analysis phase (detection, search, extraction, compression, analysis)
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - User-friendly message
 * @param {Object} metadata - Additional metadata
 */
async function logUserProgress(phase, progress, message, metadata = {}) {
  const userLog = {
    context: 'USER',
    phase,
    progress,
    message,
    timestamp: Date.now(),
    ...metadata
  };

  // Send to specific tab only
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    const tabId = getCurrentTabId();

    if (!tabId) {
      console.warn('[Logger] No tabId set for USER_PROGRESS:', { phase, message });
      return;
    }

    const success = await sendMessageToTab(tabId, {
      type: 'USER_PROGRESS',
      payload: userLog
    });

    if (!success) {
      console.error('[Logger] Failed to send USER_PROGRESS:', {
        tabId,
        phase,
        progress,
        message
      });
    }
  }

  // Also log to system for debugging
  log('INFO', 'USER', message, {
    category: LOG_CATEGORIES.GENERAL,
    progress,
    data: metadata
  });
}

/**
 * Log AI operation with special indicator
 * @param {string} operation - AI operation type (translation, summarization, analysis, detection)
 * @param {Object} details - Operation details
 */
function logUserAI(operation, details) {
  const {
    phase,
    progress,
    message,
    metadata = {}
  } = details;

  logUserProgress(
    phase,
    progress,
    message,
    {
      icon: 'AI',
      aiOperation: operation,
      ...metadata
    }
  );
}

/**
 * Public API - Utilities
 */
const utils = {
  startRequest,
  endRequest,
  clearRequest,
  getCurrentRequestId,
  setTabId,
  getCurrentTabId,
  getHistory: () => [...state.history],
  clearHistory: () => state.history = [],
  setConfig: (key, value) => CONFIG[key] = value,

  // User-friendly progress logging
  logUserProgress,
  logUserAI
};

/**
 * Main Logger Export
 */
export const logger = {
  // Context-based logging
  user,
  system,
  both,
  
  // Progress tracking
  progress: logProgress,
  
  // Request tracking
  ...utils,
  
  // Constants (for external use)
  LEVELS: LOG_LEVELS,
  CONTEXTS: LOG_CONTEXTS,
  CATEGORIES: LOG_CATEGORIES
};
