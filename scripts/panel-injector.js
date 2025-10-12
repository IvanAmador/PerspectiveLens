/**
 * Panel Injector Content Script
 * Injects the analysis panel into news article pages
 */

console.log('[PerspectiveLens] Panel injector loaded');

// Inject CSS
const linkElement = document.createElement('link');
linkElement.rel = 'stylesheet';
linkElement.href = chrome.runtime.getURL('ui/analysis-panel.css');
document.head.appendChild(linkElement);

// Inject panel HTML structure
function injectPanel() {
  // Check if panel already exists
  if (document.getElementById('perspectivelens-panel')) {
    console.log('[PerspectiveLens] Panel already injected');
    return;
  }

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

  document.body.insertAdjacentHTML('beforeend', panelHTML);
  console.log('[PerspectiveLens] Panel injected successfully');

  // Attach event listeners
  attachEventListeners();
}

// Panel controller
const PanelController = {
  isExpanded: false,
  currentAnalysis: null,

  toggle() {
    const panel = document.getElementById('perspectivelens-panel');
    if (this.isExpanded) {
      panel.classList.add('pl-panel-collapsed');
      this.isExpanded = false;
    } else {
      panel.classList.remove('pl-panel-collapsed');
      this.isExpanded = true;
    }
  },

  expand() {
    const panel = document.getElementById('perspectivelens-panel');
    panel.classList.remove('pl-panel-collapsed');
    this.isExpanded = true;
  },

  showLoading() {
    document.getElementById('pl-loading').style.display = 'flex';
    document.getElementById('pl-error').style.display = 'none';
    document.getElementById('pl-analysis').style.display = 'none';
    this.expand();
  },

  showError(error) {
    document.getElementById('pl-loading').style.display = 'none';
    document.getElementById('pl-error').style.display = 'block';
    document.getElementById('pl-analysis').style.display = 'none';
    document.getElementById('pl-error-message').textContent =
      error?.message || 'Unable to complete analysis. Please try again.';
  },

  showAnalysis(data) {
    this.currentAnalysis = data;
    document.getElementById('pl-loading').style.display = 'none';
    document.getElementById('pl-error').style.display = 'none';
    document.getElementById('pl-analysis').style.display = 'block';

    this.renderAnalysis(data);
    this.expand();
  },

  renderAnalysis(data) {
    const { analysis, perspectives } = data;

    if (!analysis) {
      this.showError({ message: 'No analysis data available' });
      return;
    }

    // Build HTML
    let html = this.buildSummarySection(analysis.summary);
    html += this.buildStatsBar(analysis);
    html += this.buildConsensusSection(analysis.consensus);
    html += this.buildDisputesSection(analysis.disputes);
    html += this.buildOmissionsSection(analysis.omissions);
    html += this.buildBiasSection(analysis.bias_indicators);
    html += this.buildFooter(perspectives);

    document.getElementById('pl-analysis').innerHTML = html;

    // Update stats after rendering
    this.updateStats(analysis);

    // Attach click handlers for expandable items
    this.attachExpandHandlers();
  },

  buildSummarySection(summary) {
    return `
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
    `;
  },

  buildStatsBar(analysis) {
    return `
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
  },

  buildConsensusSection(consensus) {
    if (!consensus || consensus.length === 0) {
      return this.buildEmptySection('consensus', '✅', 'Consensus', 'Facts that all or most sources agree on');
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

    return this.buildSection('consensus', '✅', 'Consensus', 'Facts that all or most sources agree on', items, 'green');
  },

  buildDisputesSection(disputes) {
    if (!disputes || disputes.length === 0) {
      return this.buildEmptySection('disputes', '⚠️', 'Disputes', 'Topics where sources disagree');
    }

    const items = disputes.map(dispute => {
      const perspectives = Object.entries(dispute.perspectives || {})
        .map(([source, data]) => `
          <div class="pl-perspective">
            <div class="pl-perspective-source">${this.escapeHtml(source)}</div>
            <div class="pl-perspective-text">${this.escapeHtml(data.viewpoint)}</div>
            ${data.evidence ? `<div class="pl-perspective-text" style="margin-top: 4px; font-style: italic;">"${this.escapeHtml(data.evidence)}"</div>` : ''}
          </div>
        `).join('');

      return `
        <div class="pl-list-item pl-list-item-dispute pl-expandable">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(dispute.topic)}</div>
          </div>
          <div class="pl-list-item-meta">
            <span class="pl-tag pl-badge-yellow">${dispute.significance} significance</span>
            <span class="pl-tag">${Object.keys(dispute.perspectives || {}).length} perspectives</span>
          </div>
          <div class="pl-list-item-details">
            <div class="pl-perspectives-list">${perspectives}</div>
          </div>
        </div>
      `;
    }).join('');

    return this.buildSection('disputes', '⚠️', 'Disputes', 'Topics where sources disagree', items, 'yellow');
  },

  buildOmissionsSection(omissions) {
    if (!omissions || Object.keys(omissions).length === 0) {
      return this.buildEmptySection('omissions', '🔍', 'Omissions', 'Information missing from some sources');
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
              <span class="pl-tag pl-tag-confidence-${this.relevanceToClass(omission.relevance)}">
                ${omission.relevance} relevance
              </span>
              <span class="pl-tag">Mentioned by ${omission.mentioned_by?.length || 0} sources</span>
            </div>
          </div>
        `);
      });
    }

    return this.buildSection('omissions', '🔍', 'Omissions', 'Information missing from some sources', items.join(''), 'orange');
  },

  buildBiasSection(indicators) {
    if (!indicators || indicators.length === 0) {
      return this.buildEmptySection('bias', '🎯', 'Bias Indicators', 'Potential signs of media bias');
    }

    const items = indicators.map(indicator => {
      const examples = indicator.examples?.map(ex =>
        `<div class="pl-perspective-text" style="font-style: italic;">"${this.escapeHtml(ex)}"</div>`
      ).join('') || '';

      return `
        <div class="pl-list-item pl-list-item-bias pl-expandable">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(indicator.source)}</div>
          </div>
          <div class="pl-list-item-content">${this.escapeHtml(indicator.description)}</div>
          <div class="pl-list-item-meta">
            <span class="pl-tag pl-badge-red">${indicator.type}</span>
          </div>
          ${examples ? `
            <div class="pl-list-item-details">
              <strong style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 8px;">Examples:</strong>
              ${examples}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return this.buildSection('bias', '🎯', 'Bias Indicators', 'Potential signs of media bias', items, 'red');
  },

  buildSection(id, icon, title, desc, content, badgeColor) {
    return `
      <div class="pl-section" id="pl-${id}-section">
        <h3 class="pl-section-title">
          <span class="pl-icon-emoji">${icon}</span>
          ${title}
          <span class="pl-badge pl-badge-${badgeColor}" id="pl-${id}-badge">0</span>
        </h3>
        <div class="pl-section-desc">${desc}</div>
        <div id="pl-${id}-list" class="pl-list">${content}</div>
      </div>
    `;
  },

  buildEmptySection(id, icon, title, desc) {
    return `
      <div class="pl-section" id="pl-${id}-section" data-empty="true">
        <h3 class="pl-section-title">
          <span class="pl-icon-emoji">${icon}</span>
          ${title}
        </h3>
      </div>
    `;
  },

  buildFooter(perspectives) {
    const sources = perspectives
      ?.filter(p => p.contentExtracted)
      ?.map(p => p.source)
      ?.slice(0, 5)
      ?.join(', ') || 'Unknown';

    const moreCount = (perspectives?.filter(p => p.contentExtracted)?.length || 0) - 5;

    return `
      <div class="pl-footer">
        <div class="pl-sources-analyzed">
          <strong>Sources analyzed:</strong> ${this.escapeHtml(sources)}${moreCount > 0 ? ` and ${moreCount} more` : ''}
        </div>
        <div class="pl-timestamp">
          Analysis completed at ${new Date().toLocaleTimeString()}
        </div>
      </div>
    `;
  },

  updateStats(analysis) {
    document.getElementById('pl-consensus-count').textContent = analysis.consensus?.length || 0;
    document.getElementById('pl-disputes-count').textContent = analysis.disputes?.length || 0;
    document.getElementById('pl-omissions-count').textContent =
      Object.values(analysis.omissions || {}).reduce((sum, arr) => sum + arr.length, 0);
    document.getElementById('pl-bias-count').textContent = analysis.bias_indicators?.length || 0;

    // Update badges
    document.getElementById('pl-consensus-badge').textContent = analysis.consensus?.length || 0;
    document.getElementById('pl-disputes-badge').textContent = analysis.disputes?.length || 0;
    document.getElementById('pl-omissions-badge').textContent =
      Object.values(analysis.omissions || {}).reduce((sum, arr) => sum + arr.length, 0);
    document.getElementById('pl-bias-badge').textContent = analysis.bias_indicators?.length || 0;
  },

  attachExpandHandlers() {
    document.querySelectorAll('.pl-expandable').forEach(item => {
      item.addEventListener('click', function() {
        this.classList.toggle('pl-list-item-expanded');
      });
    });
  },

  relevanceToClass(relevance) {
    if (relevance === 'high') return 'low';
    if (relevance === 'medium') return 'medium';
    return 'high';
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

function attachEventListeners() {
  // Toggle button
  const toggleBtn = document.getElementById('pl-toggle-btn');
  toggleBtn?.addEventListener('click', () => PanelController.toggle());

  // Retry button
  const retryBtn = document.getElementById('pl-retry-btn');
  retryBtn?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RETRY_ANALYSIS' });
    PanelController.showLoading();
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[PerspectiveLens] Panel-injector received message:', message.type);

  try {
    if (message.type === 'SHOW_ANALYSIS') {
      console.log('[PerspectiveLens] Showing analysis with data:', message.data);
      PanelController.showAnalysis(message.data);
      sendResponse({ success: true });
    } else if (message.type === 'ANALYSIS_STARTED') {
      console.log('[PerspectiveLens] Showing loading state');
      PanelController.showLoading();
      sendResponse({ success: true });
    } else if (message.type === 'ANALYSIS_FAILED') {
      console.log('[PerspectiveLens] Showing error:', message.error);
      PanelController.showError(message.error);
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('[PerspectiveLens] Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }

  return true; // Keep the message channel open for async response
});

// Inject panel when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPanel);
} else {
  injectPanel();
}
