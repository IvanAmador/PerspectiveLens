/**
 * Language Model API wrapper for PerspectiveLens
 * Handles interaction with Chrome's built-in Prompt API (Gemini Nano)
 * 
 * IMPORTANT: This module provides bidirectional translation
 * - Input: Automatically translates to English before processing
 * - Output: Can translate back to user's language if needed
 * 
 * Reference: https://developer.chrome.com/docs/ai/prompt-api
 * Available: Chrome 138+ (Origin Trial), Chrome 140+ (expectedOutputs languages)
 */

import { logger } from '../utils/logger.js';
import { AIModelError, ERROR_MESSAGES } from '../utils/errors.js';
import { getPrompt, loadSchema } from '../utils/prompts.js';
import { detectLanguageSimple } from './languageDetector.js';
import { translate } from './translator.js';
import {
  normalizeLanguageCode,
  getPromptAPIPreferredLanguage,
  getSupportedLanguages,
  needsTranslation
} from '../utils/languages.js';
import {
  filterValidArticles,
  sanitizeContentForAI,
  getContentExcerpt
} from '../utils/contentValidator.js';
import { batchCompressForAnalysis } from './summarizer.js';

// Supported languages for Prompt API output: en, es, ja (Chrome 140+)
const PROMPT_OUTPUT_LANGUAGES = ['en', 'es', 'ja'];

/**
 * Check Prompt API availability
 * Reference: https://developer.chrome.com/docs/ai/prompt-api#model_download
 * 
 * @returns {Promise<string>} 'available', 'downloading', 'downloadable', or 'unavailable'
 * @throws {AIModelError} If API is not supported
 */
export async function checkAvailability() {
  logger.system.debug('Checking Prompt API availability', {
    category: logger.CATEGORIES.GENERAL
  });

  try {
    // Use LanguageModel directly (official API)
    if (typeof self.LanguageModel === 'undefined') {
      logger.system.warn('LanguageModel API not supported in this browser', {
        category: logger.CATEGORIES.GENERAL,
        data: { 
          hasLanguageModel: typeof self.LanguageModel !== 'undefined',
          chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown',
          recommendation: 'Enable chrome://flags/#prompt-api-for-gemini-nano'
        }
      });
      throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED);
    }

    const availability = await self.LanguageModel.availability();
    
    logger.system.info('Prompt API availability checked', {
      category: logger.CATEGORIES.GENERAL,
      data: { availability }
    });

    return availability;
  } catch (error) {
    logger.system.error('Failed to check availability', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { 
        errorName: error.name,
        errorMessage: error.message 
      }
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED, error);
  }
}

/**
 * Get model parameters
 * Reference: https://developer.chrome.com/docs/ai/prompt-api#model_parameters
 * 
 * @returns {Promise<Object>} Model parameters (defaultTopK, maxTopK, defaultTemperature, maxTemperature)
 */
export async function getModelParams() {
  logger.system.debug('Fetching model parameters', {
    category: logger.CATEGORIES.GENERAL
  });

  try {
    if (typeof self.LanguageModel === 'undefined') {
      throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED);
    }

    const params = await self.LanguageModel.params();
    
    logger.system.debug('Model parameters retrieved', {
      category: logger.CATEGORIES.GENERAL,
      data: params
    });

    return params;
  } catch (error) {
    logger.system.error('Failed to get model parameters', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        errorName: error.name,
        errorMessage: error.message
      }
    });
    throw new AIModelError(ERROR_MESSAGES.SESSION_FAILED, error);
  }
}

/**
 * Create a Language Model session with optimal configuration
 * Reference: https://developer.chrome.com/docs/ai/prompt-api#create_a_session
 *
 * Best practices:
 * - Use initialPrompts with system role for context
 * - Set explicit temperature and topK for consistency
 * - Create new session per analysis for best performance
 * - Destroy session immediately after use
 *
 * @param {Object} options - Session options
 * @param {string} options.systemPrompt - System prompt for session context
 * @param {number} options.temperature - Temperature (0-2, higher = more creative)
 * @param {number} options.topK - Top-K sampling (1-128, higher = more diverse)
 * @param {AbortSignal} options.signal - Optional abort signal
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<Object>} Language Model session
 * @throws {AIModelError} If session creation fails
 */
export async function createSession(options = {}, onProgress = null) {
  const sessionStartTime = Date.now();

  logger.system.info('Creating Language Model session', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      hasSystemPrompt: !!options.systemPrompt,
      temperature: options.temperature,
      topK: options.topK
    }
  });

  try {
    if (typeof self.LanguageModel === 'undefined') {
      throw new AIModelError(ERROR_MESSAGES.NOT_SUPPORTED);
    }

    // Get model parameters for defaults
    const params = await getModelParams();

    // Prepare session configuration with optimal defaults
    const sessionConfig = {
      // Use explicit parameters for consistent results
      temperature: options.temperature ?? params.defaultTemperature,
      topK: options.topK ?? params.defaultTopK
    };

    // Add system prompt as initial prompt (best practice for context)
    if (options.systemPrompt) {
      sessionConfig.initialPrompts = [
        { role: 'system', content: options.systemPrompt }
      ];
      logger.system.debug('System prompt configured', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          systemPromptLength: options.systemPrompt.length
        }
      });
    }

    // Add abort signal if provided
    if (options.signal) {
      sessionConfig.signal = options.signal;
      logger.system.trace('Abort signal attached to session', {
        category: logger.CATEGORIES.GENERAL
      });
    }

    // Add download progress monitor
    if (onProgress) {
      sessionConfig.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          const progress = Math.round(e.loaded * 100);
          logger.system.debug('Model download progress', {
            category: logger.CATEGORIES.GENERAL,
            data: { progress, loaded: e.loaded }
          });
          onProgress(progress);
        });
      };
    }

    // Create session using official API
    logger.system.debug('Requesting session from LanguageModel API', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        temperature: sessionConfig.temperature,
        topK: sessionConfig.topK,
        hasSystemPrompt: !!sessionConfig.initialPrompts
      }
    });

    const session = await self.LanguageModel.create(sessionConfig);

    const duration = Date.now() - sessionStartTime;

    logger.system.info('Language Model session created successfully', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        duration,
        inputUsage: session.inputUsage,
        inputQuota: session.inputQuota,
        quotaUsed: `${session.inputUsage}/${session.inputQuota}`
      }
    });

    return session;
  } catch (error) {
    const duration = Date.now() - sessionStartTime;

    logger.system.error('Failed to create session', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        duration,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });

    if (error instanceof AIModelError) throw error;
    throw new AIModelError(ERROR_MESSAGES.SESSION_FAILED, error);
  }
}

/**
 * Compare multiple articles using optimized analysis pipeline
 *
 * Performance optimizations (following Chrome Prompt API best practices):
 * - Creates fresh session per analysis (avoids progressive slowdown)
 * - Uses system prompt in initialPrompts for context setting
 * - Explicit temperature/topK for consistency
 * - Destroys session immediately after use (frees resources)
 * - Validates quota before prompting (prevents quota errors)
 * - Detailed error logging with specific error types
 * - No session cloning (not needed for single-use analysis)
 *
 * Error handling improvements:
 * - Captures specific error types (NotSupportedError, AbortError, QuotaError)
 * - Logs detailed error context (quota, input length, step failed)
 * - Provides user-friendly error messages
 * - Cleans up session even on error
 *
 * @param {Array<Object>} articles - Articles with extracted content
 * @param {Object} options - Analysis options
 * @param {boolean} options.useCompression - Enable content compression (default: true)
 * @param {boolean} options.validateContent - Validate content quality (default: true)
 * @param {number} options.maxArticles - Maximum articles to analyze (default: 8)
 * @param {string} options.compressionLevel - Compression level: 'short'|'medium'|'long' (default: 'long')
 * @param {number} options.temperature - Model temperature 0-2 (default: model default)
 * @param {number} options.topK - Top-K sampling 1-128 (default: model default)
 * @returns {Promise<Object>} Comparative analysis result
 * @throws {AIModelError} If analysis fails
 */
export async function compareArticles(articles, options = {}) {
  const operationStart = Date.now();

  const {
    useCompression = true,
    validateContent = true,
    maxArticles = 8,
    compressionLevel = 'long',
    temperature,
    topK
  } = options;

  logger.system.info('Starting comparative analysis', {
    category: logger.CATEGORIES.ANALYZE,
    data: {
      inputArticles: articles.length,
      config: { useCompression, validateContent, maxArticles, compressionLevel, temperature, topK }
    }
  });

  // Declare variables outside try block to avoid ReferenceError in catch
  let validArticles = articles;
  let articlesToAnalyze = [];
  let processedArticles = [];
  let session = null;

  try {
    // Step 1: Validate content quality

    if (validateContent) {
      logger.system.debug('Validating article content quality', {
        category: logger.CATEGORIES.VALIDATE
      });

      const validationStart = Date.now();
      validArticles = filterValidArticles(articles);
      const validationDuration = Date.now() - validationStart;

      logger.system.info('Content validation completed', {
        category: logger.CATEGORIES.VALIDATE,
        data: {
          input: articles.length,
          valid: validArticles.length,
          invalid: articles.length - validArticles.length,
          successRate: `${((validArticles.length / articles.length) * 100).toFixed(1)}%`,
          duration: validationDuration
        }
      });

      if (validArticles.length === 0) {
        logger.system.error('No valid articles after validation', {
          category: logger.CATEGORIES.VALIDATE,
          data: {
            originalCount: articles.length,
            invalidReasons: articles.map(a => ({
              source: a.source,
              hasContent: !!a.extractedContent,
              contentLength: a.extractedContent?.textContent?.length || 0
            }))
          }
        });
        throw new AIModelError('No valid articles for analysis');
      }
    }

    // Step 2: Limit to max articles
    articlesToAnalyze = validArticles.slice(0, maxArticles);

    if (articlesToAnalyze.length < validArticles.length) {
      logger.system.debug('Articles limited for analysis', {
        category: logger.CATEGORIES.ANALYZE,
        data: {
          available: validArticles.length,
          analyzing: articlesToAnalyze.length,
          maxArticles
        }
      });
    }

    // Step 3: Compress articles (optional but recommended)
    processedArticles = articlesToAnalyze;
    let originalLength = 0;
    let compressedLength = 0;

    if (useCompression) {
      logger.system.info('Starting article compression', {
        category: logger.CATEGORIES.COMPRESS,
        data: { articles: articlesToAnalyze.length, level: compressionLevel }
      });

      const compressionStart = Date.now();

      const compressionResult = await batchCompressForAnalysis(
        articlesToAnalyze,
        compressionLevel
      );

      processedArticles = compressionResult.articles;
      originalLength = compressionResult.originalLength;
      compressedLength = compressionResult.compressedLength;

      const compressionDuration = Date.now() - compressionStart;
      const reductionPercent = ((1 - compressedLength / originalLength) * 100).toFixed(1);

      logger.system.info('Compression completed successfully', {
        category: logger.CATEGORIES.COMPRESS,
        data: {
          originalLength,
          compressedLength,
          reduction: `${reductionPercent}%`,
          duration: compressionDuration,
          successful: compressionResult.successful,
          failed: compressionResult.failed
        }
      });
    } else {
      logger.system.debug('Compression skipped', {
        category: logger.CATEGORIES.COMPRESS
      });
    }

    // Step 4: Prepare analysis input
    logger.system.debug('Preparing analysis input', {
      category: logger.CATEGORIES.ANALYZE
    });

    const analysisInput = prepareAnalysisInput(processedArticles, useCompression);

    logger.system.debug('Analysis input prepared', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        inputLength: analysisInput.length,
        articles: processedArticles.length
      }
    });

    // Step 5: Load JSON Schema for structured output
    logger.system.debug('Loading JSON Schema for structured output', {
      category: logger.CATEGORIES.ANALYZE
    });

    const schema = await loadSchema('comparative-analysis-schema');

    logger.system.debug('Schema loaded successfully', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        schemaType: schema.type,
        requiredFields: schema.required
      }
    });

    // Step 6: Load system prompt template
    logger.system.debug('Loading comparative analysis prompt', {
      category: logger.CATEGORIES.ANALYZE
    });

    const systemPrompt = await getPrompt('comparative-analysis');

    logger.system.debug('System prompt loaded', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        promptLength: systemPrompt.length
      }
    });

    // Step 7: Create session with system prompt and optimal parameters
    logger.system.info('Creating session for analysis', {
      category: logger.CATEGORIES.ANALYZE
    });

    const sessionConfig = {
      systemPrompt,
      // Optimize for structured JSON output (lower temperature = more consistent)
      temperature: temperature ?? 0.8,  // Lower than default (1.0) for factual analysis
      topK: topK ?? 3  // Keep default topK=3 (doesn't impact performance)
    };

    session = await createSession(sessionConfig);

    logger.system.debug('Session ready, prompting model', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        dataChars: analysisInput.length,
        systemChars: systemPrompt.length,
        sessionQuota: `${session.inputUsage}/${session.inputQuota} tokens`,
        temperature: sessionConfig.temperature,
        topK: sessionConfig.topK
      }
    });

    // Step 8: Check quota before prompting (best practice)
    // Note: According to Chrome docs, measureInputUsage() must receive same options as prompt()
    const quotaRemaining = session.inputQuota - session.inputUsage;

    let estimatedInputUsage;
    try {
      // IMPORTANT: Pass responseConstraint to measureInputUsage (required by API)
      estimatedInputUsage = await session.measureInputUsage(analysisInput, {
        responseConstraint: schema
      });
    } catch (measureError) {
      // If measureInputUsage fails, skip quota check (non-critical)
      logger.system.warn('Failed to measure input usage, skipping quota check', {
        category: logger.CATEGORIES.ANALYZE,
        error: measureError,
        data: {
          errorName: measureError.name,
          errorMessage: measureError.message
        }
      });
      estimatedInputUsage = 0; // Assume OK and let prompt() handle quota errors
    }

    logger.system.debug('Checking quota before prompt', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        quotaUsed: session.inputUsage,
        quotaTotal: session.inputQuota,
        quotaRemaining,
        estimatedUsage: estimatedInputUsage,
        willExceed: estimatedInputUsage > 0 && estimatedInputUsage > quotaRemaining
      }
    });

    if (estimatedInputUsage > 0 && estimatedInputUsage > quotaRemaining) {
      logger.system.error('Insufficient quota for analysis', {
        category: logger.CATEGORIES.ANALYZE,
        data: {
          required: estimatedInputUsage,
          available: quotaRemaining,
          deficit: estimatedInputUsage - quotaRemaining
        }
      });
      throw new AIModelError(`Insufficient context quota. Need ${estimatedInputUsage} tokens but only ${quotaRemaining} available. Try analyzing fewer or shorter articles.`);
    }

    // Step 9: Prompt model with structured output constraint
    logger.system.info('Prompting model with data', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        articlesInInput: processedArticles.length,
        inputLength: analysisInput.length,
        schemaRequired: schema.required,
        hasSchema: !!schema,
        quotaBefore: `${session.inputUsage}/${session.inputQuota} tokens`,
        quotaRemaining,
        estimatedUsage: estimatedInputUsage,
        quotaAfterPrompt: `~${(session.inputUsage + estimatedInputUsage)}/${session.inputQuota}`
      }
    });

    const promptStart = Date.now();
    let response;
    try {
      response = await session.prompt(analysisInput, {
        responseConstraint: schema
      });
    } catch (promptError) {
      const promptDuration = Date.now() - promptStart;

      // Log detailed error information
      logger.system.error('Model prompt failed with specific error', {
        category: logger.CATEGORIES.ERROR,
        error: promptError,
        data: {
          errorName: promptError.name,
          errorMessage: promptError.message,
          errorStack: promptError.stack,
          errorCode: promptError.code,
          promptDuration,
          inputLength: analysisInput.length,
          inputChars: analysisInput.length,
          systemPromptLength: systemPrompt.length,
          articlesCount: processedArticles.length,
          quotaUsed: `${session.inputUsage}/${session.inputQuota}`,
          quotaRemaining: session.inputQuota - session.inputUsage,
          estimatedTokens: estimatedInputUsage,
          // System info for debugging UnknownError
          totalInputSize: analysisInput.length + systemPrompt.length,
          compressionUsed: useCompression,
          temperature: sessionConfig.temperature,
          topK: sessionConfig.topK,
          // Check if it's a specific API error
          isUnknownError: promptError.name === 'UnknownError',
          isNotSupportedError: promptError.name === 'NotSupportedError',
          isAbortError: promptError.name === 'AbortError',
          isQuotaError: promptError.message?.includes('quota') || promptError.message?.includes('context'),
          isModelError: promptError.message?.includes('model'),
          isNetworkError: promptError.message?.includes('network') || promptError.message?.includes('connection')
        }
      });

      // Provide user-friendly error messages based on error type
      if (promptError.name === 'NotSupportedError') {
        throw new AIModelError('Model does not support the requested operation. Check if Gemini Nano is properly installed.', promptError);
      } else if (promptError.name === 'AbortError') {
        throw new AIModelError('Analysis was cancelled', promptError);
      } else if (promptError.name === 'UnknownError') {
        // UnknownError is a generic Chrome AI error - often means model crashed or is unavailable
        throw new AIModelError(
          'AI model encountered an unknown error. This usually means:\n' +
          '1. The model process crashed (check chrome://on-device-internals)\n' +
          '2. Try restarting Chrome\n' +
          '3. Ensure you have enough RAM (16GB+ recommended)\n' +
          '4. Check if model is still downloaded (requires 22GB disk space)',
          promptError
        );
      } else if (promptError.message?.includes('quota') || promptError.message?.includes('context')) {
        throw new AIModelError('Context window exceeded. Try analyzing fewer articles or shorter content.', promptError);
      } else if (promptError.message?.includes('model')) {
        throw new AIModelError('Model execution failed. Try restarting Chrome or check chrome://on-device-internals', promptError);
      }

      // Re-throw the error for general handling
      throw promptError;
    }

    const promptDuration = Date.now() - promptStart;

    logger.system.info('Model response received', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        responseChars: response.length,
        promptDuration: `${promptDuration}ms`,
        quotaUsed: `${session.inputUsage}/${session.inputQuota} tokens`,
        quotaRemaining: session.inputQuota - session.inputUsage,
        responsePreview: response.substring(0, 200)
      }
    });

    // Step 9: Parse and validate response
    let analysisResult;
    try {
      analysisResult = JSON.parse(response);

      logger.system.debug('JSON response parsed successfully', {
        category: logger.CATEGORIES.ANALYZE,
        data: {
          hasConsensus: !!analysisResult.consensus,
          consensusItems: analysisResult.consensus?.length || 0,
          hasKeyDifferences: !!analysisResult.key_differences,
          keyDifferencesItems: analysisResult.key_differences?.length || 0,
          hasSummary: !!analysisResult.summary
        }
      });
    } catch (parseError) {
      logger.system.error('Failed to parse JSON response', {
        category: logger.CATEGORIES.ERROR,
        error: parseError,
        data: {
          response: response.substring(0, 500),
          responseLength: response.length,
          parseErrorMessage: parseError.message,
          parseErrorStack: parseError.stack,
          // Check if response looks like markdown or other format
          startsWithMarkdown: response.trim().startsWith('```'),
          containsJson: response.includes('{') && response.includes('}'),
          firstChars: response.substring(0, 100)
        }
      });
      throw new AIModelError('Invalid JSON response from model. Model may have returned unexpected format.', parseError);
    }

    // Step 10: Cleanup session immediately (best practice)
    try {
      session.destroy();

      logger.system.debug('Session destroyed successfully', {
        category: logger.CATEGORIES.ANALYZE
      });
    } catch (destroyError) {
      // Non-critical error, just log it
      logger.system.warn('Failed to destroy session', {
        category: logger.CATEGORIES.ANALYZE,
        error: destroyError,
        data: {
          errorName: destroyError.name,
          errorMessage: destroyError.message
        }
      });
    }

    const duration = Date.now() - operationStart;

    if (!analysisResult.metadata) analysisResult.metadata = {};
    Object.assign(analysisResult.metadata, {
      articlesAnalyzed: processedArticles.length,
      articlesInput: articles.length,
      compressionUsed: useCompression,
      originalLength: originalLength || analysisInput.length,
      compressedLength: compressedLength || analysisInput.length,
      totalInputLength: analysisInput.length,
      promptDuration,
      duration,
      analysis_timestamp: new Date().toISOString()
    });

    logger.system.info('Analysis completed successfully', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        duration,
        promptDuration,
        articlesProcessed: processedArticles.length,
        articlesInput: articles.length,
        resultKeys: Object.keys(analysisResult),
        consensusItems: analysisResult.consensus?.length || 0,
        keyDifferences: analysisResult.key_differences?.length || 0,
        hasSummary: !!analysisResult.summary
      }
    });

    return analysisResult;
  } catch (error) {
    const duration = Date.now() - operationStart;

    // Determine which step failed
    const failedAtStep = !validArticles ? 'validation' :
                        !articlesToAnalyze ? 'limiting' :
                        !processedArticles ? 'compression' :
                        !session ? 'session_creation' :
                        'model_prompt';

    logger.system.error('Comparative analysis failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        articlesInput: articles.length,
        validArticles: validArticles?.length,
        articlesToAnalyze: articlesToAnalyze?.length,
        processedArticles: processedArticles?.length,
        duration,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        failedAtStep,
        // Additional debugging context
        hasSession: !!session,
        sessionQuota: session ? `${session.inputUsage}/${session.inputQuota}` : 'N/A',
        // Identify common error patterns
        isAPIError: error.name?.includes('Error'),
        isModelUnavailable: error.message?.includes('unavailable') || error.message?.includes('not available'),
        isQuotaIssue: error.message?.includes('quota') || error.message?.includes('context'),
        isParseError: error.message?.includes('parse') || error.message?.includes('JSON'),
        isNetworkIssue: error.message?.includes('network') || error.message?.includes('connection')
      }
    });

    // Clean up session if it was created
    if (session) {
      try {
        session.destroy();
        logger.system.debug('Session cleaned up after error', {
          category: logger.CATEGORIES.ANALYZE
        });
      } catch (cleanupError) {
        logger.system.warn('Failed to cleanup session after error', {
          category: logger.CATEGORIES.ANALYZE,
          error: cleanupError
        });
      }
    }

    if (error instanceof AIModelError) throw error;
    throw new AIModelError(ERROR_MESSAGES.PROMPT_FAILED, error);
  }
}

/**
 * Prepare analysis input from articles
 * @param {Array<Object>} articles - Articles to analyze
 * @param {boolean} isCompressed - Whether articles are compressed
 * @returns {string} Formatted input string
 */
function prepareAnalysisInput(articles, isCompressed = false) {
  logger.system.trace('Formatting articles for analysis', {
    category: logger.CATEGORIES.ANALYZE,
    data: { articles: articles.length, compressed: isCompressed }
  });

  const formattedArticles = articles.map((article, index) => {
    const content = isCompressed 
      ? article.compressedContent 
      : sanitizeContentForAI(article.extractedContent?.textContent || '');

    return `[Article ${index + 1}]
Source: ${article.source}
Country: ${article.country}
Title: ${article.title}
Content: ${content}
`;
  });

  return formattedArticles.join('\n---\n\n');
}
