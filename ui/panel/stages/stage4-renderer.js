/**
 * Stage 4 Renderer: Perspective Differences
 *
 * Renders how sources emphasize or frame the story differently.
 * Not contradictions, but different angles and approaches.
 */

export class Stage4Renderer {
  /**
   * Render Stage 4: Perspective Differences
   * @param {Object} data - { perspective_analysis, perspective_analysis_2, perspective_analysis_3 }
   * @param {Function} escapeHtml - HTML escape function
   * @param {Function} renderSourceTag - Source tag renderer
   * @returns {string} HTML
   */
  static render(data, escapeHtml, renderSourceTag) {
    const {
      perspective_analysis,
      perspective_analysis_2,
      perspective_analysis_3
    } = data;

    // Combine all perspective analysis arrays
    const allPerspectives = [
      ...(perspective_analysis || []),
      ...(perspective_analysis_2 || []),
      ...(perspective_analysis_3 || [])
    ];

    // Empty state
    if (allPerspectives.length === 0) {
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
    const perspectiveItems = allPerspectives.map((item, idx) => {
      const approachesHtml = (item.approaches || []).map((approach, approachIdx) => {
        const sourceTags = (approach.sources || []).map(s => renderSourceTag(s)).join('');
        return `
          <div class="pl-approach">
            <p class="pl-approach-text">${escapeHtml(approach.focus)}</p>
            <div class="pl-sources-tags">
              ${sourceTags}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="pl-list-item pl-list-item-perspective" data-index="${idx}">
          <h4 class="pl-list-item-title">${escapeHtml(item.aspect)}</h4>
          <div class="pl-perspective-approaches">
            ${approachesHtml}
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
            <span class="pl-badge pl-badge-info">${allPerspectives.length}</span>
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
      requiredFields: ['perspective_analysis']
    };
  }

  /**
   * Validate stage data
   */
  static validate(data) {
    const errors = [];

    // At least one perspective_analysis array should exist
    const hasPerspectives =
      data.perspective_analysis !== undefined ||
      data.perspective_analysis_2 !== undefined ||
      data.perspective_analysis_3 !== undefined;

    if (!hasPerspectives) {
      errors.push('Missing all perspective_analysis arrays');
      return { isValid: false, errors };
    }

    // Validate each array if present
    const arrays = [
      { key: 'perspective_analysis', data: data.perspective_analysis },
      { key: 'perspective_analysis_2', data: data.perspective_analysis_2 },
      { key: 'perspective_analysis_3', data: data.perspective_analysis_3 }
    ];

    arrays.forEach(({ key, data: arr }) => {
      if (arr !== undefined) {
        if (!Array.isArray(arr)) {
          errors.push(`${key} must be an array`);
        } else {
          // Validate each perspective item
          arr.forEach((item, idx) => {
            if (!item.aspect) {
              errors.push(`${key}[${idx}]: missing aspect field`);
            }
            if (!item.approaches || !Array.isArray(item.approaches)) {
              errors.push(`${key}[${idx}]: missing or invalid approaches array`);
            } else {
              if (item.approaches.length < 2) {
                errors.push(`${key}[${idx}]: approaches must have at least 2 items`);
              }
              // Validate each approach
              item.approaches.forEach((approach, approachIdx) => {
                if (!approach.sources || !Array.isArray(approach.sources)) {
                  errors.push(`${key}[${idx}].approaches[${approachIdx}]: missing or invalid sources array`);
                }
                if (!approach.focus) {
                  errors.push(`${key}[${idx}].approaches[${approachIdx}]: missing focus field`);
                }
              });
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
