/**
 * Summarizer API wrapper for PerspectiveLens
 * Handles summarization using Chrome's built-in Summarizer API (Gemini Nano)
 * Automatically handles language translation for optimal results
 *
 * Supported types:
 * - key-points: Bullet point list (default)
 * - tldr: Short summary
 * - teaser: Engaging preview
 * - headline: Article title
 *
 * Supported lengths: short, medium (default), long
 * Supported formats: markdown (default), plain-text
 *
 * Reference: https://developer.chrome.com/docs/ai/summarizer-api
 * Available: Chrome 138+
 */

import { logger } from '../utils/logger.js';
import { AIModelError, ERROR_MESSAGES } from '../utils/errors.js';
import { detectLanguageSimple } from './languageDetector.js';
import { translate } from './translator.js';
import {
  normalizeLanguageCode,
  getPromptAPIPreferredLanguage,
  needsTranslation
} from '../utils/languages.js';

// Summarizer configuration constants
const SUMMARIZER_TYPES = ['key-points', 'tldr', 'teaser', 'headline'];
const SUMMARIZER_LENGTHS = ['short', 'medium', 'long'];
const SUMMARIZER_FORMATS = ['markdown', 'plain-text'];

// Preferred language for summarization (best results with English)
const PREFERRED_LANGUAGE = getPromptAPIPreferredLanguage();

/**
 * Check if Summarizer API is available
 * @returns {Promise<string>} Availability status
 */
export async function checkSummarizerAvailability() {
  if (typeof self.Summarizer === 'undefined') {
    logger.error('Summarizer API not available');
    throw new AIModelError(ERROR_MESSAGES.AI_UNAVAILABLE, {
      reason: 'Summarizer API not available (requires Chrome 138+)'
    });
  }

  try {
    const availability = await self.Summarizer.availability();
    logger.info('Summarizer API availability:', availability);
    return availability;
  } catch (error) {
    logger.error('Failed to check Summarizer availability:', error);
    throw new AIModelError('Failed to check summarizer availability', {
      originalError: error
    });
  }
}

/**
 * Create a summarizer instance with specified configuration
 *
 * @param {Object} options - Summarizer configuration
 * @param {string} options.type - Summary type: 'key-points', 'tldr', 'teaser', 'headline'
 * @param {string} options.length - Summary length: 'short', 'medium', 'long'
 * @param {string} options.format - Output format: 'markdown', 'plain-text'
 * @param {string} options.sharedContext - Additional context to help summarizer
 * @param {Function} onProgress - Progress callback for model download
 * @returns {Promise<Object>} Summarizer instance
 */
export async function createSummarizer(options = {}, onProgress = null) {
  const availability = await checkSummarizerAvailability();

  if (availability === 'unavailable') {
    throw new AIModelError('Summarizer is not available on this device');
  }

  // Validate and set defaults
  const config = {
    type: options.type || 'key-points',
    length: options.length || 'medium',
    format: options.format || 'markdown',
    sharedContext: options.sharedContext || ''
  };

  // Validate parameters
  if (!SUMMARIZER_TYPES.includes(config.type)) {
    throw new AIModelError(`Invalid summary type: ${config.type}. Must be one of: ${SUMMARIZER_TYPES.join(', ')}`);
  }

  if (!SUMMARIZER_LENGTHS.includes(config.length)) {
    throw new AIModelError(`Invalid summary length: ${config.length}. Must be one of: ${SUMMARIZER_LENGTHS.join(', ')}`);
  }

  if (!SUMMARIZER_FORMATS.includes(config.format)) {
    throw new AIModelError(`Invalid summary format: ${config.format}. Must be one of: ${SUMMARIZER_FORMATS.join(', ')}`);
  }

  logger.info(`Creating summarizer: type=${config.type}, length=${config.length}, format=${config.format}`);

  // Add download monitor if callback provided
  if (onProgress && (availability === 'downloadable' || availability === 'downloading')) {
    config.monitor = (m) => {
      m.addEventListener('downloadprogress', (e) => {
        const progress = Math.round(e.loaded * 100);
        logger.debug(`Summarizer download: ${progress}%`);
        onProgress(progress);
      });
    };
  }

  try {
    const summarizer = await self.Summarizer.create(config);
    logger.info('Summarizer created successfully');
    return summarizer;
  } catch (error) {
    logger.error('Failed to create summarizer:', error);
    throw new AIModelError('Failed to create summarizer', {
      originalError: error,
      config
    });
  }
}

/**
 * Summarize text with automatic language handling
 * Translates to English for processing, then back to original language
 *
 * @param {string} text - Text to summarize
 * @param {Object} options - Summarization options
 * @param {string} options.type - Summary type
 * @param {string} options.length - Summary length
 * @param {string} options.format - Output format
 * @param {string} options.language - Source language (auto-detects if not provided)
 * @param {boolean} options.translateBack - Translate result back to source language (default: true)
 * @returns {Promise<string>} Summary
 */
export async function summarize(text, options = {}) {
  if (!text || text.trim().length === 0) {
    throw new AIModelError('Text is required for summarization');
  }

  if (text.length < 50) {
    logger.warn('Text is very short, summarization may not be useful');
  }

  try {
    // Step 1: Detect and normalize language
    let sourceLanguage;
    if (options.language) {
      sourceLanguage = normalizeLanguageCode(options.language);
      logger.info(`Using provided language: ${options.language} → ${sourceLanguage}`);
    } else {
      logger.debug('Auto-detecting language for summarization...');
      sourceLanguage = await detectLanguageSimple(text);
      logger.info(`Detected language: ${sourceLanguage}`);
    }

    // Step 2: Translate to English if needed (Summarizer works best with English)
    let textForSummarizer = text;
    const needsTranslationToEnglish = needsTranslation(sourceLanguage, PREFERRED_LANGUAGE);

    if (needsTranslationToEnglish) {
      logger.info(`Translating text: ${sourceLanguage} → ${PREFERRED_LANGUAGE}`);
      textForSummarizer = await translate(text, sourceLanguage, PREFERRED_LANGUAGE);
      logger.debug(`Translated ${text.length} chars for summarization`);
    } else {
      logger.debug(`No translation needed (already in ${sourceLanguage})`);
    }

    // Step 3: Create summarizer and generate summary
    const summarizer = await createSummarizer({
      type: options.type || 'key-points',
      length: options.length || 'medium',
      format: options.format || 'markdown',
      sharedContext: options.sharedContext || ''
    }, options.onProgress);

    logger.debug(`Summarizing ${textForSummarizer.length} chars (${options.type || 'key-points'}, ${options.length || 'medium'})`);
    const summaryInEnglish = await summarizer.summarize(textForSummarizer);

    // Clean up
    summarizer.destroy();

    logger.info(`✅ Summary generated (${summaryInEnglish.length} chars)`);

    // Step 4: Translate back to source language if needed
    const shouldTranslateBack = options.translateBack !== false; // Default true
    if (shouldTranslateBack && needsTranslationToEnglish) {
      logger.info(`Translating summary back: ${PREFERRED_LANGUAGE} → ${sourceLanguage}`);
      const translatedSummary = await translate(summaryInEnglish, PREFERRED_LANGUAGE, sourceLanguage);
      logger.info('✅ Summary translated back to original language');
      return translatedSummary;
    }

    // Return summary in English
    return summaryInEnglish;

  } catch (error) {
    logger.error('Summarization failed:', error);
    throw new AIModelError('Failed to summarize text', {
      originalError: error,
      textLength: text.length
    });
  }
}

/**
 * Summarize multiple texts in batch
 * Reuses summarizer instance for efficiency
 *
 * @param {Array<string>} texts - Array of texts to summarize
 * @param {Object} options - Summarization options (same as summarize())
 * @returns {Promise<Array<string>>} Array of summaries
 */
export async function summarizeBatch(texts, options = {}) {
  if (!texts || texts.length === 0) {
    return [];
  }

  logger.info(`Batch summarizing ${texts.length} texts`);

  try {
    // Process each text individually (each may have different language)
    const summaries = await Promise.all(
      texts.map(async (text, index) => {
        try {
          logger.debug(`Summarizing batch item ${index + 1}/${texts.length}`);
          return await summarize(text, options);
        } catch (error) {
          logger.error(`Failed to summarize batch item ${index + 1}:`, error);
          return ''; // Return empty on error
        }
      })
    );

    logger.info('Batch summarization completed');
    return summaries;

  } catch (error) {
    logger.error('Batch summarization failed:', error);
    throw new AIModelError('Failed to summarize batch', {
      originalError: error
    });
  }
}

/**
 * Generate a headline for an article
 * Convenience function for headline generation
 *
 * @param {string} text - Article text or excerpt
 * @param {Object} options - Options (language, translateBack)
 * @returns {Promise<string>} Generated headline
 */
export async function generateHeadline(text, options = {}) {
  logger.info('Generating headline...');
  return await summarize(text, {
    ...options,
    type: 'headline',
    length: 'short',
    format: 'plain-text'
  });
}

/**
 * Generate key points for an article
 * Convenience function for bullet points
 *
 * @param {string} text - Article text
 * @param {Object} options - Options (length, language, translateBack)
 * @returns {Promise<string>} Key points in markdown format
 */
export async function generateKeyPoints(text, options = {}) {
  logger.info('Generating key points...');
  return await summarize(text, {
    ...options,
    type: 'key-points',
    format: 'markdown'
  });
}

/**
 * Generate a TL;DR summary
 * Convenience function for quick summaries
 *
 * @param {string} text - Article text
 * @param {Object} options - Options (length, language, translateBack)
 * @returns {Promise<string>} TL;DR summary
 */
export async function generateTLDR(text, options = {}) {
  logger.info('Generating TL;DR...');
  return await summarize(text, {
    ...options,
    type: 'tldr',
    format: 'plain-text'
  });
}

/**
 * Get supported summarization types
 * @returns {Array<string>}
 */
export function getSupportedTypes() {
  return [...SUMMARIZER_TYPES];
}

/**
 * Get supported summary lengths
 * @returns {Array<string>}
 */
export function getSupportedLengths() {
  return [...SUMMARIZER_LENGTHS];
}

/**
 * Get supported output formats
 * @returns {Array<string>}
 */
export function getSupportedFormats() {
  return [...SUMMARIZER_FORMATS];
}
