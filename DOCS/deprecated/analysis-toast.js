/**
 * AnalysisToast - Single persistent toast for analysis progress
 * Material Design 3 compliant
 * No emojis - uses Material Icons only
 */

// Load Material Icons if not already loaded
if (typeof window !== 'undefined' && !document.querySelector('link[href*="material-icons"]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  document.head.appendChild(link);
}

class AnalysisToast {
  constructor() {
    this.container = null;
    this.isExpanded = false;
    this.logs = []; // Last 10 relevant logs
    this.currentProgress = 0;
    this.currentStage = 'extract';
    this.currentMessage = 'Starting analysis...';
    this.startTime = null;
  }

  /**
   * Show the analysis toast
   */
  show() {
    this.startTime = Date.now();
    this.create();
    this.render();
    document.body.appendChild(this.container);

    // Setup listener for log events from background
    this.setupLogListener();
  }

  /**
   * Setup listener for log events from logger.js
   */
  setupLogListener() {
    // Listen for custom events dispatched by logger.js
    this.logEventListener = (event) => {
      if (event.detail) {
        this.addLog(event.detail);
      }
    };

    window.addEventListener('perspectivelens:log', this.logEventListener);
  }

  /**
   * Remove log event listener
   */
  removeLogListener() {
    if (this.logEventListener) {
      window.removeEventListener('perspectivelens:log', this.logEventListener);
      this.logEventListener = null;
    }
  }

  /**
   * Create the toast container element
   */
  create() {
    this.container = document.createElement('div');
    this.container.className = 'analysis-toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
  }

  /**
   * Update progress manually (if needed)
   */
  updateProgress(stage, progress, message) {
    this.currentStage = stage;
    this.currentProgress = this.calculateOverallProgress(stage, progress);
    this.currentMessage = message;
    this.render();
  }

  /**
   * Add log entry (automatically filtered)
   */
  addLog(logEntry) {
    console.log('[AnalysisToast] Received log:', logEntry.message);

    const relevance = this.isRelevantLog(logEntry);

    if (relevance) {
      console.log('[AnalysisToast] Log is relevant:', logEntry.message);
      const formattedLog = this.formatLog(logEntry, relevance);
      this.logs.unshift(formattedLog);
      this.logs = this.logs.slice(0, 10); // Keep only last 10

      // Update current message with latest relevant log
      this.currentMessage = formattedLog.message;

      // Auto-update progress based on log patterns
      this.updateProgressFromLog(logEntry);

      this.render();
    } else {
      console.log('[AnalysisToast] Log filtered out:', logEntry.message);
    }
  }

  /**
   * Check if log is relevant to show to user
   */
  isRelevantLog(logEntry) {
    const message = logEntry.message;

    const USER_FRIENDLY_LOGS = {
      // AI Actions (always show)
      ai: {
        patterns: [
          /Language Detector.*created/i,
          /Language detected/i,
          /Translation.*completed/i,
          /Translating/i,
          /Summariz/i,
          /Stage \d\/4.*complete/i,
          /Analysis.*complete/i,
          /Generating.*summary/i,
          /AI.*processing/i
        ],
        icon: 'psychology',
        priority: 'high'
      },

      // Progress milestones
      progress: {
        patterns: [
          /Content extracted/i,
          /Found \d+ articles/i,
          /Extracted content from \d+ articles/i,
          /Selected \d+ articles/i,
          /Processing \d+ articles/i
        ],
        icon: 'check_circle',
        priority: 'medium'
      },

      // Search activity
      search: {
        patterns: [
          /Searching.*articles/i,
          /Pre-translating to unique languages/i,
          /Fetching.*perspectives/i,
          /Loading.*articles/i
        ],
        icon: 'search',
        priority: 'medium'
      },

      // Translation activity
      translation: {
        patterns: [
          /Translated.*to/i,
          /Translation service/i,
          /Detecting.*language/i
        ],
        icon: 'translate',
        priority: 'high'
      }
    };

    for (const [category, config] of Object.entries(USER_FRIENDLY_LOGS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(message)) {
          return { category, ...config };
        }
      }
    }

    return null;
  }

  /**
   * Format log entry for display
   */
  formatLog(logEntry, relevance) {
    return {
      message: logEntry.message,
      icon: relevance.icon,
      priority: relevance.priority,
      timestamp: logEntry.timestamp || Date.now()
    };
  }

  /**
   * Update progress based on log patterns
   */
  updateProgressFromLog(logEntry) {
    const message = logEntry.message;

    // Map log patterns to stages
    if (/Content extracted/i.test(message)) {
      this.currentStage = 'keywords';
      this.currentProgress = this.calculateOverallProgress('keywords', 0);
    } else if (/Searching.*articles/i.test(message)) {
      this.currentStage = 'search';
      this.currentProgress = this.calculateOverallProgress('search', 50);
    } else if (/Found \d+ articles/i.test(message)) {
      this.currentStage = 'fetch';
      this.currentProgress = this.calculateOverallProgress('fetch', 0);
    } else if (/Translat/i.test(message)) {
      this.currentStage = 'translate';
      this.currentProgress = this.calculateOverallProgress('translate', 50);
    } else if (/Summariz/i.test(message)) {
      this.currentStage = 'summarize';
      this.currentProgress = this.calculateOverallProgress('summarize', 50);
    } else if (/Stage \d\/4/i.test(message)) {
      this.currentStage = 'analyze';
      const match = message.match(/Stage (\d)\/4/);
      if (match) {
        const stage = parseInt(match[1]);
        const stageProgress = (stage / 4) * 100;
        this.currentProgress = this.calculateOverallProgress('analyze', stageProgress);
      }
    } else if (/Analysis.*complete/i.test(message)) {
      this.currentProgress = 100;
    }
  }

  /**
   * Calculate overall progress based on stage weights
   */
  calculateOverallProgress(currentStage, stageProgress) {
    const PROGRESS_STAGES = {
      extract: { weight: 10, label: 'Extracting content' },
      keywords: { weight: 5, label: 'Generating keywords' },
      search: { weight: 10, label: 'Searching perspectives' },
      fetch: { weight: 20, label: 'Fetching articles' },
      translate: { weight: 15, label: 'Translating content' },
      summarize: { weight: 10, label: 'Summarizing articles' },
      analyze: { weight: 30, label: 'Analyzing perspectives' }
    };

    let totalProgress = 0;
    let reachedCurrent = false;

    for (const [stage, config] of Object.entries(PROGRESS_STAGES)) {
      if (stage === currentStage) {
        totalProgress += (config.weight * stageProgress) / 100;
        reachedCurrent = true;
        break;
      } else if (!reachedCurrent) {
        totalProgress += config.weight;
      }
    }

    return Math.min(100, Math.round(totalProgress));
  }

  /**
   * Render the toast UI
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="analysis-toast-content">
        <div class="analysis-toast-header">
          <span class="material-icons analysis-toast-icon">sync</span>
          <span class="analysis-toast-title">Analysis in Progress</span>
          <button class="analysis-toast-toggle" aria-label="${this.isExpanded ? 'Collapse' : 'Expand'} logs">
            <span class="material-icons">${this.isExpanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>

        <div class="analysis-progress-bar">
          <div class="analysis-progress-fill" style="width: ${this.currentProgress}%">
            <span class="analysis-progress-text">${this.currentProgress}%</span>
          </div>
        </div>

        <div class="analysis-current-message">
          <span class="material-icons analysis-message-icon">pending</span>
          <span class="analysis-message-text">${this.currentMessage}</span>
        </div>

        ${this.isExpanded ? this.renderExpandedLogs() : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render expanded logs section
   */
  renderExpandedLogs() {
    if (this.logs.length === 0) {
      return `
        <div class="analysis-logs-expanded">
          <div class="analysis-log-entry">
            <span class="material-icons analysis-log-icon">info</span>
            <span class="analysis-log-text">No logs yet...</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="analysis-logs-expanded">
        ${this.logs.map(log => `
          <div class="analysis-log-entry">
            <span class="material-icons analysis-log-icon">${log.icon}</span>
            <span class="analysis-log-text">${log.message}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Attach event listeners to interactive elements
   */
  attachEventListeners() {
    const toggleBtn = this.container.querySelector('.analysis-toast-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleExpand());
    }
  }

  /**
   * Toggle expanded/collapsed state
   */
  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.render();
  }

  /**
   * Complete the analysis
   */
  complete(success = true, message = '') {
    this.currentProgress = 100;
    this.currentMessage = message || 'Analysis completed successfully';
    this.render();

    // Update icon to indicate completion
    const icon = this.container.querySelector('.analysis-toast-icon');
    if (icon) {
      icon.textContent = success ? 'check_circle' : 'error';
      icon.style.color = success ? 'var(--md-sys-color-tertiary)' : 'var(--md-sys-color-error)';
    }

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hide();
    }, 3000);
  }

  /**
   * Hide and remove the toast
   */
  hide() {
    if (this.container) {
      this.container.classList.add('analysis-toast-hiding');
      this.removeLogListener();
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.remove();
        }
        this.container = null;
      }, 300);
    }
  }

  /**
   * Fail the analysis with error message
   */
  fail(errorMessage = 'Analysis failed') {
    this.complete(false, errorMessage);
  }
}

// Export as global for backward compatibility with singleton instance
if (typeof window !== 'undefined') {
  window.PerspectiveLensAnalysisToast = {
    AnalysisToast,
    instance: null,

    // Helper to create and show toast
    show() {
      if (!this.instance) {
        this.instance = new AnalysisToast();
      }
      this.instance.show();
      return this.instance;
    },

    // Helper to get current instance
    getInstance() {
      return this.instance;
    },

    // Helper to clear instance
    clear() {
      if (this.instance) {
        this.instance.hide();
        this.instance = null;
      }
    }
  };
}

// Also export as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalysisToast;
}
