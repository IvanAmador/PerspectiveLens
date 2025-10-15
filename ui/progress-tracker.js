/**
 * PerspectiveLens Progress Tracker
 * Hybrid approach: Toast notifications + detailed tracker on demand
 */

// Icon library - usando nome único para evitar conflito
const PROGRESS_ICONS = {
  loading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  minimize: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  expand: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  pending: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg>`,
  check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
};

class ProgressTracker {
  constructor() {
    this.container = null;
    this.logs = [];
    this.currentToastId = null;
    this.steps = [
      { id: 'extract', label: 'Extracting content', status: 'pending', progress: 0 },
      { id: 'keywords', label: 'Generating keywords', status: 'pending', progress: 0 },
      { id: 'search', label: 'Searching perspectives', status: 'pending', progress: 0 },
      { id: 'fetch', label: 'Fetching articles', status: 'pending', progress: 0 },
      { id: 'analyze', label: 'Analyzing perspectives', status: 'pending', progress: 0 }
    ];
    this.isMinimized = true; // Start minimized
    this.isVisible = false;
    this.totalSteps = this.steps.length;
    this.completedSteps = 0;
  }

  /**
   * Start progress tracking with initial toast
   */
  start() {
    // Reset state
    this.steps.forEach(step => {
      step.status = 'pending';
      step.progress = 0;
    });
    this.completedSteps = 0;
    this.logs = [];

    // Show initial toast with option to view details
    if (window.PerspectiveLensToast) {
      this.currentToastId = window.PerspectiveLensToast.show({
        title: 'Analysis started',
        message: 'Extracting content...',
        type: 'analyze',
        duration: 0,
        closeable: false,
        actions: [{
          label: 'View Details',
          primary: false,
          onClick: () => this.show(),
          dismissOnClick: false
        }]
      });
    }

    console.log('[PerspectiveLens] Progress tracking started');
  }

  /**
   * Update step progress
   * @param {string} stepId - Step identifier
   * @param {string} status - 'pending', 'active', 'complete', 'error'
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Optional message
   */
  updateStep(stepId, status, progress = 0, message = '') {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    const wasComplete = step.status === 'complete';
    step.status = status;
    step.progress = progress;

    // Update completed count
    if (status === 'complete' && !wasComplete) {
      this.completedSteps++;
    }

    // Update toast message for current step
    if (status === 'active' && this.currentToastId && window.PerspectiveLensToast) {
      window.PerspectiveLensToast.hide(this.currentToastId);
      this.currentToastId = window.PerspectiveLensToast.show({
        title: 'Analysis in progress',
        message: message || step.label,
        type: 'analyze',
        duration: 0,
        closeable: false,
        actions: [{
          label: 'View Details',
          primary: false,
          onClick: () => this.show(),
          dismissOnClick: false
        }]
      });
    }

    // Update tracker if visible
    if (this.isVisible) {
      this.render();
    }

    // Add log
    if (message) {
      this.addLog(message, status === 'error' ? 'error' : 'info');
    }

    console.log(`[PerspectiveLens] Step ${stepId}: ${status} (${progress}%)`);
  }

  /**
   * Complete the progress tracking
   * @param {boolean} success - Whether completed successfully
   * @param {string} message - Completion message
   */
  complete(success = true, message = '') {
    // Hide current toast
    if (this.currentToastId && window.PerspectiveLensToast) {
      window.PerspectiveLensToast.hide(this.currentToastId);
      this.currentToastId = null;
    }

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

    // Hide tracker after delay
    setTimeout(() => {
      this.hide();
    }, success ? 2000 : 5000);

    console.log(`[PerspectiveLens] Progress tracking completed: ${success ? 'success' : 'failure'}`);
  }

  /**
   * Show the detailed progress tracker
   */
  show() {
    if (this.isVisible) {
      // If already visible but minimized, expand it
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
    this.render();

    console.log('[PerspectiveLens] Progress tracker shown');
  }

  /**
   * Hide the progress tracker
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
   * Create the container element
   */
  createContainer() {
    const container = document.createElement('div');
    container.id = 'pl-progress-tracker';
    container.className = 'pl-progress-container';
    if (this.isMinimized) {
      container.classList.add('pl-progress-minimized');
    }
    this.container = container;
  }

  /**
   * Toggle minimize state
   */
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    if (this.container) {
      this.container.classList.toggle('pl-progress-minimized', this.isMinimized);
    }
  }

  /**
   * Add a log entry
   */
  addLog(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({ message, level, timestamp });

    // Keep only last 50 logs
    if (this.logs.length > 50) {
      this.logs.shift();
    }

    // Update logs section if visible
    if (this.isVisible && !this.isMinimized) {
      this.renderLogs();
    }
  }

  /**
   * Calculate overall progress
   */
  getOverallProgress() {
    return Math.round((this.completedSteps / this.totalSteps) * 100);
  }

  /**
   * Render the progress tracker
   */
  render() {
    if (!this.container) return;

    const overallProgress = this.getOverallProgress();
    const currentStep = this.steps.find(s => s.status === 'active');
    const currentStepLabel = currentStep ? currentStep.label : 'Processing...';

    this.container.innerHTML = `
      <div class="pl-progress-header">
        <div class="pl-progress-header-left">
          <div>
            <div class="pl-progress-title">Analysis Progress</div>
            <div class="pl-progress-subtitle">${currentStepLabel}</div>
          </div>
        </div>
        <div class="pl-progress-header-actions">
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
        <div class="pl-progress-bar-text">
          <span>${overallProgress}% Complete</span>
          <span>${this.completedSteps} / ${this.totalSteps} steps</span>
        </div>
      </div>

      <div class="pl-progress-body">
        ${this.steps.map(step => `
          <div class="pl-progress-step pl-step-${step.status}">
            <div class="pl-progress-step-icon">
              ${step.status === 'pending' ? PROGRESS_ICONS.pending : 
                step.status === 'active' ? PROGRESS_ICONS.loading :
                step.status === 'complete' ? PROGRESS_ICONS.check :
                PROGRESS_ICONS.error}
            </div>
            <div class="pl-progress-step-content">
              <div class="pl-progress-step-label">${step.label}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="pl-progress-logs">
        <div class="pl-progress-logs-header">Activity Log</div>
        <div id="pl-logs-content"></div>
      </div>
    `;

    // Attach event listeners
    const toggleBtn = this.container.querySelector('#pl-toggle-minimize');
    const closeBtn = this.container.querySelector('#pl-close-progress');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleMinimize());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Render logs
    this.renderLogs();
  }

  /**
   * Render logs section
   */
  renderLogs() {
    const logsContent = this.container?.querySelector('#pl-logs-content');
    if (!logsContent) return;

    logsContent.innerHTML = this.logs.slice(-20).reverse().map(log => `
      <div class="pl-progress-log pl-log-${log.level}">
        [${log.timestamp}] ${this.escapeHtml(log.message)}
      </div>
    `).join('');
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
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
    hide: () => getProgressTracker().hide(),
    addLog: (...args) => getProgressTracker().addLog(...args)
  };
}

console.log('[PerspectiveLens] Progress tracker module loaded');
