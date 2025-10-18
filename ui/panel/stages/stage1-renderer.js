/**
 * Stage 1 Renderer: Context & Trust Signal
 *
 * Renders:
 * - Story summary (one-sentence neutral summary)
 * - Trust signal (high_agreement, some_conflicts, major_disputes)
 * - Reader action (what the reader should do)
 */

export class Stage1Renderer {
  /**
   * Render Stage 1: Context & Trust Signal
   * @param {Object} data - { story_summary, trust_signal, reader_action }
   * @param {Function} escapeHtml - HTML escape function
   * @returns {string} HTML
   */
  static render(data, escapeHtml) {
    const { story_summary, trust_signal, reader_action } = data;

    if (!story_summary) {
      console.warn('[Stage1] No story_summary provided');
      return '';
    }

    const trustBadges = {
      'high_agreement': {
        label: 'High Agreement',
        class: 'success',
        icon: 'check-circle'
      },
      'some_conflicts': {
        label: 'Some Conflicts',
        class: 'warning',
        icon: 'alert-circle'
      },
      'major_disputes': {
        label: 'Major Disputes',
        class: 'error',
        icon: 'alert-triangle'
      }
    };

    const badge = trustBadges[trust_signal] || trustBadges['some_conflicts'];

    return `
      <div id="pl-stage-1" class="pl-stage" data-stage="1">
        <div class="pl-card pl-card-summary">
          <div class="pl-card-header">
            <h3 class="pl-card-title">
              <svg class="pl-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              Story Summary
            </h3>
            <span class="pl-badge pl-badge-${badge.class}">${badge.label}</span>
          </div>
          <p class="pl-summary-text">${escapeHtml(story_summary)}</p>
          ${reader_action ? `
            <div class="pl-reader-action">
              <svg class="pl-icon pl-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>${escapeHtml(reader_action)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get stage metadata
   */
  static getMetadata() {
    return {
      stage: 1,
      name: 'Context & Trust Signal',
      description: 'Initial story summary and trust assessment',
      requiredFields: ['story_summary', 'trust_signal', 'reader_action']
    };
  }

  /**
   * Validate stage data
   */
  static validate(data) {
    const errors = [];

    if (!data.story_summary) {
      errors.push('Missing story_summary');
    }

    if (!data.trust_signal) {
      errors.push('Missing trust_signal');
    } else if (!['high_agreement', 'some_conflicts', 'major_disputes'].includes(data.trust_signal)) {
      errors.push(`Invalid trust_signal: ${data.trust_signal}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
