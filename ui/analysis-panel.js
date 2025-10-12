/**
 * PerspectiveLens Analysis Panel Controller
 * Manages UI state and displays comparative analysis results
 */

class AnalysisPanel {
  constructor() {
    this.panel = null;
    this.isExpanded = false;
    this.currentAnalysis = null;
    this.init();
  }

  init() {
    // Create panel elements if not exists
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

    // Load panel HTML
    const panelHTML = `
      <div id="perspectivelens-panel" class="pl-panel pl-panel-collapsed">
        <div class="pl-panel-header">
          <div class="pl-panel-title">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="white" opacity="0.2"/>
              <path d="M16 8L12 16L16 24M16 8L20 16L16 24" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h2>PerspectiveLens</h2>
          </div>
          <button class="pl-toggle-btn" id="pl-toggle-btn" aria-label="Toggle panel">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
        <div class="pl-panel-content" id="pl-panel-content">
          <div class="pl-loading" id="pl-loading">
            <div class="pl-spinner"></div>
            <p>Analyzing perspectives...</p>
          </div>
          <div class="pl-error" id="pl-error" style="display: none;">
            <div class="pl-error-icon">⚠️</div>
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

    // Listen for analysis results from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ANALYSIS_COMPLETE') {
        this.showAnalysis(message.data);
      } else if (message.type === 'ANALYSIS_FAILED') {
        this.showError(message.error);
      } else if (message.type === 'ANALYSIS_STARTED') {
        this.showLoading();
        this.expand();
      }
    });
  }

  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  expand() {
    this.panel.classList.remove('pl-panel-collapsed');
    this.isExpanded = true;
  }

  collapse() {
    this.panel.classList.add('pl-panel-collapsed');
    this.isExpanded = false;
  }

  showLoading() {
    document.getElementById('pl-loading').style.display = 'flex';
    document.getElementById('pl-error').style.display = 'none';
    document.getElementById('pl-analysis').style.display = 'none';
  }

  showError(error) {
    document.getElementById('pl-loading').style.display = 'none';
    document.getElementById('pl-error').style.display = 'block';
    document.getElementById('pl-analysis').style.display = 'none';
    document.getElementById('pl-error-message').textContent =
      error?.message || 'Unable to complete analysis. Please try again.';
  }

  showAnalysis(analysisData) {
    this.currentAnalysis = analysisData;

    document.getElementById('pl-loading').style.display = 'none';
    document.getElementById('pl-error').style.display = 'none';
    document.getElementById('pl-analysis').style.display = 'block';

    this.renderAnalysis(analysisData);
    this.expand(); // Auto-expand when analysis is ready
  }

  renderAnalysis(data) {
    const { analysis, perspectives } = data;

    if (!analysis) {
      this.showError({ message: 'No analysis data available' });
      return;
    }

    const analysisContainer = document.getElementById('pl-analysis');

    // Update stats
    document.getElementById('pl-consensus-count').textContent = analysis.consensus?.length || 0;
    document.getElementById('pl-disputes-count').textContent = analysis.disputes?.length || 0;
    document.getElementById('pl-omissions-count').textContent =
      Object.keys(analysis.omissions || {}).reduce((sum, key) => sum + analysis.omissions[key].length, 0);
    document.getElementById('pl-bias-count').textContent = analysis.bias_indicators?.length || 0;

    // Render summary
    this.renderSummary(analysis.summary);

    // Render sections
    this.renderConsensus(analysis.consensus);
    this.renderDisputes(analysis.disputes);
    this.renderOmissions(analysis.omissions);
    this.renderBiasIndicators(analysis.bias_indicators);

    // Render footer
    this.renderFooter(perspectives);
  }

  renderSummary(summary) {
    const html = `
      <div class="pl-card pl-card-summary">
        <h3 class="pl-card-title">
          <span class="pl-icon-emoji">📊</span>
          Story Summary
        </h3>
        <p class="pl-main-story">${this.escapeHtml(summary?.main_story || 'N/A')}</p>
        <p class="pl-key-differences">${this.escapeHtml(summary?.key_differences || '')}</p>
        ${summary?.recommendation ? `
          <p class="pl-key-differences" style="margin-top: 10px; font-style: italic;">
            💡 ${this.escapeHtml(summary.recommendation)}
          </p>
        ` : ''}
      </div>

      <!-- Stats bar -->
      <div class="pl-stats-bar">
        <div class="pl-stat">
          <span class="pl-stat-value" id="pl-consensus-count">0</span>
          <span class="pl-stat-label">Consensus</span>
        </div>
        <div class="pl-stat">
          <span class="pl-stat-value" id="pl-disputes-count">0</span>
          <span class="pl-stat-label">Disputes</span>
        </div>
        <div class="pl-stat">
          <span class="pl-stat-value" id="pl-omissions-count">0</span>
          <span class="pl-stat-label">Omissions</span>
        </div>
        <div class="pl-stat">
          <span class="pl-stat-value" id="pl-bias-count">0</span>
          <span class="pl-stat-label">Bias Signs</span>
        </div>
      </div>
    `;

    const container = document.getElementById('pl-analysis');
    container.innerHTML = html;
  }

  renderConsensus(consensus) {
    if (!consensus || consensus.length === 0) {
      this.appendSection('consensus', [], true);
      return;
    }

    const items = consensus.map(item => `
      <div class="pl-list-item pl-list-item-consensus">
        <div class="pl-list-item-header">
          <div class="pl-list-item-title">${this.escapeHtml(item.fact)}</div>
        </div>
        <div class="pl-list-item-meta">
          <span class="pl-tag pl-tag-confidence-${item.confidence}">${item.confidence} confidence</span>
          <span class="pl-tag">${item.sources?.length || 0} sources</span>
        </div>
      </div>
    `).join('');

    this.appendSection('consensus', items, false);
  }

  renderDisputes(disputes) {
    if (!disputes || disputes.length === 0) {
      this.appendSection('disputes', [], true);
      return;
    }

    const items = disputes.map((dispute, idx) => {
      const perspectives = Object.entries(dispute.perspectives || {})
        .map(([source, data]) => `
          <div class="pl-perspective">
            <div class="pl-perspective-source">${this.escapeHtml(source)}</div>
            <div class="pl-perspective-text">${this.escapeHtml(data.viewpoint)}</div>
            ${data.evidence ? `<div class="pl-perspective-text" style="margin-top: 4px; font-style: italic;">"${this.escapeHtml(data.evidence)}"</div>` : ''}
          </div>
        `).join('');

      return `
        <div class="pl-list-item pl-list-item-dispute" onclick="this.classList.toggle('pl-list-item-expanded')">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(dispute.topic)}</div>
          </div>
          <div class="pl-list-item-meta">
            <span class="pl-tag pl-badge-yellow">${dispute.significance} significance</span>
            <span class="pl-tag">${Object.keys(dispute.perspectives || {}).length} perspectives</span>
          </div>
          <div class="pl-list-item-details">
            <div class="pl-perspectives-list">
              ${perspectives}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.appendSection('disputes', items, false);
  }

  renderOmissions(omissions) {
    if (!omissions || Object.keys(omissions).length === 0) {
      this.appendSection('omissions', [], true);
      return;
    }

    const items = [];
    for (const [source, omittedFacts] of Object.entries(omissions)) {
      omittedFacts.forEach(omission => {
        items.push(`
          <div class="pl-list-item pl-list-item-omission">
            <div class="pl-list-item-header">
              <div class="pl-list-item-title">${this.escapeHtml(omission.fact)}</div>
            </div>
            <div class="pl-list-item-content">
              Omitted by: <strong>${this.escapeHtml(source)}</strong>
            </div>
            <div class="pl-list-item-meta">
              <span class="pl-tag pl-tag-confidence-${omission.relevance === 'high' ? 'low' : omission.relevance === 'medium' ? 'medium' : 'high'}">
                ${omission.relevance} relevance
              </span>
              <span class="pl-tag">Mentioned by ${omission.mentioned_by?.length || 0} sources</span>
            </div>
          </div>
        `);
      });
    }

    this.appendSection('omissions', items.join(''), false);
  }

  renderBiasIndicators(indicators) {
    if (!indicators || indicators.length === 0) {
      this.appendSection('bias', [], true);
      return;
    }

    const items = indicators.map(indicator => {
      const examples = indicator.examples?.map(ex =>
        `<div class="pl-perspective-text" style="font-style: italic;">"${this.escapeHtml(ex)}"</div>`
      ).join('') || '';

      return `
        <div class="pl-list-item pl-list-item-bias" onclick="this.classList.toggle('pl-list-item-expanded')">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(indicator.source)}</div>
          </div>
          <div class="pl-list-item-content">${this.escapeHtml(indicator.description)}</div>
          <div class="pl-list-item-meta">
            <span class="pl-tag pl-badge-red">${indicator.type}</span>
          </div>
          ${examples ? `
            <div class="pl-list-item-details">
              <strong style="font-size: 12px; color: #6b7280;">Examples:</strong>
              ${examples}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    this.appendSection('bias', items, false);
  }

  appendSection(type, content, isEmpty) {
    const titles = {
      consensus: { icon: '✅', title: 'Consensus', desc: 'Facts that all or most sources agree on' },
      disputes: { icon: '⚠️', title: 'Disputes', desc: 'Topics where sources disagree' },
      omissions: { icon: '🔍', title: 'Omissions', desc: 'Information missing from some sources' },
      bias: { icon: '🎯', title: 'Bias Indicators', desc: 'Potential signs of media bias' }
    };

    const config = titles[type];
    const badgeColors = { consensus: 'green', disputes: 'yellow', omissions: 'orange', bias: 'red' };

    const html = `
      <div class="pl-section" id="pl-${type}-section" data-empty="${isEmpty}">
        <h3 class="pl-section-title">
          <span class="pl-icon-emoji">${config.icon}</span>
          ${config.title}
          <span class="pl-badge pl-badge-${badgeColors[type]}" id="pl-${type}-badge">0</span>
        </h3>
        <div class="pl-section-desc">${config.desc}</div>
        <div id="pl-${type}-list" class="pl-list">
          ${isEmpty ? `
            <div class="pl-empty">
              <div class="pl-empty-text">No ${type} found</div>
            </div>
          ` : content}
        </div>
      </div>
    `;

    document.getElementById('pl-analysis').insertAdjacentHTML('beforeend', html);
  }

  renderFooter(perspectives) {
    const sources = perspectives
      ?.filter(p => p.contentExtracted)
      ?.map(p => p.source)
      ?.join(', ') || 'Unknown';

    const html = `
      <div class="pl-footer">
        <div class="pl-sources-analyzed">
          <strong>Sources analyzed:</strong> ${this.escapeHtml(sources)}
        </div>
        <div class="pl-timestamp">
          Analysis completed at ${new Date().toLocaleTimeString()}
        </div>
      </div>
    `;

    document.getElementById('pl-analysis').insertAdjacentHTML('beforeend', html);
  }

  retry() {
    // Request new analysis from background
    chrome.runtime.sendMessage({ type: 'RETRY_ANALYSIS' });
    this.showLoading();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.perspectiveLensPanel = new AnalysisPanel();
  });
} else {
  window.perspectiveLensPanel = new AnalysisPanel();
}

export default AnalysisPanel;
