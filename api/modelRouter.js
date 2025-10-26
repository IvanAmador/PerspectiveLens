/**
 * Model Router
 *
 * Intelligently selects the best available Gemini API model based on:
 * - User's preferred model order
 * - Current rate limit status
 * - Automatic fallback to next available model
 *
 * Models hierarchy (free tier):
 * 1. gemini-2.5-pro       - Best quality (5 RPM / 125K TPM / 100 RPD)
 * 2. gemini-2.5-flash     - Good quality, faster (10 RPM / 250K TPM / 250 RPD)
 * 3. gemini-2.5-flash-lite - Fastest, highest RPD (15 RPM / 250K TPM / 1000 RPD)
 *
 * @module api/modelRouter
 */

import { rateLimitCache } from '../utils/rateLimitCache.js';
import { logger } from '../utils/logger.js';

/**
 * Model display names
 */
const MODEL_DISPLAY_NAMES = {
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-nano': 'Gemini Nano'
};

/**
 * Model Router for intelligent model selection with fallback
 */
class ModelRouter {
  /**
   * Creates a new ModelRouter
   *
   * @param {string[]} preferredModels - Array of model names in order of preference
   */
  constructor(preferredModels) {
    if (!preferredModels || preferredModels.length === 0) {
      throw new Error('preferredModels must be a non-empty array');
    }

    this.preferredModels = preferredModels;

    logger.system.debug('ModelRouter created', {
      category: logger.CATEGORIES.GENERAL,
      preferredModels
    });
  }

  /**
   * Selects the best available model (not blocked by rate limits)
   *
   * @returns {Promise<Object>} Selection result
   * @returns {string} result.model - Selected model name
   * @returns {boolean} result.wasFallback - True if not the preferred model
   * @returns {Object[]} result.blockedModels - Array of blocked models
   * @returns {string} result.preferredModel - Originally preferred model
   * @returns {string} result.displayName - Display name of selected model
   */
  async selectBestAvailableModel() {
    const blockedModels = [];

    logger.system.debug('Selecting best available model', {
      category: logger.CATEGORIES.GENERAL,
      preferredModels: this.preferredModels
    });

    for (const model of this.preferredModels) {
      const isAvailable = await rateLimitCache.isModelAvailable(model);

      if (isAvailable) {
        const wasFallback = blockedModels.length > 0;

        if (wasFallback) {
          logger.system.info('Using fallback model due to rate limits', {
            category: logger.CATEGORIES.ANALYZE,
            selectedModel: model,
            blockedModels: blockedModels.map(b => b.model),
            preferredModel: this.preferredModels[0]
          });
        } else {
          logger.system.info('Using preferred model', {
            category: logger.CATEGORIES.ANALYZE,
            selectedModel: model
          });
        }

        return {
          model,
          wasFallback,
          blockedModels,
          preferredModel: this.preferredModels[0],
          displayName: MODEL_DISPLAY_NAMES[model] || model
        };
      }

      // Model is blocked - get block info
      const timeRemaining = await rateLimitCache.getBlockedTimeRemaining(model);
      const blockInfo = await rateLimitCache.getBlockInfo(model);

      blockedModels.push({
        model,
        timeRemaining,
        displayName: MODEL_DISPLAY_NAMES[model] || model,
        quotaMetric: blockInfo?.quotaMetric,
        quotaId: blockInfo?.quotaId
      });

      logger.system.debug('Model blocked, checking next', {
        category: logger.CATEGORIES.GENERAL,
        model,
        timeRemaining
      });
    }

    // All models are blocked!
    const errorMessage = `All API models are rate limited. Please try again in ${blockedModels[0].timeRemaining}s.`;

    logger.system.error('All models blocked by rate limits', {
      category: logger.CATEGORIES.ERROR,
      blockedModels: blockedModels.map(b => ({
        model: b.model,
        timeRemaining: b.timeRemaining
      }))
    });

    const error = new Error(errorMessage);
    error.code = 'ALL_MODELS_RATE_LIMITED';
    error.blockedModels = blockedModels;
    throw error;
  }

  /**
   * Handles a rate limit error by recording the block
   *
   * @param {string} model - Model that hit the rate limit
   * @param {Object} errorResponse - Complete 429 error response from API
   * @returns {Promise<void>}
   */
  async handleRateLimitError(model, errorResponse) {
    await rateLimitCache.recordRateLimitHit(model, errorResponse);

    const timeRemaining = await rateLimitCache.getBlockedTimeRemaining(model);

    logger.system.warn('Rate limit hit registered', {
      category: logger.CATEGORIES.ERROR,
      model,
      timeRemaining
    });

    logger.user.warn(`${MODEL_DISPLAY_NAMES[model] || model} rate limited. Retry in ${timeRemaining}s.`, {
      category: logger.CATEGORIES.ERROR
    });
  }

  /**
   * Gets status for all preferred models
   *
   * @returns {Promise<Object[]>} Array of model status objects
   */
  async getModelsStatus() {
    const statuses = [];

    for (const model of this.preferredModels) {
      const blockInfo = await rateLimitCache.getBlockInfo(model);
      const available = blockInfo === null;

      statuses.push({
        model,
        displayName: MODEL_DISPLAY_NAMES[model] || model,
        available,
        retryIn: available ? 0 : blockInfo.remainingSeconds,
        blockInfo: available ? null : {
          quotaMetric: blockInfo.quotaMetric,
          quotaId: blockInfo.quotaId,
          errorMessage: blockInfo.errorMessage
        }
      });
    }

    return statuses;
  }

  /**
   * Clears all rate limit blocks for preferred models
   *
   * @returns {Promise<void>}
   */
  async clearAllBlocks() {
    for (const model of this.preferredModels) {
      await rateLimitCache.clearBlock(model);
    }

    logger.system.info('Cleared all rate limit blocks', {
      category: logger.CATEGORIES.GENERAL
    });
  }

  /**
   * Gets the next available model after the given model
   *
   * @param {string} currentModel - Current model that failed
   * @returns {Promise<Object|null>} Next model info or null if none available
   */
  async getNextAvailableModel(currentModel) {
    const currentIndex = this.preferredModels.indexOf(currentModel);

    if (currentIndex === -1) {
      logger.system.warn('Current model not in preferred models list', {
        category: logger.CATEGORIES.ERROR,
        currentModel
      });
      return null;
    }

    // Check models after current one
    for (let i = currentIndex + 1; i < this.preferredModels.length; i++) {
      const model = this.preferredModels[i];
      const isAvailable = await rateLimitCache.isModelAvailable(model);

      if (isAvailable) {
        return {
          model,
          displayName: MODEL_DISPLAY_NAMES[model] || model
        };
      }
    }

    return null;
  }
}

export { ModelRouter, MODEL_DISPLAY_NAMES };
