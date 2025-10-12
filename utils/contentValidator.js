/**
 * Content Validator Utility
 * Validates and filters extracted article content before AI processing
 */

import { logger } from './logger.js';

/**
 * Patterns that indicate low-quality or invalid content
 */
const INVALID_CONTENT_PATTERNS = [
  // JavaScript code patterns
  /window\./i,
  /function\s*\(/i,
  /var\s+\w+\s*=/i,
  /const\s+\w+\s*=/i,
  /let\s+\w+\s*=/i,
  /\.addEventListener\(/i,
  /\.prototype\./i,
  /\}\s*\(\s*\)/,  // IIFE pattern

  // Framework/library detection
  /react|vue|angular|jquery/i,
  /webpack|babel|rollup/i,

  // Common tracking/analytics
  /google-analytics|gtag|analytics\.js/i,
  /facebook|fbevents|twitter|tweet/i,

  // Cookie consent banners
  /cookie.*consent|accept.*cookie/i,
  /gdpr|privacy.*policy/i,

  // Ad content
  /advertisement|sponsored.*content/i,
  /click.*here|buy.*now/i
];

/**
 * Minimum quality thresholds
 */
const QUALITY_THRESHOLDS = {
  minLength: 100,           // Minimum character count
  minWords: 20,             // Minimum word count
  maxJSRatio: 0.3,          // Maximum ratio of JS-like content
  minAlphaRatio: 0.6,       // Minimum ratio of alphabetic characters
  minSentences: 3,          // Minimum sentence count
  maxRepeatedChars: 0.2     // Maximum ratio of repeated characters
};

/**
 * Validate if extracted content is suitable for AI analysis
 * @param {string} content - Raw extracted content
 * @param {string} source - Source identifier for logging
 * @returns {Object} { valid: boolean, reason: string, score: number }
 */
export function validateArticleContent(content, source = 'Unknown') {
  if (!content || typeof content !== 'string') {
    return {
      valid: false,
      reason: 'Content is null or not a string',
      score: 0
    };
  }

  const trimmed = content.trim();

  // Check 1: Minimum length
  if (trimmed.length < QUALITY_THRESHOLDS.minLength) {
    return {
      valid: false,
      reason: `Too short: ${trimmed.length} chars (min: ${QUALITY_THRESHOLDS.minLength})`,
      score: 0.1
    };
  }

  // Check 2: Word count
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < QUALITY_THRESHOLDS.minWords) {
    return {
      valid: false,
      reason: `Too few words: ${words.length} (min: ${QUALITY_THRESHOLDS.minWords})`,
      score: 0.2
    };
  }

  // Check 3: JavaScript pattern detection
  const jsMatches = INVALID_CONTENT_PATTERNS.filter(pattern => pattern.test(trimmed));
  const jsRatio = jsMatches.length / INVALID_CONTENT_PATTERNS.length;

  if (jsRatio > QUALITY_THRESHOLDS.maxJSRatio) {
    return {
      valid: false,
      reason: `High JS pattern ratio: ${(jsRatio * 100).toFixed(1)}% (max: ${QUALITY_THRESHOLDS.maxJSRatio * 100}%)`,
      score: 0.3,
      matches: jsMatches.map(p => p.toString())
    };
  }

  // Check 4: Alphabetic character ratio
  const alphaChars = trimmed.replace(/[^a-zA-Z]/g, '');
  const alphaRatio = alphaChars.length / trimmed.length;

  if (alphaRatio < QUALITY_THRESHOLDS.minAlphaRatio) {
    return {
      valid: false,
      reason: `Low alphabetic ratio: ${(alphaRatio * 100).toFixed(1)}% (min: ${QUALITY_THRESHOLDS.minAlphaRatio * 100}%)`,
      score: 0.4
    };
  }

  // Check 5: Sentence detection (basic)
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length < QUALITY_THRESHOLDS.minSentences) {
    return {
      valid: false,
      reason: `Too few sentences: ${sentences.length} (min: ${QUALITY_THRESHOLDS.minSentences})`,
      score: 0.5
    };
  }

  // Check 6: Repeated characters (spam detection)
  const repeatedCharsMatch = trimmed.match(/(.)\1{5,}/g);
  if (repeatedCharsMatch) {
    const repeatedRatio = repeatedCharsMatch.join('').length / trimmed.length;
    if (repeatedRatio > QUALITY_THRESHOLDS.maxRepeatedChars) {
      return {
        valid: false,
        reason: `Too many repeated characters: ${(repeatedRatio * 100).toFixed(1)}%`,
        score: 0.6
      };
    }
  }

  // Calculate quality score (0-1)
  const score = Math.min(1, (
    (words.length / 100) * 0.3 +
    alphaRatio * 0.3 +
    (sentences.length / 10) * 0.2 +
    (1 - jsRatio) * 0.2
  ));

  logger.debug(`Content validation for ${source}: PASSED (score: ${score.toFixed(2)})`);

  return {
    valid: true,
    reason: 'Content passed all validation checks',
    score,
    stats: {
      length: trimmed.length,
      words: words.length,
      sentences: sentences.length,
      alphaRatio: alphaRatio.toFixed(2),
      jsPatternRatio: jsRatio.toFixed(2)
    }
  };
}

/**
 * Filter array of articles to keep only valid content
 * @param {Array} articles - Array of article objects with extractedContent
 * @returns {Array} Filtered array with only valid articles + validation metadata
 */
export function filterValidArticles(articles) {
  if (!Array.isArray(articles)) {
    logger.error('filterValidArticles: input is not an array');
    return [];
  }

  const results = articles.map(article => {
    const content = article.extractedContent?.textContent || article.content || '';
    const source = article.source || article.title?.substring(0, 30) || 'Unknown';

    const validation = validateArticleContent(content, source);

    return {
      ...article,
      validation,
      isValid: validation.valid
    };
  });

  const validArticles = results.filter(a => a.isValid);
  const invalidArticles = results.filter(a => !a.isValid);

  // Log summary
  logger.group('Content Validation Summary');
  logger.info(`Total articles: ${articles.length}`);
  logger.info(`Valid: ${validArticles.length}`);
  logger.info(`Invalid: ${invalidArticles.length}`);

  if (invalidArticles.length > 0) {
    logger.group('Invalid articles:');
    invalidArticles.forEach(article => {
      logger.warn(`❌ ${article.source}: ${article.validation.reason}`);
    });
    logger.groupEnd();
  }

  logger.groupEnd();

  return validArticles;
}

/**
 * Sanitize and truncate content for AI processing
 * Removes problematic patterns and limits length
 * @param {string} content - Raw content
 * @param {number} maxLength - Maximum character count (default: 2000)
 * @returns {string} Sanitized and truncated content
 */
export function sanitizeContentForAI(content, maxLength = 2000) {
  if (!content) return '';

  let cleaned = content
    // Remove multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove multiple spaces
    .replace(/  +/g, ' ')
    // Remove tabs
    .replace(/\t+/g, ' ')
    // Remove special Unicode characters that might confuse the model
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  // Truncate at sentence boundary if possible
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);

    // Try to find last sentence boundary
    const lastPeriod = cleaned.lastIndexOf('. ');
    const lastQuestion = cleaned.lastIndexOf('? ');
    const lastExclamation = cleaned.lastIndexOf('! ');

    const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclamation);

    if (lastSentence > maxLength * 0.7) {
      // If we found a sentence boundary in the last 30%, use it
      cleaned = cleaned.substring(0, lastSentence + 1).trim();
    } else {
      // Otherwise, add ellipsis
      cleaned += '...';
    }
  }

  return cleaned;
}

/**
 * Get excerpt for display/logging (first N characters with intelligent truncation)
 * @param {string} content - Content to excerpt
 * @param {number} length - Max length (default: 200)
 * @returns {string} Excerpt
 */
export function getContentExcerpt(content, length = 200) {
  if (!content || content.length <= length) {
    return content || '';
  }

  const excerpt = content.substring(0, length);
  const lastSpace = excerpt.lastIndexOf(' ');

  if (lastSpace > length * 0.8) {
    return excerpt.substring(0, lastSpace) + '...';
  }

  return excerpt + '...';
}
