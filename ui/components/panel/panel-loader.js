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
        this.init();
      }

      init() {
        this.createPanel();
        this.attachEventListeners();
        console.log('[Panel] Analysis panel initialized');
      }

      /**
       * Create panel DOM structure
       */
      createPanel() {
        if (document.getElementById('perspectivelens-panel')) {
          this.panel = document.getElementById('perspectivelens-panel');
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
              <div class="pl-panel-subtitle">Comparative news analysis</div>
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

        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('perspectivelens-panel');
      }

      /**
       * Attach event listeners
       */
      attachEventListeners() {
        // Close button
        const closeBtn = document.getElementById('pl-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => this.hide());
        }

        // Retry button
        const retryBtn = document.getElementById('pl-retry-btn');
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
        const indicator = document.querySelector(`.pl-stage-indicator[data-stage="${stage}"]`);
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
        const indicators = document.querySelectorAll('.pl-stage-indicator');
        indicators.forEach(ind => {
          ind.classList.remove('active', 'completed');
        });
      }

      /**
       * Show panel
       */
      show() {
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
      showLoading() {
        this.hideAllStates();
        const loading = document.getElementById('pl-loading');
        if (loading) loading.style.display = 'flex';
        this.show();
      }

      /**
       * Show error state
       */
      showError(error) {
        console.error('[Panel] Showing error:', error);
        this.hideAllStates();

        const errorEl = document.getElementById('pl-error');
        const errorMsg = document.getElementById('pl-error-message');

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
      showAnalysisProgressive(stage, stageData, perspectives) {
        console.log(`[Panel] Stage ${stage} data received:`, stageData);

        // Hide loading/error states on first stage
        if (stage === 1) {
          this.hideAllStates();
          const content = document.getElementById('pl-content');
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
        const content = document.getElementById('pl-content');
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
      showAnalysis(analysis) {
        console.log('[Panel] Raw data received:', analysis);

        this.hideAllStates();

        // Render complete analysis
        const html = this.renderer.renderComplete(analysis, analysis.perspectives || []);

        // Update content
        const content = document.getElementById('pl-content');
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
        // View perspectives button
        const viewBtn = document.getElementById('pl-view-perspectives');
        if (viewBtn) {
          viewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPerspectivesModal();
          });
        }
      }

      /**
       * Show perspectives modal
       */
      showPerspectivesModal() {
        console.log('[Panel] Opening perspectives modal');

        // Remove existing modal if any
        const existingModal = document.getElementById('pl-perspectives-modal');
        if (existingModal) {
          existingModal.remove();
        }

        // Create modal
        const modalHTML = `
          <div id="pl-perspectives-modal" class="pl-modal">
            <div class="pl-modal-overlay"></div>
            <div class="pl-modal-content">
              <div class="pl-modal-header">
                <h2>All Perspectives</h2>
                <button class="pl-btn-icon" id="pl-modal-close" aria-label="Close modal">
                  ${ICONS.collapse}
                </button>
              </div>
              <div class="pl-modal-body">
                ${this.renderer.renderPerspectivesModal()}
              </div>
            </div>
          </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Attach close listeners
        const modal = document.getElementById('pl-perspectives-modal');
        const closeBtn = document.getElementById('pl-modal-close');
        const overlay = modal?.querySelector('.pl-modal-overlay');

        if (closeBtn) {
          closeBtn.addEventListener('click', () => modal?.remove());
        }

        if (overlay) {
          overlay.addEventListener('click', () => modal?.remove());
        }

        // Close on Escape key
        const escapeHandler = (e) => {
          if (e.key === 'Escape') {
            modal?.remove();
            document.removeEventListener('keydown', escapeHandler);
          }
        };
        document.addEventListener('keydown', escapeHandler);
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
        const loading = document.getElementById('pl-loading');
        const error = document.getElementById('pl-error');
        const content = document.getElementById('pl-content');

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
        const content = document.getElementById('pl-content');
        if (content) content.innerHTML = '';
      }
    }

    // Create global instance
    window.PerspectiveLensPanel = new AnalysisPanel();
    console.log('[PanelLoader] Global instance created successfully');

  } catch (error) {
    console.error('[PanelLoader] Failed to load modular panel system:', error);
    console.error('[PanelLoader] Falling back to legacy panel if available');
  }
})();
