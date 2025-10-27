/**
 * Panel Loader
 * Loads the modular panel system as ES modules
 */

(async function() {
  'use strict';

  console.log('[PanelLoader] Loading modular panel system...');

  try {
    // Get extension URL for module imports
    const extensionUrl = chrome.runtime.getURL('');

    // Import PanelRenderer and stage renderers
    const { PanelRenderer } = await import(chrome.runtime.getURL('ui/components/panel/panel-renderer.js'));
    const { Stage1Renderer } = await import(chrome.runtime.getURL('ui/components/panel/stages/stage1-renderer.js'));
    const { Stage2Renderer } = await import(chrome.runtime.getURL('ui/components/panel/stages/stage2-renderer.js'));
    const { Stage3Renderer } = await import(chrome.runtime.getURL('ui/components/panel/stages/stage3-renderer.js'));
    const { Stage4Renderer } = await import(chrome.runtime.getURL('ui/components/panel/stages/stage4-renderer.js'));

    // Import PerspectivesModal
    const { PerspectivesModal } = await import(chrome.runtime.getURL('ui/components/panel/modal/index.js'));

    console.log('[PanelLoader] Modules loaded successfully');

    // Icon library (Material Design)
    const ICONS = {
      lens: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
      collapse: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
      expand: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`,
      error: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
    };

    class AnalysisPanel {
      constructor() {
        this.panel = null;
        this.isCollapsed = false;
        this.renderer = new PanelRenderer();
        this.initialized = false;
        this.initPromise = null;
      }

      /**
       * Helper to get shadow container
       */
      getShadowContainer() {
        return window.__PL_SHADOW_CONTAINER__;
      }

      /**
       * Initialize panel - waits for shadow root to be ready
       */
      async init() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
          console.log('[Panel] Waiting for shadow root...');

          // Wait for shadow container to be available
          let retries = 0;
          const maxRetries = 30; // 3 seconds max

          while (retries < maxRetries) {
            if (window.__PL_SHADOW_CONTAINER__) {
              console.log('[Panel] Shadow root ready, creating panel...');
              this.createPanel();
              this.attachEventListeners();
              this.initialized = true;
              console.log('[Panel] Analysis panel initialized');
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }

          console.error('[Panel] Timeout waiting for shadow root to be ready');
        })();

        return this.initPromise;
      }

      /**
       * Create panel DOM structure
       */
      createPanel() {
        // Get shadow container
        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) {
          console.error('[Panel] Shadow container not available');
          return;
        }

        // Check if panel already exists in shadow DOM
        if (shadowContainer.querySelector('#perspectivelens-panel')) {
          this.panel = shadowContainer.querySelector('#perspectivelens-panel');
          console.log('[Panel] Panel already exists in Shadow DOM');
          return;
        }

        const panelHTML = `
          <div id="perspectivelens-panel" class="pl-panel">
            <div class="pl-panel-header">
              <div class="pl-panel-header-top">
                <div class="pl-panel-title">
                  <span>PerspectiveLens</span>
                </div>
                <div class="pl-panel-actions">
                  <button id="pl-close-btn" class="pl-btn-icon" aria-label="Close panel" title="Close">
                    ${ICONS.collapse}
                  </button>
                </div>
              </div>
            </div>

            <div class="pl-panel-body">
              <!-- Stage Progress Indicator -->
              <div class="pl-stage-progress">
                <div class="pl-stage-indicator" data-stage="1">
                  <div class="pl-stage-dot"></div>
                  <div class="pl-stage-label">Context</div>
                </div>
                <div class="pl-stage-indicator" data-stage="2">
                  <div class="pl-stage-dot"></div>
                  <div class="pl-stage-label">Facts</div>
                </div>
                <div class="pl-stage-indicator" data-stage="3">
                  <div class="pl-stage-dot"></div>
                  <div class="pl-stage-label">Disputes</div>
                </div>
                <div class="pl-stage-indicator" data-stage="4">
                  <div class="pl-stage-dot"></div>
                  <div class="pl-stage-label">Perspectives</div>
                </div>
              </div>

              <!-- Loading State -->
              <div id="pl-loading" class="pl-state" style="display: none;">
                <div class="pl-spinner"></div>
                <p>Analyzing perspectives...</p>
              </div>

              <!-- Error State -->
              <div id="pl-error" class="pl-state pl-state-error" style="display: none;">
                ${ICONS.error}
                <p id="pl-error-message">An error occurred</p>
                <button id="pl-retry-btn" class="pl-btn-link">Retry analysis</button>
              </div>

              <!-- Analysis Content -->
              <div id="pl-content" class="pl-content" style="display: none;"></div>
            </div>
          </div>
        `;

        // Append to shadow container (instead of document.body)
        shadowContainer.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = shadowContainer.querySelector('#perspectivelens-panel');
        console.log('[Panel] Panel injected into Shadow DOM');
      }

      /**
       * Attach event listeners
       */
      attachEventListeners() {
        // Get shadow container for queries
        const shadowContainer = this.getShadowContainer();

        if (!shadowContainer) {
          console.warn('[Panel] Cannot attach event listeners - shadow container not found');
          return;
        }

        // Close button
        const closeBtn = shadowContainer.querySelector('#pl-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => this.hide());
        }

        // Retry button
        const retryBtn = shadowContainer.querySelector('#pl-retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => this.retry());
        }
      }
      
      /**
       * Update stage indicator
       * @param {number} stage - Stage number (1-4)
       * @param {string} status - 'active' or 'completed'
       */
      updateStageIndicator(stage, status) {
        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        const indicator = shadowContainer.querySelector(`.pl-stage-indicator[data-stage="${stage}"]`);
        if (!indicator) return;

        // Reset classes
        indicator.classList.remove('active', 'completed');

        // Add appropriate class
        if (status === 'active') {
          indicator.classList.add('active');
        } else if (status === 'completed') {
          indicator.classList.add('completed');
        }
      }

      /**
       * Reset all stage indicators
       */
      resetStageIndicators() {
        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        const indicators = shadowContainer.querySelectorAll('.pl-stage-indicator');
        indicators.forEach(ind => {
          ind.classList.remove('active', 'completed');
        });
      }

      /**
       * Show panel
       */
      async show() {
        await this.init();
        if (this.panel) {
          this.panel.classList.add('pl-panel-visible');
          console.log('[Panel] Panel shown');
        }
      }

      /**
       * Hide panel
       */
      hide() {
        if (this.panel) {
          this.panel.classList.remove('pl-panel-visible');
          console.log('[Panel] Panel hidden');
        }
      }

      /**
       * Show loading state
       */
      async showLoading() {
        await this.init();
        this.hideAllStates();
        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        const loading = shadowContainer.querySelector('#pl-loading');
        if (loading) loading.style.display = 'flex';
        this.show();
      }

      /**
       * Show error state
       */
      async showError(error) {
        await this.init();
        console.error('[Panel] Showing error:', error);
        this.hideAllStates();

        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        const errorEl = shadowContainer.querySelector('#pl-error');
        const errorMsg = shadowContainer.querySelector('#pl-error-message');

        if (errorEl && errorMsg) {
          errorMsg.textContent = error.message || 'An error occurred during analysis';
          errorEl.style.display = 'flex';
        }

        this.show();
      }

      /**
       * Show analysis - Progressive mode (called for each stage)
       * @param {number} stage - Stage number (1-4)
       * @param {Object} stageData - Data for this stage
       * @param {Array} perspectives - Perspectives array
       */
      async showAnalysisProgressive(stage, stageData, perspectives) {
        await this.init();
        console.log(`[Panel] Stage ${stage} data received:`, stageData);

        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) {
          console.error('[Panel] Shadow container not found');
          return;
        }

        // Hide loading/error states on first stage
        if (stage === 1) {
          this.hideAllStates();
          const content = shadowContainer.querySelector('#pl-content');
          if (content) {
            content.style.display = 'block';
            content.innerHTML = ''; // Clear previous content
          }

          // Mark first stage as active
          this.updateStageIndicator(1, 'active');
        }

        // Render this stage
        const stageHTML = this.renderer.updateStage(stage, stageData, perspectives);

        // Append to content
        const content = shadowContainer.querySelector('#pl-content');
        if (content && stageHTML) {
          content.insertAdjacentHTML('beforeend', stageHTML);

          // Mark current stage as completed
          this.updateStageIndicator(stage, 'completed');

          // Mark next stage as active (unless it's the last stage)
          if (stage < 4) {
            this.updateStageIndicator(stage + 1, 'active');
          }

          // Add footer on last stage
          if (stage === 4) {
            content.insertAdjacentHTML('beforeend', this.renderer.renderFooter());
            this.attachDynamicEventListeners();
          }
        }

        this.show();
      }

      /**
       * Show analysis - Complete mode (all at once)
       * @param {Object} analysis - Complete analysis data
       */
      async showAnalysis(analysis) {
        await this.init();
        console.log('[Panel] Raw data received:', analysis);

        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) {
          console.error('[Panel] Shadow container not found');
          return;
        }

        this.hideAllStates();

        // Render complete analysis
        const html = this.renderer.renderComplete(analysis, analysis.perspectives || []);

        // Update content
        const content = shadowContainer.querySelector('#pl-content');
        if (content) {
          content.innerHTML = html;
          content.style.display = 'block';
        }

        // Mark all stages as completed since we're showing complete analysis
        for (let i = 1; i <= 4; i++) {
          this.updateStageIndicator(i, 'completed');
        }

        this.attachDynamicEventListeners();
        this.show();
      }

      /**
       * Attach event listeners for dynamically rendered content
       */
      attachDynamicEventListeners() {
        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        // View perspectives button
        const viewBtn = shadowContainer.querySelector('#pl-view-perspectives');
        if (viewBtn) {
          viewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPerspectivesModal();
          });
        }
      }

      /**
       * Show perspectives modal (using new PerspectivesModal component)
       */
      showPerspectivesModal() {
        console.log('[Panel] Opening perspectives modal');

        // Get perspectives from renderer
        const perspectives = this.renderer.perspectives;

        if (!perspectives || perspectives.length === 0) {
          console.warn('[Panel] No perspectives available to display');
          return;
        }

        // Create and show modal
        const modal = new PerspectivesModal(perspectives, {
          sortBy: 'relevance',
          onClose: () => {
            console.log('[Panel] Perspectives modal closed');
          }
        });

        modal.show();
      }

      /**
       * Retry analysis
       */
      retry() {
        console.log('[Panel] Retry requested');
        this.renderer.reset();
        window.dispatchEvent(new CustomEvent('perspectivelens:retry'));
      }

      /**
       * Hide all state elements
       */
      hideAllStates() {
        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        const loading = shadowContainer.querySelector('#pl-loading');
        const error = shadowContainer.querySelector('#pl-error');
        const content = shadowContainer.querySelector('#pl-content');

        if (loading) loading.style.display = 'none';
        if (error) error.style.display = 'none';
        if (content) content.style.display = 'none';
      }

      /**
       * Reset panel state
       */
      reset() {
        this.renderer.reset();
        this.hideAllStates();
        this.resetStageIndicators();

        const shadowContainer = this.getShadowContainer();
        if (!shadowContainer) return;

        const content = shadowContainer.querySelector('#pl-content');
        if (content) content.innerHTML = '';
      }
    }

    // Create global instance
    if (typeof window !== 'undefined') {
      window.PerspectiveLensPanel = new AnalysisPanel();
      console.log('[PanelLoader] Global instance created successfully');
    }

  } catch (error) {
    console.error('[PanelLoader] Failed to load modular panel system:', error);
    console.error('[PanelLoader] Falling back to legacy panel if available');
  }
})();
