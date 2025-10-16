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
      const { summary, consensus, disputes, omissions, bias_indicators, perspectives } = data;

      return `
        ${summary ? this.renderSummary(summary) : ''}
        ${this.renderStats(data)}
        ${consensus && consensus.length > 0 ? this.renderConsensusSection(consensus) : ''}
        ${disputes && disputes.length > 0 ? this.renderDisputesSection(disputes) : ''}
        ${omissions && Object.keys(omissions).length > 0 ? this.renderOmissionsSection(omissions) : ''}
        ${bias_indicators && bias_indicators.length > 0 ? this.renderBiasSection(bias_indicators) : ''}
        ${perspectives ? this.renderFooter(perspectives) : ''}
      `;
    }

    renderSummary(summary) {
      if (!summary || !summary.main_story) return '';

      return `
        <div class="pl-card pl-card-summary">
          <div class="pl-card-title">
            ${PANEL_ICONS.info}
            Story Summary
          </div>
          <div class="pl-main-story">${this.escapeHtml(summary.main_story)}</div>
          ${summary.key_differences ? `
            <div class="pl-key-differences">
              <strong>Key Differences:</strong> ${this.escapeHtml(summary.key_differences)}
            </div>
          ` : ''}
          ${summary.recommendation ? `
            <div class="pl-recommendation">
              <strong>Recommendation:</strong> ${this.escapeHtml(summary.recommendation)}
            </div>
          ` : ''}
        </div>
      `;
    }

    renderStats(data) {
      const stats = [
        { label: 'Consensus', value: data.consensus?.length || 0, color: 'green' },
        { label: 'Disputes', value: data.disputes?.length || 0, color: 'yellow' },
        { label: 'Omissions', value: this.countOmissions(data.omissions), color: 'orange' },
        { label: 'Bias Signs', value: data.bias_indicators?.length || 0, color: 'red' }
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

    countOmissions(omissions) {
      if (!omissions) return 0;
      if (Array.isArray(omissions)) return omissions.length;
      return Object.values(omissions).reduce((total, arr) => {
        return total + (Array.isArray(arr) ? arr.length : 0);
      }, 0);
    }

    // ============ CONSENSUS SECTION ============
    renderConsensusSection(consensus) {
      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.consensus}
            Consensus
            <span class="pl-badge pl-badge-green">${consensus.length}</span>
          </div>
          <p class="pl-section-desc">Facts that all or most sources agree on</p>
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

    // ============ DISPUTES SECTION ============
    renderDisputesSection(disputes) {
      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.dispute}
            Disputes
            <span class="pl-badge pl-badge-yellow">${disputes.length}</span>
          </div>
          <p class="pl-section-desc">Topics where sources disagree</p>
          <div class="pl-list">
            ${disputes.map((item, idx) => this.renderDisputeItem(item, idx)).join('')}
          </div>
        </div>
      `;
    }

    renderDisputeItem(item, idx) {
      const topic = item.topic || 'Unnamed dispute';
      const significance = item.significance || 'minor';
      const perspectives = item.perspectives || {};

      // Perspectives é sempre um OBJETO com source names como keys
      const perspectivesHTML = Object.entries(perspectives)
        .map(([sourceName, data]) => `
          <div class="pl-perspective">
            <div class="pl-perspective-source">${this.escapeHtml(sourceName)}</div>
            <div class="pl-perspective-viewpoint">${this.escapeHtml(data.viewpoint || '')}</div>
            ${data.evidence ? `
              <blockquote class="pl-perspective-evidence">
                "${this.escapeHtml(data.evidence)}"
              </blockquote>
            ` : ''}
          </div>
        `).join('');

      const perspectiveCount = Object.keys(perspectives).length;

      return `
        <div class="pl-list-item pl-list-item-dispute" id="pl-item-dispute-${idx}">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(topic)}</div>
            <span class="pl-badge pl-badge-yellow">${significance} significance</span>
          </div>
          <div class="pl-list-item-subtitle">
            ${perspectiveCount} perspective${perspectiveCount !== 1 ? 's' : ''}
          </div>
          <div class="pl-list-item-details">
            <div class="pl-perspectives-list">
              ${perspectivesHTML || '<p class="pl-no-data">No perspectives available</p>'}
            </div>
          </div>
        </div>
      `;
    }

    // ============ OMISSIONS SECTION ============
    renderOmissionsSection(omissions) {
      if (!omissions || typeof omissions !== 'object') return '';

      const items = [];
      let counter = 0;

      // Omissions é sempre um objeto com source names como keys
      for (const [source, omittedFacts] of Object.entries(omissions)) {
        if (!Array.isArray(omittedFacts)) continue;

        omittedFacts.forEach((omission) => {
          items.push(this.renderOmissionItem(omission, source, counter));
          counter++;
        });
      }

      if (items.length === 0) return '';

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.document}
            Omissions
            <span class="pl-badge pl-badge-orange">${items.length}</span>
          </div>
          <p class="pl-section-desc">Information missing from some sources</p>
          <div class="pl-list">
            ${items.join('')}
          </div>
        </div>
      `;
    }

    renderOmissionItem(omission, omittedBy, idx) {
      const fact = omission.fact || 'No fact provided';
      const relevance = omission.relevance || 'low';
      const mentionedBy = Array.isArray(omission.mentioned_by) ? omission.mentioned_by : [];

      return `
        <div class="pl-list-item pl-list-item-omission" id="pl-item-omission-${idx}">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(fact)}</div>
            <span class="pl-badge pl-tag-confidence-${relevance}">${relevance} relevance</span>
          </div>
          <div class="pl-list-item-content">
            Omitted by <strong>${this.escapeHtml(String(omittedBy))}</strong>
          </div>
          ${mentionedBy.length > 0 ? `
            <div class="pl-list-item-meta">
              Mentioned by: ${mentionedBy.map(s => `<span class="pl-tag">${this.escapeHtml(String(s))}</span>`).join(' ')}
            </div>
          ` : ''}
        </div>
      `;
    }

    // ============ BIAS SECTION ============
    renderBiasSection(biasIndicators) {
      if (!biasIndicators || biasIndicators.length === 0) return '';

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.dispute}
            Bias Indicators
            <span class="pl-badge pl-badge-red">${biasIndicators.length}</span>
          </div>
          <p class="pl-section-desc">Potential signs of media bias</p>
          <div class="pl-list">
            ${biasIndicators.map((item, idx) => this.renderBiasItem(item, idx)).join('')}
          </div>
        </div>
      `;
    }

    renderBiasItem(item, idx) {
      const source = item.source || 'Unknown';
      const type = item.type || 'unspecified';
      const description = item.description || 'No description';
      const examples = Array.isArray(item.examples) ? item.examples : [];

      return `
        <div class="pl-list-item pl-list-item-bias" id="pl-item-bias-${idx}">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(source)}</div>
            <span class="pl-badge pl-badge-red">${this.escapeHtml(type)}</span>
          </div>
          <div class="pl-list-item-content">
            ${this.escapeHtml(description)}
          </div>
          ${examples.length > 0 ? `
            <ul class="pl-bias-examples">
              ${examples.map(ex => `<li>${this.escapeHtml(String(ex))}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }

    // ============ FOOTER ============
    renderFooter(perspectives) {
      if (!Array.isArray(perspectives) || perspectives.length === 0) {
        return `
          <div class="pl-footer">
            <p class="pl-sources-analyzed"><strong>Sources analyzed:</strong> No sources available</p>
            <p class="pl-timestamp">Analysis completed at ${new Date().toLocaleString()}</p>
          </div>
        `;
      }

      const sourceNames = perspectives
        .map(p => p.source || p.name)
        .filter(Boolean)
        .slice(0, 5)
        .join(', ');

      const moreCount = Math.max(0, perspectives.length - 5);

      return `
        <div class="pl-footer">
          <p class="pl-sources-analyzed">
            <strong>Sources analyzed:</strong> ${perspectives.length} source${perspectives.length !== 1 ? 's' : ''}
          </p>
          <p class="pl-source-list">${sourceNames}${moreCount > 0 ? ` and ${moreCount} more` : ''}</p>
          <p class="pl-timestamp">Analysis completed at ${new Date().toLocaleString()}</p>
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