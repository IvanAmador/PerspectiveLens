/**
 * PerspectiveLens Shadow Root Container
 * Provides complete style isolation using Shadow DOM
 *
 * This custom element wraps all PerspectiveLens UI components
 * (toast notifications and analysis panel) in a closed Shadow DOM,
 * preventing style conflicts with host pages.
 */

class PerspectiveLensRoot extends HTMLElement {
  constructor() {
    super();

    // Create closed shadow root for maximum encapsulation
    this._shadowRoot = this.attachShadow({ mode: 'closed' });

    // Create internal container for components
    this._shadowRoot.innerHTML = `
      <div id="pl-shadow-container"></div>
    `;

    this.container = this._shadowRoot.querySelector('#pl-shadow-container');
    this.stylesLoaded = false;
    this.styleLoadPromises = [];

    console.log('[PerspectiveLens] Shadow Root created');
  }

  /**
   * Called when element is added to DOM
   */
  async connectedCallback() {
    console.log('[PerspectiveLens] Shadow Root connected, injecting styles...');

    try {
      // Inject all required CSS into Shadow DOM
      await Promise.all([
        this.injectCSS('ui/design-system.css'),
        this.injectCSS('ui/components/toast/single-toast.css'),
        this.injectCSS('ui/components/panel/panel-styles.css')
      ]);

      this.stylesLoaded = true;
      console.log('[PerspectiveLens] All styles injected into Shadow DOM');

      // Dispatch event to notify components that shadow root is ready
      this.dispatchEvent(new CustomEvent('pl:shadow-ready', {
        bubbles: false,
        detail: { container: this.container }
      }));

    } catch (error) {
      console.error('[PerspectiveLens] Failed to inject styles:', error);
    }
  }

  /**
   * Inject CSS file into Shadow DOM
   * @param {string} path - Relative path to CSS file
   * @returns {Promise<void>}
   */
  async injectCSS(path) {
    try {
      const url = chrome.runtime.getURL(path);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
      }

      const css = await response.text();

      const style = document.createElement('style');
      style.textContent = css;
      this._shadowRoot.appendChild(style);

      console.log(`[PerspectiveLens] Injected: ${path}`);
    } catch (error) {
      console.error(`[PerspectiveLens] Error injecting ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get the shadow container element
   * @returns {HTMLElement} Container for components
   */
  getContainer() {
    return this.container;
  }

  /**
   * Get the shadow root (for internal use only)
   * @returns {ShadowRoot}
   */
  getShadowRoot() {
    return this._shadowRoot;
  }

  /**
   * Wait for styles to be loaded
   * @returns {Promise<void>}
   */
  async waitForStyles() {
    if (this.stylesLoaded) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // If already connected, wait for event
      if (this.isConnected) {
        this.addEventListener('pl:shadow-ready', () => resolve(), { once: true });
      } else {
        // Wait for connectedCallback to be called
        const observer = new MutationObserver(() => {
          if (this.isConnected) {
            observer.disconnect();
            if (this.stylesLoaded) {
              resolve();
            } else {
              this.addEventListener('pl:shadow-ready', () => resolve(), { once: true });
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  /**
   * Query selector within shadow root
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  querySelector(selector) {
    return this._shadowRoot.querySelector(selector);
  }

  /**
   * Query selector all within shadow root
   * @param {string} selector - CSS selector
   * @returns {NodeList}
   */
  querySelectorAll(selector) {
    return this._shadowRoot.querySelectorAll(selector);
  }
}

// Register custom element (with safety check)
// Check if we're in a top-level context
(function() {
  let isTopLevel = false;
  try {
    isTopLevel = (window === window.top);
  } catch (e) {
    // Cross-origin iframe - can't access window.top
    // Assume we're NOT top level
    isTopLevel = false;
  }

  // Only register in top-level window (not in iframes)
  if (typeof window !== 'undefined' && isTopLevel) {
    if (typeof customElements !== 'undefined' && customElements) {
      if (!customElements.get('perspective-lens-root')) {
        customElements.define('perspective-lens-root', PerspectiveLensRoot);
        console.log('[PerspectiveLens] Custom element registered: <perspective-lens-root>');
      }
    } else {
      console.warn('[PerspectiveLens] Custom Elements API not available - skipping Shadow DOM initialization');
    }
  }
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PerspectiveLensRoot = PerspectiveLensRoot;
}
