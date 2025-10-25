/**
 * Stage 2 Renderer: Consensus Facts
 *
 * Renders facts that multiple sources agree on.
 * These are likely accurate and can be trusted.
 */

export class Stage2Renderer {
  /**
   * Render Stage 2: Consensus Facts
   * @param {Object} data - { consensus: Array<{fact, sources}> }
   * @param {Function} escapeHtml - HTML escape function
   * @param {Function} renderSourceTag - Source tag renderer
   * @returns {string} HTML
   */
  static render(data, escapeHtml, renderSourceTag) {
    const { consensus } = data;

    // Empty state
    if (!consensus || consensus.length === 0) {
      return `
        <div id="pl-stage-2" class="pl-stage" data-stage="2">
          <div class="pl-section">
            <div class="pl-section-header">
              <h3 class="pl-section-title">
                <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                Consensus Facts
              </h3>
              <span class="pl-badge pl-badge-success">0</span>
            </div>
            <p class="pl-section-desc">No consensus facts found across sources</p>
          </div>
        </div>
      `;
    }

    // Render consensus items
    const consensusItems = consensus.map((item, idx) => {
      const sourcesCount = item.sources?.length || 0;
      const sourceTags = (item.sources || []).map(s => renderSourceTag(s)).join('');

      return `
        <div class="pl-list-item" data-index="${idx}">
          <p class="pl-list-item-title">${escapeHtml(item.fact)}</p>
          ${sourceTags ? `
            <div class="pl-list-item-meta">
              <span>${sourcesCount} source${sourcesCount !== 1 ? 's' : ''}</span>
              ${sourceTags}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div id="pl-stage-2" class="pl-stage" data-stage="2">
        <div class="pl-section">
          <h3 class="pl-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Consensus Facts
            <span class="pl-badge">${consensus.length}</span>
          </h3>
          <p class="pl-section-desc">Facts multiple sources agree on</p>
          <div class="pl-list">
            ${consensusItems}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get stage metadata
   */
  static getMetadata() {
    return {
      stage: 2,
      name: 'Consensus Facts',
      description: 'Facts that multiple sources agree on',
      requiredFields: ['consensus']
    };
  }

  /**
   * Validate stage data
   */
  static validate(data) {
    const errors = [];

    if (!data.consensus) {
      errors.push('Missing consensus array');
    } else if (!Array.isArray(data.consensus)) {
      errors.push('consensus must be an array');
    } else {
      // Validate each consensus item
      data.consensus.forEach((item, idx) => {
        if (!item.fact) {
          errors.push(`consensus[${idx}]: missing fact`);
        }
        if (!item.sources || !Array.isArray(item.sources)) {
          errors.push(`consensus[${idx}]: missing or invalid sources array`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
