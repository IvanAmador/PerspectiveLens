/**
 * PerspectiveLens Notification Manager
 * Intelligent notification system using chrome.notifications API
 *
 * Replaces the old toast-notification.js with native Chrome notifications
 * that follow Material Design 3 guidelines
 */

class NotificationManager {
  constructor() {
    this.activeNotifications = new Map();
    this.notificationQueue = [];
    this.currentAnalysisId = null;
    this.analysisState = {
      stage: null,
      progress: 0,
      articleTitle: null
    };
  }

  /**
   * Show notification or update existing
   * @param {string} id - Unique notification ID
   * @param {object} options - Chrome notification options
   */
  async show(id, options) {
    try {
      // Se já existe, fazer update ao invés de criar nova
      if (this.activeNotifications.has(id)) {
        await chrome.notifications.update(id, options);
      } else {
        await chrome.notifications.create(id, {
          ...options,
          iconUrl: options.iconUrl || chrome.runtime.getURL('images/icon-128.png')
        });
        this.activeNotifications.set(id, options);
      }
    } catch (error) {
      console.error('[NotificationManager] Error showing notification:', error);
    }
  }

  /**
   * Clear notification
   * @param {string} id - Notification ID to clear
   */
  async clear(id) {
    try {
      await chrome.notifications.clear(id);
      this.activeNotifications.delete(id);
    } catch (error) {
      console.error('[NotificationManager] Error clearing notification:', error);
    }
  }

  /**
   * Clear all active notifications
   */
  async clearAll() {
    const ids = Array.from(this.activeNotifications.keys());
    for (const id of ids) {
      await this.clear(id);
    }
  }

  // ============================================================================
  // ANALYSIS LIFECYCLE NOTIFICATIONS
  // ============================================================================

  /**
   * Start analysis notification
   * @param {string} articleTitle - Title of article being analyzed
   */
  async startAnalysis(articleTitle) {
    this.analysisState.articleTitle = articleTitle;
    this.analysisState.stage = 'starting';
    this.analysisState.progress = 0;
    this.currentAnalysisId = 'perspectivelens-analysis';

    await this.show(this.currentAnalysisId, {
      type: 'progress',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: 'PerspectiveLens Analysis',
      message: 'Starting analysis...',
      progress: 0,
      requireInteraction: false
    });
  }

  /**
   * Update search progress
   * @param {object} data - Search progress data
   * @param {number} data.articlesFound - Number of articles found
   * @param {string[]} data.countries - List of country codes
   */
  async updateSearchProgress(data) {
    const { articlesFound, countries } = data;

    this.analysisState.stage = 'searching';
    this.analysisState.progress = 25;

    // Build country flags string (if flags available)
    let countryText = `${countries.length} countries`;
    if (countries.length > 0) {
      // Simple country codes display (flags can be added in Phase 7)
      countryText = countries.slice(0, 5).join(', ');
      if (countries.length > 5) {
        countryText += ` +${countries.length - 5} more`;
      }
    }

    await this.show(this.currentAnalysisId, {
      type: 'progress',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: 'Perspectives Found',
      message: `Found ${articlesFound} articles\n${countryText}`,
      progress: 25,
      requireInteraction: false
    });
  }

  /**
   * Update extraction progress
   * @param {number} current - Current article being extracted
   * @param {number} total - Total articles to extract
   */
  async updateExtractionProgress(current, total) {
    this.analysisState.stage = 'extracting';
    this.analysisState.progress = 25 + Math.floor((current / total) * 25); // 25-50%

    await this.show(this.currentAnalysisId, {
      type: 'progress',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: 'Extracting Content',
      message: `Processing article ${current} of ${total}...`,
      progress: this.analysisState.progress,
      requireInteraction: false
    });
  }

  /**
   * Update analysis stage
   * @param {number} stage - Current stage number (1-4)
   * @param {number} totalStages - Total stages (usually 4)
   */
  async updateAnalysisStage(stage, totalStages = 4) {
    this.analysisState.stage = `analysis-${stage}`;
    this.analysisState.progress = 50 + Math.floor((stage / totalStages) * 40); // 50-90%

    const stageNames = {
      1: 'Extracting Key Claims',
      2: 'Identifying Factual Disputes',
      3: 'Detecting Omitted Facts',
      4: 'Generating Coverage Angles'
    };

    await this.show(this.currentAnalysisId, {
      type: 'progress',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: `Analysis Stage ${stage}/${totalStages}`,
      message: stageNames[stage] || `Processing stage ${stage}...`,
      progress: this.analysisState.progress,
      requireInteraction: false
    });
  }

  /**
   * Complete analysis notification
   * @param {number} articlesCount - Total articles analyzed
   * @param {number} countriesCount - Total countries covered
   */
  async completeAnalysis(articlesCount, countriesCount) {
    // Clear progress notification
    await this.clear(this.currentAnalysisId);

    // Show success notification with action button
    await this.show('perspectivelens-complete', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: 'Analysis Complete!',
      message: `Analyzed ${articlesCount} articles from ${countriesCount} countries`,
      buttons: [
        { title: 'View Results' }
      ],
      requireInteraction: true
    });

    this.currentAnalysisId = null;
    this.analysisState = { stage: null, progress: 0, articleTitle: null };
  }

  /**
   * Fail analysis notification
   * @param {string} errorMessage - Error description
   * @param {boolean} canRetry - Whether retry is possible
   */
  async failAnalysis(errorMessage, canRetry = true) {
    // Clear progress notification
    if (this.currentAnalysisId) {
      await this.clear(this.currentAnalysisId);
    }

    const buttons = [];
    if (canRetry) {
      buttons.push({ title: 'Retry' });
    }
    buttons.push({ title: 'Dismiss' });

    // Show error notification
    await this.show('perspectivelens-error', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: 'Analysis Failed',
      message: errorMessage || 'An error occurred during analysis',
      buttons: buttons,
      requireInteraction: true
    });

    this.currentAnalysisId = null;
    this.analysisState = { stage: null, progress: 0, articleTitle: null };
  }

  // ============================================================================
  // GENERAL PURPOSE NOTIFICATIONS
  // ============================================================================

  /**
   * Show success notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  async showSuccess(title, message) {
    const id = `perspectivelens-success-${Date.now()}`;
    await this.show(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: title || 'Success',
      message: message || '',
      requireInteraction: false
    });

    // Auto-clear after 4 seconds
    setTimeout(() => this.clear(id), 4000);
  }

  /**
   * Show error notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Array} actions - Optional action buttons
   */
  async showError(title, message, actions = []) {
    const id = `perspectivelens-error-${Date.now()}`;

    const buttons = actions.length > 0
      ? actions.map(action => ({ title: action.label || action.title }))
      : undefined;

    await this.show(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: title || 'Error',
      message: message || '',
      buttons: buttons,
      requireInteraction: true
    });
  }

  /**
   * Show warning notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  async showWarning(title, message) {
    const id = `perspectivelens-warning-${Date.now()}`;
    await this.show(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: title || 'Warning',
      message: message || '',
      requireInteraction: false
    });

    // Auto-clear after 5 seconds
    setTimeout(() => this.clear(id), 5000);
  }

  /**
   * Show info notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  async showInfo(title, message) {
    const id = `perspectivelens-info-${Date.now()}`;
    await this.show(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: title || 'Info',
      message: message || '',
      requireInteraction: false
    });

    // Auto-clear after 4 seconds
    setTimeout(() => this.clear(id), 4000);
  }

  // ============================================================================
  // LEGACY COMPATIBILITY (for gradual migration)
  // ============================================================================

  /**
   * Legacy: Show article detected notification
   * NOTE: Chrome notifications don't support custom callbacks,
   * so this will need to work differently - buttons trigger message to content script
   */
  async showArticleDetected() {
    await this.show('perspectivelens-article-detected', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon-128.png'),
      title: 'Article Detected',
      message: 'Ready to analyze perspectives from multiple sources',
      buttons: [
        { title: 'Analyze' },
        { title: 'Dismiss' }
      ],
      requireInteraction: true
    });
  }

  /**
   * Legacy: Show analysis started
   */
  async showAnalysisStarted() {
    await this.showInfo(
      'Analysis Started',
      'Extracting content and searching perspectives...'
    );
  }
}

// Singleton export
export const notificationManager = new NotificationManager();

// Legacy compatibility wrapper (for window global access)
if (typeof window !== 'undefined') {
  window.PerspectiveLensNotifications = notificationManager;
}

console.log('[PerspectiveLens] NotificationManager loaded');
