/**
 * Gemini 2.5 Pro API Wrapper
 * Provides interface compatible with existing languageModel.js for Gemini 2.5 Pro API
 *
 * Key differences from Gemini Nano:
 * - Uses REST API instead of Chrome AI
 * - Processes multi-language content directly (no translation needed)
 * - Handles full article content (no compression needed)
 * - Supports thinking capabilities for deeper reasoning
 * - Uses structured output with JSON schemas
 *
 * @module api/gemini-2-5-pro
 */

import { logger } from '../utils/logger.js';

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
 * Gemini 2.5 Pro API Client
 */
class Gemini25ProAPI {
  /**
   * Creates a new Gemini 2.5 Pro API client
   * @param {string} apiKey - Google AI Studio API key
   * @param {Object} config - Configuration options
   * @param {string} config.model - Model to use (default: 'gemini-2.5-pro')
   * @param {number} config.temperature - Temperature for generation (default: 0.7)
   * @param {number} config.topK - Top-K for sampling (default: 40)
   * @param {number} config.topP - Top-P for sampling (default: 0.95)
   * @param {number} config.thinkingBudget - Thinking token budget (default: -1 for dynamic)
   * @param {boolean} config.includeThoughts - Include thought summaries in response (default: false)
   */
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = config.model || 'gemini-2.5-pro';
    this.temperature = config.temperature ?? 0.7;
    this.topK = config.topK ?? 40;
    this.topP = config.topP ?? 0.95;
    this.thinkingBudget = config.thinkingBudget ?? -1; // -1 = dynamic thinking
    this.includeThoughts = config.includeThoughts ?? false;

    logger.system.debug('Gemini 2.5 Pro API initialized', {
      category: logger.CATEGORIES.GENERAL,
      model: this.model,
      thinkingBudget: this.thinkingBudget
    });
  }

  /**
   * Checks API availability by validating the API key
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
        logger.system.info('Gemini 2.5 Pro API is ready', {
          category: logger.CATEGORIES.VALIDATE
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
   */
  async compareArticlesProgressive(articles, onStageComplete, options = {}) {
    const startTime = Date.now();

    logger.system.info('Starting progressive analysis with Gemini 2.5 Pro', {
      category: logger.CATEGORIES.ANALYZE,
      articlesCount: articles.length,
      model: this.model
    });

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

    return {
      ...results,
      metadata: {
        modelProvider: 'gemini-2.5-pro',
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
  }

  /**
   * Executes a single analysis stage
   * @private
   */
  async _executeStage(stageId, articles) {
    const prompt = this._buildPrompt(stageId, articles);
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
   * Makes HTTP request to Gemini API with retry logic
   * @private
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
          const errorMessage = errorData.error?.message || response.statusText;

          logger.system.error('API request failed', {
            category: logger.CATEGORIES.ERROR,
            status: response.status,
            message: errorMessage
          });

          throw new Error(`API Error (${response.status}): ${errorMessage}`);
        }

        return await response.json();

      } catch (error) {
        if (attempt === retries) {
          logger.system.error('API request failed after retries', {
            category: logger.CATEGORIES.ERROR,
            error,
            attempts: retries + 1
          });
          throw error;
        }

        // Exponential backoff: 1s, 2s
        const delay = Math.pow(2, attempt) * 1000;
        logger.system.warn(`Retrying API request (attempt ${attempt + 2}/${retries + 1})`, {
          category: logger.CATEGORIES.GENERAL,
          delay
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Builds prompt for a specific stage
   * @private
   */
  _buildPrompt(stageId, articles) {
    // Format articles - Gemini 2.5 Pro can handle multi-language content directly
    const articlesText = articles.map((article, idx) => `
### Article ${idx + 1}
**Source:** ${article.source} (${article.country})
**Language:** ${article.language}
**Title:** ${article.title}
**Content:**
${article.content}

---
    `).join('\n');

    const prompts = {
      1: `You are analyzing news coverage to help readers quickly assess a story.

${articlesText}

Task: Provide immediate context and trust assessment based on the articles above (in their original languages).

Output JSON with:
1. story_summary: One sentence (max 25 words) - What happened? Use only undisputed facts.
2. trust_signal: Choose ONE:
   - "high_agreement" = sources mostly agree on key facts
   - "some_conflicts" = minor contradictions exist
   - "major_disputes" = significant factual conflicts found
3. reader_action: One sentence (max 20 words) telling reader what to do with this analysis.

Examples of good reader_action:
- "Coverage is consistent across sources"
- "Verify casualty numbers with additional sources"
- "Be aware of different perspectives on this story"

Keep it simple, clear, and actionable. Output ONLY valid JSON in English.`,

      2: `Find consensus facts across these articles (provided in their original languages):

${articlesText}

Task: Identify facts that multiple sources agree on. These validate that the story is real.

Rules:
- Maximum 4 consensus facts
- Each fact must be confirmed by at least 2 sources
- Be specific and concise (max 30 words per fact)
- Use exact source names (e.g., "BBC", "Reuters"), not "Article 1"

Output ONLY valid JSON in English.`,

      3: `Identify REAL factual contradictions across these articles:

${articlesText}

Task: Find direct contradictions on FACTS (numbers, dates, direct quotes). Do NOT include:
- Different opinions or interpretations
- Different emphasis or framing
- Missing vs. present information

Rules:
- Maximum 3 factual disputes
- Each dispute must show conflicting numbers, dates, or quotes
- Use exact source names (e.g., "CNN", "Al Jazeera"), not "Article 2"
- If no real factual disputes exist, return empty array: {"factual_disputes": []}

Output ONLY valid JSON in English.`,

      4: `Analyze how these sources cover the story differently:

${articlesText}

Task: Identify different coverage angles, focuses, or approaches (NOT factual disputes).

Examples of angles:
- Main Focus: "Economic impact" vs "Political implications"
- Tone: "Optimistic outlook" vs "Cautionary stance"
- Context Level: "Detailed background" vs "Brief update"

Rules:
- Maximum 3 coverage angles
- Group sources by their approach (minimum 1 source per group)
- Use exact source names
- If all sources cover story similarly, return empty array: {"coverage_angles": []}

Output ONLY valid JSON in English.`
    };

    return prompts[stageId];
  }

  /**
   * Gets result key name for stage
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

export { Gemini25ProAPI };
