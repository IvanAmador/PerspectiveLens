/**
 * Professional News Fetcher for PerspectiveLens
 * Fetches news articles from Google News RSS with smart query building
 * 
 * Key Features:
 * - Automatic title translation to English for better global search results
 * - Multi-country parallel fetching for diverse perspectives
 * - Smart deduplication and filtering
 * - Country-balanced results
 * 
 * Reference: https://news.google.com/rss
 * Google News RSS: Simple, effective, no complex keyword optimization needed
 */

import { logger } from '../utils/logger.js';
import { detectLanguageSimple } from './languageDetector.js';
import { translate } from './translator.js';

/**
 * Google News RSS configuration
 */
const NEWS_CONFIG = {
  // Base RSS search endpoint
  SEARCH_RSS: 'https://news.google.com/rss/search?q=',
  
  // Countries to search for diverse perspectives
  SEARCH_COUNTRIES: [
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
  ],
  
  // Search configuration
  MAX_RESULTS_PER_COUNTRY: 3,
  FINAL_RESULTS_COUNT: 15,
  
  // RSS parsing patterns
  REGEX_PATTERNS: {
    ITEM: /<item>([\s\S]*?)<\/item>/g,
    TITLE_CDATA: /<title><!\[CDATA\[(.*?)\]\]><\/title>/,
    TITLE_PLAIN: /<title>(.*?)<\/title>/,
    LINK: /<link>(.*?)<\/link>/,
    PUBDATE: /<pubDate>(.*?)<\/pubDate>/,
    DESC_CDATA: /<description><!\[CDATA\[(.*?)\]\]><\/description>/,
    DESC_PLAIN: /<description>(.*?)<\/description>/
  }
};

/**
 * Build URL parameters for Google News RSS
 * 
 * @param {string} country - Country code (e.g., 'US', 'BR')
 * @param {string} language - Language code (e.g., 'en', 'pt')
 * @returns {string} URL parameters string
 */
function buildRSSParams(country = 'US', language = 'en') {
  const countryUpper = country.toUpperCase();
  const languageLower = language.toLowerCase();
  
  return `hl=${languageLower}&gl=${countryUpper}&ceid=${countryUpper}%3A${languageLower}`;
}

/**
 * Parse Google News RSS feed
 * Uses regex parsing (Service Worker compatible - no DOMParser)
 * 
 * @param {string} url - RSS feed URL
 * @returns {Promise<Array<Object>>} Parsed articles
 */
async function fetchAndParseRSS(url) {
  const fetchStart = Date.now();
  
  logger.system.trace('Fetching RSS feed', {
    category: logger.CATEGORIES.SEARCH,
    data: { url: url.substring(0, 100) }
  });

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const fetchDuration = Date.now() - fetchStart;

    logger.system.trace('RSS XML fetched', {
      category: logger.CATEGORIES.SEARCH,
      data: { xmlLength: xmlText.length, duration: fetchDuration }
    });

    // Parse RSS items using regex
    const items = [];
    const { REGEX_PATTERNS } = NEWS_CONFIG;
    
    let itemMatch;
    while ((itemMatch = REGEX_PATTERNS.ITEM.exec(xmlText)) !== null) {
      const itemContent = itemMatch[1];
      
      // Extract title (try CDATA first, then plain)
      let titleMatch = itemContent.match(REGEX_PATTERNS.TITLE_CDATA);
      if (!titleMatch) {
        titleMatch = itemContent.match(REGEX_PATTERNS.TITLE_PLAIN);
      }
      
      // Extract other fields
      const linkMatch = itemContent.match(REGEX_PATTERNS.LINK);
      const pubDateMatch = itemContent.match(REGEX_PATTERNS.PUBDATE);
      
      let descriptionMatch = itemContent.match(REGEX_PATTERNS.DESC_CDATA);
      if (!descriptionMatch) {
        descriptionMatch = itemContent.match(REGEX_PATTERNS.DESC_PLAIN);
      }

      const fullTitle = titleMatch ? titleMatch[1] : '';
      // Extract source from title (Google News format: "Title - Source")
      const sourceSplit = fullTitle.match(/^(.+?)\s+-\s+(.+)$/);
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

      items.push(article);
    }

    logger.system.trace('RSS feed parsed', {
      category: logger.CATEGORIES.SEARCH,
      data: { articlesFound: items.length }
    });

    return items;
  } catch (error) {
    const duration = Date.now() - fetchStart;
    
    logger.system.error('RSS fetch/parse failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { url: url.substring(0, 100), duration }
    });

    throw new Error(`Failed to fetch RSS: ${error.message}`);
  }
}

/**
 * Search Google News for articles
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array<Object>>} Search results
 */
async function searchNews(query, options = {}) {
  const {
    country = 'US',
    language = 'en',
    maxResults = 10
  } = options;

  if (!query || query.trim().length === 0) {
    logger.system.warn('Empty query provided to searchNews', {
      category: logger.CATEGORIES.SEARCH
    });
    return [];
  }

  logger.system.trace('Searching Google News', {
    category: logger.CATEGORIES.SEARCH,
    data: { query, country, language }
  });

  try {
    const encodedQuery = encodeURIComponent(query);
    const params = buildRSSParams(country, language);
    const url = `${NEWS_CONFIG.SEARCH_RSS}${encodedQuery}&${params}`;

    const items = await fetchAndParseRSS(url);
    const results = items.slice(0, Math.max(0, maxResults));

    return results;
  } catch (error) {
    logger.system.error('Search failed', {
      category: logger.CATEGORIES.SEARCH,
      error,
      data: { query, country }
    });

    return []; // Graceful degradation
  }
}

/**
 * Build search query from article title
 * Simple approach: use full title for better context
 * 
 * @param {string} title - Article title
 * @returns {string} Search query (full title)
 */
function buildSearchQuery(title) {
  logger.system.debug('Building search query from title', {
    category: logger.CATEGORIES.SEARCH,
    data: { title }
  });

  if (!title || title.trim().length === 0) {
    throw new Error('Title is required to build search query');
  }

  // Simply trim and return the full title
  const query = title.trim();

  logger.system.info('Search query built', {
    category: logger.CATEGORIES.SEARCH,
    data: { 
      originalTitle: title,
      query 
    }
  });

  return query;
}

/**
 * Fetch diverse perspectives for an article
 * Main function for F-003: Fetch Perspectives
 * Automatically translates title to English for better global search results
 * 
 * @param {string} title - Article title
 * @param {Object} articleData - Original article data
 * @returns {Promise<Array<Object>>} Perspective articles with metadata
 */
export async function fetchPerspectives(title, articleData = {}) {
  const operationStart = Date.now();
  
  if (!title || typeof title !== 'string') {
    throw new Error('Title string is required');
  }

  logger.system.info('Starting perspective search with title', {
    category: logger.CATEGORIES.SEARCH,
    data: {
      originalTitle: title,
      originalSource: articleData.source
    }
  });

  try {
    // Step 1: Detect title language
    logger.system.debug('Detecting title language', {
      category: logger.CATEGORIES.SEARCH
    });

    const detectedLang = await detectLanguageSimple(title);
    
    logger.system.debug('Title language detected', {
      category: logger.CATEGORIES.SEARCH,
      data: { language: detectedLang }
    });

    // Step 2: Translate to English if needed (better global search results)
    let searchTitle = title;
    if (detectedLang !== 'en') {
      logger.system.info('Translating title to English for better search results', {
        category: logger.CATEGORIES.SEARCH,
        data: { from: detectedLang, to: 'en' }
      });

      const translationStart = Date.now();
      
      try {
        searchTitle = await translate(title, detectedLang, 'en');
        const translationDuration = Date.now() - translationStart;
        
        logger.system.info('Title translated successfully', {
          category: logger.CATEGORIES.SEARCH,
          data: {
            originalTitle: title,
            translatedTitle: searchTitle,
            duration: translationDuration
          }
        });
      } catch (translationError) {
        logger.system.warn('Translation failed, using original title', {
          category: logger.CATEGORIES.SEARCH,
          error: translationError,
          data: {
            errorMessage: translationError.message
          }
        });
        // Fallback to original title
        searchTitle = title;
      }
    } else {
      logger.system.debug('Title already in English, no translation needed', {
        category: logger.CATEGORIES.SEARCH
      });
    }

    // Step 3: Build search query from (translated) title
    const query = buildSearchQuery(searchTitle);

    logger.system.info('Starting multi-country search', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        originalTitle: title,
        searchTitle: searchTitle,
        searchQuery: query,
        titleLanguage: detectedLang,
        wasTranslated: detectedLang !== 'en',
        countriesCount: NEWS_CONFIG.SEARCH_COUNTRIES.length
      }
    });

    // Step 4: Search across multiple countries in parallel
    logger.system.debug('Launching parallel searches', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        countries: NEWS_CONFIG.SEARCH_COUNTRIES.map(c => c.code),
        maxPerCountry: NEWS_CONFIG.MAX_RESULTS_PER_COUNTRY
      }
    });

    const searchStart = Date.now();
    
    const searchPromises = NEWS_CONFIG.SEARCH_COUNTRIES.map(async (country) => {
      try {
        const articles = await searchNews(query, {
          country: country.code,
          language: country.language,
          maxResults: NEWS_CONFIG.MAX_RESULTS_PER_COUNTRY
        });

        return articles.map(article => ({
          ...article,
          country: country.name,
          countryCode: country.code,
          language: country.language
        }));
      } catch (error) {
        logger.system.warn('Country search failed', {
          category: logger.CATEGORIES.SEARCH,
          error,
          data: { country: country.name }
        });
        return [];
      }
    });

    const allCountryResults = await Promise.all(searchPromises);
    const searchDuration = Date.now() - searchStart;
    const allArticles = allCountryResults.flat();

    logger.system.info('Parallel searches completed', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        totalArticles: allArticles.length,
        duration: searchDuration,
        avgPerCountry: Math.round(allArticles.length / NEWS_CONFIG.SEARCH_COUNTRIES.length)
      }
    });

    // Step 5: Deduplication
    logger.system.debug('Deduplicating results', {
      category: logger.CATEGORIES.SEARCH,
      data: { beforeDedup: allArticles.length }
    });

    const seenUrls = new Set();
    const seenTitles = new Set();
    
    const validPerspectives = allArticles.filter(article => {
      if (!article.link) return false;
      if (articleData.url && article.link === articleData.url) return false;
      if (seenUrls.has(article.link)) return false;
      
      const titleKey = article.title.toLowerCase().replace(/\s+/g, '');
      if (seenTitles.has(titleKey)) return false;
      if (!article.title || article.title.trim().length < 10) return false;

      seenUrls.add(article.link);
      seenTitles.add(titleKey);
      return true;
    });

    logger.system.debug('Deduplication completed', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        beforeDedup: allArticles.length,
        afterDedup: validPerspectives.length,
        removed: allArticles.length - validPerspectives.length
      }
    });

    // Step 6: Ensure country diversity
    const articlesByCountry = new Map();
    validPerspectives.forEach(article => {
      if (!articlesByCountry.has(article.country)) {
        articlesByCountry.set(article.country, []);
      }
      articlesByCountry.get(article.country).push(article);
    });

    const guaranteedFromEachCountry = [];
    const remainingArticles = [];

    for (const [country, countryArticles] of articlesByCountry.entries()) {
      guaranteedFromEachCountry.push(countryArticles[0]);
      if (countryArticles.length > 1) {
        remainingArticles.push(...countryArticles.slice(1));
      }
    }

    const allPrioritizedArticles = [...guaranteedFromEachCountry, ...remainingArticles];

    // Step 7: Add metadata and limit results
    const enrichedPerspectives = allPrioritizedArticles.map(article => ({
      ...article,
      searchQuery: query,
      searchedAt: new Date().toISOString(),
      titleTranslated: detectedLang !== 'en',
      originalTitleLanguage: detectedLang
    }));

    const finalPerspectives = enrichedPerspectives.slice(0, NEWS_CONFIG.FINAL_RESULTS_COUNT);
    const totalDuration = Date.now() - operationStart;

    // Statistics
    const countryStats = {};
    finalPerspectives.forEach(p => {
      countryStats[p.country] = (countryStats[p.country] || 0) + 1;
    });

    logger.system.info('Perspective search completed', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        originalTitle: title,
        searchQuery: query,
        titleTranslated: detectedLang !== 'en',
        totalFound: allArticles.length,
        afterDedup: validPerspectives.length,
        finalCount: finalPerspectives.length,
        countriesRepresented: Object.keys(countryStats).length,
        countryDistribution: countryStats,
        duration: totalDuration
      }
    });

    return finalPerspectives;
  } catch (error) {
    const duration = Date.now() - operationStart;
    
    logger.system.error('Perspective search failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { 
        originalTitle: title,
        duration,
        errorName: error.name,
        errorMessage: error.message
      }
    });

    throw error;
  }
}

/**
 * Get available search countries
 * @returns {Array<Object>} List of country configurations
 */
export function getSearchCountries() {
  return [...NEWS_CONFIG.SEARCH_COUNTRIES];
}

/**
 * Get search configuration
 * @returns {Object} Current configuration
 */
export function getSearchConfig() {
  return {
    maxResultsPerCountry: NEWS_CONFIG.MAX_RESULTS_PER_COUNTRY,
    finalResultsCount: NEWS_CONFIG.FINAL_RESULTS_COUNT,
    countriesCount: NEWS_CONFIG.SEARCH_COUNTRIES.length
  };
}
