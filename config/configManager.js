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
   * CRITICAL: Always restores static reference data (availableCountries) from defaults
   * @returns {Promise<Object>} Merged configuration (defaults + user overrides)
   */
  static async load() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const userConfig = result[STORAGE_KEY];

      if (!userConfig) {
        console.log('[ConfigManager] No user config found, using defaults');
        return { ...PIPELINE_CONFIG };
      }

      // Deep merge: defaults FIRST, then user overrides
      // This ensures availableCountries is always present from PIPELINE_CONFIG
      const merged = this.deepMerge(PIPELINE_CONFIG, userConfig);

      // CRITICAL FIX: Replace perCountry entirely from userConfig (don't merge with defaults)
      // deepMerge would add default countries back, preventing country removal
      // If user has saved perCountry, use it exclusively (ignore defaults)
      if (userConfig.articleSelection?.perCountry !== undefined) {
        merged.articleSelection.perCountry = { ...userConfig.articleSelection.perCountry };

        console.log('[ConfigManager] perCountry replaced from userConfig (not merged with defaults)', {
          defaultCountries: Object.keys(PIPELINE_CONFIG.articleSelection?.perCountry || {}),
          userCountries: Object.keys(userConfig.articleSelection.perCountry),
          finalCountries: Object.keys(merged.articleSelection.perCountry)
        });
      }

      console.log('[ConfigManager] Config loaded and merged', {
        hasUserConfig: !!userConfig,
        version: userConfig?.version || 'none',
        countriesRestored: !!merged.search?.availableCountries
      });

      return merged;
    } catch (error) {
      console.error('[ConfigManager] Error loading config:', error);
      return { ...PIPELINE_CONFIG };
    }
  }

  /**
   * Save user configuration to storage
   * CRITICAL: Only saves user overrides, NOT defaults
   * Validation happens on final merged config (userConfig + defaults)
   *
   * @param {Object} config - Configuration object to save (can be partial)
   * @returns {Promise<Object>} { success: boolean, errors?: string[] }
   */
  static async save(config) {
    try {
      // Step 1: Load ONLY existing userConfig from storage (WITHOUT defaults)
      // Do NOT use this.load() because it merges with defaults
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const existingUserConfig = result[STORAGE_KEY] || {};

      // Step 2: Merge ONLY userConfigs (supports partial updates)
      // This preserves existing user customizations while adding new ones
      const mergedUserConfig = this.deepMerge(existingUserConfig, config);

      // CRITICAL FIX: For perCountry, replace entirely (don't merge) to allow country removal
      // deepMerge only adds/updates keys, it never removes them
      // When user removes a country, we need to completely replace perCountry object
      if (config.articleSelection?.perCountry !== undefined) {
        if (!mergedUserConfig.articleSelection) {
          mergedUserConfig.articleSelection = {};
        }
        mergedUserConfig.articleSelection.perCountry = { ...config.articleSelection.perCountry };

        console.log('[ConfigManager] perCountry replaced (not merged) to allow country removal', {
          existing: Object.keys(existingUserConfig.articleSelection?.perCountry || {}),
          incoming: Object.keys(config.articleSelection.perCountry),
          result: Object.keys(mergedUserConfig.articleSelection.perCountry)
        });
      }

      // Step 3: Create FINAL config by merging with defaults FOR VALIDATION ONLY
      // This temporary config is used to validate completeness but NOT saved
      const finalConfig = this.deepMerge(PIPELINE_CONFIG, mergedUserConfig);

      // Step 4: Validate the FINAL merged config (must be complete and valid)
      const errors = [];

      // Validate articleSelection structure exists
      if (!finalConfig.articleSelection) {
        errors.push('Article selection configuration is required');
      } else {
        // Validate perCountry exists and is an object
        if (!finalConfig.articleSelection.perCountry ||
            typeof finalConfig.articleSelection.perCountry !== 'object') {
          errors.push('Article selection per country must be an object');
        } else if (Object.keys(finalConfig.articleSelection.perCountry).length === 0) {
          // Allow empty perCountry temporarily - just warn
          console.warn('[ConfigManager] No countries selected - analysis will not work until countries are added');
        }

        // Validate maxForAnalysis
        if (typeof finalConfig.articleSelection.maxForAnalysis !== 'number' ||
            finalConfig.articleSelection.maxForAnalysis < 1) {
          errors.push('Maximum articles for analysis must be at least 1');
        }

        // Validate bufferPerCountry
        if (typeof finalConfig.articleSelection.bufferPerCountry !== 'number' ||
            finalConfig.articleSelection.bufferPerCountry < 0) {
          errors.push('Buffer per country must be a non-negative number');
        }
      }

      // Validate analysis structure
      if (!finalConfig.analysis) {
        errors.push('Analysis configuration is required');
      } else {
        // Validate modelProvider
        if (!['nano', 'api'].includes(finalConfig.analysis.modelProvider)) {
          errors.push('Model provider must be "nano" or "api"');
        }

        // Validate preferredModels array exists
        if (!Array.isArray(finalConfig.analysis.preferredModels) ||
            finalConfig.analysis.preferredModels.length === 0) {
          errors.push('Preferred models array must contain at least one model');
        }
      }

      if (errors.length > 0) {
        console.error('[ConfigManager] Config validation failed:', errors);
        return {
          success: false,
          errors: errors
        };
      }

      // Step 5: Prepare ONLY userConfig for storage (exclude defaults and static data)
      const configToSave = {
        ...mergedUserConfig,
        version: CONFIG_VERSION,
        lastModified: new Date().toISOString()
      };

      // Step 6: Remove static reference data to stay under chrome.storage.sync quota
      // QUOTA_BYTES_PER_ITEM = 8,192 bytes per item (see chrome.storage.sync docs)
      // availableCountries (~3KB) is static data - always loaded from PIPELINE_CONFIG
      if (configToSave.search?.availableCountries) {
        delete configToSave.search.availableCountries;
      }

      // Step 7: Save ONLY userConfig to storage
      await chrome.storage.sync.set({ [STORAGE_KEY]: configToSave });

      const savedSize = JSON.stringify(configToSave).length;
      console.log('[ConfigManager] Config saved successfully', {
        userConfigSize: savedSize,
        quotaUsage: `${savedSize}/8192 bytes`,
        hasDefaultsInStorage: false, // Should always be false
        hasCountriesInStorage: !!configToSave.search?.availableCountries, // Should always be false
        savedKeys: Object.keys(configToSave),
        timestamp: new Date().toISOString()
      });

      // Log what was actually saved for debugging
      console.log('[ConfigManager] Saved configuration structure:', {
        articleSelection: configToSave.articleSelection ? {
          perCountry: Object.keys(configToSave.articleSelection.perCountry || {}),
          perCountryValues: configToSave.articleSelection.perCountry,
          bufferPerCountry: configToSave.articleSelection.bufferPerCountry,
          maxForAnalysis: configToSave.articleSelection.maxForAnalysis,
          allowFallback: configToSave.articleSelection.allowFallback
        } : 'missing',
        analysis: configToSave.analysis ? {
          modelProvider: configToSave.analysis.modelProvider,
          preferredModels: configToSave.analysis.preferredModels,
          compressionLevel: configToSave.analysis.compressionLevel,
          hasModelsConfig: !!configToSave.analysis.models
        } : 'missing',
        extraction: configToSave.extraction ? 'present' : 'missing'
      });

      // VERIFICATION: Immediately read back from storage to confirm it was saved
      const verifyResult = await chrome.storage.sync.get(STORAGE_KEY);
      const verifiedConfig = verifyResult[STORAGE_KEY];
      console.log('[ConfigManager] IMMEDIATE VERIFICATION after save:', {
        saved: !!verifiedConfig,
        perCountry: verifiedConfig?.articleSelection?.perCountry,
        bufferPerCountry: verifiedConfig?.articleSelection?.bufferPerCountry,
        maxForAnalysis: verifiedConfig?.articleSelection?.maxForAnalysis,
        matchesWhatWeSaved: JSON.stringify(verifiedConfig) === JSON.stringify(configToSave)
      });

      // Step 8: Notify all contexts with FINAL config (includes defaults + availableCountries)
      // CRITICAL: Pass finalConfig (merged with defaults), not configToSave (user overrides only)
      await this.notifyConfigChange(finalConfig);

      console.log('[ConfigManager] Config change notification sent to all contexts');

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
   * CRITICAL: Only updates user overrides, uses save() which preserves defaults
   *
   * @param {string} path - Dot-notation path (e.g., 'analysis.modelProvider')
   * @param {any} value - New value
   * @returns {Promise<Object>} { success: boolean, errors?: string[] }
   */
  static async set(path, value) {
    try {
      // Create a partial config update object from the path
      const partialUpdate = {};
      this.setNestedValue(partialUpdate, path, value);

      // Use save() which handles merging userConfig correctly
      return await this.save(partialUpdate);
    } catch (error) {
      console.error('[ConfigManager] Error in set():', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
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
 * CRITICAL: This listener fires when storage changes from ANY context
 * We need to merge with defaults before broadcasting
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) {
    console.log('[ConfigManager] Config changed in storage', {
      hasOldValue: !!changes[STORAGE_KEY].oldValue,
      hasNewValue: !!changes[STORAGE_KEY].newValue,
      timestamp: new Date().toISOString()
    });

    const newUserConfig = changes[STORAGE_KEY].newValue;
    if (newUserConfig) {
      // Merge with defaults before broadcasting
      // This ensures all contexts receive complete config
      const mergedConfig = ConfigManager.deepMerge(PIPELINE_CONFIG, newUserConfig);

      console.log('[ConfigManager] Broadcasting merged config to all contexts', {
        modelProvider: mergedConfig.analysis?.modelProvider,
        countries: Object.keys(mergedConfig.articleSelection?.perCountry || {}),
        hasAvailableCountries: !!mergedConfig.search?.availableCountries
      });

      await ConfigManager.notifyConfigChange(mergedConfig);
    }
  }
});
