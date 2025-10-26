
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
import { detectLanguage } from './languageDetector.js';
import { translate } from './translator.js';
import { PIPELINE_CONFIG } from '../config/pipeline.js';

/**
 * RSS parsing patterns
 */
const REGEX_PATTERNS = {
  ITEM: /<item>([\s\S]*?)<\/item>/g,
  TITLE_CDATA: /<title><!\[CDATA\[(.*?)\]\]><\/title>/,
  TITLE_PLAIN: /<title>(.*?)<\/title>/,
  LINK: /<link>(.*?)<\/link>/,
  PUBDATE: /<pubDate>(.*?)<\/pubDate>/,
  DESC_CDATA: /<description><!\[CDATA\[(.*?)\]\]><\/description>/,
  DESC_PLAIN: /<description>(.*?)<\/description>/
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
    const url = `${PIPELINE_CONFIG.search.rssBaseUrl}?q=${encodedQuery}&${params}`;

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
 * @param {Object} searchConfig - Search configuration with countries and targets
 * @returns {Promise<Array<Object>>} Perspective articles with metadata
 */
export async function fetchPerspectives(title, articleData = {}, searchConfig = null) {
  const operationStart = Date.now();

  if (!title || typeof title !== 'string') {
    throw new Error('Title string is required');
  }

  // Use provided config or fall back to default
  const config = searchConfig || {
    countries: PIPELINE_CONFIG.search.availableCountries.map(c => ({
      code: c.code,
      name: c.name,
      language: c.language,
      fetchTarget: 5
    })),
    totalExpected: PIPELINE_CONFIG.search.availableCountries.length * 5
  };

  logger.system.info('Starting perspective search with title', {
    category: logger.CATEGORIES.SEARCH,
    data: {
      originalTitle: title,
      originalSource: articleData.source,
      countriesCount: config.countries.length,
      totalExpected: config.totalExpected
    }
  });

  try {
    // Step 1: Detect title language with cascading fallback
    logger.system.debug('Detecting title language with fallback support', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        titleLength: title.length,
        hasArticleContent: !!articleData.content,
        contentLength: articleData.content?.length || 0
      }
    });

    // Prepare fallback texts from article content if available
    const fallbackTexts = [];
    if (articleData.content) {
      // First fallback: 500 chars excerpt
      fallbackTexts.push(articleData.content.substring(0, 500));
      // Second fallback: 1500 chars excerpt (will be accepted even with low confidence)
      fallbackTexts.push(articleData.content.substring(0, 1500));
    }

    const detectionResult = await detectLanguage(title, { fallbackTexts });
    const detectedLang = detectionResult.language;

    logger.system.info('Title language detected', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        language: detectedLang,
        languageName: detectionResult.languageName,
        confidence: detectionResult.confidence.toFixed(4),
        attemptUsed: detectionResult.attemptUsed,
        isConfident: detectionResult.isConfident
      }
    });

    // Step 2: Translate to English first (pivot language for better translation quality)
    let englishTitle = title;
    if (detectedLang !== 'en') {
      logger.system.info('Translating title to English (pivot language)', {
        category: logger.CATEGORIES.SEARCH,
        data: { from: detectedLang, to: 'en' }
      });

      const translationStart = Date.now();

      try {
        englishTitle = await translate(title, detectedLang, 'en');
        const translationDuration = Date.now() - translationStart;

        logger.system.info('Title translated to English successfully', {
          category: logger.CATEGORIES.SEARCH,
          data: {
            originalTitle: title,
            englishTitle: englishTitle,
            duration: translationDuration
          }
        });
      } catch (translationError) {
        logger.system.warn('Translation to English failed, using original title', {
          category: logger.CATEGORIES.SEARCH,
          error: translationError,
          data: {
            errorMessage: translationError.message
          }
        });
        // Fallback to original title
        englishTitle = title;
      }
    } else {
      logger.system.debug('Title already in English, no pivot translation needed', {
        category: logger.CATEGORIES.SEARCH
      });
    }

    // Step 3: Pre-translate to all unique languages ONCE
    // This avoids duplicate model downloads for countries with same language
    const uniqueLanguages = [...new Set(config.countries.map(c => c.language))];
    const translationCache = new Map();

    // Add original title to cache if it matches one of the target languages
    translationCache.set(detectedLang, title);
    translationCache.set('en', englishTitle);

    logger.system.debug('Pre-translating to unique languages', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        uniqueLanguages: uniqueLanguages.filter(lang => lang !== 'en' && lang !== detectedLang),
        cacheInitialized: {
          [detectedLang]: 'original',
          en: detectedLang === 'en' ? 'original' : 'translated'
        }
      }
    });

    // Translate to each unique language in parallel
    // This will trigger model downloads if needed (models download on first use)
    const translationPromises = uniqueLanguages
      .filter(lang => lang !== 'en' && lang !== detectedLang)
      .map(async (targetLang) => {
        try {
          logger.system.info('Starting translation (may download model)', {
            category: logger.CATEGORIES.SEARCH,
            data: {
              language: targetLang,
              from: 'en',
              titleLength: englishTitle.length
            }
          });

          const translationStart = Date.now();
          const translated = await translate(englishTitle, 'en', targetLang);
          const translationDuration = Date.now() - translationStart;

          translationCache.set(targetLang, translated);

          logger.system.info('Language pre-translated successfully', {
            category: logger.CATEGORIES.SEARCH,
            data: {
              language: targetLang,
              from: 'en',
              originalTitle: translated,
              duration: translationDuration,
              likelyDownloaded: translationDuration > 2000 // Downloads take >2s
            }
          });
        } catch (error) {
          logger.system.warn('Pre-translation failed, will use English', {
            category: logger.CATEGORIES.SEARCH,
            error,
            data: {
              language: targetLang,
              errorMessage: error.message,
              errorType: error.name
            }
          });
          translationCache.set(targetLang, englishTitle);
        }
      });

    // Wait for all translations (including model downloads) to complete
    logger.system.info('Waiting for all translations to complete', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        totalLanguages: translationPromises.length,
        note: 'This includes model downloads if needed (first use)'
      }
    });

    await Promise.allSettled(translationPromises);

    logger.system.info('All translations completed', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        cachedLanguages: Array.from(translationCache.keys()),
        totalTranslations: translationCache.size
      }
    });

    // Step 4: Search across multiple countries in parallel using cached translations
    logger.system.debug('Launching parallel searches with cached translations', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        countries: config.countries.map(c => `${c.code}:${c.language}:${c.fetchTarget}`),
        totalExpected: config.totalExpected,
        pivotLanguage: 'en',
        cachedLanguages: Array.from(translationCache.keys())
      }
    });

    const searchStart = Date.now();

    const searchPromises = config.countries.map(async (country) => {
      try {
        // Get pre-translated title from cache
        const localizedTitle = translationCache.get(country.language) || englishTitle;

        logger.system.debug('Using cached translation for country', {
          category: logger.CATEGORIES.SEARCH,
          data: {
            country: country.name,
            language: country.language,
            localizedTitle: localizedTitle,
            fromCache: translationCache.has(country.language)
          }
        });

        // Build query with localized title
        const query = buildSearchQuery(localizedTitle);

        logger.system.debug('Searching with localized query', {
          category: logger.CATEGORIES.SEARCH,
          data: {
            country: country.name,
            language: country.language,
            query: query
          }
        });

        const articles = await searchNews(query, {
          country: country.code,
          language: country.language,
          maxResults: country.fetchTarget
        });

        return articles.map(article => ({
          ...article,
          country: country.name,
          countryCode: country.code,
          language: country.language,
          searchQuery: query,
          titleTranslated: detectedLang !== country.language,
          translatedFrom: detectedLang
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
        avgPerCountry: config.countries.length > 0
          ? Math.round(allArticles.length / config.countries.length)
          : 0
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

    for (const [, countryArticles] of articlesByCountry.entries()) {
      guaranteedFromEachCountry.push(countryArticles[0]);
      if (countryArticles.length > 1) {
        remainingArticles.push(...countryArticles.slice(1));
      }
    }

    const allPrioritizedArticles = [...guaranteedFromEachCountry, ...remainingArticles];

    // Step 7: Add metadata - return ALL articles (no slicing here)
    // Article selection will be done by articleSelector.js
    const enrichedPerspectives = allPrioritizedArticles.map(article => ({
      ...article,
      // searchQuery already set in article from country search
      searchedAt: new Date().toISOString(),
      titleTranslated: detectedLang !== 'en',
      originalTitleLanguage: detectedLang
    }));

    const totalDuration = Date.now() - operationStart;

    // Statistics
    const countryStats = {};
    enrichedPerspectives.forEach(p => {
      countryStats[p.country] = (countryStats[p.country] || 0) + 1;
    });

    logger.system.info('Perspective search completed', {
      category: logger.CATEGORIES.SEARCH,
      data: {
        originalTitle: title,
        englishTitle: englishTitle,
        titleTranslated: detectedLang !== 'en',
        totalFound: allArticles.length,
        afterDedup: validPerspectives.length,
        returnedCount: enrichedPerspectives.length,
        countriesRepresented: Object.keys(countryStats).length,
        countryDistribution: countryStats,
        duration: totalDuration,
        translationsCached: translationCache.size
      }
    });

    return enrichedPerspectives;
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

