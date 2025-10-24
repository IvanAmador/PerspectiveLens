/**
 * PerspectiveLens Progress Tracker - Terminal View
 * Consumes structured logs from logger.js and displays them in a modern terminal interface
 */

// Icon library
const PROGRESS_ICONS = {
  loading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2C6.47715 2 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  minimize: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  expand: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  filter: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  copy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4C3.46957 15 2.96086 14.7893 2.58579 14.4142C2.21071 14.0391 2 13.5304 2 13V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H13C13.5304 2 14.0391 2.21071 14.4142 2.58579C14.7893 2.96086 15 3.46957 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  terminal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 17L10 11L4 5M12 19H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

class ProgressTracker {
  constructor() {
    this.container = null;
    this.logs = [];
    this.currentToastId = null;
    this.isMinimized = false; // Start expanded (showing terminal)
    this.isVisible = false;
    this.isTerminalView = true; // Always terminal view
    this.autoScroll = true;
    this.isPanelVisible = false; // Track if analysis panel is visible

    // Filters (default: show ERROR, WARN, INFO from USER and BOTH contexts)
    this.filters = {
      levels: ['ERROR', 'WARN', 'INFO'], // DEBUG and TRACE disabled by default
      contexts: ['USER', 'BOTH'], // SYSTEM disabled by default (for advanced debugging)
      categories: [], // [] = all categories
      search: ''
    };

    // Progress tracking (inferred from logs)
    this.progress = {
      extract: { done: false, progress: 0 },
      keywords: { done: false, progress: 0 },
      search: { done: false, progress: 0 },
      fetch: { done: false, progress: 0 },
      analyze: { done: false, progress: 0 }
    };

    this.showFilters = false;

    // Listen for panel visibility changes
    this.setupPanelListener();
  }

  /**
   * Start progress tracking
   */
  start() {
    // Reset state
    this.logs = [];
    this.progress = {
      extract: { done: false, progress: 0 },
      keywords: { done: false, progress: 0 },
      search: { done: false, progress: 0 },
      fetch: { done: false, progress: 0 },
      analyze: { done: false, progress: 0 }
    };

    // Show initial toast with option to view logs
    if (window.PerspectiveLensToast) {
      this.currentToastId = window.PerspectiveLensToast.show({
        title: 'Analysis started',
        message: 'Processing article...',
        type: 'analyze',
        duration: 0,
        closeable: false,
        actions: [{
          label: 'View Logs',
          primary: false,
          onClick: () => this.showTerminal(),
          dismissOnClick: false
        }]
      });
    }

    console.log('[PerspectiveLens] Progress tracking started');
  }

  /**
   * Add log entry from logger.js
   * @param {Object} logEntry - Structured log entry from logger
   */
  addLogEntry(logEntry) {
    // Add to logs array
    this.logs.push(logEntry);

    // Keep only last 200 logs (performance)
    if (this.logs.length > 200) {
      this.logs.shift();
    }

    // Update progress based on log category
    this.updateProgressFromLog(logEntry);

    // Update toast message if active step changed
    this.updateToastMessage(logEntry);

    // Render terminal if visible
    if (this.isVisible && this.isTerminalView) {
      this.renderTerminal();

      // Auto-scroll to bottom
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    }
  }

  /**
   * Infer progress from log entries
   */
  updateProgressFromLog(logEntry) {
    const { category, level, message, progress: logProgress } = logEntry;

    // Map categories to progress steps
    if (category === 'extract') {
      this.progress.extract.progress = logProgress || 100;
      if (level === 'INFO' && message.includes('success')) {
        this.progress.extract.done = true;
      }
    } else if (category === 'keywords') {
      this.progress.keywords.progress = logProgress || 50;
      if (level === 'INFO' && message.includes('generated')) {
        this.progress.keywords.done = true;
      }
    } else if (category === 'search') {
      this.progress.search.progress = logProgress || 50;
      if (level === 'INFO' && message.includes('Found')) {
        this.progress.search.done = true;
      }
    } else if (category === 'fetch') {
      this.progress.fetch.progress = logProgress || 50;
      if (level === 'INFO' && message.includes('Extracted')) {
        this.progress.fetch.done = true;
      }
    } else if (category === 'analyze') {
      this.progress.analyze.progress = logProgress || 50;
      if (level === 'INFO' && (message.includes('complete') || message.includes('completed'))) {
        this.progress.analyze.done = true;
      }
    }
  }

  /**
   * Update toast message based on current step
   */
  updateToastMessage(logEntry) {
    if (!this.currentToastId || !window.PerspectiveLensToast) return;

    // Only update for USER context INFO messages
    if (logEntry.context !== 'USER' && logEntry.context !== 'BOTH') return;
    if (logEntry.level !== 'INFO') return;

    // Update toast with new message
    window.PerspectiveLensToast.hide(this.currentToastId);
    this.currentToastId = window.PerspectiveLensToast.show({
      title: 'Analysis in progress',
      message: logEntry.message,
      type: 'analyze',
      duration: 0,
      closeable: false,
      actions: [{
        label: 'View Logs',
        primary: false,
        onClick: () => this.showTerminal(),
        dismissOnClick: false
      }]
    });
  }

  /**
   * Legacy compatibility - update step (converts to log entry)
   */
  updateStep(stepId, status, progress = 0, message = '') {
    // Convert to log entry format
    const logEntry = {
      level: status === 'error' ? 'ERROR' : 'INFO',
      context: 'USER',
      timestamp: new Date().toISOString(),
      message: message || `Step ${stepId}: ${status}`,
      category: stepId,
      progress,
      requestId: 'legacy'
    };

    this.addLogEntry(logEntry);
  }

  /**
   * Complete the progress tracking
   */
  complete(success = true, message = '') {
    // Hide current toast
    if (this.currentToastId && window.PerspectiveLensToast) {
      window.PerspectiveLensToast.hide(this.currentToastId);
      this.currentToastId = null;
    }

    // Add completion log
    this.addLogEntry({
      level: success ? 'INFO' : 'ERROR',
      context: 'USER',
      timestamp: new Date().toISOString(),
      message: message || (success ? 'Analysis completed successfully' : 'Analysis failed'),
      category: 'general',
      requestId: 'completion'
    });

    // Show completion toast
    if (window.PerspectiveLensToast) {
      if (success) {
        window.PerspectiveLensToast.showSuccess(
          'Analysis complete',
          message || 'All perspectives have been analyzed'
        );
      } else {
        window.PerspectiveLensToast.showError(
          'Analysis failed',
          message || 'An error occurred during analysis'
        );
      }
    }

    console.log(`[PerspectiveLens] Progress tracking completed: ${success ? 'success' : 'failure'}`);
  }

  /**
   * Show terminal view
   */
  showTerminal() {
    if (this.isVisible) {
      // Already visible, just expand if minimized
      if (this.isMinimized) {
        this.toggleMinimize();
      }
      return;
    }

    if (!this.container) {
      this.createContainer();
    }

    document.body.appendChild(this.container);
    this.isVisible = true;
    this.isTerminalView = true;
    this.render();
    this.scrollToBottom();

    console.log('[PerspectiveLens] Terminal view shown');
  }

  /**
   * Show compact view (for legacy compatibility)
   */
  show() {
    this.showTerminal();
  }

  /**
   * Hide the tracker
   */
  hide() {
    if (!this.isVisible || !this.container) return;

    this.container.classList.add('pl-progress-hiding');

    setTimeout(() => {
      if (this.container && this.container.parentNode) {
        this.container.remove();
      }
      this.isVisible = false;
    }, 200);

    console.log('[PerspectiveLens] Progress tracker hidden');
  }

  /**
   * Setup listener for panel visibility
   */
  setupPanelListener() {
    // Check for panel every 300ms (lightweight)
    setInterval(() => {
      const panel = document.getElementById('perspectivelens-panel'); // ← CORRIGIDO
      const wasPanelVisible = this.isPanelVisible;
      this.isPanelVisible = panel && panel.classList.contains('pl-panel-visible');

      // Panel just appeared
      if (this.isPanelVisible && !wasPanelVisible) {
        console.log('[ProgressTracker] Panel detected, repositioning to left');
        this.repositionForPanel();
      }

      // Panel just disappeared
      if (!this.isPanelVisible && wasPanelVisible) {
        console.log('[ProgressTracker] Panel hidden, repositioning to right');
        this.repositionToDefault();
      }
    }, 300);
  }

  /**
   * Reposition to left side when panel is visible
   */
  repositionForPanel() {
    if (this.container) {
      this.container.classList.add('pl-progress-left-side');
    }

    // Also notify toast system
    if (window.PerspectiveLensToast && window.PerspectiveLensToast.getInstance) {
      const toastContainer = document.getElementById('pl-toast-container');
      if (toastContainer) {
        toastContainer.classList.add('pl-toast-left-side');
      }
    }
  }

  /**
   * Reposition to default (right side) when panel is hidden
   */
  repositionToDefault() {
    if (this.container) {
      this.container.classList.remove('pl-progress-left-side');
    }

    // Also notify toast system
    const toastContainer = document.getElementById('pl-toast-container');
    if (toastContainer) {
      toastContainer.classList.remove('pl-toast-left-side');
    }
  }

  /**
   * Create container element
   */
  createContainer() {
    const container = document.createElement('div');
    container.id = 'pl-progress-tracker';
    container.className = 'pl-progress-container pl-progress-terminal';
    if (this.isMinimized) {
      container.classList.add('pl-progress-minimized');
    }
    if (this.isPanelVisible) {
      container.classList.add('pl-progress-left-side');
    }
    this.container = container;
  }

  /**
   * Toggle minimize
   */
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    if (this.container) {
      this.container.classList.toggle('pl-progress-minimized', this.isMinimized);
    }
  }

  /**
   * Toggle filters panel
   */
  toggleFilters() {
    this.showFilters = !this.showFilters;
    this.render();
  }

  /**
   * Apply filter
   */
  setFilter(type, value) {
    if (type === 'level') {
      const index = this.filters.levels.indexOf(value);
      if (index > -1) {
        this.filters.levels.splice(index, 1);
      } else {
        this.filters.levels.push(value);
      }
    } else if (type === 'context') {
      // Smart context filtering: BOTH is mutually exclusive with USER/SYSTEM
      const index = this.filters.contexts.indexOf(value);

      if (value === 'BOTH') {
        // If clicking BOTH, toggle it (clear all others if enabling)
        if (index > -1) {
          // Disable BOTH
          this.filters.contexts.splice(index, 1);
          // Default to USER when nothing selected
          if (this.filters.contexts.length === 0) {
            this.filters.contexts = ['USER'];
          }
        } else {
          // Enable BOTH exclusively
          this.filters.contexts = ['BOTH'];
        }
      } else {
        // Clicking USER or SYSTEM
        if (index > -1) {
          // Disable it
          this.filters.contexts.splice(index, 1);
          // If nothing left, default to USER
          if (this.filters.contexts.length === 0) {
            this.filters.contexts = ['USER'];
          }
        } else {
          // Enable it, but remove BOTH if present
          const bothIndex = this.filters.contexts.indexOf('BOTH');
          if (bothIndex > -1) {
            this.filters.contexts.splice(bothIndex, 1);
          }
          this.filters.contexts.push(value);
        }
      }
    } else if (type === 'category') {
      this.filters.categories = value;
    } else if (type === 'search') {
      this.filters.search = value;
    }

    this.render();
  }

  /**
   * Get filtered logs
   */
  getFilteredLogs() {
    return this.logs.filter(log => {
      // Filter by level
      if (!this.filters.levels.includes(log.level)) {
        return false;
      }

      // Filter by context
      if (!this.filters.contexts.includes(log.context)) {
        return false;
      }

      // Filter by category
      if (this.filters.categories.length > 0 && !this.filters.categories.includes(log.category)) {
        return false;
      }

      // Filter by search
      if (this.filters.search && !log.message.toLowerCase().includes(this.filters.search.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  /**
   * Calculate overall progress
   */
  getOverallProgress() {
    const steps = Object.values(this.progress);
    const completedSteps = steps.filter(s => s.done).length;
    return Math.round((completedSteps / steps.length) * 100);
  }

  /**
   * Get current stage name
   */
  getCurrentStage() {
    if (!this.progress.extract.done) return 'Extracting content';
    if (!this.progress.search.done) return 'Searching perspectives';
    if (!this.progress.fetch.done) return 'Fetching articles';
    if (!this.progress.analyze.done) return 'Analyzing perspectives';
    return 'Complete';
  }

  /**
   * Render the tracker
   */
  render() {
    if (!this.container) return;

    const overallProgress = this.getOverallProgress();
    const currentStage = this.getCurrentStage();
    const filteredLogs = this.getFilteredLogs();

    this.container.innerHTML = `
      <div class="pl-progress-header">
        <div class="pl-progress-header-left">
          <div class="pl-progress-header-icon">${PROGRESS_ICONS.terminal}</div>
          <div>
            <div class="pl-progress-title">Analysis Logs</div>
            <div class="pl-progress-subtitle">${currentStage} - ${overallProgress}%</div>
          </div>
        </div>
        <div class="pl-progress-header-actions">
          <button class="pl-progress-btn" id="pl-toggle-filters" title="Filters">
            ${PROGRESS_ICONS.filter}
          </button>
          <button class="pl-progress-btn" id="pl-copy-logs" title="Copy logs">
            ${PROGRESS_ICONS.copy}
          </button>
          <button class="pl-progress-btn" id="pl-toggle-minimize" title="${this.isMinimized ? 'Expand' : 'Minimize'}">
            ${this.isMinimized ? PROGRESS_ICONS.expand : PROGRESS_ICONS.minimize}
          </button>
          <button class="pl-progress-btn" id="pl-close-progress" title="Close">
            ${PROGRESS_ICONS.close}
          </button>
        </div>
      </div>

      <div class="pl-progress-overall">
        <div class="pl-progress-bar-container">
          <div class="pl-progress-bar-fill" style="width: ${overallProgress}%"></div>
        </div>
      </div>

      ${this.showFilters ? this.renderFilters() : ''}

      <div class="pl-terminal">
        <div class="pl-terminal-header">
          <span class="pl-terminal-prompt">$ tail -f perspectivelens.log</span>
          <span class="pl-terminal-count">${filteredLogs.length} entries</span>
        </div>
        <div class="pl-terminal-body" id="pl-terminal-body">
          ${this.renderLogs(filteredLogs)}
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render filters panel
   */
  renderFilters() {
    return `
      <div class="pl-filters">
        <div class="pl-filters-section">
          <div class="pl-filters-label">Log Levels</div>
          <div class="pl-filters-buttons">
            ${['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].map(level => `
              <button
                class="pl-filter-btn ${this.filters.levels.includes(level) ? 'pl-filter-active' : ''}"
                data-filter-level="${level}">
                ${level}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="pl-filters-section">
          <div class="pl-filters-label">Context</div>
          <div class="pl-filters-buttons">
            ${['USER', 'SYSTEM', 'BOTH'].map(context => `
              <button
                class="pl-filter-btn ${this.filters.contexts.includes(context) ? 'pl-filter-active' : ''}"
                data-filter-context="${context}">
                ${context}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render terminal logs
   */
  renderLogs(filteredLogs) {
    if (filteredLogs.length === 0) {
      return `<div class="pl-terminal-empty">No logs to display. Adjust filters or wait for analysis to start.</div>`;
    }

    return filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });

      const categoryBadge = log.category ? `<span class="pl-log-category pl-category-${log.category}">${log.category.toUpperCase()}</span>` : '';

      return `
        <div class="pl-terminal-line pl-log-${log.level.toLowerCase()}">
          <span class="pl-log-time">[${timestamp}]</span>
          <span class="pl-log-level pl-level-${log.level.toLowerCase()}">${log.level.padEnd(5)}</span>
          ${categoryBadge}
          <span class="pl-log-message">${this.escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Render terminal (just alias for render)
   */
  renderTerminal() {
    this.render();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const toggleBtn = this.container?.querySelector('#pl-toggle-minimize');
    const closeBtn = this.container?.querySelector('#pl-close-progress');
    const filtersBtn = this.container?.querySelector('#pl-toggle-filters');
    const copyBtn = this.container?.querySelector('#pl-copy-logs');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleMinimize());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    if (filtersBtn) {
      filtersBtn.addEventListener('click', () => this.toggleFilters());
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyLogsToClipboard());
    }

    // Filter buttons - levels
    const levelButtons = this.container?.querySelectorAll('[data-filter-level]');
    levelButtons?.forEach(btn => {
      btn.addEventListener('click', () => {
        const level = btn.getAttribute('data-filter-level');
        this.setFilter('level', level);
      });
    });

    // Filter buttons - contexts
    const contextButtons = this.container?.querySelectorAll('[data-filter-context]');
    contextButtons?.forEach(btn => {
      btn.addEventListener('click', () => {
        const context = btn.getAttribute('data-filter-context');
        this.setFilter('context', context);
      });
    });
  }

  /**
   * Copy logs to clipboard
   */
  async copyLogsToClipboard() {
    const filteredLogs = this.getFilteredLogs();
    const logText = filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      return `[${timestamp}] ${log.level.padEnd(5)} [${log.category}] ${log.message}`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(logText);
      if (window.PerspectiveLensToast) {
        window.PerspectiveLensToast.showSuccess('Copied', `${filteredLogs.length} log entries copied to clipboard`);
      }
    } catch (error) {
      console.error('Failed to copy logs:', error);
      if (window.PerspectiveLensToast) {
        window.PerspectiveLensToast.showError('Copy failed', 'Could not copy logs to clipboard');
      }
    }
  }

  /**
   * Scroll to bottom of terminal
   */
  scrollToBottom() {
    const terminalBody = this.container?.querySelector('#pl-terminal-body');
    if (terminalBody) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  }

  /**
   * Legacy - add log (converts to log entry)
   */
  addLog(message, level = 'info') {
    const logEntry = {
      level: level.toUpperCase(),
      context: 'USER',
      timestamp: new Date().toISOString(),
      message,
      category: 'general',
      requestId: 'legacy'
    };
    this.addLogEntry(logEntry);
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// Initialize and export
let progressTrackerInstance = null;

function getProgressTracker() {
  if (!progressTrackerInstance) {
    progressTrackerInstance = new ProgressTracker();
  }
  return progressTrackerInstance;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.PerspectiveLensProgress = {
    getInstance: getProgressTracker,
    start: () => getProgressTracker().start(),
    updateStep: (...args) => getProgressTracker().updateStep(...args),
    complete: (...args) => getProgressTracker().complete(...args),
    show: () => getProgressTracker().show(),
    showTerminal: () => getProgressTracker().showTerminal(),
    hide: () => getProgressTracker().hide(),
    addLog: (...args) => getProgressTracker().addLog(...args),
    addLogEntry: (...args) => getProgressTracker().addLogEntry(...args)
  };
}

console.log('[PerspectiveLens] Progress tracker (Terminal View) loaded');
