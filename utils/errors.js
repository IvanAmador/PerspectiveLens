/**
 * Custom error classes for PerspectiveLens
 * Provides specific error types for better error handling
 */

export class PerspectiveLensError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'PerspectiveLensError';
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

export class AIModelError extends PerspectiveLensError {
  constructor(message, details = {}) {
    super(message, 'AI_MODEL_ERROR');
    this.name = 'AIModelError';
    this.details = details;
  }
}

export class APIError extends PerspectiveLensError {
  constructor(message, statusCode = null) {
    super(message, 'API_ERROR');
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

export class ValidationError extends PerspectiveLensError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Error handler utility
 */
export function handleError(error, context = '') {
  const errorInfo = {
    message: error.message,
    code: error.code || 'UNKNOWN',
    context,
    timestamp: new Date().toISOString(),
    stack: error.stack
  };

  // Log to console
  console.error(`[PerspectiveLens Error]${context ? ` [${context}]` : ''}`, errorInfo);

  // In production, you might want to send to analytics
  // sendToAnalytics(errorInfo);

  return errorInfo;
}

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES = {
  AI_UNAVAILABLE: 'AI models are not available on this device. Please check system requirements.',
  AI_DOWNLOADING: 'AI models are being downloaded. Please wait...',
  API_RATE_LIMIT: 'Daily API quota exceeded. Please try again tomorrow.',
  NO_RESULTS: 'No international coverage found for this story.',
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  TRANSLATION_FAILED: 'Translation failed. Showing original text.',
  CACHE_FULL: 'Cache is full. Old entries will be removed automatically.',
  INVALID_ARTICLE: 'Could not extract article data. Try the manual analysis button.'
};
