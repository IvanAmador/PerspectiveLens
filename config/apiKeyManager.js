/**
 * API Key Manager
 * Manages secure storage and validation of Gemini API keys
 *
 * @module config/apiKeyManager
 */

import { logger } from '../utils/logger.js';

const API_KEY_STORAGE_KEY = 'perspectiveLens_gemini_api_key';

/**
 * Manages API key storage, validation, and security
 */
class APIKeyManager {
  /**
   * Saves API key to Chrome storage (encrypted by Chrome)
   * @param {string} apiKey - Google AI Studio API key
   * @returns {Promise<void>}
   * @throws {Error} If API key format is invalid
   */
  static async save(apiKey) {
    // Validate format
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key must be a non-empty string');
    }

    // Google AI Studio keys typically start with 'AIza'
    if (!apiKey.startsWith('AIza')) {
      logger.system.warn('API key does not match expected format', {
        category: logger.CATEGORIES.VALIDATE
      });
    }

    try {
      // Store in chrome.storage.sync (automatically encrypted)
      await chrome.storage.sync.set({
        [API_KEY_STORAGE_KEY]: apiKey
      });

      logger.system.info('API key saved successfully', {
        category: logger.CATEGORIES.GENERAL
      });
    } catch (error) {
      logger.system.error('Failed to save API key', {
        category: logger.CATEGORIES.ERROR,
        error
      });
      throw new Error(`Failed to save API key: ${error.message}`);
    }
  }

  /**
   * Loads API key from Chrome storage
   * @returns {Promise<string|null>} API key or null if not found
   */
  static async load() {
    try {
      const result = await chrome.storage.sync.get(API_KEY_STORAGE_KEY);
      const apiKey = result[API_KEY_STORAGE_KEY] || null;

      if (apiKey) {
        logger.system.debug('API key loaded from storage', {
          category: logger.CATEGORIES.GENERAL
        });
      } else {
        logger.system.debug('No API key found in storage', {
          category: logger.CATEGORIES.GENERAL
        });
      }

      return apiKey;
    } catch (error) {
      logger.system.error('Failed to load API key', {
        category: logger.CATEGORIES.ERROR,
        error
      });
      return null;
    }
  }

  /**
   * Removes API key from Chrome storage
   * @returns {Promise<void>}
   */
  static async remove() {
    try {
      await chrome.storage.sync.remove(API_KEY_STORAGE_KEY);
      logger.system.info('API key removed successfully', {
        category: logger.CATEGORIES.GENERAL
      });
    } catch (error) {
      logger.system.error('Failed to remove API key', {
        category: logger.CATEGORIES.ERROR,
        error
      });
      throw new Error(`Failed to remove API key: ${error.message}`);
    }
  }

  /**
   * Validates API key by making a test request to Gemini API
   * @param {string} apiKey - API key to validate
   * @returns {Promise<{isValid: boolean, error?: string}>}
   */
  static async validate(apiKey) {
    if (!apiKey) {
      return {
        isValid: false,
        error: 'API key is required'
      };
    }

    try {
      // Test with a lightweight model listing endpoint
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash',
        {
          method: 'GET',
          headers: {
            'x-goog-api-key': apiKey
          }
        }
      );

      if (response.ok) {
        logger.system.info('API key validation successful', {
          category: logger.CATEGORIES.VALIDATE
        });
        return { isValid: true };
      }

      if (response.status === 400) {
        const data = await response.json();
        logger.system.warn('API key validation failed - invalid key', {
          category: logger.CATEGORIES.VALIDATE,
          status: response.status
        });
        return {
          isValid: false,
          error: data.error?.message || 'Invalid API key'
        };
      }

      if (response.status === 403) {
        logger.system.warn('API key validation failed - access denied', {
          category: logger.CATEGORIES.VALIDATE
        });
        return {
          isValid: false,
          error: 'API key does not have required permissions'
        };
      }

      logger.system.warn('API key validation failed - unexpected status', {
        category: logger.CATEGORIES.VALIDATE,
        status: response.status
      });
      return {
        isValid: false,
        error: `Validation failed with status ${response.status}`
      };

    } catch (error) {
      logger.system.error('API key validation error', {
        category: logger.CATEGORIES.ERROR,
        error
      });
      return {
        isValid: false,
        error: `Network error: ${error.message}`
      };
    }
  }

  /**
   * Returns masked version of API key for display
   * @param {string} apiKey - API key to mask
   * @returns {string} Masked API key (e.g., "AIzaSyBg...a1b2")
   */
  static mask(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return '';
    }

    if (apiKey.length <= 12) {
      return apiKey.substring(0, 4) + '...';
    }

    const start = apiKey.substring(0, 8);
    const end = apiKey.substring(apiKey.length - 4);
    return `${start}...${end}`;
  }

  /**
   * Checks if an API key exists in storage
   * @returns {Promise<boolean>}
   */
  static async exists() {
    const apiKey = await this.load();
    return !!apiKey;
  }

  /**
   * Validates and saves API key in one operation
   * @param {string} apiKey - API key to validate and save
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async validateAndSave(apiKey) {
    try {
      // First validate
      const validation = await this.validate(apiKey);

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Then save
      await this.save(apiKey);

      return { success: true };
    } catch (error) {
      logger.system.error('Failed to validate and save API key', {
        category: logger.CATEGORIES.ERROR,
        error
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export { APIKeyManager };
