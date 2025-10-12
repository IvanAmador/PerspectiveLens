/**
 * Content Extractor for PerspectiveLens
 * Extracts article content from URLs using Offscreen Document + Readability.js
 *
 * F-004: Extract Article Content
 * Resolves Google News redirects and extracts clean article content in parallel
 */

import { logger } from '../utils/logger.js';

/**
 * Extract content from multiple articles in parallel
 * @param {Array} articles - Array of article objects with {title, link, source}
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} Array of articles with extracted content
 */
export async function extractArticlesContent(articles, options = {}) {
  const {
    maxArticles = 10,
    timeout = 10000, // 10s per article
    parallel = true
  } = options;

  if (!articles || articles.length === 0) {
    logger.warn('No articles to extract content from');
    return [];
  }

  const articlesToProcess = articles.slice(0, maxArticles);

  logger.group(`📄 Extracting content from ${articlesToProcess.length} articles`);
  logger.info('Parallel mode:', parallel);
  logger.info('Timeout per article:', `${timeout}ms`);

  try {
    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    if (parallel) {
      // Extract all articles in parallel
      const startTime = Date.now();

      const results = await Promise.allSettled(
        articlesToProcess.map(article =>
          extractSingleArticle(article, timeout)
        )
      );

      const duration = Date.now() - startTime;
      logger.info(`⚡ Parallel extraction completed in ${duration}ms`);

      // Process results
      const successfulExtractions = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            logger.warn(`Failed to extract: ${articlesToProcess[index].title}`, result.reason);
            // Return original article without content
            return {
              ...articlesToProcess[index],
              contentExtracted: false,
              extractionError: result.reason?.message || 'Unknown error'
            };
          }
        });

      const successCount = successfulExtractions.filter(a => a.contentExtracted).length;
      logger.info(`✅ Successfully extracted ${successCount}/${articlesToProcess.length} articles`);
      logger.groupEnd();

      return successfulExtractions;

    } else {
      // Extract sequentially (fallback)
      logger.warn('Using sequential extraction (slower)');
      const results = [];

      for (const article of articlesToProcess) {
        try {
          const extracted = await extractSingleArticle(article, timeout);
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
 * Extract content from a single article
 * @param {Object} article - Article object with link
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Article with extracted content
 */
async function extractSingleArticle(article, timeout) {
  logger.debug(`Extracting: ${article.title.substring(0, 50)}...`);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Extraction timeout after ${timeout}ms`));
    }, timeout);

    // Send message to offscreen document
    chrome.runtime.sendMessage({
      type: 'EXTRACT_CONTENT_OFFSCREEN',
      target: 'offscreen',
      url: article.link
    }, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.success) {
        resolve({
          ...article,
          contentExtracted: true,
          extractedContent: response.content,
          extractionMethod: response.method,
          finalUrl: response.finalUrl,
          extractedAt: new Date().toISOString()
        });
      } else {
        reject(new Error(response?.error || 'Unknown extraction error'));
      }
    });
  });
}

/**
 * Ensure offscreen document is created
 */
async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    logger.debug('Offscreen document already exists');
    return;
  }

  // Create offscreen document
  logger.info('Creating offscreen document for content extraction...');

  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['DOM_SCRAPING'],
    justification: 'Extract article content from news URLs using Readability algorithm'
  });

  logger.info('✅ Offscreen document created');
}

/**
 * Close offscreen document (cleanup)
 */
export async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
    logger.info('Offscreen document closed');
  } catch (error) {
    // Document might not exist, that's OK
    logger.debug('No offscreen document to close');
  }
}

/**
 * Test content extraction with a single URL
 * Useful for debugging
 */
export async function testExtraction(url) {
  logger.group('🧪 Testing content extraction');
  logger.info('URL:', url);

  try {
    const testArticle = {
      title: 'Test Article',
      link: url,
      source: 'Test'
    };

    const result = await extractSingleArticle(testArticle, 15000);

    logger.info('✅ Test successful');
    logger.info('Final URL:', result.finalUrl);
    logger.info('Method:', result.extractionMethod);
    logger.info('Content length:', result.extractedContent?.textContent?.length || 0);
    logger.groupEnd();

    return result;

  } catch (error) {
    logger.error('❌ Test failed:', error);
    logger.groupEnd();
    throw error;
  }
}
