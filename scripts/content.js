/**
 * PerspectiveLens Content Script
 * Detects news articles and handles user interaction
 */

console.log('[PerspectiveLens] Content script loaded');

/**
 * Wait for dependencies to load with optimized timeout
 */
function waitForDependencies() {
  return new Promise((resolve) => {
    // Verificação inicial imediata
    if (window.PerspectiveLensToast && window.PerspectiveLensProgress && window.PerspectiveLensPanel) {
      console.log('[PerspectiveLens] All dependencies already loaded');
      resolve(true);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 20 x 50ms = 1 segundo máximo
    const checkInterval = 50; // Verificar a cada 50ms

    const intervalId = setInterval(() => {
      attempts++;

      if (window.PerspectiveLensToast && window.PerspectiveLensProgress && window.PerspectiveLensPanel) {
        clearInterval(intervalId);
        console.log(`[PerspectiveLens] Dependencies loaded after ${attempts * checkInterval}ms`);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        console.warn('[PerspectiveLens] Some dependencies not loaded after 1s');
        console.log('[PerspectiveLens] Available:', {
          toast: !!window.PerspectiveLensToast,
          progress: !!window.PerspectiveLensProgress,
          panel: !!window.PerspectiveLensPanel
        });
        resolve(false);
      }
    }, checkInterval);
  });
}

/**
 * Extract article data from the page
 */
function extractArticleData() {
  const data = {
    url: window.location.href,
    title: '',
    source: window.location.hostname,
    content: '',
    publishedDate: null,
    author: null,
    language: document.documentElement.lang || 'en'
  };

  // Extract title
  data.title = document.querySelector('h1')?.textContent?.trim() ||
               document.querySelector('meta[property="og:title"]')?.content ||
               document.title;

  // Extract published date
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="pubdate"]',
    'time[datetime]',
    'time'
  ];

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      data.publishedDate = element.getAttribute('datetime') || 
                          element.getAttribute('content') ||
                          element.textContent;
      break;
    }
  }

  // Extract author
  data.author = document.querySelector('meta[name="author"]')?.content ||
                document.querySelector('[rel="author"]')?.textContent?.trim() ||
                null;

  // Extract main content
  const contentSelectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.post-content',
    'main'
  ];

  let contentElement = null;
  for (const selector of contentSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  if (contentElement) {
    const paragraphs = Array.from(contentElement.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 50);

    data.content = paragraphs.join('\n\n');
    console.log(`[PerspectiveLens] Extracted ${paragraphs.length} paragraphs (${data.content.length} chars)`);
  } else {
    console.log('[PerspectiveLens] Article content not found');
  }

  return data;
}

/**
 * State management for article detection
 */
let detectedArticleData = null;
let analysisInProgress = false;
let dependenciesLoaded = false;

/**
 * Passive detection - only detects and shows toast, doesn't start analysis
 */
function detectNewsArticle() {
  let score = 0;
  const domain = window.location.hostname;

  // Whitelisted domains
  const whitelistedDomains = [
    'g1.globo.com',
    'folha.uol.com.br',
    'estadao.com.br',
    'uol.com.br',
    'noticias.uol.com.br',
    'nytimes.com',
    'cnn.com',
    'washingtonpost.com',
    'reuters.com',
    'bbc.com',
    'theguardian.com',
    'aljazeera.com',
    'apnews.com',
    'lemonde.fr',
    'elpais.com',
    'spiegel.de',
    'xinhuanet.com',
    'chinadaily.com.cn',
    'globaltimes.cn',
    'peopledaily.com.cn',
    'scmp.com',
    'straitstimes.com',
    'japantimes.co.jp',
    'clarin.com',
    'lanacion.com.ar'
  ];

  // +2 points for domain
  if (whitelistedDomains.some(d => domain.includes(d))) {
    score += 2;
  }

  // +2 points for meta tags
  if (document.querySelector("meta[property='article:published_time']") ||
      document.querySelector("meta[name='pubdate']")) {
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
    console.log('[PerspectiveLens] News article detected!');

    detectedArticleData = extractArticleData();
    console.log('[PerspectiveLens] Article data extracted:', {
      title: detectedArticleData.title,
      source: detectedArticleData.source,
      contentLength: detectedArticleData.content?.length || 0
    });

    showDetectionToast();
  } else {
    console.log('[PerspectiveLens] Not a news article (score too low)');
  }
}

/**
 * Show toast notification when article is detected
 */
function showDetectionToast() {
  if (!dependenciesLoaded || !window.PerspectiveLensToast) {
    console.log('[PerspectiveLens] Toast not available, skipping notification');
    return;
  }

  window.PerspectiveLensToast.showArticleDetected(
    () => {
      console.log('[PerspectiveLens] User clicked "Analyze"');
      startAnalysis();
    },
    () => {
      console.log('[PerspectiveLens] User dismissed detection toast');
    }
  );
}

/**
 * Start the analysis pipeline (triggered by user action)
 */
function startAnalysis() {
  if (analysisInProgress) {
    console.warn('[PerspectiveLens] Analysis already in progress');
    return;
  }

  if (!detectedArticleData) {
    console.error('[PerspectiveLens] No article data to analyze');
    if (window.PerspectiveLensToast) {
      window.PerspectiveLensToast.showError(
        'Error',
        'No article data available. Please refresh the page.'
      );
    }
    return;
  }

  analysisInProgress = true;

  // Start progress tracking
  if (window.PerspectiveLensProgress) {
    window.PerspectiveLensProgress.start();
  }

  // NÃO mostrar painel aqui - apenas quando tiver dados

  // Send data to background script
  console.log('[PerspectiveLens] Sending article data to background worker...');

  chrome.runtime.sendMessage(
    {
      type: 'START_ANALYSIS',
      data: detectedArticleData
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[PerspectiveLens] Error sending message:', chrome.runtime.lastError);
        analysisInProgress = false;

        if (window.PerspectiveLensToast) {
          window.PerspectiveLensToast.showError(
            'Analysis Failed',
            'Could not communicate with background service',
            () => startAnalysis()
          );
        }

        if (window.PerspectiveLensProgress) {
          window.PerspectiveLensProgress.complete(false, 'Communication error');
        }

        if (window.PerspectiveLensPanel) {
          window.PerspectiveLensPanel.showError({
            message: 'Could not communicate with background service'
          });
        }
        return;
      }

      if (response?.success) {
        console.log('[PerspectiveLens] Analysis started successfully');
      } else {
        console.error('[PerspectiveLens] Failed to start analysis:', response?.error);
        analysisInProgress = false;

        if (window.PerspectiveLensToast) {
          window.PerspectiveLensToast.showError(
            'Analysis Failed',
            response?.error || 'Unknown error occurred',
            () => startAnalysis()
          );
        }

        if (window.PerspectiveLensProgress) {
          window.PerspectiveLensProgress.complete(false, response?.error || 'Unknown error');
        }

        if (window.PerspectiveLensPanel) {
          window.PerspectiveLensPanel.showError({
            message: response?.error || 'Unknown error occurred'
          });
        }
      }
    }
  );
}

/**
 * Listen for messages from background (SHOW_ANALYSIS from background.js)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[PerspectiveLens] Content script received message:', message.type);

  try {
    switch (message.type) {
      case 'PROGRESS_UPDATE':
        handleProgressUpdate(message.data);
        break;

      case 'SHOW_ANALYSIS':  // ← CORRIGIDO: background envia SHOW_ANALYSIS
        handleShowAnalysis(message.data);
        break;

      case 'ANALYSIS_STAGE_COMPLETE':  // ← NEW: Progressive analysis updates
        handleAnalysisStageComplete(message.data);
        break;

      case 'ANALYSIS_FAILED':
        handleAnalysisError(message.error);
        break;
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('[PerspectiveLens] Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

/**
 * Handle progress updates from background
 */
function handleProgressUpdate(data) {
  const { step, status, message, progress } = data;

  console.log('[PerspectiveLens] Progress update:', { step, status, message, progress });

  if (window.PerspectiveLensProgress) {
    window.PerspectiveLensProgress.updateStep(step, status, progress, message);
  }
}

/**
 * Handle SHOW_ANALYSIS message from background
 * Background envia: { analysis: {...}, perspectives: [...], articleData: {...} }
 */
function handleShowAnalysis(data) {
  console.log('[PerspectiveLens] Analysis data received from background:', data);
  analysisInProgress = false;

  // Validar se temos dados de análise
  if (!data || !data.analysis) {
    console.error('[PerspectiveLens] No analysis data in response');
    handleAnalysisError({ message: 'No analysis data received' });
    return;
  }

  // Complete progress tracker
  if (window.PerspectiveLensProgress) {
    window.PerspectiveLensProgress.complete(
      true,
      `Found ${data.perspectives?.length || 0} perspectives`
    );
  }

  if (window.PerspectiveLensPanel) {
    const panelData = {
      ...data.analysis,
      perspectives: data.perspectives
    };
    console.log('[PerspectiveLens] Sending to panel:', {
      hasStory: !!panelData.story_summary,
      hasGuidance: !!panelData.reader_guidance,
      hasConsensus: !!panelData.consensus,
      consensusType: typeof panelData.consensus,
      consensusKeys: panelData.consensus ? Object.keys(panelData.consensus).length : 0,
      hasDifferences: !!panelData.key_differences,
      differencesCount: panelData.key_differences?.length || 0,
      perspectivesCount: panelData.perspectives?.length || 0
    });
    window.PerspectiveLensPanel.showAnalysis(panelData);
  } else {
    console.error('[PerspectiveLens] Panel not available!');
  }
}

/**
 * Handle ANALYSIS_STAGE_COMPLETE message from background
 * Progressive analysis - updates UI as each stage completes
 * Background sends: { stage: number, stageData: {...}, perspectives: [...], articleData: {...} }
 */
function handleAnalysisStageComplete(data) {
  console.log(`[PerspectiveLens] Stage ${data.stage} completed:`, data);

  // Don't mark as not in progress until final stage
  if (data.stage === 4) {
    analysisInProgress = false;
  }

  // Update progress tracker if available
  if (window.PerspectiveLensProgress && data.stage === 4) {
    window.PerspectiveLensProgress.complete(
      true,
      `Analysis complete with ${data.perspectives?.length || 0} perspectives`
    );
  }

  // Update panel progressively
  if (window.PerspectiveLensPanel) {
    console.log(`[PerspectiveLens] Updating panel with stage ${data.stage}:`, {
      stage: data.stage,
      dataKeys: Object.keys(data.stageData),
      perspectivesCount: data.perspectives?.length || 0
    });

    window.PerspectiveLensPanel.showAnalysisProgressive(
      data.stage,
      data.stageData,
      data.perspectives
    );
  } else {
    console.error('[PerspectiveLens] Panel not available for progressive update!');
  }
}

/**
 * Handle analysis error
 */
function handleAnalysisError(error) {
  console.error('[PerspectiveLens] Analysis failed:', error);
  analysisInProgress = false;

  if (window.PerspectiveLensProgress) {
    window.PerspectiveLensProgress.complete(
      false,
      error.message || 'Analysis failed'
    );
  }

  if (window.PerspectiveLensPanel) {
    window.PerspectiveLensPanel.showError(error);
  }
}

/**
 * Listen for retry events from panel
 */
window.addEventListener('perspectivelens:retry', () => {
  console.log('[PerspectiveLens] Retry requested from panel');
  startAnalysis();
});

/**
 * Initialize - Wait for dependencies then detect
 */
async function initialize() {
  console.log('[PerspectiveLens] Initializing content script...');

  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // Wait for dependencies (with 1s timeout)
  dependenciesLoaded = await waitForDependencies();

  if (dependenciesLoaded) {
    console.log('[PerspectiveLens] ✓ All modules ready');
  } else {
    console.log('[PerspectiveLens] ⚠ Running with partial dependencies');
  }

  // Run detection
  detectNewsArticle();
}

// Start initialization
initialize();