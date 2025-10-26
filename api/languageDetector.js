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
 * Detect language of text with confidence scores and automatic fallback cascading
 * Implements smart fallback: title → content excerpt → larger excerpt
 *
 * Strategy:
 * 1. Try with primary text (e.g., title)
 * 2. If confidence < MIN_CONFIDENCE and fallbackTexts provided, try with first fallback
 * 3. If still < MIN_CONFIDENCE and more fallbacks, try with next fallback
 * 4. Accept final result regardless of confidence
 *
 * Reference: https://developer.chrome.com/docs/ai/language-detector-api#run_the_language_detector
 *
 * @param {string} text - Primary text to analyze (e.g., article title)
 * @param {Object} options - Detection options
 * @param {Function} options.onProgress - Progress callback for model download
 * @param {boolean} options.returnAllCandidates - Return all ranked candidates (default: false)
 * @param {Array<string>} options.fallbackTexts - Array of fallback texts to try if confidence is low (e.g., [excerpt500, excerpt1500])
 * @returns {Promise<Object>} Detection result: { language, confidence, alternatives, attemptUsed }
 */
export async function detectLanguage(text, options = {}) {
  const operationStart = Date.now();
  const fallbackTexts = options.fallbackTexts || [];

  // Validation
  if (!text || text.trim().length === 0) {
    logger.system.warn('Empty text provided for language detection', {
      category: logger.CATEGORIES.GENERAL
    });
    throw new AIModelError('Empty text provided for language detection');
  }

  // Prepare all texts to try (primary + fallbacks)
  const textsToTry = [
    { text, label: 'primary', length: text.length },
    ...fallbackTexts.map((fb, idx) => ({
      text: fb,
      label: `fallback-${idx + 1}`,
      length: fb?.length || 0
    }))
  ].filter(t => t.text && t.text.trim().length > 0);

  logger.system.info('Starting language detection with cascading fallback', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      primaryTextLength: text.length,
      fallbacksAvailable: fallbackTexts.length,
      totalAttempts: textsToTry.length,
      primaryPreview: text.substring(0, 60).replace(/\n/g, ' ') + (text.length > 60 ? '...' : '')
    }
  });

  // Create detector once for all attempts
  const detectorStart = Date.now();
  const detector = await createLanguageDetector(options.onProgress);
  const detectorDuration = Date.now() - detectorStart;

  logger.system.debug('Detector ready, starting detection attempts', {
    category: logger.CATEGORIES.GENERAL,
    data: { detectorCreationTime: detectorDuration }
  });

  let finalResult = null;

  try {
    // Try each text in sequence until we get confident result or exhaust all options
    for (let i = 0; i < textsToTry.length; i++) {
      const attempt = textsToTry[i];
      const isLastAttempt = i === textsToTry.length - 1;

      logger.system.debug(`Detection attempt ${i + 1}/${textsToTry.length}`, {
        category: logger.CATEGORIES.GENERAL,
        data: {
          attemptLabel: attempt.label,
          textLength: attempt.length,
          isLastAttempt
        }
      });

      // Execute detection
      const detectionStart = Date.now();
      const results = await detector.detect(attempt.text);
      const detectionDuration = Date.now() - detectionStart;

      // Process results
      if (!results || results.length === 0) {
        logger.system.warn('No detection results for this attempt', {
          category: logger.CATEGORIES.GENERAL,
          data: { attempt: attempt.label }
        });

        if (isLastAttempt) {
          throw new AIModelError('No language detection results from API');
        }
        continue;
      }

      // Get top result
      const topResult = results[0];
      const detectedLanguage = normalizeLanguageCode(topResult.detectedLanguage);
      const confidence = topResult.confidence;

      // Get alternatives
      const alternatives = results
        .slice(1, DETECTION_CONFIG.MAX_ALTERNATIVES + 1)
        .map(r => ({
          language: normalizeLanguageCode(r.detectedLanguage),
          languageName: getLanguageName(r.detectedLanguage),
          confidence: r.confidence
        }));

      // Build result object
      const attemptResult = {
        language: detectedLanguage,
        languageName: getLanguageName(detectedLanguage),
        confidence,
        alternatives,
        method: 'api',
        attemptUsed: attempt.label,
        attemptNumber: i + 1,
        totalAttempts: textsToTry.length,
        isConfident: confidence >= DETECTION_CONFIG.MIN_CONFIDENCE,
        isHighConfidence: confidence >= DETECTION_CONFIG.HIGH_CONFIDENCE
      };

      // Log result
      if (confidence >= DETECTION_CONFIG.HIGH_CONFIDENCE) {
        logger.system.info(`High confidence detection on attempt ${i + 1}`, {
          category: logger.CATEGORIES.GENERAL,
          data: {
            language: detectedLanguage,
            languageName: getLanguageName(detectedLanguage),
            confidence: confidence.toFixed(4),
            confidencePercent: `${(confidence * 100).toFixed(1)}%`,
            attemptUsed: attempt.label,
            detectionTime: detectionDuration
          }
        });
      } else if (confidence >= DETECTION_CONFIG.MIN_CONFIDENCE) {
        logger.system.info(`Moderate confidence detection on attempt ${i + 1}`, {
          category: logger.CATEGORIES.GENERAL,
          data: {
            language: detectedLanguage,
            languageName: getLanguageName(detectedLanguage),
            confidence: confidence.toFixed(4),
            confidencePercent: `${(confidence * 100).toFixed(1)}%`,
            attemptUsed: attempt.label,
            alternatives: alternatives.map(a => `${a.language}:${(a.confidence * 100).toFixed(1)}%`)
          }
        });
      } else {
        logger.system.warn(`Low confidence detection on attempt ${i + 1}`, {
          category: logger.CATEGORIES.GENERAL,
          data: {
            language: detectedLanguage,
            confidence: confidence.toFixed(4),
            confidencePercent: `${(confidence * 100).toFixed(1)}%`,
            minConfidence: DETECTION_CONFIG.MIN_CONFIDENCE,
            attemptUsed: attempt.label,
            isLastAttempt
          }
        });
      }

      // If confident OR this is the last attempt, accept result
      if (confidence >= DETECTION_CONFIG.MIN_CONFIDENCE || isLastAttempt) {
        finalResult = attemptResult;

        if (isLastAttempt && confidence < DETECTION_CONFIG.MIN_CONFIDENCE) {
          logger.system.info('Accepting low confidence result from final attempt', {
            category: logger.CATEGORIES.GENERAL,
            data: {
              language: detectedLanguage,
              confidence: confidence.toFixed(4),
              reason: 'All fallback attempts exhausted'
            }
          });
        }

        break;
      }

      // Low confidence and more attempts available - continue to next fallback
      logger.system.debug('Low confidence, trying next fallback', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          currentConfidence: confidence.toFixed(4),
          threshold: DETECTION_CONFIG.MIN_CONFIDENCE,
          nextAttempt: textsToTry[i + 1]?.label
        }
      });
    }

    // Cleanup
    detector.destroy();

    const totalDuration = Date.now() - operationStart;

    logger.system.info('Language detection completed', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        finalLanguage: finalResult.language,
        finalConfidence: finalResult.confidence.toFixed(4),
        attemptUsed: finalResult.attemptUsed,
        totalDuration,
        breakdown: {
          detectorCreation: detectorDuration,
          totalAttempts: finalResult.attemptNumber
        }
      }
    });

    // Optionally return all candidates
    if (options.returnAllCandidates) {
      // Re-run detection on final text to get all candidates
      const finalDetector = await createLanguageDetector();
      const allResults = await finalDetector.detect(textsToTry[finalResult.attemptNumber - 1].text);
      finalDetector.destroy();

      finalResult.allCandidates = allResults.map(r => ({
        language: normalizeLanguageCode(r.detectedLanguage),
        languageName: getLanguageName(r.detectedLanguage),
        confidence: r.confidence
      }));
    }

    return finalResult;
  } catch (error) {
    // Cleanup detector
    detector.destroy();

    const duration = Date.now() - operationStart;

    logger.system.error('Language detection failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        primaryTextLength: text.length,
        fallbacksAvailable: fallbackTexts.length,
        duration
      }
    });

    throw new AIModelError('Language detection failed', error);
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

          return { language: 'unknown', confidence: 0, method: 'error' };
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

        return { language: 'unknown', confidence: 0, method: 'promise-rejected' };
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

    throw new AIModelError('Batch language detection failed', error);
  }
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
