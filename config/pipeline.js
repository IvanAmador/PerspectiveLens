/**
 * Centralized Pipeline Configuration
 * Single source of truth for article processing behavior
 */

/**
 * Main configuration object for the entire article processing pipeline
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
     */
    availableCountries: [
      { code: 'US', name: 'United States', language: 'en' },
      { code: 'GB', name: 'United Kingdom', language: 'en' },
      { code: 'BR', name: 'Brazil', language: 'pt' },
      { code: 'FR', name: 'France', language: 'fr' },
      { code: 'DE', name: 'Germany', language: 'de' },
      { code: 'ES', name: 'Spain', language: 'es' },
      { code: 'CN', name: 'China', language: 'zh-CN' },
      { code: 'JP', name: 'Japan', language: 'ja' },
      { code: 'IN', name: 'India', language: 'en' },
      { code: 'AU', name: 'Australia', language: 'en' },
      { code: 'RU', name: 'Russia', language: 'ru' },
      { code: 'IT', name: 'Italy', language: 'it' },
      { code: 'MX', name: 'Mexico', language: 'es' },
      { code: 'KR', name: 'South Korea', language: 'ko' },
      { code: 'CA', name: 'Canada', language: 'en' },
    ],

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
  },

  /**
   * Analysis Configuration
   */
  analysis: {
    /**
     * Use content compression before analysis
     */
    useCompression: true,

    /**
     * Compression level: 'short', 'medium', 'long'
     */
    compressionLevel: 'long',

    /**
     * Validate content quality before analysis
     */
    validateContent: true,

    /**
     * AI model parameters
     */
    model: {
      temperature: 0.7,  // Balance between creativity and consistency
      topK: 3,           // Consider top 3 tokens for diversity
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
