/**
 * PerspectiveLens Content Script
 * Detects news articles and handles user interaction
 * Uses universal language-agnostic detection system
 */

console.log('[PerspectiveLens] Content script loaded');

/**
 * Create Shadow DOM directly in content script
 * This is the correct approach - no need for MAIN world injection
 */
async function createShadowDOM() {
  console.log('[PerspectiveLens] Creating Shadow DOM...');

  // Create shadow host element
  const shadowHost = document.createElement('div');
  shadowHost.id = 'perspective-lens-root';

  // Wait for theme to be set (max 100ms)
  let currentTheme = document.documentElement.getAttribute('data-theme');
  if (!currentTheme) {
    await new Promise(resolve => setTimeout(resolve, 100));
    currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  }

  // Apply current theme to shadow host (for dark mode support)
  shadowHost.setAttribute('data-theme', currentTheme);
  console.log(`[PerspectiveLens] Shadow DOM initialized with theme: ${currentTheme}`);

  // Attach shadow root (open mode for easier debugging)
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // Create container inside shadow root
  const container = document.createElement('div');
  container.id = 'pl-shadow-container';
  shadowRoot.appendChild(container);

  // Load CSS files and inject them as <style> elements
  // This is more reliable than <link> for Shadow DOM
  // Order matters: shadow-root.css first, then design-system, then components
  const cssFiles = [
    'ui/shadow-root.css',
    'ui/design-system.css',
    'ui/components/toast/single-toast.css',
    'ui/components/panel/panel-styles.css',
    'ui/components/panel/modal/perspectives-modal.css'
  ];

  try {
    // CRITICAL: Load custom fonts using FontFace API (required for Shadow DOM)
    // @font-face in CSS doesn't work reliably in Shadow DOM
    const fontUrl = chrome.runtime.getURL('fonts/Lenteroos.ttf');
    const lenteroosFontFace = new FontFace('Lenteroos', `url('${fontUrl}')`, {
      weight: 'normal',
      style: 'normal',
      display: 'swap'
    });

    // Load and add font to document fonts
    await lenteroosFontFace.load();
    document.fonts.add(lenteroosFontFace);
    console.log('[PerspectiveLens] Custom font "Lenteroos" loaded via FontFace API');

    // Fetch and inject each CSS file
    for (const cssFile of cssFiles) {
      try {
        const url = chrome.runtime.getURL(cssFile);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let cssText = await response.text();

        // CRITICAL FIX: Shadow DOM CSS compatibility
        // 1. :root doesn't work in Shadow DOM, must use :host
        // 2. [data-theme='dark'] must become :host([data-theme='dark'])
        if (cssFile === 'ui/design-system.css') {
          // Replace :root with :host
          cssText = cssText.replace(/:root/g, ':host');

          // Replace [data-theme='dark'] with :host([data-theme='dark'])
          cssText = cssText.replace(/\[data-theme='dark'\]/g, ":host([data-theme='dark'])");

          console.log('[PerspectiveLens] Converted CSS for Shadow DOM (:root → :host, theme selectors)');
        }

        // Create style element
        const styleEl = document.createElement('style');
        styleEl.textContent = cssText;
        shadowRoot.appendChild(styleEl);

        console.log(`[PerspectiveLens] Loaded CSS: ${cssFile}`);
      } catch (cssError) {
        console.error(`[PerspectiveLens] Failed to load CSS file: ${cssFile}`, {
          error: cssError.message,
          type: cssError.name,
          url: chrome.runtime.getURL(cssFile)
        });
        // Continue loading other CSS files even if one fails
      }
    }

    // Append to body
    document.body.appendChild(shadowHost);

    // Store global reference for UI components to access
    window.__PL_SHADOW_ROOT__ = shadowRoot;
    window.__PL_SHADOW_CONTAINER__ = container;

    console.log('[PerspectiveLens] Shadow DOM created successfully with all styles loaded');
    return { shadowRoot, container };
  } catch (error) {
    console.error('[PerspectiveLens] Error creating Shadow DOM:', {
      error: error.message,
      type: error.name,
      stack: error.stack
    });
    throw error;
  }
}

// Single toast will be available globally after injection
let singleToast = null;

/**
 * Wait for dependencies to load with optimized timeout
 */
function waitForDependencies() {
  return new Promise((resolve) => {
    // Verificação inicial imediata
    if (window.PerspectiveLensPanel && window.PerspectiveLensSingleToast) {
      console.log('[PerspectiveLens] All dependencies already loaded');
      singleToast = window.PerspectiveLensSingleToast;
      resolve(true);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 20 x 50ms = 1 segundo máximo
    const checkInterval = 50; // Verificar a cada 50ms

    const intervalId = setInterval(() => {
      attempts++;

      if (window.PerspectiveLensPanel && window.PerspectiveLensSingleToast) {
        clearInterval(intervalId);
        console.log(`[PerspectiveLens] Dependencies loaded after ${attempts * checkInterval}ms`);
        singleToast = window.PerspectiveLensSingleToast;
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        console.warn('[PerspectiveLens] Some dependencies not loaded after 1s');
        console.log('[PerspectiveLens] Available:', {
          panel: !!window.PerspectiveLensPanel,
          singleToast: !!window.PerspectiveLensSingleToast
        });
        // Mesmo sem todas as dependências, pega o singleToast se disponível
        if (window.PerspectiveLensSingleToast) {
          singleToast = window.PerspectiveLensSingleToast;
        }
        resolve(false);
      }
    }, checkInterval);
  });
}

/**
 * Extract article data from the page using universal detector
 */
function extractArticleData() {
  // Get metadata from universal detector (using global API)
  const metadata = window.ArticleDetector.extractArticleMetadata();

  // Extract main content (language-agnostic)
  const contentSelectors = [
    'article',
    '[role="article"]',
    'main',
    '[role="main"]',
    '.article-content',
    '.post-content',
    '.content',
    '#content',
    '.entry-content'
  ];

  let contentElement = null;
  for (const selector of contentSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  // Fallback: find largest text container
  if (!contentElement) {
    const candidates = document.querySelectorAll('div[class*="content"], div[class*="article"], div[id*="content"], div[id*="article"]');
    let maxTextLength = 0;

    for (const candidate of candidates) {
      const textLength = candidate.innerText?.length || 0;
      if (textLength > maxTextLength) {
        maxTextLength = textLength;
        contentElement = candidate;
      }
    }
  }

  let content = '';
  if (contentElement) {
    const paragraphs = Array.from(contentElement.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 50);

    content = paragraphs.join('\n\n');
    console.log(`[PerspectiveLens] Extracted ${paragraphs.length} paragraphs (${content.length} chars)`);
  } else {
    console.log('[PerspectiveLens] Article content not found');
  }

  // Combine metadata with content
  const data = {
    url: metadata.url,
    title: metadata.title,
    source: metadata.domain,
    content: content,
    publishedDate: metadata.publishedDate,
    modifiedDate: metadata.modifiedDate,
    author: metadata.author,
    language: metadata.language || document.documentElement.lang || 'en',
    description: metadata.description,
    image: metadata.image
  };

  return data;
}

/**
 * State management for article detection
 */
let detectedArticleData = null;
let analysisInProgress = false;
let dependenciesLoaded = false;

/**
 * Universal article detection using multi-layer system
 * Language-agnostic detection that works worldwide
 */
function detectNewsArticle() {
  console.log('[PerspectiveLens] Starting universal article detection...');

  // Use new universal detector (from global API)
  const detection = window.ArticleDetector.detectArticle();

  // Log detailed breakdown (without re-running detection)
  console.log(`[Article Detection Report]
==========================================

Result: ${detection.isArticle ? 'ARTICLE DETECTED' : 'NOT AN ARTICLE'}
Score: ${detection.score}/${detection.threshold} (${detection.confidence} confidence)

Layer Breakdown:
- Schema.org JSON-LD: ${detection.details.schemaOrg.score}/40
  ${detection.details.schemaOrg.detected ? 'Found: ' + (detection.details.schemaOrg.data.type || 'EmbeddedJSON') : 'Not found'}

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
==========================================`);

  if (detection.isArticle) {
    console.log(`[PerspectiveLens] Article detected! Score: ${detection.score}/${detection.threshold} (${detection.confidence} confidence)`);

    // Extract article data
    detectedArticleData = extractArticleData();
    console.log('[PerspectiveLens] Article data extracted:', {
      title: detectedArticleData.title,
      source: detectedArticleData.source,
      language: detectedArticleData.language,
      contentLength: detectedArticleData.content?.length || 0,
      hasPublishedDate: !!detectedArticleData.publishedDate,
      hasAuthor: !!detectedArticleData.author
    });

    // Show detection toast
    showDetectionToast();
  } else {
    console.log(`[PerspectiveLens] Not an article. Score: ${detection.score}/${detection.threshold} (below threshold)`);
  }

  return detection;
}

/**
 * Show toast notification when article is detected
 */
function showDetectionToast() {
  if (!dependenciesLoaded || !singleToast) {
    console.log('[PerspectiveLens] SingleToast not available, skipping notification');
    return;
  }

  // Show article detection notification with action button
  singleToast.show('Article Detected', {
    showProgress: false, // Don't show progress bar for detection notification
    actions: [
      {
        label: 'Analyze',
        callback: () => {
          console.log('[PerspectiveLens] User clicked Analyze');
          startAnalysis();
        },
        primary: true,
        dismiss: false // Don't dismiss - will show progress
      },
      {
        label: 'Dismiss',
        callback: () => {
          console.log('[PerspectiveLens] User dismissed detection');
        },
        primary: false,
        dismiss: true
      }
    ]
  });
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
    if (singleToast) {
      singleToast.show('No article data available. Please refresh the page.');
      setTimeout(() => singleToast.dismiss(), 3000);
    }
    return;
  }

  analysisInProgress = true;

  // Show single toast
  if (singleToast) {
    singleToast.show('Analyzing article...');
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

        if (singleToast) {
          singleToast.show('Could not communicate with background service');
          setTimeout(() => singleToast.dismiss(), 4000);
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

        if (singleToast) {
          singleToast.show(`Analysis failed: ${response?.error || 'Unknown error occurred'}`);
          setTimeout(() => singleToast.dismiss(), 4000);
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[PerspectiveLens] Content script received message:', message.type);

  try {
    switch (message.type) {
      case 'USER_PROGRESS':  // User-friendly progress updates for toast
        handleUserProgress(message.payload);
        break;

      case 'SHOW_ANALYSIS':  // Background sends complete analysis
        handleShowAnalysis(message.data);
        break;

      case 'ANALYSIS_STAGE_COMPLETE':  // Progressive analysis updates
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
 * Handle user-friendly progress updates
 */
function handleUserProgress(data) {
  if (!singleToast) {
    console.warn('[PerspectiveLens] SingleToast not available');
    return;
  }

  const { phase, progress, message, icon, metadata } = data;

  console.log('[PerspectiveLens] User progress update:', { phase, progress, message });

  // Update toast
  singleToast.updateProgress(progress);
  singleToast.updateMessage(message, icon);

  // Add flags if present
  if (metadata && metadata.countries) {
    metadata.countries.forEach(code => {
      singleToast.addFlag(code);
    });
  }

  // Auto-dismiss when complete
  if (progress >= 100) {
    setTimeout(() => singleToast.dismiss(), 2000);
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

  if (window.PerspectiveLensPanel) {
    const panelData = {
      ...data.analysis,
      perspectives: data.perspectives
    };

    // Support both old format (Nano) and new format (Pro with stage1, stage2, etc)
    const hasStage1 = !!panelData.stage1;
    const hasStage2 = !!panelData.stage2;
    const hasStage3 = !!panelData.stage3;
    const hasStage4 = !!panelData.stage4;

    console.log('[PerspectiveLens] Sending to panel:', {
      // Old format (direct properties)
      hasStory: !!panelData.story_summary,
      hasGuidance: !!panelData.reader_guidance,
      hasConsensus: !!panelData.consensus,
      consensusType: typeof panelData.consensus,
      // New format (stage objects)
      hasStage1,
      hasStage2,
      hasStage3,
      hasStage4,
      stage1Keys: hasStage1 ? Object.keys(panelData.stage1) : [],
      stage2Keys: hasStage2 ? Object.keys(panelData.stage2) : [],
      consensusCount: panelData.stage2?.consensus?.length || 0,
      disputesCount: panelData.stage3?.factual_disputes?.length || 0,
      anglesCount: panelData.stage4?.coverage_angles?.length || 0,
      perspectivesCount: panelData.perspectives?.length || 0
    });
    window.PerspectiveLensPanel.showAnalysis(panelData);

    // Move toast to the left when panel opens
    if (singleToast) {
      singleToast.moveToPanelMode();
    }
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

    // Move toast to the left when panel opens (first stage)
    if (data.stage === 1 && singleToast) {
      singleToast.moveToPanelMode();
    }
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
 * Initialize - Create Shadow DOM, wait for dependencies, then detect articles
 */
async function initialize() {
  console.log('[PerspectiveLens] Initializing content script...');

  // Check if this is an extraction tab - if so, don't initialize UI
  try {
    const result = await chrome.runtime.sendMessage({ type: 'IS_EXTRACTION_TAB' });
    if (result?.isExtractionTab) {
      console.log('[PerspectiveLens] This is an extraction tab, skipping UI initialization');
      return;
    }
  } catch (error) {
    console.warn('[PerspectiveLens] Could not check extraction tab status:', error.message);
  }

  // Check if tab is visible - only initialize UI on visible tabs
  if (document.hidden) {
    console.log('[PerspectiveLens] Tab is not visible, skipping initialization');
    return;
  }

  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // Create Shadow DOM (only if not already created)
  if (!document.getElementById('perspective-lens-root')) {
    await createShadowDOM();

    // Listen for theme changes and update shadow host
    window.addEventListener('themeChanged', (event) => {
      const shadowHost = document.getElementById('perspective-lens-root');
      if (shadowHost && event.detail?.theme) {
        shadowHost.setAttribute('data-theme', event.detail.theme);
        console.log(`[PerspectiveLens] Shadow DOM theme updated: ${event.detail.theme}`);
      }
    });
  } else {
    console.log('[PerspectiveLens] Shadow DOM already exists');
  }

  // Wait for dependencies (toast and panel)
  dependenciesLoaded = await waitForDependencies();

  if (dependenciesLoaded) {
    console.log('[PerspectiveLens] All modules ready');
  } else {
    console.log('[PerspectiveLens] Running with partial dependencies');
  }

  // Run detection
  detectNewsArticle();
}

// Start initialization with error handling
try {
  initialize();
} catch (error) {
  console.error('[PerspectiveLens] Fatal initialization error:', error);
}