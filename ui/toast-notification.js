/**
 * PerspectiveLens Toast Notification System
 * Elegant notification system for user interactions
 */

class ToastNotification {
  constructor() {
    this.container = null;
    this.activeToasts = [];
    this.init();
  }

  init() {
    // Create container if it doesn't exist
    if (!document.getElementById('pl-toast-container')) {
      const container = document.createElement('div');
      container.id = 'pl-toast-container';
      container.className = 'pl-toast-container';
      document.body.appendChild(container);
      this.container = container;
    } else {
      this.container = document.getElementById('pl-toast-container');
    }

    console.log('[PerspectiveLens] Toast notification system initialized');
  }

  /**
   * Show a toast notification
   * @param {Object} options - Toast configuration
   * @param {string} options.title - Toast title
   * @param {string} options.message - Toast message
   * @param {string} options.icon - Emoji icon (default: 📰)
   * @param {Array} options.actions - Array of action buttons
   * @param {number} options.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
   * @param {boolean} options.closeable - Show close button (default: true)
   */
  show(options = {}) {
    const {
      title = 'PerspectiveLens',
      message = '',
      icon = '📰',
      actions = [],
      duration = 0,
      closeable = true
    } = options;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'pl-toast';

    const toastId = `pl-toast-${Date.now()}`;
    toast.id = toastId;

    // Build HTML
    let html = `
      <div class="pl-toast-icon">${icon}</div>
      <div class="pl-toast-content">
        <div class="pl-toast-title">${this.escapeHtml(title)}</div>
        ${message ? `<div class="pl-toast-message">${this.escapeHtml(message)}</div>` : ''}
        ${actions.length > 0 ? `
          <div class="pl-toast-actions">
            ${actions.map((action, idx) => `
              <button class="pl-toast-btn ${action.primary ? 'pl-toast-btn-primary' : 'pl-toast-btn-secondary'}"
                      data-action-idx="${idx}">
                ${this.escapeHtml(action.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    if (closeable) {
      html += `
        <button class="pl-toast-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
    }

    // Add progress bar if duration is set
    if (duration > 0) {
      html += `
        <div class="pl-toast-progress">
          <div class="pl-toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
        </div>
      `;
    }

    toast.innerHTML = html;

    // Attach event listeners
    if (closeable) {
      const closeBtn = toast.querySelector('.pl-toast-close');
      closeBtn.addEventListener('click', () => this.hide(toastId));
    }

    // Attach action listeners
    actions.forEach((action, idx) => {
      const btn = toast.querySelector(`[data-action-idx="${idx}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (action.onClick) {
            action.onClick();
          }
          if (action.dismissOnClick !== false) {
            this.hide(toastId);
          }
        });
      }
    });

    // Add to container
    this.container.appendChild(toast);
    this.activeToasts.push(toastId);

    // Auto-dismiss if duration is set
    if (duration > 0) {
      setTimeout(() => {
        this.hide(toastId);
      }, duration);
    }

    return toastId;
  }

  /**
   * Hide a toast notification
   * @param {string} toastId - Toast ID to hide
   */
  hide(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    // Add hiding animation
    toast.classList.add('pl-toast-hiding');

    // Remove after animation
    setTimeout(() => {
      toast.remove();
      this.activeToasts = this.activeToasts.filter(id => id !== toastId);
    }, 300);
  }

  /**
   * Hide all active toasts
   */
  hideAll() {
    this.activeToasts.forEach(toastId => this.hide(toastId));
  }

  /**
   * Show article detection toast
   */
  showArticleDetected(onAnalyze, onDismiss) {
    return this.show({
      title: 'News article detected!',
      message: 'Click to analyze perspectives from multiple sources',
      icon: '📰',
      actions: [
        {
          label: 'Analyze Now',
          primary: true,
          onClick: onAnalyze
        },
        {
          label: 'Dismiss',
          primary: false,
          onClick: onDismiss || (() => {})
        }
      ],
      closeable: true,
      duration: 0 // Don't auto-dismiss
    });
  }

  /**
   * Show analysis started toast
   */
  showAnalysisStarted() {
    return this.show({
      title: 'Analysis started',
      message: 'Extracting content and searching for perspectives...',
      icon: '🔍',
      closeable: false,
      duration: 3000
    });
  }

  /**
   * Show success toast
   */
  showSuccess(title, message) {
    return this.show({
      title,
      message,
      icon: '✅',
      closeable: true,
      duration: 4000
    });
  }

  /**
   * Show error toast
   */
  showError(title, message, onRetry) {
    const actions = [];

    if (onRetry) {
      actions.push({
        label: 'Retry',
        primary: true,
        onClick: onRetry
      });
    }

    actions.push({
      label: 'Dismiss',
      primary: false
    });

    return this.show({
      title,
      message,
      icon: '⚠️',
      actions,
      closeable: true,
      duration: 0
    });
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

// Initialize toast system when DOM is ready
let toastSystem = null;

function getToastSystem() {
  if (!toastSystem) {
    toastSystem = new ToastNotification();
  }
  return toastSystem;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.PerspectiveLensToast = {
    getInstance: getToastSystem,
    show: (...args) => getToastSystem().show(...args),
    hide: (...args) => getToastSystem().hide(...args),
    hideAll: () => getToastSystem().hideAll(),
    showArticleDetected: (...args) => getToastSystem().showArticleDetected(...args),
    showAnalysisStarted: () => getToastSystem().showAnalysisStarted(),
    showSuccess: (...args) => getToastSystem().showSuccess(...args),
    showError: (...args) => getToastSystem().showError(...args)
  };
}

console.log('[PerspectiveLens] Toast notification module loaded');
