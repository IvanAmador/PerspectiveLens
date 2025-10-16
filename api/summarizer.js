/**
 * Professional Summarizer API wrapper for PerspectiveLens
 * Handles summarization using Chrome's built-in Summarizer API (Gemini Nano)
 * Automatically handles language translation for optimal results
 * 
 * Supported types:
 * - key-points: Bullet point list (3/5/7 points based on length)
 * - tl;dr: Short summary (1/3/5 sentences)
 * - teaser: Engaging preview (1/3/5 sentences)
 * - headline: Article title (12/17/22 words)
 * 
 * Supported lengths: short, medium, long (default)
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

/**
 * Summarizer API configuration constants
 * Reference: https://developer.chrome.com/docs/ai/summarizer-api#api_functions
 */
const SUMMARIZER_CONFIG = {
  TYPES: ['key-points', 'tl;dr', 'teaser', 'headline'],
  LENGTHS: ['short', 'medium', 'long'],
  FORMATS: ['markdown', 'plain-text'],
  
  // Type specifications per documentation
  TYPE_SPECS: {
    'tl;dr': { short: '1 sentence', medium: '3 sentences', long: '5 sentences' },
    'teaser': { short: '1 sentence', medium: '3 sentences', long: '5 sentences' },
    'key-points': { short: '3 bullet points', medium: '5 bullet points', long: '7 bullet points' },
    'headline': { short: '12 words', medium: '17 words', long: '22 words' }
  },
  
  // Minimum text length for meaningful summarization
  MIN_TEXT_LENGTH: 50,
  
  // Preferred language for best results
  PREFERRED_LANGUAGE: getPromptAPIPreferredLanguage()
};

/**
 * Check if Summarizer API is available
 * Reference: https://developer.chrome.com/docs/ai/summarizer-api#model_download
 * 
 * @returns {Promise<string>} Availability status: 'available', 'downloading', 'downloadable', 'unavailable'
 * @throws {AIModelError} If API is not supported
 */
export async function checkSummarizerAvailability() {
  logger.system.debug('Checking Summarizer API availability', {
    category: logger.CATEGORIES.COMPRESS
  });

  try {
    if (typeof self.Summarizer === 'undefined') {
      logger.system.error('Summarizer API not available in browser', {
        category: logger.CATEGORIES.COMPRESS,
        data: { requiredChrome: '138+' }
      });
      throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED, {
        reason: 'Summarizer API not available (requires Chrome 138+)'
      });
    }

    const availability = await self.Summarizer.availability();
    
    logger.system.info('Summarizer API availability checked', {
      category: logger.CATEGORIES.COMPRESS,
      data: { availability }
    });

    return availability;
  } catch (error) {
    logger.system.error('Failed to check Summarizer availability', {
      category: logger.CATEGORIES.ERROR,
      error
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError('Failed to check summarizer availability', error);
  }
}

/**
 * Create a summarizer instance with specified configuration
 * Reference: https://developer.chrome.com/docs/ai/summarizer-api#api_functions
 * 
 * @param {Object} options - Summarizer configuration
 * @param {string} options.type - Summary type: 'key-points', 'tl;dr', 'teaser', 'headline'
 * @param {string} options.length - Summary length: 'short', 'medium', 'long'
 * @param {string} options.format - Output format: 'markdown', 'plain-text'
 * @param {string} options.sharedContext - Additional context to help summarizer
 * @param {Function} onProgress - Progress callback for model download
 * @returns {Promise<Object>} Summarizer instance
 * @throws {AIModelError} If creation fails
 */
export async function createSummarizer(options = {}, onProgress = null) {
  const startTime = Date.now();
  
  logger.system.info('Creating Summarizer instance', {
    category: logger.CATEGORIES.COMPRESS,
    data: {
      type: options.type,
      length: options.length,
      format: options.format,
      hasSharedContext: !!options.sharedContext
    }
  });

  try {
    // Check availability
    const availability = await checkSummarizerAvailability();
    
    if (availability === 'unavailable') {
      throw new AIModelError('Summarizer is not available on this device');
    }

    // Validate and set defaults
    const config = {
      type: options.type || 'key-points',
      length: options.length || 'long',
      format: options.format || 'plain-text',
      sharedContext: options.sharedContext || ''
    };

    // Validate parameters against API specs
    if (!SUMMARIZER_CONFIG.TYPES.includes(config.type)) {
      throw new AIModelError(
        `Invalid summary type: ${config.type}. Must be one of: ${SUMMARIZER_CONFIG.TYPES.join(', ')}`
      );
    }

    if (!SUMMARIZER_CONFIG.LENGTHS.includes(config.length)) {
      throw new AIModelError(
        `Invalid summary length: ${config.length}. Must be one of: ${SUMMARIZER_CONFIG.LENGTHS.join(', ')}`
      );
    }

    if (!SUMMARIZER_CONFIG.FORMATS.includes(config.format)) {
      throw new AIModelError(
        `Invalid summary format: ${config.format}. Must be one of: ${SUMMARIZER_CONFIG.FORMATS.join(', ')}`
      );
    }

    logger.system.debug('Summarizer configuration validated', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        ...config,
        expectedOutput: SUMMARIZER_CONFIG.TYPE_SPECS[config.type][config.length]
      }
    });

    // Add download monitor if callback provided
    if (onProgress && (availability === 'downloadable' || availability === 'downloading')) {
      config.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          const progress = Math.round(e.loaded * 100);
          
          logger.system.debug('Summarizer model download progress', {
            category: logger.CATEGORIES.COMPRESS,
            data: { progress, loaded: e.loaded }
          });
          
          onProgress(progress);
        });
      };
      
      logger.system.info('Download monitor attached', {
        category: logger.CATEGORIES.COMPRESS
      });
    }

    // Create summarizer
    const summarizer = await self.Summarizer.create(config);
    
    const duration = Date.now() - startTime;
    
    logger.system.info('Summarizer created successfully', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        type: config.type,
        length: config.length,
        format: config.format,
        duration
      }
    });

    return summarizer;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.system.error('Failed to create summarizer', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { duration, config: options }
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError('Failed to create summarizer', error);
  }
}

/**
 * Summarize text with automatic language handling
 * Translates to English for processing, then optionally back to original language
 * 
 * @param {string} text - Text to summarize
 * @param {Object} options - Summarization options
 * @param {string} options.type - Summary type (default: 'key-points')
 * @param {string} options.length - Summary length (default: 'long')
 * @param {string} options.format - Output format (default: 'plain-text')
 * @param {string} options.language - Source language (auto-detects if not provided)
 * @param {boolean} options.translateBack - Translate result back to source language (default: true)
 * @param {string} options.context - Additional context for summarization
 * @returns {Promise<string>} Summary text
 * @throws {AIModelError} If summarization fails
 */
export async function summarize(text, options = {}) {
  const operationStart = Date.now();
  
  // Validation
  if (!text || text.trim().length === 0) {
    logger.system.error('Empty text provided for summarization', {
      category: logger.CATEGORIES.COMPRESS
    });
    throw new AIModelError('Text is required for summarization');
  }

  if (text.length < SUMMARIZER_CONFIG.MIN_TEXT_LENGTH) {
    logger.system.warn('Text is very short for summarization', {
      category: logger.CATEGORIES.COMPRESS,
      data: { textLength: text.length, minLength: SUMMARIZER_CONFIG.MIN_TEXT_LENGTH }
    });
  }

  logger.system.info('Starting text summarization', {
    category: logger.CATEGORIES.COMPRESS,
    data: {
      textLength: text.length,
      type: options.type || 'key-points',
      length: options.length || 'long',
      format: options.format || 'plain-text'
    }
  });

  try {
    // Step 1: Detect and normalize language
    let sourceLanguage;
    if (options.language) {
      sourceLanguage = normalizeLanguageCode(options.language);
      logger.system.debug('Using provided language', {
        category: logger.CATEGORIES.COMPRESS,
        data: { provided: options.language, normalized: sourceLanguage }
      });
    } else {
      logger.system.debug('Auto-detecting language', {
        category: logger.CATEGORIES.COMPRESS
      });
      sourceLanguage = await detectLanguageSimple(text);
      logger.system.debug('Language detected', {
        category: logger.CATEGORIES.COMPRESS,
        data: { language: sourceLanguage }
      });
    }

    // Step 2: Translate to English if needed (Summarizer works best with English)
    let textForSummarizer = text;
    const needsTranslationToEnglish = needsTranslation(
      sourceLanguage, 
      SUMMARIZER_CONFIG.PREFERRED_LANGUAGE
    );

    if (needsTranslationToEnglish) {
      logger.system.info('Translating text for summarization', {
        category: logger.CATEGORIES.COMPRESS,
        data: {
          from: sourceLanguage,
          to: SUMMARIZER_CONFIG.PREFERRED_LANGUAGE,
          length: text.length
        }
      });

      const translationStart = Date.now();
      textForSummarizer = await translate(
        text, 
        sourceLanguage, 
        SUMMARIZER_CONFIG.PREFERRED_LANGUAGE
      );
      const translationDuration = Date.now() - translationStart;

      logger.system.debug('Translation completed', {
        category: logger.CATEGORIES.COMPRESS,
        data: {
          originalLength: text.length,
          translatedLength: textForSummarizer.length,
          duration: translationDuration
        }
      });
    } else {
      logger.system.debug('No translation needed', {
        category: logger.CATEGORIES.COMPRESS,
        data: { language: sourceLanguage }
      });
    }

    // Step 3: Create summarizer and generate summary
    const summarizerConfig = {
      type: options.type || 'key-points',
      length: options.length || 'long',
      format: options.format || 'plain-text',
      sharedContext: options.sharedContext || options.context || ''
    };

    logger.system.debug('Creating summarizer with config', {
      category: logger.CATEGORIES.COMPRESS,
      data: summarizerConfig
    });

    const summarizer = await createSummarizer(summarizerConfig, options.onProgress);

    // Execute summarization
    logger.system.debug('Executing summarization', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        inputLength: textForSummarizer.length,
        type: summarizerConfig.type,
        expectedOutput: SUMMARIZER_CONFIG.TYPE_SPECS[summarizerConfig.type][summarizerConfig.length]
      }
    });

    const summarizationStart = Date.now();
    const summaryInEnglish = await summarizer.summarize(textForSummarizer, {
      context: options.context || ''
    });
    const summarizationDuration = Date.now() - summarizationStart;

    // Cleanup
    summarizer.destroy();

    const compressionRatio = ((1 - summaryInEnglish.length / text.length) * 100).toFixed(1);

    logger.system.info('Summary generated successfully', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        originalLength: text.length,
        summaryLength: summaryInEnglish.length,
        compressionRatio: `${compressionRatio}%`,
        duration: summarizationDuration
      }
    });

    // Step 4: Translate back to source language if needed
    const shouldTranslateBack = options.translateBack !== false; // Default true

    if (shouldTranslateBack && needsTranslationToEnglish) {
      logger.system.info('Translating summary back to original language', {
        category: logger.CATEGORIES.COMPRESS,
        data: {
          from: SUMMARIZER_CONFIG.PREFERRED_LANGUAGE,
          to: sourceLanguage,
          length: summaryInEnglish.length
        }
      });

      const backTranslationStart = Date.now();
      const translatedSummary = await translate(
        summaryInEnglish, 
        SUMMARIZER_CONFIG.PREFERRED_LANGUAGE, 
        sourceLanguage
      );
      const backTranslationDuration = Date.now() - backTranslationStart;

      const totalDuration = Date.now() - operationStart;

      logger.system.info('Summarization completed with back-translation', {
        category: logger.CATEGORIES.COMPRESS,
        data: {
          totalDuration,
          breakdown: {
            forwardTranslation: needsTranslationToEnglish ? 'included' : 'skipped',
            summarization: summarizationDuration,
            backTranslation: backTranslationDuration
          }
        }
      });

      return translatedSummary;
    }

    const totalDuration = Date.now() - operationStart;

    logger.system.info('Summarization completed', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        totalDuration,
        wasTranslated: needsTranslationToEnglish,
        returnLanguage: SUMMARIZER_CONFIG.PREFERRED_LANGUAGE
      }
    });

    // Return summary in English
    return summaryInEnglish;
  } catch (error) {
    const duration = Date.now() - operationStart;
    
    logger.system.error('Summarization failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        textLength: text.length,
        duration,
        options
      }
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError('Failed to summarize text', error);
  }
}

/**
 * Compress article content for comparative analysis
 * Optimized for fitting multiple articles in context window
 * Uses 'key-points' format for concise summaries
 * 
 * @param {string} text - Full article text
 * @param {Object} options - Compression options
 * @param {string} options.source - Source name for logging
 * @param {string} options.length - Summary length (default: 'long')
 * @returns {Promise<string>} Compressed article summary
 */
export async function compressForAnalysis(text, options = {}) {
  const { source = 'Unknown', length = 'long' } = options;
  
  // Validation
  if (!text || text.trim().length === 0) {
    logger.system.warn('Empty content for compression', {
      category: logger.CATEGORIES.COMPRESS,
      data: { source }
    });
    return '';
  }

  // Skip compression if text is already short
  if (text.length < 500) {
    logger.system.debug('Text already short, skipping compression', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        source,
        textLength: text.length,
        threshold: 500
      }
    });
    return text;
  }

  logger.system.info('Compressing content for analysis', {
    category: logger.CATEGORIES.COMPRESS,
    data: {
      source,
      originalLength: text.length,
      targetLength: length
    }
  });

  try {
    const summary = await summarize(text, {
      type: 'key-points',      // Concise bullet points
      length: length,          // Configurable
      format: 'plain-text',    // No markdown needed for analysis
      translateBack: false,    // Keep in English for Prompt API
      sharedContext: 'News article for comparative analysis'
    });

    const compressionRatio = ((1 - summary.length / text.length) * 100).toFixed(1);

    logger.system.info('Content compressed successfully', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        source,
        originalLength: text.length,
        compressedLength: summary.length,
        reduction: `${compressionRatio}%`
      }
    });

    return summary;
  } catch (error) {
    logger.system.error('Compression failed, using fallback', {
      category: logger.CATEGORIES.COMPRESS,
      error,
      data: { source }
    });

    // Fallback: return truncated original text
    const fallbackLength = 1500;
    const fallback = text.substring(0, fallbackLength) + (text.length > fallbackLength ? '...' : '');
    
    logger.system.warn('Using truncation fallback', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        source,
        fallbackLength: fallback.length,
        method: 'truncation'
      }
    });

    return fallback;
  }
}

/**
 * Batch compress multiple articles for comparative analysis
 * Efficiently processes array of articles with validation
 * 
 * @param {Array<Object>} articles - Array of article objects with extractedContent
 * @param {string} lengthOption - Summary length for all articles (default: 'long')
 * @returns {Promise<Object>} Result object with articles and statistics
 */
export async function batchCompressForAnalysis(articles, lengthOption = 'long') {
  const operationStart = Date.now();
  
  if (!Array.isArray(articles) || articles.length === 0) {
    logger.system.warn('No articles provided for batch compression', {
      category: logger.CATEGORIES.COMPRESS
    });
    return {
      articles: [],
      successful: 0,
      failed: 0,
      originalLength: 0,
      compressedLength: 0,
      duration: 0
    };
  }

  logger.system.info('Starting batch compression', {
    category: logger.CATEGORIES.COMPRESS,
    data: {
      articlesCount: articles.length,
      length: lengthOption
    }
  });

  try {
    const results = await Promise.allSettled(
      articles.map(async (article, index) => {
        const content = article.extractedContent?.textContent || article.content || '';
        const source = article.source || `Article ${index + 1}`;

        if (!content) {
          logger.system.warn('No content available for compression', {
            category: logger.CATEGORIES.COMPRESS,
            data: { source, index }
          });

          return {
            ...article,
            compressedContent: '',
            compressionFailed: true,
            compressionError: 'No content available'
          };
        }

        logger.system.debug('Compressing article', {
          category: logger.CATEGORIES.COMPRESS,
          data: {
            index: index + 1,
            total: articles.length,
            source,
            contentLength: content.length
          }
        });

        const compressed = await compressForAnalysis(content, {
          source,
          length: lengthOption
        });

        const compressionRatio = content.length > 0 
          ? ((1 - compressed.length / content.length) * 100).toFixed(1)
          : '0';

        return {
          ...article,
          compressedContent: compressed,
          originalContentLength: content.length,
          compressedContentLength: compressed.length,
          compressionRatio: parseFloat(compressionRatio),
          compressionFailed: false
        };
      })
    );

    // Process results
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failedResults = results.filter(r => r.status === 'rejected');

    // Calculate statistics
    const successful = successfulResults.filter(a => !a.compressionFailed).length;
    const failed = successfulResults.filter(a => a.compressionFailed).length + failedResults.length;

    const originalLength = successfulResults.reduce(
      (sum, a) => sum + (a.originalContentLength || 0), 
      0
    );

    const compressedLength = successfulResults.reduce(
      (sum, a) => sum + (a.compressedContentLength || 0), 
      0
    );

    const duration = Date.now() - operationStart;
    const overallRatio = originalLength > 0 
      ? ((1 - compressedLength / originalLength) * 100).toFixed(1)
      : '0';

    logger.system.info('Batch compression completed', {
      category: logger.CATEGORIES.COMPRESS,
      data: {
        total: articles.length,
        successful,
        failed,
        originalLength,
        compressedLength,
        reduction: `${overallRatio}%`,
        duration,
        avgPerArticle: Math.round(duration / articles.length)
      }
    });

    if (failedResults.length > 0) {
      logger.system.warn('Some compressions failed', {
        category: logger.CATEGORIES.COMPRESS,
        data: {
          failedCount: failedResults.length,
          errors: failedResults.map(f => f.reason?.message || 'Unknown error')
        }
      });
    }

    return {
      articles: successfulResults,
      successful,
      failed,
      originalLength,
      compressedLength,
      compressionRatio: parseFloat(overallRatio),
      duration,
      statistics: {
        avgOriginalLength: Math.round(originalLength / articles.length),
        avgCompressedLength: Math.round(compressedLength / successfulResults.length),
        avgCompressionRatio: parseFloat(overallRatio),
        avgDurationPerArticle: Math.round(duration / articles.length)
      }
    };
  } catch (error) {
    const duration = Date.now() - operationStart;
    
    logger.system.error('Batch compression failed catastrophically', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        articlesCount: articles.length,
        duration
      }
    });

    throw new AIModelError('Failed to batch compress articles', error);
  }
}

/**
 * Generate a headline for an article
 * Convenience function for headline generation
 * 
 * @param {string} text - Article text or excerpt
 * @param {Object} options - Options (language, translateBack, length)
 * @returns {Promise<string>} Generated headline
 */
export async function generateHeadline(text, options = {}) {
  logger.system.info('Generating headline', {
    category: logger.CATEGORIES.COMPRESS,
    data: { textLength: text.length }
  });

  return await summarize(text, {
    ...options,
    type: 'headline',
    length: options.length || 'short',
    format: 'plain-text'
  });
}

/**
 * Generate key points for an article
 * Convenience function for bullet points
 * 
 * @param {string} text - Article text
 * @param {Object} options - Options (length, language, translateBack)
 * @returns {Promise<string>} Key points in plain-text format
 */
export async function generateKeyPoints(text, options = {}) {
  logger.system.info('Generating key points', {
    category: logger.CATEGORIES.COMPRESS,
    data: { textLength: text.length }
  });

  return await summarize(text, {
    ...options,
    type: 'key-points',
    format: 'plain-text'
  });
}

/**
 * Generate a teaser for an article
 * Convenience function for engaging preview
 * 
 * @param {string} text - Article text
 * @param {Object} options - Options (length, language, translateBack)
 * @returns {Promise<string>} Teaser text
 */
export async function generateTeaser(text, options = {}) {
  logger.system.info('Generating teaser', {
    category: logger.CATEGORIES.COMPRESS,
    data: { textLength: text.length }
  });

  return await summarize(text, {
    ...options,
    type: 'teaser',
    length: options.length || 'short',
    format: 'plain-text'
  });
}

/**
 * Get supported summarization types
 * @returns {Array<string>} Supported types
 */
export function getSupportedTypes() {
  return [...SUMMARIZER_CONFIG.TYPES];
}

/**
 * Get supported summary lengths
 * @returns {Array<string>} Supported lengths
 */
export function getSupportedLengths() {
  return [...SUMMARIZER_CONFIG.LENGTHS];
}

/**
 * Get supported output formats
 * @returns {Array<string>} Supported formats
 */
export function getSupportedFormats() {
  return [...SUMMARIZER_CONFIG.FORMATS];
}

/**
 * Get type specifications (expected output per type/length)
 * @returns {Object} Type specifications
 */
export function getTypeSpecifications() {
  return { ...SUMMARIZER_CONFIG.TYPE_SPECS };
}
