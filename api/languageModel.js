/**
 * Language Model API wrapper for PerspectiveLens
 * Handles interaction with Chrome's built-in Prompt API (Gemini Nano)
 *
 * IMPORTANT: This module provides bidirectional translation
 * - Input: Automatically translates to English before processing
 * - Output: Can translate back to user's language if needed
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
const PROMPT_OUTPUT_LANGUAGES = getSupportedLanguages('prompt');

// Preferred language for Prompt API processing (best results)
const PROMPT_PREFERRED_LANGUAGE = getPromptAPIPreferredLanguage();

/**
 * Check if Language Model API is available
 */
export async function checkAvailability() {
  if (typeof LanguageModel === 'undefined') {
    logger.error('LanguageModel API not defined');
    throw new AIModelError(ERROR_MESSAGES.AI_UNAVAILABLE, {
      reason: 'API not available in this Chrome version'
    });
  }

  try {
    const availability = await LanguageModel.availability();
    logger.info('Language Model availability:', availability);
    return availability;
  } catch (error) {
    logger.error('Failed to check availability:', error);
    throw new AIModelError('Failed to check AI model availability', { originalError: error });
  }
}

/**
 * Create a Language Model session with proper configuration
 * @param {Object} options - Session options
 * @param {Function} onProgress - Progress callback for downloads
 */
export async function createSession(options = {}, onProgress = null) {
  const availability = await checkAvailability();

  if (availability === 'unavailable') {
    throw new AIModelError(ERROR_MESSAGES.AI_UNAVAILABLE);
  }

  const sessionConfig = {
    // Support all available languages for input and output
    expectedOutputs: [
      { type: 'text', languages: PROMPT_OUTPUT_LANGUAGES }
    ],
    ...options
  };

  // Add download monitor if callback provided
  if (onProgress && (availability === 'downloadable' || availability === 'downloading')) {
    sessionConfig.monitor = (m) => {
      m.addEventListener('downloadprogress', (e) => {
        const progress = Math.round(e.loaded * 100);
        logger.debug(`Model download progress: ${progress}%`);
        onProgress(progress);
      });
    };
  }

  try {
    logger.info('Creating Language Model session...');
    const session = await LanguageModel.create(sessionConfig);
    logger.info('Session created successfully');
    return session;
  } catch (error) {
    logger.error('Failed to create session:', error);
    throw new AIModelError('Failed to create AI session', { originalError: error });
  }
}

/**
 * Extract keywords from article title using Prompt API
 * Professional implementation with automatic language handling:
 * 1. Auto-detects language if not provided
 * 2. Normalizes language code (e.g., 'pt-br' → 'pt')
 * 3. Translates to English for Prompt API processing
 * 4. Returns keywords in English for NewsAPI compatibility
 *
 * @param {string} title - Article title (any language, any format)
 * @param {string} language - Language code (optional, auto-detects if null)
 * @returns {Promise<Array<string>>} Array of keywords in English
 */
export async function extractKeywords(title, language = null) {
  if (!title || title.trim().length === 0) {
    throw new AIModelError('Title is required for keyword extraction');
  }

  try {
    // Step 1: Detect and normalize language
    let detectedLanguage;
    if (!language) {
      logger.debug('Auto-detecting language for title:', title);
      detectedLanguage = await detectLanguageSimple(title);
      logger.info(`Detected language: ${detectedLanguage}`);
    } else {
      detectedLanguage = normalizeLanguageCode(language);
      logger.info(`Using provided language: ${language} → ${detectedLanguage}`);
    }

    // Step 2: Translate to English if needed (Prompt API works best with English)
    let titleForPrompt = title;
    if (needsTranslation(detectedLanguage, PROMPT_PREFERRED_LANGUAGE)) {
      logger.info(`Translating title: ${detectedLanguage} → ${PROMPT_PREFERRED_LANGUAGE}`);
      titleForPrompt = await translate(title, detectedLanguage, PROMPT_PREFERRED_LANGUAGE);
      logger.debug(`Translated: "${title}" → "${titleForPrompt}"`);
    } else {
      logger.debug(`No translation needed (already in ${detectedLanguage})`);
    }

    // Step 3: Create session and extract keywords
    const session = await createSession();

    try {
      // Load prompt template from file
      const prompt = await getPrompt('keyword-extraction', {
        title: titleForPrompt,
        language: PROMPT_PREFERRED_LANGUAGE
      });

      logger.debug(`Extracting keywords from: "${titleForPrompt}"`);
      const result = await session.prompt(prompt);

      // Parse comma-separated keywords
      const keywords = result
        .trim()
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0)
        .slice(0, 5); // Max 5 keywords

      logger.info(`✅ Extracted ${keywords.length} keywords:`, keywords);

      // Keywords are kept in English for NewsAPI search compatibility
      return keywords;

    } finally {
      session.destroy();
    }

  } catch (error) {
    logger.error('Keyword extraction failed:', error);
    logger.warn('Using fallback keyword extraction');
    // Fallback: simple word extraction
    return fallbackKeywordExtraction(title);
  }
}

/**
 * Fallback keyword extraction using simple heuristics
 */
function fallbackKeywordExtraction(title) {
  logger.warn('Using fallback keyword extraction');

  // Extract capitalized words and proper nouns
  const words = title
    .split(/\s+/)
    .filter(word => {
      // Keep words that start with capital or are all caps
      return word.length > 3 && (
        /^[A-Z][a-z]+/.test(word) ||
        /^[A-Z]+$/.test(word)
      );
    })
    .map(w => w.toLowerCase())
    .slice(0, 5);

  return words.length > 0 ? words : ['news', 'article'];
}

/**
 * Perform comparative analysis of multiple articles with structured JSON output
 * 🚀 OPTIMIZED VERSION with content validation, compression, and error handling
 *
 * Features:
 * - Content validation to filter out JavaScript/invalid extractions
 * - Automatic summarization for long articles (uses Summarizer API)
 * - Smart context window management
 * - JSON Schema constraint for guaranteed structured output
 * - Comprehensive error handling with fallbacks
 *
 * @param {Array} perspectives - Array of article objects with extracted content
 * @param {Object} options - Analysis options
 * @param {boolean} options.useCompression - Use Summarizer API to compress long articles (default: true)
 * @param {boolean} options.validateContent - Validate content quality before analysis (default: true)
 * @param {number} options.maxArticles - Maximum articles to analyze (default: 10)
 * @param {string} options.compressionLevel - Summarization length: 'short', 'medium', 'long' (default: 'long')
 * @param {boolean} options.useV2Prompt - Use enhanced prompt with few-shot examples (default: true)
 * @returns {Promise<Object>} Structured analysis with consensus, disputes, omissions, bias indicators
 */
export async function compareArticles(perspectives, options = {}) {
  const {
    useCompression = true,
    validateContent = true,
    maxArticles = 10,
    compressionLevel = 'long',
    useV2Prompt = true
  } = options;

  if (!perspectives || perspectives.length < 2) {
    throw new AIModelError('At least 2 perspectives required for comparison');
  }

  logger.group('🔍 Starting OPTIMIZED comparative analysis');
  logger.info(`Input: ${perspectives.length} articles`);
  logger.info(`Settings: compression=${useCompression}, validation=${validateContent}, maxArticles=${maxArticles}`);

  try {
    // STEP 1: CONTENT VALIDATION (filter out JS code, bad extractions)
    let validArticles = perspectives;

    if (validateContent) {
      logger.info('📋 Step 1: Validating content quality...');
      validArticles = filterValidArticles(perspectives);

      if (validArticles.length < 2) {
        throw new AIModelError(`Only ${validArticles.length} articles with valid content (need 2+)`);
      }

      logger.info(`✅ Validation: ${validArticles.length}/${perspectives.length} articles passed`);
    }

    // Limit to maxArticles (use highest quality articles)
    if (validArticles.length > maxArticles) {
      logger.info(`Limiting to top ${maxArticles} articles by quality score`);
      validArticles = validArticles
        .sort((a, b) => (b.validation?.score || 0) - (a.validation?.score || 0))
        .slice(0, maxArticles);
    }

    // STEP 2: CONTENT COMPRESSION (reduce token usage 70-80%)
    let processedArticles = validArticles;

    if (useCompression) {
      logger.info('🗜️ Step 2: Compressing articles with Summarizer API...');

      try {
        processedArticles = await batchCompressForAnalysis(validArticles, {
          length: compressionLevel
        });

        if (processedArticles.length < 2) {
          logger.warn('Compression failed for most articles, using original content');
          processedArticles = validArticles;
        } else {
          const totalOriginal = processedArticles.reduce((sum, a) => sum + (a.originalLength || 0), 0);
          const totalCompressed = processedArticles.reduce((sum, a) => sum + (a.compressedLength || 0), 0);
          const overallRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
          logger.info(`✅ Compression: ${totalOriginal} → ${totalCompressed} chars (${overallRatio}% reduction)`);
        }
      } catch (compressionError) {
        logger.error('Compression failed, using original content:', compressionError);
        processedArticles = validArticles;
      }
    }

    // STEP 3: PREPARE INPUT FOR PROMPT API
    logger.info('📝 Step 3: Preparing input for analysis...');

    const perspectivesText = processedArticles
      .map((article, idx) => {
        const source = article.source || article.title?.substring(0, 50) || `Source ${idx + 1}`;

        // Use compressed content if available, otherwise sanitize original
        let content;
        if (article.compressed) {
          content = article.compressed;
        } else {
          const rawContent = article.extractedContent?.textContent || article.content || '';
          content = sanitizeContentForAI(rawContent, 2000);
        }

        if (!content) {
          logger.warn(`No content for ${source}, skipping`);
          return null;
        }

        return `Article ${idx + 1} (${source}):\n${content}`;
      })
      .filter(Boolean) // Remove nulls
      .join('\n\n---\n\n');

    if (!perspectivesText || perspectivesText.length === 0) {
      throw new AIModelError('No valid content after processing');
    }

    const totalInputLength = perspectivesText.length;
    logger.info(`✅ Input prepared: ${totalInputLength} chars for ${processedArticles.length} articles`);

    // Check if input is too large (conservative limit for context window)
    const MAX_SAFE_INPUT = 8000; // Leave room for prompt + schema
    if (totalInputLength > MAX_SAFE_INPUT) {
      logger.warn(`Input too large (${totalInputLength} chars), may cause failures`);
      logger.warn('Consider: reducing maxArticles, using shorter compression, or enabling validation');
    }

    // STEP 4: LOAD JSON SCHEMA
    logger.info('📐 Step 4: Loading JSON Schema...');
    const schemaUrl = chrome.runtime.getURL('prompts/comparative-analysis-schema.json');
    const schemaResponse = await fetch(schemaUrl);
    const jsonSchema = await schemaResponse.json();
    logger.debug('✅ JSON Schema loaded');

    // STEP 5: LOAD PROMPT TEMPLATE
    logger.info('📄 Step 5: Loading prompt template...');
    const promptName = useV2Prompt ? 'comparative-analysis-v2' : 'comparative-analysis';
    const prompt = await getPrompt(promptName, {
      perspectives: perspectivesText
    });
    logger.debug(`✅ Prompt loaded: ${prompt.length} chars`);

    // STEP 6: CREATE SESSION AND RUN ANALYSIS
    logger.info('🤖 Step 6: Running analysis with Gemini Nano...');
    logger.debug(`Total prompt + input: ${prompt.length} chars`);

    const session = await createSession();

    try {
      const result = await session.prompt(prompt, {
        responseConstraint: jsonSchema,
        omitResponseConstraintInput: true // Save tokens
      });

      logger.debug(`✅ Received response: ${result.length} chars`);

      // STEP 7: PARSE AND VALIDATE RESPONSE
      logger.info('🔍 Step 7: Parsing response...');

      const analysis = JSON.parse(result);

      // Validate required fields
      const isValid =
        analysis.consensus &&
        analysis.disputes &&
        analysis.omissions &&
        analysis.summary;

      if (!isValid) {
        logger.warn('Response missing required fields, applying defaults');
        return {
          consensus: analysis.consensus || [],
          disputes: analysis.disputes || [],
          omissions: analysis.omissions || {},
          bias_indicators: analysis.bias_indicators || [],
          summary: analysis.summary || {
            main_story: 'Analysis completed with partial data',
            key_differences: 'Some fields could not be determined'
          },
          metadata: {
            articlesAnalyzed: processedArticles.length,
            compressionUsed: useCompression,
            validationUsed: validateContent
          }
        };
      }

      // SUCCESS! Log summary
      logger.group('✅ Analysis completed successfully');
      logger.info(`Consensus: ${analysis.consensus?.length || 0} points`);
      logger.info(`Disputes: ${analysis.disputes?.length || 0} topics`);
      logger.info(`Omissions: ${Object.keys(analysis.omissions || {}).length} sources`);
      logger.info(`Bias indicators: ${analysis.bias_indicators?.length || 0}`);
      logger.info(`Main story: ${analysis.summary?.main_story?.substring(0, 100)}...`);
      logger.groupEnd();

      logger.groupEnd(); // Close main group

      return {
        ...analysis,
        metadata: {
          articlesAnalyzed: processedArticles.length,
          articlesInput: perspectives.length,
          compressionUsed: useCompression,
          validationUsed: validateContent,
          totalInputLength,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Analysis failed:', error);

      // Return fallback structure
      logger.warn('Returning fallback structure');

      return {
        consensus: [],
        disputes: [],
        omissions: {},
        bias_indicators: [],
        summary: {
          main_story: 'Analysis failed due to technical error',
          key_differences: error.message || 'Unknown error occurred',
          recommendation: 'Please try again with fewer articles or enable compression'
        },
        metadata: {
          error: error.message,
          articlesAttempted: processedArticles.length,
          inputLength: totalInputLength
        },
        error: true
      };

    } finally {
      session.destroy();
      logger.debug('Session destroyed');
    }

  } catch (error) {
    logger.groupEnd();
    logger.error('Comparative analysis failed:', error);
    throw new AIModelError('Failed to compare articles', { originalError: error });
  }
}

/**
 * Get model parameters
 */
export async function getModelParams() {
  try {
    const params = await LanguageModel.params();
    logger.info('Model parameters:', params);
    return params;
  } catch (error) {
    logger.error('Failed to get model params:', error);
    return null;
  }
}
