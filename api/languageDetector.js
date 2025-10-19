/**
 * Professional Language Detector API wrapper for PerspectiveLens
 * Detects the language of input text using Chrome's built-in Language Detector API
 * Returns ranked list of languages with confidence scores
 * 
 * The Language Detector API uses a ranking model to determine which language
 * is most likely used in a given piece of text. Results are ranked from highest
 * to lowest probability with confidence levels between 0.0 and 1.0.
 * 
 * Reference: https://developer.chrome.com/docs/ai/language-detector-api
 * Available: Chrome 138+
 */

import { logger } from '../utils/logger.js';
import { AIModelError, ERROR_MESSAGES } from '../utils/errors.js';
import { normalizeLanguageCode, getLanguageName } from '../utils/languages.js';

/**
 * Language Detection configuration
 */
const DETECTION_CONFIG = {
  // Minimum confidence threshold for accepting detection (0.0 - 1.0)
  MIN_CONFIDENCE: 0.6,
  
  // High confidence threshold for automatic acceptance
  HIGH_CONFIDENCE: 0.85,
  
  // Minimum text length for accurate detection
  MIN_TEXT_LENGTH: 10,
  
  // Recommended text length for best results
  RECOMMENDED_LENGTH: 50,
  
  // Maximum alternatives to return
  MAX_ALTERNATIVES: 3
};

/**
 * Check if Language Detector API is available
 * Reference: https://developer.chrome.com/docs/ai/language-detector-api#model_download
 * 
 * @returns {Promise<string>} Availability status: 'available', 'downloading', 'downloadable', 'unavailable'
 * @throws {AIModelError} If API is not supported
 */
export async function checkLanguageDetectorAvailability() {
  logger.system.debug('Checking Language Detector API availability', {
    category: logger.CATEGORIES.GENERAL
  });

  try {
    if (typeof self.LanguageDetector === 'undefined') {
      logger.system.error('Language Detector API not available in browser', {
        category: logger.CATEGORIES.GENERAL,
        data: { requiredChrome: '138+' }
      });
      
      throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED, {
        reason: 'Language Detector API not available (requires Chrome 138+)'
      });
    }

    const availability = await self.LanguageDetector.availability();
    
    logger.system.info('Language Detector API availability checked', {
      category: logger.CATEGORIES.GENERAL,
      data: { availability }
    });

    return availability;
  } catch (error) {
    logger.system.error('Failed to check Language Detector availability', {
      category: logger.CATEGORIES.ERROR,
      error
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError('Failed to check language detector availability', error);
  }
}

/**
 * Create a Language Detector instance
 * Reference: https://developer.chrome.com/docs/ai/language-detector-api#get_started
 * 
 * @param {Function} onProgress - Progress callback for model download (optional)
 * @returns {Promise<Object>} Language Detector instance
 * @throws {AIModelError} If creation fails
 */
export async function createLanguageDetector(onProgress = null) {
  const startTime = Date.now();
  
  logger.system.info('Creating Language Detector instance', {
    category: logger.CATEGORIES.GENERAL
  });

  try {
    // Check availability
    const availability = await checkLanguageDetectorAvailability();
    
    if (availability === 'unavailable') {
      throw new AIModelError('Language Detector is not available on this device');
    }

    const config = {};

    // Add download monitor if callback provided
    if (onProgress && (availability === 'downloadable' || availability === 'downloading')) {
      config.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          const progress = Math.round(e.loaded * 100);
          
          logger.system.debug('Language Detector model download progress', {
            category: logger.CATEGORIES.GENERAL,
            data: { progress, loaded: e.loaded }
          });
          
          onProgress(progress);
        });
      };
      
      logger.system.info('Download monitor attached to detector', {
        category: logger.CATEGORIES.GENERAL,
        data: { availability }
      });
    }

    logger.system.debug('Requesting Language Detector from API', {
      category: logger.CATEGORIES.GENERAL
    });

    const detector = await self.LanguageDetector.create(config);
    
    const duration = Date.now() - startTime;
    
    logger.system.info('Language Detector created successfully', {
      category: logger.CATEGORIES.GENERAL,
      data: { duration }
    });

    return detector;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.system.error('Failed to create Language Detector', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { duration }
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError('Failed to create language detector', error);
  }
}

/**
 * Detect language of text with confidence scores
 * Returns ranked list of detected languages from most to least likely
 * Reference: https://developer.chrome.com/docs/ai/language-detector-api#run_the_language_detector
 * 
 * @param {string} text - Text to analyze
 * @param {Object} options - Detection options
 * @param {Function} options.onProgress - Progress callback for model download
 * @param {boolean} options.returnAllCandidates - Return all ranked candidates (default: false)
 * @returns {Promise<Object>} Detection result: { language, confidence, alternatives }
 */
export async function detectLanguage(text, options = {}) {
  const operationStart = Date.now();

  // Validation
  if (!text || text.trim().length === 0) {
    logger.system.warn('Empty text provided for language detection', {
      category: logger.CATEGORIES.GENERAL
    });
    return {
      language: 'unknown',
      confidence: 0,
      alternatives: []
    };
  }

  const textLength = text.length;

  // Warn if text is too short for accurate detection
  if (textLength < DETECTION_CONFIG.MIN_TEXT_LENGTH) {
    logger.system.warn('Text too short for accurate detection', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        textLength,
        minLength: DETECTION_CONFIG.MIN_TEXT_LENGTH,
        recommendedLength: DETECTION_CONFIG.RECOMMENDED_LENGTH
      }
    });
  }

  logger.system.info('Starting language detection', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      textLength,
      textPreview: text.substring(0, 60).replace(/\n/g, ' ') + (textLength > 60 ? '...' : '')
    }
  });

  try {
    // Create detector
    const detectorStart = Date.now();
    const detector = await createLanguageDetector(options.onProgress);
    const detectorDuration = Date.now() - detectorStart;

    logger.system.debug('Detector ready, executing detection', {
      category: logger.CATEGORIES.GENERAL,
      data: { detectorCreationTime: detectorDuration }
    });

    // Execute detection
    const detectionStart = Date.now();
    const results = await detector.detect(text);
    const detectionDuration = Date.now() - detectionStart;

    // Cleanup
    detector.destroy();

    // Process results
    if (!results || results.length === 0) {
      logger.system.warn('No language detection results returned', {
        category: logger.CATEGORIES.GENERAL,
        data: { textLength }
      });
      
      // Fallback to pattern-based detection
      const fallbackLang = fallbackLanguageDetection(text);
      const totalDuration = Date.now() - operationStart;
      
      logger.system.info('Using fallback language detection', {
        category: logger.CATEGORIES.GENERAL,
        data: { fallbackLanguage: fallbackLang, duration: totalDuration }
      });
      
      return {
        language: fallbackLang,
        confidence: 0.5,
        alternatives: [],
        method: 'fallback'
      };
    }

    // Get top result
    const topResult = results[0];
    const detectedLanguage = topResult.detectedLanguage;
    const confidence = topResult.confidence;

    // Get alternatives (top N results after the first)
    const alternatives = results
      .slice(1, DETECTION_CONFIG.MAX_ALTERNATIVES + 1)
      .map(r => ({
        language: r.detectedLanguage,
        languageName: getLanguageName(r.detectedLanguage),
        confidence: r.confidence
      }));

    const totalDuration = Date.now() - operationStart;

    // Log based on confidence level
    if (confidence >= DETECTION_CONFIG.HIGH_CONFIDENCE) {
      logger.system.info('High confidence language detection', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          language: detectedLanguage,
          languageName: getLanguageName(detectedLanguage),
          confidence: confidence.toFixed(4),
          confidencePercent: `${(confidence * 100).toFixed(1)}%`,
          alternativesCount: alternatives.length,
          duration: totalDuration,
          breakdown: {
            detectorCreation: detectorDuration,
            detection: detectionDuration
          }
        }
      });
    } else if (confidence >= DETECTION_CONFIG.MIN_CONFIDENCE) {
      logger.system.info('Moderate confidence language detection', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          language: detectedLanguage,
          languageName: getLanguageName(detectedLanguage),
          confidence: confidence.toFixed(4),
          confidencePercent: `${(confidence * 100).toFixed(1)}%`,
          alternatives: alternatives.map(a => `${a.language}:${(a.confidence * 100).toFixed(1)}%`),
          duration: totalDuration
        }
      });
    } else {
      logger.system.warn('Low confidence language detection', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          language: detectedLanguage,
          confidence: confidence.toFixed(4),
          confidencePercent: `${(confidence * 100).toFixed(1)}%`,
          minConfidence: DETECTION_CONFIG.MIN_CONFIDENCE,
          message: 'Consider using fallback or requesting more text',
          duration: totalDuration
        }
      });
    }

    const result = {
      language: detectedLanguage,
      languageName: getLanguageName(detectedLanguage),
      confidence,
      alternatives,
      method: 'api',
      isConfident: confidence >= DETECTION_CONFIG.MIN_CONFIDENCE,
      isHighConfidence: confidence >= DETECTION_CONFIG.HIGH_CONFIDENCE
    };

    // Optionally return all candidates
    if (options.returnAllCandidates) {
      result.allCandidates = results.map(r => ({
        language: r.detectedLanguage,
        languageName: getLanguageName(r.detectedLanguage),
        confidence: r.confidence
      }));
    }

    return result;
  } catch (error) {
    const duration = Date.now() - operationStart;
    
    logger.system.error('Language detection failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { textLength, duration }
    });

    // Fallback to pattern-based detection
    const fallbackLang = fallbackLanguageDetection(text);
    
    logger.system.warn('Using fallback detection due to error', {
      category: logger.CATEGORIES.GENERAL,
      data: { fallbackLanguage: fallbackLang, duration }
    });

    return {
      language: fallbackLang,
      confidence: 0.5,
      alternatives: [],
      method: 'fallback',
      error: error.message
    };
  }
}

/**
 * Simplified language detection with automatic fallback
 * Returns normalized ISO 639-1 code (e.g., 'pt-BR' → 'pt')
 * Reference: https://developer.chrome.com/docs/ai/language-detector-api
 * 
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} Normalized ISO 639-1 language code
 */
export async function detectLanguageSimple(text) {
  if (!text || text.trim().length === 0) {
    logger.system.debug('Empty text, returning default language', {
      category: logger.CATEGORIES.GENERAL,
      data: { defaultLanguage: 'en' }
    });
    return 'en';
  }

  try {
    const result = await detectLanguage(text);
    
    // Normalize the detected language code
    const normalizedLang = normalizeLanguageCode(result.language);

    // Return language if confidence is high enough
    if (result.confidence >= DETECTION_CONFIG.MIN_CONFIDENCE) {
      logger.system.debug('Confident detection, returning normalized language', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          detected: result.language,
          normalized: normalizedLang,
          confidence: `${(result.confidence * 100).toFixed(1)}%`
        }
      });
      return normalizedLang;
    }

    // Low confidence - use fallback
    logger.system.debug('Low confidence, using fallback detection', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        detected: result.language,
        confidence: result.confidence,
        threshold: DETECTION_CONFIG.MIN_CONFIDENCE
      }
    });

    const fallbackLang = fallbackLanguageDetection(text);
    return normalizeLanguageCode(fallbackLang);
  } catch (error) {
    logger.system.error('Simple detection failed, defaulting to English', {
      category: logger.CATEGORIES.ERROR,
      error
    });
    return 'en';
  }
}

/**
 * Batch detect languages for multiple texts
 * Efficiently reuses detector instance for all texts
 * 
 * @param {Array<string>} texts - Array of texts to analyze
 * @param {Object} options - Detection options
 * @returns {Promise<Array<Object>>} Array of detection results
 */
export async function detectLanguagesBatch(texts, options = {}) {
  const operationStart = Date.now();

  if (!Array.isArray(texts) || texts.length === 0) {
    logger.system.warn('No texts provided for batch detection', {
      category: logger.CATEGORIES.GENERAL
    });
    return [];
  }

  logger.system.info('Starting batch language detection', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      textsCount: texts.length,
      totalChars: texts.reduce((sum, t) => sum + (t?.length || 0), 0)
    }
  });

  try {
    // Create detector once for all texts (efficient)
    const detector = await createLanguageDetector(options.onProgress);

    logger.system.debug('Processing texts in batch', {
      category: logger.CATEGORIES.GENERAL,
      data: { count: texts.length }
    });

    // Detect all texts
    const results = await Promise.allSettled(
      texts.map(async (text, index) => {
        if (!text || text.trim().length === 0) {
          logger.system.trace('Empty text in batch', {
            category: logger.CATEGORIES.GENERAL,
            data: { index }
          });
          return { language: 'unknown', confidence: 0, method: 'empty' };
        }

        try {
          const detectionResults = await detector.detect(text);
          
          if (detectionResults && detectionResults.length > 0) {
            const topResult = detectionResults[0];
            return {
              language: topResult.detectedLanguage,
              languageName: getLanguageName(topResult.detectedLanguage),
              confidence: topResult.confidence,
              method: 'api'
            };
          }

          return { language: 'unknown', confidence: 0, method: 'no-results' };
        } catch (error) {
          logger.system.warn('Failed to detect language in batch', {
            category: logger.CATEGORIES.GENERAL,
            error,
            data: { index, textLength: text.length }
          });

          const fallbackLang = fallbackLanguageDetection(text);
          return { language: fallbackLang, confidence: 0.5, method: 'fallback' };
        }
      })
    );

    // Cleanup
    detector.destroy();

    // Process results
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.system.error('Batch detection promise rejected', {
          category: logger.CATEGORIES.ERROR,
          data: { index, reason: result.reason?.message }
        });
        
        const fallbackLang = fallbackLanguageDetection(texts[index] || '');
        return { language: fallbackLang, confidence: 0.5, method: 'fallback-error' };
      }
    });

    const duration = Date.now() - operationStart;
    const successful = processedResults.filter(r => r.method === 'api').length;

    logger.system.info('Batch detection completed', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        total: texts.length,
        successful,
        fallback: texts.length - successful,
        duration,
        avgPerText: Math.round(duration / texts.length)
      }
    });

    return processedResults;
  } catch (error) {
    const duration = Date.now() - operationStart;
    
    logger.system.error('Batch detection failed catastrophically', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { textsCount: texts.length, duration }
    });

    // Return fallback for all texts
    logger.system.warn('Using fallback detection for all texts', {
      category: logger.CATEGORIES.GENERAL
    });

    return texts.map(text => ({
      language: fallbackLanguageDetection(text || ''),
      confidence: 0.5,
      method: 'fallback-batch-error'
    }));
  }
}

/**
 * Pattern-based fallback language detection
 * Uses common words and character patterns to guess language
 * Caution: Less accurate than API, should only be used as fallback
 * 
 * @param {string} text - Text to analyze
 * @returns {string} ISO 639-1 language code
 */
function fallbackLanguageDetection(text) {
  if (!text || text.trim().length === 0) {
    return 'en';
  }

  logger.system.trace('Using pattern-based fallback detection', {
    category: logger.CATEGORIES.GENERAL,
    data: { textLength: text.length }
  });

  const lowerText = text.toLowerCase();

  // Portuguese patterns (must come before Spanish due to similarities)
  if (/\b(não|são|também|então|você|artigo|notícias|recebe|corpos|mortos|prisioneiros)\b/.test(lowerText)) {
    return 'pt';
  }

  // Portuguese verb endings (common in PT but not ES)
  if (/\b\w+(ção|ões|ãe|õe)\b/.test(lowerText)) {
    return 'pt';
  }

  // Spanish patterns
  if (/\b(también|artículo|noticias|después|mientras|durante)\b/.test(lowerText)) {
    return 'es';
  }

  // French patterns
  if (/\b(être|avec|dans|pour|cette|tous|leur|mais)\b/.test(lowerText)) {
    return 'fr';
  }

  // German patterns
  if (/\b(nicht|auch|nach|über|dieser|werden|können)\b/.test(lowerText)) {
    return 'de';
  }

  // Italian patterns
  if (/\b(essere|anche|dopo|tutti|loro|questo|essere)\b/.test(lowerText)) {
    return 'it';
  }

  // Chinese characters (CJK Unified Ideographs)
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }

  // Japanese (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return 'ja';
  }

  // Korean (Hangul)
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko';
  }

  // Arabic script
  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar';
  }

  // Cyrillic script (Russian, etc.)
  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru';
  }

  // Thai script
  if (/[\u0e00-\u0e7f]/.test(text)) {
    return 'th';
  }

  // Default to English
  return 'en';
}

/**
 * Check if detection result meets confidence threshold
 * 
 * @param {Object} result - Detection result from detectLanguage()
 * @returns {boolean} True if confidence meets minimum threshold
 */
export function isConfidentDetection(result) {
  const isConfident = result && result.confidence >= DETECTION_CONFIG.MIN_CONFIDENCE;
  
  logger.system.trace('Confidence check', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      confidence: result?.confidence,
      threshold: DETECTION_CONFIG.MIN_CONFIDENCE,
      isConfident
    }
  });
  
  return isConfident;
}

/**
 * Check if detection result has high confidence
 * 
 * @param {Object} result - Detection result from detectLanguage()
 * @returns {boolean} True if confidence is high
 */
export function isHighConfidenceDetection(result) {
  return result && result.confidence >= DETECTION_CONFIG.HIGH_CONFIDENCE;
}

/**
 * Get configuration thresholds
 * 
 * @returns {Object} Configuration object
 */
export function getDetectionConfig() {
  return { ...DETECTION_CONFIG };
}

/**
 * Get minimum confidence threshold
 * 
 * @returns {number} Minimum confidence (0.0 - 1.0)
 */
export function getConfidenceThreshold() {
  return DETECTION_CONFIG.MIN_CONFIDENCE;
}

/**
 * Get high confidence threshold
 * 
 * @returns {number} High confidence (0.0 - 1.0)
 */
export function getHighConfidenceThreshold() {
  return DETECTION_CONFIG.HIGH_CONFIDENCE;
}
