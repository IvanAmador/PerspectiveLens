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
 * Perform comparative analysis of multiple article summaries
 * @param {Array} perspectives - Array of {source, summary} objects
 */
export async function compareArticles(perspectives) {
  if (!perspectives || perspectives.length < 2) {
    throw new AIModelError('At least 2 perspectives required for comparison');
  }

  const session = await createSession();

  try {
    // Build input from all perspectives
    const perspectivesText = perspectives
      .map((p, idx) => `Article ${idx + 1} (${p.source}):\n${p.summary}`)
      .join('\n\n');

    // Load prompt template from file
    const prompt = await getPrompt('comparative-analysis', {
      perspectives: perspectivesText
    });

    logger.debug('Comparing', perspectives.length, 'perspectives');
    const result = await session.prompt(prompt);

    try {
      const analysis = JSON.parse(result);
      logger.info('Comparison completed successfully');
      return analysis;
    } catch (parseError) {
      logger.warn('Failed to parse JSON, returning raw text');
      return { raw: result, consensus: [], disputes: [], omissions: {} };
    }

  } catch (error) {
    logger.error('Comparison failed:', error);
    throw new AIModelError('Failed to compare articles', { originalError: error });
  } finally {
    session.destroy();
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
