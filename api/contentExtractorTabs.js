/**
 * Content Extractor using Chrome Tabs
 * More reliable method - opens tabs in background to extract content
 *
 * This method:
 * - Opens real Chrome tabs (invisible to user)
 * - Handles Google News redirects automatically
 * - Injects content script to extract with Readability
 * - Processes multiple articles in parallel
 */

import { logger } from '../utils/logger.js';

/**
 * Extract content from multiple articles using Chrome tabs
 * @param {Array} articles - Array of article objects with {title, link, source}
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Array of articles with extracted content
 */
export async function extractArticlesContentWithTabs(articles, options = {}) {
  const {
    maxArticles = 10,
    timeout = 15000, // 15s per article
    parallel = true,
    batchSize = 5 // Process 5 at a time to avoid too many tabs
  } = options;

  if (!articles || articles.length === 0) {
    logger.warn('No articles to extract content from');
    return [];
  }

  const articlesToProcess = articles.slice(0, maxArticles);

  logger.group(`📄 Extracting content from ${articlesToProcess.length} articles using Chrome tabs`);
  logger.info('Parallel mode:', parallel);
  logger.info('Batch size:', batchSize);
  logger.info('Timeout per article:', `${timeout}ms`);

  try {
    const startTime = Date.now();

    if (parallel) {
      // Process in batches to avoid opening too many tabs at once
      const results = [];

      for (let i = 0; i < articlesToProcess.length; i += batchSize) {
        const batch = articlesToProcess.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articlesToProcess.length / batchSize)}`);

        const batchResults = await Promise.allSettled(
          batch.map(article => extractSingleArticleWithTab(article, timeout))
        );

        const processedBatch = batchResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            logger.warn(`Failed to extract: ${batch[index].title}`, result.reason);
            return {
              ...batch[index],
              contentExtracted: false,
              extractionError: result.reason?.message || 'Unknown error'
            };
          }
        });

        results.push(...processedBatch);
      }

      const duration = Date.now() - startTime;
      logger.info(`⚡ Extraction completed in ${duration}ms`);

      const successCount = results.filter(a => a.contentExtracted).length;
      logger.info(`✅ Successfully extracted ${successCount}/${articlesToProcess.length} articles`);
      logger.groupEnd();

      return results;

    } else {
      // Sequential extraction
      logger.warn('Using sequential extraction (slower)');
      const results = [];

      for (const article of articlesToProcess) {
        try {
          const extracted = await extractSingleArticleWithTab(article, timeout);
          results.push(extracted);
        } catch (error) {
          logger.error(`Failed to extract: ${article.title}`, error);
          results.push({
            ...article,
            contentExtracted: false,
            extractionError: error.message
          });
        }
      }

      logger.groupEnd();
      return results;
    }

  } catch (error) {
    logger.error('Content extraction failed:', error);
    logger.groupEnd();
    throw error;
  }
}

/**
 * Extract content from a single article using a Chrome tab
 * @param {Object} article - Article object with link
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Article with extracted content
 */
async function extractSingleArticleWithTab(article, timeout) {
  logger.debug(`Extracting: ${article.title.substring(0, 50)}...`);

  let tabId = null;

  try {
    // Create a new tab in background
    const tab = await chrome.tabs.create({
      url: article.link,
      active: false // Don't switch to this tab (background)
    });

    tabId = tab.id;
    logger.debug(`Tab ${tabId} created for: ${article.source}`);

    // Wait for tab to finish loading with timeout
    const result = await Promise.race([
      waitForTabToLoad(tabId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      )
    ]);

    logger.debug(`Tab ${tabId} loaded, waiting for redirects...`);

    // Wait for redirects to complete and URL to stabilize
    await waitForRedirectsToComplete(tabId, 3000);

    logger.debug(`Tab ${tabId} redirects complete, extracting content...`);

    // Inject and execute content extraction script
    const extractedContent = await extractContentFromTab(tabId);

    // Get final URL from tab
    const finalTab = await chrome.tabs.get(tabId);
    const finalUrl = finalTab.url;

    logger.debug(`Tab ${tabId} final URL: ${finalUrl.substring(0, 80)}...`);
    logger.debug(`Tab ${tabId} extracted ${extractedContent.length} chars`);

    // Close the tab
    await chrome.tabs.remove(tabId);
    logger.debug(`Tab ${tabId} closed`);

    return {
      ...article,
      contentExtracted: true,
      extractedContent,
      extractionMethod: 'chrome-tab',
      finalUrl: finalUrl,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    // Clean up tab on error
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (closeError) {
        // Tab might already be closed
      }
    }

    logger.error(`Tab extraction failed for ${article.title}:`, error.message);
    throw error;
  }
}

/**
 * Wait for a tab to finish loading
 * @param {number} tabId - Tab ID
 * @returns {Promise<chrome.tabs.Tab>} Loaded tab
 */
function waitForTabToLoad(tabId) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (tab.status === 'complete') {
        resolve(tab);
        return;
      }

      // Listen for tab updates
      const listener = (updatedTabId, changeInfo, updatedTab) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(updatedTab);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Cleanup listener after 30s
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 30000);
    });
  });
}

/**
 * Wait for URL redirects to complete
 * Google News redirects can take 1-3 seconds to fully resolve
 * @param {number} tabId - Tab ID
 * @param {number} maxWait - Maximum wait time in ms
 * @returns {Promise<void>}
 */
async function waitForRedirectsToComplete(tabId, maxWait = 3000) {
  const startTime = Date.now();
  let previousUrl = null;
  let stableCount = 0;
  const checksNeeded = 3; // URL must be stable for 3 checks

  while (Date.now() - startTime < maxWait) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const currentUrl = tab.url;

      // Check if URL is still a Google News redirect
      if (currentUrl.includes('news.google.com/rss/articles')) {
        logger.debug(`Tab ${tabId} still on redirect page, waiting...`);
        previousUrl = currentUrl;
        stableCount = 0;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Check if URL has stabilized
      if (currentUrl === previousUrl) {
        stableCount++;
        if (stableCount >= checksNeeded) {
          logger.debug(`Tab ${tabId} URL stabilized at: ${currentUrl.substring(0, 60)}...`);
          return;
        }
      } else {
        stableCount = 0;
      }

      previousUrl = currentUrl;
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      // Tab might have been closed
      logger.warn(`Tab ${tabId} check failed:`, error.message);
      return;
    }
  }

  logger.debug(`Tab ${tabId} redirect wait timeout (${maxWait}ms)`);
}

/**
 * Extract content from a loaded tab using content script
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object>} Extracted content
 */
async function extractContentFromTab(tabId) {
  try {
    // Inject Readability library
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['offscreen/readability.js']
    });

    // Execute content extraction script
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractContentInPage
    });

    if (!results || results.length === 0 || !results[0].result) {
      throw new Error('No content extracted from page');
    }

    return results[0].result;

  } catch (error) {
    logger.error('Failed to extract content from tab:', error);
    throw error;
  }
}

/**
 * Function to be executed in the page context
 * This extracts article content using Readability
 */
function extractContentInPage() {
  try {
    // Clone document for Readability
    const documentClone = document.cloneNode(true);

    let article = null;
    let method = 'readability';

    // Try Readability first
    if (typeof Readability !== 'undefined') {
      try {
        const reader = new Readability(documentClone);
        article = reader.parse();

        if (!article) {
          method = 'fallback';
          article = extractWithFallback();
        }
      } catch (error) {
        method = 'fallback';
        article = extractWithFallback();
      }
    } else {
      method = 'fallback';
      article = extractWithFallback();
    }

    if (!article || !article.textContent) {
      throw new Error('No content extracted');
    }

    return {
      title: article.title || document.title || 'Untitled',
      content: article.content || '',
      textContent: article.textContent || '',
      excerpt: article.excerpt || article.textContent?.substring(0, 200) || '',
      byline: article.byline || '',
      siteName: article.siteName || '',
      lang: article.lang || document.documentElement?.lang || 'unknown',
      length: article.length || article.textContent?.length || 0,
      url: window.location.href,
      method,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    return {
      title: document.title || 'Untitled',
      content: '',
      textContent: '',
      excerpt: '',
      byline: '',
      siteName: '',
      lang: document.documentElement?.lang || 'unknown',
      length: 0,
      url: window.location.href,
      method: 'error',
      error: error.message,
      extractedAt: new Date().toISOString()
    };
  }

  // Fallback extraction function
  function extractWithFallback() {
    const selectors = [
      'article',
      '[role="article"]',
      'main article',
      '.article-content',
      '.post-content',
      '.entry-content',
      'main',
      '#content'
    ];

    // Extract title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const h1 = document.querySelector('h1');
    const title = ogTitle?.content || twitterTitle?.content || h1?.textContent || document.title || 'Untitled';

    // Extract content
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        return {
          title: title.trim(),
          content: element.innerHTML,
          textContent: element.textContent.trim(),
          excerpt: element.textContent.trim().substring(0, 200) + '...',
          byline: null,
          siteName: document.querySelector('meta[property="og:site_name"]')?.content || '',
          lang: document.documentElement?.lang || 'unknown',
          length: element.textContent.trim().length
        };
      }
    }

    // Last resort: body
    return {
      title: title.trim(),
      content: document.body.innerHTML,
      textContent: document.body.textContent.trim(),
      excerpt: document.body.textContent.trim().substring(0, 200) + '...',
      byline: null,
      siteName: '',
      lang: document.documentElement?.lang || 'unknown',
      length: document.body.textContent.trim().length
    };
  }
}
