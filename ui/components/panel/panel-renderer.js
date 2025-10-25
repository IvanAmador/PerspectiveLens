/**
 * PerspectiveLens Panel Renderer
 * Progressive multi-stage rendering orchestrator
 *
 * Coordinates rendering of 4 stages:
 * Stage 1: Context & Trust Signal
 * Stage 2: Consensus Facts
 * Stage 3: Factual Disputes
 * Stage 4: Coverage Angles
 */

import { Stage1Renderer } from './stages/stage1-renderer.js';
import { Stage2Renderer } from './stages/stage2-renderer.js';
import { Stage3Renderer } from './stages/stage3-renderer.js';
import { Stage4Renderer } from './stages/stage4-renderer.js';

export class PanelRenderer {
  constructor() {
    this.stageData = {}; // Accumulated stage data
    this.perspectives = [];
    this.sourceLinks = new Map();

    // Stage renderers
    this.stageRenderers = {
      1: Stage1Renderer,
      2: Stage2Renderer,
      3: Stage3Renderer,
      4: Stage4Renderer
    };
  }

  /**
   * Reset renderer state
   */
  reset() {
    this.stageData = {};
    this.perspectives = [];
    this.sourceLinks.clear();
    console.log('[PanelRenderer] State reset');
  }

  /**
   * Build map of source name → article URL
   */
  buildSourceLinksMap(perspectives) {
    const map = new Map();
    if (!Array.isArray(perspectives)) return map;

    perspectives.forEach(p => {
      if (p.source && p.finalUrl) {
        map.set(p.source, p.finalUrl);
      }
    });

    console.log('[PanelRenderer] Source links map built:', map.size, 'sources');
    return map;
  }

  /**
   * Update renderer with new stage data (progressive mode)
   * @param {number} stage - Stage number (1-4)
   * @param {Object} data - Stage data
   * @param {Array} perspectives - Perspectives array
   * @returns {string} HTML for this update
   */
  updateStage(stage, data, perspectives) {
    console.log(`[PanelRenderer] Updating stage ${stage}`, {
      dataKeys: Object.keys(data),
      perspectivesCount: perspectives?.length || 0
    });

    // Store perspectives on first stage
    if (stage === 1 && perspectives) {
      this.perspectives = perspectives;
      this.sourceLinks = this.buildSourceLinksMap(perspectives);
    }

    // Accumulate stage data
    Object.assign(this.stageData, data);

    // Get renderer for this stage
    const renderer = this.stageRenderers[stage];
    if (!renderer) {
      console.warn(`[PanelRenderer] No renderer found for stage ${stage}`);
      return '';
    }

    // Validate data
    const validation = renderer.validate(data);
    if (!validation.isValid) {
      console.warn(`[PanelRenderer] Stage ${stage} validation failed:`, validation.errors);
    }

    // Render stage
    const html = renderer.render(
      data,
      this.escapeHtml.bind(this),
      this.renderSourceTag.bind(this)
    );

    console.log(`[PanelRenderer] Stage ${stage} rendered (${html.length} chars)`);
    return html;
  }

  /**
   * Render complete analysis (non-progressive mode)
   * @param {Object} analysis - Complete analysis data
   * @param {Array} perspectives - Perspectives array
   * @returns {string} Complete HTML
   */
  renderComplete(analysis, perspectives) {
    console.log('[PanelRenderer] Rendering complete analysis');

    this.perspectives = perspectives;
    this.sourceLinks = this.buildSourceLinksMap(perspectives);
    this.stageData = { ...analysis };

    let html = '';

    // Stage 1: Context & Trust (always render if available)
    if (this.stageData.story_summary) {
      html += this.stageRenderers[1].render(
        this.stageData,
        this.escapeHtml.bind(this),
        this.renderSourceTag.bind(this)
      );
    }

    // Stage 2: Consensus Facts
    if (this.stageData.consensus !== undefined) {
      html += this.stageRenderers[2].render(
        this.stageData,
        this.escapeHtml.bind(this),
        this.renderSourceTag.bind(this)
      );
    }

    // Stage 3: Factual Disputes
    if (this.stageData.factual_disputes !== undefined) {
      html += this.stageRenderers[3].render(
        this.stageData,
        this.escapeHtml.bind(this),
        this.renderSourceTag.bind(this)
      );
    }

    // Stage 4: Coverage Angles
    if (this.stageData.coverage_angles !== undefined) {
      html += this.stageRenderers[4].render(
        this.stageData,
        this.escapeHtml.bind(this),
        this.renderSourceTag.bind(this)
      );
    }

    // Footer with metadata
    html += this.renderFooter();

    console.log(`[PanelRenderer] Complete rendering done (${html.length} chars)`);
    return html;
  }

  /**
   * Render footer with metadata and actions
   */
  renderFooter() {
    const metadata = this.stageData.metadata || {};
    const perspectivesCount = this.perspectives?.length || 0;

    return `
      <div id="pl-footer" class="pl-footer">
        <div class="pl-footer-stats">
          <span class="pl-footer-stat">
            <strong>${metadata.articlesAnalyzed || perspectivesCount}</strong> sources analyzed
          </span>
          ${metadata.totalDuration ? `
            <span class="pl-footer-stat">
              <strong>${(metadata.totalDuration / 1000).toFixed(1)}s</strong> analysis time
            </span>
          ` : ''}
        </div>
        ${perspectivesCount > 0 ? `
          <button id="pl-view-perspectives" class="pl-btn-link">
            View all ${perspectivesCount} perspectives →
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render source tag (clickable if URL available)
   * @param {string} sourceName - Source name
   * @returns {string} HTML for source tag
   */
  renderSourceTag(sourceName) {
    const url = this.sourceLinks?.get(sourceName);
    const escapedName = this.escapeHtml(String(sourceName));

    if (url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="pl-source-tag" title="Open ${escapedName}">${escapedName}</a>`;
    }

    return `<span class="pl-source-tag">${escapedName}</span>`;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Render perspectives modal content
   * @returns {string} HTML for modal body
   */
  renderPerspectivesModal() {
    if (!this.perspectives || this.perspectives.length === 0) {
      return '<p class="pl-empty-state">No perspectives available</p>';
    }

    return `
      <div class="pl-perspectives-grid">
        ${this.perspectives.map(p => this.renderPerspectiveCard(p)).join('')}
      </div>
    `;
  }

  /**
   * Render single perspective card
   * @param {Object} perspective - Perspective data
   * @returns {string} HTML for perspective card
   */
  renderPerspectiveCard(perspective) {
    const summary = perspective.summary || perspective.extractedContent?.excerpt || 'No summary available';
    const contentLength = perspective.extractedContent?.textContent?.length || 0;
    const byline = perspective.extractedContent?.byline;

    return `
      <article class="pl-perspective-card">
        <div class="pl-perspective-header">
          <span class="pl-perspective-source">${this.escapeHtml(perspective.source)}</span>
          <span class="pl-perspective-country">${this.escapeHtml(perspective.country || 'Unknown')}</span>
        </div>
        <h3 class="pl-perspective-title">
          <a href="${perspective.finalUrl}" target="_blank" rel="noopener noreferrer">
            ${this.escapeHtml(perspective.title)}
          </a>
        </h3>
        ${byline ? `<p class="pl-perspective-byline">By ${this.escapeHtml(byline)}</p>` : ''}
        <p class="pl-perspective-summary">${this.escapeHtml(summary)}</p>
        <div class="pl-perspective-meta">
          <span>${(contentLength / 1000).toFixed(1)}k chars</span>
          <span>${this.escapeHtml(perspective.language || 'unknown')}</span>
          ${perspective.extractionMethod ? `<span>${this.escapeHtml(perspective.extractionMethod)}</span>` : ''}
        </div>
        <a href="${perspective.finalUrl || perspective.link || '#'}" target="_blank" rel="noopener noreferrer" class="pl-perspective-link">
          Read full article →
        </a>
      </article>
    `;
  }

  /**
   * Get all stage metadata
   * @returns {Array} Array of stage metadata objects
   */
  getStageMetadata() {
    return Object.values(this.stageRenderers).map(r => r.getMetadata());
  }

  /**
   * Validate complete analysis data
   * @param {Object} analysis - Analysis data to validate
   * @returns {Object} Validation result { isValid, errors }
   */
  validateAnalysis(analysis) {
    const allErrors = [];

    // Validate each stage that has data
    Object.entries(this.stageRenderers).forEach(([stage, renderer]) => {
      const validation = renderer.validate(analysis);
      if (!validation.isValid) {
        allErrors.push({
          stage: parseInt(stage),
          stageName: renderer.getMetadata().name,
          errors: validation.errors
        });
      }
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }
}
