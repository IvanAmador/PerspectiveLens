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
      const sourceATags = (item.sources_a || []).map(s => renderSourceTag(s)).join('');
      const sourceBTags = (item.sources_b || []).map(s => renderSourceTag(s)).join('');

      return `
        <div class="pl-list-item" data-index="${idx}">
          <p class="pl-list-item-title">${escapeHtml(item.what)}</p>
          <div class="pl-dispute-claims">
            <div class="pl-claim">
              <div class="pl-claim-label">Claim A</div>
              <div class="pl-claim-text">${escapeHtml(item.claim_a)}</div>
              ${sourceATags ? `<div class="pl-claim-sources">${sourceATags}</div>` : ''}
            </div>
            <div class="pl-claim">
              <div class="pl-claim-label">Claim B</div>
              <div class="pl-claim-text">${escapeHtml(item.claim_b)}</div>
              ${sourceBTags ? `<div class="pl-claim-sources">${sourceBTags}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div id="pl-stage-3" class="pl-stage" data-stage="3">
        <div class="pl-section">
          <h3 class="pl-section-title">
            Factual Disputes
            <span class="pl-badge">${factual_disputes.length}</span>
          </h3>
          <p class="pl-section-desc">Direct contradictions - verify with additional sources</p>
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
