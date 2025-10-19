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
import { checkAvailability, createSession, compareArticlesProgressive } from '../api/languageModel.js';
import { handleError } from '../utils/errors.js';
import { normalizeLanguageCode } from '../utils/languages.js';
import { fetchPerspectives } from '../api/newsFetcher.js';
import { extractArticlesContentWithTabs } from '../api/contentExtractor.js';
import { getSearchConfigAsync, getSelectionTargetsAsync } from '../config/pipeline.js';
import { selectArticlesByCountry, validateCoverage } from '../api/articleSelector.js';
import { ConfigManager } from '../config/configManager.js';

// Initialize background service
logger.system.info('Background service worker started', {
  category: logger.CATEGORIES.GENERAL
});

// Load and validate user configuration on startup
(async () => {
  try {
    const targets = await getSelectionTargetsAsync();
    logger.system.info('User configuration loaded', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        countries: Object.keys(targets.perCountry),
        totalArticles: targets.total
      }
    });
  } catch (error) {
    logger.system.error('Failed to load user configuration', {
      category: logger.CATEGORIES.GENERAL,
      error
    });
  }
})();

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
 * Listen for configuration updates
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CONFIG_UPDATED') {
    logger.system.info('Configuration updated, reloading pipeline config', {
      category: logger.CATEGORIES.GENERAL
    });
    // Configuration will be loaded fresh on next analysis
    return;
  }
});

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
          data: {
            duration,
            articlesAnalyzed: response.analysis?.metadata?.articlesAnalyzed || 0,
            perspectivesFound: response.perspectives?.length || 0
          }
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
      // Get search configuration from user settings (merged with defaults)
      const searchConfig = await getSearchConfigAsync();

      logger.system.debug('Using search configuration', {
        category: logger.CATEGORIES.SEARCH,
        data: {
          countries: searchConfig.countries.map(c => `${c.code}:${c.fetchTarget}`),
          totalExpected: searchConfig.totalExpected
        }
      });

      // Pass search config to newsFetcher
      perspectives = await fetchPerspectives(articleData.title, articleData, searchConfig);

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
            note: 'Extracting ALL articles, selection happens later'
          }
        });

        logger.progress(logger.CATEGORIES.FETCH, {
          status: 'active',
          userMessage: `Processing ${perspectives.length} articles...`,
          systemMessage: `Starting batch extraction with parallel processing`,
          progress: 20
        });

        // Extract content from ALL articles (no limit here)
        // Configuration from pipeline.js is used as defaults
        perspectivesWithContent = await extractArticlesContentWithTabs(perspectives);

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

    // Step 3.5: Intelligent Article Selection
    logger.progress(logger.CATEGORIES.GENERAL, {
      status: 'active',
      userMessage: 'Selecting best articles per country...',
      progress: 0
    });

    let selectedArticles = [];
    try {
      const articlesWithContent = perspectivesWithContent.filter(p => p.contentExtracted);

      // Load user selection targets
      const selectionTargets = await getSelectionTargetsAsync();

      logger.system.info('Starting intelligent article selection', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          availableArticles: articlesWithContent.length,
          selectionTargets: selectionTargets.perCountry
        }
      });

      // Validate coverage before selection
      const coverageValidation = validateCoverage(articlesWithContent);

      if (!coverageValidation.valid) {
        logger.user.warn('Insufficient articles from some countries', {
          category: logger.CATEGORIES.SEARCH,
          data: {
            coverage: `${Math.round(coverageValidation.coverage)}%`,
            issues: coverageValidation.issues
          }
        });
      }

      // Select best articles per country (pass user targets)
      const selectionResult = selectArticlesByCountry(articlesWithContent, selectionTargets);
      selectedArticles = selectionResult.articles;

      logger.progress(logger.CATEGORIES.GENERAL, {
        status: 'completed',
        userMessage: `Selected ${selectedArticles.length} articles for analysis`,
        systemMessage: `Smart selection: ${selectedArticles.length} articles from ${Object.keys(selectionResult.metadata.selectionByCountry).length} countries`,
        progress: 100,
        data: selectionResult.metadata
      });
    } catch (error) {
      logger.system.error('Article selection failed, using all available', {
        category: logger.CATEGORIES.GENERAL,
        error,
        data: { fallbackCount: perspectivesWithContent.filter(p => p.contentExtracted).length }
      });

      // Fallback: use all articles with content
      selectedArticles = perspectivesWithContent.filter(p => p.contentExtracted);
    }

    // Step 4: Compare perspectives
    logger.progress(logger.CATEGORIES.ANALYZE, {
      status: 'active',
      userMessage: 'Performing comparative analysis with AI...',
      progress: 0
    });

    let comparativeAnalysis = null;
    try {
      logger.system.debug('Checking if analysis should run', {
        category: logger.CATEGORIES.ANALYZE,
        data: {
          selectedArticles: selectedArticles.length,
          threshold: 2,
          shouldAnalyze: selectedArticles.length >= 2
        }
      });

      if (selectedArticles.length >= 2) {
        logger.system.info('Starting progressive multi-stage analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            articlesCount: selectedArticles.length,
            stages: 4,
            note: 'Using centralized config for analysis parameters'
          }
        });

        logger.progress(logger.CATEGORIES.ANALYZE, {
          status: 'active',
          userMessage: `Starting analysis of ${selectedArticles.length} articles...`,
          systemMessage: `Running progressive 4-stage analysis`,
          progress: 10,
          data: { articlesCount: selectedArticles.length }
        });

        const analysisResult = await compareArticlesProgressive(
          selectedArticles,
          // Stage completion callback - updates UI progressively
          async (stageNumber, stageData) => {
            logger.system.info(`Stage ${stageNumber}/4 completed, updating UI`, {
              category: logger.CATEGORIES.ANALYZE,
              data: {
                stage: stageNumber,
                name: stageData.name,
                dataKeys: Object.keys(stageData.data)
              }
            });

            // Send progressive update to content script
            try {
              const tabs = await chrome.tabs.query({ url: articleData.url });
              if (tabs.length > 0) {
                await chrome.tabs.sendMessage(tabs[0].id, {
                  type: 'ANALYSIS_STAGE_COMPLETE',
                  data: {
                    stage: stageNumber,
                    stageData: stageData.data,
                    perspectives: selectedArticles, // Send only selected articles
                    articleData
                  }
                });

                logger.system.debug(`Stage ${stageNumber} update sent to UI`, {
                  category: logger.CATEGORIES.ANALYZE,
                  data: { tabId: tabs[0].id, stage: stageNumber }
                });
              }
            } catch (error) {
              logger.system.warn('Failed to send stage update to UI', {
                category: logger.CATEGORIES.ANALYZE,
                error,
                data: { stage: stageNumber }
              });
            }

            // Update progress bar
            const progress = 10 + (stageNumber / 4) * 80; // 10-90%
            const stageNames = ['Context & Trust', 'Consensus', 'Disputes', 'Perspectives'];
            logger.progress(logger.CATEGORIES.ANALYZE, {
              status: 'active',
              userMessage: `Stage ${stageNumber}/4: ${stageNames[stageNumber - 1]} complete`,
              progress
            });
          }
          // Options from PIPELINE_CONFIG are used as defaults
        );

        logger.system.debug('Raw analysis result from compareArticlesProgressive', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            hasStory: !!analysisResult.story_summary,
            hasGuidance: !!analysisResult.reader_guidance,
            hasConsensus: !!analysisResult.consensus,
            consensusType: typeof analysisResult.consensus,
            consensusSize: analysisResult.consensus ? (Array.isArray(analysisResult.consensus) ? analysisResult.consensus.length : Object.keys(analysisResult.consensus).length) : 0,
            hasDifferences: !!analysisResult.key_differences,
            differencesCount: analysisResult.key_differences?.length || 0,
            hasProcessedArticles: !!analysisResult.processedArticles,
            processedArticlesCount: analysisResult.processedArticles?.length || 0,
            allKeys: Object.keys(analysisResult)
          }
        });

        // Extract processedArticles, keep rest as analysis
        const articlesWithSummaries = analysisResult.processedArticles;
        comparativeAnalysis = analysisResult; // Assign to outer scope (declared on line 334)

        // Update selectedArticles with summaries from processed articles
        if (articlesWithSummaries && articlesWithSummaries.length > 0) {
          // Create a map for quick lookup
          const summaryMap = new Map(
            articlesWithSummaries.map(a => [a.source, a])
          );

          // Merge summaries into selected articles
          selectedArticles = selectedArticles.map(article => {
            const processedArticle = summaryMap.get(article.source);
            if (processedArticle) {
              return {
                ...article,
                summary: processedArticle.summary,
                compressedContent: processedArticle.compressedContent,
                compressionRatio: processedArticle.compressionRatio,
                originalContentLength: processedArticle.originalContentLength,
                compressedContentLength: processedArticle.compressedContentLength
              };
            }
            return article;
          });

          logger.system.info('Summaries merged into selected articles', {
            category: logger.CATEGORIES.ANALYZE,
            data: {
              totalArticles: selectedArticles.length,
              articlesWithSummary: selectedArticles.filter(a => a.summary).length
            }
          });
        }

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
              articlesAnalyzed: comparativeAnalysis.metadata?.articlesAnalyzed || 0,
              compressionUsed: comparativeAnalysis.metadata?.compressionUsed || false,
              inputLength: comparativeAnalysis.metadata?.totalInputLength || 0
            }
          });

          logger.progress(logger.CATEGORIES.ANALYZE, {
            status: 'completed',
            userMessage: 'Analysis complete',
            systemMessage: 'Comparative analysis completed successfully',
            progress: 100
          });
        }
      } else {
        logger.system.warn('Insufficient articles for analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            articlesFound: selectedArticles.length,
            required: 2
          }
        });

        logger.user.warn('Not enough articles for analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            message: `Found ${selectedArticles.length} article(s), need at least 2`
          }
        });

        logger.progress(logger.CATEGORIES.ANALYZE, {
          status: 'error',
          userMessage: `Need at least 2 articles for analysis (found ${selectedArticles.length})`
        });
      }
    } catch (error) {
      logger.system.error('Analysis failed catastrophically', {
        category: logger.CATEGORIES.ANALYZE,
        error,
        data: {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          errorCode: error.code,
          selectedArticles: selectedArticles?.length || 0,
          // Check for specific error types
          isNotSupportedError: error.name === 'NotSupportedError',
          isQuotaError: error.message?.includes('quota') || error.message?.includes('context'),
          isModelError: error.message?.includes('model'),
          isParseError: error.message?.includes('parse') || error.message?.includes('JSON')
        }
      });

      // Provide more specific user feedback based on error type
      let userMessage = 'Please try again or contact support';
      if (error.name === 'NotSupportedError') {
        userMessage = 'AI model not available. Please check chrome://on-device-internals';
      } else if (error.message?.includes('quota') || error.message?.includes('context')) {
        userMessage = 'Content too large. Try analyzing fewer articles.';
      } else if (error.message?.includes('model')) {
        userMessage = 'AI model error. Try restarting Chrome.';
      } else if (error.message?.includes('parse') || error.message?.includes('JSON')) {
        userMessage = 'Model returned invalid format. Please try again.';
      }

      logger.user.error('Analysis could not be completed', {
        category: logger.CATEGORIES.ANALYZE,
        data: { message: userMessage }
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
        logger.system.debug('Attempting to send analysis to content script', {
          category: logger.CATEGORIES.GENERAL,
          data: {
            hasAnalysis: !!comparativeAnalysis,
            hasStory: !!comparativeAnalysis.story_summary,
            hasGuidance: !!comparativeAnalysis.reader_guidance,
            hasConsensus: !!comparativeAnalysis.consensus,
            hasDifferences: !!comparativeAnalysis.key_differences,
            selectedArticlesCount: selectedArticles.length,
            url: articleData.url
          }
        });

        const tabs = await chrome.tabs.query({ url: articleData.url });

        logger.system.debug('Tabs query result', {
          category: logger.CATEGORIES.GENERAL,
          data: { tabsFound: tabs.length, url: articleData.url }
        });

        if (tabs.length > 0) {
          logger.system.debug('Sending message to tab', {
            category: logger.CATEGORIES.GENERAL,
            data: {
              tabId: tabs[0].id,
              messageType: 'SHOW_ANALYSIS',
              dataKeys: Object.keys(comparativeAnalysis),
              articlesCount: selectedArticles.length
            }
          });

          const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SHOW_ANALYSIS',
            data: {
              analysis: comparativeAnalysis,
              perspectives: selectedArticles, // Send only selected articles
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
          category: logger.CATEGORIES.ERROR,
          error,
          data: {
            errorName: error.name,
            errorMessage: error.message,
            hasComparativeAnalysis: !!comparativeAnalysis
          }
        });
      }
    } else {
      logger.system.warn('No comparative analysis to send', {
        category: logger.CATEGORIES.GENERAL
      });
    }

    logger.both.info('Article processed successfully', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        status: result.status,
        selectedArticlesCount: selectedArticles.length,
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
