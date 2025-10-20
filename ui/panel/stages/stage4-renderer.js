/**
 * Stage 4 Renderer: Coverage Angles
 *
 * Renders different angles or approaches in news coverage.
 * Helps readers understand different perspectives and framing.
 */

export class Stage4Renderer {
  /**
   * Render Stage 4: Coverage Angles
   * @param {Object} data - { coverage_angles: Array<{angle, group1, group1_sources, group2, group2_sources}> }
   * @param {Function} escapeHtml - HTML escape function
   * @param {Function} renderSourceTag - Source tag renderer
   * @returns {string} HTML
   */
  static render(data, escapeHtml, renderSourceTag) {
    const { coverage_angles } = data;

    // Empty state
    if (!coverage_angles || coverage_angles.length === 0) {
      return `
        <div id="pl-stage-4" class="pl-stage" data-stage="4">
          <div class="pl-section">
            <div class="pl-section-header">
              <h3 class="pl-section-title">
                <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                Coverage Angles
              </h3>
              <span class="pl-badge pl-badge-success">0</span>
            </div>
            <p class="pl-section-desc">Sources cover this story with similar approaches and framing</p>
          </div>
        </div>
      `;
    }

    // Render coverage angle items
    const angleItems = coverage_angles.map((item, idx) => {
      const group1Tags = (item.group1_sources || []).map(s => renderSourceTag(s)).join('');
      const group2Tags = (item.group2_sources || []).map(s => renderSourceTag(s)).join('');

      return `
        <div class="pl-list-item pl-list-item-perspective" data-index="${idx}">
          <h4 class="pl-list-item-title">${escapeHtml(item.angle)}</h4>
          <div class="pl-perspective-approaches">
            <div class="pl-approach">
              <p class="pl-approach-text">${escapeHtml(item.group1)}</p>
              <div class="pl-sources-tags">
                ${group1Tags}
              </div>
            </div>
            <div class="pl-approach">
              <p class="pl-approach-text">${escapeHtml(item.group2)}</p>
              <div class="pl-sources-tags">
                ${group2Tags}
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
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              Coverage Angles
            </h3>
            <span class="pl-badge pl-badge-info">${coverage_angles.length}</span>
          </div>
          <p class="pl-section-desc">Different approaches in how sources frame or emphasize the story</p>
          <div class="pl-list">
            ${angleItems}
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
      name: 'Coverage Angles',
      description: 'Different approaches in how sources frame or emphasize the story',
      requiredFields: ['coverage_angles']
    };
  }

  /**
   * Validate stage data
   */
  static validate(data) {
    const errors = [];

    if (data.coverage_angles === undefined) {
      errors.push('Missing coverage_angles array');
    } else if (!Array.isArray(data.coverage_angles)) {
      errors.push('coverage_angles must be an array');
    } else {
      // Validate each angle item
      data.coverage_angles.forEach((item, idx) => {
        if (!item.angle) {
          errors.push(`coverage_angles[${idx}]: missing angle field`);
        }
        if (!item.group1) {
          errors.push(`coverage_angles[${idx}]: missing group1`);
        }
        if (!item.group1_sources || !Array.isArray(item.group1_sources)) {
          errors.push(`coverage_angles[${idx}]: missing or invalid group1_sources array`);
        }
        if (!item.group2) {
          errors.push(`coverage_angles[${idx}]: missing group2`);
        }
        if (!item.group2_sources || !Array.isArray(item.group2_sources)) {
          errors.push(`coverage_angles[${idx}]: missing or invalid group2_sources array`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
