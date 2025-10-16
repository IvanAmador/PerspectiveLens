/**
 * PerspectiveLens Background Service Worker
 * Coordinates AI processing, API calls, and message handling
 * 
 * Processing Pipeline (Simplified):
 * 1. Content already extracted by content script
 * 2. Search perspectives using title (with automatic translation)
 * 3. Extract content from perspective articles
 * 4. Comparative analysis with Gemini Nano
 */

import { logger } from '../utils/logger.js';
import { checkAvailability, createSession, compareArticles } from '../api/languageModel.js';
import { handleError } from '../utils/errors.js';
import { normalizeLanguageCode } from '../utils/languages.js';
import { fetchPerspectives } from '../api/newsFetcher.js';
import { extractArticlesContentWithTabs } from '../api/contentExtractor.js';

// Initialize background service
logger.system.info('Background service worker started', {
  category: logger.CATEGORIES.GENERAL
});

/**
 * Global download state (persists while service worker is active)
 */
let downloadState = {
  inProgress: false,
  progress: 0,
  session: null
};

/**
 * Cache for AI availability (avoid checking every 2 seconds)
 */
let aiAvailabilityCache = {
  status: null,
  timestamp: null,
  cacheDuration: 30000 // Cache for 30 seconds
};

/**
 * Active analysis tracker for request correlation
 */
let activeAnalysis = {
  tabId: null,
  requestId: null
};

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.system.debug('Message received', {
    category: logger.CATEGORIES.GENERAL,
    data: { type: message.type, tabId: sender.tab?.id }
  });

  // Handle async responses
  if (message.type === 'START_ANALYSIS') {
    // Store tab ID for progress updates and start request tracking
    activeAnalysis.tabId = sender.tab?.id || null;
    activeAnalysis.requestId = logger.startRequest('article_analysis');

    handleNewArticle(message.data)
      .then(response => {
        const duration = logger.endRequest(activeAnalysis.requestId);
        logger.both.info('Analysis completed successfully', {
          category: logger.CATEGORIES.GENERAL,
          data: { duration, articlesAnalyzed: response.perspectives?.length || 0 }
        });
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        logger.endRequest(activeAnalysis.requestId);
        const errorInfo = handleError(error, 'handleNewArticle');
        logger.user.error('Analysis failed', {
          category: logger.CATEGORIES.ERROR,
          error,
          data: { errorInfo }
        });
        sendResponse({ success: false, error: errorInfo });
      })
      .finally(() => {
        activeAnalysis.tabId = null;
        logger.clearRequest();
      });

    return true;
  }

  // Legacy support for old message type
  if (message.type === 'NEW_ARTICLE_DETECTED') {
    activeAnalysis.tabId = sender.tab?.id || null;
    activeAnalysis.requestId = logger.startRequest('article_analysis');

    handleNewArticle(message.data)
      .then(response => {
        const duration = logger.endRequest(activeAnalysis.requestId);
        logger.system.info('Analysis completed', {
          category: logger.CATEGORIES.GENERAL,
          data: { duration }
        });
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        logger.endRequest(activeAnalysis.requestId);
        const errorInfo = handleError(error, 'handleNewArticle');
        sendResponse({ success: false, error: errorInfo });
      })
      .finally(() => {
        activeAnalysis.tabId = null;
        logger.clearRequest();
      });

    return true;
  }

  if (message.type === 'GET_STATUS') {
    getExtensionStatus()
      .then(status => sendResponse({ success: true, status }))
      .catch(error => {
        const errorInfo = handleError(error, 'getStatus');
        sendResponse({ success: false, error: errorInfo });
      });

    return true;
  }

  if (message.type === 'START_MODEL_DOWNLOAD') {
    startModelDownload()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        const errorInfo = handleError(error, 'startModelDownload');
        sendResponse({ success: false, error: errorInfo });
      });

    return true;
  }

  if (message.type === 'CLEAR_CACHE') {
    clearCache()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        const errorInfo = handleError(error, 'clearCache');
        sendResponse({ success: false, error: errorInfo });
      });

    return true;
  }
});

/**
 * Process new article detection from content script
 * Simplified Pipeline: Search Perspectives → Extract Content → Analyze
 */
async function handleNewArticle(articleData) {
  logger.system.info('Processing new article', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      url: articleData.url,
      title: articleData.title,
      source: articleData.source,
      language: articleData.language,
      contentLength: articleData.content?.length || 0
    }
  });

  try {
    // Step 1: Content already extracted by content script
    logger.progress(logger.CATEGORIES.EXTRACT, {
      status: 'completed',
      userMessage: 'Content extracted successfully',
      progress: 100
    });

    // Step 2: Fetch perspectives (with automatic translation)
    logger.progress(logger.CATEGORIES.SEARCH, {
      status: 'active',
      userMessage: 'Searching for related articles globally...',
      progress: 0
    });

    let perspectives = [];
    try {
      // Simply pass the title - newsFetcher handles translation automatically
      perspectives = await fetchPerspectives(articleData.title, articleData);
      
      logger.system.info('Perspectives fetched successfully', {
        category: logger.CATEGORIES.SEARCH,
        data: {
          total: perspectives.length,
          countries: [...new Set(perspectives.map(p => p.country))].length
        }
      });

      logger.progress(logger.CATEGORIES.SEARCH, {
        status: 'completed',
        userMessage: `Found ${perspectives.length} articles from multiple countries`,
        systemMessage: `Found ${perspectives.length} articles from ${[...new Set(perspectives.map(p => p.country))].length} countries`,
        progress: 100,
        data: { 
          total: perspectives.length,
          byCountry: perspectives.reduce((acc, p) => {
            acc[p.country] = (acc[p.country] || 0) + 1;
            return acc;
          }, {})
        }
      });
    } catch (error) {
      logger.system.error('Failed to fetch perspectives', {
        category: logger.CATEGORIES.SEARCH,
        error,
        data: { title: articleData.title }
      });

      logger.user.warn('Search encountered issues', {
        category: logger.CATEGORIES.SEARCH,
        data: { message: 'Continuing with available results' }
      });

      logger.progress(logger.CATEGORIES.SEARCH, {
        status: 'error',
        userMessage: 'Search completed with errors'
      });
    }

    // Step 3: Extract content from perspectives
    logger.progress(logger.CATEGORIES.FETCH, {
      status: 'active',
      userMessage: 'Fetching article content...',
      progress: 0
    });

    let perspectivesWithContent = perspectives;
    try {
      if (perspectives.length > 0) {
        logger.system.debug('Starting content extraction', {
          category: logger.CATEGORIES.FETCH,
          data: { 
            articlesCount: perspectives.length,
            config: { maxArticles: 10, timeout: 20000, parallel: true, batchSize: 10 }
          }
        });

        logger.progress(logger.CATEGORIES.FETCH, {
          status: 'active',
          userMessage: `Processing ${perspectives.length} articles...`,
          systemMessage: `Starting batch extraction with parallel processing`,
          progress: 20
        });

        perspectivesWithContent = await extractArticlesContentWithTabs(perspectives, {
          maxArticles: 5,
          timeout: 20000,
          parallel: true,
          batchSize: 10
        });

        const extractedCount = perspectivesWithContent.filter(p => p.contentExtracted).length;
        
        logger.system.info('Content extraction completed', {
          category: logger.CATEGORIES.FETCH,
          data: {
            successful: extractedCount,
            total: perspectives.length,
            successRate: `${((extractedCount / perspectives.length) * 100).toFixed(1)}%`
          }
        });

        logger.progress(logger.CATEGORIES.FETCH, {
          status: 'completed',
          userMessage: `Extracted content from ${extractedCount} articles`,
          systemMessage: `Successfully extracted ${extractedCount}/${perspectives.length} articles`,
          progress: 100,
          data: { successful: extractedCount, total: perspectives.length }
        });

        // Log sample of extracted content (system only)
        perspectivesWithContent
          .filter(p => p.contentExtracted)
          .slice(0, 3)
          .forEach(article => {
            logger.system.trace('Sample extraction result', {
              category: logger.CATEGORIES.FETCH,
              data: {
                source: article.source,
                title: article.title.substring(0, 60),
                finalUrl: article.finalUrl,
                method: article.extractionMethod,
                contentLength: article.extractedContent?.textContent?.length || 0,
                excerpt: article.extractedContent?.excerpt?.substring(0, 150)
              }
            });
          });
      } else {
        logger.progress(logger.CATEGORIES.FETCH, {
          status: 'completed',
          userMessage: 'No articles to fetch',
          progress: 100
        });
      }
    } catch (error) {
      logger.system.error('Content extraction failed', {
        category: logger.CATEGORIES.FETCH,
        error,
        data: { articlesAttempted: perspectives.length }
      });

      logger.user.warn('Some articles could not be loaded', {
        category: logger.CATEGORIES.FETCH,
        data: { message: 'Continuing with available content' }
      });

      logger.progress(logger.CATEGORIES.FETCH, {
        status: 'error',
        userMessage: 'Content extraction encountered errors'
      });

      perspectivesWithContent = perspectives;
    }

    // Step 4: Compare perspectives
    logger.progress(logger.CATEGORIES.ANALYZE, {
      status: 'active',
      userMessage: 'Performing comparative analysis with AI...',
      progress: 0
    });

    let comparativeAnalysis = null;
    try {
      const articlesWithContent = perspectivesWithContent.filter(p => p.contentExtracted);
      
      if (articlesWithContent.length >= 2) {
        logger.system.info('Starting comparative analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            articlesCount: articlesWithContent.length,
            optimizations: {
              compression: true,
              validation: true,
              maxArticles: 8
            }
          }
        });

        logger.progress(logger.CATEGORIES.ANALYZE, {
          status: 'active',
          userMessage: `Analyzing ${articlesWithContent.length} articles...`,
          systemMessage: `Running optimized analysis with compression and validation`,
          progress: 30,
          data: { articlesCount: articlesWithContent.length }
        });

        comparativeAnalysis = await compareArticles(articlesWithContent, {
          useCompression: true,
          validateContent: true,
          maxArticles: 4,
          compressionLevel: 'long',
          useV2Prompt: true
        });

        if (comparativeAnalysis.error) {
          logger.system.warn('Analysis completed with warnings', {
            category: logger.CATEGORIES.ANALYZE,
            data: { metadata: comparativeAnalysis.metadata }
          });

          logger.user.warn('Analysis completed with warnings', {
            category: logger.CATEGORIES.ANALYZE,
            data: { message: 'Some results may be incomplete' }
          });

          logger.progress(logger.CATEGORIES.ANALYZE, {
            status: 'completed',
            userMessage: 'Analysis completed with warnings',
            progress: 100
          });
        } else {
          logger.system.info('Analysis completed successfully', {
            category: logger.CATEGORIES.ANALYZE,
            data: {
              consensus: comparativeAnalysis.consensus?.length || 0,
              disputes: comparativeAnalysis.disputes?.length || 0,
              omissions: Object.keys(comparativeAnalysis.omissions || {}).length,
              biasIndicators: comparativeAnalysis.bias_indicators?.length || 0,
              articlesAnalyzed: comparativeAnalysis.metadata?.articlesAnalyzed || 0,
              compressionUsed: comparativeAnalysis.metadata?.compressionUsed || false,
              inputLength: comparativeAnalysis.metadata?.totalInputLength || 0
            }
          });

          const stats = `${comparativeAnalysis.consensus?.length || 0} consensus, ${comparativeAnalysis.disputes?.length || 0} disputes`;
          
          logger.progress(logger.CATEGORIES.ANALYZE, {
            status: 'completed',
            userMessage: `Analysis complete: ${stats}`,
            systemMessage: `Full analysis: ${stats}, ${comparativeAnalysis.bias_indicators?.length || 0} bias indicators`,
            progress: 100,
            data: {
              consensus: comparativeAnalysis.consensus?.length || 0,
              disputes: comparativeAnalysis.disputes?.length || 0,
              biasIndicators: comparativeAnalysis.bias_indicators?.length || 0
            }
          });
        }
      } else {
        logger.system.warn('Insufficient articles for analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            articlesFound: articlesWithContent.length,
            required: 2
          }
        });

        logger.user.warn('Not enough articles for analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            message: `Found ${articlesWithContent.length} article(s), need at least 2`
          }
        });

        logger.progress(logger.CATEGORIES.ANALYZE, {
          status: 'error',
          userMessage: `Need at least 2 articles for analysis (found ${articlesWithContent.length})`
        });
      }
    } catch (error) {
      logger.system.error('Analysis failed catastrophically', {
        category: logger.CATEGORIES.ANALYZE,
        error
      });

      logger.user.error('Analysis could not be completed', {
        category: logger.CATEGORIES.ANALYZE,
        data: { message: 'Please try again or contact support' }
      });

      logger.progress(logger.CATEGORIES.ANALYZE, {
        status: 'error',
        userMessage: 'Analysis failed'
      });
    }

    // Prepare result (no keywords field)
    const result = {
      articleData,
      perspectives: perspectivesWithContent,
      analysis: comparativeAnalysis,
      sourceLanguage: normalizeLanguageCode(articleData.language || 'en'),
      status: comparativeAnalysis ? 'analysis_complete' :
              perspectivesWithContent.length > 0 ? 'content_extracted' : 'perspectives_found',
      timestamp: new Date().toISOString()
    };

    // Update statistics (no keywordsExtracted)
    try {
      const storage = await chrome.storage.local.get(['stats']);
      const stats = storage.stats || {
        articlesAnalyzed: 0,
        perspectivesFound: 0
      };

      stats.articlesAnalyzed += 1;
      stats.perspectivesFound += perspectives.length;

      await chrome.storage.local.set({ stats });
      
      logger.system.debug('Statistics updated', {
        category: logger.CATEGORIES.GENERAL,
        data: stats
      });
    } catch (error) {
      logger.system.warn('Failed to update statistics', {
        category: logger.CATEGORIES.GENERAL,
        error
      });
    }

    // Send analysis to content script for UI display
    if (comparativeAnalysis) {
      try {
        const tabs = await chrome.tabs.query({ url: articleData.url });
        
        logger.system.debug('Sending analysis to content script', {
          category: logger.CATEGORIES.GENERAL,
          data: { tabsFound: tabs.length, url: articleData.url }
        });

        if (tabs.length > 0) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SHOW_ANALYSIS',
            data: {
              analysis: comparativeAnalysis,
              perspectives: perspectivesWithContent,
              articleData
            }
          });

          logger.system.info('Analysis sent to UI successfully', {
            category: logger.CATEGORIES.GENERAL,
            data: { tabId: tabs[0].id, response }
          });
        } else {
          logger.system.warn('No matching tabs found for URL', {
            category: logger.CATEGORIES.GENERAL,
            data: { url: articleData.url }
          });
        }
      } catch (error) {
        logger.system.error('Failed to send analysis to content script', {
          category: logger.CATEGORIES.GENERAL,
          error
        });
      }
    }

    logger.both.info('Article processed successfully', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        status: result.status,
        perspectivesCount: perspectivesWithContent.length,
        hasAnalysis: !!comparativeAnalysis
      }
    });

    return result;
  } catch (error) {
    logger.system.error('Article processing failed', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { url: articleData.url }
    });
    throw error;
  }
}

/**
 * Get extension status for popup (with caching to reduce API calls)
 */
async function getExtensionStatus() {
  try {
    let aiStatus = {
      availability: 'unavailable',
      downloadProgress: 0
    };

    // Check if LanguageModel API is available (official way)
    if (typeof self.LanguageModel !== 'undefined') {
      try {
        const now = Date.now();
        const cacheValid = aiAvailabilityCache.status &&
          aiAvailabilityCache.timestamp &&
          (now - aiAvailabilityCache.timestamp) < aiAvailabilityCache.cacheDuration;

        let availability;
        if (cacheValid) {
          availability = aiAvailabilityCache.status;
          logger.system.trace('Using cached AI availability', {
            category: logger.CATEGORIES.GENERAL,
            data: { availability }
          });
        } else {
          availability = await checkAvailability();
          aiAvailabilityCache.status = availability;
          aiAvailabilityCache.timestamp = now;
          logger.system.debug('AI availability checked', {
            category: logger.CATEGORIES.GENERAL,
            data: { availability }
          });
        }

        aiStatus.availability = availability;

        if (availability === 'downloading' && downloadState.inProgress) {
          aiStatus.downloadProgress = downloadState.progress;
        }
      } catch (error) {
        logger.system.error('Failed to check AI availability', {
          category: logger.CATEGORIES.ERROR,
          error
        });
      }
    } else {
      logger.system.warn('LanguageModel API not available in environment', {
        category: logger.CATEGORIES.GENERAL,
        data: { 
          hasLanguageModel: typeof self.LanguageModel !== 'undefined',
          chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown',
          recommendation: 'Enable chrome://flags/#prompt-api-for-gemini-nano'
        }
      });
    }

    const storage = await chrome.storage.local.get(['cache', 'stats']);
    const cache = storage.cache || [];
    const stats = storage.stats || {
      articlesAnalyzed: 0,
      perspectivesFound: 0
    };

    const status = {
      aiStatus,
      stats: {
        articlesAnalyzed: stats.articlesAnalyzed,
        cacheCount: cache.length,
        perspectivesFound: stats.perspectivesFound
      },
      timestamp: new Date().toISOString()
    };

    logger.system.debug('Extension status retrieved', {
      category: logger.CATEGORIES.GENERAL,
      data: status
    });

    return status;
  } catch (error) {
    logger.system.error('Failed to get extension status', {
      category: logger.CATEGORIES.ERROR,
      error
    });
    
    // Return fallback status instead of throwing
    return {
      aiStatus: {
        availability: 'unavailable',
        downloadProgress: 0
      },
      stats: {
        articlesAnalyzed: 0,
        cacheCount: 0,
        perspectivesFound: 0
      },
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Start AI model download in background
 */
async function startModelDownload() {
  if (downloadState.inProgress) {
    logger.system.warn('Model download already in progress', {
      category: logger.CATEGORIES.GENERAL,
      data: { progress: downloadState.progress }
    });
    return;
  }

  try {
    logger.both.info('Starting AI model download', {
      category: logger.CATEGORIES.GENERAL
    });

    downloadState.inProgress = true;
    downloadState.progress = 0;

    const session = await createSession({}, (progress) => {
      downloadState.progress = progress;
      logger.system.debug('Download progress update', {
        category: logger.CATEGORIES.GENERAL,
        data: { progress }
      });
    });

    downloadState.inProgress = false;
    downloadState.progress = 100;
    downloadState.session = session;

    logger.both.info('AI model download completed', {
      category: logger.CATEGORIES.GENERAL
    });

    session.destroy();
    downloadState.session = null;
  } catch (error) {
    downloadState.inProgress = false;
    downloadState.progress = 0;
    
    logger.both.error('Model download failed', {
      category: logger.CATEGORIES.ERROR,
      error
    });
    
    throw error;
  }
}

/**
 * Clear cache
 */
async function clearCache() {
  try {
    logger.system.info('Clearing cache', {
      category: logger.CATEGORIES.GENERAL
    });

    await chrome.storage.local.set({ cache: [] });

    logger.both.info('Cache cleared successfully', {
      category: logger.CATEGORIES.GENERAL
    });
  } catch (error) {
    logger.system.error('Failed to clear cache', {
      category: logger.CATEGORIES.ERROR,
      error
    });
    throw error;
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  logger.system.info('Extension installed/updated', {
    category: logger.CATEGORIES.GENERAL,
    data: { reason }
  });

  if (reason === 'install') {
    logger.system.info('First install - initializing storage', {
      category: logger.CATEGORIES.GENERAL
    });

    chrome.storage.local.set({
      settings: {
        autoAnalyze: true,
        maxCacheSize: 100,
        defaultLanguage: 'en'
      },
      cache: [],
      stats: {
        articlesAnalyzed: 0,
        perspectivesFound: 0
      }
    });
  }
});

/**
 * Handle extension errors
 */
self.addEventListener('error', (event) => {
  logger.system.error('Unhandled error in service worker', {
    category: logger.CATEGORIES.ERROR,
    error: event.error
  });
  handleError(event.error, 'ServiceWorker');
});

self.addEventListener('unhandledrejection', (event) => {
  logger.system.error('Unhandled promise rejection', {
    category: logger.CATEGORIES.ERROR,
    error: event.reason
  });
  handleError(event.reason, 'ServiceWorker:Promise');
});

logger.system.info('Background service worker initialized', {
  category: logger.CATEGORIES.GENERAL
});
