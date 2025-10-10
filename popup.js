/**
 * PerspectiveLens Popup UI Controller
 * Manages extension popup interface - displays status from background worker
 *
 * IMPORTANT: The popup does NOT control downloads!
 * Downloads happen in background.js service worker, popup only shows status.
 */

import { logger } from './utils/logger.js';
import { handleError } from './utils/errors.js';

/**
 * UI Elements
 */
const elements = {
  // AI Models
  aiStatusCard: null,
  modelsStatus: null,
  downloadProgress: null,
  progressFill: null,
  progressPercent: null,
  progressSize: null,
  downloadBtn: null,
  refreshBtn: null,

  // NewsAPI
  apiKeyStatus: null,
  setupApiKeyLink: null,

  // Statistics
  articlesAnalyzed: null,
  cacheCount: null,
  perspectivesFound: null,

  // Actions
  clearCacheBtn: null,
  openSettingsBtn: null,

  // Footer
  helpLink: null,
  aboutLink: null
};

/**
 * Status polling interval
 */
let statusInterval = null;
const POLL_INTERVAL = 2000; // Check every 2 seconds

/**
 * Initialize popup when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Popup opened');

  // Get all DOM elements
  initializeElements();

  // Setup event listeners
  setupEventListeners();

  // Load initial status
  await loadStatus();

  // Start status polling (for background downloads)
  startStatusPolling();
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
  // AI Models section
  elements.aiStatusCard = document.getElementById('ai-status-card');
  elements.modelsStatus = document.getElementById('models-status');
  elements.downloadProgress = document.getElementById('download-progress');
  elements.progressFill = document.getElementById('progress-fill');
  elements.progressPercent = document.getElementById('progress-percent');
  elements.progressSize = document.getElementById('progress-size');
  elements.downloadBtn = document.getElementById('download-model');
  elements.refreshBtn = document.getElementById('refresh-status');

  // NewsAPI section
  elements.apiKeyStatus = document.getElementById('api-key-status');
  elements.setupApiKeyLink = document.getElementById('setup-api-key');

  // Statistics
  elements.articlesAnalyzed = document.getElementById('articles-analyzed');
  elements.cacheCount = document.getElementById('cache-count');
  elements.perspectivesFound = document.getElementById('perspectives-found');

  // Actions
  elements.clearCacheBtn = document.getElementById('clear-cache');
  elements.openSettingsBtn = document.getElementById('open-settings');

  // Footer
  elements.helpLink = document.getElementById('help-link');
  elements.aboutLink = document.getElementById('about-link');
}

/**
 * Setup UI event listeners
 */
function setupEventListeners() {
  // Refresh status button
  elements.refreshBtn?.addEventListener('click', () => {
    logger.debug('Manual refresh requested');
    loadStatus();
  });

  // Download model button
  elements.downloadBtn?.addEventListener('click', handleDownloadModel);

  // Clear cache button
  elements.clearCacheBtn?.addEventListener('click', handleClearCache);

  // Settings button
  elements.openSettingsBtn?.addEventListener('click', () => {
    // TODO: Open settings page
    logger.info('Settings clicked (not implemented yet)');
  });

  // Setup API key link
  elements.setupApiKeyLink?.addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: Open API key setup
    logger.info('API key setup clicked (not implemented yet)');
  });

  // Help link
  elements.helpLink?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/yourusername/PerspectiveLens/blob/main/README.md' });
  });

  // About link
  elements.aboutLink?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/yourusername/PerspectiveLens' });
  });
}

/**
 * Load and display extension status from background worker
 */
async function loadStatus() {
  try {
    // Request status from background worker
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (response && response.success) {
      const status = response.status;

      // Update AI models status
      updateAIStatus(status.aiStatus);

      // Update API key status
      updateAPIKeyStatus(status.apiKeySet);

      // Update statistics
      updateStatistics(status.stats);
    } else {
      logger.error('Failed to get status:', response?.error);
      showError('Failed to load status');
    }

  } catch (error) {
    logger.error('Status load error:', error);
    handleError(error, 'loadStatus');
    showError('Error loading status');
  }
}

/**
 * Update AI models status display
 */
function updateAIStatus(aiStatus) {
  if (!aiStatus) {
    showAIError('Status unavailable');
    return;
  }

  const { availability, downloadProgress } = aiStatus;

  // Clear previous state
  elements.aiStatusCard?.classList.remove('success', 'error', 'downloading');
  elements.downloadProgress.style.display = 'none';
  elements.downloadBtn.style.display = 'none';

  switch (availability) {
    case 'available':
      showAISuccess('Downloaded');
      elements.aiStatusCard?.classList.add('success');
      break;

    case 'unavailable':
      showAIError('Unavailable');
      elements.aiStatusCard?.classList.add('error');
      elements.modelsStatus.innerHTML = `
        <span class="badge badge-error">Unavailable</span>
      `;
      break;

    case 'downloadable':
      showAIDownloadable();
      break;

    case 'downloading':
      showAIDownloading(downloadProgress || 0);
      elements.aiStatusCard?.classList.add('downloading');
      break;

    default:
      showAIError('Unknown status');
  }
}

/**
 * Show AI model is ready
 */
function showAISuccess(message) {
  elements.modelsStatus.innerHTML = `
    <span class="badge badge-success">${message}</span>
  `;
}

/**
 * Show AI model error
 */
function showAIError(message) {
  elements.modelsStatus.innerHTML = `
    <span class="badge badge-error">${message}</span>
  `;
}

/**
 * Show AI model is downloadable
 */
function showAIDownloadable() {
  elements.modelsStatus.innerHTML = `
    <span class="badge badge-warning">Not downloaded</span>
  `;
  elements.downloadBtn.style.display = 'block';
}

/**
 * Show AI model is downloading with progress
 */
function showAIDownloading(progress) {
  elements.modelsStatus.innerHTML = `
    <span class="badge badge-info">Downloading...</span>
  `;

  // Show progress bar
  elements.downloadProgress.style.display = 'flex';
  elements.progressFill.style.width = `${progress}%`;
  elements.progressPercent.textContent = `${progress}%`;

  // Calculate downloaded size (22 GB total)
  const downloadedGB = (22 * progress / 100).toFixed(1);
  elements.progressSize.textContent = `${downloadedGB} GB / 22 GB`;
}

/**
 * Handle download model button click
 * Triggers download in BACKGROUND worker
 */
async function handleDownloadModel() {
  try {
    logger.info('Requesting model download from background...');

    elements.downloadBtn.disabled = true;
    elements.downloadBtn.textContent = 'Starting download...';

    // Request background worker to start download
    const response = await chrome.runtime.sendMessage({
      type: 'START_MODEL_DOWNLOAD'
    });

    if (response && response.success) {
      logger.info('Model download started in background');
      elements.downloadBtn.style.display = 'none';

      // Status polling will update the UI automatically
      loadStatus();
    } else {
      throw new Error(response?.error || 'Download failed to start');
    }

  } catch (error) {
    logger.error('Failed to start download:', error);
    handleError(error, 'handleDownloadModel');

    elements.downloadBtn.disabled = false;
    elements.downloadBtn.textContent = 'Download AI Model';
    showError('Failed to start download');
  }
}

/**
 * Update API key status
 */
function updateAPIKeyStatus(hasKey) {
  if (hasKey) {
    elements.apiKeyStatus.innerHTML = `
      <span class="badge badge-success">Configured</span>
    `;
  } else {
    elements.apiKeyStatus.innerHTML = `
      <span class="badge badge-warning">Not configured</span>
    `;
  }
}

/**
 * Update statistics display
 */
function updateStatistics(stats) {
  if (!stats) return;

  elements.articlesAnalyzed.textContent = stats.articlesAnalyzed || 0;
  elements.cacheCount.textContent = stats.cacheCount || 0;
  elements.perspectivesFound.textContent = stats.perspectivesFound || 0;
}

/**
 * Handle clear cache button
 */
async function handleClearCache() {
  try {
    const confirmed = confirm('Clear all cached analyses? This cannot be undone.');
    if (!confirmed) return;

    logger.info('Clearing cache...');

    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE'
    });

    if (response && response.success) {
      logger.info('Cache cleared successfully');

      // Update display
      elements.cacheCount.textContent = '0';

      // Show success feedback
      const originalText = elements.clearCacheBtn.innerHTML;
      elements.clearCacheBtn.innerHTML = '✓ Cleared';
      setTimeout(() => {
        elements.clearCacheBtn.innerHTML = originalText;
      }, 2000);
    } else {
      throw new Error(response?.error || 'Clear cache failed');
    }

  } catch (error) {
    logger.error('Failed to clear cache:', error);
    handleError(error, 'handleClearCache');
    showError('Failed to clear cache');
  }
}

/**
 * Start polling for status updates
 * This allows popup to show progress even if closed and reopened
 */
function startStatusPolling() {
  // Clear any existing interval
  if (statusInterval) {
    clearInterval(statusInterval);
  }

  // Poll every 2 seconds
  statusInterval = setInterval(async () => {
    await loadStatus();
  }, POLL_INTERVAL);

  logger.debug('Status polling started');
}

/**
 * Stop status polling when popup closes
 */
window.addEventListener('unload', () => {
  if (statusInterval) {
    clearInterval(statusInterval);
    logger.debug('Status polling stopped');
  }
});

/**
 * Show error message (simple alert for now)
 */
function showError(message) {
  // TODO: Replace with nicer UI notification
  alert(message);
}

/**
 * Handle popup errors
 */
window.addEventListener('error', (event) => {
  logger.error('Unhandled error in popup:', event.error);
  handleError(event.error, 'Popup');
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection in popup:', event.reason);
  handleError(event.reason, 'Popup:Promise');
});

logger.info('Popup initialized');
