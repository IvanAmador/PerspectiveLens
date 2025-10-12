/**
 * PerspectiveLens Background Service Worker
 * Coordinates AI processing, API calls, and message handling
 */

import { logger } from './utils/logger.js';
import { extractKeywords, checkAvailability, createSession } from './api/languageModel.js';
import { handleError } from './utils/errors.js';
import { normalizeLanguageCode } from './utils/languages.js';

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
  
  if (message.type === 'FETCH_EXTERNAL_RESOURCE') {
    fetchExternalResource(message.url)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
        const errorInfo = handleError(error, 'fetchExternalResource');
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

    // Step 4: Fetch perspectives (F-003 - to be implemented)
    // const perspectives = await fetchPerspectives(keywords, articleData);

    // Step 5: Compare perspectives (F-006 - to be implemented)
    // const analysis = await compareArticles(perspectives);

    // Step 6: Cache results (F-007 - to be implemented)
    // await cacheAnalysis(articleData.url, result);

    const result = {
      articleData,
      keywords, // Already in English
      sourceLanguage: normalizeLanguageCode(articleData.language || 'en'), // Store for later translation
      status: 'keywords_extracted',
      timestamp: new Date().toISOString()
    };

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