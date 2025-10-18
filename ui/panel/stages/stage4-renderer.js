/**
 * Stage 4 Renderer: Perspective Differences
 *
 * Renders how sources emphasize or frame the story differently.
 * Not contradictions, but different angles and approaches.
 */

export class Stage4Renderer {
  /**
   * Render Stage 4: Perspective Differences
   * @param {Object} data - { perspective_differences, perspective_differences_2, perspective_differences_3 }
   * @param {Function} escapeHtml - HTML escape function
   * @param {Function} renderSourceTag - Source tag renderer
   * @returns {string} HTML
   */
  static render(data, escapeHtml, renderSourceTag) {
    const {
      perspective_differences,
      perspective_differences_2,
      perspective_differences_3
    } = data;

    // Combine all perspective differences arrays
    const allDifferences = [
      ...(perspective_differences || []),
      ...(perspective_differences_2 || []),
      ...(perspective_differences_3 || [])
    ];

    // Empty state
    if (allDifferences.length === 0) {
      return `
        <div id="pl-stage-4" class="pl-stage" data-stage="4">
          <div class="pl-section">
            <div class="pl-section-header">
              <h3 class="pl-section-title">
                <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                Perspective Differences
              </h3>
              <span class="pl-badge pl-badge-info">0</span>
            </div>
            <p class="pl-section-desc">No significant perspective differences found</p>
          </div>
        </div>
      `;
    }

    // Render perspective items
    const perspectiveItems = allDifferences.map((item, idx) => {
      const sourcesACount = item.sources_a?.length || 0;
      const sourcesBCount = item.sources_b?.length || 0;
      const sourceATags = (item.sources_a || []).map(s => renderSourceTag(s)).join('');
      const sourceBTags = (item.sources_b || []).map(s => renderSourceTag(s)).join('');

      return `
        <div class="pl-list-item pl-list-item-perspective" data-index="${idx}">
          <h4 class="pl-list-item-title">${escapeHtml(item.aspect)}</h4>
          <div class="pl-perspective-approaches">
            <div class="pl-approach">
              <div class="pl-approach-label">Approach A (${sourcesACount} source${sourcesACount !== 1 ? 's' : ''})</div>
              <p class="pl-approach-text">${escapeHtml(item.approach_a)}</p>
              <div class="pl-sources-tags">
                ${sourceATags}
              </div>
            </div>
            <div class="pl-approach">
              <div class="pl-approach-label">Approach B (${sourcesBCount} source${sourcesBCount !== 1 ? 's' : ''})</div>
              <p class="pl-approach-text">${escapeHtml(item.approach_b)}</p>
              <div class="pl-sources-tags">
                ${sourceBTags}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div id="pl-stage-4" class="pl-stage" data-stage="4">
        <div class="pl-section">
          <div class="pl-section-header">
            <h3 class="pl-section-title">
              <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Perspective Differences
            </h3>
            <span class="pl-badge pl-badge-info">${allDifferences.length}</span>
          </div>
          <p class="pl-section-desc">How sources emphasize or frame the story differently</p>
          <div class="pl-list">
            ${perspectiveItems}
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
      stage: 4,
      name: 'Perspective Differences',
      description: 'How sources emphasize or frame the story differently',
      requiredFields: ['perspective_differences']
    };
  }

  /**
   * Validate stage data
   */
  static validate(data) {
    const errors = [];

    // At least one perspective_differences array should exist
    const hasPerspectives =
      data.perspective_differences !== undefined ||
      data.perspective_differences_2 !== undefined ||
      data.perspective_differences_3 !== undefined;

    if (!hasPerspectives) {
      errors.push('Missing all perspective_differences arrays');
      return { isValid: false, errors };
    }

    // Validate each array if present
    const arrays = [
      { key: 'perspective_differences', data: data.perspective_differences },
      { key: 'perspective_differences_2', data: data.perspective_differences_2 },
      { key: 'perspective_differences_3', data: data.perspective_differences_3 }
    ];

    arrays.forEach(({ key, data: arr }) => {
      if (arr !== undefined) {
        if (!Array.isArray(arr)) {
          errors.push(`${key} must be an array`);
        } else {
          // Validate each item
          arr.forEach((item, idx) => {
            if (!item.aspect) {
              errors.push(`${key}[${idx}]: missing aspect field`);
            }
            if (!item.approach_a) {
              errors.push(`${key}[${idx}]: missing approach_a`);
            }
            if (!item.approach_b) {
              errors.push(`${key}[${idx}]: missing approach_b`);
            }
            if (!item.sources_a || !Array.isArray(item.sources_a)) {
              errors.push(`${key}[${idx}]: missing or invalid sources_a array`);
            }
            if (!item.sources_b || !Array.isArray(item.sources_b)) {
              errors.push(`${key}[${idx}]: missing or invalid sources_b array`);
            }
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
