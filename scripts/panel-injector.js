/**
 * Panel Injector Content Script - ADAPTED TO REAL BACKEND STRUCTURE
 * Works with the ACTUAL data structure from background.js
 */

console.log('[PerspectiveLens] Panel injector loaded');

function injectPanel() {
  if (document.getElementById('perspectivelens-panel')) {
    console.log('[PerspectiveLens] Panel already injected');
    return;
  }

  const panelHTML = `
    <div id="perspectivelens-panel" class="pl-panel">
      <!-- Aba lateral para expandir quando minimizado (estilo Chrome DevTools) -->
      <div class="pl-panel-tab" id="pl-expand-tab">
        <div class="pl-panel-tab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" opacity="0.2"/>
            <path d="M12 6L9 12L12 18M12 6L15 12L12 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="pl-panel-tab-text">Perspectives</span>
      </div>

      <div class="pl-panel-header">
        <div class="pl-panel-title">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="currentColor" opacity="0.2"/>
            <path d="M16 8L12 16L16 24M16 8L20 16L16 24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <h2>PerspectiveLens</h2>
        </div>
        <div class="pl-panel-actions">
          <button class="pl-icon-btn" id="pl-toggle-btn" title="Minimize panel">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="pl-icon-btn" id="pl-close-btn" title="Close panel">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
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
  attachEventListeners();
}

const PanelController = {
  isExpanded: true,
  currentAnalysis: null,

  toggle() {
    const panel = document.getElementById('perspectivelens-panel');
    const toggleBtn = document.getElementById('pl-toggle-btn');

    if (this.isExpanded) {
      panel.classList.add('pl-panel-collapsed');
      this.isExpanded = false;
      if (toggleBtn) {
        toggleBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `;
        toggleBtn.title = 'Expand panel';
      }
    } else {
      panel.classList.remove('pl-panel-collapsed');
      this.isExpanded = true;
      if (toggleBtn) {
        toggleBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        `;
        toggleBtn.title = 'Minimize panel';
      }
    }
  },

  expand() {
    if (!this.isExpanded) {
      this.toggle();
    }
  },

  hide() {
    const panel = document.getElementById('perspectivelens-panel');
    if (panel) {
      panel.classList.remove('pl-panel-visible');
    }
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

    const panel = document.getElementById('perspectivelens-panel');
    if (panel) {
      panel.classList.add('pl-panel-visible');
    }

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

    let html = this.buildSummarySection(analysis);
    html += this.buildStatsBar(analysis);
    html += this.buildConsensusSection(analysis.consensus);
    html += this.buildDisputesSection(analysis.disputes);
    html += this.buildOmissionsSection(analysis.omissions);
    html += this.buildBiasSection(analysis.bias_indicators);
    html += this.buildFooter(perspectives);

    document.getElementById('pl-analysis').innerHTML = html;
    this.attachExpandHandlers();
  },

  buildSummarySection(analysis) {
    // ADAPTADO: main_story está direto no analysis, não em analysis.summary
    const mainStory = analysis.main_story || analysis.summary?.main_story;

    if (!mainStory) {
      return '';
    }

    return `
      <div class="pl-card pl-card-summary">
        <h3 class="pl-card-title">
          <span class="pl-icon-emoji">📊</span>
          Story Summary
        </h3>
        <p class="pl-main-story">${this.escapeHtml(mainStory)}</p>
      </div>
    `;
  },

  buildStatsBar(analysis) {
    const consensusCount = analysis.consensus?.length || 0;
    const disputesCount = analysis.disputes?.length || 0;
    const omissionsCount = Object.values(analysis.omissions || {})
      .reduce((sum, arr) => sum + arr.length, 0);
    const biasCount = analysis.bias_indicators?.length || 0;

    return `
      <div class="pl-stats-bar">
        <div class="pl-stat">
          <span class="pl-stat-value">${consensusCount}</span>
          <span class="pl-stat-label">Consensus</span>
        </div>
        <div class="pl-stat">
          <span class="pl-stat-value">${disputesCount}</span>
          <span class="pl-stat-label">Disputes</span>
        </div>
        <div class="pl-stat">
          <span class="pl-stat-value">${omissionsCount}</span>
          <span class="pl-stat-label">Omissions</span>
        </div>
        <div class="pl-stat">
          <span class="pl-stat-value">${biasCount}</span>
          <span class="pl-stat-label">Bias Signs</span>
        </div>
      </div>
    `;
  },

  buildConsensusSection(consensus) {
    if (!consensus || consensus.length === 0) {
      return '';
    }

    // CORRIGIDO: backend usa 'point' não 'fact'
    const items = consensus.map(item => `
      <div class="pl-list-item pl-list-item-consensus">
        <div class="pl-list-item-header">
          <div class="pl-list-item-title">${this.escapeHtml(item.point || item.fact)}</div>
        </div>
        <div class="pl-list-item-meta">
          <span class="pl-tag pl-tag-confidence-${item.confidence || 'medium'}">
            ${item.confidence || 'medium'} confidence
          </span>
          <span class="pl-tag">${item.sources?.length || 0} sources</span>
        </div>
      </div>
    `).join('');

    return this.buildSection('consensus', '✅', 'Consensus', 
      'Facts that all or most sources agree on', items, 'green', consensus.length);
  },

  buildDisputesSection(disputes) {
    if (!disputes || disputes.length === 0) {
      return '';
    }

    // CORRIGIDO: backend usa perspectives como ARRAY não OBJETO
    const items = disputes.map(dispute => {
      const perspectives = (dispute.perspectives || [])
        .map(persp => `
          <div class="pl-perspective">
            <div class="pl-perspective-source">${this.escapeHtml(persp.source)}</div>
            <div class="pl-perspective-text"><strong>View:</strong> ${this.escapeHtml(persp.viewpoint)}</div>
            ${persp.evidence ? `
              <div class="pl-perspective-text" style="margin-top: 4px; font-style: italic;">
                <strong>Evidence:</strong> "${this.escapeHtml(persp.evidence)}"
              </div>
            ` : ''}
          </div>
        `).join('');

      return `
        <div class="pl-list-item pl-list-item-dispute pl-expandable">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(dispute.topic)}</div>
            <span class="pl-expand-icon">▼</span>
          </div>
          <div class="pl-list-item-meta">
            <span class="pl-tag pl-badge-${dispute.significance === 'major' ? 'red' : 'yellow'}">
              ${dispute.significance || 'minor'} significance
            </span>
            <span class="pl-tag">${dispute.perspectives?.length || 0} perspectives</span>
          </div>
          <div class="pl-list-item-details">
            <strong style="display: block; margin-bottom: 8px; font-size: 12px; color: #6b7280;">
              Different Perspectives:
            </strong>
            <div class="pl-perspectives-list">${perspectives}</div>
          </div>
        </div>
      `;
    }).join('');

    return this.buildSection('disputes', '⚠️', 'Disputes', 
      'Topics where sources disagree', items, 'yellow', disputes.length);
  },

  buildOmissionsSection(omissions) {
    if (!omissions || Object.keys(omissions).length === 0) {
      return '';
    }

    const items = [];
    let totalCount = 0;

    for (const [source, omittedFacts] of Object.entries(omissions)) {
      if (!Array.isArray(omittedFacts)) continue;

      omittedFacts.forEach(omission => {
        totalCount++;
        items.push(`
          <div class="pl-list-item pl-list-item-omission">
            <div class="pl-list-item-header">
              <div class="pl-list-item-title">${this.escapeHtml(omission.fact || omission.point)}</div>
            </div>
            <div class="pl-list-item-content">
              <strong>Omitted by:</strong> ${this.escapeHtml(source)}
            </div>
            <div class="pl-list-item-meta">
              <span class="pl-tag pl-tag-confidence-${this.relevanceToClass(omission.relevance)}">
                ${omission.relevance || 'low'} relevance
              </span>
              <span class="pl-tag">
                Mentioned by ${omission.mentioned_by?.length || 0} source(s)
              </span>
            </div>
          </div>
        `);
      });
    }

    if (items.length === 0) return '';

    return this.buildSection('omissions', '❗', 'Notable Omissions', 
      'Information missing from some sources', items.join(''), 'orange', totalCount);
  },

  buildBiasSection(indicators) {
    if (!indicators || indicators.length === 0) {
      return '';
    }

    // CORRIGIDO: backend usa { source, indicators: [], description }
    const items = indicators.map(indicator => {
      const indicatorsList = indicator.indicators?.map(ind => `
        <span class="pl-tag pl-badge-red" style="margin-right: 4px;">${this.escapeHtml(ind)}</span>
      `).join('') || '';

      return `
        <div class="pl-list-item pl-list-item-bias">
          <div class="pl-list-item-header">
            <div class="pl-list-item-title">${this.escapeHtml(indicator.source)}</div>
          </div>
          <div class="pl-list-item-content">${this.escapeHtml(indicator.description)}</div>
          <div class="pl-list-item-meta">
            ${indicatorsList}
          </div>
        </div>
      `;
    }).join('');

    return this.buildSection('bias', '🔍', 'Bias Indicators', 
      'Potential signs of media bias', items, 'red', indicators.length);
  },

  buildSection(id, icon, title, desc, content, badgeColor, count) {
    return `
      <div class="pl-section">
        <h3 class="pl-section-title">
          <span class="pl-icon-emoji">${icon}</span>
          ${title}
          <span class="pl-badge pl-badge-${badgeColor}">${count}</span>
        </h3>
        <div class="pl-section-desc">${desc}</div>
        <div class="pl-list">${content}</div>
      </div>
    `;
  },

  buildFooter(perspectives) {
    if (!perspectives || perspectives.length === 0) {
      return '<div class="pl-footer"><p>No source information available</p></div>';
    }

    const sourcesExtracted = perspectives.filter(p => p.contentExtracted);
    const sources = sourcesExtracted
      .map(p => p.source || p.name)
      .slice(0, 5)
      .join(', ');

    const moreCount = sourcesExtracted.length - 5;

    return `
      <div class="pl-footer">
        <div class="pl-sources-analyzed">
          <strong>Sources analyzed:</strong> ${this.escapeHtml(sources || 'Unknown')}${moreCount > 0 ? ` and ${moreCount} more` : ''}
        </div>
        <div class="pl-timestamp">
          Analysis completed at ${new Date().toLocaleTimeString()}
        </div>
      </div>
    `;
  },

  attachExpandHandlers() {
    document.querySelectorAll('.pl-expandable').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
          return;
        }
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

function attachEventListeners() {
  const toggleBtn = document.getElementById('pl-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      PanelController.toggle();
    });
  }

  const expandTab = document.getElementById('pl-expand-tab');
  if (expandTab) {
    expandTab.addEventListener('click', () => {
      if (!PanelController.isExpanded) {
        PanelController.expand();
      }
    });
  }

  const closeBtn = document.getElementById('pl-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      PanelController.hide();
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.id === 'pl-retry-btn') {
      chrome.runtime.sendMessage({ type: 'RETRY_ANALYSIS' });
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.type === 'SHOW_ANALYSIS') {
        PanelController.showAnalysis(message.data);
        sendResponse({ success: true });
      } else if (message.type === 'ANALYSIS_STARTED') {
        PanelController.showLoading();
        sendResponse({ success: true });
      } else if (message.type === 'ANALYSIS_FAILED') {
        PanelController.showError(message.error);
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('[PerspectiveLens] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }

    return true;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPanel);
} else {
  injectPanel();
}