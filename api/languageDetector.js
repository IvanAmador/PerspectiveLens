/**
 * Language Detector API wrapper for PerspectiveLens
 * Detects the language of input text using Chrome's built-in Language Detector API
 *
 * Reference: https://developer.chrome.com/docs/ai/language-detector
 * Available: Chrome 138+
 */

import { logger } from '../utils/logger.js';
import { AIModelError, ERROR_MESSAGES } from '../utils/errors.js';
import { normalizeLanguageCode, validateLanguageCode } from '../utils/languages.js';

// Minimum confidence threshold for language detection (0.0 - 1.0)
const MIN_CONFIDENCE = 0.6;

// Minimum text length for accurate detection
const MIN_TEXT_LENGTH = 10;

/**
 * Check if Language Detector API is available
 */
export async function checkLanguageDetectorAvailability() {
  if (typeof LanguageDetector === 'undefined') {
    logger.error('LanguageDetector API not available');
    throw new AIModelError(ERROR_MESSAGES.AI_UNAVAILABLE, {
      reason: 'LanguageDetector API not available in this Chrome version'
    });
  }

  try {
    const availability = await LanguageDetector.availability();
    logger.info('LanguageDetector availability:', availability);
    return availability;
  } catch (error) {
    logger.error('Failed to check LanguageDetector availability:', error);
    throw new AIModelError('Failed to check language detector availability', {
      originalError: error
    });
  }
}

/**
 * Create a Language Detector instance
 * @param {Function} onProgress - Progress callback for model download
 */
export async function createLanguageDetector(onProgress = null) {
  const availability = await checkLanguageDetectorAvailability();

  if (availability === 'unavailable') {
    throw new AIModelError('LanguageDetector is not available');
  }

  try {
    logger.info('Creating LanguageDetector...');

    const config = {};

    // Add download monitor if callback provided
    if (onProgress && (availability === 'downloadable' || availability === 'downloading')) {
      config.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          const progress = Math.round(e.loaded * 100);
          logger.debug(`LanguageDetector download: ${progress}%`);
          onProgress(progress);
        });
      };
    }

    const detector = await LanguageDetector.create(config);
    logger.info('LanguageDetector created successfully');
    return detector;

  } catch (error) {
    logger.error('Failed to create LanguageDetector:', error);
    throw new AIModelError('Failed to create language detector', {
      originalError: error
    });
  }
}

/**
 * Detect language of text with confidence score
 * @param {string} text - Text to analyze
 * @param {Object} options - Detection options
 * @returns {Object} { language: string, confidence: number, alternatives: Array }
 */
export async function detectLanguage(text, options = {}) {
  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided for language detection');
    return {
      language: 'unknown',
      confidence: 0,
      alternatives: []
    };
  }

  // Warn if text is too short
  if (text.length < MIN_TEXT_LENGTH) {
    logger.warn(`Text too short for accurate detection (${text.length} chars, min ${MIN_TEXT_LENGTH})`);
  }

  try {
    const detector = await createLanguageDetector(options.onProgress);

    logger.debug(`Detecting language for text: "${text.substring(0, 50)}..."`);
    const results = await detector.detect(text);

    // Clean up
    detector.destroy();

    if (!results || results.length === 0) {
      logger.warn('No language detection results');
      return {
        language: 'unknown',
        confidence: 0,
        alternatives: []
      };
    }

    // Get top result
    const topResult = results[0];
    const language = topResult.detectedLanguage;
    const confidence = topResult.confidence;

    // Get alternatives (top 3)
    const alternatives = results.slice(1, 4).map(r => ({
      language: r.detectedLanguage,
      confidence: r.confidence
    }));

    logger.info(`Detected language: ${language} (confidence: ${(confidence * 100).toFixed(1)}%)`);

    // Check confidence threshold
    if (confidence < MIN_CONFIDENCE) {
      logger.warn(`Low confidence detection: ${(confidence * 100).toFixed(1)}% (threshold: ${MIN_CONFIDENCE * 100}%)`);
    }

    return {
      language,
      confidence,
      alternatives
    };

  } catch (error) {
    logger.error('Language detection failed:', error);

    // Fallback: Try to detect from common patterns
    const fallbackLang = fallbackLanguageDetection(text);
    logger.warn(`Using fallback detection: ${fallbackLang}`);

    return {
      language: fallbackLang,
      confidence: 0.5, // Low confidence for fallback
      alternatives: []
    };
  }
}

/**
 * Simple fallback language detection using patterns
 * @param {string} text - Text to analyze
 * @returns {string} Language code (ISO 639-1)
 */
function fallbackLanguageDetection(text) {
  // Portuguese patterns
  if (/\b(de|da|do|em|para|com|não|que|ser|um|uma)\b/i.test(text)) {
    return 'pt';
  }

  // Spanish patterns
  if (/\b(de|la|el|en|para|con|no|que|ser|un|una)\b/i.test(text)) {
    return 'es';
  }

  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }

  // Arabic script
  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar';
  }

  // Japanese (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return 'ja';
  }

  // Default to English
  return 'en';
}

/**
 * Detect language with automatic fallback to English
 * Returns normalized ISO 639-1 code (e.g., 'pt-br' → 'pt')
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} Normalized ISO 639-1 language code
 */
export async function detectLanguageSimple(text) {
  if (!text || text.trim().length === 0) {
    return 'en';
  }

  try {
    const result = await detectLanguage(text);

    // Normalize the detected language code
    const normalizedLang = normalizeLanguageCode(result.language);

    // Return language if confidence is high enough
    if (result.confidence >= MIN_CONFIDENCE) {
      logger.info(`Detected language: ${result.language} → ${normalizedLang} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
      return normalizedLang;
    }

    // Low confidence - use fallback
    logger.debug(`Low confidence (${result.confidence}), using fallback`);
    const fallbackLang = fallbackLanguageDetection(text);
    return normalizeLanguageCode(fallbackLang);

  } catch (error) {
    logger.error('Language detection failed, defaulting to English:', error);
    return 'en';
  }
}

/**
 * Batch detect languages for multiple texts
 * @param {Array<string>} texts - Array of texts
 * @returns {Array<Object>} Array of detection results
 */
export async function detectLanguagesBatch(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    // Create detector once for all texts
    const detector = await createLanguageDetector();

    logger.info(`Detecting languages for ${texts.length} texts`);

    const results = await Promise.all(
      texts.map(async (text) => {
        try {
          if (!text || text.trim().length === 0) {
            return { language: 'unknown', confidence: 0 };
          }

          const detectionResults = await detector.detect(text);
          if (detectionResults && detectionResults.length > 0) {
            return {
              language: detectionResults[0].detectedLanguage,
              confidence: detectionResults[0].confidence
            };
          }

          return { language: 'unknown', confidence: 0 };
        } catch (error) {
          logger.error('Failed to detect language in batch:', error);
          return { language: fallbackLanguageDetection(text), confidence: 0.5 };
        }
      })
    );

    // Clean up
    detector.destroy();

    logger.info('Batch language detection completed');
    return results;

  } catch (error) {
    logger.error('Batch language detection failed:', error);
    // Return fallback for all texts
    return texts.map(text => ({
      language: fallbackLanguageDetection(text),
      confidence: 0.5
    }));
  }
}

/**
 * Check if detected language meets confidence threshold
 * @param {Object} result - Detection result from detectLanguage()
 * @returns {boolean}
 */
export function isConfidentDetection(result) {
  return result && result.confidence >= MIN_CONFIDENCE;
}

/**
 * Get minimum confidence threshold
 */
export function getConfidenceThreshold() {
  return MIN_CONFIDENCE;
}
