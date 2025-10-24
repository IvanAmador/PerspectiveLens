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
    this.currentProgress = 0;
    this.activeFlags = new Set(); // Track active flags
    this.dismissTimeout = null;
  }

  /**
   * Show toast with initial title
   * @param {string} title - Toast title
   */
  show(title = 'Processing...') {
    if (!this.container) {
      this.create();
    }

    this.container.classList.add('visible');
    this.updateTitle(title);
    this.updateProgress(0);
    this.clearFlags();
    this.hideAIIndicator();

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
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'perspective-single-toast';
    this.container.innerHTML = `
      <div class="toast-header">
        <div class="toast-title">Processing...</div>
        <div class="toast-ai-indicator" style="display: none;">
          <svg class="ai-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L9.19 8.63L2 11.44l7.19 2.81L12 22l2.81-7.75L22 11.44l-7.19-2.81z"/>
          </svg>
        </div>
      </div>

      <div class="toast-progress">
        <div class="toast-progress-fill"></div>
      </div>

      <div class="toast-message"></div>

      <div class="toast-flags"></div>
    `;

    // Get element references
    this.titleElement = this.container.querySelector('.toast-title');
    this.messageElement = this.container.querySelector('.toast-message');
    this.progressBar = this.container.querySelector('.toast-progress');
    this.progressFill = this.container.querySelector('.toast-progress-fill');
    this.flagsContainer = this.container.querySelector('.toast-flags');
    this.aiIndicator = this.container.querySelector('.toast-ai-indicator');

    // Append to body
    document.body.appendChild(this.container);
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
}

// Create singleton instance and expose globally
(function() {
  const singleToast = new SingleToast();

  // Expose globally for content script
  if (typeof window !== 'undefined') {
    window.PerspectiveLensSingleToast = singleToast;
    console.log('[PerspectiveLens] SingleToast registered globally');
  }
})();
