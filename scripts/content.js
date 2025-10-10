function extractArticleData() {
    const data = {
        url: window.location.href,
        source: window.location.hostname,
        language: document.documentElement.lang,
        title: document.title,
        publishedDate: null,
        author: null,
        content: ''
    };

    console.log("PerspectiveLens: Starting data extraction...");

    // Title from h1
    const h1 = document.querySelector('h1');
    if (h1) {
        data.title = h1.textContent.trim();
        console.log("PerspectiveLens: Extracted Title -", data.title);
    }

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
