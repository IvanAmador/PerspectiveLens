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
import { GeminiAPI } from '../api/geminiAPI.js';
import { ModelRouter, MODEL_DISPLAY_NAMES } from '../api/modelRouter.js';
import { APIKeyManager } from '../config/apiKeyManager.js';
import { handleError } from '../utils/errors.js';
import { normalizeLanguageCode } from '../utils/languages.js';
import { fetchPerspectives } from '../api/newsFetcher.js';
import { extractArticlesContentWithTabs } from '../api/contentExtractor.js';
import { getSearchConfigAsync, getSelectionTargetsAsync } from '../config/pipeline.js';
import { selectArticlesByCountry, validateCoverage } from '../api/articleSelector.js';
import { ConfigManager } from '../config/configManager.js';
import { rateLimitCache } from '../utils/rateLimitCache.js';

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
 * Cache for configuration (updated when CONFIG_UPDATED message received)
 * This avoids reloading from storage on every operation
 */
let configCache = null;

/**
 * Load configuration into cache
 */
async function reloadConfigCache() {
  try {
    configCache = await ConfigManager.load();
    logger.system.info('Configuration cache reloaded', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        modelProvider: configCache.analysis.modelProvider,
        countries: Object.keys(configCache.articleSelection?.perCountry || {}),
        cacheTimestamp: new Date().toISOString()
      }
    });
    return configCache;
  } catch (error) {
    logger.system.error('Failed to reload config cache', {
      category: logger.CATEGORIES.GENERAL,
      error
    });
    // Return existing cache or null
    return configCache;
  }
}

/**
 * Get configuration (from cache if available, otherwise load)
 */
async function getConfig() {
  if (!configCache) {
    await reloadConfigCache();
  }
  return configCache;
}

/**
 * Active analysis tracker for request correlation
 */
let activeAnalysis = {
  tabId: null,
  requestId: null,
  inProgress: false
};

/**
 * Listen for configuration updates
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONFIG_UPDATED') {
    logger.system.info('Configuration updated, reloading cache immediately', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        receivedConfig: !!message.config,
        timestamp: new Date().toISOString()
      }
    });

    // Reload config cache immediately and respond when done
    reloadConfigCache().then((newConfig) => {
      logger.system.info('Configuration cache updated successfully', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          modelProvider: newConfig?.analysis?.modelProvider,
          countries: Object.keys(newConfig?.articleSelection?.perCountry || {}),
          preferredModels: newConfig?.analysis?.preferredModels
        }
      });
      sendResponse({ success: true });
    }).catch(error => {
      logger.system.error('Failed to update config cache', {
        category: logger.CATEGORIES.GENERAL,
        error
      });
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep channel open for async response
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
    // Check if analysis is already in progress
    if (activeAnalysis.inProgress) {
      logger.system.warn('Analysis already in progress, rejecting new request', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          currentTabId: activeAnalysis.tabId,
          requestedTabId: sender.tab?.id
        }
      });
      sendResponse({
        success: false,
        error: 'Another analysis is already in progress. Please wait for it to complete.'
      });
      return true;
    }

    // Store tab ID for progress updates and start request tracking
    const tabId = sender.tab?.id || null;
    activeAnalysis.tabId = tabId;
    activeAnalysis.inProgress = true;

    // Start request with tabId context
    activeAnalysis.requestId = logger.startRequest('article_analysis', tabId);

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
        activeAnalysis.inProgress = false;
        logger.clearRequest();
      });

    return true;
  }

  // Legacy support for old message type
  if (message.type === 'NEW_ARTICLE_DETECTED') {
    // Check if analysis is already in progress
    if (activeAnalysis.inProgress) {
      logger.system.warn('Analysis already in progress, rejecting legacy request', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          currentTabId: activeAnalysis.tabId,
          requestedTabId: sender.tab?.id
        }
      });
      sendResponse({
        success: false,
        error: 'Another analysis is already in progress. Please wait for it to complete.'
      });
      return true;
    }

    const tabId = sender.tab?.id || null;
    activeAnalysis.tabId = tabId;
    activeAnalysis.inProgress = true;
    activeAnalysis.requestId = logger.startRequest('article_analysis', tabId);

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
        activeAnalysis.inProgress = false;
        logger.clearRequest();
      });

    return true;
  }

  if (message.type === 'IS_EXTRACTION_TAB') {
    // Check if the sender's tab is marked as an extraction tab
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: true, isExtractionTab: false });
      return true;
    }

    chrome.storage.session.get(`extractionTab_${tabId}`)
      .then(result => {
        const isExtractionTab = !!result[`extractionTab_${tabId}`];
        sendResponse({ success: true, isExtractionTab });
      })
      .catch(error => {
        logger.system.warn('Failed to check extraction tab status', {
          category: logger.CATEGORIES.GENERAL,
          error,
          data: { tabId }
        });
        sendResponse({ success: true, isExtractionTab: false });
      });

    return true;
  }

  if (message.type === 'GET_TAB_ID') {
    // Return the tab ID of the sender
    const tabId = sender.tab?.id || null;
    sendResponse({ success: true, tabId });
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

  if (message.type === 'VALIDATE_API_KEY') {
    validateApiKey(message.apiKey)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => {
        const errorInfo = handleError(error, 'validateApiKey');
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

  if (message.type === 'GET_RATE_LIMIT_STATUS') {
    getRateLimitStatus()
      .then(status => sendResponse({ success: true, models: status }))
      .catch(error => {
        const errorInfo = handleError(error, 'getRateLimitStatus');
        sendResponse({ success: false, error: errorInfo });
      });

    return true;
  }

  if (message.type === 'CLEAR_RATE_LIMITS') {
    clearRateLimits()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        const errorInfo = handleError(error, 'clearRateLimits');
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
    // Load configuration from cache
    const config = await getConfig();
    const modelProvider = config.analysis.modelProvider;

    logger.system.info('Model provider selected', {
      category: logger.CATEGORIES.GENERAL,
      data: { modelProvider }
    });

    // Step 1: Content already extracted by content script
    logger.progress(logger.CATEGORIES.EXTRACT, {
      status: 'completed',
      userMessage: 'Content extracted successfully',
      progress: 100
    });

    // FASE 1: DETECÇÃO (5-15%)
    // Detect language with AI
    logger.logUserAI('language-detection', {
      phase: 'detection',
      progress: 10,
      message: 'Detecting article language with AI...',
      metadata: {}
    });

    // Language detected (assuming we have the language from articleData)
    logger.logUserProgress('detection', 15, `Language detected: ${articleData.language || 'Unknown'}`, {
      icon: 'SUCCESS',
      detectedLanguage: articleData.language
    });

    // Step 2: Fetch perspectives (with automatic translation)
    logger.progress(logger.CATEGORIES.SEARCH, {
      status: 'active',
      userMessage: 'Searching for related articles globally...',
      progress: 0
    });

    let perspectives = [];
    try {
      // FASE 2: TRADUÇÃO (15-25%)
      // Translate title to English
      logger.logUserAI('translation', {
        phase: 'translation',
        progress: 18,
        message: 'Translating title to English...',
        metadata: { from: articleData.language || 'unknown', to: 'en' }
      });

      // Pre-translate for multiple languages
      logger.logUserProgress('translation', 22, 'Pre-translating for global search...', {
        icon: 'TRANSLATE',
        targetLanguages: ['zh', 'ar', 'ru', 'en']
      });

      // Get search configuration from user settings (merged with defaults)
      const searchConfig = await getSearchConfigAsync();

      logger.system.debug('Using search configuration', {
        category: logger.CATEGORIES.SEARCH,
        data: {
          countries: searchConfig.countries.map(c => `${c.code}:${c.fetchTarget}`),
          totalExpected: searchConfig.totalExpected
        }
      });

      // FASE 3: BUSCA (25-45%)
      logger.logUserProgress('search', 30, 'Searching articles globally...', {
        icon: 'SEARCH',
        countries: searchConfig.countries.map(c => c.code)
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

      // FASE 3: BUSCA COMPLETADA (45%)
      const countriesFound = [...new Set(perspectives.map(p => p.country))];
      logger.logUserProgress('search', 45, `Found ${perspectives.length} articles from ${countriesFound.length} countries`, {
        icon: 'SUCCESS',
        articlesCount: perspectives.length,
        countries: countriesFound
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
        // FASE 4: EXTRAÇÃO (45-65%)
        logger.logUserProgress('extraction', 50, `Extracting content from ${perspectives.length} articles...`, {
          icon: 'EXTRACT',
          articlesCount: perspectives.length
        });

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
        // Pass user's extraction configuration
        perspectivesWithContent = await extractArticlesContentWithTabs(
          perspectives,
          {
            timeout: config.extraction?.timeout || 30000,
            parallel: config.extraction?.parallel !== false,
            batchSize: config.extraction?.batchSize || 10,
            retryOnLowQuality: config.extraction?.retryLowQuality !== false,
            useWindowManager: true,
            windowManagerOptions: config.extraction?.windowManager || {}
          },
          async (article, completedIndex, total) => {
            // Real-time progress callback for each extracted article
            const completedCount = completedIndex + 1;
            const remaining = total - completedCount;

            // Calculate monotonic progress: 50-65% range (15% total)
            const baseProgress = 50;
            const range = 15;
            const progress = baseProgress + ((completedCount / total) * range);

            // Detect RTL text (Arabic, Hebrew, etc.) and format appropriately
            const hasRTL = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(article.source);
            const formattedSource = hasRTL ? `\u202B${article.source}\u202C` : article.source;

            // Hybrid message: show completion + ongoing state
            let message;
            if (remaining > 0) {
              // Still extracting - show what completed + what remains
              if (article.contentExtracted) {
                message = `Extracted ${formattedSource} • ${completedCount} ready, ${remaining} processing`;
              } else {
                message = `Failed ${formattedSource} • ${completedCount} completed, ${remaining} processing`;
              }
            } else {
              // Last article - show final summary with success count
              message = `Extraction complete • ${completedCount} articles ready`;
            }

            logger.logUserProgress('extraction', Math.round(progress), message, {
              icon: 'EXTRACT',
              source: article.source,
              completedCount,
              total,
              remaining,
              contentExtracted: article.contentExtracted,
              success: article.contentExtracted
            });
          }
        );

        const extractedCount = perspectivesWithContent.filter(p => p.contentExtracted).length;

        // Log extraction completion (system only - user already saw final progress in callback)
        logger.system.info('Content extraction completed', {
          category: logger.CATEGORIES.FETCH,
          data: {
            successful: extractedCount,
            total: perspectives.length,
            successRate: `${((extractedCount / perspectives.length) * 100).toFixed(1)}%`
          }
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

      // Domain-based deduplication - Remove articles from duplicate domains
      const seenDomains = new Set();
      const originalArticleUrl = articleData.url;

      // Add original article domain to seen domains
      if (originalArticleUrl) {
        try {
          const originalDomain = new URL(originalArticleUrl).hostname.replace(/^www\./, '');
          seenDomains.add(originalDomain);

          logger.system.debug('Original article domain added to filter', {
            category: logger.CATEGORIES.GENERAL,
            data: { domain: originalDomain }
          });
        } catch (error) {
          logger.system.warn('Could not extract original article domain', {
            category: logger.CATEGORIES.GENERAL,
            error,
            data: { url: originalArticleUrl }
          });
        }
      }

      const uniqueDomainArticles = articlesWithContent.filter(article => {
        // Try to get domain from extractedContent first (most reliable)
        let domain = article.extractedContent?.domain;

        // Fallback to finalUrl if domain not in extractedContent
        if (!domain && article.finalUrl) {
          try {
            domain = new URL(article.finalUrl).hostname.replace(/^www\./, '');
          } catch (error) {
            logger.system.warn('Invalid finalUrl for domain extraction', {
              category: logger.CATEGORIES.GENERAL,
              error,
              data: {
                finalUrl: article.finalUrl,
                source: article.source
              }
            });
            return true; // Keep article if URL parsing fails
          }
        }

        // If no domain could be extracted, keep the article
        if (!domain) {
          logger.system.debug('No domain found, keeping article', {
            category: logger.CATEGORIES.GENERAL,
            data: {
              source: article.source,
              title: article.title?.substring(0, 60)
            }
          });
          return true;
        }

        // Check if domain already seen
        if (seenDomains.has(domain)) {
          logger.system.debug('Filtering duplicate domain', {
            category: logger.CATEGORIES.GENERAL,
            data: {
              domain,
              source: article.source,
              title: article.title?.substring(0, 60),
              country: article.countryCode
            }
          });
          return false;
        }

        // Add domain to seen set and keep article
        seenDomains.add(domain);
        return true;
      });

      const filteredCount = articlesWithContent.length - uniqueDomainArticles.length;
      if (filteredCount > 0) {
        logger.system.info('Domain-based deduplication completed', {
          category: logger.CATEGORIES.GENERAL,
          data: {
            originalCount: articlesWithContent.length,
            filteredCount,
            remainingCount: uniqueDomainArticles.length,
            uniqueDomains: seenDomains.size
          }
        });
      }

      // Load user selection targets
      const selectionTargets = await getSelectionTargetsAsync();

      logger.system.info('Starting intelligent article selection', {
        category: logger.CATEGORIES.GENERAL,
        data: {
          availableArticles: uniqueDomainArticles.length,
          selectionTargets: selectionTargets.perCountry
        }
      });

      // Validate coverage before selection (pass user targets to avoid using defaults)
      const coverageValidation = validateCoverage(uniqueDomainArticles, selectionTargets);

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
      const selectionResult = selectArticlesByCountry(uniqueDomainArticles, selectionTargets);
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
        // FASE 5: COMPRESSÃO (66-85%) - Logs via callback em languageModel.js
        // NOTE: For Gemini 2.5 Pro, compression is skipped (handled in API wrapper)

        logger.system.info('Starting progressive multi-stage analysis', {
          category: logger.CATEGORIES.ANALYZE,
          data: {
            articlesCount: selectedArticles.length,
            stages: 4,
            modelProvider,
            note: 'Using centralized config for analysis parameters'
          }
        });

        logger.progress(logger.CATEGORIES.ANALYZE, {
          status: 'active',
          userMessage: `Starting analysis of ${selectedArticles.length} articles...`,
          systemMessage: `Running progressive 4-stage analysis with ${modelProvider === 'gemini-2.5-pro' ? 'Gemini 2.5 Pro' : 'Gemini Nano'}`,
          progress: 10,
          data: { articlesCount: selectedArticles.length, modelProvider }
        });

        // ===== MODEL ROUTING WITH AUTOMATIC FALLBACK =====
        let analysisResult;

        if (modelProvider === 'api' || modelProvider === 'gemini-2.5-pro') {
          // API MODELS PIPELINE (with automatic fallback)
          logger.system.info('Using Gemini API models with fallback', {
            category: logger.CATEGORIES.ANALYZE
          });

          const apiKey = await APIKeyManager.load();
          if (!apiKey) {
            throw new Error('API models selected but no API key configured');
          }

          // Get preferred models list from config
          const preferredModels = config.analysis.preferredModels || [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite'
          ];

          // Create model router
          const modelRouter = new ModelRouter(preferredModels);

          // Track retry state
          let lastError = null;
          const attemptedModels = [];
          const blockedModels = [];

          // Create reusable stage callback factory
          const createStageCallback = (currentModel, currentDisplayName, isFallback = false) => {
            return async (stageInfo) => {
              const { stage, name, success, duration } = stageInfo;

              if (success) {
                logger.system.info(`Stage ${stage}/4 completed with ${currentModel}${isFallback ? ' (fallback)' : ''}`, {
                  category: logger.CATEGORIES.ANALYZE,
                  data: { stage, name, duration, model: currentModel, wasFallback: isFallback }
                });

                // Stage start messages
                const stageStartProgress = [86, 90, 94, 97];
                const stageStartMessages = [
                  `AI analyzing context & trust with ${currentDisplayName}...`,
                  `AI finding consensus with ${currentDisplayName}...`,
                  `AI detecting disputes with ${currentDisplayName}...`,
                  `AI analyzing perspectives with ${currentDisplayName}...`
                ];

                logger.logUserAI('analysis', {
                  phase: 'analysis',
                  progress: stageStartProgress[stage - 1],
                  message: stageStartMessages[stage - 1],
                  metadata: { stage, model: currentModel, wasFallback: isFallback }
                });

                // Send progressive update to content script using logger's tab context
                try {
                  if (activeAnalysis.tabId) {
                    await chrome.tabs.sendMessage(activeAnalysis.tabId, {
                      type: 'ANALYSIS_STAGE_COMPLETE',
                      data: {
                        stage,
                        stageData: stageInfo.result,
                        perspectives: selectedArticles,
                        articleData
                      }
                    });

                    logger.system.debug(`Stage ${stage} update sent to UI${isFallback ? ' (fallback model)' : ''}`, {
                      category: logger.CATEGORIES.ANALYZE,
                      data: { tabId: activeAnalysis.tabId, stage, model: currentModel }
                    });
                  } else {
                    logger.system.warn('No active tab ID for stage update', {
                      category: logger.CATEGORIES.ANALYZE,
                      data: { stage }
                    });
                  }
                } catch (error) {
                  logger.system.warn('Failed to send stage update to UI', {
                    category: logger.CATEGORIES.ANALYZE,
                    error,
                    data: { stage, tabId: activeAnalysis.tabId }
                  });
                }

                // Update progress bar
                const progress = 10 + (stage / 4) * 80;
                const stageNames = ['Context & Trust', 'Consensus', 'Disputes', 'Perspectives'];
                logger.progress(logger.CATEGORIES.ANALYZE, {
                  status: 'active',
                  userMessage: `Stage ${stage}/4: ${stageNames[stage - 1]} complete`,
                  progress
                });
              }
            };
          };

          // Try each model in sequence until one succeeds
          for (let i = 0; i < preferredModels.length; i++) {
            const currentModel = preferredModels[i];
            const currentDisplayName = MODEL_DISPLAY_NAMES[currentModel] || currentModel;

            // Check if model is already blocked before attempting
            const isAvailable = await rateLimitCache.isModelAvailable(currentModel);

            if (!isAvailable) {
              const timeRemaining = await rateLimitCache.getBlockedTimeRemaining(currentModel);
              const blockInfo = await rateLimitCache.getBlockInfo(currentModel);

              blockedModels.push({
                model: currentModel,
                displayName: currentDisplayName,
                timeRemaining,
                quotaMetric: blockInfo?.quotaMetric,
                quotaId: blockInfo?.quotaId
              });

              logger.system.debug('Skipping blocked model', {
                category: logger.CATEGORIES.ANALYZE,
                model: currentModel,
                timeRemaining
              });

              continue; // Skip to next model
            }

            // Notify user about fallback if we've already tried other models
            const isFallback = attemptedModels.length > 0;
            if (isFallback) {
              logger.logUserProgress('analysis', 70,
                `${attemptedModels[attemptedModels.length - 1].displayName} rate limited. Switching to ${currentDisplayName}...`,
                { icon: 'AI' }
              );
            }

            // Get model-specific configuration
            const modelConfig = config.analysis.models?.[currentModel] || config.analysis.gemini25Pro || {};

            // Create API client for current model
            const apiClient = new GeminiAPI(apiKey, currentModel, modelConfig);

            // Check availability
            const availability = await apiClient.checkAvailability();
            if (availability !== 'ready') {
              logger.system.warn('Model not ready, skipping', {
                category: logger.CATEGORIES.ANALYZE,
                model: currentModel,
                availability
              });
              continue; // Skip to next model
            }

            // Start analysis with current model
            logger.logUserProgress('analysis', 70, `Analyzing with ${currentDisplayName}...`, {
              icon: 'AI',
              metadata: { model: currentModel, wasFallback: isFallback }
            });

            try {
              // Attempt analysis with current model
              analysisResult = await apiClient.compareArticlesProgressive(
                selectedArticles,
                createStageCallback(currentModel, currentDisplayName, isFallback)
              );

              // SUCCESS! Add metadata and exit loop
              logger.system.info('Analysis completed successfully', {
                category: logger.CATEGORIES.ANALYZE,
                model: currentModel,
                wasFallback: isFallback,
                attemptedModels: attemptedModels.length
              });

              // Add fallback metadata to results
              if (isFallback) {
                analysisResult.metadata.wasFallback = true;
                analysisResult.metadata.preferredModel = preferredModels[0];
                analysisResult.metadata.actualModel = currentModel;
                analysisResult.metadata.blockedModels = blockedModels;
                analysisResult.metadata.attemptedModels = attemptedModels.map(m => m.model);
              }

              break; // Exit loop on success

            } catch (error) {
              // Check if it's a rate limit error
              if (error.status === 429) {
                logger.system.warn('Rate limit hit, recording and trying next model', {
                  category: logger.CATEGORIES.ERROR,
                  model: currentModel,
                  attemptedSoFar: attemptedModels.length + 1
                });

                // Record the rate limit hit
                await modelRouter.handleRateLimitError(currentModel, error.errorData);

                // Track this attempt
                attemptedModels.push({
                  model: currentModel,
                  displayName: currentDisplayName,
                  error: error.message
                });

                // Store last error for final error message
                lastError = error;

                // Continue to next model in loop
                continue;

              } else {
                // Non-rate-limit error: propagate immediately
                logger.system.error('Non-rate-limit error during analysis', {
                  category: logger.CATEGORIES.ERROR,
                  model: currentModel,
                  error: error.message
                });
                throw error;
              }
            }
          }

          // If we exited the loop without a result, all models failed
          if (!analysisResult) {
            const allModels = [...attemptedModels, ...blockedModels];
            const modelsList = allModels.map(m => m.displayName).join(', ');

            logger.system.error('All API models exhausted', {
              category: logger.CATEGORIES.ERROR,
              attemptedModels: attemptedModels.map(m => m.model),
              blockedModels: blockedModels.map(m => m.model)
            });

            throw new Error(`All API models are rate limited (${modelsList}). Please try again later.`);
          }

        } else {
          // GEMINI NANO PIPELINE (existing code)
          logger.system.info('Using Gemini Nano for analysis', {
            category: logger.CATEGORIES.ANALYZE
          });

          analysisResult = await compareArticlesProgressive(
          selectedArticles,
          // Stage callback - called BEFORE starting and AFTER completing each stage
          async (stageNumber, stageData) => {
            const { status } = stageData;

            if (status === 'starting') {
              // FASE 6: ANÁLISE - AI stages STARTING
              const stageStartProgress = [86, 90, 94, 97];
              const stageStartMessages = [
                'AI analyzing context & trust...',
                'AI finding consensus...',
                'AI detecting disputes...',
                'AI analyzing perspectives...'
              ];

              if (stageNumber >= 1 && stageNumber <= 4) {
                logger.logUserAI('analysis', {
                  phase: 'analysis',
                  progress: stageStartProgress[stageNumber - 1],
                  message: stageStartMessages[stageNumber - 1],
                  metadata: { stage: stageNumber, status: 'starting' }
                });
              }
            } else if (status === 'completed') {
              // Stage completed - update panel but don't show toast log
              logger.system.info(`Stage ${stageNumber}/4 completed, updating UI`, {
                category: logger.CATEGORIES.ANALYZE,
                data: {
                  stage: stageNumber,
                  name: stageData.name,
                  dataKeys: Object.keys(stageData.data || {})
                }
              });

              // Send progressive update to content script (only on completion)
              try {
                const tabs = await chrome.tabs.query({ url: articleData.url });
                if (tabs.length > 0) {
                  await chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'ANALYSIS_STAGE_COMPLETE',
                    data: {
                      stage: stageNumber,
                      stageData: stageData.data,
                      perspectives: selectedArticles,
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
        } // End of model routing if/else

        // ===== COMMON PROCESSING (both Nano and Pro) =====
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
          // FASE 6: ANÁLISE COMPLETA (100%)
          logger.logUserProgress('complete', 100, 'Analysis complete!', {
            icon: 'SUCCESS',
            articlesAnalyzed: comparativeAnalysis.metadata?.articlesAnalyzed || 0
          });

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
 * Now supports Gemini Nano and multiple API models
 */
async function getExtensionStatus() {
  try {
    // Load current configuration from cache
    const config = await getConfig();
    const modelProvider = config.analysis.modelProvider;

    let aiStatus = {
      modelProvider,
      availability: 'unavailable',
      downloadProgress: 0
    };

    // Check status based on selected model
    if (modelProvider === 'api' || modelProvider === 'gemini-2.5-pro') {
      // API Models status
      const apiKey = await APIKeyManager.load();

      if (!apiKey) {
        aiStatus.availability = 'api-key-required';
        aiStatus.message = 'API key not configured';
      } else {
        try {
          // Check first preferred model for basic availability
          const preferredModels = config.analysis.preferredModels || ['gemini-2.5-pro'];
          const firstModel = preferredModels[0];
          const modelConfig = config.analysis.models?.[firstModel] || config.analysis.gemini25Pro || {};

          const apiClient = new GeminiAPI(apiKey, firstModel, modelConfig);
          const apiStatus = await apiClient.checkAvailability();

          aiStatus.availability = apiStatus;
          aiStatus.apiKeyMasked = APIKeyManager.mask(apiKey);
          aiStatus.preferredModels = preferredModels;
          aiStatus.firstModel = firstModel;

          if (apiStatus === 'ready') {
            aiStatus.message = 'API connected';
          } else if (apiStatus === 'invalid-key') {
            aiStatus.message = 'Invalid or expired API key';
          } else {
            aiStatus.message = 'Network error connecting to API';
          }
        } catch (error) {
          logger.system.error('Failed to check API availability', {
            category: logger.CATEGORIES.ERROR,
            error
          });
          aiStatus.availability = 'error';
          aiStatus.message = 'Error checking API status';
        }
      }
    } else {
      // Gemini Nano status (existing logic)
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

          // Set message based on Nano status
          if (availability === 'ready') {
            aiStatus.message = 'Gemini Nano ready';
          } else if (availability === 'download') {
            aiStatus.message = 'Model download required';
          } else if (availability === 'downloading') {
            aiStatus.message = `Downloading model (${aiStatus.downloadProgress}%)`;
          } else {
            aiStatus.message = 'Gemini Nano unavailable';
          }
        } catch (error) {
          logger.system.error('Failed to check AI availability', {
            category: logger.CATEGORIES.ERROR,
            error
          });
          aiStatus.availability = 'error';
          aiStatus.message = 'Error checking Gemini Nano';
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
        aiStatus.availability = 'unavailable';
        aiStatus.message = 'Gemini Nano not available in this Chrome version';
      }
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
        modelProvider: 'gemini-nano',
        availability: 'unavailable',
        downloadProgress: 0,
        message: 'Error retrieving status'
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
 * Validate Gemini API key
 * @param {string} apiKey - API key to validate
 * @returns {Promise<{isValid: boolean, error?: string}>}
 */
async function validateApiKey(apiKey) {
  try {
    logger.system.info('Validating API key', {
      category: logger.CATEGORIES.VALIDATE
    });

    const result = await APIKeyManager.validate(apiKey);

    logger.system.info('API key validation completed', {
      category: logger.CATEGORIES.VALIDATE,
      data: { isValid: result.isValid }
    });

    return result;
  } catch (error) {
    logger.system.error('API key validation failed', {
      category: logger.CATEGORIES.ERROR,
      error
    });

    return {
      isValid: false,
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
 * Get rate limit status for all API models
 */
async function getRateLimitStatus() {
  try {
    const config = await getConfig();
    const preferredModels = config.analysis.preferredModels || [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    const modelRouter = new ModelRouter(preferredModels);
    const statuses = await modelRouter.getModelsStatus();

    logger.system.debug('Rate limit status retrieved', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        models: statuses.map(s => ({
          model: s.model,
          available: s.available,
          retryIn: s.retryIn
        }))
      }
    });

    return statuses;
  } catch (error) {
    logger.system.error('Failed to get rate limit status', {
      category: logger.CATEGORIES.ERROR,
      error
    });
    throw error;
  }
}

/**
 * Clear all rate limit blocks (for debugging/testing)
 */
async function clearRateLimits() {
  try {
    const config = await getConfig();
    const preferredModels = config.analysis.preferredModels || [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    const modelRouter = new ModelRouter(preferredModels);
    await modelRouter.clearAllBlocks();

    logger.system.info('All rate limit blocks cleared', {
      category: logger.CATEGORIES.GENERAL
    });
  } catch (error) {
    logger.system.error('Failed to clear rate limits', {
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
