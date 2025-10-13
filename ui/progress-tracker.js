/**
 * PerspectiveLens Progress Tracker
 * Elegant progress tracking with real-time logs
 */

class ProgressTracker {
  constructor() {
    this.container = null;
    this.logs = [];
    this.steps = [
      { id: 'extract', label: 'Extracting content', status: 'pending', progress: 0 },
      { id: 'keywords', label: 'Generating keywords', status: 'pending', progress: 0 },
      { id: 'search', label: 'Searching perspectives', status: 'pending', progress: 0 },
      { id: 'fetch', label: 'Fetching articles', status: 'pending', progress: 0 },
      { id: 'analyze', label: 'Analyzing perspectives', status: 'pending', progress: 0 }
    ];
    this.isMinimized = false;
    this.isVisible = false;
  }

  /**
   * Show the progress tracker
   */
  show() {
    if (this.isVisible) return;

    // Create container if it doesn't exist
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
    }, 300);

    console.log('[PerspectiveLens] Progress tracker hidden');
  }

  /**
   * Create the container element
   */
  createContainer() {
    const container = document.createElement('div');
    container.id = 'pl-progress-tracker';
    container.className = 'pl-progress-container';
    this.container = container;
  }

  /**
   * Toggle minimize state
   */
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.container.classList.toggle('pl-progress-minimized', this.isMinimized);
  }

  /**
   * Update step status
   * @param {string} stepId - Step identifier
   * @param {string} status - 'pending' | 'active' | 'completed' | 'error'
   * @param {string} statusText - Status message
   * @param {number} progress - Progress percentage (0-100)
   */
  updateStep(stepId, status, statusText = '', progress = 0) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = status;
    step.statusText = statusText;
    step.progress = progress;

    this.render();
  }

  /**
   * Add a log entry
   * @param {string} message - Log message
   * @param {string} type - 'info' | 'success' | 'warning' | 'error'
   */
  addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    this.logs.push({
      timestamp,
      message,
      type
    });

    // Keep only last 50 logs
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(-50);
    }

    this.renderLogs();

    // Auto-scroll to bottom
    const logsContainer = this.container?.querySelector('.pl-progress-logs');
    if (logsContainer) {
      setTimeout(() => {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }, 50);
    }
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.renderLogs();
  }

  /**
   * Reset tracker to initial state
   */
  reset() {
    this.steps.forEach(step => {
      step.status = 'pending';
      step.statusText = '';
      step.progress = 0;
    });
    this.logs = [];
    this.render();
  }

  /**
   * Get step icon based on status
   */
  getStepIcon(status) {
    const icons = {
      pending: '○',
      active: '<div class="pl-progress-spinner"></div>',
      completed: '✓',
      error: '✕'
    };
    return icons[status] || icons.pending;
  }

  /**
   * Render the complete UI
   */
  render() {
    if (!this.container) return;

    const overallProgress = this.calculateOverallProgress();

    this.container.innerHTML = `
      <div class="pl-progress-header">
        <div class="pl-progress-header-left">
          <div class="pl-progress-icon">🔄</div>
          <div>
            <div class="pl-progress-title">Analyzing Perspectives</div>
            <div class="pl-progress-subtitle">${Math.round(overallProgress)}% complete</div>
          </div>
        </div>
        <button class="pl-progress-minimize" aria-label="Minimize">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      </div>

      <div class="pl-progress-content">
        <!-- Steps -->
        <div class="pl-progress-steps">
          ${this.steps.map(step => this.renderStep(step)).join('')}
        </div>

        <!-- Overall Progress Bar -->
        <div class="pl-progress-bar-container">
          <div class="pl-progress-bar" style="width: ${overallProgress}%"></div>
        </div>

        <!-- Logs -->
        <div class="pl-progress-logs-section">
          <div class="pl-progress-logs-header">
            <div class="pl-progress-logs-title">Activity Log</div>
            <button class="pl-progress-logs-clear" id="pl-clear-logs">Clear</button>
          </div>
          <div class="pl-progress-logs" id="pl-progress-logs">
            ${this.renderLogsContent()}
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render a single step
   */
  renderStep(step) {
    const icon = this.getStepIcon(step.status);

    return `
      <div class="pl-progress-step pl-step-${step.status}">
        <div class="pl-progress-step-icon">${icon}</div>
        <div class="pl-progress-step-content">
          <div class="pl-progress-step-label">${this.escapeHtml(step.label)}</div>
          ${step.statusText ? `
            <div class="pl-progress-step-status">${this.escapeHtml(step.statusText)}</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render logs content
   */
  renderLogsContent() {
    if (this.logs.length === 0) {
      return '<div class="pl-progress-logs-empty">No activity yet...</div>';
    }

    return this.logs.map(log => `
      <div class="pl-progress-log-entry">
        <span class="pl-progress-log-timestamp">${log.timestamp}</span>
        <span class="pl-progress-log-message pl-log-${log.type}">${this.escapeHtml(log.message)}</span>
      </div>
    `).join('');
  }

  /**
   * Render only logs section (for updates)
   */
  renderLogs() {
    const logsContainer = this.container?.querySelector('#pl-progress-logs');
    if (logsContainer) {
      logsContainer.innerHTML = this.renderLogsContent();
    }
  }

  /**
   * Calculate overall progress
   */
  calculateOverallProgress() {
    const completed = this.steps.filter(s => s.status === 'completed').length;
    const active = this.steps.find(s => s.status === 'active');
    const activeProgress = active ? active.progress / 100 : 0;

    return ((completed + activeProgress) / this.steps.length) * 100;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const minimizeBtn = this.container.querySelector('.pl-progress-minimize');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    }

    const clearBtn = this.container.querySelector('#pl-clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearLogs());
    }

    // Click to expand when minimized
    if (this.isMinimized) {
      this.container.addEventListener('click', (e) => {
        if (e.target === this.container) {
          this.toggleMinimize();
        }
      });
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// Global instance
let progressTracker = null;

function getProgressTracker() {
  if (!progressTracker) {
    progressTracker = new ProgressTracker();
  }
  return progressTracker;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.PerspectiveLensProgress = {
    getInstance: getProgressTracker,
    show: () => getProgressTracker().show(),
    hide: () => getProgressTracker().hide(),
    updateStep: (...args) => getProgressTracker().updateStep(...args),
    addLog: (...args) => getProgressTracker().addLog(...args),
    clearLogs: () => getProgressTracker().clearLogs(),
    reset: () => getProgressTracker().reset()
  };
}

console.log('[PerspectiveLens] Progress tracker module loaded');
