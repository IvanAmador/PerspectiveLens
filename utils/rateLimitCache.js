/**
 * Rate Limit Cache Manager
 *
 * Manages rate limit blocks based on API 429 responses.
 * Uses a reactive approach: doesn't track requests locally,
 * only stores blocks when receiving 429 errors from Google AI Studio API.
 *
 * API Error Structure (generativelanguage.googleapis.com):
 * {
 *   error: {
 *     code: 429,
 *     status: "RESOURCE_EXHAUSTED",
 *     message: "...",
 *     details: [
 *       {
 *         "@type": "type.googleapis.com/google.rpc.RetryInfo",
 *         "retryDelay": "15s"
 *       },
 *       {
 *         "@type": "type.googleapis.com/google.rpc.QuotaFailure",
 *         "violations": [
 *           {
 *             "quotaMetric": "generativelanguage.googleapis.com/...",
 *             "quotaId": "GenerateContentInputTokensPerModelPerDay-FreeTier",
 *             "quotaDimensions": { "location": "global", "model": "gemini-2.5-pro" }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * @module utils/rateLimitCache
 */

import { logger } from './logger.js';

/**
 * Rate Limit Cache Manager
 */
class RateLimitCache {
  constructor() {
    this.STORAGE_PREFIX = 'rateLimit_';
  }

  /**
   * Records a rate limit hit after receiving a 429 error
   *
   * @param {string} model - Model name (e.g., 'gemini-2.5-pro')
   * @param {Object} errorResponse - Complete 429 error response from API
   * @returns {Promise<void>}
   */
  async recordRateLimitHit(model, errorResponse) {
    logger.system.debug('Recording rate limit hit', {
      category: logger.CATEGORIES.ERROR,
      model
    });

    const retryDelay = this._extractRetryDelay(errorResponse);
    const quotaInfo = this._extractQuotaInfo(errorResponse);

    const blockUntil = Date.now() + (retryDelay * 1000);

    const blockData = {
      blockedUntil: blockUntil,
      retryDelay,
      quotaMetric: quotaInfo.metric,
      quotaId: quotaInfo.id,
      quotaDimensions: quotaInfo.dimensions,
      timestamp: Date.now(),
      errorMessage: errorResponse.error?.message || 'Rate limit exceeded'
    };

    await chrome.storage.local.set({
      [`${this.STORAGE_PREFIX}${model}`]: blockData
    });

    logger.system.warn('Model blocked due to rate limit', {
      category: logger.CATEGORIES.ERROR,
      model,
      retryDelay,
      blockUntil: new Date(blockUntil).toISOString()
    });
  }

  /**
   * Checks if a model is available (not blocked by rate limit)
   *
   * @param {string} model - Model name
   * @returns {Promise<boolean>} - True if available, false if blocked
   */
  async isModelAvailable(model) {
    const data = await chrome.storage.local.get(`${this.STORAGE_PREFIX}${model}`);
    const block = data[`${this.STORAGE_PREFIX}${model}`];

    if (!block) {
      return true;
    }

    // If block time has passed, clear and return available
    if (Date.now() >= block.blockedUntil) {
      await this.clearBlock(model);

      logger.system.info('Rate limit block expired', {
        category: logger.CATEGORIES.GENERAL,
        model
      });

      return true;
    }

    // Still blocked
    const remainingSeconds = Math.ceil((block.blockedUntil - Date.now()) / 1000);
    logger.system.debug('Model still blocked', {
      category: logger.CATEGORIES.GENERAL,
      model,
      remainingSeconds
    });

    return false;
  }

  /**
   * Gets remaining block time in seconds
   *
   * @param {string} model - Model name
   * @returns {Promise<number>} - Seconds remaining (0 if not blocked)
   */
  async getBlockedTimeRemaining(model) {
    const data = await chrome.storage.local.get(`${this.STORAGE_PREFIX}${model}`);
    const block = data[`${this.STORAGE_PREFIX}${model}`];

    if (!block || Date.now() >= block.blockedUntil) {
      return 0;
    }

    return Math.ceil((block.blockedUntil - Date.now()) / 1000);
  }

  /**
   * Gets block information for a model
   *
   * @param {string} model - Model name
   * @returns {Promise<Object|null>} - Block data or null if not blocked
   */
  async getBlockInfo(model) {
    const data = await chrome.storage.local.get(`${this.STORAGE_PREFIX}${model}`);
    const block = data[`${this.STORAGE_PREFIX}${model}`];

    if (!block) {
      return null;
    }

    // If expired, clear and return null
    if (Date.now() >= block.blockedUntil) {
      await this.clearBlock(model);
      return null;
    }

    return {
      ...block,
      remainingSeconds: Math.ceil((block.blockedUntil - Date.now()) / 1000)
    };
  }

  /**
   * Gets status for all models
   *
   * @param {string[]} models - Array of model names to check
   * @returns {Promise<Object[]>} - Array of model status objects
   */
  async getAllModelsStatus(models) {
    const statuses = [];

    for (const model of models) {
      const blockInfo = await this.getBlockInfo(model);

      statuses.push({
        model,
        available: blockInfo === null,
        blockInfo
      });
    }

    return statuses;
  }

  /**
   * Clears rate limit block for a model
   *
   * @param {string} model - Model name
   * @returns {Promise<void>}
   */
  async clearBlock(model) {
    await chrome.storage.local.remove(`${this.STORAGE_PREFIX}${model}`);

    logger.system.debug('Cleared rate limit block', {
      category: logger.CATEGORIES.GENERAL,
      model
    });
  }

  /**
   * Clears all rate limit blocks
   *
   * @returns {Promise<void>}
   */
  async clearAllBlocks() {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(key =>
      key.startsWith(this.STORAGE_PREFIX)
    );

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);

      logger.system.info('Cleared all rate limit blocks', {
        category: logger.CATEGORIES.GENERAL,
        count: keysToRemove.length
      });
    }
  }

  /**
   * Extracts retry delay from error response
   *
   * @private
   * @param {Object} errorResponse - 429 error response
   * @returns {number} - Retry delay in seconds
   */
  _extractRetryDelay(errorResponse) {
    const details = errorResponse.error?.details || [];

    // Look for RetryInfo in details array
    const retryInfo = details.find(d =>
      d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
    );

    if (retryInfo?.retryDelay) {
      // Format: "15s" or "15.002899939s"
      const match = retryInfo.retryDelay.match(/^(\d+(?:\.\d+)?)s?$/);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    // Default fallback: 60 seconds
    logger.system.warn('Could not extract retryDelay from error, using default', {
      category: logger.CATEGORIES.ERROR,
      defaultDelay: 60
    });

    return 60;
  }

  /**
   * Extracts quota information from error response
   *
   * @private
   * @param {Object} errorResponse - 429 error response
   * @returns {Object} - Quota information
   */
  _extractQuotaInfo(errorResponse) {
    const details = errorResponse.error?.details || [];

    // Look for QuotaFailure in details array
    const quotaFailure = details.find(d =>
      d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure'
    );

    if (quotaFailure?.violations?.[0]) {
      const violation = quotaFailure.violations[0];
      return {
        metric: violation.quotaMetric || 'unknown',
        id: violation.quotaId || 'unknown',
        dimensions: violation.quotaDimensions || {}
      };
    }

    return {
      metric: 'unknown',
      id: 'unknown',
      dimensions: {}
    };
  }
}

// Export singleton instance
export const rateLimitCache = new RateLimitCache();
