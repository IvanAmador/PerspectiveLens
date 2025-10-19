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
      this.sourceLinks = new Map(); // Map of source name → article URL
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

      // Build source links map from perspectives
      this.sourceLinks = this.buildSourceLinksMap(data.perspectives);

      document.getElementById('pl-loading').style.display = 'none';
      document.getElementById('pl-error').style.display = 'none';

      const analysisContainer = document.getElementById('pl-analysis');
      analysisContainer.style.display = 'block';
      analysisContainer.innerHTML = this.renderAnalysis(data);

      this.attachAnalysisEventListeners();
    }

    /**
     * Progressive rendering - updates UI as each analysis stage completes
     * @param {number} stageNumber - Stage number (1-4)
     * @param {Object} stageData - Stage data
     * @param {Array} perspectives - Perspectives array
     */
    showAnalysisProgressive(stageNumber, stageData, perspectives) {
      console.log(`[Panel] Stage ${stageNumber} data received:`, stageData);

      this.show();
      document.getElementById('pl-loading').style.display = 'none';
      document.getElementById('pl-error').style.display = 'none';

      const analysisContainer = document.getElementById('pl-analysis');
      analysisContainer.style.display = 'block';

      // Initialize current analysis on first stage
      if (!this.currentAnalysis) {
        this.currentAnalysis = { perspectives };
        this.sourceLinks = this.buildSourceLinksMap(perspectives);
      }

      // Merge stage data into current analysis
      Object.assign(this.currentAnalysis, stageData);

      // Progressive rendering based on stage
      // Always render from currentAnalysis (which has all accumulated data)
      let html = '';

      // Stage 1 always present
      if (this.currentAnalysis.story_summary) {
        html += this.renderStage1(this.currentAnalysis);
      }

      // Stage 2 if available
      if (stageNumber >= 2 && this.currentAnalysis.consensus) {
        html += this.renderStage2(this.currentAnalysis);
      }

      // Stage 3 if available
      if (stageNumber >= 3 && this.currentAnalysis.factual_disputes !== undefined) {
        html += this.renderStage3(this.currentAnalysis);
      }

      // Stage 4 if available
      if (stageNumber >= 4 && this.currentAnalysis.perspective_differences !== undefined) {
        html += this.renderStage4(this.currentAnalysis);
      }

      // Footer only on final stage
      if (stageNumber === 4) {
        html += this.renderFooter({ perspectives, analysis: this.currentAnalysis });
      }

      analysisContainer.innerHTML = html;

      this.attachAnalysisEventListeners();
    }

    /**
     * Build map of source name → article URL for clickable links
     * @param {Array} perspectives - Array of perspective objects
     * @returns {Map<string, string>} Map of source → finalUrl
     */
    buildSourceLinksMap(perspectives) {
      const map = new Map();
      if (!Array.isArray(perspectives)) return map;

      perspectives.forEach(p => {
        if (p.source && p.finalUrl) {
          map.set(p.source, p.finalUrl);
        }
      });

      console.log('[Panel] Source links map built:', map.size, 'sources');
      return map;
    }

    renderAnalysis(data) {
      const analysis = data.analysis || data; // Support both formats
      const hasConsensus = this.getConsensusCount(analysis.consensus) > 0;

      return `
        ${analysis.story_summary ? this.renderSummary(analysis.story_summary) : ''}
        ${analysis.reader_guidance ? this.renderReaderGuidance(analysis.reader_guidance) : ''}
        ${this.renderStats(analysis)}
        ${hasConsensus ? this.renderConsensus(analysis.consensus) : ''}
        ${analysis.key_differences?.length > 0 ? this.renderKeyDifferences(analysis.key_differences) : ''}
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

    renderReaderGuidance(guidance) {
      if (!guidance || typeof guidance !== 'string') return '';
      return `
        <div class="pl-card pl-card-guidance">
          <div class="pl-card-title">
            ${PANEL_ICONS.info}
            Reader Guidance
          </div>
          <div class="pl-guidance-text">${this.escapeHtml(guidance)}</div>
        </div>
      `;
    }

    renderStats(data) {
      const metadata = data.metadata || {};
      const consensusCount = this.getConsensusCount(data.consensus);
      const stats = [
        { label: 'Articles', value: metadata.articlesAnalyzed || 0 },
        { label: 'Consensus', value: consensusCount },
        { label: 'Differences', value: data.key_differences?.length || 0 }
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

    /**
     * Get consensus count (supports both object and array formats)
     * @param {Object|Array} consensus - Consensus data
     * @returns {number} Number of consensus items
     */
    getConsensusCount(consensus) {
      if (!consensus) return 0;
      if (Array.isArray(consensus)) return consensus.length;
      if (typeof consensus === 'object') return Object.keys(consensus).length;
      return 0;
    }

    renderConsensus(consensus) {
      const count = this.getConsensusCount(consensus);
      const items = this.normalizeConsensus(consensus);

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.consensus}
            Consensus
            <span class="pl-badge pl-badge-green">${count}</span>
          </div>
          <p class="pl-section-desc">Facts that most sources agree on</p>
          <div class="pl-list">
            ${items.map((item, idx) => this.renderConsensusItem(item, idx)).join('')}
          </div>
        </div>
      `;
    }

    /**
     * Normalize consensus to array format for rendering
     * Supports both v2 (object) and legacy v1 (array) formats
     * @param {Object|Array} consensus - Consensus data
     * @returns {Array} Normalized array of {fact, sources}
     */
    normalizeConsensus(consensus) {
      if (!consensus) return [];

      // V2 format: object with fact as key, sources as value
      if (typeof consensus === 'object' && !Array.isArray(consensus)) {
        return Object.entries(consensus).map(([fact, sources]) => ({
          fact,
          sources: Array.isArray(sources) ? sources : []
        }));
      }

      // V1 format: already an array
      if (Array.isArray(consensus)) {
        return consensus;
      }

      return [];
    }

    renderConsensusItem(item, idx) {
      const fact = item.fact || 'No fact provided';
      const sources = Array.isArray(item.sources) ? item.sources : [];

      return `
        <div class="pl-list-item pl-list-item-consensus" id="pl-item-consensus-${idx}">
          <div class="pl-list-item-title">${this.escapeHtml(fact)}</div>
          <div class="pl-list-item-meta">
            <strong>${sources.length} sources:</strong>
            ${sources.map(s => this.renderSourceTag(s)).join(' ')}
          </div>
        </div>
      `;
    }

    /**
     * Render source tag with optional clickable link
     * @param {string} sourceName - Name of the source
     * @returns {string} HTML for source tag
     */
    renderSourceTag(sourceName) {
      const url = this.sourceLinks?.get(sourceName);
      const escapedName = this.escapeHtml(String(sourceName));

      if (url) {
        return `<a href="${url}" target="_blank" rel="noopener" class="pl-tag pl-tag-source pl-tag-link" title="Open ${escapedName}">${escapedName}</a>`;
      }

      return `<span class="pl-tag pl-tag-source">${escapedName}</span>`;
    }

    renderKeyDifferences(keyDifferences) {
      const items = this.normalizeKeyDifferences(keyDifferences);

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.dispute}
            Key Differences
            <span class="pl-badge pl-badge-yellow">${items.length}</span>
          </div>
          <p class="pl-section-desc">Significant differences that change reader perception</p>
          <div class="pl-list">
            ${items.map((item, idx) => this.renderKeyDifferenceItem(item, idx)).join('')}
          </div>
        </div>
      `;
    }

    /**
     * Normalize key_differences to structured format for rendering
     * Supports both v2 (string) and legacy v1 (object) formats
     * @param {Array} keyDifferences - Array of differences (strings or objects)
     * @returns {Array} Normalized array of {whatDiffers, groupA, groupB, sourcesA, sourcesB}
     */
    normalizeKeyDifferences(keyDifferences) {
      if (!Array.isArray(keyDifferences)) return [];

      return keyDifferences.map(item => {
        // V2 format: string with pattern "Aspect: X | Group A ([S1, S2]): Y | Group B ([S3]): Z"
        if (typeof item === 'string') {
          return this.parseKeyDifferenceString(item);
        }

        // V1 format: object with separate fields
        if (typeof item === 'object') {
          return {
            whatDiffers: item.what_differs || 'Unnamed difference',
            groupA: item.group_a_approach || '',
            groupB: item.group_b_approach || '',
            sourcesA: Array.isArray(item.sources_a) ? item.sources_a : [],
            sourcesB: Array.isArray(item.sources_b) ? item.sources_b : []
          };
        }

        return null;
      }).filter(item => item !== null);
    }

    /**
     * Parse v2 key difference string format
     * Format: "Aspect: X | Group A ([S1, S2]): Y | Group B ([S3]): Z"
     * Handles malformed input gracefully
     * @param {string} str - Difference string
     * @returns {Object} Parsed difference
     */
    parseKeyDifferenceString(str) {
      console.log('[Panel] Parsing key_difference string:', str.substring(0, 100));

      // Split by pipe character
      const parts = str.split('|').map(s => s.trim());
      console.log('[Panel] Split into parts:', parts.length);

      // Extract aspect
      const aspectMatch = parts[0]?.match(/^Aspect:\s*(.+)$/i);
      const whatDiffers = aspectMatch ? aspectMatch[1].trim() : (parts[0] || 'Unnamed difference');

      // Try to extract Group A
      let groupAMatch = null;
      let groupBMatch = null;
      let groupAIndex = -1;
      let groupBIndex = -1;

      // Find which part contains Group A and Group B
      parts.forEach((part, idx) => {
        if (part.match(/Group A/i) && !groupAMatch) {
          groupAMatch = part.match(/Group A\s*\(([^\)]+)\):\s*(.+)$/i);
          groupAIndex = idx;
        }
        if (part.match(/Group B/i) && !groupBMatch) {
          groupBMatch = part.match(/Group B\s*\(([^\)]+)\):\s*(.+)$/i);
          groupBIndex = idx;
        }
      });

      // Extract Group A data
      const sourcesAStr = groupAMatch ? groupAMatch[1] : '';
      const groupA = groupAMatch ? groupAMatch[2].trim() : '';
      const sourcesA = this.parseSourcesList(sourcesAStr);

      // Extract Group B data
      const sourcesBStr = groupBMatch ? groupBMatch[1] : '';
      const groupB = groupBMatch ? groupBMatch[2].trim() : '';
      const sourcesB = this.parseSourcesList(sourcesBStr);

      console.log('[Panel] Parsed difference:', {
        whatDiffers,
        groupA: groupA.substring(0, 50),
        groupB: groupB.substring(0, 50),
        sourcesA,
        sourcesB
      });

      // Fallback: if no proper groups found, try to parse individual sources mentioned
      if (sourcesA.length === 0 && sourcesB.length === 0) {
        console.warn('[Panel] No groups found, attempting fallback parsing');
        // Try to extract all mentioned sources from the string
        const allSources = this.extractSourcesFromText(str);
        console.log('[Panel] Fallback sources found:', allSources);

        // Split sources roughly in half
        const mid = Math.ceil(allSources.length / 2);
        return {
          whatDiffers,
          groupA: parts[1] || 'No description',
          groupB: parts[2] || 'No description',
          sourcesA: allSources.slice(0, mid),
          sourcesB: allSources.slice(mid)
        };
      }

      return { whatDiffers, groupA, groupB, sourcesA, sourcesB };
    }

    /**
     * Extract source names from free text (fallback method)
     * Looks for capitalized words that might be source names
     * @param {string} text - Text to search
     * @returns {Array<string>} Found source names
     */
    extractSourcesFromText(text) {
      // Look for patterns like "Source1", "CNN", "BBC" in square brackets or parentheses
      const bracketMatches = text.match(/\[([^\]]+)\]/g);
      if (bracketMatches) {
        const sources = [];
        bracketMatches.forEach(match => {
          const cleaned = match.replace(/[\[\]]/g, '');
          sources.push(...cleaned.split(',').map(s => s.trim()).filter(s => s.length > 0));
        });
        return sources;
      }

      // Fallback: look for capitalized words (potential source names)
      const words = text.split(/\s+/);
      const potentialSources = words.filter(word =>
        /^[A-Z][a-zA-Z0-9.]+/.test(word) && word.length > 2
      );
      return [...new Set(potentialSources)]; // Remove duplicates
    }

    /**
     * Parse sources list from string format "[S1, S2, S3]" or "S1, S2, S3"
     * @param {string} str - Sources string
     * @returns {Array<string>} Array of source names
     */
    parseSourcesList(str) {
      if (!str) return [];

      // Remove brackets if present
      const cleaned = str.replace(/[\[\]]/g, '').trim();

      // Split by comma and clean up
      return cleaned
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    renderKeyDifferenceItem(item, idx) {
      const { whatDiffers, groupA, groupB, sourcesA, sourcesB } = item;

      return `
        <div class="pl-list-item pl-list-item-difference" id="pl-item-difference-${idx}">
          <div class="pl-list-item-title">${this.escapeHtml(whatDiffers)}</div>

          <div class="pl-difference-groups">
            <div class="pl-difference-group">
              <div class="pl-group-label">Group A (${sourcesA.length})</div>
              <div class="pl-group-text">${this.escapeHtml(groupA)}</div>
              <div class="pl-group-sources">
                ${sourcesA.map(s => this.renderSourceTag(s)).join(' ')}
              </div>
            </div>

            <div class="pl-difference-group">
              <div class="pl-group-label">Group B (${sourcesB.length})</div>
              <div class="pl-group-text">${this.escapeHtml(groupB)}</div>
              <div class="pl-group-sources">
                ${sourcesB.map(s => this.renderSourceTag(s)).join(' ')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderFooter(data) {
      const metadata = data.analysis?.metadata || data.metadata || {};
      const perspectives = data.perspectives || [];

      const duration = metadata.duration ? (metadata.duration / 1000).toFixed(1) : '?';
      const compression = metadata.compressionUsed ?
        `Yes (${((1 - metadata.compressedLength / metadata.originalLength) * 100).toFixed(0)}% reduction)` :
        'No';

      return `
        <div class="pl-footer">
          <div class="pl-footer-item">
            <strong>Sources:</strong> ${metadata.articlesAnalyzed || 0} analyzed${metadata.articlesInput ? ` (${metadata.articlesInput} input)` : ''}
          </div>
          ${metadata.compressionUsed ? `
            <div class="pl-footer-item">
              <strong>Compression:</strong> ${compression}
            </div>
          ` : ''}
          <div class="pl-footer-item">
            <strong>Duration:</strong> ${duration}s
          </div>
          ${perspectives.length > 0 ? `
            <div class="pl-footer-item pl-footer-perspectives">
              <button id="pl-view-perspectives" class="pl-btn-link">
                View all ${perspectives.length} perspectives
              </button>
            </div>
          ` : ''}
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

      // Perspectives button
      const perspectivesBtn = document.getElementById('pl-view-perspectives');
      if (perspectivesBtn) {
        perspectivesBtn.addEventListener('click', () => {
          this.showPerspectives(this.currentAnalysis.perspectives);
        });
      }
    }

    /**
     * Show perspectives modal with all articles and their summaries
     * @param {Array} perspectives - Array of perspective objects
     */
    showPerspectives(perspectives) {
      if (!perspectives || perspectives.length === 0) {
        console.warn('[Panel] No perspectives to display');
        return;
      }

      console.log('[Panel] Opening perspectives modal with', perspectives.length, 'articles');

      // Create modal overlay
      const modalHTML = `
        <div id="pl-perspectives-modal" class="pl-modal">
          <div class="pl-modal-overlay"></div>
          <div class="pl-modal-content">
            <div class="pl-modal-header">
              <h2>All Perspectives (${perspectives.length})</h2>
              <button id="pl-modal-close" class="pl-btn-icon" aria-label="Close modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div class="pl-modal-body">
              ${this.renderPerspectivesList(perspectives)}
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);

      // Attach close handlers
      const modal = document.getElementById('pl-perspectives-modal');
      const closeBtn = document.getElementById('pl-modal-close');
      const overlay = modal.querySelector('.pl-modal-overlay');

      const closeModal = () => {
        modal.remove();
        console.log('[Panel] Perspectives modal closed');
      };

      closeBtn?.addEventListener('click', closeModal);
      overlay?.addEventListener('click', closeModal);

      // ESC key
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }

    renderPerspectivesList(perspectives) {
      return `
        <div class="pl-perspectives-grid">
          ${perspectives.map(p => this.renderPerspectiveCard(p)).join('')}
        </div>
      `;
    }

    renderPerspectiveCard(perspective) {
      // Use summary (from Summarizer API) or fallback to excerpt
      const summary = perspective.summary || perspective.extractedContent?.excerpt || 'No summary available';
      const contentLength = perspective.extractedContent?.textContent?.length || 0;
      const byline = perspective.extractedContent?.byline;
      const compressionRatio = perspective.compressionRatio;

      return `
        <article class="pl-perspective-card">
          <div class="pl-perspective-header">
            <div class="pl-perspective-source">${this.escapeHtml(perspective.source)}</div>
            <div class="pl-perspective-country">${this.escapeHtml(perspective.country || 'Unknown')}</div>
          </div>
          <h3 class="pl-perspective-title">
            <a href="${perspective.finalUrl}" target="_blank" rel="noopener">
              ${this.escapeHtml(perspective.title)}
            </a>
          </h3>
          ${byline ? `<div class="pl-perspective-byline">By ${this.escapeHtml(byline)}</div>` : ''}
          <div class="pl-perspective-summary">${this.escapeHtml(summary)}</div>
          <div class="pl-perspective-meta">
            <span>${(contentLength / 1000).toFixed(1)}k chars</span>
            <span>${this.escapeHtml(perspective.language || 'unknown')}</span>
            ${perspective.extractionMethod ? `<span>${this.escapeHtml(perspective.extractionMethod)}</span>` : ''}
            ${compressionRatio ? `<span>${compressionRatio.toFixed(0)}% compressed</span>` : ''}
          </div>
          <a href="${perspective.finalUrl || perspective.link || '#'}" target="_blank" rel="noopener" class="pl-perspective-link">
            Read full article →
          </a>
        </article>
      `;
    }

    /**
     * Render Stage 1: Context & Trust
     */
    renderStage1(data) {
      const trustSignals = {
        'high_agreement': { icon: '✓', color: 'green', label: 'High Agreement' },
        'some_conflicts': { icon: '⚠', color: 'yellow', label: 'Some Conflicts' },
        'major_disputes': { icon: '⚠⚠', color: 'red', label: 'Major Disputes' }
      };

      const signal = trustSignals[data.trust_signal] || trustSignals['some_conflicts'];

      return `
        <div class="pl-card pl-card-summary">
          <div class="pl-card-title">
            ${PANEL_ICONS.info}
            Story Summary
            <span class="pl-badge pl-badge-${signal.color}">${signal.icon} ${signal.label}</span>
          </div>
          <div class="pl-main-story">${this.escapeHtml(data.story_summary)}</div>
          <div class="pl-reader-action">
            <strong>→</strong> ${this.escapeHtml(data.reader_action)}
          </div>
        </div>
      `;
    }

    /**
     * Render Stage 2: Consensus Facts
     */
    renderStage2(data) {
      if (!data.consensus || data.consensus.length === 0) {
        return '';
      }

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.consensus}
            Consensus Facts
            <span class="pl-badge pl-badge-green">${data.consensus.length}</span>
          </div>
          <p class="pl-section-desc">Facts that multiple sources agree on - likely accurate</p>
          <div class="pl-list">
            ${data.consensus.map((item, idx) => `
              <div class="pl-list-item pl-list-item-consensus" id="pl-item-consensus-${idx}">
                <div class="pl-list-item-title">${this.escapeHtml(item.fact)}</div>
                <div class="pl-list-item-meta">
                  <strong>${item.sources.length} sources:</strong>
                  ${item.sources.map(s => this.renderSourceTag(s)).join(' ')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * Render Stage 3: Factual Disputes
     */
    renderStage3(data) {
      if (!data.factual_disputes || data.factual_disputes.length === 0) {
        return `
          <div class="pl-section">
            <div class="pl-section-title">
              ${PANEL_ICONS.consensus}
              Factual Disputes
              <span class="pl-badge pl-badge-green">✓ 0</span>
            </div>
            <p class="pl-section-desc pl-no-disputes">No factual contradictions found across sources</p>
          </div>
        `;
      }

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.dispute}
            Factual Disputes
            <span class="pl-badge pl-badge-red">${data.factual_disputes.length}</span>
          </div>
          <p class="pl-section-desc">Direct contradictions on facts - verify with additional sources</p>
          <div class="pl-list">
            ${data.factual_disputes.map((item, idx) => `
              <div class="pl-list-item pl-list-item-dispute" id="pl-item-dispute-${idx}">
                <div class="pl-list-item-title">${this.escapeHtml(item.what)}</div>
                <div class="pl-dispute-claims">
                  <div class="pl-claim">
                    <div class="pl-claim-label">Claim A (${item.sources_a.length})</div>
                    <div class="pl-claim-text">${this.escapeHtml(item.claim_a)}</div>
                    <div class="pl-claim-sources">
                      ${item.sources_a.map(s => this.renderSourceTag(s)).join(' ')}
                    </div>
                  </div>
                  <div class="pl-claim">
                    <div class="pl-claim-label">Claim B (${item.sources_b.length})</div>
                    <div class="pl-claim-text">${this.escapeHtml(item.claim_b)}</div>
                    <div class="pl-claim-sources">
                      ${item.sources_b.map(s => this.renderSourceTag(s)).join(' ')}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * Render Stage 4: Perspective Differences
     */
    renderStage4(data) {
      if (!data.perspective_differences || data.perspective_differences.length === 0) {
        return '';
      }

      return `
        <div class="pl-section">
          <div class="pl-section-title">
            ${PANEL_ICONS.document}
            Perspective Differences
            <span class="pl-badge pl-badge-blue">${data.perspective_differences.length}</span>
          </div>
          <p class="pl-section-desc">How sources emphasize or frame the story differently</p>
          <div class="pl-list">
            ${data.perspective_differences.map((item, idx) => `
              <div class="pl-list-item pl-list-item-perspective" id="pl-item-perspective-${idx}">
                <div class="pl-list-item-title">${this.escapeHtml(item.aspect)}</div>
                <div class="pl-perspective-groups">
                  <div class="pl-perspective-group">
                    <div class="pl-group-label">Approach A (${item.sources_a.length})</div>
                    <div class="pl-group-text">${this.escapeHtml(item.approach_a)}</div>
                    <div class="pl-group-sources">
                      ${item.sources_a.map(s => this.renderSourceTag(s)).join(' ')}
                    </div>
                  </div>
                  <div class="pl-perspective-group">
                    <div class="pl-group-label">Approach B (${item.sources_b.length})</div>
                    <div class="pl-group-text">${this.escapeHtml(item.approach_b)}</div>
                    <div class="pl-group-sources">
                      ${item.sources_b.map(s => this.renderSourceTag(s)).join(' ')}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
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
    showAnalysisProgressive: (stage, stageData, perspectives) =>
      getPanelInstance().showAnalysisProgressive(stage, stageData, perspectives),
    showError: (error) => getPanelInstance().showError(error),
    showLoading: () => getPanelInstance().showLoading(),
    hide: () => getPanelInstance().hide(),
    reset: () => getPanelInstance().reset()
  };

  console.log('[PerspectiveLens] Panel module loaded (ROBUST VERSION)');
})();