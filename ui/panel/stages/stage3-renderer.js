/**
 * Stage 3 Renderer: Factual Disputes
 *
 * Renders direct contradictions on facts between sources.
 * Helps readers identify conflicting information.
 */

export class Stage3Renderer {
  /**
   * Render Stage 3: Factual Disputes
   * @param {Object} data - { factual_disputes: Array<{what, claim_a, claim_b, sources_a, sources_b}> }
   * @param {Function} escapeHtml - HTML escape function
   * @param {Function} renderSourceTag - Source tag renderer
   * @returns {string} HTML
   */
  static render(data, escapeHtml, renderSourceTag) {
    const { factual_disputes } = data;

    // Empty state (no disputes is good!)
    if (!factual_disputes || factual_disputes.length === 0) {
      return `
        <div id="pl-stage-3" class="pl-stage" data-stage="3">
          <div class="pl-section">
            <div class="pl-section-header">
              <h3 class="pl-section-title">
                <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                Factual Disputes
              </h3>
              <span class="pl-badge pl-badge-success">0</span>
            </div>
            <p class="pl-section-desc">No factual contradictions found across sources</p>
          </div>
        </div>
      `;
    }

    // Render dispute items
    const disputeItems = factual_disputes.map((item, idx) => {
      const sourcesACount = item.sources_a?.length || 0;
      const sourcesBCount = item.sources_b?.length || 0;
      const sourceATags = (item.sources_a || []).map(s => renderSourceTag(s)).join('');
      const sourceBTags = (item.sources_b || []).map(s => renderSourceTag(s)).join('');

      return `
        <div class="pl-list-item pl-list-item-dispute" data-index="${idx}">
          <h4 class="pl-list-item-title">${escapeHtml(item.what)}</h4>
          <div class="pl-dispute-claims">
            <div class="pl-claim">
              <div class="pl-claim-label">Claim A (${sourcesACount} source${sourcesACount !== 1 ? 's' : ''})</div>
              <p class="pl-claim-text">${escapeHtml(item.claim_a)}</p>
              <div class="pl-sources-tags">
                ${sourceATags}
              </div>
            </div>
            <div class="pl-claim">
              <div class="pl-claim-label">Claim B (${sourcesBCount} source${sourcesBCount !== 1 ? 's' : ''})</div>
              <p class="pl-claim-text">${escapeHtml(item.claim_b)}</p>
              <div class="pl-sources-tags">
                ${sourceBTags}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div id="pl-stage-3" class="pl-stage" data-stage="3">
        <div class="pl-section">
          <div class="pl-section-header">
            <h3 class="pl-section-title">
              <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              Factual Disputes
            </h3>
            <span class="pl-badge pl-badge-error">${factual_disputes.length}</span>
          </div>
          <p class="pl-section-desc">Direct contradictions on facts - verify with additional sources</p>
          <div class="pl-list">
            ${disputeItems}
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
      stage: 3,
      name: 'Factual Disputes',
      description: 'Direct contradictions on facts between sources',
      requiredFields: ['factual_disputes']
    };
  }

  /**
   * Validate stage data
   */
  static validate(data) {
    const errors = [];

    if (data.factual_disputes === undefined) {
      errors.push('Missing factual_disputes array');
    } else if (!Array.isArray(data.factual_disputes)) {
      errors.push('factual_disputes must be an array');
    } else {
      // Validate each dispute item
      data.factual_disputes.forEach((item, idx) => {
        if (!item.what) {
          errors.push(`factual_disputes[${idx}]: missing what field`);
        }
        if (!item.claim_a) {
          errors.push(`factual_disputes[${idx}]: missing claim_a`);
        }
        if (!item.claim_b) {
          errors.push(`factual_disputes[${idx}]: missing claim_b`);
        }
        if (!item.sources_a || !Array.isArray(item.sources_a)) {
          errors.push(`factual_disputes[${idx}]: missing or invalid sources_a array`);
        }
        if (!item.sources_b || !Array.isArray(item.sources_b)) {
          errors.push(`factual_disputes[${idx}]: missing or invalid sources_b array`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
