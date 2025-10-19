/**
 * Intelligent Article Selection Controller
 * Selects best articles per country based on quality scores and configuration
 */

import { logger } from '../utils/logger.js';
import { getSelectionTargets } from '../config/pipeline.js';

/**
 * Select articles based on country quotas and quality
 * Ensures configured distribution per country, picking highest quality articles
 *
 * @param {Array} articles - All articles with extracted content
 * @param {Object} customTargets - Optional custom selection targets (defaults to config)
 * @returns {Object} Selection result with articles and metadata
 */
export function selectArticlesByCountry(articles, customTargets = null) {
  const targets = customTargets || getSelectionTargets();

  logger.system.info('Starting intelligent article selection', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      totalArticles: articles.length,
      targets: targets.perCountry,
      maxForAnalysis: targets.maxForAnalysis,
    },
  });

  // Group articles by country
  const byCountry = groupByCountry(articles);

  // Select best articles from each country
  const selected = [];
  const selectionLog = {};

  for (const [countryCode, requestedCount] of Object.entries(targets.perCountry)) {
    const countryArticles = byCountry[countryCode] || [];

    logger.system.debug(`Processing country: ${countryCode}`, {
      category: logger.CATEGORIES.GENERAL,
      data: {
        available: countryArticles.length,
        requested: requestedCount,
      },
    });

    // Sort by quality (highest first)
    const sortedByQuality = sortByQuality(countryArticles);

    // Take top N articles
    const selectedFromCountry = sortedByQuality.slice(0, requestedCount);
    selected.push(...selectedFromCountry);

    // Log selection details
    selectionLog[countryCode] = {
      requested: requestedCount,
      available: countryArticles.length,
      selected: selectedFromCountry.length,
      shortfall: Math.max(0, requestedCount - selectedFromCountry.length),
      articles: selectedFromCountry.map(a => ({
        source: a.source,
        title: a.title.substring(0, 60) + '...',
        qualityScore: a.qualityScore || 0,
        extractionMethod: a.extractionMethod,
      })),
    };
  }

  // Check if we need to trim to maxForAnalysis limit
  let finalSelection = selected;
  let trimmed = false;

  if (selected.length > targets.maxForAnalysis) {
    logger.system.warn('Selection exceeds analysis limit, trimming proportionally', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        selected: selected.length,
        limit: targets.maxForAnalysis,
      },
    });

    finalSelection = trimProportionally(selected, targets.maxForAnalysis, targets.perCountry);
    trimmed = true;
  }

  // Log final selection
  logger.both.info('Article selection complete', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      selectionByCountry: selectionLog,
      finalCount: finalSelection.length,
      countriesProcessed: Object.keys(selectionLog).length,
      trimmed,
    },
  });

  return {
    articles: finalSelection,
    metadata: {
      selectionByCountry: selectionLog,
      totalSelected: finalSelection.length,
      totalAvailable: articles.length,
      trimmed,
    },
  };
}

/**
 * Group articles by country code
 *
 * @param {Array} articles - Articles to group
 * @returns {Object} Articles grouped by country code
 */
function groupByCountry(articles) {
  return articles.reduce((acc, article) => {
    const country = article.countryCode || article.country || 'UNKNOWN';
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(article);
    return acc;
  }, {});
}

/**
 * Sort articles by quality score (highest first)
 * Calculates quality score if not already present
 *
 * @param {Array} articles - Articles to sort
 * @returns {Array} Sorted articles
 */
function sortByQuality(articles) {
  return [...articles].sort((a, b) => {
    const scoreA = calculateQualityScore(a);
    const scoreB = calculateQualityScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Calculate comprehensive quality score for an article
 * Considers extraction success, content length, method used, and existing scores
 *
 * @param {Article} article - Article to score
 * @returns {number} Quality score (0-100+)
 */
function calculateQualityScore(article) {
  // Return cached score if already calculated
  if (article.qualityScore !== undefined) {
    return article.qualityScore;
  }

  let score = 0;

  // Base score from extraction quality
  if (article.extractedContent) {
    score += 30;

    // Content length scoring (sweet spot: 3000-8000 chars)
    const contentLength = article.extractedContent.textContent?.length || 0;
    if (contentLength >= 3000 && contentLength <= 8000) {
      score += 20;
    } else if (contentLength >= 2000 && contentLength < 3000) {
      score += 15;
    } else if (contentLength >= 1000 && contentLength < 2000) {
      score += 10;
    } else if (contentLength > 8000 && contentLength <= 10000) {
      score += 15;
    } else if (contentLength > 10000) {
      score += 5; // Too long, may be noisy
    }

    // Bonus for having excerpt
    if (article.extractedContent.excerpt) {
      score += 10;
    }

    // Word count bonus
    const wordCount = article.extractedContent.textContent?.split(/\s+/).length || 0;
    if (wordCount >= 500 && wordCount <= 1500) {
      score += 10;
    } else if (wordCount >= 300 && wordCount < 500) {
      score += 5;
    }
  }

  // Extraction method quality bonus
  switch (article.extractionMethod) {
    case 'readability':
      score += 15; // Best method
      break;
    case 'smart-selectors':
      score += 10; // Good method
      break;
    case 'aggressive-fallback':
      score += 5; // Acceptable method
      break;
    case 'error-fallback':
      score += 2; // Last resort
      break;
    default:
      score += 0;
  }

  // Use existing quality score if available
  if (article.contentExtracted && article.extractedContent?.quality !== undefined) {
    score += article.extractedContent.quality * 0.2; // Add up to 20 points
  }

  // Cache the score
  article.qualityScore = Math.round(score);

  return article.qualityScore;
}

/**
 * Trim selection proportionally to respect maxForAnalysis limit
 * Maintains country distribution while reducing total count
 *
 * @param {Array} articles - Selected articles
 * @param {number} maxCount - Maximum articles allowed
 * @param {Object} countryTargets - Original targets per country
 * @returns {Array} Trimmed article list
 */
function trimProportionally(articles, maxCount, countryTargets) {
  const byCountry = groupByCountry(articles);
  const trimmed = [];

  // Calculate total requested across all countries
  const totalRequested = Object.values(countryTargets).reduce((sum, n) => sum + n, 0);

  // Allocate proportionally
  for (const [countryCode, originalTarget] of Object.entries(countryTargets)) {
    const proportion = originalTarget / totalRequested;
    const allowedFromCountry = Math.max(1, Math.floor(maxCount * proportion));

    const countryArticles = sortByQuality(byCountry[countryCode] || []);
    const selectedFromCountry = countryArticles.slice(0, allowedFromCountry);

    trimmed.push(...selectedFromCountry);

    logger.system.debug(`Proportional trim for ${countryCode}`, {
      category: logger.CATEGORIES.GENERAL,
      data: {
        originalTarget,
        proportion: Math.round(proportion * 100) + '%',
        allowedFromCountry,
        selected: selectedFromCountry.length,
      },
    });
  }

  // Final trim if still over limit (due to rounding)
  return trimmed.slice(0, maxCount);
}

/**
 * Validate if we have sufficient article coverage from each country
 *
 * @param {Array} articles - Articles available
 * @param {Object} targets - Selection targets
 * @returns {Object} Validation result with issues
 */
export function validateCoverage(articles, targets = null) {
  const selectionTargets = targets || getSelectionTargets();
  const byCountry = groupByCountry(articles);
  const issues = [];

  for (const [countryCode, requestedCount] of Object.entries(selectionTargets.perCountry)) {
    const available = (byCountry[countryCode] || []).length;

    if (available < requestedCount) {
      issues.push({
        country: countryCode,
        requested: requestedCount,
        available,
        shortfall: requestedCount - available,
      });
    }
  }

  if (issues.length > 0) {
    logger.user.warn('Insufficient articles from some countries', {
      category: logger.CATEGORIES.SEARCH,
      data: { issues },
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    coverage: Object.keys(selectionTargets.perCountry).length > 0
      ? ((Object.keys(selectionTargets.perCountry).length - issues.length) /
          Object.keys(selectionTargets.perCountry).length) * 100
      : 0,
  };
}

/**
 * Get summary statistics for article selection
 *
 * @param {Array} articles - Articles to analyze
 * @returns {Object} Summary statistics
 */
export function getSelectionStats(articles) {
  const byCountry = groupByCountry(articles);

  const stats = {
    total: articles.length,
    byCountry: {},
    avgQualityScore: 0,
    qualityDistribution: {
      excellent: 0,  // 80+
      good: 0,       // 60-79
      acceptable: 0, // 40-59
      poor: 0,       // <40
    },
  };

  // Calculate stats per country
  for (const [countryCode, countryArticles] of Object.entries(byCountry)) {
    const scores = countryArticles.map(a => calculateQualityScore(a));
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    stats.byCountry[countryCode] = {
      count: countryArticles.length,
      avgQualityScore: Math.round(avgScore),
      minQualityScore: Math.min(...scores),
      maxQualityScore: Math.max(...scores),
    };
  }

  // Overall quality distribution
  const allScores = articles.map(a => calculateQualityScore(a));
  stats.avgQualityScore = Math.round(
    allScores.reduce((sum, s) => sum + s, 0) / allScores.length
  );

  allScores.forEach(score => {
    if (score >= 80) stats.qualityDistribution.excellent++;
    else if (score >= 60) stats.qualityDistribution.good++;
    else if (score >= 40) stats.qualityDistribution.acceptable++;
    else stats.qualityDistribution.poor++;
  });

  return stats;
}
