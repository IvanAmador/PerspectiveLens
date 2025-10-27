/**
 * SingleToast - Toast único persistente durante análise
 *
 * Features:
 * - Progress bar linear animada (Material 3)
 * - Mensagens dinâmicas user-friendly
 * - Flags de países animadas
 * - Indicadores visuais de IA
 * - Auto-dismiss ao completar
 *
 * Usage:
 *   import { singleToast } from './ui/single-toast.js';
 *
 *   singleToast.show('Analyzing article...');
 *   singleToast.updateProgress(50);
 *   singleToast.updateMessage('AI summarizing...', 'AI');
 *   singleToast.addFlag('BR');
 *   singleToast.dismiss();
 */

class SingleToast {
  constructor() {
    this.container = null;
    this.progressBar = null;
    this.progressFill = null;
    this.titleElement = null;
    this.messageElement = null;
    this.flagsContainer = null;
    this.aiIndicator = null;
    this.actionsContainer = null;
    this.currentProgress = 0;
    this.activeFlags = new Set(); // Track active flags
    this.dismissTimeout = null;
    this.actionCallbacks = {}; // Store action callbacks
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Wait for shadow root to be ready
   */
  async waitForShadowRoot() {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Wait for shadow container to be available
      let retries = 0;
      const maxRetries = 30; // 3 seconds max

      while (retries < maxRetries) {
        if (window.__PL_SHADOW_CONTAINER__) {
          this.initialized = true;
          console.log('[SingleToast] Shadow root ready');
          return true;
        }

        if (retries % 5 === 0) {
          console.log(`[SingleToast] Waiting for shadow root... (attempt ${retries + 1}/${maxRetries})`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      console.error('[SingleToast] Timeout waiting for shadow root');
      return false;
    })();

    return this.initPromise;
  }

  /**
   * Show toast with initial title and optional actions
   * @param {string} title - Toast title
   * @param {Object} options - Optional configuration
   * @param {Array} options.actions - Array of action buttons [{label, callback, primary}]
   * @param {string} options.message - Optional message text
   * @param {boolean} options.showProgress - Whether to show progress bar (default: true)
   */
  async show(title = 'Processing...', options = {}) {
    // Wait for shadow root to be ready
    const ready = await this.waitForShadowRoot();
    if (!ready) {
      console.error('[SingleToast] Cannot show toast - shadow root not ready');
      return;
    }

    if (!this.container) {
      this.create();
    }

    this.container.classList.add('visible');
    this.updateTitle(title);
    this.updateProgress(0);
    this.clearFlags();
    this.hideAIIndicator();
    this.clearActions();

    // Show/hide progress bar based on options
    const showProgress = options.showProgress !== false;
    this.setProgressVisibility(showProgress);

    // Control logo animation and styling based on whether we're analyzing
    if (options.showProgress !== false) {
      this.startLogoAnimation();
      this.container.classList.remove('no-progress');
    } else {
      this.stopLogoAnimation();
      this.container.classList.add('no-progress');
    }

    // Set message if provided
    if (options.message) {
      this.updateMessage(options.message);
    }

    // Add action buttons if provided
    if (options.actions && options.actions.length > 0) {
      this.setActions(options.actions);
    }

    // Clear any pending dismiss timeout
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
  }

  /**
   * Create toast DOM structure
   */
  create() {
    // Get shadow container from global reference
    const shadowContainer = window.__PL_SHADOW_CONTAINER__;
    if (!shadowContainer) {
      console.error('[SingleToast] Shadow container not available');
      return;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'perspective-single-toast';
    this.container.innerHTML = `
      <img class="toast-logo" src="${chrome.runtime.getURL('images/icon-32.png')}" alt="PerspectiveLens">

      <div class="toast-content">
        <div class="toast-header">
          <div class="toast-title">Processing...</div>
        </div>

        <div class="toast-progress">
          <div class="toast-progress-fill"></div>
        </div>

        <div class="toast-message"></div>

        <div class="toast-flags"></div>

        <div class="toast-actions"></div>
      </div>

      <div class="toast-ai-indicator" style="display: none;">
        <svg class="ai-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L9.19 8.63L2 11.44l7.19 2.81L12 22l2.81-7.75L22 11.44l-7.19-2.81z"/>
        </svg>
      </div>
    `;

    // Get element references
    this.titleElement = this.container.querySelector('.toast-title');
    this.messageElement = this.container.querySelector('.toast-message');
    this.progressBar = this.container.querySelector('.toast-progress');
    this.progressFill = this.container.querySelector('.toast-progress-fill');
    this.flagsContainer = this.container.querySelector('.toast-flags');
    this.aiIndicator = this.container.querySelector('.toast-ai-indicator');
    this.actionsContainer = this.container.querySelector('.toast-actions');
    this.logoElement = this.container.querySelector('.toast-logo');

    // Append to shadow container
    shadowContainer.appendChild(this.container);
    console.log('[SingleToast] Toast injected into Shadow DOM');
  }

  /**
   * Update toast title
   * @param {string} title - New title
   */
  updateTitle(title) {
    if (this.titleElement) {
      this.titleElement.textContent = title;
    }
  }

  /**
   * Update progress bar
   * @param {number} percent - Progress percentage (0-100)
   * @param {boolean} animated - Whether to animate the change
   */
  updateProgress(percent, animated = true) {
    if (!this.progressFill) return;

    this.currentProgress = Math.max(0, Math.min(100, percent));

    if (animated) {
      this.progressFill.style.transition = 'width 0.3s var(--md-easing-emphasized, ease-out)';
    } else {
      this.progressFill.style.transition = 'none';
    }

    this.progressFill.style.width = `${this.currentProgress}%`;

    // Update aria for accessibility
    this.progressBar.setAttribute('aria-valuenow', this.currentProgress);
  }

  /**
   * Set progress bar visibility
   * @param {boolean} visible - Whether to show progress bar
   */
  setProgressVisibility(visible) {
    if (!this.progressBar) return;

    this.progressBar.style.display = visible ? 'block' : 'none';
  }

  /**
   * Update message text with optional icon
   * @param {string} message - Message text
   * @param {string} icon - Icon type ('AI', 'SEARCH', 'EXTRACT', null)
   */
  updateMessage(message, icon = null) {
    if (!this.messageElement) return;

    this.messageElement.textContent = message;

    // Show/hide AI indicator
    if (icon === 'AI') {
      this.showAIIndicator();
    } else {
      this.hideAIIndicator();
    }
  }

  /**
   * Add country flag to toast
   * @param {string} countryCode - ISO country code (BR, US, CN, etc)
   */
  addFlag(countryCode) {
    if (!this.flagsContainer || this.activeFlags.has(countryCode)) return;

    this.activeFlags.add(countryCode);

    const flagImg = document.createElement('img');
    flagImg.className = 'toast-flag';
    flagImg.src = chrome.runtime.getURL(`icons/flags/${countryCode.toUpperCase()}.svg`);
    flagImg.alt = countryCode;
    flagImg.title = this.getCountryName(countryCode);
    flagImg.dataset.country = countryCode;

    this.flagsContainer.appendChild(flagImg);

    // Show flags container if hidden
    if (this.activeFlags.size > 0) {
      this.flagsContainer.style.display = 'flex';
    }
  }

  /**
   * Clear all flags
   */
  clearFlags() {
    if (this.flagsContainer) {
      this.flagsContainer.innerHTML = '';
      this.flagsContainer.style.display = 'none';
    }
    this.activeFlags.clear();
  }

  /**
   * Show AI indicator animation
   */
  showAIIndicator() {
    if (this.aiIndicator) {
      this.aiIndicator.style.display = 'flex';
    }
  }

  /**
   * Hide AI indicator
   */
  hideAIIndicator() {
    if (this.aiIndicator) {
      this.aiIndicator.style.display = 'none';
    }
  }

  /**
   * Dismiss toast with animation
   * @param {number} delay - Delay before dismissing (ms)
   */
  dismiss(delay = 0) {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
    }

    this.dismissTimeout = setTimeout(() => {
      if (!this.container) return;

      // Stop logo animation before dismissing
      this.stopLogoAnimation();

      // Add dismissing class for exit animation (slides left)
      this.container.classList.add('dismissing');
      this.container.classList.remove('visible');

      // Remove from DOM after animation completes
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
          this.container = null;
        }
      }, 300); // Match CSS transition duration
    }, delay);
  }

  /**
   * Get country name from code
   * @param {string} code - Country code
   * @returns {string} Country name
   */
  getCountryName(code) {
    const countryNames = {
      'BR': 'Brazil',
      'US': 'United States',
      'CN': 'China',
      'RU': 'Russia',
      'PS': 'Palestine',
      'GB': 'United Kingdom',
      'FR': 'France',
      'DE': 'Germany',
      'JP': 'Japan',
      'IN': 'India',
      'AR': 'Argentina',
      'MX': 'Mexico',
      'CA': 'Canada',
      'AU': 'Australia',
      'ES': 'Spain',
      'IT': 'Italy',
      'KR': 'South Korea',
      'SA': 'Saudi Arabia',
      'TR': 'Turkey',
      'ZA': 'South Africa'
    };

    return countryNames[code.toUpperCase()] || code;
  }

  /**
   * Check if toast is currently visible
   * @returns {boolean} True if visible
   */
  isVisible() {
    return this.container && this.container.classList.contains('visible');
  }

  /**
   * Get current progress percentage
   * @returns {number} Current progress (0-100)
   */
  getProgress() {
    return this.currentProgress;
  }

  /**
   * Move toast to the left when panel opens
   */
  moveToPanelMode() {
    if (this.container) {
      this.container.classList.add('panel-open');
    }
  }

  /**
   * Move toast back to right when panel closes
   */
  moveToNormalMode() {
    if (this.container) {
      this.container.classList.remove('panel-open');
    }
  }

  /**
   * Set action buttons
   * @param {Array} actions - Array of action objects [{label, callback, primary, dismiss}]
   */
  setActions(actions) {
    if (!this.actionsContainer) return;

    this.clearActions();

    actions.forEach((action, index) => {
      const button = document.createElement('button');
      button.className = action.primary ? 'toast-btn toast-btn-primary' : 'toast-btn toast-btn-secondary';
      button.textContent = action.label;
      button.dataset.actionId = `action-${index}`;

      // Store callback
      this.actionCallbacks[`action-${index}`] = action.callback;

      // Add click handler
      button.addEventListener('click', (e) => {
        e.stopPropagation();

        // Execute callback
        if (action.callback) {
          action.callback();
        }

        // Auto-dismiss if specified
        if (action.dismiss !== false) {
          this.dismiss();
        }
      });

      this.actionsContainer.appendChild(button);
    });

    // Show actions container
    if (actions.length > 0) {
      this.actionsContainer.style.display = 'flex';
    }
  }

  /**
   * Clear all action buttons
   */
  clearActions() {
    if (this.actionsContainer) {
      this.actionsContainer.innerHTML = '';
      this.actionsContainer.style.display = 'none';
    }
    this.actionCallbacks = {};
  }

  /**
   * Start logo rotation animation
   */
  startLogoAnimation() {
    if (this.logoElement) {
      this.logoElement.classList.add('spinning');
    }
  }

  /**
   * Stop logo rotation animation
   */
  stopLogoAnimation() {
    if (this.logoElement) {
      this.logoElement.classList.remove('spinning');
    }
  }
}

// Create singleton instance and expose globally
(function() {
  if (typeof window !== 'undefined') {
    const singleToast = new SingleToast();

    // Expose globally for content script
    window.PerspectiveLensSingleToast = singleToast;
    console.log('[PerspectiveLens] SingleToast registered globally');
  }
})();
