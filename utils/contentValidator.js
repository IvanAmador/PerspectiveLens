/**
 * Content Validator for PerspectiveLens
 * Validates and sanitizes article content for AI processing
 * 
 * Features:
 * - Content quality scoring
 * - Sanitization for AI input
 * - Structural validation
 * - Language detection integration
 */

import { logger } from './logger.js';

/**
 * Quality thresholds for content validation
 */
const QUALITY_THRESHOLDS = {
  MIN_CONTENT_LENGTH: 100,
  MIN_WORD_COUNT: 20,
  MAX_CONTENT_LENGTH: 50000,
  MIN_QUALITY_SCORE: 60
};

/**
 * Validate article has minimum required content
 * @param {Object} article - Article object
 * @returns {boolean} True if valid
 */
export function hasValidContent(article) {
  if (!article) {
    logger.system.trace('Article is null or undefined', {
      category: logger.CATEGORIES.VALIDATE
    });
    return false;
  }

  const content = article.extractedContent?.textContent || article.content || '';
  
  if (!content || content.trim().length < QUALITY_THRESHOLDS.MIN_CONTENT_LENGTH) {
    logger.system.trace('Article content too short', {
      category: logger.CATEGORIES.VALIDATE,
      data: {
        source: article.source,
        contentLength: content.length,
        minRequired: QUALITY_THRESHOLDS.MIN_CONTENT_LENGTH
      }
    });
    return false;
  }

  return true;
}

/**
 * Calculate content quality score
 * @param {Object} article - Article object
 * @returns {number} Quality score (0-100)
 */
export function getContentQualityScore(article) {
  if (!article) return 0;

  let score = 0;
  const content = article.extractedContent?.textContent || article.content || '';
  const title = article.title || '';
  const excerpt = article.extractedContent?.excerpt || '';

  // Factor 1: Content length (0-30 points)
  const contentLength = content.length;
  if (contentLength >= 5000) score += 30;
  else if (contentLength >= 2000) score += 25;
  else if (contentLength >= 1000) score += 20;
  else if (contentLength >= 500) score += 15;
  else if (contentLength >= 100) score += 10;

  // Factor 2: Word count (0-20 points)
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount >= 500) score += 20;
  else if (wordCount >= 200) score += 15;
  else if (wordCount >= 100) score += 10;
  else if (wordCount >= 50) score += 5;

  // Factor 3: Has title (0-15 points)
  if (title && title.length > 10) score += 15;
  else if (title && title.length > 0) score += 5;

  // Factor 4: Has excerpt (0-15 points)
  if (excerpt && excerpt.length > 50) score += 15;
  else if (excerpt && excerpt.length > 0) score += 5;

  // Factor 5: Structure quality (0-20 points)
  const hasParagraphs = content.includes('\n\n') || content.includes('</p>');
  const hasProperPunctuation = /[.!?]/.test(content);
  const notTooManyLineBreaks = (content.match(/\n/g) || []).length < (contentLength / 50);
  
  if (hasParagraphs) score += 7;
  if (hasProperPunctuation) score += 7;
  if (notTooManyLineBreaks) score += 6;

  logger.system.trace('Content quality score calculated', {
    category: logger.CATEGORIES.VALIDATE,
    data: {
      source: article.source,
      score,
      factors: {
        contentLength,
        wordCount,
        hasTitle: !!title,
        hasExcerpt: !!excerpt,
        hasParagraphs,
        hasProperPunctuation
      }
    }
  });

  return Math.min(score, 100);
}

/**
 * Check if article meets quality requirements
 * @param {Object} article - Article object
 * @returns {boolean} True if meets requirements
 */
export function meetsQualityRequirements(article) {
  const score = getContentQualityScore(article);
  const meetsRequirements = score >= QUALITY_THRESHOLDS.MIN_QUALITY_SCORE;

  if (!meetsRequirements) {
    logger.system.debug('Article does not meet quality requirements', {
      category: logger.CATEGORIES.VALIDATE,
      data: {
        source: article.source,
        score,
        threshold: QUALITY_THRESHOLDS.MIN_QUALITY_SCORE
      }
    });
  }

  return meetsRequirements;
}

/**
 * Filter articles to only valid ones
 * @param {Array<Object>} articles - Articles to filter
 * @returns {Array<Object>} Valid articles
 */
export function filterValidArticles(articles) {
  const startTime = Date.now();

  logger.system.debug('Starting article validation', {
    category: logger.CATEGORIES.VALIDATE,
    data: { totalArticles: articles.length }
  });

  const validArticles = articles.filter(article => {
    const hasContent = hasValidContent(article);
    const meetsQuality = meetsQualityRequirements(article);
    
    return hasContent && meetsQuality;
  });

  const duration = Date.now() - startTime;

  logger.system.info('Article validation completed', {
    category: logger.CATEGORIES.VALIDATE,
    data: {
      input: articles.length,
      valid: validArticles.length,
      invalid: articles.length - validArticles.length,
      duration
    }
  });

  return validArticles;
}

/**
 * Sanitize content for AI processing
 * Removes excessive whitespace, special characters, etc.
 * @param {string} content - Raw content
 * @returns {string} Sanitized content
 */
export function sanitizeContentForAI(content) {
  if (!content) return '';

  logger.system.trace('Sanitizing content for AI', {
    category: logger.CATEGORIES.VALIDATE,
    data: { originalLength: content.length }
  });

  let sanitized = content;

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Remove leading/trailing whitespace
  sanitized = sanitized.trim();
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize line breaks (max 2 consecutive)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Truncate if too long
  if (sanitized.length > QUALITY_THRESHOLDS.MAX_CONTENT_LENGTH) {
    sanitized = sanitized.substring(0, QUALITY_THRESHOLDS.MAX_CONTENT_LENGTH) + '...';
    
    logger.system.debug('Content truncated to max length', {
      category: logger.CATEGORIES.VALIDATE,
      data: {
        originalLength: content.length,
        truncatedLength: sanitized.length,
        maxLength: QUALITY_THRESHOLDS.MAX_CONTENT_LENGTH
      }
    });
  }

  logger.system.trace('Content sanitization completed', {
    category: logger.CATEGORIES.VALIDATE,
    data: {
      originalLength: content.length,
      sanitizedLength: sanitized.length,
      reductionPercent: ((1 - sanitized.length / content.length) * 100).toFixed(1)
    }
  });

  return sanitized;
}

/**
 * Get excerpt from content (first N characters)
 * @param {string} content - Content text
 * @param {number} maxLength - Maximum excerpt length
 * @returns {string} Excerpt
 */
export function getContentExcerpt(content, maxLength = 500) {
  if (!content) return '';

  const sanitized = sanitizeContentForAI(content);
  
  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  // Try to break at sentence end
  const excerpt = sanitized.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    excerpt.lastIndexOf('.'),
    excerpt.lastIndexOf('!'),
    excerpt.lastIndexOf('?')
  );

  if (lastSentenceEnd > maxLength * 0.7) {
    return excerpt.substring(0, lastSentenceEnd + 1).trim();
  }

  // Break at word boundary
  const lastSpace = excerpt.lastIndexOf(' ');
  if (lastSpace > 0) {
    return excerpt.substring(0, lastSpace).trim() + '...';
  }

  return excerpt.trim() + '...';
}

/**
 * Validate article structure
 * @param {Object} article - Article object
 * @returns {Object} Validation result
 */
export function validateArticleStructure(article) {
  const issues = [];

  if (!article) {
    issues.push('Article is null or undefined');
  } else {
    if (!article.title) issues.push('Missing title');
    if (!article.source) issues.push('Missing source');
    if (!article.link && !article.url) issues.push('Missing link/url');
    
    const content = article.extractedContent?.textContent || article.content;
    if (!content) {
      issues.push('Missing content');
    } else if (content.length < QUALITY_THRESHOLDS.MIN_CONTENT_LENGTH) {
      issues.push(`Content too short (${content.length} chars, need ${QUALITY_THRESHOLDS.MIN_CONTENT_LENGTH})`);
    }
  }

  const isValid = issues.length === 0;

  if (!isValid) {
    logger.system.debug('Article structure validation failed', {
      category: logger.CATEGORIES.VALIDATE,
      data: {
        source: article?.source,
        issues
      }
    });
  }

  return {
    valid: isValid,
    issues
  };
}

/**
 * Get content statistics
 * @param {string} content - Content text
 * @returns {Object} Statistics
 */
export function getContentStats(content) {
  if (!content) {
    return {
      length: 0,
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0
    };
  }

  const wordCount = content.trim().split(/\s+/).length;
  const sentenceCount = (content.match(/[.!?]+/g) || []).length;
  const paragraphCount = (content.match(/\n\n+/g) || []).length + 1;

  return {
    length: content.length,
    wordCount,
    sentenceCount,
    paragraphCount,
    avgWordsPerSentence: sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0
  };
}

/**
 * Export quality thresholds for external use
 */
export { QUALITY_THRESHOLDS };
