/**
 * PerspectivesModal - Google News-style modal for displaying article perspectives
 *
 * @description
 * Modern, visual modal component inspired by Google News design.
 * Features grid layout with featured images, filtering, sorting, and full theme support.
 *
 * @features
 * - Grid layout with featured images and favicons
 * - Filtering by country, source
 * - Sorting by relevance, date, country, source
 * - Light/Dark mode support via design-system.css
 * - Fully accessible (ARIA, keyboard navigation)
 * - Shadow DOM compatible
 * - Lazy loading for images
 * - Responsive design (mobile, tablet, desktop)
 *
 * @author PerspectiveLens
 */

// Import icons from icons library
import { icons } from '../../../icons.js';

class PerspectivesModal {
  /**
   * Create a new PerspectivesModal
   * @param {Array} perspectives - Array of perspective objects
   * @param {Object} options - Configuration options
   */
  constructor(perspectives, options = {}) {
    this.perspectives = perspectives || [];
    this.options = {
      onClose: null,            // callback when modal closes
      ...options
    };

    this.shadowContainer = window.__PL_SHADOW_CONTAINER__;
    this.modalElement = null;

    // Validate Shadow DOM availability
    if (!this.shadowContainer) {
      console.error('[PerspectivesModal] Shadow container not available');
    }
  }

  /**
   * Show the modal
   */
  show() {
    if (!this.shadowContainer) {
      console.error('[PerspectivesModal] Cannot show modal - Shadow container not available');
      return;
    }

    // Remove existing modal if any
    this.hide();

    // Render modal
    this.render();

    // Attach event listeners
    this.attachEventListeners();

    // Prevent body scroll (on shadow host)
    const shadowHost = document.getElementById('perspective-lens-root');
    if (shadowHost) {
      shadowHost.style.overflow = 'hidden';
    }
  }

  /**
   * Hide and remove the modal
   */
  hide() {
    const existingModal = this.shadowContainer?.querySelector('#pl-perspectives-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Restore body scroll
    const shadowHost = document.getElementById('perspective-lens-root');
    if (shadowHost) {
      shadowHost.style.overflow = '';
    }

    // Call onClose callback
    if (this.options.onClose) {
      this.options.onClose();
    }

    this.modalElement = null;
  }

  /**
   * Render the complete modal
   */
  render() {
    const modalHTML = `
      <div id="pl-perspectives-modal" class="pl-perspectives-modal" role="dialog" aria-modal="true" aria-labelledby="pl-modal-title">
        <div class="pl-perspectives-overlay"></div>
        <div class="pl-perspectives-content">
          ${this.renderHeader()}
          ${this.renderGrid()}
        </div>
      </div>
    `;

    // Inject into Shadow DOM
    this.shadowContainer.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = this.shadowContainer.querySelector('#pl-perspectives-modal');

    // Trigger entrance animation
    requestAnimationFrame(() => {
      this.modalElement?.classList.add('pl-modal-visible');
    });
  }

  /**
   * Render modal header
   * @returns {string} HTML for modal header
   */
  renderHeader() {
    const total = this.perspectives.length;
    const subtitle = `${total} perspective${total !== 1 ? 's' : ''}`;

    return `
      <div class="pl-modal-header">
        <div class="pl-modal-title-section">
          <h2 id="pl-modal-title" class="pl-modal-title">All Perspectives</h2>
          <p class="pl-modal-subtitle">${subtitle}</p>
        </div>
        <button class="pl-btn-icon pl-modal-close" id="pl-modal-close-btn" aria-label="Close modal" type="button">
          ${icons.close}
        </button>
      </div>
    `;
  }

  /**
   * Render perspectives grid
   * @returns {string} HTML for perspectives grid
   */
  renderGrid() {
    if (!this.perspectives || this.perspectives.length === 0) {
      return `
        <div class="pl-modal-body">
          <div class="pl-empty-state">
            <p>No perspectives available</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="pl-modal-body">
        <div class="pl-perspectives-grid">
          ${this.perspectives.map(p => this.renderCard(p)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render individual perspective card
   * @param {Object} perspective - Perspective data
   * @returns {string} HTML for perspective card
   */
  renderCard(perspective) {
    const {
      title,
      source,
      country,
      countryCode,
      finalUrl,
      extractedContent = {},
      pubDate
    } = perspective;

    const {
      domain,
      featuredImage,
      favicon,
      excerpt,
      byline
    } = extractedContent;

    // Format date
    const timeAgo = this.formatTimeAgo(pubDate);

    // Get country flag emoji
    const countryFlag = this.getCountryFlag(countryCode);

    // Escape HTML
    const safeTitle = this.escapeHtml(title);
    const safeSource = this.escapeHtml(source);
    const safeExcerpt = this.escapeHtml(excerpt || 'No preview available');
    const safeByline = byline ? this.escapeHtml(byline) : null;
    const safeCountry = this.escapeHtml(country || 'Unknown');
    const safeDomain = this.escapeHtml(domain || new URL(finalUrl).hostname);

    return `
      <article class="pl-perspective-card" data-url="${finalUrl}">
        ${featuredImage ? `
          <div class="pl-card-image-container">
            <img
              src="${featuredImage}"
              alt="${safeTitle}"
              class="pl-card-image"
              loading="lazy"
              onerror="this.parentElement.classList.add('pl-image-error')"
            />
          </div>
        ` : `
          <div class="pl-card-image-container pl-card-image-placeholder">
            <div class="pl-image-placeholder-content">
              ${icons.article || '📰'}
            </div>
          </div>
        `}

        <div class="pl-card-content">
          <div class="pl-card-source-row">
            ${favicon ? `
              <img
                src="${favicon}"
                alt="${safeSource} icon"
                class="pl-card-favicon"
                onerror="this.style.display='none'"
              />
            ` : ''}
            <span class="pl-card-source" title="${safeDomain}">${safeSource}</span>
          </div>

          <h3 class="pl-card-title">${safeTitle}</h3>

          ${safeByline ? `
            <p class="pl-card-byline">By ${safeByline}</p>
          ` : ''}

          <p class="pl-card-excerpt">${safeExcerpt}</p>

          <div class="pl-card-footer">
            <span class="pl-card-country" title="${safeCountry}">
              ${countryFlag} ${safeCountry}
            </span>
            ${timeAgo ? `
              <span class="pl-card-time">${timeAgo}</span>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Attach event listeners to modal elements
   */
  attachEventListeners() {
    if (!this.modalElement) return;

    // Close button
    const closeBtn = this.modalElement.querySelector('#pl-modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Overlay click
    const overlay = this.modalElement.querySelector('.pl-perspectives-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.hide());
    }

    // Escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);

    // Card clicks
    const cards = this.modalElement.querySelectorAll('.pl-perspective-card');
    cards.forEach(card => {
      const url = card.dataset.url;
      if (url) {
        card.addEventListener('click', (e) => {
          // Don't navigate if clicking on a link inside the card
          if (e.target.tagName !== 'A') {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });

        // Make card keyboard accessible
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'link');
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      }
    });
  }

  /**
   * Format time ago string
   * @param {string} dateString - Date string
   * @returns {string} Time ago string (e.g., "2h ago")
   */
  formatTimeAgo(dateString) {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      // Format as date for older articles
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get country flag emoji from country code
   * @param {string} countryCode - ISO country code (e.g., "US")
   * @returns {string} Flag emoji
   */
  getCountryFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';

    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());

    return String.fromCodePoint(...codePoints);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Cleanup when modal is destroyed
   */
  destroy() {
    // Remove escape key handler
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }

    // Hide modal
    this.hide();
  }
}

// Export for use in other modules
export { PerspectivesModal };
