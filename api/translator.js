/**
 * Professional Translator API wrapper for PerspectiveLens
 * Handles translation using Chrome's built-in Translator API
 * Automatically normalizes language codes to ISO 639-1 standard
 * 
 * Supported languages (Chrome 138+):
 * - en, es, fr, de, it, nl, pl, pt, ru, ar, zh, hi, ja, ko, th, tr, vi
 * 
 * Reference: https://developer.chrome.com/docs/ai/translator-api
 * Available: Chrome 138+
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
 * Translation configuration
 */
const TRANSLATION_CONFIG = {
  // Maximum text length for single translation (recommended chunking above this)
  MAX_TEXT_LENGTH: 10000,
  
  // Chunk size for long text translations
  CHUNK_SIZE: 5000,
  
  // Minimum text length worth translating
  MIN_TEXT_LENGTH: 3
};

/**
 * Check if Translator API is available
 * Reference: https://developer.chrome.com/docs/ai/translator-api#get_started
 * 
 * @returns {Promise<boolean>} True if available
 * @throws {AIModelError} If API is not supported
 */
export async function checkTranslatorAvailability() {
  logger.system.debug('Checking Translator API availability', {
    category: logger.CATEGORIES.TRANSLATE
  });

  try {
    if (typeof self.Translator === 'undefined') {
      logger.system.error('Translator API not available in browser', {
        category: logger.CATEGORIES.TRANSLATE,
        data: { requiredChrome: '138+' }
      });
      
      throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED, {
        reason: 'Translator API not available (requires Chrome 138+)'
      });
    }

    const available = typeof self.Translator.create === 'function';
    
    logger.system.info('Translator API availability checked', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { available }
    });

    return available;
  } catch (error) {
    logger.system.error('Failed to check Translator availability', {
      category: logger.CATEGORIES.ERROR,
      error
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError('Failed to check translator availability', error);
  }
}

/**
 * Check if a specific language pair is available for translation
 * Reference: https://developer.chrome.com/docs/ai/translator-api#check_language_pair_support
 * 
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Availability status: 'available', 'downloading', 'downloadable', 'unavailable'
 */
export async function checkLanguagePairAvailability(sourceLanguage, targetLanguage) {
  if (!sourceLanguage || !targetLanguage) {
    throw new AIModelError('Source and target languages are required');
  }

  // Normalize language codes to BCP 47 short codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  logger.system.debug('Checking language pair availability', {
    category: logger.CATEGORIES.TRANSLATE,
    data: {
      source: `${sourceLanguage} → ${normalizedSource}`,
      target: `${targetLanguage} → ${normalizedTarget}`
    }
  });

  // Skip if same language
  if (normalizedSource === normalizedTarget) {
    logger.system.debug('Same language, translation not needed', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { language: normalizedSource }
    });
    return 'unavailable';
  }

  // Let the API decide if the language pair is supported
  // Don't use hardcoded lists - the API knows best!
  try {
    const availability = await self.Translator.availability({
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget
    });

    logger.system.info('Language pair availability checked', {
      category: logger.CATEGORIES.TRANSLATE,
      data: {
        pair: `${normalizedSource} → ${normalizedTarget}`,
        availability
      }
    });

    return availability;
  } catch (error) {
    logger.system.error('Failed to check language pair availability', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        source: normalizedSource,
        target: normalizedTarget
      }
    });
    return 'unavailable';
  }
}

/**
 * Create a translator instance for a language pair
 * Reference: https://developer.chrome.com/docs/ai/translator-api#create_and_run_the_translator
 * 
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {Function} onProgress - Progress callback for model download (optional)
 * @returns {Promise<Object>} Translator instance
 * @throws {AIModelError} If creation fails
 */
export async function createTranslator(
  sourceLanguage,
  targetLanguage,
  onProgress = null
) {
  const startTime = Date.now();

  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  logger.system.info('Creating translator', {
    category: logger.CATEGORIES.TRANSLATE,
    data: {
      sourceLang: getLanguageName(normalizedSource),
      targetLang: getLanguageName(normalizedTarget),
      pair: `${normalizedSource} → ${normalizedTarget}`
    }
  });

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

  // Check availability for this specific language pair
  const availability = await checkLanguagePairAvailability(
    normalizedSource,
    normalizedTarget
  );

  if (availability === 'unavailable') {
    throw new AIModelError(
      `Translation not available for ${normalizedSource} → ${normalizedTarget}`,
      { availability }
    );
  }

  try {
    const translatorConfig = {
      sourceLanguage: normalizedSource,
      targetLanguage: normalizedTarget
    };

    // Add download monitor if callback provided
    if (onProgress && (availability === 'downloadable' || availability === 'downloading')) {
      translatorConfig.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          const progress = Math.round(e.loaded * 100);
          
          logger.system.debug('Translation model download progress', {
            category: logger.CATEGORIES.TRANSLATE,
            data: {
              progress,
              loaded: e.loaded,
              pair: `${normalizedSource} → ${normalizedTarget}`
            }
          });
          
          onProgress(progress);
        });
      };

      logger.system.info('Download monitor attached to translator', {
        category: logger.CATEGORIES.TRANSLATE,
        data: { availability }
      });
    }

    logger.system.debug('Requesting translator from API', {
      category: logger.CATEGORIES.TRANSLATE,
      data: translatorConfig
    });

    const translator = await self.Translator.create(translatorConfig);

    const duration = Date.now() - startTime;

    logger.system.info('Translator created successfully', {
      category: logger.CATEGORIES.TRANSLATE,
      data: {
        pair: `${normalizedSource} → ${normalizedTarget}`,
        duration
      }
    });

    return translator;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.system.error('Failed to create translator', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        source: normalizedSource,
        target: normalizedTarget,
        duration
      }
    });

    if (error instanceof AIModelError) throw error;
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
 * Reference: https://developer.chrome.com/docs/ai/translator-api#create_and_run_the_translator
 * 
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {Object} options - Translation options
 * @param {Function} options.onProgress - Progress callback for downloads
 * @param {boolean} options.stream - Use streaming API for long texts (default: false)
 * @returns {Promise<string>} Translated text
 */
export async function translate(
  text,
  sourceLanguage,
  targetLanguage,
  options = {}
) {
  const operationStart = Date.now();
  const { progressContext } = options; // Context for user progress (e.g., { phase: 'compression', baseProgress: 70 })

  // Validation
  if (!text || text.trim().length === 0) {
    logger.system.warn('Empty text provided for translation', {
      category: logger.CATEGORIES.TRANSLATE
    });
    return text;
  }

  if (text.length < TRANSLATION_CONFIG.MIN_TEXT_LENGTH) {
    logger.system.debug('Text too short for translation', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { textLength: text.length, minLength: TRANSLATION_CONFIG.MIN_TEXT_LENGTH }
    });
    return text;
  }

  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  logger.system.info('Starting translation', {
    category: logger.CATEGORIES.TRANSLATE,
    data: {
      textLength: text.length,
      sourceLang: getLanguageName(normalizedSource),
      targetLang: getLanguageName(normalizedTarget),
      pair: `${normalizedSource} → ${normalizedTarget}`
    }
  });

  // Skip if same language
  if (normalizedSource === normalizedTarget) {
    logger.system.debug('Same language, skipping translation', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { language: normalizedSource }
    });
    return text;
  }

  // Check if translation is needed and supported
  if (!shouldTranslate(normalizedSource, normalizedTarget)) {
    logger.system.debug('Translation not needed or supported', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { source: normalizedSource, target: normalizedTarget }
    });
    return text;
  }

  try {
    // Create translator
    const translatorStart = Date.now();
    const translator = await createTranslator(
      normalizedSource,
      normalizedTarget,
      options.onProgress
    );
    const translatorDuration = Date.now() - translatorStart;

    logger.system.debug('Translator ready, starting translation', {
      category: logger.CATEGORIES.TRANSLATE,
      data: {
        translatorCreationTime: translatorDuration,
        textLength: text.length
      }
    });

    // User-friendly log for long translations
    if (progressContext && text.length > 1000) {
      const sourceName = getLanguageName(normalizedSource);
      const targetName = getLanguageName(normalizedTarget);

      logger.logUserAI('translation', {
        phase: progressContext.phase || 'translation',
        progress: progressContext.baseProgress || 50,
        message: `Translating from ${sourceName} to ${targetName}...`,
        metadata: {
          textLength: text.length,
          from: normalizedSource,
          to: normalizedTarget
        }
      });
    }

    // Execute translation
    let translated;
    const translationStart = Date.now();

    if (options.stream || text.length > TRANSLATION_CONFIG.MAX_TEXT_LENGTH) {
      // Use streaming for long texts
      logger.system.debug('Using streaming translation', {
        category: logger.CATEGORIES.TRANSLATE,
        data: { textLength: text.length, threshold: TRANSLATION_CONFIG.MAX_TEXT_LENGTH }
      });

      translated = await translateStreaming(translator, text);
    } else {
      // Standard translation
      logger.system.debug('Executing standard translation', {
        category: logger.CATEGORIES.TRANSLATE
      });

      translated = await translator.translate(text);
    }

    const translationDuration = Date.now() - translationStart;

    // Cleanup
    translator.destroy();

    const totalDuration = Date.now() - operationStart;

    logger.system.info('Translation completed successfully', {
      category: logger.CATEGORIES.TRANSLATE,
      data: {
        pair: `${normalizedSource} → ${normalizedTarget}`,
        originalLength: text.length,
        translatedLength: translated.length,
        totalDuration,
        breakdown: {
          translatorCreation: translatorDuration,
          translation: translationDuration
        }
      }
    });

    return translated;
  } catch (error) {
    const duration = Date.now() - operationStart;

    logger.system.error('Translation failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        pair: `${normalizedSource} → ${normalizedTarget}`,
        textLength: text.length,
        duration
      }
    });

    logger.system.warn('Returning original text due to translation error', {
      category: logger.CATEGORIES.TRANSLATE
    });

    return text; // Fallback to original text
  }
}

/**
 * Streaming translation for long texts
 * Reference: https://developer.chrome.com/docs/ai/translator-api#create_and_run_the_translator
 * 
 * @param {Object} translator - Translator instance
 * @param {string} text - Text to translate
 * @returns {Promise<string>} Translated text
 */
async function translateStreaming(translator, text) {
  logger.system.debug('Starting streaming translation', {
    category: logger.CATEGORIES.TRANSLATE,
    data: { textLength: text.length }
  });

  try {
    const stream = translator.translateStreaming(text);
    let result = '';
    let chunks = 0;

    for await (const chunk of stream) {
      result = chunk; // Each chunk contains the full result so far
      chunks++;
      
      if (chunks % 10 === 0) { // Log every 10 chunks to avoid spam
        logger.system.trace('Streaming translation progress', {
          category: logger.CATEGORIES.TRANSLATE,
          data: { chunks, currentLength: result.length }
        });
      }
    }

    logger.system.debug('Streaming translation completed', {
      category: logger.CATEGORIES.TRANSLATE,
      data: {
        totalChunks: chunks,
        finalLength: result.length
      }
    });

    return result;
  } catch (error) {
    logger.system.error('Streaming translation failed', {
      category: logger.CATEGORIES.ERROR,
      error
    });
    throw error;
  }
}

/**
 * Translate multiple texts in batch using a single translator instance
 * More efficient than multiple individual translations
 * Reference: https://developer.chrome.com/docs/ai/translator-api#sequential_translations
 * 
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @param {Object} options - Translation options
 * @returns {Promise<Array<string>>} Array of translated texts
 */
export async function translateBatch(
  texts,
  sourceLanguage,
  targetLanguage,
  options = {}
) {
  const operationStart = Date.now();

  if (!Array.isArray(texts) || texts.length === 0) {
    logger.system.warn('No texts provided for batch translation', {
      category: logger.CATEGORIES.TRANSLATE
    });
    return [];
  }

  // Normalize language codes
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);

  logger.system.info('Starting batch translation', {
    category: logger.CATEGORIES.TRANSLATE,
    data: {
      textsCount: texts.length,
      totalChars: texts.reduce((sum, t) => sum + t.length, 0),
      pair: `${normalizedSource} → ${normalizedTarget}`
    }
  });

  // Skip if same language
  if (normalizedSource === normalizedTarget) {
    logger.system.debug('Same language, returning original texts', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { language: normalizedSource }
    });
    return texts;
  }

  // Check if translation is supported
  if (!shouldTranslate(normalizedSource, normalizedTarget)) {
    logger.system.debug('Translation not supported, returning original texts', {
      category: logger.CATEGORIES.TRANSLATE
    });
    return texts;
  }

  try {
    // Create translator once for all texts (efficient)
    const translator = await createTranslator(
      normalizedSource,
      normalizedTarget,
      options.onProgress
    );

    logger.system.debug('Translating texts sequentially', {
      category: logger.CATEGORIES.TRANSLATE,
      data: { count: texts.length }
    });

    // Translate all texts sequentially (API processes sequentially)
    const translations = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const text = texts[i];
        
        if (!text || text.trim().length === 0) {
          translations.push(text);
          continue;
        }

        logger.system.trace(`Translating text ${i + 1}/${texts.length}`, {
          category: logger.CATEGORIES.TRANSLATE,
          data: { index: i + 1, textLength: text.length }
        });

        const translated = await translator.translate(text);
        translations.push(translated);
      } catch (error) {
        logger.system.error('Failed to translate text in batch', {
          category: logger.CATEGORIES.TRANSLATE,
          error,
          data: { index: i + 1, total: texts.length }
        });
        
        // Return original text on error
        translations.push(texts[i]);
      }
    }

    // Cleanup
    translator.destroy();

    const duration = Date.now() - operationStart;

    logger.system.info('Batch translation completed', {
      category: logger.CATEGORIES.TRANSLATE,
      data: {
        successful: translations.length,
        failed: texts.length - translations.length,
        duration,
        avgPerText: Math.round(duration / texts.length)
      }
    });

    return translations;
  } catch (error) {
    const duration = Date.now() - operationStart;

    logger.system.error('Batch translation failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        textsCount: texts.length,
        duration
      }
    });

    logger.system.warn('Returning original texts due to batch translation error', {
      category: logger.CATEGORIES.TRANSLATE
    });

    return texts; // Fallback to original texts
  }
}

/**
 * Check if translation is needed between two languages
 * Wrapper around utility function with normalization
 * 
 * @param {string} sourceLanguage - Source language code
 * @param {string} targetLanguage - Target language code
 * @returns {boolean} True if translation is needed
 */
export function needsTranslation(sourceLanguage, targetLanguage) {
  const normalizedSource = normalizeLanguageCode(sourceLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);
  
  const needs = shouldTranslate(normalizedSource, normalizedTarget);
  
  logger.system.trace('Translation necessity check', {
    category: logger.CATEGORIES.TRANSLATE,
    data: {
      source: normalizedSource,
      target: normalizedTarget,
      needed: needs
    }
  });
  
  return needs;
}

/**
 * Get list of supported languages for translation
 * 
 * @returns {Array<string>} Array of ISO 639-1 language codes
 */
export function getSupportedTranslationLanguages() {
  const languages = getSupportedLanguages('translator');
  
  logger.system.trace('Retrieved supported translation languages', {
    category: logger.CATEGORIES.TRANSLATE,
    data: { count: languages.length, languages }
  });
  
  return languages;
}

/**
 * Get human-readable name for language code
 * 
 * @param {string} languageCode - ISO 639-1 code
 * @returns {string} Language name
 */
export function getTranslationLanguageName(languageCode) {
  const normalized = normalizeLanguageCode(languageCode);
  return getLanguageName(normalized);
}

/**
 * Validate if a language is supported for translation
 * 
 * @param {string} languageCode - Language code to check
 * @returns {boolean} True if supported
 */
export function isLanguageSupportedForTranslation(languageCode) {
  const normalized = normalizeLanguageCode(languageCode);
  const supported = isTranslatorSupported(normalized);
  
  logger.system.trace('Language support check', {
    category: logger.CATEGORIES.TRANSLATE,
    data: {
      provided: languageCode,
      normalized,
      supported
    }
  });
  
  return supported;
}
