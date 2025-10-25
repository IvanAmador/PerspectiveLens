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

    // Trust signal configuration - subtle and professional
    const trustConfig = {
      'high_agreement': {
        label: 'High Agreement',
        description: 'Coverage is largely consistent across multiple sources'
      },
      'some_conflicts': {
        label: 'Some Conflicts',
        description: 'Some variations in coverage between sources'
      },
      'major_disputes': {
        label: 'Major Disputes',
        description: 'Significant differences in how sources report this story'
      }
    };

    const trust = trustConfig[trust_signal] || trustConfig['some_conflicts'];

    return `
      <div id="pl-stage-1" class="pl-stage" data-stage="1">
        <!-- Story Summary -->
        <div class="pl-card pl-card-summary">
          <h3 class="pl-card-title">
            Story Summary
          </h3>
          <p class="pl-main-story">${escapeHtml(story_summary)}</p>

          <!-- Trust Signal - Clean & Subtle -->
          <div class="pl-trust-signal">
            <div class="pl-trust-header">
              <span class="pl-trust-label">${trust.label}</span>
            </div>
            <p class="pl-trust-description">${trust.description}</p>
          </div>

          ${reader_action ? `
            <div class="pl-reader-action">
              <strong>What to watch for:</strong> ${escapeHtml(reader_action)}
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
