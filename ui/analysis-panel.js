/**
 * PerspectiveLens Analysis Panel Controller
 * Manages UI state and displays comparative analysis results
 * Material Design 3 with SVG icons
 */

(function() {
  'use strict';

  // Check if already loaded
  if (window.PerspectiveLensPanel) {
    console.log('[PerspectiveLens] Analysis panel already loaded, skipping...');
    return;
  }

  // Icon library - panel-specific icons
  const PANEL_ICONS = {
    lens: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      <path d="M12 6L8 12L12 18M12 6L16 12L12 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    collapse: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    expand: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    error: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    consensus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    dispute: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    document: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2V8H20M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    empty: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    </svg>`
  };

  class AnalysisPanel {
    constructor() {
      this.panel = null;
      this.isCollapsed = true;
      this.currentAnalysis = null;
      this.init();
    }

    init() {
      this.createPanel();
      this.attachEventListeners();
      console.log('[PerspectiveLens] Analysis panel initialized');
    }

    createPanel() {
      // Check if panel already exists
      if (document.getElementById('perspectivelens-panel')) {
        this.panel = document.getElementById('perspectivelens-panel');
        return;
      }

      // Create panel HTML
      const panelHTML = `
        <div id="perspectivelens-panel" class="pl-panel pl-panel-collapsed">
          <div class="pl-panel-header">
            <div class="pl-panel-title">
              <div class="pl-panel-title-icon">${PANEL_ICONS.lens}</div>
              <h2>PerspectiveLens</h2>
            </div>
            <div class="pl-panel-actions">
              <button class="pl-icon-btn" id="pl-toggle-btn" aria-label="Toggle panel">
                ${PANEL_ICONS.collapse}
              </button>
            </div>
          </div>
          <div class="pl-panel-content" id="pl-panel-content">
            <div class="pl-loading" id="pl-loading">
              <div class="pl-spinner"></div>
              <p class="pl-loading-text">Analyzing perspectives...</p>
            </div>
            <div class="pl-error" id="pl-error" style="display: none;">
              <div class="pl-error-icon">${PANEL_ICONS.error}</div>
              <h3>Analysis Failed</h3>
              <p id="pl-error-message"></p>
              <button class="pl-btn-retry" id="pl-retry-btn">Retry Analysis</button>
            </div>
            <div class="pl-analysis" id="pl-analysis" style="display: none;"></div>
          </div>
        </div>
      `;

      // Inject into page
      document.body.insertAdjacentHTML('beforeend', panelHTML);
      this.panel = document.getElementById('perspectivelens-panel');
    }

    attachEventListeners() {
      // Toggle button
      const toggleBtn = document.getElementById('pl-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.toggle());
      }

      // Retry button
      const retryBtn = document.getElementById('pl-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.retry());
      }

      // Listen for messages from content script
      window.addEventListener('perspectivelens:showAnalysis', (event) => {
        this.showAnalysis(event.detail);
      });

      window.addEventListener('perspectivelens:showError', (event) => {
        this.showError(event.detail);
      });
    }

    show() {
      if (this.panel) {
        this.panel.classList.add('pl-panel-visible');
        this.isCollapsed = false;
        this.panel.classList.remove('pl-panel-collapsed');
        this.updateToggleIcon();
      }
    }

    hide() {
      if (this.panel) {
        this.panel.classList.remove('pl-panel-visible');
      }
    }

    toggle() {
      this.isCollapsed = !this.isCollapsed;
      this.panel.classList.toggle('pl-panel-collapsed', this.isCollapsed);
      this.updateToggleIcon();
    }

    updateToggleIcon() {
      const toggleBtn = document.getElementById('pl-toggle-btn');
      if (toggleBtn) {
        toggleBtn.innerHTML = this.isCollapsed ? PANEL_ICONS.expand : PANEL_ICONS.collapse;
      }
    }

    showLoading() {
      this.show();
      document.getElementById('pl-loading').style.display = 'flex';
      document.getElementById('pl-error').style.display = 'none';
      document.getElementById('pl-analysis').style.display = 'none';
    }

    showError(error) {
      this.show();
      document.getElementById('pl-loading').style.display = 'none';
      document.getElementById('pl-error').style.display = 'block';
      document.getElementById('pl-analysis').style.display = 'none';
      
      const errorMessage = document.getElementById('pl-error-message');
      if (errorMessage) {
        errorMessage.textContent = error.message || 'An unexpected error occurred';
      }
    }

    showAnalysis(data) {
      this.currentAnalysis = data;
      this.show();

      document.getElementById('pl-loading').style.display = 'none';
      document.getElementById('pl-error').style.display = 'none';
      
      const analysisContainer = document.getElementById('pl-analysis');
      analysisContainer.style.display = 'block';
      analysisContainer.innerHTML = this.renderAnalysis(data);

      // Attach event listeners to interactive elements
      this.attachAnalysisEventListeners();
    }

    renderAnalysis(data) {
      const { summary, consensus, disputes, omissions, bias, perspectives } = data;

      return `
        ${this.renderSummary(summary)}
        ${this.renderStats(data)}
        ${this.renderSection('Consensus Points', 'consensus', consensus, PANEL_ICONS.consensus)}
        ${this.renderSection('Disputed Points', 'dispute', disputes, PANEL_ICONS.dispute)}
        ${this.renderSection('Notable Omissions', 'omission', omissions, PANEL_ICONS.document)}
        ${this.renderSection('Bias Indicators', 'bias', bias, PANEL_ICONS.dispute)}
        ${this.renderFooter(perspectives)}
      `;
    }

    renderSummary(summary) {
      if (!summary) return '';

      return `
        <div class="pl-card pl-card-summary">
          <div class="pl-card-title">
            ${PANEL_ICONS.info}
            Summary
          </div>
          <div class="pl-main-story">${this.escapeHtml(summary.main_story || 'N/A')}</div>
          ${summary.key_differences ? `
            <div class="pl-key-differences">${this.escapeHtml(summary.key_differences)}</div>
          ` : ''}
        </div>
      `;
    }

    renderStats(data) {
      const stats = [
        { label: 'Consensus', value: data.consensus?.length || 0, color: 'green' },
        { label: 'Disputes', value: data.disputes?.length || 0, color: 'yellow' },
        { label: 'Omissions', value: data.omissions?.length || 0, color: 'orange' },
        { label: 'Bias', value: data.bias?.length || 0, color: 'red' }
      ];

      return `
        <div class="pl-stats-bar">
          ${stats.map(stat => `
            <div class="pl-stat">
              <span class="pl-stat-value">${stat.value}</span>
              <span class="pl-stat-label">${stat.label}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    renderSection(title, type, items, icon) {
      if (!items || items.length === 0) {
        return `<div class="pl-section" data-empty="true"></div>`;
      }

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${icon}
            ${title}
            <span class="pl-badge pl-badge-${this.getColorForType(type)}">${items.length}</span>
          </div>
          <div class="pl-list">
            ${items.map((item, idx) => this.renderListItem(item, type, idx)).join('')}
          </div>
        </div>
      `;
    }

    renderListItem(item, type, idx) {
      const itemId = `pl-item-${type}-${idx}`;
      
      return `
        <div class="pl-list-item pl-list-item-${type}" id="${itemId}">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(item.point || item.topic || 'N/A')}</div>
            ${item.confidence ? `
              <span class="pl-badge pl-tag-confidence-${item.confidence}">${item.confidence}</span>
            ` : ''}
          </div>
          ${item.description ? `
            <div class="pl-list-item-content">${this.escapeHtml(item.description)}</div>
          ` : ''}
          ${item.sources && item.sources.length > 0 ? `
            <div class="pl-list-item-meta">
              ${item.sources.map(source => `
                <span class="pl-tag">${this.escapeHtml(source)}</span>
              `).join('')}
            </div>
          ` : ''}
          ${item.perspectives && item.perspectives.length > 0 ? `
            <div class="pl-list-item-details">
              <div class="pl-perspectives-list">
                ${item.perspectives.map(p => `
                  <div class="pl-perspective">
                    <div class="pl-perspective-source">${this.escapeHtml(p.source)}</div>
                    <div class="pl-perspective-text">${this.escapeHtml(p.text)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    renderFooter(perspectives) {
      const sources = perspectives?.length || 0;
      const timestamp = new Date().toLocaleString();

      return `
        <div class="pl-footer">
          <div class="pl-sources-analyzed">
            <strong>${sources}</strong> sources analyzed
          </div>
          <div class="pl-timestamp">
            Generated on ${timestamp}
          </div>
        </div>
      `;
    }

    attachAnalysisEventListeners() {
      // Add click handlers to expand list items
      const listItems = document.querySelectorAll('.pl-list-item');
      listItems.forEach(item => {
        item.addEventListener('click', (e) => {
          // Don't toggle if clicking on a link or button
          if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
            return;
          }
          item.classList.toggle('pl-list-item-expanded');
        });
      });
    }

    getColorForType(type) {
      const colorMap = {
        consensus: 'green',
        dispute: 'yellow',
        omission: 'orange',
        bias: 'red'
      };
      return colorMap[type] || 'green';
    }

    retry() {
      // Dispatch event to content script to retry analysis
      window.dispatchEvent(new CustomEvent('perspectivelens:retry'));
      this.showLoading();
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    reset() {
      this.currentAnalysis = null;
      this.hide();
      
      // Reset content
      document.getElementById('pl-loading').style.display = 'flex';
      document.getElementById('pl-error').style.display = 'none';
      document.getElementById('pl-analysis').style.display = 'none';
    }
  }

  // Initialize and export
  let panelInstance = null;

  function getPanelInstance() {
    if (!panelInstance) {
      panelInstance = new AnalysisPanel();
    }
    return panelInstance;
  }

  // Export
  window.PerspectiveLensPanel = {
    getInstance: getPanelInstance,
    show: () => getPanelInstance().show(),
    hide: () => getPanelInstance().hide(),
    toggle: () => getPanelInstance().toggle(),
    showLoading: () => getPanelInstance().showLoading(),
    showError: (error) => getPanelInstance().showError(error),
    showAnalysis: (data) => getPanelInstance().showAnalysis(data),
    reset: () => getPanelInstance().reset()
  };

  console.log('[PerspectiveLens] Analysis panel module loaded');
})();
