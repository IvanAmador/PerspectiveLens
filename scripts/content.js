/**
 * Extract title with intelligent fallback strategy
 * Priority: meta og:title > meta twitter:title > h1 > first heading > document.title > URL
 */
function extractTitle() {
    const candidates = [];

    // 1. OpenGraph title (most reliable for social sharing)
    const ogTitle = document.querySelector("meta[property='og:title']");
    if (ogTitle && ogTitle.content) {
        candidates.push({ source: 'og:title', text: ogTitle.content.trim() });
    }

    // 2. Twitter card title
    const twitterTitle = document.querySelector("meta[name='twitter:title']");
    if (twitterTitle && twitterTitle.content) {
        candidates.push({ source: 'twitter:title', text: twitterTitle.content.trim() });
    }

    // 3. Article-specific title meta
    const articleTitle = document.querySelector("meta[property='article:title']");
    if (articleTitle && articleTitle.content) {
        candidates.push({ source: 'article:title', text: articleTitle.content.trim() });
    }

    // 4. H1 inside article tag (most common for news sites)
    const articleH1 = document.querySelector('article h1');
    if (articleH1) {
        candidates.push({ source: 'article>h1', text: articleH1.textContent.trim() });
    }

    // 5. First H1 on page
    const h1 = document.querySelector('h1');
    if (h1) {
        candidates.push({ source: 'h1', text: h1.textContent.trim() });
    }

    // 6. First H2 (fallback for some sites)
    const h2 = document.querySelector('article h2, main h2, h2');
    if (h2) {
        candidates.push({ source: 'h2', text: h2.textContent.trim() });
    }

    // 7. Document title (clean up common patterns)
    if (document.title) {
        const cleanedTitle = document.title
            .split(/[|\-–—]/)[0] // Remove site name after separator
            .trim();
        candidates.push({ source: 'document.title', text: cleanedTitle });
    }

    // 8. URL slug (last resort)
    const urlPath = window.location.pathname;
    const urlSlug = urlPath
        .split('/')
        .filter(part => part.length > 0)
        .pop()
        .replace(/\.html?$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\d{4,}/g, '') // Remove dates
        .trim();
    if (urlSlug && urlSlug.length > 10) {
        candidates.push({ source: 'url-slug', text: urlSlug });
    }

    // Validate and score candidates
    const validCandidates = candidates.filter(c => {
        const text = c.text;
        // Must have at least 10 chars and max 200 chars
        if (!text || text.length < 10 || text.length > 200) return false;
        // Must have at least 2 words
        if (text.split(/\s+/).length < 2) return false;
        // Should not be just numbers or single word navigation
        if (/^(home|mundo|news|article|política|economia|sports)$/i.test(text)) return false;
        return true;
    });

    // Return best candidate
    if (validCandidates.length > 0) {
        const best = validCandidates[0];
        console.log(`PerspectiveLens: Title extracted from ${best.source}: "${best.text}"`);
        return best.text;
    }

    // Ultimate fallback
    console.warn("PerspectiveLens: No valid title found, using document.title");
    return document.title || 'Untitled Article';
}

function extractArticleData() {
    const data = {
        url: window.location.href,
        source: window.location.hostname,
        language: document.documentElement.lang,
        title: extractTitle(), // Use intelligent extraction
        publishedDate: null,
        author: null,
        content: ''
    };

    console.log("PerspectiveLens: Starting data extraction...");

    // Published Date from meta or time tag
    const publishedTimeMeta = document.querySelector("meta[property='article:published_time']");
    if (publishedTimeMeta) {
        data.publishedDate = new Date(publishedTimeMeta.content);
        console.log("PerspectiveLens: Extracted Date from meta -", data.publishedDate);
    } else {
        const timeTag = document.querySelector('time');
        if (timeTag) {
            data.publishedDate = new Date(timeTag.getAttribute('datetime') || timeTag.textContent);
            console.log("PerspectiveLens: Extracted Date from time tag -", data.publishedDate);
        }
    }

    // Author from meta
    const authorMeta = document.querySelector("meta[name='author']");
    if (authorMeta) {
        data.author = authorMeta.content;
        console.log("PerspectiveLens: Extracted Author -", data.author);
    }

    // Content from article tag
    const articleElement = document.querySelector('article');
    if (articleElement) {
        data.content = articleElement.innerText;
        console.log("PerspectiveLens: Extracted Content (from <article>). Length:", data.content.length);
    } else {
        console.log("PerspectiveLens: <article> tag not found. Content extraction might be incomplete.");
    }

    return data;
}


/**
 * State management for article detection
 */
let detectedArticleData = null;
let analysisInProgress = false;

/**
 * Passive detection - only detects and shows toast, doesn't start analysis
 */
function detectNewsArticle() {
    let score = 0;
    const domain = window.location.hostname;

    // PRD F-001: Detection Logic
    const whitelistedDomains = [
        'g1.globo.com', 'folha.uol.com.br', 'estadao.com.br', 'uol.com.br',
        'nytimes.com', 'cnn.com', 'washingtonpost.com', 'reuters.com',
        'bbc.com', 'theguardian.com', 'aljazeera.com', 'apnews.com',
        'lemonde.fr', 'elpais.com', 'spiegel.de', 'xinhuanet.com',
        'chinadaily.com.cn', 'globaltimes.cn', 'peopledaily.com.cn',
        'scmp.com', 'straitstimes.com', 'japantimes.co.jp',
        'clarin.com', 'lanacion.com.ar'
    ];

    // +2 points for domain
    if (whitelistedDomains.some(d => domain.includes(d))) {
        score += 2;
    }

    // +2 points for meta tags
    if (document.querySelector("meta[property='article:published_time']") || document.querySelector("meta[name='pubdate']")) {
        score += 2;
    }

    // +1 point for article structure
    if (document.querySelector('article') && document.querySelector('h1')) {
        score += 1;
    }

    // +1 point for content patterns
    const bodyText = document.body.innerText.toLowerCase();
    if (bodyText.includes('reported') || bodyText.includes('announced')) {
        score += 1;
    }

    console.log(`[PerspectiveLens] Detection score: ${score}/6`);

    if (score >= 3) {
        console.log("[PerspectiveLens] News article detected!");

        // Extract article data but don't send it yet
        detectedArticleData = extractArticleData();
        console.log("[PerspectiveLens] Article data extracted:", {
            title: detectedArticleData.title,
            source: detectedArticleData.source,
            contentLength: detectedArticleData.content?.length || 0
        });

        // Show toast notification to user
        showDetectionToast();
    } else {
        console.log("[PerspectiveLens] Not a news article (score too low)");
    }
}

/**
 * Show toast notification when article is detected
 */
function showDetectionToast() {
    // Wait for toast system to be loaded
    if (!window.PerspectiveLensToast) {
        console.warn("[PerspectiveLens] Toast system not loaded yet, retrying...");
        setTimeout(showDetectionToast, 500);
        return;
    }

    window.PerspectiveLensToast.showArticleDetected(
        // On Analyze button click
        () => {
            console.log("[PerspectiveLens] User clicked 'Analyze Now'");
            startAnalysis();
        },
        // On Dismiss button click
        () => {
            console.log("[PerspectiveLens] User dismissed detection toast");
        }
    );
}

/**
 * Start the analysis pipeline (triggered by user action)
 */
function startAnalysis() {
    if (analysisInProgress) {
        console.warn("[PerspectiveLens] Analysis already in progress");
        return;
    }

    if (!detectedArticleData) {
        console.error("[PerspectiveLens] No article data to analyze");
        window.PerspectiveLensToast?.showError(
            'Error',
            'No article data available. Please refresh the page.'
        );
        return;
    }

    analysisInProgress = true;

    // Show progress tracker
    if (window.PerspectiveLensProgress) {
        window.PerspectiveLensProgress.show();
        window.PerspectiveLensProgress.reset();
        window.PerspectiveLensProgress.addLog('Analysis started by user', 'info');
        window.PerspectiveLensProgress.updateStep('extract', 'active', 'Extracting article content...', 0);
    }

    // Send data to background script to start pipeline
    console.log("[PerspectiveLens] Sending article data to background worker...");
    chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        data: detectedArticleData
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("[PerspectiveLens] Error sending message:", chrome.runtime.lastError);
            analysisInProgress = false;

            if (window.PerspectiveLensProgress) {
                window.PerspectiveLensProgress.addLog('Failed to start analysis', 'error');
                window.PerspectiveLensProgress.updateStep('extract', 'error', 'Communication error');
            }

            window.PerspectiveLensToast?.showError(
                'Analysis Failed',
                'Could not communicate with background service',
                () => startAnalysis()
            );
            return;
        }

        if (response?.success) {
            console.log("[PerspectiveLens] Analysis started successfully");

            if (window.PerspectiveLensProgress) {
                window.PerspectiveLensProgress.addLog('Background worker received request', 'success');
            }
        } else {
            console.error("[PerspectiveLens] Failed to start analysis:", response?.error);
            analysisInProgress = false;

            if (window.PerspectiveLensProgress) {
                window.PerspectiveLensProgress.addLog(`Error: ${response?.error || 'Unknown error'}`, 'error');
                window.PerspectiveLensProgress.updateStep('extract', 'error', 'Failed to start');
            }

            window.PerspectiveLensToast?.showError(
                'Analysis Failed',
                response?.error || 'Unknown error occurred',
                () => startAnalysis()
            );
        }
    });
}

/**
 * Listen for progress updates from background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[PerspectiveLens] Content script received message:", message.type);

    try {
        switch (message.type) {
            case 'PROGRESS_UPDATE':
                handleProgressUpdate(message.data);
                break;

            case 'ANALYSIS_COMPLETE':
                handleAnalysisComplete(message.data);
                break;

            case 'ANALYSIS_FAILED':
                handleAnalysisError(message.error);
                break;
        }

        sendResponse({ success: true });
    } catch (error) {
        console.error("[PerspectiveLens] Error handling message:", error);
        sendResponse({ success: false, error: error.message });
    }

    return true;
});

/**
 * Handle progress updates from background
 */
function handleProgressUpdate(data) {
    if (!window.PerspectiveLensProgress) return;

    const { step, status, message, progress } = data;

    if (message) {
        window.PerspectiveLensProgress.addLog(message, status === 'error' ? 'error' : 'info');
    }

    if (step) {
        window.PerspectiveLensProgress.updateStep(step, status, message, progress || 0);
    }
}

/**
 * Handle analysis completion
 */
function handleAnalysisComplete(data) {
    console.log("[PerspectiveLens] Analysis completed!", data);

    analysisInProgress = false;

    if (window.PerspectiveLensProgress) {
        window.PerspectiveLensProgress.addLog('Analysis completed successfully!', 'success');
        window.PerspectiveLensProgress.updateStep('analyze', 'completed', 'Analysis complete!', 100);

        // Hide progress tracker after a delay
        setTimeout(() => {
            window.PerspectiveLensProgress.hide();
        }, 2000);
    }
}

/**
 * Handle analysis error
 */
function handleAnalysisError(error) {
    console.error("[PerspectiveLens] Analysis failed:", error);

    analysisInProgress = false;

    if (window.PerspectiveLensProgress) {
        window.PerspectiveLensProgress.addLog(`Analysis failed: ${error.message || error}`, 'error');
    }

    window.PerspectiveLensToast?.showError(
        'Analysis Failed',
        error.message || 'An error occurred during analysis',
        () => startAnalysis()
    );
}

// Run passive detection after page loads
window.addEventListener('load', detectNewsArticle);
