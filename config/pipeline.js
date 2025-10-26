/**
 * Centralized Pipeline Configuration
 * Single source of truth for article processing behavior
 */

import { availableCountries } from './availableCountries.js';

/**
 * Main configuration object for the entire article processing pipeline
 * This serves as DEFAULT configuration - user preferences override these values
 */
export const PIPELINE_CONFIG = {
  /**
   * Article Selection Configuration
   * Controls how many articles to analyze from each country
   */
  articleSelection: {
    /**
     * Articles to analyze per country
     * Format: { countryCode: quantity }
     * Only countries listed here will be searched
     */
    perCountry: {
      'BR': 2,  // Brazil
      'CN': 2,  // China
    },

    /**
     * Safety buffer: fetch N extra articles per country
     * Ensures we have enough quality content after extraction failures
     */
    bufferPerCountry: 2,

    /**
     * Maximum articles to send for AI analysis
     * Limited by Chrome AI model context window
     */
    maxForAnalysis: 10,

    /**
     * Allow filling from other countries if one doesn't have enough articles
     */
    allowFallback: true,
  },

  /**
   * Search Configuration
   */
  search: {
    /**
     * All available countries with metadata
     * Used for country name lookups and language detection
     * Imported from availableCountries.js
     */
    availableCountries,


    /**
     * Google News RSS search configuration
     */
    rssBaseUrl: 'https://news.google.com/rss/search',
    timeoutMs: 10000,
    retryAttempts: 2,
  },

  /**
   * Content Extraction Configuration
   */
  extraction: {
    /**
     * Extraction timeout per article (ms)
     */
    timeout: 20000,

    /**
     * Process articles in parallel
     */
    parallel: true,

    /**
     * Batch size for parallel processing
     */
    batchSize: 10,

    /**
     * Quality thresholds for extracted content
     */
    qualityThresholds: {
      minContentLength: 3000,      // ~500 words
      maxContentLength: 10000,     // ~1500 words
      minWordCount: 500,
      maxHtmlRatio: 0.4,           // Max 40% HTML tags
      minQualityScore: 60,         // 0-100 scale
    },

    /**
     * Retry extraction for low quality articles
     */
    retryLowQuality: true,

    /**
     * Window Manager Configuration
     * Controls dedicated processing window behavior
     */
    windowManager: {
      /**
       * Window state: 'minimized', 'offscreen', 'normal'
       * - minimized: Try to minimize window (may not work in MV3, falls back to offscreen)
       * - offscreen: Move window off-screen (reliable fallback)
       * - normal: Keep window visible (useful for debugging)
       */
      windowState: 'minimized',

      /**
       * Show informative HTML page in window explaining the process
       * Set to false for blank window
       */
      showInfoPage: true,
    },
  },

  /**
   * Analysis Configuration
   */
  analysis: {
    /**
     * Model Provider Selection
     * Options: 'nano' | 'api'
     * - nano: Gemini Nano - Chrome's built-in AI (free, local, requires download)
     * - api: Gemini API models with automatic fallback (requires API key)
     */
    modelProvider: 'api',

    /**
     * Preferred API models in order of preference
     * Used when modelProvider is 'api'
     * Models are tried in order, with automatic fallback if rate limited
     *
     * Free tier rate limits:
     * - gemini-2.5-pro: 5 RPM / 125K TPM / 100 RPD (best quality)
     * - gemini-2.5-flash: 10 RPM / 250K TPM / 250 RPD (good quality, faster)
     * - gemini-2.5-flash-lite: 15 RPM / 250K TPM / 1000 RPD (fastest, highest daily limit)
     */
    preferredModels: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ],

    /**
     * Per-model configurations
     * Each model can have custom temperature, topK, topP, and thinking budget
     */
    models: {
      'gemini-2.5-pro': {
        displayName: 'Gemini 2.5 Pro',
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        thinkingBudget: -1,  // -1 = dynamic thinking
        includeThoughts: false
      },
      'gemini-2.5-flash': {
        displayName: 'Gemini 2.5 Flash',
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        thinkingBudget: 0,   // 0 = no thinking (faster)
        includeThoughts: false
      },
      'gemini-2.5-flash-lite': {
        displayName: 'Gemini 2.5 Flash Lite',
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        thinkingBudget: 0,   // 0 = no thinking (fastest)
        includeThoughts: false
      },
      'gemini-nano': {
        displayName: 'Gemini Nano',
        temperature: 0.7,
        topK: 3  // Nano uses different parameter set
      }
    },

    /**
     * Use content compression before analysis (Gemini Nano only)
     * API models have larger context window and don't need compression
     */
    useCompression: true,

    /**
     * Compression level: 'short', 'medium', 'long' (Gemini Nano only)
     */
    compressionLevel: 'long',

    /**
     * Validate content quality before analysis
     */
    validateContent: true,

    /**
     * AI model parameters (Gemini Nano) - DEPRECATED
     * Use models.gemini-nano instead
     */
    model: {
      temperature: 0.7,
      topK: 3,
    },

    /**
     * Gemini 2.5 Pro Configuration - DEPRECATED
     * Use models.gemini-2.5-pro instead
     * Kept for backward compatibility
     */
    gemini25Pro: {
      model: 'gemini-2.5-pro',
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      thinkingBudget: -1,
      includeThoughts: false,
      skipTranslation: true,
      skipCompression: true,
    },

    /**
     * Analysis stages configuration
     */
    stages: {
      1: { name: 'context-trust', critical: true },
      2: { name: 'consensus', critical: true },
      3: { name: 'disputes', critical: false },
      4: { name: 'perspectives', critical: false },
    },
  },

  /**
   * Content Validation Configuration
   */
  validation: {
    minContentLength: 100,
    minWordCount: 20,
    maxContentLength: 50000,
    minQualityScore: 60,
  },
};

/**
 * Calculate search configuration based on article selection settings
 * Returns countries to search and how many articles to fetch per country
 *
 * @returns {Object} Search configuration with countries and targets
 */
export function getSearchConfig() {
  const { perCountry, bufferPerCountry } = PIPELINE_CONFIG.articleSelection;
  const selectedCountries = Object.keys(perCountry);

  const config = {
    countries: [],
    totalExpected: 0,
  };

  selectedCountries.forEach(countryCode => {
    const requested = perCountry[countryCode];
    const fetchTarget = requested + bufferPerCountry;

    // Get country metadata
    const countryInfo = PIPELINE_CONFIG.search.availableCountries.find(
      c => c.code === countryCode
    );

    if (!countryInfo) {
      console.warn(`Country ${countryCode} not found in availableCountries`);
      return;
    }

    config.countries.push({
      code: countryCode,
      name: countryInfo.name,
      language: countryInfo.language,
      requested,
      fetchTarget,
    });

    config.totalExpected += fetchTarget;
  });

  return config;
}

/**
 * Get final selection targets (what should be analyzed)
 *
 * @returns {Object} Selection targets and limits
 */
export function getSelectionTargets() {
  const { perCountry, maxForAnalysis, allowFallback } = PIPELINE_CONFIG.articleSelection;

  const totalRequested = Object.values(perCountry).reduce((sum, count) => sum + count, 0);

  return {
    perCountry: { ...perCountry },
    total: totalRequested,
    maxForAnalysis,
    allowFallback,
  };
}

/**
 * Get country metadata by country code
 *
 * @param {string} countryCode - Two-letter country code
 * @returns {Object|null} Country metadata or null if not found
 */
export function getCountryInfo(countryCode) {
  return PIPELINE_CONFIG.search.availableCountries.find(
    c => c.code === countryCode
  ) || null;
}

/**
 * Validate pipeline configuration
 * Checks for common configuration errors
 *
 * @returns {Object} Validation result with issues array
 */
export function validateConfig() {
  const issues = [];
  const { perCountry, bufferPerCountry, maxForAnalysis } = PIPELINE_CONFIG.articleSelection;

  // Check if any countries are selected
  if (Object.keys(perCountry).length === 0) {
    issues.push('No countries selected in articleSelection.perCountry');
  }

  // Check if all selected countries exist in availableCountries
  Object.keys(perCountry).forEach(code => {
    if (!getCountryInfo(code)) {
      issues.push(`Country ${code} not found in availableCountries`);
    }
  });

  // Check if total requested exceeds maxForAnalysis
  const totalRequested = Object.values(perCountry).reduce((sum, n) => sum + n, 0);
  if (totalRequested > maxForAnalysis) {
    issues.push(
      `Total requested articles (${totalRequested}) exceeds maxForAnalysis (${maxForAnalysis})`
    );
  }

  // Check if buffer is reasonable
  if (bufferPerCountry < 0) {
    issues.push('bufferPerCountry cannot be negative');
  }

  if (bufferPerCountry > 10) {
    issues.push('bufferPerCountry seems too high (>10), may cause performance issues');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Deep merge helper (same as ConfigManager)
 * @private
 */
function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
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
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Load runtime configuration from storage directly
 * Bypasses ConfigManager to avoid circular dependency in Service Worker
 * (Service Workers don't support dynamic import())
 *
 * @returns {Promise<Object>} Merged configuration
 */
export async function loadRuntimeConfig() {
  try {
    const STORAGE_KEY = 'perspectiveLens_config';

    // Load from chrome.storage.sync directly
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const userConfig = result[STORAGE_KEY];

    if (!userConfig) {
      console.log('[Pipeline] No user config found, using defaults');
      return { ...PIPELINE_CONFIG };
    }

    // Deep merge user config with defaults
    const merged = deepMerge(PIPELINE_CONFIG, userConfig);

    console.log('[Pipeline] User config loaded successfully');
    return merged;
  } catch (error) {
    console.error('[Pipeline] Error loading runtime config, using defaults:', error);
    return { ...PIPELINE_CONFIG };
  }
}

/**
 * Get search configuration (ASYNC version - loads user config)
 * Use this in background.js instead of getSearchConfig()
 *
 * @returns {Promise<Object>} Search configuration with countries, buffers, and limits
 */
export async function getSearchConfigAsync() {
  const config = await loadRuntimeConfig();
  const { perCountry, bufferPerCountry } = config.articleSelection;

  const searchConfig = {
    countries: [],
    totalExpected: 0,
  };

  const selectedCountries = Object.keys(perCountry);

  selectedCountries.forEach(countryCode => {
    const requested = perCountry[countryCode];
    const fetchTarget = requested + bufferPerCountry;

    // Get country metadata
    const countryInfo = config.search.availableCountries.find(
      c => c.code === countryCode
    );

    if (!countryInfo) {
      console.warn(`Country ${countryCode} not found in availableCountries`);
      return;
    }

    searchConfig.countries.push({
      code: countryCode,
      name: countryInfo.name,
      language: countryInfo.language,
      requested,
      fetchTarget,
    });

    searchConfig.totalExpected += fetchTarget;
  });

  return searchConfig;
}

/**
 * Get selection targets (ASYNC version - loads user config)
 * Use this in background.js instead of getSelectionTargets()
 *
 * @returns {Promise<Object>} Selection targets and limits
 */
export async function getSelectionTargetsAsync() {
  const config = await loadRuntimeConfig();
  const { perCountry, maxForAnalysis, allowFallback } = config.articleSelection;

  const totalRequested = Object.values(perCountry).reduce((sum, count) => sum + count, 0);

  return {
    perCountry: { ...perCountry },
    total: totalRequested,
    maxForAnalysis,
    allowFallback,
  };
}
