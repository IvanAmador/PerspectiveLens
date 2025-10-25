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
        <div class="pl-list-item" data-index="${idx}">
          <p class="pl-list-item-title">${escapeHtml(item.angle)}</p>
          <div class="pl-perspective-groups">
            <div class="pl-perspective-group">
              <div class="pl-group-label">Perspective 1</div>
              <div class="pl-group-text">${escapeHtml(item.group1)}</div>
              ${group1Tags ? `<div class="pl-group-sources">${group1Tags}</div>` : ''}
            </div>
            <div class="pl-perspective-group">
              <div class="pl-group-label">Perspective 2</div>
              <div class="pl-group-text">${escapeHtml(item.group2)}</div>
              ${group2Tags ? `<div class="pl-group-sources">${group2Tags}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div id="pl-stage-4" class="pl-stage" data-stage="4">
        <div class="pl-section">
          <h3 class="pl-section-title">
            Coverage Angles
            <span class="pl-badge">${coverage_angles.length}</span>
          </h3>
          <p class="pl-section-desc">Different approaches in how sources frame this story</p>
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
