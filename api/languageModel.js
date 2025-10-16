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
import { getPrompt } from '../utils/prompts.js';
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
 * Create a Language Model session with download progress tracking
 * Reference: https://developer.chrome.com/docs/ai/prompt-api#create_a_session
 * 
 * @param {Object} options - Session options
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<Object>} Language Model session
 * @throws {AIModelError} If session creation fails
 */
export async function createSession(options = {}, onProgress = null) {
  const sessionStartTime = Date.now();
  
  logger.system.info('Creating Language Model session', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      hasInitialPrompts: !!options.initialPrompts,
      hasSystemPrompt: options.systemPrompt !== undefined,
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

    // Prepare session configuration
    const sessionConfig = {
      temperature: options.temperature ?? params.defaultTemperature,
      topK: options.topK ?? params.defaultTopK
    };

    // Add initial prompts if provided
    if (options.initialPrompts) {
      sessionConfig.initialPrompts = options.initialPrompts;
      logger.system.debug('Session initialized with prompts', {
        category: logger.CATEGORIES.GENERAL,
        data: { promptCount: options.initialPrompts.length }
      });
    }

    // Add system prompt if provided (as initial prompt)
    if (options.systemPrompt) {
      sessionConfig.initialPrompts = [
        { role: 'system', content: options.systemPrompt },
        ...(sessionConfig.initialPrompts || [])
      ];
      logger.system.debug('System prompt added to session', {
        category: logger.CATEGORIES.GENERAL,
        data: { 
          systemPromptLength: options.systemPrompt.length,
          totalPrompts: sessionConfig.initialPrompts.length 
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
      data: sessionConfig
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
 * Implements content validation, compression, and structured analysis
 * 
 * @param {Array<Object>} articles - Articles with extracted content
 * @param {Object} options - Analysis options
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
    useV2Prompt = true
  } = options;

  logger.system.info('Starting comparative analysis', {
    category: logger.CATEGORIES.ANALYZE,
    data: {
      inputArticles: articles.length,
      config: { useCompression, validateContent, maxArticles, compressionLevel, useV2Prompt }
    }
  });

  try {
    // Step 1: Validate content quality
    let validArticles = articles;
    
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

    // Limit to max articles
    const articlesToAnalyze = validArticles.slice(0, maxArticles);
    
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

    // Step 2: Compress articles (optional but recommended)
    let processedArticles = articlesToAnalyze;
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

    // Step 3: Prepare input for analysis
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

    // Step 4: Load JSON Schema for structured output
    logger.system.trace('Loading JSON Schema for structured output', {
      category: logger.CATEGORIES.ANALYZE
    });

    const schema = await loadAnalysisSchema();

    // Step 5: Load prompt template (NO variables - append data after)
    logger.system.trace('Loading comparative analysis prompt', {
      category: logger.CATEGORIES.ANALYZE
    });

    const promptName = useV2Prompt ? 'comparative-analysis-v2' : 'comparative-analysis';
    const promptTemplate = await getPrompt(promptName);  // ← NO variables!

    // Step 6: Create session and run analysis
    logger.system.info('Creating session for analysis', {
      category: logger.CATEGORIES.ANALYZE
    });

    const session = await createSession();

    // Concatenate prompt + data (don't use variable substitution)
    const fullPrompt = promptTemplate + '\n\n' + analysisInput;
    
    logger.system.debug('Prompting model for comparative analysis', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        promptLength: fullPrompt.length,
        templateLength: promptTemplate.length,
        dataLength: analysisInput.length,
        sessionQuota: `${session.inputUsage}/${session.inputQuota}`
      }
    });

    // Use structured output with JSON Schema
    const response = await session.prompt(fullPrompt, {
      responseConstraint: schema
    });

    // Step 7: Parse and validate response
    logger.system.debug('Parsing analysis response', {
      category: logger.CATEGORIES.ANALYZE,
      data: { responseLength: response.length }
    });

    let analysisResult;
    try {
      analysisResult = JSON.parse(response);
    } catch (parseError) {
      logger.system.error('Failed to parse JSON response', {
        category: logger.CATEGORIES.ERROR,
        error: parseError,
        data: { 
          response: response.substring(0, 500),
          parseErrorMessage: parseError.message
        }
      });
      throw new AIModelError('Invalid JSON response from model', parseError);
    }

    // Cleanup
    session.destroy();

    const duration = Date.now() - operationStart;

    // Step 8: Add metadata
    analysisResult.metadata = {
      articlesAnalyzed: processedArticles.length,
      articlesInput: articles.length,
      compressionUsed: useCompression,
      originalLength: originalLength || analysisInput.length,
      compressedLength: compressedLength || analysisInput.length,
      totalInputLength: analysisInput.length,
      duration,
      timestamp: new Date().toISOString()
    };

    logger.system.info('Analysis completed successfully', {
      category: logger.CATEGORIES.ANALYZE,
      data: {
        consensus: analysisResult.consensus?.length || 0,
        disputes: analysisResult.disputes?.length || 0,
        omissions: Object.keys(analysisResult.omissions || {}).length,
        biasIndicators: analysisResult.bias_indicators?.length || 0,
        duration,
        metadata: analysisResult.metadata
      }
    });

    return analysisResult;
  } catch (error) {
    const duration = Date.now() - operationStart;
    
    logger.system.error('Comparative analysis failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: {
        articlesCount: articles.length,
        duration,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });

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

/**
 * Load JSON Schema for structured analysis output
 * @returns {Promise<Object>} JSON Schema object
 */
async function loadAnalysisSchema() {
  logger.system.trace('Loading analysis JSON Schema', {
    category: logger.CATEGORIES.ANALYZE
  });

  // Schema aligned with prompts/comparative-analysis-schema.json
  // This ensures AI returns data in the expected format
  return {
    type: 'object',
    properties: {
      consensus: {
        type: 'array',
        description: 'Facts that all or most sources agree upon',
        items: {
          type: 'object',
          required: ['fact', 'sources', 'confidence'],
          properties: {
            fact: {
              type: 'string',
              description: 'The agreed-upon fact or statement'
            },
            sources: {
              type: 'array',
              description: 'List of source names that confirm this fact',
              items: { type: 'string' },
              minItems: 2
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Confidence level based on evidence strength'
            }
          }
        }
      },
      disputes: {
        type: 'array',
        description: 'Topics where sources disagree or present conflicting information',
        items: {
          type: 'object',
          required: ['topic', 'perspectives', 'significance'],
          properties: {
            topic: {
              type: 'string',
              description: 'The subject of disagreement'
            },
            perspectives: {
              type: 'object',
              description: 'Map of source names to their viewpoints',
              patternProperties: {
                '.*': {
                  type: 'object',
                  required: ['viewpoint'],
                  properties: {
                    viewpoint: {
                      type: 'string',
                      description: 'The source\'s position on this topic'
                    },
                    evidence: {
                      type: 'string',
                      description: 'Supporting evidence or quotes'
                    }
                  }
                }
              },
              minProperties: 2
            },
            significance: {
              type: 'string',
              enum: ['major', 'minor'],
              description: 'How important this disagreement is to the overall story'
            }
          }
        }
      },
      omissions: {
        type: 'object',
        description: 'Information present in some sources but missing from others',
        patternProperties: {
          '.*': {
            type: 'array',
            description: 'List of facts omitted by this source',
            items: {
              type: 'object',
              required: ['fact', 'mentioned_by', 'relevance'],
              properties: {
                fact: {
                  type: 'string',
                  description: 'The omitted information'
                },
                mentioned_by: {
                  type: 'array',
                  description: 'Sources that included this information',
                  items: { type: 'string' },
                  minItems: 1
                },
                relevance: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'How relevant this omission is to the story'
                }
              }
            }
          }
        }
      },
      bias_indicators: {
        type: 'array',
        description: 'Potential indicators of media bias across sources',
        items: {
          type: 'object',
          required: ['source', 'type', 'description'],
          properties: {
            source: {
              type: 'string',
              description: 'Name of the source showing potential bias'
            },
            type: {
              type: 'string',
              enum: ['framing', 'selection', 'omission', 'tone', 'language'],
              description: 'Type of bias indicator'
            },
            description: {
              type: 'string',
              description: 'Explanation of the bias indicator'
            },
            examples: {
              type: 'array',
              description: 'Specific examples or quotes demonstrating the bias',
              items: { type: 'string' }
            }
          }
        }
      },
      summary: {
        type: 'object',
        description: 'High-level summary of the comparative analysis',
        required: ['main_story', 'key_differences'],
        properties: {
          main_story: {
            type: 'string',
            description: 'One-sentence summary of what all sources are covering'
          },
          key_differences: {
            type: 'string',
            description: 'Brief explanation of how coverage differs across sources'
          },
          recommendation: {
            type: 'string',
            description: 'Suggestion for readers on how to interpret the differences'
          }
        }
      }
    },
    required: ['consensus', 'disputes', 'omissions', 'summary']
  };
}
