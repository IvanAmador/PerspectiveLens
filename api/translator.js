/**
 * Translator API wrapper for PerspectiveLens
 * Handles translation using Chrome's built-in Translator API
 *
 * Supported language pairs (Chrome 138+):
 * - en, es, fr, de, ar, zh, ja, pt → pt
 *
 * Reference: https://developer.chrome.com/docs/ai/translator-api
 */

import { logger } from '../utils/logger.js';
import { AIModelError, ERROR_MESSAGES } from '../utils/errors.js';

// Supported source languages for translation to Portuguese
const SUPPORTED_SOURCE_LANGUAGES = ['en', 'es', 'fr', 'de', 'ar', 'zh', 'ja'];
const TARGET_LANGUAGE = 'pt';

/**
 * Check if Translator API is available
 */
export async function checkTranslatorAvailability() {
  if (typeof ai === 'undefined' || typeof ai.translator === 'undefined') {
    logger.error('Translator API not available');
    throw new AIModelError(ERROR_MESSAGES.AI_UNAVAILABLE, {
      reason: 'Translator API not available in this Chrome version'
    });
  }

  try {
    // Check if API exists
    const available = typeof ai.translator.create === 'function';
    logger.info('Translator API available:', available);
    return available;
  } catch (error) {
    logger.error('Failed to check Translator availability:', error);
    return false;
  }
}

/**
 * Check if a language pair is available for translation
 * @param {string} sourceLanguage - Source language code (ISO 639-1)
 * @param {string} targetLanguage - Target language code (ISO 639-1)
 */
export async function canTranslate(sourceLanguage, targetLanguage = TARGET_LANGUAGE) {
  if (!sourceLanguage || !targetLanguage) {
    throw new AIModelError('Source and target languages required');
  }

  // Skip if same language
  if (sourceLanguage === targetLanguage) {
    logger.debug(`Skip translation: same language (${sourceLanguage})`);
    return false;
  }

  try {
    const availability = await ai.translator.availability({
      sourceLanguage,
      targetLanguage
    });

    logger.debug(`Translation ${sourceLanguage}→${targetLanguage}: ${availability}`);
    return availability === 'available' || availability === 'downloadable';
  } catch (error) {
    logger.error('Failed to check translation availability:', error);
    return false;
  }
}

/**
 * Create a translator instance for a language pair
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code (default: 'pt')
 * @param {Function} onProgress - Progress callback for model download
 */
export async function createTranslator(
  sourceLanguage,
  targetLanguage = TARGET_LANGUAGE,
  onProgress = null
) {
  if (!SUPPORTED_SOURCE_LANGUAGES.includes(sourceLanguage)) {
    throw new AIModelError(`Unsupported source language: ${sourceLanguage}`, {
      supported: SUPPORTED_SOURCE_LANGUAGES
    });
  }

  // Check availability
  const available = await canTranslate(sourceLanguage, targetLanguage);
  if (!available) {
    throw new AIModelError(
      `Translation not available for ${sourceLanguage}→${targetLanguage}`
    );
  }

  try {
    logger.info(`Creating translator: ${sourceLanguage}→${targetLanguage}`);

    const translatorConfig = {
      sourceLanguage,
      targetLanguage
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

    const translator = await ai.translator.create(translatorConfig);
    logger.info('Translator created successfully');
    return translator;

  } catch (error) {
    logger.error('Failed to create translator:', error);
    throw new AIModelError('Failed to create translator', {
      originalError: error,
      sourceLanguage,
      targetLanguage
    });
  }
}

/**
 * Translate text from source language to target language
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code (default: 'pt')
 * @param {Object} options - Translation options
 */
export async function translate(
  text,
  sourceLanguage,
  targetLanguage = TARGET_LANGUAGE,
  options = {}
) {
  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided for translation');
    return text;
  }

  // Skip if same language
  if (sourceLanguage === targetLanguage) {
    logger.debug('Same language, skipping translation');
    return text;
  }

  // Skip if source is already Portuguese
  if (sourceLanguage === 'pt') {
    logger.debug('Already in Portuguese, skipping translation');
    return text;
  }

  try {
    // Create translator
    const translator = await createTranslator(
      sourceLanguage,
      targetLanguage,
      options.onProgress
    );

    // Translate text
    logger.debug(`Translating ${text.length} chars: ${sourceLanguage}→${targetLanguage}`);
    const translated = await translator.translate(text);

    // Clean up
    translator.destroy();

    logger.info('Translation completed successfully');
    return translated;

  } catch (error) {
    logger.error('Translation failed:', error);

    // Return original text on failure
    logger.warn('Returning original text due to translation error');
    return text;
  }
}

/**
 * Translate multiple texts in batch (reuses translator instance)
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code (default: 'pt')
 */
export async function translateBatch(
  texts,
  sourceLanguage,
  targetLanguage = TARGET_LANGUAGE
) {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Skip if same language
  if (sourceLanguage === targetLanguage || sourceLanguage === 'pt') {
    logger.debug('Same language, returning original texts');
    return texts;
  }

  try {
    // Create translator once
    const translator = await createTranslator(sourceLanguage, targetLanguage);

    // Translate all texts
    logger.info(`Translating ${texts.length} texts in batch`);
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
 * Get list of supported source languages
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_SOURCE_LANGUAGES];
}

/**
 * Detect if translation is needed
 * @param {string} language - Language code
 */
export function needsTranslation(language) {
  return language !== TARGET_LANGUAGE && language !== 'pt';
}
