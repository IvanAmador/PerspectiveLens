/**
 * Universal Article Detector for PerspectiveLens
 * Language-agnostic detection system that works on news sites worldwide
 *
 * Detection Strategy:
 * - Layer 1: Structured Data (Schema.org/JSON-LD) - 40 points
 * - Layer 2: Open Graph & Meta Tags - 35 points
 * - Layer 3: Semantic HTML5 - 25 points
 * - Layer 4: Content Heuristics (language-agnostic) - 20 points
 * - Layer 5: URL Patterns (multilingual) - 15 points
 *
 * Threshold: 50+ points = Article detected
 *
 * IMPORTANT: This module uses global scope (window.ArticleDetector)
 * No ES6 imports/exports - compatible with content scripts
 */

(function() {
  'use strict';

  /**
   * Configuration for detection thresholds
   */
  const DETECTION_CONFIG = {
    THRESHOLD_SCORE: 40,        // Lowered from 50 to catch more Asian sites
    MIN_CONTENT_LENGTH: 300,
    MIN_PARAGRAPH_COUNT: 3,
    MIN_TEXT_DENSITY: 0.1, // text length / HTML length ratio
  };

/**
 * Layer 1: Detect Schema.org JSON-LD structured data
 * @returns {Object} { detected: boolean, score: number, data: Object }
 */
function detectSchemaOrgData() {
  const result = { detected: false, score: 0, data: {} };

  try {
    // Find all JSON-LD script tags
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);

        // Handle both single objects and arrays
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          const type = item['@type'] || item.type;

          // Check for article types
          const articleTypes = [
            'NewsArticle',
            'Article',
            'BlogPosting',
            'ReportageNewsArticle',
            'AnalysisNewsArticle',
            'OpinionNewsArticle',
            'ReviewNewsArticle',
            'BackgroundNewsArticle'
          ];

          if (articleTypes.includes(type)) {
            result.detected = true;
            result.score = 40;
            result.data = {
              type,
              headline: item.headline,
              datePublished: item.datePublished,
              author: item.author,
              publisher: item.publisher
            };
            return result;
          }
        }
      } catch (parseError) {
        // Skip invalid JSON
        continue;
      }
    }

    // Check for embedded JSON data (Next.js, React apps, Asian news sites)
    // Look for script tags containing article data
    const allScripts = document.querySelectorAll('script:not([type="application/ld+json"])');

    for (const script of allScripts) {
      try {
        const scriptText = script.textContent || '';

        // Skip very large scripts (>500KB)
        if (scriptText.length > 500000) continue;

        // Look for common article data patterns in JSON
        // Chinese/Asian sites often embed article data in __NEXT_DATA__ or similar
        if (scriptText.includes('aid') || scriptText.includes('articleId') ||
            scriptText.includes('pubdate') || scriptText.includes('publishTime') ||
            scriptText.includes('isNews') || scriptText.includes('newsDetail')) {

          // Try to extract JSON objects
          const jsonMatches = scriptText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);

          if (jsonMatches) {
            for (const jsonStr of jsonMatches) {
              try {
                const data = JSON.parse(jsonStr);

                // Check for article indicators
                const hasArticleId = data.aid || data.articleId || data.article_id;
                const hasPubDate = data.pubdate || data.publishTime || data.publish_time || data.datePublished;
                const hasIsNews = data.isNews || data.is_news;
                const hasContent = data.content || data.article_content;

                // If has multiple article indicators, score it
                let indicators = 0;
                if (hasArticleId) indicators++;
                if (hasPubDate) indicators++;
                if (hasIsNews) indicators++;
                if (hasContent && typeof hasContent === 'string' && hasContent.length > 200) indicators++;

                if (indicators >= 2) {
                  result.detected = true;
                  result.score = Math.min(indicators * 10, 30); // Up to 30 points
                  result.data = {
                    type: 'EmbeddedJSON',
                    hasArticleId: !!hasArticleId,
                    hasPubDate: !!hasPubDate,
                    hasIsNews: !!hasIsNews,
                    indicators
                  };
                  return result;
                }
              } catch (e) {
                // Skip invalid JSON
                continue;
              }
            }
          }
        }
      } catch (e) {
        // Skip script processing errors
        continue;
      }
    }

  } catch (error) {
    console.debug('[ArticleDetector] Schema.org detection error:', error);
  }

  return result;
}

/**
 * Layer 2: Detect Open Graph and meta tags
 * @returns {Object} { detected: boolean, score: number, data: Object }
 */
function detectOpenGraphTags() {
  const result = { detected: false, score: 0, data: {} };

  try {
    // Check og:type
    const ogType = document.querySelector('meta[property="og:type"]')?.content;

    if (ogType === 'article') {
      result.detected = true;
      result.score += 20;
    }

    // Check article-specific meta tags
    const articlePublishedTime = document.querySelector('meta[property="article:published_time"]')?.content;
    const articleModifiedTime = document.querySelector('meta[property="article:modified_time"]')?.content;
    const articleAuthor = document.querySelector('meta[property="article:author"]')?.content;
    const articleSection = document.querySelector('meta[property="article:section"]')?.content;

    if (articlePublishedTime) {
      result.detected = true;
      result.score += 10;
      result.data.publishedTime = articlePublishedTime;
    }

    if (articleModifiedTime) {
      result.score += 5;
      result.data.modifiedTime = articleModifiedTime;
    }

    if (articleAuthor || articleSection) {
      result.score += 5;
      result.data.author = articleAuthor;
      result.data.section = articleSection;
    }

    // Check Twitter Card (often used for articles)
    const twitterCard = document.querySelector('meta[name="twitter:card"]')?.content;
    if (twitterCard === 'summary_large_image' || twitterCard === 'summary') {
      result.score += 5;
    }

    // Asian news sites often use custom meta tags or data attributes
    // Check for common patterns
    const hasDescription = document.querySelector('meta[name="description"]')?.content;
    const hasKeywords = document.querySelector('meta[name="keywords"]')?.content;

    // If has detailed meta description (often indicates article)
    if (hasDescription && hasDescription.length > 100) {
      result.score += 3;
      result.data.hasDetailedDescription = true;
    }

    // Check for author meta tag (various formats)
    const authorMeta = document.querySelector('meta[name="author"]')?.content ||
                       document.querySelector('meta[property="author"]')?.content ||
                       document.querySelector('meta[name="article:author"]')?.content;

    if (authorMeta) {
      result.score += 5;
      result.data.author = authorMeta;
    }

    // Check for publication date in various formats
    const pubDate = document.querySelector('meta[name="pubdate"]')?.content ||
                   document.querySelector('meta[name="publishdate"]')?.content ||
                   document.querySelector('meta[property="pubdate"]')?.content;

    if (pubDate) {
      result.score += 5;
      result.data.pubDate = pubDate;
    }

    // Cap at 35 points
    result.score = Math.min(result.score, 35);
  } catch (error) {
    console.debug('[ArticleDetector] Open Graph detection error:', error);
  }

  return result;
}

/**
 * Layer 3: Detect semantic HTML5 structure
 * @returns {Object} { detected: boolean, score: number, data: Object }
 */
function detectSemanticHTML() {
  const result = { detected: false, score: 0, data: {} };

  try {
    // Check for <article> element
    const articleElement = document.querySelector('article');
    if (articleElement) {
      result.detected = true;
      result.score += 10;
      result.data.hasArticleTag = true;
    }

    // Check for article role
    const articleRole = document.querySelector('[role="article"]');
    if (articleRole) {
      result.detected = true;
      result.score += 8;
      result.data.hasArticleRole = true;
    }

    // Check for <time> element with datetime attribute
    const timeElement = document.querySelector('time[datetime]');
    if (timeElement) {
      result.score += 7;
      result.data.hasTimeElement = true;
      result.data.datetime = timeElement.getAttribute('datetime');
    }

    // Check for main content area
    const mainElement = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainElement) {
      result.score += 5;
      result.data.hasMainElement = true;
    }

    // Check for header within article
    if (articleElement && articleElement.querySelector('header')) {
      result.score += 5;
      result.data.hasArticleHeader = true;
    }

    // Chinese/Asian news sites often use data attributes for article metadata
    // Check for common patterns
    const hasArticleId = document.querySelector('[data-aid]') ||
                        document.querySelector('[aid]') ||
                        document.querySelector('[data-article-id]') ||
                        document.querySelector('[articleid]');

    if (hasArticleId) {
      result.score += 8;
      result.detected = true;
      result.data.hasArticleIdAttr = true;
    }

    // Check for pubdate/timestamp attributes
    const hasPubDate = document.querySelector('[pubdate]') ||
                      document.querySelector('[data-pubdate]') ||
                      document.querySelector('[data-publish-time]') ||
                      document.querySelector('[publishtime]');

    if (hasPubDate) {
      result.score += 7;
      result.detected = true;
      result.data.hasPubDateAttr = true;
    }

    // Check for isNews flag (common in Asian sites)
    const hasNewsFlag = document.querySelector('[isNews]') ||
                       document.querySelector('[data-is-news]') ||
                       document.querySelector('[is-news]') ||
                       document.querySelector('[data-news]');

    if (hasNewsFlag) {
      result.score += 7;
      result.detected = true;
      result.data.hasNewsFlag = true;
    }

    // Check for author/owner attributes
    const hasAuthor = document.querySelector('[owner_name]') ||
                     document.querySelector('[data-owner]') ||
                     document.querySelector('[data-author]') ||
                     document.querySelector('[author]');

    if (hasAuthor) {
      result.score += 3;
      result.data.hasAuthorAttr = true;
    }

    // Cap at 25 points
    result.score = Math.min(result.score, 25);
  } catch (error) {
    console.debug('[ArticleDetector] Semantic HTML detection error:', error);
  }

  return result;
}

/**
 * Layer 4: Language-agnostic content heuristics
 * @returns {Object} { detected: boolean, score: number, data: Object }
 */
function detectContentHeuristics() {
  const result = { detected: false, score: 0, data: {} };

  try {
    // Find main content area (try multiple strategies)
    let contentElement = document.querySelector('article') ||
                        document.querySelector('[role="article"]') ||
                        document.querySelector('main') ||
                        document.querySelector('[role="main"]');

    // Fallback 1: Common Asian news site patterns
    if (!contentElement) {
      const asianPatterns = [
        '.initDiv',           // yeeyi.com pattern
        '.article-body',
        '.article-content',
        '.post-body',
        '.post-content',
        '.content-body',
        '.detail-content',
        '[class*="articleBody"]',
        '[class*="postBody"]',
        '[class*="newsContent"]',
        '[class*="detailContent"]'
      ];

      for (const selector of asianPatterns) {
        contentElement = document.querySelector(selector);
        if (contentElement && (contentElement.innerText?.length || 0) > 200) {
          break;
        }
      }
    }

    // Fallback 2: Find largest text container
    if (!contentElement) {
      const candidates = document.querySelectorAll('div[class*="content"], div[class*="article"], div[id*="content"], div[id*="article"], div[class*="body"], div[class*="post"]');
      let maxTextLength = 0;

      for (const candidate of candidates) {
        const textLength = candidate.innerText?.length || 0;
        if (textLength > maxTextLength) {
          maxTextLength = textLength;
          contentElement = candidate;
        }
      }
    }

    // Fallback 3: Find div with most paragraphs
    if (!contentElement || (contentElement.innerText?.length || 0) < 200) {
      const allDivs = document.querySelectorAll('div');
      let maxParagraphs = 0;

      for (const div of allDivs) {
        const pCount = div.querySelectorAll('p').length;
        if (pCount > maxParagraphs && (div.innerText?.length || 0) > 200) {
          maxParagraphs = pCount;
          contentElement = div;
        }
      }
    }

    if (!contentElement) {
      contentElement = document.body;
    }

    // Analyze content
    const textContent = contentElement.innerText || '';
    const htmlContent = contentElement.innerHTML || '';
    const textLength = textContent.length;
    const htmlLength = htmlContent.length;

    // Calculate text density (higher = more actual content vs markup)
    const textDensity = htmlLength > 0 ? textLength / htmlLength : 0;
    result.data.textDensity = textDensity.toFixed(3);

    // Check content length
    if (textLength >= 2000) {
      result.score += 8;
      result.detected = true;
    } else if (textLength >= 1000) {
      result.score += 6;
      result.detected = true;
    } else if (textLength >= DETECTION_CONFIG.MIN_CONTENT_LENGTH) {
      result.score += 3;
    }

    // Count paragraphs (language-agnostic)
    const paragraphs = contentElement.querySelectorAll('p');
    const paragraphCount = Array.from(paragraphs).filter(p =>
      (p.innerText?.length || 0) > 50
    ).length;

    result.data.paragraphCount = paragraphCount;

    if (paragraphCount >= 8) {
      result.score += 7;
      result.detected = true;
    } else if (paragraphCount >= DETECTION_CONFIG.MIN_PARAGRAPH_COUNT) {
      result.score += 4;
    }

    // Check text density (articles have higher density than navigation-heavy pages)
    if (textDensity >= 0.3) {
      result.score += 5;
      result.detected = true;
    } else if (textDensity >= DETECTION_CONFIG.MIN_TEXT_DENSITY) {
      result.score += 2;
    }

    // Check for heading structure (h1 + h2/h3)
    const h1 = contentElement.querySelector('h1');
    const subheadings = contentElement.querySelectorAll('h2, h3, h4');

    if (h1 && subheadings.length >= 2) {
      result.score += 3;
      result.data.hasHeadingStructure = true;
    }

    // Cap at 20 points
    result.score = Math.min(result.score, 20);
    result.data.contentLength = textLength;
  } catch (error) {
    console.debug('[ArticleDetector] Content heuristics error:', error);
  }

  return result;
}

/**
 * Layer 5: Multilingual URL pattern detection
 * @returns {Object} { detected: boolean, score: number, data: Object }
 */
function detectURLPatterns() {
  const result = { detected: false, score: 0, data: {} };

  try {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Universal article patterns (Latin alphabet)
    const latinPatterns = [
      '/article/', '/articles/',
      '/news/', '/noticia/', '/noticias/', '/notícia/', '/notícias/',
      '/story/', '/stories/',
      '/post/', '/posts/',
      '/blog/', '/blogs/',
      '/reportage/', '/reportagem/',
      '/analysis/', '/analise/', '/análise/',
      '/detail/', '/details/',    // Common in Asian sites
      '/content/', '/contents/',
      '/read/'
    ];

    // Asian language patterns
    const asianPatterns = [
      '/新闻/', '/新聞/',  // Chinese: news
      '/記事/', '/记事/',  // Chinese/Japanese: article
      '/뉴스/',           // Korean: news
      '/기사/',           // Korean: article
      '/ニュース/',       // Japanese: news
      '/บทความ/',         // Thai: article
      '/tin-tuc/',        // Vietnamese: news
      '/berita/'          // Indonesian/Malay: news
    ];

    // Arabic/RTL patterns
    const rtlPatterns = [
      '/خبر/',   // Arabic: news
      '/مقال/',  // Arabic: article
      '/خبرها/', // Persian: news
      '/חדשות/', // Hebrew: news
      '/مضمون/'  // Urdu: article
    ];

    // Check all patterns
    const allPatterns = [...latinPatterns, ...asianPatterns, ...rtlPatterns];

    for (const pattern of allPatterns) {
      if (pathname.includes(pattern)) {
        result.detected = true;
        result.score += 8;
        result.data.matchedPattern = pattern;
        break;
      }
    }

    // Check for date in URL (YYYY/MM/DD or YYYYMMDD format)
    const datePatterns = [
      /\/20\d{2}\/\d{1,2}\/\d{1,2}\//,  // /2025/01/28/
      /\/20\d{2}\/\d{1,2}\//,            // /2025/01/
      /\/20\d{6,8}[\/\-]/,               // /20250128/ or /20250128-
      /\-20\d{6,8}/                      // -20250128
    ];

    for (const pattern of datePatterns) {
      if (pattern.test(pathname) || pattern.test(url)) {
        result.score += 7;
        result.data.hasDateInURL = true;
        break;
      }
    }

    // Check for numeric ID patterns (common in news sites)
    // e.g., /12345678, /story-12345, /article-id-999
    if (/\/\d{6,}/.test(pathname) || /[\-_](id[\-_])?\d{5,}/.test(pathname)) {
      result.score += 3;
      result.data.hasNumericID = true;
    }

    // Cap at 15 points
    result.score = Math.min(result.score, 15);
  } catch (error) {
    console.debug('[ArticleDetector] URL pattern detection error:', error);
  }

  return result;
}

/**
 * Main detection function - runs all layers and combines scores
 * @returns {Object} { isArticle: boolean, score: number, confidence: string, details: Object }
 */
function detectArticle() {
  console.log('[UniversalDetector] Starting article detection...');

  // Run all detection layers
  const schemaResult = detectSchemaOrgData();
  const ogResult = detectOpenGraphTags();
  const semanticResult = detectSemanticHTML();
  const heuristicResult = detectContentHeuristics();
  const urlResult = detectURLPatterns();

  // Calculate total score
  const totalScore =
    schemaResult.score +
    ogResult.score +
    semanticResult.score +
    heuristicResult.score +
    urlResult.score;

  // Determine if it's an article
  const isArticle = totalScore >= DETECTION_CONFIG.THRESHOLD_SCORE;

  // Calculate confidence level
  let confidence = 'low';
  if (totalScore >= 80) confidence = 'very_high';
  else if (totalScore >= 65) confidence = 'high';
  else if (totalScore >= 50) confidence = 'medium';

  const result = {
    isArticle,
    score: totalScore,
    threshold: DETECTION_CONFIG.THRESHOLD_SCORE,
    confidence,
    details: {
      schemaOrg: schemaResult,
      openGraph: ogResult,
      semanticHTML: semanticResult,
      contentHeuristics: heuristicResult,
      urlPatterns: urlResult
    },
    url: window.location.href,
    domain: window.location.hostname
  };

  console.log('[UniversalDetector] Detection complete:', {
    isArticle,
    score: totalScore,
    confidence,
    breakdown: {
      schema: schemaResult.score,
      og: ogResult.score,
      semantic: semanticResult.score,
      heuristic: heuristicResult.score,
      url: urlResult.score
    }
  });

  return result;
}

/**
 * Extract article metadata (language-agnostic)
 * @returns {Object} Article metadata
 */
function extractArticleMetadata() {
  const metadata = {
    url: window.location.href,
    domain: window.location.hostname,
    title: '',
    author: null,
    publishedDate: null,
    modifiedDate: null,
    language: document.documentElement.lang || null,
    description: null,
    image: null
  };

  // Extract title (multiple strategies)
  metadata.title =
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('meta[name="twitter:title"]')?.content ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.querySelector('title')?.textContent?.trim() ||
    '';

  // Extract author (multiple sources)
  metadata.author =
    document.querySelector('meta[property="article:author"]')?.content ||
    document.querySelector('meta[name="author"]')?.content ||
    document.querySelector('[rel="author"]')?.textContent?.trim() ||
    document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
    null;

  // Extract published date (multiple formats)
  metadata.publishedDate =
    document.querySelector('meta[property="article:published_time"]')?.content ||
    document.querySelector('meta[property="og:article:published_time"]')?.content ||
    document.querySelector('meta[name="pubdate"]')?.content ||
    document.querySelector('time[datetime]')?.getAttribute('datetime') ||
    document.querySelector('[itemprop="datePublished"]')?.content ||
    null;

  // Extract modified date
  metadata.modifiedDate =
    document.querySelector('meta[property="article:modified_time"]')?.content ||
    document.querySelector('meta[property="og:updated_time"]')?.content ||
    document.querySelector('[itemprop="dateModified"]')?.content ||
    null;

  // Extract description
  metadata.description =
    document.querySelector('meta[property="og:description"]')?.content ||
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[name="twitter:description"]')?.content ||
    null;

  // Extract image
  metadata.image =
    document.querySelector('meta[property="og:image"]')?.content ||
    document.querySelector('meta[name="twitter:image"]')?.content ||
    null;

  console.log('[UniversalDetector] Metadata extracted:', metadata);

  return metadata;
}

/**
 * Get detailed detection report (for debugging)
 * @returns {string} Human-readable report
 */
function getDetectionReport() {
  const detection = detectArticle();

  let report = `
[Article Detection Report]
==========================================

Result: ${detection.isArticle ? 'ARTICLE DETECTED' : 'NOT AN ARTICLE'}
Score: ${detection.score}/${detection.threshold} (${detection.confidence} confidence)

Layer Breakdown:
- Schema.org JSON-LD: ${detection.details.schemaOrg.score}/40
  ${detection.details.schemaOrg.detected ? 'Found: ' + detection.details.schemaOrg.data.type : 'Not found'}

- Open Graph Tags: ${detection.details.openGraph.score}/35
  ${detection.details.openGraph.detected ? 'Detected' : 'Not found'}

- Semantic HTML5: ${detection.details.semanticHTML.score}/25
  ${detection.details.semanticHTML.detected ? 'Detected' : 'Not found'}

- Content Heuristics: ${detection.details.contentHeuristics.score}/20
  Content length: ${detection.details.contentHeuristics.data.contentLength || 0} chars
  Paragraphs: ${detection.details.contentHeuristics.data.paragraphCount || 0}
  Text density: ${detection.details.contentHeuristics.data.textDensity || 0}

- URL Patterns: ${detection.details.urlPatterns.score}/15
  ${detection.details.urlPatterns.detected ? 'Matched: ' + (detection.details.urlPatterns.data.matchedPattern || 'date/id pattern') : 'No match'}

URL: ${detection.url}
==========================================
  `;

  return report.trim();
}

  // Expose API to global scope
  window.ArticleDetector = {
    detectArticle,
    extractArticleMetadata,
    getDetectionReport,
    DETECTION_CONFIG
  };

  console.log('[ArticleDetector] Module loaded successfully');

})(); // End IIFE
