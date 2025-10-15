/**
 * Translator API wrapper for PerspectiveLens
 * Handles translation using Chrome's built-in Translator API
 * Automatically normalizes language codes to ISO 639-1 standard
 *
 * Supported languages (Chrome 138+):
 * - en, es, fr, de, ar, zh, ja, pt
 *
 * Reference: https://developer.chrome.com/docs/ai/translator-api
 */

import { logger } from '../utils/logger.js';
import { AIModelError, ERROR_MESSAGES } from '../utils/errors.js';
import {
  normalizeLanguageCode,
  isTranslatorSupported,
  needsTranslation as shouldTranslate,
  getSupportedLanguages,
  getLanguageName
} from '../utils/languages.js';

/**
 * Check if Translator API is available
 * @returns {Promise<boolean>}
 */
export async function checkTranslatorAvailability() {
  if (typeof self.Translator === 'undefined') {
    logger.error('Translator API not available');
    throw new AIModelError(ERROR_MESSAGES.AI_UNAVAILABLE, {
      reason: 'Translator API not available (requires Chrome 138+)'
    });
  }

  try {
    const available = typeof self.Translator.create === 'function';
    logger.info('Translator API available:', available);
    return available;
  } catch (error) {
    logger.error('Failed to check Translator availability:', error);
    return false;
  }
}

/**
 * Check if a language pair is available for translation
 * Automatically normalizes language codes
 *
 * @param {string} sourceLanguage - Source language code (any format)
 * @param {string} targetLanguage - Target language code (any format)
 * @returns {Promise<boolean>}
 */
export async function canTranslate(sourceLanguage, targetLanguage) {
  if (!sourceLanguage || !targetLanguage) {
    throw new AIModelError('Source and target languages required');
  }

  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  // Skip if same language
  if (normalizedSource === normalizedTarget) {
    logger.debug(`Skip translation: same language (${normalizedSource})`);
    return false;
  }

  // Check if both languages are supported
  if (!isTranslatorSupported(normalizedSource)) {
    logger.warn(`Source language not supported: ${sourceLanguage} (${normalizedSource})`);
    return false;
  }

  if (!isTranslatorSupported(normalizedTarget)) {
    logger.warn(`Target language not supported: ${targetLanguage} (${normalizedTarget})`);
    return false;
  }

  try {
    const availability = await self.Translator.availability({
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget
    });

    logger.debug(`Translation ${normalizedSource}→${normalizedTarget}: ${availability}`);
    return availability === 'available' || availability === 'downloadable';
  } catch (error) {
    logger.error('Failed to check translation availability:', error);
    return false;
  }
}

/**
 * Create a translator instance for a language pair
 * Automatically normalizes language codes
 *
 * @param {string} sourceLanguage - Source language code (any format)
 * @param {string} targetLanguage - Target language code (any format)
 * @param {Function} onProgress - Progress callback for model download
 * @returns {Promise<Object>} Translator instance
 */
export async function createTranslator(
  sourceLanguage,
  targetLanguage,
  onProgress = null
) {
  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  logger.info(`Creating translator: ${getLanguageName(normalizedSource)} → ${getLanguageName(normalizedTarget)}`);

  // Validate languages are supported
  if (!isTranslatorSupported(normalizedSource)) {
    throw new AIModelError(`Unsupported source language: ${sourceLanguage}`, {
      normalized: normalizedSource,
      supported: getSupportedLanguages('translator')
    });
  }

  if (!isTranslatorSupported(normalizedTarget)) {
    throw new AIModelError(`Unsupported target language: ${targetLanguage}`, {
      normalized: normalizedTarget,
      supported: getSupportedLanguages('translator')
    });
  }

  // Check availability
  const available = await canTranslate(normalizedSource, normalizedTarget);
  if (!available) {
    throw new AIModelError(
      `Translation not available for ${normalizedSource}→${normalizedTarget}`
    );
  }

  try {
    const translatorConfig = {
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget
    };

    // Add download monitor if callback provided
    if (onProgress) {
      translatorConfig.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          const progress = Math.round(e.loaded * 100);
          logger.debug(`Translator download: ${progress}%`);
          onProgress(progress);
        });
      };
    }

    const translator = await self.Translator.create(translatorConfig);
    logger.info(`Translator created: ${normalizedSource}→${normalizedTarget}`);
    return translator;

  } catch (error) {
    logger.error('Failed to create translator:', error);
    throw new AIModelError('Failed to create translator', {
      originalError: error,
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget
    });
  }
}

/**
 * Translate text from source language to target language
 * Automatically normalizes language codes and validates support
 *
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code (any format)
 * @param {string} targetLanguage - Target language code (any format)
 * @param {Object} options - Translation options
 * @returns {Promise<string>} Translated text
 */
export async function translate(
  text,
  sourceLanguage,
  targetLanguage,
  options = {}
) {
  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided for translation');
    return text;
  }

  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  // Skip if same language
  if (normalizedSource === normalizedTarget) {
    logger.debug(`Same language (${normalizedSource}), skipping translation`);
    return text;
  }

  // Check if translation is needed and supported
  if (!shouldTranslate(normalizedSource, normalizedTarget)) {
    logger.debug(`Translation not needed: ${normalizedSource}→${normalizedTarget}`);
    return text;
  }

  try {
    // Create translator
    const translator = await createTranslator(
      normalizedSource,
      normalizedTarget,
      options.onProgress
    );

    // Translate text
    logger.debug(`Translating ${text.length} chars: ${normalizedSource}→${normalizedTarget}`);
    const translated = await translator.translate(text);

    // Clean up
    translator.destroy();

    logger.info(`Translation completed: ${getLanguageName(normalizedSource)} → ${getLanguageName(normalizedTarget)}`);
    return translated;

  } catch (error) {
    logger.error('Translation failed:', error);
    logger.warn('Returning original text due to translation error');
    return text;
  }
}

/**
 * Translate multiple texts in batch (reuses translator instance)
 * Automatically normalizes language codes
 *
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} sourceLanguage - Source language code (any format)
 * @param {string} targetLanguage - Target language code (any format)
 * @returns {Promise<Array<string>>} Array of translated texts
 */
export async function translateBatch(
  texts,
  sourceLanguage,
  targetLanguage
) {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  // Skip if same language
  if (normalizedSource === normalizedTarget) {
    logger.debug('Same language, returning original texts');
    return texts;
  }

  // Check if translation is supported
  if (!shouldTranslate(normalizedSource, normalizedTarget)) {
    logger.debug('Translation not supported, returning original texts');
    return texts;
  }

  try {
    // Create translator once
    const translator = await createTranslator(normalizedSource, normalizedTarget);

    // Translate all texts
    logger.info(`Translating ${texts.length} texts in batch: ${normalizedSource}→${normalizedTarget}`);
    const translations = await Promise.all(
      texts.map(async (text) => {
        try {
          return await translator.translate(text);
        } catch (error) {
          logger.error('Failed to translate text in batch:', error);
          return text; // Return original on error
        }
      })
    );

    // Clean up
    translator.destroy();

    logger.info('Batch translation completed');
    return translations;

  } catch (error) {
    logger.error('Batch translation failed:', error);
    return texts; // Return originals on error
  }
}

/**
 * Get list of supported languages for translation
 * @returns {Array<string>} Array of ISO 639-1 codes
 */
export function getSupportedTranslationLanguages() {
  return getSupportedLanguages('translator');
}

/**
 * Check if translation is needed between two languages
 * Wrapper around utility function with normalization
 *
 * @param {string} sourceLanguage - Source language code (any format)
 * @param {string} targetLanguage - Target language code (any format)
 * @returns {boolean}
 */
export function needsTranslation(sourceLanguage, targetLanguage) {
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);
  return shouldTranslate(normalizedSource, normalizedTarget);
}
