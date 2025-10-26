/**
 * Content Preparation Utilities
 * Prepares article content for different AI models (Gemini Nano vs Gemini 2.5 Pro)
 *
 * @module utils/contentPreparation
 */

import { logger } from './logger.js';

/**
 * Sanitize text content for AI processing
 * @param {string} text - Raw text content
 * @returns {string} Sanitized text
 */
function sanitizeContent(text) {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')     // Max 2 consecutive newlines
    .trim();
}

/**
 * Format article for prompt display
 * @param {Object} article - Article object
 * @param {string} content - Prepared content
 * @param {number} index - Article index (for display)
 * @returns {string} Formatted article text for prompt
 */
function formatArticleForPrompt(article, content, index) {
  return `
### Article ${index + 1}
**Source:** ${article.source} (${article.country})
**Language:** ${article.language || 'unknown'}
**Title:** ${article.title}
**Content:**
${content}

---
  `.trim();
}

/**
 * Prepare article content for Gemini Nano (compressed/summarized)
 *
 * Gemini Nano has limited context window (~60-80k tokens), so:
 * - Uses compressed content (from summarizer)
 * - Content is already translated to English
 * - Key points format (5 bullet points)
 *
 * @param {Array<Object>} articles - Articles with compressedContent
 * @returns {Object} Prepared data for Nano
 */
export function prepareForNano(articles) {
  logger.system.info('Preparing articles for Gemini Nano', {
    category: logger.CATEGORIES.ANALYZE,
    articlesCount: articles.length
  });

  const prepared = articles.map((article, index) => {
    // Nano uses compressed content (5 key points, already translated)
    const content = article.compressedContent
      || article.extractedContent?.textContent
      || article.content
      || '';

    if (!content) {
      logger.system.warn('Article missing content for Nano', {
        category: logger.CATEGORIES.ANALYZE,
        article: { source: article.source, title: article.title }
      });
    }

    const sanitized = sanitizeContent(content);

    return {
      source: article.source,
      country: article.country,
      language: article.language || 'en',
      title: article.title,
      content: sanitized,
      contentType: article.compressedContent ? 'compressed' : 'full',
      contentLength: sanitized.length,
      wordCount: sanitized.split(/\s+/).length
    };
  });

  const totalChars = prepared.reduce((sum, a) => sum + a.contentLength, 0);
  const avgChars = Math.round(totalChars / prepared.length);

  logger.system.info('Nano content preparation complete', {
    category: logger.CATEGORIES.ANALYZE,
    stats: {
      articles: prepared.length,
      compressedCount: prepared.filter(a => a.contentType === 'compressed').length,
      totalChars,
      avgChars,
      avgWords: Math.round(prepared.reduce((sum, a) => sum + a.wordCount, 0) / prepared.length)
    }
  });

  return {
    articles: prepared,
    formattedText: prepared.map((article, idx) =>
      formatArticleForPrompt(article, article.content, idx)
    ).join('\n\n'),
    stats: {
      totalChars,
      avgChars,
      articlesCount: prepared.length
    }
  };
}

/**
 * Prepare article content for Gemini 2.5 Pro (full text, multi-language)
 *
 * Gemini 2.5 Pro has large context window (2M tokens), so:
 * - Uses full article text (no compression needed)
 * - Keeps original language (Pro handles multi-language natively)
 * - No translation needed
 *
 * @param {Array<Object>} articles - Articles with extractedContent.textContent
 * @returns {Object} Prepared data for Pro
 */
export function prepareForPro(articles) {
  logger.system.info('Preparing articles for Gemini 2.5 Pro', {
    category: logger.CATEGORIES.ANALYZE,
    articlesCount: articles.length
  });

  const prepared = articles.map((article, index) => {
    // Pro uses full extracted content in original language
    const content = article.extractedContent?.textContent
      || article.content
      || '';

    if (!content) {
      logger.system.warn('Article missing content for Pro', {
        category: logger.CATEGORIES.ANALYZE,
        article: { source: article.source, title: article.title }
      });
    }

    const sanitized = sanitizeContent(content);

    return {
      source: article.source,
      country: article.country,
      language: article.language || 'unknown',
      title: article.title,
      content: sanitized,
      contentType: 'full',
      contentLength: sanitized.length,
      wordCount: sanitized.split(/\s+/).length
    };
  });

  const totalChars = prepared.reduce((sum, a) => sum + a.contentLength, 0);
  const avgChars = Math.round(totalChars / prepared.length);

  logger.system.info('Pro content preparation complete', {
    category: logger.CATEGORIES.ANALYZE,
    stats: {
      articles: prepared.length,
      languages: [...new Set(prepared.map(a => a.language))],
      totalChars,
      avgChars,
      avgWords: Math.round(prepared.reduce((sum, a) => sum + a.wordCount, 0) / prepared.length)
    }
  });

  return {
    articles: prepared,
    formattedText: prepared.map((article, idx) =>
      formatArticleForPrompt(article, article.content, idx)
    ).join('\n\n'),
    stats: {
      totalChars,
      avgChars,
      articlesCount: prepared.length,
      languages: [...new Set(prepared.map(a => a.language))]
    }
  };
}

/**
 * Validate that articles have required content
 * @param {Array<Object>} articles - Articles to validate
 * @param {string} modelType - 'nano' or 'pro'
 * @returns {Object} Validation result
 */
export function validateArticleContent(articles, modelType) {
  logger.system.debug('Validating article content', {
    category: logger.CATEGORIES.VALIDATE,
    articlesCount: articles.length,
    modelType
  });

  const validation = {
    valid: true,
    missingContent: [],
    warnings: []
  };

  articles.forEach((article, index) => {
    let hasContent = false;

    if (modelType === 'nano') {
      // Nano needs compressedContent OR extractedContent
      hasContent = !!(article.compressedContent || article.extractedContent?.textContent);

      if (!article.compressedContent && article.extractedContent?.textContent) {
        validation.warnings.push({
          index,
          source: article.source,
          message: 'Using full content instead of compressed (compression may have failed)'
        });
      }
    } else if (modelType === 'pro') {
      // Pro needs extractedContent.textContent
      hasContent = !!(article.extractedContent?.textContent || article.content);

      if (!article.extractedContent?.textContent && article.content) {
        validation.warnings.push({
          index,
          source: article.source,
          message: 'Using fallback content field instead of extractedContent'
        });
      }
    }

    if (!hasContent) {
      validation.valid = false;
      validation.missingContent.push({
        index,
        source: article.source,
        title: article.title
      });
    }
  });

  if (!validation.valid) {
    logger.system.error('Article content validation failed', {
      category: logger.CATEGORIES.VALIDATE,
      missingCount: validation.missingContent.length,
      missing: validation.missingContent
    });
  } else if (validation.warnings.length > 0) {
    logger.system.warn('Article content validation warnings', {
      category: logger.CATEGORIES.VALIDATE,
      warningCount: validation.warnings.length,
      warnings: validation.warnings
    });
  } else {
    logger.system.info('Article content validation passed', {
      category: logger.CATEGORIES.VALIDATE,
      articlesCount: articles.length
    });
  }

  return validation;
}

/**
 * Get content statistics for debugging
 * @param {Array<Object>} articles - Articles to analyze
 * @returns {Object} Content statistics
 */
export function getContentStats(articles) {
  const stats = {
    total: articles.length,
    hasExtractedContent: 0,
    hasCompressedContent: 0,
    hasFallbackContent: 0,
    hasNoContent: 0,
    languages: new Set(),
    avgExtractedLength: 0,
    avgCompressedLength: 0
  };

  let totalExtracted = 0;
  let totalCompressed = 0;

  articles.forEach(article => {
    if (article.extractedContent?.textContent) {
      stats.hasExtractedContent++;
      totalExtracted += article.extractedContent.textContent.length;
    }

    if (article.compressedContent) {
      stats.hasCompressedContent++;
      totalCompressed += article.compressedContent.length;
    }

    if (article.content && !article.extractedContent?.textContent) {
      stats.hasFallbackContent++;
    }

    if (!article.extractedContent?.textContent && !article.content && !article.compressedContent) {
      stats.hasNoContent++;
    }

    if (article.language) {
      stats.languages.add(article.language);
    }
  });

  stats.avgExtractedLength = stats.hasExtractedContent > 0
    ? Math.round(totalExtracted / stats.hasExtractedContent)
    : 0;

  stats.avgCompressedLength = stats.hasCompressedContent > 0
    ? Math.round(totalCompressed / stats.hasCompressedContent)
    : 0;

  stats.languages = Array.from(stats.languages);

  return stats;
}
