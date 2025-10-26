/**
 * Configuration Manager
 * Handles loading, saving, and merging user configurations with defaults
 */

import { PIPELINE_CONFIG } from './pipeline.js';

const STORAGE_KEY = 'perspectiveLens_config';
const CONFIG_VERSION = 1;

export class ConfigManager {
  /**
   * Load configuration from storage, merged with defaults
   * @returns {Promise<Object>} Merged configuration
   */
  static async load() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const userConfig = result[STORAGE_KEY];

      if (!userConfig) {
        console.log('[ConfigManager] No user config found, using defaults');
        return { ...PIPELINE_CONFIG };
      }

      // Deep merge user config with defaults
      const merged = this.deepMerge(PIPELINE_CONFIG, userConfig);

      console.log('[ConfigManager] Config loaded and merged', {
        hasUserConfig: !!userConfig,
        version: userConfig?.version || 'none'
      });

      return merged;
    } catch (error) {
      console.error('[ConfigManager] Error loading config:', error);
      return { ...PIPELINE_CONFIG };
    }
  }

  /**
   * Save user configuration to storage
   * @param {Object} config - Configuration object to save (can be partial)
   * @returns {Promise<boolean>} Success status
   */
  static async save(config) {
    try {
      // Load existing config and merge with incoming changes
      const existingConfig = await this.load();
      const mergedConfig = this.deepMerge(existingConfig, config);

      // Validate the merged config
      const errors = [];

      if (!mergedConfig.articleSelection?.perCountry ||
          Object.keys(mergedConfig.articleSelection.perCountry).length === 0) {
        errors.push('At least one country must be selected');
      }

      if (mergedConfig.articleSelection?.maxForAnalysis < 1) {
        errors.push('Maximum articles for analysis must be at least 1');
      }

      if (errors.length > 0) {
        console.error('[ConfigManager] Config validation failed:', errors);
        return {
          success: false,
          errors: errors
        };
      }

      // Prepare config for storage - exclude large static data
      // availableCountries is static reference data that shouldn't be saved
      const configToSave = {
        ...mergedConfig,
        version: CONFIG_VERSION,
        lastModified: new Date().toISOString()
      };

      // Remove availableCountries from search config to save space
      // It will be restored from PIPELINE_CONFIG on load
      if (configToSave.search?.availableCountries) {
        delete configToSave.search.availableCountries;
      }

      await chrome.storage.sync.set({ [STORAGE_KEY]: configToSave });

      console.log('[ConfigManager] Config saved successfully');

      // Notify all contexts about config change (with full config including availableCountries)
      await this.notifyConfigChange(mergedConfig);

      return { success: true };
    } catch (error) {
      console.error('[ConfigManager] Error saving config:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<boolean>} Success status
   */
  static async reset() {
    try {
      await chrome.storage.sync.remove(STORAGE_KEY);
      console.log('[ConfigManager] Config reset to defaults');

      // Notify about reset
      await this.notifyConfigChange({ ...PIPELINE_CONFIG });

      return { success: true };
    } catch (error) {
      console.error('[ConfigManager] Error resetting config:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Get specific configuration value by path
   * @param {string} path - Dot-notation path (e.g., 'articleSelection.maxForAnalysis')
   * @returns {Promise<any>} Configuration value
   */
  static async get(path) {
    const config = await this.load();
    return this.getNestedValue(config, path);
  }

  /**
   * Update specific configuration value by path
   * @param {string} path - Dot-notation path
   * @param {any} value - New value
   * @returns {Promise<boolean>} Success status
   */
  static async set(path, value) {
    const config = await this.load();
    this.setNestedValue(config, path, value);
    return await this.save(config);
  }


  // ===== Private Helper Methods =====

  /**
   * Deep merge two objects
   * @private
   */
  static deepMerge(target, source) {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  /**
   * Check if value is an object
   * @private
   */
  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   * @private
   */
  static setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Notify all contexts about configuration change
   * @private
   */
  static async notifyConfigChange(config) {
    try {
      // Broadcast to all tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'CONFIG_UPDATED',
            config
          });
        } catch (error) {
          // Tab might not have content script, ignore
        }
      }

      // Send to background script
      try {
        await chrome.runtime.sendMessage({
          type: 'CONFIG_UPDATED',
          config
        });
      } catch (error) {
        // Background might not be listening, ignore
      }
    } catch (error) {
      console.error('[ConfigManager] Error notifying config change:', error);
    }
  }
}

/**
 * Listen for storage changes and broadcast updates
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) {
    console.log('[ConfigManager] Config changed in storage');

    const newConfig = changes[STORAGE_KEY].newValue;
    if (newConfig) {
      ConfigManager.notifyConfigChange(newConfig);
    }
  }
});
