/**
 * Gemini API Wrapper
 * Unified interface for Gemini API models (2.5 Pro, 2.5 Flash, 2.5 Flash Lite)
 *
 * Key features:
 * - Multi-model support (Pro, Flash, Flash Lite)
 * - Processes multi-language content directly (no translation needed)
 * - Handles full article content (no compression needed)
 * - Supports thinking capabilities for deeper reasoning
 * - Uses structured output with JSON schemas
 * - Reactive rate limiting (throws on 429, no automatic retry)
 *
 * @module api/geminiAPI
 */

import { logger } from '../utils/logger.js';
import { getModelPrompt } from '../utils/prompts.js';
import { prepareForPro, validateArticleContent } from '../utils/contentPreparation.js';

// JSON Schemas for each stage (converted from JSON Schema to Gemini API format)
const STAGE_SCHEMAS = {
  1: {
    type: 'OBJECT',
    properties: {
      story_summary: {
        type: 'STRING',
        description: 'One sentence neutral summary of what happened. Stick to basic undisputed facts only. Maximum 25 words.'
      },
      trust_signal: {
        type: 'STRING',
        enum: ['high_agreement', 'some_conflicts', 'major_disputes'],
        description: 'Overall agreement level'
      },
      reader_action: {
        type: 'STRING',
        description: 'One clear sentence telling reader what to do. Maximum 20 words.'
      }
    },
    required: ['story_summary', 'trust_signal', 'reader_action']
  },
  2: {
    type: 'OBJECT',
    properties: {
      consensus: {
        type: 'ARRAY',
        description: 'Facts that all or most sources agree on. Maximum 4 facts.',
        items: {
          type: 'OBJECT',
          properties: {
            fact: {
              type: 'STRING',
              description: 'A factual statement agreed upon by sources. Maximum 30 words.'
            },
            sources: {
              type: 'ARRAY',
              description: 'List of source names that confirm this fact',
              items: { type: 'STRING' }
            }
          },
          required: ['fact', 'sources']
        }
      }
    },
    required: ['consensus']
  },
  3: {
    type: 'OBJECT',
    properties: {
      factual_disputes: {
        type: 'ARRAY',
        description: 'REAL contradictions on facts (numbers, dates, quotes). Empty array [] if none. Max 3.',
        items: {
          type: 'OBJECT',
          properties: {
            what: {
              type: 'STRING',
              description: 'What is disputed. Max 8 words.'
            },
            claim_a: {
              type: 'STRING',
              description: 'First claim with specific numbers/dates. Max 25 words.'
            },
            claim_b: {
              type: 'STRING',
              description: 'Conflicting claim with specific numbers/dates. Max 25 words.'
            },
            sources_a: {
              type: 'ARRAY',
              description: 'Exact SOURCE NAMES making claim A',
              items: { type: 'STRING' }
            },
            sources_b: {
              type: 'ARRAY',
              description: 'Exact SOURCE NAMES making claim B',
              items: { type: 'STRING' }
            }
          },
          required: ['what', 'claim_a', 'claim_b', 'sources_a', 'sources_b']
        }
      }
    },
    required: ['factual_disputes']
  },
  4: {
    type: 'OBJECT',
    properties: {
      coverage_angles: {
        type: 'ARRAY',
        description: 'Different angles or approaches in coverage. Maximum 3 angles.',
        items: {
          type: 'OBJECT',
          properties: {
            angle: {
              type: 'STRING',
              description: 'What differs between sources. Maximum 5 words.'
            },
            group1: {
              type: 'STRING',
              description: 'First approach/focus. Maximum 15 words.'
            },
            group1_sources: {
              type: 'ARRAY',
              description: 'Sources using first approach',
              items: { type: 'STRING' }
            },
            group2: {
              type: 'STRING',
              description: 'Second approach/focus. Maximum 15 words.'
            },
            group2_sources: {
              type: 'ARRAY',
              description: 'Sources using second approach',
              items: { type: 'STRING' }
            }
          },
          required: ['angle', 'group1', 'group1_sources', 'group2', 'group2_sources']
        }
      }
    },
    required: ['coverage_angles']
  }
};

/**
 * Gemini API Client
 * Supports multiple Gemini models via Google AI Studio API
 */
class GeminiAPI {
  /**
   * Creates a new Gemini API client
   *
   * @param {string} apiKey - Google AI Studio API key
   * @param {string} modelName - Model to use ('gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite')
   * @param {Object} config - Configuration options
   * @param {number} config.temperature - Temperature for generation (default: 0.7)
   * @param {number} config.topK - Top-K for sampling (default: 40)
   * @param {number} config.topP - Top-P for sampling (default: 0.95)
   * @param {number} config.thinkingBudget - Thinking token budget (default: -1 for dynamic, 0 for disabled)
   * @param {boolean} config.includeThoughts - Include thought summaries in response (default: false)
   */
  constructor(apiKey, modelName, config = {}) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!modelName) {
      throw new Error('Model name is required');
    }

    this.apiKey = apiKey;
    this.model = modelName;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.temperature = config.temperature ?? 0.7;
    this.topK = config.topK ?? 40;
    this.topP = config.topP ?? 0.95;
    this.thinkingBudget = config.thinkingBudget ?? -1; // -1 = dynamic, 0 = disabled
    this.includeThoughts = config.includeThoughts ?? false;

    logger.system.debug('Gemini API initialized', {
      category: logger.CATEGORIES.GENERAL,
      model: this.model,
      thinkingBudget: this.thinkingBudget
    });
  }

  /**
   * Checks API availability by validating the API key
   *
   * @returns {Promise<'ready'|'invalid-key'|'network-error'>}
   */
  async checkAvailability() {
    if (!this.apiKey) {
      logger.system.warn('No API key provided', {
        category: logger.CATEGORIES.VALIDATE
      });
      return 'invalid-key';
    }

    try {
      const response = await fetch(`${this.baseUrl}/${this.model}`, {
        method: 'GET',
        headers: {
          'x-goog-api-key': this.apiKey
        }
      });

      if (response.ok) {
        logger.system.info('Gemini API is ready', {
          category: logger.CATEGORIES.VALIDATE,
          model: this.model
        });
        return 'ready';
      }

      if (response.status === 400 || response.status === 403) {
        logger.system.warn('Invalid API key', {
          category: logger.CATEGORIES.VALIDATE,
          status: response.status
        });
        return 'invalid-key';
      }

      logger.system.error('API availability check failed', {
        category: logger.CATEGORIES.ERROR,
        status: response.status
      });
      return 'network-error';

    } catch (error) {
      logger.system.error('API availability check error', {
        category: logger.CATEGORIES.ERROR,
        error
      });
      return 'network-error';
    }
  }

  /**
   * Performs progressive comparative analysis in 4 stages
   * Compatible with languageModel.js interface
   *
   * @param {Array} articles - Array of article objects with content, title, source, country
   * @param {Function} onStageComplete - Callback for each completed stage
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Complete analysis results
   * @throws {Error} Throws on 429 rate limit (for ModelRouter to handle)
   */
  async compareArticlesProgressive(articles, onStageComplete, options = {}) {
    const startTime = Date.now();

    logger.system.info('Starting progressive analysis with Gemini API', {
      category: logger.CATEGORIES.ANALYZE,
      articlesCount: articles.length,
      model: this.model
    });

    // Validate article content before processing
    const validation = validateArticleContent(articles, 'pro');
    if (!validation.valid) {
      const error = new Error(`Articles missing content: ${validation.missingContent.length} articles have no content`);
      logger.system.error('Article content validation failed', {
        category: logger.CATEGORIES.ERROR,
        error,
        missingCount: validation.missingContent.length
      });
      throw error;
    }

    const stages = [
      { id: 1, name: 'context-trust', critical: true },
      { id: 2, name: 'consensus', critical: true },
      { id: 3, name: 'disputes', critical: false },
      { id: 4, name: 'perspectives', critical: false }
    ];

    const results = {};
    const stageMetadata = [];

    for (const stage of stages) {
      const stageStart = Date.now();

      try {
        logger.system.debug(`Executing stage ${stage.id}: ${stage.name}`, {
          category: logger.CATEGORIES.ANALYZE
        });

        const stageResult = await this._executeStage(stage.id, articles);
        results[this._getResultKey(stage.id)] = stageResult;

        const duration = Date.now() - stageStart;
        stageMetadata.push({
          stage: stage.id,
          name: stage.name,
          duration,
          success: true
        });

        logger.system.info(`Stage ${stage.id} completed`, {
          category: logger.CATEGORIES.ANALYZE,
          duration
        });

        // Callback for UI updates
        if (onStageComplete) {
          await onStageComplete({
            stage: stage.id,
            name: stage.name,
            result: stageResult,
            duration,
            success: true
          });
        }

      } catch (error) {
        // If it's a rate limit error, propagate immediately (don't mark stage as failed)
        if (error.status === 429) {
          throw error;
        }

        const duration = Date.now() - stageStart;
        stageMetadata.push({
          stage: stage.id,
          name: stage.name,
          duration,
          success: false,
          error: error.message
        });

        logger.system.error(`Stage ${stage.id} failed`, {
          category: logger.CATEGORIES.ERROR,
          error,
          stage: stage.name
        });

        if (onStageComplete) {
          await onStageComplete({
            stage: stage.id,
            name: stage.name,
            error: error.message,
            duration,
            success: false
          });
        }

        // Critical stages must succeed
        if (stage.critical) {
          throw new Error(`Critical stage ${stage.id} failed: ${error.message}`);
        }

        // Non-critical stages: set empty result
        results[this._getResultKey(stage.id)] = this._getEmptyResult(stage.id);
      }
    }

    const totalDuration = Date.now() - startTime;

    logger.system.info('Progressive analysis completed', {
      category: logger.CATEGORIES.ANALYZE,
      totalDuration,
      stages: stageMetadata.length
    });

    const finalResult = {
      ...results,
      metadata: {
        modelProvider: 'gemini-api',
        model: this.model,
        articlesAnalyzed: articles.length,
        totalDuration,
        stages: stageMetadata,
        compressionUsed: false,
        thinkingBudget: this.thinkingBudget,
        analysis_timestamp: new Date().toISOString()
      },
      processedArticles: articles.map(article => ({
        source: article.source,
        title: article.title,
        country: article.country,
        language: article.language,
        url: article.url,
        originalContentLength: article.content?.length || 0
      }))
    };

    return finalResult;
  }

  /**
   * Executes a single analysis stage
   *
   * @private
   */
  async _executeStage(stageId, articles) {
    const prompt = await this._buildPrompt(stageId, articles);
    const schema = STAGE_SCHEMAS[stageId];

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: this.temperature,
        topK: this.topK,
        topP: this.topP,
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: {
          thinkingBudget: this.thinkingBudget,
          includeThoughts: this.includeThoughts
        }
      }
    };

    const response = await this._makeRequest(payload);

    // Extract JSON from response
    const text = response.candidates[0].content.parts[0].text;

    try {
      return JSON.parse(text);
    } catch (error) {
      logger.system.error('Failed to parse JSON response', {
        category: logger.CATEGORIES.ERROR,
        error,
        text: text.substring(0, 200)
      });
      throw new Error('Invalid JSON response from API');
    }
  }

  /**
   * Makes HTTP request to Gemini API
   * NO automatic retry on 429 - throws immediately for ModelRouter to handle
   *
   * @private
   * @param {Object} payload - Request payload
   * @param {number} retries - Number of retries for non-429 errors
   * @returns {Promise<Object>} API response
   * @throws {Error} Throws on 429 with status and errorData for ModelRouter
   */
  async _makeRequest(payload, retries = 2) {
    const url = `${this.baseUrl}/${this.model}:generateContent`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();

          // CRITICAL: Handle 429 specially - throw immediately, no retry
          if (response.status === 429) {
            logger.system.warn('Rate limit hit (429)', {
              category: logger.CATEGORIES.ERROR,
              model: this.model,
              status: response.status
            });

            const error = new Error('RATE_LIMIT_EXCEEDED');
            error.status = 429;
            error.errorData = errorData; // Preserve full error response for RateLimitCache
            error.model = this.model;
            throw error;
          }

          // Other errors: continue with retry logic
          const errorMessage = errorData.error?.message || response.statusText;

          logger.system.error('API request failed', {
            category: logger.CATEGORIES.ERROR,
            status: response.status,
            message: errorMessage,
            model: this.model
          });

          throw new Error(`API Error (${response.status}): ${errorMessage}`);
        }

        return await response.json();

      } catch (error) {
        // If it's a rate limit error, propagate immediately
        if (error.status === 429) {
          throw error;
        }

        // For other errors, retry with exponential backoff
        if (attempt === retries) {
          logger.system.error('API request failed after retries', {
            category: logger.CATEGORIES.ERROR,
            error,
            attempts: retries + 1,
            model: this.model
          });
          throw error;
        }

        // Exponential backoff: 1s, 2s
        const delay = Math.pow(2, attempt) * 1000;
        logger.system.warn(`Retrying API request (attempt ${attempt + 2}/${retries + 1})`, {
          category: logger.CATEGORIES.GENERAL,
          delay,
          model: this.model
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Builds prompt for a specific stage using new prompt system
   *
   * @private
   */
  async _buildPrompt(stageId, articles) {
    logger.system.debug('Building prompt for stage', {
      category: logger.CATEGORIES.ANALYZE,
      stageId,
      articlesCount: articles.length,
      model: this.model
    });

    // Prepare article content for API (full text, multi-language)
    const prepared = prepareForPro(articles);

    // Map stage ID to stage name
    const stageNames = {
      1: 'stage1-context-trust',
      2: 'stage2-consensus',
      3: 'stage3-disputes',
      4: 'stage4-perspectives'
    };

    const stageName = stageNames[stageId];

    // Load prompt template for Pro model
    const promptTemplate = await getModelPrompt('pro', stageName);

    // Combine prompt with formatted articles
    const fullPrompt = `${promptTemplate}

# Articles to Analyze

${prepared.formattedText}`;

    logger.system.debug('Prompt built', {
      category: logger.CATEGORIES.ANALYZE,
      stageId,
      stageName,
      promptLength: fullPrompt.length,
      articlesIncluded: prepared.articles.length,
      totalChars: prepared.stats.totalChars,
      model: this.model
    });

    return fullPrompt;
  }

  /**
   * Gets result key name for stage
   *
   * @private
   */
  _getResultKey(stageId) {
    const keys = {
      1: 'stage1',
      2: 'stage2',
      3: 'stage3',
      4: 'stage4'
    };
    return keys[stageId];
  }

  /**
   * Gets empty result for failed non-critical stage
   *
   * @private
   */
  _getEmptyResult(stageId) {
    const emptyResults = {
      1: { story_summary: '', trust_signal: 'some_conflicts', reader_action: 'Analysis incomplete' },
      2: { consensus: [] },
      3: { factual_disputes: [] },
      4: { coverage_angles: [] }
    };
    return emptyResults[stageId];
  }
}

export { GeminiAPI };
