/**
 * PerspectiveLens Background Service Worker
 * Coordinates AI processing, API calls, and message handling
 */

import { logger } from './utils/logger.js';
import { extractKeywords, checkAvailability, createSession, compareArticles } from './api/languageModel.js';
import { handleError } from './utils/errors.js';
import { normalizeLanguageCode } from './utils/languages.js';
import { fetchPerspectives } from './api/newsFetcher.js';
import { extractArticlesContentWithTabs } from './api/contentExtractorTabs.js';

logger.info('Background service worker started');

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
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  logger.debug('Message received:', message.type);

  // Handle async responses
  if (message.type === 'NEW_ARTICLE_DETECTED') {
    handleNewArticle(message.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => {
        const errorInfo = handleError(error, 'handleNewArticle');
        sendResponse({ success: false, error: errorInfo });
      });

    // Return true to indicate async response
    return true;
  }

  if (message.type === 'EXTRACT_KEYWORDS') {
    extractKeywords(message.title, message.language)
      .then(keywords => sendResponse({ success: true, keywords }))
      .catch(error => {
        const errorInfo = handleError(error, 'extractKeywords');
        sendResponse({ success: false, error: errorInfo });
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
 * Implements F-002: Keyword Extraction + F-005: Summarization
 */
async function handleNewArticle(articleData) {
  logger.group('🔍 Processing new article');
  logger.info('URL:', articleData.url);
  logger.info('Title:', articleData.title);
  logger.info('Source:', articleData.source);
  logger.info('Language:', articleData.language);
  logger.info('Content length:', articleData.content?.length || 0);

  try {
    // Step 1: Extract keywords (F-002)
    logger.info('📝 Step 1: Extracting keywords...');
    const keywords = await extractKeywords(
      articleData.title,
      articleData.language || null // Let it auto-detect
    );
    logger.info('✅ Keywords extracted:', keywords);

    logger.info('📄 Step 2: Skipping summarization (feature removed)');

    // Step 3: Check cache (F-007 - to be implemented)
    // const cachedAnalysis = await checkCache(articleData.url);
    // if (cachedAnalysis) return cachedAnalysis;

    // Step 4: Fetch perspectives (F-003)
    logger.info('📰 Step 3: Fetching perspectives from other sources...');
    let perspectives = [];
    try {
      perspectives = await fetchPerspectives(keywords, articleData);
      logger.info(`✅ Found ${perspectives.length} perspectives`);
    } catch (error) {
      logger.error('Failed to fetch perspectives:', error);
      // Continue without perspectives rather than failing completely
    }

    // Step 5: Extract content from perspectives (F-004)
    logger.info('📄 Step 4: Extracting content from perspective articles...');
    let perspectivesWithContent = perspectives;
    try {
      if (perspectives.length > 0) {
        perspectivesWithContent = await extractArticlesContentWithTabs(perspectives, {
          maxArticles: 10,
          timeout: 15000,
          parallel: true,
          batchSize: 5 // Process 5 tabs at a time
        });

        const extractedCount = perspectivesWithContent.filter(p => p.contentExtracted).length;
        logger.info(`✅ Extracted content from ${extractedCount}/${perspectives.length} articles`);

        // Log sample of extracted content for verification
        perspectivesWithContent
          .filter(p => p.contentExtracted)
          .slice(0, 3)
          .forEach(article => {
            logger.group(`📰 Sample: ${article.source} - ${article.title.substring(0, 60)}...`);
            logger.info('Final URL:', article.finalUrl);
            logger.info('Extraction Method:', article.extractionMethod);
            logger.info('Content Length:', article.extractedContent?.textContent?.length || 0);
            logger.info('Excerpt:', article.extractedContent?.excerpt?.substring(0, 150) || 'N/A');
            logger.info('First 300 chars:', article.extractedContent?.textContent?.substring(0, 300) || 'N/A');
            logger.groupEnd();
          });
      }
    } catch (error) {
      logger.error('Failed to extract article contents:', error);
      // Continue with perspectives without content
      perspectivesWithContent = perspectives;
    }

    // Step 6: Compare perspectives (F-006) - OPTIMIZED VERSION!
    logger.info('🔍 Step 5: Performing OPTIMIZED comparative analysis...');
    let comparativeAnalysis = null;
    try {
      // Only run analysis if we have content from at least 2 articles
      const articlesWithContent = perspectivesWithContent.filter(p => p.contentExtracted);

      if (articlesWithContent.length >= 2) {
        logger.info(`Running analysis on ${articlesWithContent.length} articles with optimizations enabled`);

        comparativeAnalysis = await compareArticles(articlesWithContent, {
          // OPTIMIZATION FLAGS
          useCompression: true,           // Use Summarizer API to compress long articles (70-80% reduction)
          validateContent: true,           // Filter out JavaScript/invalid content
          maxArticles: 8,                  // Limit to top 8 articles by quality
          compressionLevel: 'medium',      // Balance between detail and token usage
          useV2Prompt: true                // Enhanced prompt with few-shot examples
        });

        // Check if analysis succeeded or returned fallback
        if (comparativeAnalysis.error) {
          logger.warn('⚠️ Analysis returned with errors:', comparativeAnalysis.metadata);
        } else {
          logger.info('✅ Comparative analysis completed successfully');
          logger.group('📊 Analysis Summary');
          logger.info(`Consensus: ${comparativeAnalysis.consensus?.length || 0} points`);
          logger.info(`Disputes: ${comparativeAnalysis.disputes?.length || 0} topics`);
          logger.info(`Omissions: ${Object.keys(comparativeAnalysis.omissions || {}).length} sources`);
          logger.info(`Bias indicators: ${comparativeAnalysis.bias_indicators?.length || 0}`);
          logger.info(`Articles analyzed: ${comparativeAnalysis.metadata?.articlesAnalyzed || 0}/${articlesWithContent.length}`);
          logger.info(`Compression used: ${comparativeAnalysis.metadata?.compressionUsed ? 'Yes' : 'No'}`);
          logger.info(`Input length: ${comparativeAnalysis.metadata?.totalInputLength || 0} chars`);
          logger.info(`Main story: ${comparativeAnalysis.summary?.main_story?.substring(0, 80) || 'N/A'}...`);
          logger.groupEnd();
        }
      } else {
        logger.warn(`Skipping analysis: Only ${articlesWithContent.length} article(s) with content (need 2+)`);
      }
    } catch (error) {
      logger.error('Comparative analysis failed catastrophically:', error);
      // Continue without analysis rather than failing completely
      comparativeAnalysis = null;
    }

    // Step 7: Cache results (F-007 - to be implemented)
    // await cacheAnalysis(articleData.url, result);

    const result = {
      articleData,
      keywords, // Already in English
      perspectives: perspectivesWithContent, // Array of related articles with extracted content
      analysis: comparativeAnalysis, // Structured comparative analysis (or null if skipped)
      sourceLanguage: normalizeLanguageCode(articleData.language || 'en'), // Store for later translation
      status: comparativeAnalysis ? 'analysis_complete' :
              perspectivesWithContent.length > 0 ? 'content_extracted' : 'keywords_extracted',
      timestamp: new Date().toISOString()
    };

    // Update statistics
    try {
      const storage = await chrome.storage.local.get(['stats']);
      const stats = storage.stats || {
        articlesAnalyzed: 0,
        keywordsExtracted: 0,
        perspectivesFound: 0
      };

      stats.articlesAnalyzed += 1;
      stats.keywordsExtracted += keywords.length;
      stats.perspectivesFound += perspectives.length;

      await chrome.storage.local.set({ stats });
      logger.debug('Stats updated:', stats);
    } catch (error) {
      logger.warn('Failed to update stats:', error);
      // Non-critical, continue
    }

    // Step 8: Send analysis to content script for UI display
    if (comparativeAnalysis) {
      try {
        // Find the tab that triggered the analysis
        const tabs = await chrome.tabs.query({ url: articleData.url });
        logger.debug(`Found ${tabs.length} tabs matching URL:`, articleData.url);

        if (tabs.length > 0) {
          logger.debug(`Sending SHOW_ANALYSIS message to tab ${tabs[0].id}`);

          const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SHOW_ANALYSIS',
            data: {
              analysis: comparativeAnalysis,
              perspectives: perspectivesWithContent,
              articleData
            }
          });

          logger.info('✅ Analysis sent to UI, response:', response);
        } else {
          logger.warn('⚠️ No tabs found matching the article URL');
        }
      } catch (error) {
        logger.error('❌ Failed to send analysis to content script:', error);
        logger.error('Error details:', error.message, error.stack);
        // Non-critical, continue
      }
    }

    logger.info('✅ Article processed successfully');
    logger.groupEnd();

    return result;

  } catch (error) {
    logger.groupEnd();
    throw error;
  }
}

/**
 * Get extension status for popup (with caching to reduce API calls)
 */
async function getExtensionStatus() {
  try {
    // Check AI availability and status (with cache)
    let aiStatus = {
      availability: 'unavailable',
      downloadProgress: 0
    };

    if (typeof LanguageModel !== 'undefined') {
      try {
        // Use cache if available and recent
        const now = Date.now();
        const cacheValid = aiAvailabilityCache.status &&
                          aiAvailabilityCache.timestamp &&
                          (now - aiAvailabilityCache.timestamp) < aiAvailabilityCache.cacheDuration;

        let availability;
        if (cacheValid) {
          availability = aiAvailabilityCache.status;
          logger.debug('Using cached AI availability:', availability);
        } else {
          availability = await checkAvailability();
          // Cache the result
          aiAvailabilityCache.status = availability;
          aiAvailabilityCache.timestamp = now;
          logger.debug('Cached new AI availability:', availability);
        }

        aiStatus.availability = availability;

        // If downloading, include progress
        if (availability === 'downloading' && downloadState.inProgress) {
          aiStatus.downloadProgress = downloadState.progress;
        }
      } catch (error) {
        logger.error('Failed to check AI availability:', error);
      }
    }

    // Get cache and stats from storage
    const storage = await chrome.storage.local.get(['cache', 'stats']);

    const cache = storage.cache || [];
    const stats = storage.stats || {
      articlesAnalyzed: 0,
      keywordsExtracted: 0,
      perspectivesFound: 0
    };

    return {
      aiStatus,
      stats: {
        articlesAnalyzed: stats.articlesAnalyzed,
        cacheCount: cache.length,
        perspectivesFound: stats.perspectivesFound
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Failed to get status:', error);
    throw error;
  }
}

/**
 * Start AI model download in background
 * Download continues even if popup is closed!
 */
async function startModelDownload() {
  if (downloadState.inProgress) {
    logger.warn('Download already in progress');
    return;
  }

  try {
    logger.info('Starting AI model download in background...');
    downloadState.inProgress = true;
    downloadState.progress = 0;

    // Create session with progress monitoring
    const session = await createSession({}, (progress) => {
      downloadState.progress = progress;
      logger.debug(`Download progress: ${progress}%`);
    });

    // Download complete
    downloadState.inProgress = false;
    downloadState.progress = 100;
    downloadState.session = session;

    logger.info('AI model download completed!');

    // Clean up session (we'll create new ones when needed)
    session.destroy();
    downloadState.session = null;

  } catch (error) {
    downloadState.inProgress = false;
    downloadState.progress = 0;
    logger.error('Model download failed:', error);
    throw error;
  }
}

/**
 * Clear cache
 */
async function clearCache() {
  try {
    logger.info('Clearing cache...');

    await chrome.storage.local.set({
      cache: []
    });

    logger.info('Cache cleared successfully');

  } catch (error) {
    logger.error('Failed to clear cache:', error);
    throw error;
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  logger.info('Extension installed/updated:', reason);

  if (reason === 'install') {
    logger.info('First install - initializing storage');

    // Initialize default settings
    chrome.storage.local.set({
      settings: {
        autoAnalyze: true,
        maxCacheSize: 100,
        defaultLanguage: 'en'
      },
      cache: [],
      stats: {
        articlesAnalyzed: 0,
        keywordsExtracted: 0,
        perspectivesFound: 0
      }
    });
  }
});

/**
 * Handle extension errors
 */
self.addEventListener('error', (event) => {
  logger.error('Unhandled error in service worker:', event.error);
  handleError(event.error, 'ServiceWorker');
});

self.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
  handleError(event.reason, 'ServiceWorker:Promise');
});

logger.info('Background service worker initialized');
