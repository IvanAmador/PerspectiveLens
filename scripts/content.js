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

    console.log(`PerspectiveLens: Detection score is ${score}`);

    if (score >= 3) {
        console.log("PerspectiveLens: News article detected!");
        const articleData = extractArticleData();
        console.log("PerspectiveLens: Final Extracted data object:", articleData);

        // Send data to the background script
        console.log("PerspectiveLens: Sending article data to background worker...");
        chrome.runtime.sendMessage({
            type: 'NEW_ARTICLE_DETECTED',
            data: articleData
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("PerspectiveLens: Error sending message:", chrome.runtime.lastError);
                return;
            }

            if (response && response.success) {
                console.log("PerspectiveLens: Article processed successfully!");
                console.log("PerspectiveLens: Keywords extracted:", response.data.keywords);
                console.log("PerspectiveLens: Status:", response.data.status);
            } else {
                console.error("PerspectiveLens: Processing failed:", response?.error);
            }
        });
    } else {
        console.log("PerspectiveLens: Not a news article.");
        // Next steps: show manual "Analyze as News" button
    }
}

// Run detection after the page is fully loaded
window.addEventListener('load', detectNewsArticle);
