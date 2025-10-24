/**
 * PerspectiveLens Toast Notification System
 * Chrome Material 3 design with SVG icons
 */

(function() {
  'use strict';

  // Check if already loaded
  if (window.PerspectiveLensToast) {
    console.log('[PerspectiveLens] Toast system already loaded, skipping...');
    return;
  }

  // Icon definitions
  const TOAST_ICONS = {
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 9V13M12 17H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    analyze: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      <path d="M12 6L8 12L12 18M12 6L16 12L12 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    document: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2V8H20M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  };

  class ToastNotification {
    constructor() {
      this.container = null;
      this.activeToasts = [];
      this.init();
    }

    init() {
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

    show(options = {}) {
      const {
        title = 'PerspectiveLens',
        message = '',
        type = 'info',
        actions = [],
        duration = 0,
        closeable = true
      } = options;

      const toast = document.createElement('div');
      toast.className = `pl-toast pl-toast-${type}`;

      const toastId = `pl-toast-${Date.now()}`;
      toast.id = toastId;

      let html = `
        <div class="pl-toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
        <div class="pl-toast-content">
          <div class="pl-toast-title">${this.escapeHtml(title)}</div>
          ${message ? `<div class="pl-toast-message">${this.escapeHtml(message)}</div>` : ''}
          ${actions.length > 0 ? `
            <div class="pl-toast-actions">
              ${actions.map((action, idx) => `
                <button class="pl-toast-btn ${action.primary ? 'pl-toast-btn-primary' : ''}"
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
            ${TOAST_ICONS.close}
          </button>
        `;
      }

      if (duration > 0) {
        html += `
          <div class="pl-toast-progress">
            <div class="pl-toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
          </div>
        `;
      }

      toast.innerHTML = html;

      if (closeable) {
        const closeBtn = toast.querySelector('.pl-toast-close');
        closeBtn.addEventListener('click', () => this.hide(toastId));
      }

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

      this.container.appendChild(toast);
      this.activeToasts.push(toastId);

      if (duration > 0) {
        setTimeout(() => {
          this.hide(toastId);
        }, duration);
      }

      return toastId;
    }

    hide(toastId) {
      const toast = document.getElementById(toastId);
      if (!toast) return;

      toast.classList.add('pl-toast-hiding');

      setTimeout(() => {
        toast.remove();
        this.activeToasts = this.activeToasts.filter(id => id !== toastId);
      }, 200);
    }

    hideAll() {
      this.activeToasts.forEach(toastId => this.hide(toastId));
    }

    showArticleDetected(onAnalyze, onDismiss) {
      return this.show({
        title: 'Article detected',
        message: 'Analyze perspectives from multiple sources',
        type: 'document',
        actions: [
          {
            label: 'Analyze',
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
        duration: 0
      });
    }

    showAnalysisStarted() {
      return this.show({
        title: 'Analysis started',
        message: 'Extracting content and searching perspectives...',
        type: 'analyze',
        closeable: false,
        duration: 3000
      });
    }

    showSuccess(title, message) {
      return this.show({
        title,
        message,
        type: 'success',
        closeable: true,
        duration: 4000
      });
    }

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
        type: 'error',
        actions,
        closeable: true,
        duration: 0
      });
    }

    showWarning(title, message, duration = 5000) {
      return this.show({
        title,
        message,
        type: 'warning',
        closeable: true,
        duration
      });
    }

    showInfo(title, message, duration = 4000) {
      return this.show({
        title,
        message,
        type: 'info',
        closeable: true,
        duration
      });
    }

    showProgress(title, message, onViewLogs) {
      return this.show({
        title,
        message,
        type: 'analyze',
        closeable: false,
        duration: 0,
        actions: [{
          label: 'View Logs',
          primary: false,
          onClick: onViewLogs,
          dismissOnClick: false
        }]
      });
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }
  }

  // Initialize and export
  let toastSystem = null;

  function getToastSystem() {
    if (!toastSystem) {
      toastSystem = new ToastNotification();
    }
    return toastSystem;
  }

  // Export
  window.PerspectiveLensToast = {
    getInstance: getToastSystem,
    show: (...args) => getToastSystem().show(...args),
    hide: (...args) => getToastSystem().hide(...args),
    hideAll: () => getToastSystem().hideAll(),
    showArticleDetected: (...args) => getToastSystem().showArticleDetected(...args),
    showAnalysisStarted: () => getToastSystem().showAnalysisStarted(),
    showSuccess: (...args) => getToastSystem().showSuccess(...args),
    showError: (...args) => getToastSystem().showError(...args),
    showWarning: (...args) => getToastSystem().showWarning(...args),
    showInfo: (...args) => getToastSystem().showInfo(...args),
    showProgress: (...args) => getToastSystem().showProgress(...args)
  };

  console.log('[PerspectiveLens] Toast notification module loaded');
})();
