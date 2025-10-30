/**
 * Professional Content Extractor for PerspectiveLens
 * 
 * Extraction Strategy:
 * 1. Uses Chrome Tabs for reliable redirect handling (Google News, etc.)
 * 2. Injects Readability.js for high-quality content extraction
 * 3. Multiple fallback strategies for edge cases
 * 4. Quality validation and automatic retry with alternative methods
 * 
 * Best Practices:
 * - Parallel batch processing for performance
 * - Timeout management per article
 * - Automatic cleanup of resources
 * - Quality scoring for extracted content
 * 
 * Reference: https://github.com/mozilla/readability
 */

import { logger } from '../utils/logger.js';
import { PIPELINE_CONFIG } from '../config/pipeline.js';
import { createWindowManager } from './windowManager.js';

/**
 * Extract content from multiple articles using Chrome tabs
 *
 * @param {Array<Object>} articles - Articles with {title, link, source}
 * @param {Object} options - Extraction configuration
 * @param {Function} onProgress - Callback for progress updates (article, index, total)
 * @returns {Promise<Array<Object>>} Articles with extracted content
 */
export async function extractArticlesContentWithTabs(articles, options = {}, onProgress = null) {
  const operationStart = Date.now();

  const {
    maxArticles = articles.length, // Extract ALL by default, let caller control quantity
    timeout = PIPELINE_CONFIG.extraction.timeout,
    parallel = PIPELINE_CONFIG.extraction.parallel,
    batchSize = PIPELINE_CONFIG.extraction.batchSize,
    retryOnLowQuality = PIPELINE_CONFIG.extraction.retryLowQuality,
    qualityThreshold = 'medium', // 'low', 'medium', 'high'
    useWindowManager = true, // Use dedicated window (set to false to use current window)
    windowManagerOptions = {} // Options for window manager
  } = options;

  if (!articles || articles.length === 0) {
    logger.system.warn('No articles provided for extraction', {
      category: logger.CATEGORIES.FETCH
    });
    return [];
  }

  const articlesToProcess = articles.slice(0, maxArticles);

  logger.system.info('Starting batch content extraction', {
    category: logger.CATEGORIES.FETCH,
    data: {
      total: articlesToProcess.length,
      mode: parallel ? 'parallel' : 'sequential',
      batchSize: parallel ? batchSize : 1,
      timeout,
      retryEnabled: retryOnLowQuality,
      useWindowManager
    }
  });

  // Create window manager if enabled
  const windowManager = useWindowManager ? createWindowManager(windowManagerOptions) : null;

  try {
    // Create dedicated processing window if using window manager
    if (windowManager) {
      await windowManager.createProcessingWindow();

      logger.system.info('Using dedicated processing window', {
        category: logger.CATEGORIES.FETCH,
        data: await windowManager.getStats()
      });
    }

    let results = [];
    let completedCount = 0; // Track completions across all batches

    if (parallel) {
      // Parallel batch processing
      for (let i = 0; i < articlesToProcess.length; i += batchSize) {
        const batch = articlesToProcess.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(articlesToProcess.length / batchSize);

        logger.system.info(`Processing batch ${batchNumber}/${totalBatches}`, {
          category: logger.CATEGORIES.FETCH,
          data: {
            batchSize: batch.length,
            articlesInBatch: batch.map(a => a.source)
          }
        });

        const batchStart = Date.now();
        const batchResults = await Promise.allSettled(
          batch.map(async (article, batchIndex) => {
            const result = await extractSingleArticleWithTab(article, timeout, windowManager);

            // Call progress callback immediately when this article completes
            if (onProgress) {
              completedCount++;
              try {
                await onProgress(result, completedCount - 1, articlesToProcess.length);
              } catch (callbackError) {
                logger.system.warn('Progress callback failed', {
                  category: logger.CATEGORIES.FETCH,
                  error: callbackError
                });
              }
            }

            return result;
          })
        );

        const processedBatch = batchResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            logger.system.warn('Article extraction failed', {
              category: logger.CATEGORIES.FETCH,
              error: result.reason,
              data: {
                article: batch[index].title.substring(0, 60),
                source: batch[index].source
              }
            });

            return {
              ...batch[index],
              contentExtracted: false,
              extractionError: result.reason?.message || 'Unknown error',
              extractionMethod: 'failed'
            };
          }
        });

        const batchDuration = Date.now() - batchStart;
        const batchSuccess = processedBatch.filter(a => a.contentExtracted).length;

        logger.system.debug('Batch completed', {
          category: logger.CATEGORIES.FETCH,
          data: {
            batch: batchNumber,
            successful: batchSuccess,
            failed: batch.length - batchSuccess,
            duration: batchDuration,
            avgPerArticle: Math.round(batchDuration / batch.length)
          }
        });

        results.push(...processedBatch);
      }
    } else {
      // Sequential processing (fallback)
      logger.system.warn('Using sequential extraction (slower)', {
        category: logger.CATEGORIES.FETCH
      });

      for (let i = 0; i < articlesToProcess.length; i++) {
        const article = articlesToProcess[i];
        try {
          const extracted = await extractSingleArticleWithTab(article, timeout, windowManager);
          results.push(extracted);

          // Call progress callback
          if (onProgress) {
            try {
              await onProgress(extracted, i, articlesToProcess.length);
            } catch (callbackError) {
              logger.system.warn('Progress callback failed', {
                category: logger.CATEGORIES.FETCH,
                error: callbackError
              });
            }
          }
        } catch (error) {
          logger.system.error('Sequential extraction failed', {
            category: logger.CATEGORIES.FETCH,
            error,
            data: { article: article.title.substring(0, 60) }
          });

          const failedArticle = {
            ...article,
            contentExtracted: false,
            extractionError: error.message,
            extractionMethod: 'failed'
          };
          results.push(failedArticle);

          // Call progress callback even for failed articles
          if (onProgress) {
            try {
              await onProgress(failedArticle, i, articlesToProcess.length);
            } catch (callbackError) {
              logger.system.warn('Progress callback failed', {
                category: logger.CATEGORIES.FETCH,
                error: callbackError
              });
            }
          }
        }
      }
    }

    // Quality analysis and retry if enabled
    if (retryOnLowQuality) {
      results = await retryLowQualityExtractions(results, timeout, windowManager);
    }

    // Final statistics
    const duration = Date.now() - operationStart;
    const successful = results.filter(a => a.contentExtracted).length;
    const failed = results.length - successful;
    const avgQuality = calculateAverageQuality(results.filter(a => a.contentExtracted));

    logger.system.info('Batch extraction completed', {
      category: logger.CATEGORIES.FETCH,
      data: {
        total: results.length,
        successful,
        failed,
        successRate: `${((successful / results.length) * 100).toFixed(1)}%`,
        avgQuality: avgQuality.toFixed(2),
        duration,
        avgPerArticle: Math.round(duration / results.length)
      }
    });

    return results;
  } catch (error) {
    const duration = Date.now() - operationStart;

    logger.system.error('Batch extraction failed catastrophically', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { duration, articlesAttempted: articlesToProcess.length }
    });

    throw error;
  } finally {
    // Always cleanup window manager
    if (windowManager) {
      logger.system.debug('Cleaning up processing window', {
        category: logger.CATEGORIES.FETCH
      });

      await windowManager.cleanup();
    }
  }
}

/**
 * Extract content from a single article using Chrome tab
 *
 * @param {Object} article - Article object with link
 * @param {number} timeout - Timeout in milliseconds
 * @param {ProcessingWindowManager|null} windowManager - Optional window manager
 * @returns {Promise<Object>} Article with extracted content
 */
async function extractSingleArticleWithTab(article, timeout, windowManager = null) {
  const extractionStart = Date.now();
  let tabId = null;

  logger.system.debug('Starting single article extraction', {
    category: logger.CATEGORIES.FETCH,
    data: {
      title: article.title.substring(0, 60),
      source: article.source,
      url: article.link.substring(0, 80),
      useWindowManager: !!windowManager
    }
  });

  try {
    // Step 1: Create background tab (using window manager if available)
    let tab;
    if (windowManager) {
      tab = await windowManager.createTab(article.link);
    } else {
      tab = await chrome.tabs.create({
        url: article.link,
        active: false
      });
    }
    tabId = tab.id;

    // Mark this tab as an extraction tab to prevent content script from running UI
    await chrome.storage.session.set({
      [`extractionTab_${tabId}`]: true
    });

    logger.system.trace('Tab created and marked as extraction tab', {
      category: logger.CATEGORIES.FETCH,
      data: { tabId, source: article.source }
    });

    // Step 2: Wait for tab to load with timeout
    await Promise.race([
      waitForTabToLoad(tabId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tab load timeout after ${timeout}ms`)), timeout)
      )
    ]);

    logger.system.trace('Tab loaded, checking for redirects', {
      category: logger.CATEGORIES.FETCH,
      data: { tabId }
    });

    // Step 3: Wait for redirects to complete (Google News, etc.)
    const redirectStart = Date.now();
    await waitForRedirectsToComplete(tabId, 3000);
    const redirectDuration = Date.now() - redirectStart;

    logger.system.trace('Redirects resolved', {
      category: logger.CATEGORIES.FETCH,
      data: { tabId, redirectDuration }
    });

    // Step 4: Get final URL after redirects
    const finalTab = await chrome.tabs.get(tabId);
    const finalUrl = finalTab.url;

    logger.system.debug('Final URL obtained', {
      category: logger.CATEGORIES.FETCH,
      data: {
        tabId,
        originalUrl: article.link.substring(0, 80),
        finalUrl: finalUrl.substring(0, 80),
        wasRedirected: article.link !== finalUrl
      }
    });

    // Step 5: Extract content with Readability
    const extractionMethodStart = Date.now();
    const extractedContent = await extractContentFromTab(tabId);
    const extractionMethodDuration = Date.now() - extractionMethodStart;

    // Step 6: Quality validation
    const quality = assessContentQuality(extractedContent);

    logger.system.debug('Content extracted and validated', {
      category: logger.CATEGORIES.FETCH,
      data: {
        tabId,
        method: extractedContent.method,
        contentLength: extractedContent.textContent?.length || 0,
        wordCount: countWords(extractedContent.textContent || ''),
        quality: quality.score.toFixed(2),
        qualityLevel: quality.level,
        extractionDuration: extractionMethodDuration
      }
    });

    // Step 7: Cleanup tab and remove extraction flag
    if (windowManager) {
      await windowManager.removeTab(tabId, true);
    } else {
      await chrome.tabs.remove(tabId);
    }

    // Remove extraction flag from storage
    await chrome.storage.session.remove(`extractionTab_${tabId}`);

    logger.system.trace('Tab closed and extraction flag removed', {
      category: logger.CATEGORIES.FETCH,
      data: { tabId }
    });

    const totalDuration = Date.now() - extractionStart;

    logger.system.info('Article extraction successful', {
      category: logger.CATEGORIES.FETCH,
      data: {
        source: article.source,
        method: extractedContent.method,
        quality: quality.score.toFixed(2),
        totalDuration,
        breakdown: {
          redirect: redirectDuration,
          extraction: extractionMethodDuration
        }
      }
    });

    return {
      ...article,
      contentExtracted: true,
      extractedContent: {
        ...extractedContent,
        quality: quality.score,
        qualityLevel: quality.level,
        qualityIssues: quality.issues
      },
      extractionMethod: extractedContent.method,
      finalUrl,
      extractionDuration: totalDuration,
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    const duration = Date.now() - extractionStart;

    // Cleanup tab on error
    if (tabId) {
      try {
        if (windowManager) {
          await windowManager.removeTab(tabId, true);
        } else {
          await chrome.tabs.remove(tabId);
        }
        // Remove extraction flag from storage
        await chrome.storage.session.remove(`extractionTab_${tabId}`);
        logger.system.trace('Tab cleaned up after error and extraction flag removed', {
          category: logger.CATEGORIES.FETCH,
          data: { tabId }
        });
      } catch (closeError) {
        logger.system.trace('Tab already closed', {
          category: logger.CATEGORIES.FETCH,
          data: { tabId }
        });
      }
    }

    logger.system.error('Article extraction failed', {
      category: logger.CATEGORIES.FETCH,
      error,
      data: {
        article: article.title.substring(0, 60),
        source: article.source,
        duration
      }
    });

    throw error;
  }
}

/**
 * Wait for tab to finish loading
 * 
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object>} Loaded tab
 */
function waitForTabToLoad(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (tab.status === 'complete') {
        resolve(tab);
        return;
      }

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
 * Handles Google News and other redirect services
 * 
 * @param {number} tabId - Tab ID
 * @param {number} maxWait - Maximum wait time in ms
 * @returns {Promise<void>}
 */
async function waitForRedirectsToComplete(tabId, maxWait = 3000) {
  const startTime = Date.now();
  let previousUrl = null;
  let stableCount = 0;
  const checksNeeded = 3;

  while (Date.now() - startTime < maxWait) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const currentUrl = tab.url;

      // Check if still on redirect page
      if (currentUrl.includes('news.google.com/rss/articles')) {
        logger.system.trace('Tab on redirect page, waiting', {
          category: logger.CATEGORIES.FETCH,
          data: { tabId }
        });
        previousUrl = currentUrl;
        stableCount = 0;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Check if URL has stabilized
      if (currentUrl === previousUrl) {
        stableCount++;
        if (stableCount >= checksNeeded) {
          logger.system.trace('URL stabilized', {
            category: logger.CATEGORIES.FETCH,
            data: { tabId, url: currentUrl.substring(0, 60), checks: stableCount }
          });
          return;
        }
      } else {
        stableCount = 0;
      }

      previousUrl = currentUrl;
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      logger.system.warn('Tab check failed during redirect wait', {
        category: logger.CATEGORIES.FETCH,
        data: { tabId, error: error.message }
      });
      return;
    }
  }

  logger.system.debug('Redirect wait timeout reached', {
    category: logger.CATEGORIES.FETCH,
    data: { tabId, maxWait }
  });
}

/**
 * Extract content from loaded tab using Readability.js
 * Implements multiple extraction strategies with fallbacks
 * 
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object>} Extracted content
 */
async function extractContentFromTab(tabId) {
  logger.system.trace('Injecting Readability and extracting content', {
    category: logger.CATEGORIES.FETCH,
    data: { tabId }
  });

  try {
    // Step 1: Inject Readability library
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['offscreen/readability.js']
    });

    logger.system.trace('Readability.js injected', {
      category: logger.CATEGORIES.FETCH,
      data: { tabId }
    });

    // Step 2: Execute extraction script with enhanced fallbacks
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractContentInPage
    });

    if (!results || results.length === 0 || !results[0].result) {
      throw new Error('No content extracted from page');
    }

    const content = results[0].result;

    logger.system.debug('Content extraction completed in tab', {
      category: logger.CATEGORIES.FETCH,
      data: {
        tabId,
        method: content.method,
        contentLength: content.textContent?.length || 0,
        hasTitle: !!content.title,
        hasExcerpt: !!content.excerpt
      }
    });

    return content;
  } catch (error) {
    logger.system.error('Tab content extraction failed', {
      category: logger.CATEGORIES.FETCH,
      error,
      data: { tabId }
    });
    throw error;
  }
}

/**
 * Function executed in page context
 * Extracts article content using Readability.js with intelligent fallbacks
 * 
 * @returns {Object} Extracted content
 */
function extractContentInPage() {
  try {
    const documentClone = document.cloneNode(true);
    let article = null;
    let method = 'readability';

    // Strategy 1: Try Readability.js (Mozilla's battle-tested library)
    if (typeof Readability !== 'undefined') {
      try {
        const reader = new Readability(documentClone, {
          charThreshold: 100,
          classesToPreserve: ['caption', 'credit']
        });
        article = reader.parse();

        if (article && article.textContent && article.textContent.length >= 200) {
          return formatExtractedContent(article, method);
        } else {
          method = 'fallback-selector';
          article = extractWithSmartSelectors();
        }
      } catch (error) {
        method = 'fallback-selector';
        article = extractWithSmartSelectors();
      }
    } else {
      method = 'fallback-selector';
      article = extractWithSmartSelectors();
    }

    // Strategy 2: If content too short, try enhanced fallback
    if (!article || !article.textContent || article.textContent.length < 200) {
      method = 'fallback-aggressive';
      article = extractWithAggressiveFallback();
    }

    if (!article || !article.textContent) {
      throw new Error('All extraction methods failed');
    }

    return formatExtractedContent(article, method);
  } catch (error) {
    // Last resort: basic extraction
    return {
      title: document.title || 'Untitled',
      content: '',
      textContent: document.body?.textContent?.trim() || '',
      excerpt: document.body?.textContent?.trim().substring(0, 200) || '',
      byline: '',
      siteName: '',
      lang: document.documentElement?.lang || 'unknown',
      length: document.body?.textContent?.trim().length || 0,
      url: window.location.href,
      method: 'error-fallback',
      error: error.message,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Smart selector-based extraction
   * Uses prioritized list of common article selectors
   */
  function extractWithSmartSelectors() {
    const selectors = [
      // Semantic HTML5
      'article[role="main"]',
      'main article',
      'article',
      '[role="article"]',
      
      // Common CMS patterns
      '.post-content article',
      '.article-content',
      '.entry-content',
      '.post-content',
      '.article-body',
      '.story-body',
      '.content-body',
      
      // News sites
      '[itemprop="articleBody"]',
      '.article__body',
      '.story__body',
      
      // Fallbacks
      'main',
      '#content article',
      '#main-content',
      '#content'
    ];

    const title = extractTitle();
    const metadata = extractMetadata();

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length >= 200) {
        const textContent = cleanText(element.textContent);
        
        return {
          title,
          content: element.innerHTML,
          textContent,
          excerpt: textContent.substring(0, 300),
          byline: metadata.author,
          siteName: metadata.siteName,
          lang: document.documentElement?.lang || 'unknown',
          length: textContent.length
        };
      }
    }

    return null;
  }

  /**
   * Aggressive fallback with content scoring
   * Finds largest text block on page
   */
  function extractWithAggressiveFallback() {
    const title = extractTitle();
    const metadata = extractMetadata();

    // Find all potential content containers
    const candidates = Array.from(document.querySelectorAll('div, section, article, main'));
    
    let bestCandidate = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const text = candidate.textContent.trim();
      const textLength = text.length;
      
      // Skip if too short or too much HTML
      if (textLength < 200) continue;
      
      const htmlLength = candidate.innerHTML.length;
      const textToHtmlRatio = textLength / htmlLength;
      
      // Skip if mostly HTML (ads, navigation, etc.)
      if (textToHtmlRatio < 0.3) continue;

      // Score based on length, class names, and position
      let score = textLength;
      
      const className = (candidate.className || '').toLowerCase();
      if (className.includes('content') || className.includes('article') || 
          className.includes('post') || className.includes('story')) {
        score *= 1.5;
      }
      if (className.includes('sidebar') || className.includes('nav') || 
          className.includes('footer') || className.includes('header')) {
        score *= 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      const textContent = cleanText(bestCandidate.textContent);
      return {
        title,
        content: bestCandidate.innerHTML,
        textContent,
        excerpt: textContent.substring(0, 300),
        byline: metadata.author,
        siteName: metadata.siteName,
        lang: document.documentElement?.lang || 'unknown',
        length: textContent.length
      };
    }

    // Ultimate fallback: body
    const bodyText = cleanText(document.body.textContent);
    return {
      title,
      content: document.body.innerHTML,
      textContent: bodyText,
      excerpt: bodyText.substring(0, 300),
      byline: metadata.author,
      siteName: metadata.siteName,
      lang: document.documentElement?.lang || 'unknown',
      length: bodyText.length
    };
  }

  /**
   * Extract title from various sources
   */
  function extractTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const h1 = document.querySelector('h1');
    const titleTag = document.querySelector('title');

    return (ogTitle?.content || 
            twitterTitle?.content || 
            h1?.textContent || 
            titleTag?.textContent || 
            'Untitled').trim();
  }

  /**
   * Extract metadata from page
   */
  function extractMetadata() {
    const author = document.querySelector('meta[name="author"]')?.content ||
                   document.querySelector('[rel="author"]')?.textContent ||
                   document.querySelector('.author')?.textContent ||
                   '';

    const siteName = document.querySelector('meta[property="og:site_name"]')?.content ||
                     document.querySelector('meta[name="application-name"]')?.content ||
                     '';

    return { author: author.trim(), siteName: siteName.trim() };
  }

  /**
   * Clean and normalize text content
   */
  function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')     // Limit consecutive newlines
      .trim();
  }

  /**
   * Extract featured image from page metadata
   */
  function extractFeaturedImage() {
    // Try Open Graph image first
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    if (ogImage) return ogImage;

    // Try Twitter image
    const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content;
    if (twitterImage) return twitterImage;

    // Try article tag
    const articleImage = document.querySelector('meta[property="article:image"]')?.content;
    if (articleImage) return articleImage;

    // Try first img in article content
    const articleElement = document.querySelector('article img, [role="article"] img, .article-content img, .post-content img');
    if (articleElement?.src) return articleElement.src;

    return null;
  }

  /**
   * Extract favicon from page
   */
  function extractFavicon() {
    // Try various favicon link tags
    const favicon = document.querySelector('link[rel="icon"]')?.href ||
                    document.querySelector('link[rel="shortcut icon"]')?.href ||
                    document.querySelector('link[rel="apple-touch-icon"]')?.href;

    if (favicon) return favicon;

    // Fallback to default favicon location
    try {
      const url = new URL(window.location.href);
      return `${url.protocol}//${url.hostname}/favicon.ico`;
    } catch {
      return null;
    }
  }

  /**
   * Extract domain from current URL
   */
  function extractDomain() {
    try {
      const url = new URL(window.location.href);
      return url.hostname.replace(/^www\./, ''); // Normalize domain (remove www.)
    } catch {
      return null;
    }
  }

  /**
   * Format extracted content into standard structure
   */
  function formatExtractedContent(article, method) {
    return {
      title: article.title || extractTitle(),
      content: article.content || '',
      textContent: article.textContent || '',
      excerpt: article.excerpt || article.textContent?.substring(0, 300) || '',
      byline: article.byline || '',
      siteName: article.siteName || '',
      lang: article.lang || document.documentElement?.lang || 'unknown',
      length: article.length || article.textContent?.length || 0,
      url: window.location.href,
      domain: extractDomain(),
      featuredImage: extractFeaturedImage(),
      favicon: extractFavicon(),
      method,
      extractedAt: new Date().toISOString()
    };
  }
}

/**
 * Assess content quality with scoring
 * 
 * @param {Object} content - Extracted content
 * @returns {Object} Quality assessment
 */
function assessContentQuality(content) {
  const issues = [];
  let score = 100;
  const thresholds = PIPELINE_CONFIG.extraction.qualityThresholds;

  const textLength = content.textContent?.length || 0;
  const wordCount = countWords(content.textContent || '');

  // Length checks
  if (textLength < thresholds.minContentLength) {
    issues.push('content_too_short');
    score -= 40;
  }

  if (textLength > thresholds.maxContentLength) {
    issues.push('content-too-long');
    score -= 20;
  }

  if (wordCount < thresholds.minWordCount) {
    issues.push('word_count_low');
    score -= 30;
  }

  // HTML ratio check (detect if too much HTML vs text)
  if (content.content) {
    const htmlLength = content.content.length;
    const htmlRatio = htmlLength / (textLength || 1);

    if (htmlRatio > thresholds.maxHtmlRatio) {
      issues.push('high_html_ratio');
      score -= 20;
    }
  }

  // Title check
  if (!content.title || content.title === 'Untitled') {
    issues.push('missing_title');
    score -= 10;
  }

  // Excerpt check
  if (!content.excerpt || content.excerpt.length < 50) {
    issues.push('poor_excerpt');
    score -= 10;
  }

  // Method penalty
  if (content.method.includes('fallback')) {
    score -= 15;
  }
  if (content.method.includes('error')) {
    score -= 50;
  }

  // Determine quality level
  let level = 'low';
  if (score >= 80) level = 'high';
  else if (score >= 60) level = 'medium';

  return {
    score: Math.max(0, score),
    level,
    issues,
    metrics: {
      textLength,
      wordCount,
      hasTitle: !!content.title,
      hasExcerpt: !!content.excerpt,
      method: content.method
    }
  };
}

/**
 * Retry extractions that produced low-quality results
 *
 * @param {Array<Object>} results - Initial extraction results
 * @param {number} timeout - Timeout per retry
 * @param {ProcessingWindowManager|null} windowManager - Optional window manager
 * @returns {Promise<Array<Object>>} Updated results
 */
async function retryLowQualityExtractions(results, timeout, windowManager = null) {
  const lowQualityResults = results.filter(r => 
    r.contentExtracted && 
    r.extractedContent?.qualityLevel === 'low'
  );

  if (lowQualityResults.length === 0) {
    logger.system.debug('No low-quality extractions to retry', {
      category: logger.CATEGORIES.FETCH
    });
    return results;
  }

  logger.system.info('Retrying low-quality extractions', {
    category: logger.CATEGORIES.FETCH,
    data: {
      toRetry: lowQualityResults.length,
      sources: lowQualityResults.map(r => r.source)
    }
  });

  const retryPromises = lowQualityResults.map(async (result) => {
    try {
      logger.system.debug('Retrying extraction', {
        category: logger.CATEGORIES.FETCH,
        data: {
          source: result.source,
          previousQuality: result.extractedContent.quality
        }
      });

      const retried = await extractSingleArticleWithTab(result, timeout, windowManager);
      
      // Only replace if quality improved
      if (retried.extractedContent.quality > result.extractedContent.quality) {
        logger.system.info('Retry improved quality', {
          category: logger.CATEGORIES.FETCH,
          data: {
            source: result.source,
            before: result.extractedContent.quality.toFixed(2),
            after: retried.extractedContent.quality.toFixed(2)
          }
        });
        return retried;
      } else {
        logger.system.debug('Retry did not improve quality', {
          category: logger.CATEGORIES.FETCH,
          data: { source: result.source }
        });
        return result;
      }
    } catch (error) {
      logger.system.warn('Retry extraction failed', {
        category: logger.CATEGORIES.FETCH,
        error,
        data: { source: result.source }
      });
      return result;
    }
  });

  const retriedResults = await Promise.all(retryPromises);

  // Merge retried results back
  const resultMap = new Map(results.map(r => [r.link, r]));
  retriedResults.forEach(retried => {
    resultMap.set(retried.link, retried);
  });

  return Array.from(resultMap.values());
}

/**
 * Count words in text
 * 
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Calculate average quality score
 * 
 * @param {Array<Object>} articles - Articles with quality scores
 * @returns {number} Average quality
 */
function calculateAverageQuality(articles) {
  if (articles.length === 0) return 0;
  
  const totalQuality = articles.reduce((sum, article) => {
    return sum + (article.extractedContent?.quality || 0);
  }, 0);
  
  return totalQuality / articles.length;
}
