/**
 * PerspectiveLens Offscreen Document
 * Handles content extraction using Readability.js in a hidden document
 */

console.log('PerspectiveLens Offscreen Document loaded');

/**
 * Resolve Google News redirect to get actual article URL
 * @param {string} url - Google News redirect URL
 * @returns {Promise<string>} Final article URL
 */
async function resolveGoogleNewsRedirect(url) {
  // Check if it's a Google News redirect
  if (!url.includes('news.google.com')) {
    return url; // Not a Google News URL, return as-is
  }

  console.log('[Offscreen] 🔄 Resolving Google News redirect...');

  try {
    // Use fetch with redirect: 'follow' to get final URL
    const response = await fetch(url, {
      method: 'HEAD', // HEAD is faster, we just need the final URL
      redirect: 'follow'
    });

    const finalUrl = response.url;
    console.log('[Offscreen] ✅ Redirect resolved:', finalUrl);
    return finalUrl;

  } catch (error) {
    console.warn('[Offscreen] Failed to resolve redirect with HEAD, trying GET...', error);

    try {
      // Fallback to GET request
      const response = await fetch(url, { redirect: 'follow' });
      const finalUrl = response.url;
      console.log('[Offscreen] ✅ Redirect resolved with GET:', finalUrl);
      return finalUrl;
    } catch (fetchError) {
      console.error('[Offscreen] Could not resolve redirect:', fetchError);
      return url; // Return original URL as fallback
    }
  }
}

/**
 * Extract article content using Readability algorithm
 * @param {string} url - URL to extract content from
 * @returns {Promise<Object>} Extracted content
 */
async function extractContentWithReadability(url) {
  console.log('[Offscreen] Extracting content from:', url);

  // First, resolve Google News redirects
  const resolvedUrl = await resolveGoogleNewsRedirect(url);
  console.log('[Offscreen] Using resolved URL:', resolvedUrl);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox = 'allow-same-origin'; // Allow DOM access but restrict scripts

    let resolved = false;
    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    // Timeout handler
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Content extraction timeout (10s)'));
      }
    }, 10000);

    // Load handler
    iframe.onload = async () => {
      try {
        if (resolved) return;

        const duration = Date.now() - startTime;
        console.log(`[Offscreen] Page loaded in ${duration}ms`);

        // Get iframe document
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        if (!iframeDoc || !iframeDoc.body) {
          throw new Error('Could not access iframe document');
        }

        // Clone document for Readability (required)
        const documentClone = iframeDoc.cloneNode(true);

        // Extract using Readability.js
        let article = null;
        let method = 'readability';

        // Check if Readability is available
        if (typeof Readability !== 'undefined') {
          try {
            const reader = new Readability(documentClone);
            article = reader.parse();

            if (article) {
              console.log('[Offscreen] ✅ Readability extraction successful');
              console.log('[Offscreen] Title:', article.title);
              console.log('[Offscreen] Content length:', article.textContent?.length || 0);
            } else {
              console.warn('[Offscreen] Readability returned null, trying fallback...');
              method = 'fallback';
              article = extractWithFallback(iframeDoc);
            }
          } catch (error) {
            console.error('[Offscreen] Readability failed:', error);
            method = 'fallback';
            article = extractWithFallback(iframeDoc);
          }
        } else {
          console.warn('[Offscreen] Readability.js not available, using fallback');
          method = 'fallback';
          article = extractWithFallback(iframeDoc);
        }

        if (!article || !article.textContent) {
          throw new Error('No content extracted from page');
        }

        // Success
        resolved = true;
        clearTimeout(timeout);
        cleanup();

        resolve({
          title: article.title || 'Untitled',
          content: article.content || '',
          textContent: article.textContent || '',
          excerpt: article.excerpt || '',
          byline: article.byline || '',
          siteName: article.siteName || '',
          lang: article.lang || iframeDoc.documentElement?.lang || 'unknown',
          length: article.length || article.textContent?.length || 0,
          finalUrl: iframe.contentWindow.location.href,
          method,
          extractedAt: new Date().toISOString()
        });

      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(error);
        }
      }
    };

    // Error handler
    iframe.onerror = (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Failed to load page: ' + error.message));
      }
    };

    // Add to DOM and load URL (use resolved URL)
    document.body.appendChild(iframe);
    iframe.src = resolvedUrl;
  });
}

/**
 * Fallback extraction method when Readability fails
 * Uses basic DOM selectors
 */
function extractWithFallback(doc) {
  console.log('[Offscreen] Using fallback extraction...');

  // Try common article selectors
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

  let content = null;
  let title = null;

  // Extract title
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
  const h1 = doc.querySelector('h1');

  title = ogTitle?.content || twitterTitle?.content || h1?.textContent || doc.title || 'Untitled';

  // Extract content
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element && element.textContent.trim().length > 200) {
      content = element.innerHTML;

      // Also get text content
      const textContent = element.textContent.trim();

      console.log(`[Offscreen] ✅ Fallback found content using: ${selector}`);
      console.log(`[Offscreen] Content length: ${textContent.length}`);

      return {
        title: title.trim(),
        content: content,
        textContent: textContent,
        excerpt: textContent.substring(0, 200) + '...',
        byline: null,
        siteName: doc.querySelector('meta[property="og:site_name"]')?.content || '',
        lang: doc.documentElement?.lang || 'unknown',
        length: textContent.length
      };
    }
  }

  // Last resort: use body
  console.warn('[Offscreen] ⚠️ Using body as last resort');
  const bodyText = doc.body.textContent.trim();

  return {
    title: title.trim(),
    content: doc.body.innerHTML,
    textContent: bodyText,
    excerpt: bodyText.substring(0, 200) + '...',
    byline: null,
    siteName: '',
    lang: doc.documentElement?.lang || 'unknown',
    length: bodyText.length
  };
}

/**
 * Fetch content using fetch API + DOMParser
 * Alternative method for CORS-friendly sites
 */
async function extractContentWithFetch(url) {
  console.log('[Offscreen] Extracting with fetch method:', url);

  // Resolve Google News redirect first
  const resolvedUrl = await resolveGoogleNewsRedirect(url);
  console.log('[Offscreen] Fetch using resolved URL:', resolvedUrl);

  try {
    const response = await fetch(resolvedUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Clone for Readability
    const documentClone = doc.cloneNode(true);

    let article = null;
    let method = 'fetch+readability';

    if (typeof Readability !== 'undefined') {
      try {
        const reader = new Readability(documentClone);
        article = reader.parse();
        console.log('[Offscreen] ✅ Fetch+Readability successful');
      } catch (error) {
        console.warn('[Offscreen] Readability failed, using fallback');
        method = 'fetch+fallback';
        article = extractWithFallback(doc);
      }
    } else {
      method = 'fetch+fallback';
      article = extractWithFallback(doc);
    }

    return {
      ...article,
      finalUrl: resolvedUrl,
      method,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[Offscreen] Fetch method failed:', error);
    throw error;
  }
}

/**
 * Message handler from background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Offscreen] Message received:', message.type);

  if (message.type === 'EXTRACT_CONTENT_OFFSCREEN' && message.target === 'offscreen') {
    const url = message.url;

    // Try iframe method first (handles redirects), fallback to fetch
    extractContentWithReadability(url)
      .then(content => {
        console.log('[Offscreen] ✅ Extraction successful');
        sendResponse({
          success: true,
          content,
          method: content.method,
          finalUrl: content.finalUrl
        });
      })
      .catch(error => {
        console.error('[Offscreen] Iframe method failed, trying fetch...', error);

        // Fallback to fetch method
        extractContentWithFetch(url)
          .then(content => {
            console.log('[Offscreen] ✅ Fetch fallback successful');
            sendResponse({
              success: true,
              content,
              method: content.method,
              finalUrl: content.finalUrl
            });
          })
          .catch(fetchError => {
            console.error('[Offscreen] ❌ All extraction methods failed:', fetchError);
            sendResponse({
              success: false,
              error: fetchError.message
            });
          });
      });

    // Return true for async response
    return true;
  }

  return false;
});

console.log('[Offscreen] Ready to extract content');
