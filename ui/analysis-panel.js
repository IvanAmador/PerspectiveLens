/**
 * PerspectiveLens Analysis Panel Controller
 * Manages UI state and displays comparative analysis results
 * Material Design 3 with SVG icons
 * 
 * VERSÃO ROBUSTA: Lida com múltiplos formatos de dados
 */
(function() {
  'use strict';

  // Check if already loaded
  if (window.PerspectiveLensPanel) {
    console.log('[PerspectiveLens] Analysis panel already loaded, skipping...');
    return;
  }

  // Icon library
  const PANEL_ICONS = {
    lens: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
    collapse: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`,
    expand: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    consensus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    dispute: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
    document: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`
  };

  class AnalysisPanel {
    constructor() {
      this.panel = null;
      this.isCollapsed = false;
      this.currentAnalysis = null;
      this.init();
    }

    init() {
      this.createPanel();
      this.attachEventListeners();
      console.log('[PerspectiveLens] Analysis panel initialized');
    }

    createPanel() {
      if (document.getElementById('perspectivelens-panel')) {
        this.panel = document.getElementById('perspectivelens-panel');
        return;
      }

      const panelHTML = `
        <div id="perspectivelens-panel" class="pl-panel">
          <div class="pl-panel-header">
            <div class="pl-panel-title">
              ${PANEL_ICONS.lens}
              <span>PerspectiveLens Analysis</span>
            </div>
            <button id="pl-toggle-btn" class="pl-btn-icon" aria-label="Toggle panel">
              ${PANEL_ICONS.collapse}
            </button>
          </div>

          <div class="pl-panel-body">
            <div id="pl-loading" class="pl-state" style="display: none;">
              <div class="pl-spinner"></div>
              <p>Analyzing perspectives...</p>
            </div>

            <div id="pl-error" class="pl-state pl-state-error" style="display: none;">
              ${PANEL_ICONS.error}
              <p id="pl-error-message">An error occurred</p>
              <button id="pl-retry-btn" class="pl-btn">Retry</button>
            </div>

            <div id="pl-analysis" class="pl-content" style="display: none;"></div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', panelHTML);
      this.panel = document.getElementById('perspectivelens-panel');
    }

    attachEventListeners() {
      const toggleBtn = document.getElementById('pl-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => this.toggle());
      }

      const retryBtn = document.getElementById('pl-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.retry());
      }
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
      console.log('[Panel] Raw data received:', data);

      this.currentAnalysis = data;
      this.show();

      document.getElementById('pl-loading').style.display = 'none';
      document.getElementById('pl-error').style.display = 'none';

      const analysisContainer = document.getElementById('pl-analysis');
      analysisContainer.style.display = 'block';
      analysisContainer.innerHTML = this.renderAnalysis(data);

      this.attachAnalysisEventListeners();
    }

    renderAnalysis(data) {
      return `
        ${data.summary ? this.renderSummary(data.summary) : ''}
        ${this.renderStats(data)}
        ${data.consensus?.length > 0 ? this.renderConsensus(data.consensus) : ''}
        ${data.key_differences?.length > 0 ? this.renderKeyDifferences(data.key_differences) : ''}
        ${this.renderFooter(data)}
      `;
    }

    renderSummary(summary) {
      if (!summary || typeof summary !== 'string') return '';
      return `
        <div class="pl-card pl-card-summary">
          <div class="pl-card-title">
            ${PANEL_ICONS.info}
            Story Summary
          </div>
          <div class="pl-main-story">${this.escapeHtml(summary)}</div>
        </div>
      `;
    }

    renderStats(data) {
      const stats = [
        { label: 'Consensus', value: data.consensus?.length || 0, color: 'green' },
        { label: 'Key Differences', value: data.key_differences?.length || 0, color: 'yellow' }
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

    renderConsensus(consensus) {
      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.consensus}
            Consensus
            <span class="pl-badge pl-badge-green">${consensus.length}</span>
          </div>
          <p class="pl-section-desc">Facts that 70% or more sources agree on</p>
          <div class="pl-list">
            ${consensus.map((item, idx) => this.renderConsensusItem(item, idx)).join('')}
          </div>
        </div>
      `;
    }

    renderConsensusItem(item, idx) {
      const fact = item.fact || 'No fact provided';
      const confidence = item.confidence || 'medium';
      const sources = Array.isArray(item.sources) ? item.sources : [];
      const sourcesList = sources.map(s => this.escapeHtml(String(s))).join(', ') || 'Unknown';

      return `
        <div class="pl-list-item pl-list-item-consensus" id="pl-item-consensus-${idx}">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(fact)}</div>
            <span class="pl-badge pl-tag-confidence-${confidence}">${confidence} confidence</span>
          </div>
          <div class="pl-list-item-meta">
            <strong>${sources.length} sources:</strong> ${sourcesList}
          </div>
        </div>
      `;
    }

    renderKeyDifferences(keyDifferences) {
      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.dispute}
            Key Differences
            <span class="pl-badge pl-badge-yellow">${keyDifferences.length}</span>
          </div>
          <p class="pl-section-desc">Significant differences that change reader perception</p>
          <div class="pl-list">
            ${keyDifferences.map((item, idx) => this.renderKeyDifferenceItem(item, idx)).join('')}
          </div>
        </div>
      `;
    }

    renderKeyDifferenceItem(item, idx) {
      const aspect = item.aspect || 'Unnamed difference';
      const pattern = item.pattern || 'coverage';
      const significance = item.significance || 'medium';
      const impact = item.impact || 'No impact description';

      // UPDATED: Handle new flattened structure (arrays at top level)
      const sourceGroups = [];
      if (item.emphasizing?.length) sourceGroups.push({ label: 'Emphasizing', sources: item.emphasizing, color: 'red' });
      if (item.minimizing?.length) sourceGroups.push({ label: 'Minimizing', sources: item.minimizing, color: 'blue' });
      if (item.neutral?.length) sourceGroups.push({ label: 'Neutral', sources: item.neutral, color: 'gray' });
      if (item.absent?.length) sourceGroups.push({ label: 'Absent', sources: item.absent, color: 'light' });

      return `
        <div class="pl-list-item pl-list-item-difference" id="pl-item-difference-${idx}">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(aspect)}</div>
            <span class="pl-badge pl-badge-${significance === 'high' ? 'red' : significance === 'medium' ? 'yellow' : 'light'}">${significance}</span>
          </div>
          <div class="pl-list-item-subtitle">
            <span class="pl-pattern-badge pl-pattern-${pattern}">${pattern}</span>
          </div>
          <div class="pl-list-item-content">${this.escapeHtml(impact)}</div>
          ${sourceGroups.length > 0 ? `
            <div class="pl-source-groups">
              ${sourceGroups.map(group => `
                <div class="pl-source-group">
                  <strong>${group.label}:</strong>
                  ${group.sources.map(s => `<span class="pl-tag pl-tag-${group.color}">${this.escapeHtml(s)}</span>`).join(' ')}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    renderFooter(data) {
      const sources = data.metadata?.sources_analyzed ||
                      (Array.isArray(data.perspectives) ? data.perspectives.map(p => p.source || p.name).filter(Boolean) : []);
      const timestamp = data.metadata?.analysis_timestamp || new Date().toISOString();

      const sourceList = sources.slice(0, 5).join(', ');
      const moreCount = Math.max(0, sources.length - 5);

      return `
        <div class="pl-footer">
          <p class="pl-sources-analyzed">
            <strong>Sources analyzed:</strong> ${sources.length || 0} source${sources.length !== 1 ? 's' : ''}
          </p>
          ${sourceList ? `<p class="pl-source-list">${sourceList}${moreCount > 0 ? ` and ${moreCount} more` : ''}</p>` : ''}
          <p class="pl-timestamp">Analysis completed at ${new Date(timestamp).toLocaleString()}</p>
        </div>
      `;
    }

    attachAnalysisEventListeners() {
      const listItems = document.querySelectorAll('.pl-list-item');
      listItems.forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
            return;
          }
          item.classList.toggle('pl-list-item-expanded');
        });
      });
    }

    retry() {
      window.dispatchEvent(new CustomEvent('perspectivelens:retry'));
      this.showLoading();
    }

    escapeHtml(text) {
      if (text === null || text === undefined) return '';
      const div = document.createElement('div');
      div.textContent = String(text);
      return div.innerHTML;
    }

    reset() {
      this.currentAnalysis = null;
      this.hide();

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

  window.PerspectiveLensPanel = {
    showAnalysis: (data) => getPanelInstance().showAnalysis(data),
    showError: (error) => getPanelInstance().showError(error),
    showLoading: () => getPanelInstance().showLoading(),
    hide: () => getPanelInstance().hide(),
    reset: () => getPanelInstance().reset()
  };

  console.log('[PerspectiveLens] Panel module loaded (ROBUST VERSION)');
})();