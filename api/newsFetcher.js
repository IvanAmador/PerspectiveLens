/**
 * News Fetcher for PerspectiveLens
 * Fetches news articles from Google News RSS based on keywords
 * Inspired by gnews library (https://github.com/DatanewsOrg/google-news-js)
 *
 * F-003: Fetch Perspectives
 * Uses extracted keywords to search for related news articles from various sources
 */

import { logger } from '../utils/logger.js';

// Google News RSS endpoints
const SEARCH_RSS = 'https://news.google.com/rss/search?q=';

// Countries to search for diverse perspectives
const SEARCH_COUNTRIES = [
  { code: 'US', language: 'en', name: 'United States' },
  { code: 'GB', language: 'en', name: 'United Kingdom' },
  { code: 'BR', language: 'pt', name: 'Brazil' },
  { code: 'FR', language: 'fr', name: 'France' },
  { code: 'DE', language: 'de', name: 'Germany' },
  { code: 'ES', language: 'es', name: 'Spain' },
  { code: 'CN', language: 'zh-CN', name: 'China' },
  { code: 'JP', language: 'ja', name: 'Japan' },
  { code: 'IN', language: 'en', name: 'India' },
  { code: 'AU', language: 'en', name: 'Australia' }
];

/**
 * Build URL parameters for language and country
 */
function buildParams(country = 'US', language = 'en') {
  const countryUpper = country.toUpperCase();
  const languageLower = language.toLowerCase();
  return `hl=${languageLower}&gl=${countryUpper}&ceid=${countryUpper}%3A${languageLower}`;
}

/**
 * Parse RSS feed from URL
 * Uses regex parsing (service worker compatible - no DOMParser available)
 */
async function fetchRSS(url) {
  try {
    logger.debug('Fetching RSS:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Debug: Log first 500 chars to see XML structure
    logger.debug('RSS XML sample:', xmlText.substring(0, 500));

    // Parse RSS items using regex (service worker compatible)
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
      const itemContent = itemMatch[1];

      // Try different title formats (CDATA vs plain text)
      let titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      if (!titleMatch) {
        titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
      }

      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);

      let descriptionMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
      if (!descriptionMatch) {
        descriptionMatch = itemContent.match(/<description>(.*?)<\/description>/);
      }

      const fullTitle = titleMatch ? titleMatch[1] : '';

      // Extract source from title (Google News format: "Title - Source")
      // Try to match the last " - Source" part
      const sourceSplit = fullTitle.match(/^(.*)\s+-\s+([^-]+)$/);

      const title = sourceSplit ? sourceSplit[1].trim() : fullTitle;
      const source = sourceSplit ? sourceSplit[2].trim() : 'Unknown';

      const article = {
        title,
        source,
        link: linkMatch ? linkMatch[1].trim() : '',
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
        fullTitle
      };

      logger.debug('Parsed article:', { title, source, link: article.link.substring(0, 50) });
      items.push(article);
    }

    logger.info(`📄 Parsed ${items.length} items from RSS feed`);

    // Log first 3 articles for debugging
    if (items.length > 0) {
      logger.debug('Sample articles:', items.slice(0, 3).map(i => ({
        title: i.title,
        source: i.source
      })));
    }

    return items;

  } catch (error) {
    logger.error('RSS fetch failed:', error);
    throw new Error(`Failed to fetch RSS: ${error.message}`);
  }
}

/**
 * Search for news articles using keywords
 * @param {string} query - Search query
 * @param {Object} options - Search options
 */
export async function searchNews(query, options = {}) {
  const {
    country = 'US',
    language = 'en',
    maxResults = 10
  } = options;

  if (!query || query.trim().length === 0) {
    throw new Error('Query is required for news search');
  }

  logger.group(`🔍 Searching Google News [${country}/${language}]`);
  logger.info('Query:', query);

  try {
    // Build search URL
    const url = SEARCH_RSS + encodeURIComponent(query) + '&' + buildParams(country, language);
    logger.debug('RSS URL:', url);

    // Fetch and parse RSS
    const items = await fetchRSS(url);

    // Limit results
    const results = items.slice(0, Math.max(0, maxResults));

    logger.info(`✅ Found ${results.length} articles from ${country}`);
    logger.groupEnd();

    return results;

  } catch (error) {
    logger.error(`Search failed for ${country}:`, error);
    logger.groupEnd();
    return []; // Return empty instead of throwing
  }
}

/**
 * Build smart search query from keywords
 * Prioritizes proper nouns and combines with context words
 */
function buildSearchQuery(keywords) {
  if (!keywords || keywords.length === 0) return '';

  // Important context words that should be included
  const contextWords = new Set(['death', 'died', 'killed', 'accident', 'resign', 'appointed', 'elected', 'announced']);

  // Generic filler words to exclude
  const fillerWords = new Set([
    'actress', 'actor', 'age', 'year', 'years', 'old', 'former',
    'president', 'minister', 'official', 'company', 'news',
    'report', 'says', 'state', 'city', 'country', 'world'
  ]);

  // Separate keywords into categories
  const properNouns = [];
  const contexts = [];

  keywords.forEach(kw => {
    const kwLower = kw.toLowerCase();

    // Skip filler words
    if (fillerWords.has(kwLower)) {
      return;
    }

    // Keep context words
    if (contextWords.has(kwLower)) {
      contexts.push(kw);
      return;
    }

    // Proper nouns (names, places, etc.)
    properNouns.push(kw);
  });

  // Build query: proper nouns + important context
  // Example: "diane keaton" + "death" = "diane keaton death"
  const queryParts = [...properNouns.slice(0, 2), ...contexts.slice(0, 1)];

  // If we have nothing, use first 2 keywords
  if (queryParts.length === 0) {
    return keywords.slice(0, 2).join(' ');
  }

  const query = queryParts.join(' ');
  logger.info('🎯 Smart query built:', query, '(from:', keywords, ')');

  return query;
}

/**
 * Fetch perspectives for an article using keywords
 * This is the main function for F-003: Fetch Perspectives
 *
 * Returns diverse news sources covering the same story
 * @param {Array<string>} keywords - Keywords from article (in English)
 * @param {Object} articleData - Original article data
 * @returns {Promise<Array>} Array of perspective articles with metadata
 */
export async function fetchPerspectives(keywords, articleData = {}) {
  logger.group('📰 Fetching Global Perspectives');
  logger.info('Keywords:', keywords);
  logger.info('Original source:', articleData.source);

  try {
    // Build smart search query
    const query = buildSearchQuery(keywords);

    if (!query) {
      throw new Error('Could not build search query from keywords');
    }

    // Search across multiple countries in parallel for diverse perspectives
    logger.info('🌍 Searching across multiple countries...');

    const searchPromises = SEARCH_COUNTRIES.map(country =>
      searchNews(query, {
        country: country.code,
        language: country.language,
        maxResults: 5 // Get 5 from each country
      }).then(articles => articles.map(article => ({
        ...article,
        searchCountry: country.name,
        searchLanguage: country.language
      })))
    );

    const allResults = await Promise.all(searchPromises);
    const allArticles = allResults.flat();

    logger.info(`📊 Total articles found: ${allArticles.length} from ${SEARCH_COUNTRIES.length} countries`);

    // Filter out duplicates and original article
    const seenUrls = new Set();
    const seenTitles = new Set();

    const uniquePerspectives = allArticles.filter(article => {
      // Skip if no link
      if (!article.link) return false;

      // Skip if same URL as original
      if (articleData.url && article.link === articleData.url) {
        return false;
      }

      // Skip duplicate URLs
      if (seenUrls.has(article.link)) {
        return false;
      }

      // Skip very similar titles (likely same article)
      const titleKey = article.title.toLowerCase().replace(/\s+/g, '');
      if (seenTitles.has(titleKey)) {
        return false;
      }

      seenUrls.add(article.link);
      seenTitles.add(titleKey);
      return true;
    });

    // Add metadata
    const enrichedPerspectives = uniquePerspectives.map(article => ({
      ...article,
      keywords,
      searchedAt: new Date().toISOString(),
      relevance: calculateRelevance(article.title, keywords)
    }));

    // Sort by relevance and diversity
    const sortedPerspectives = enrichedPerspectives
      .sort((a, b) => {
        // Prioritize relevance first
        const relevanceDiff = b.relevance - a.relevance;
        if (Math.abs(relevanceDiff) > 0.2) return relevanceDiff;

        // Then alphabetically by country for diversity
        return a.searchCountry.localeCompare(b.searchCountry);
      })
      .slice(0, 15); // Top 15 perspectives

    logger.info(`✅ Found ${sortedPerspectives.length} unique perspectives`);

    // Log sources by country for verification
    const countryStats = {};
    sortedPerspectives.forEach(p => {
      countryStats[p.searchCountry] = (countryStats[p.searchCountry] || 0) + 1;
    });
    logger.info('📍 Perspectives by country:', countryStats);

    logger.debug('🔍 Sample perspectives:', sortedPerspectives.slice(0, 5).map(p => ({
      title: p.title,
      source: p.source,
      country: p.searchCountry,
      relevance: p.relevance
    })));

    logger.groupEnd();

    return sortedPerspectives;

  } catch (error) {
    logger.error('Failed to fetch perspectives:', error);
    logger.groupEnd();
    throw error;
  }
}

/**
 * Calculate relevance score based on keyword matches in title
 */
function calculateRelevance(title, keywords) {
  if (!title || !keywords || keywords.length === 0) return 0;

  const titleLower = title.toLowerCase();
  let score = 0;

  keywords.forEach(keyword => {
    if (titleLower.includes(keyword.toLowerCase())) {
      score += 1;
    }
  });

  // Normalize to 0-1 range
  return score / keywords.length;
}
