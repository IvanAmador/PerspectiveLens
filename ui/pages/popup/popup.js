/**
 * PerspectiveLens Popup Script
 * Simple model selection and API key management
 * Detailed model preferences are managed in Options page
 */

console.log('[Popup] Script loading...');

import { APIKeyManager } from '../../../config/apiKeyManager.js';
import { ConfigManager } from '../../../config/configManager.js';

console.log('[Popup] Imports loaded successfully');

class PopupManager {
  constructor() {
    this.selectedModel = 'api'; // 'nano' or 'api'
    this.elements = this.getElements();
    this.init();
  }

  /**
   * Get all DOM elements
   */
  getElements() {
    return {
      // Model tabs
      tabNano: document.getElementById('tab-nano'),
      tabApi: document.getElementById('tab-api'),

      // Common
      refreshStatus: document.getElementById('refresh-status'),
      settingsBtn: document.getElementById('settings-btn'),

      // Nano card
      nanoCard: document.getElementById('nano-card'),
      nanoStatus: document.getElementById('nano-status'),
      nanoProgress: document.getElementById('nano-progress'),
      nanoProgressFill: document.getElementById('nano-progress-fill'),
      nanoProgressPercent: document.getElementById('nano-progress-percent'),
      nanoDownloadBtn: document.getElementById('nano-download-btn'),

      // API card
      apiCard: document.getElementById('api-card'),
      apiStatus: document.getElementById('api-status'),
      apiKeyInput: document.getElementById('api-key-input'),
      apiKeyField: document.getElementById('api-key'),
      toggleVisibility: document.getElementById('toggle-visibility'),
      saveKeyBtn: document.getElementById('save-key-btn'),
      validationMsg: document.getElementById('validation-msg')
    };
  }

  /**
   * Initialize popup
   */
  async init() {
    console.log('[PerspectiveLens] Initializing popup...');

    try {
      // Load selected model from config
      const config = await ConfigManager.load();
      this.selectedModel = config.analysis.modelProvider === 'nano' ? 'nano' : 'api';

      // Setup event listeners
      this.setupEventListeners();

      // Update UI
      await this.updateUI();

      console.log('[PerspectiveLens] Popup initialized successfully');
    } catch (error) {
      console.error('[PerspectiveLens] Failed to initialize popup:', error);
    }
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Model tabs
    this.elements.tabNano?.addEventListener('click', () => this.switchModel('nano'));
    this.elements.tabApi?.addEventListener('click', () => this.switchModel('api'));

    // Refresh status
    this.elements.refreshStatus?.addEventListener('click', () => this.updateUI());

    // Settings button
    this.elements.settingsBtn?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('ui/pages/options/options.html') });
    });

    // Nano download
    this.elements.nanoDownloadBtn?.addEventListener('click', () => this.startNanoDownload());

    // API key handlers
    this.elements.toggleVisibility?.addEventListener('click', () => this.toggleApiKeyVisibility());
    this.elements.saveKeyBtn?.addEventListener('click', () => this.saveApiKey());

    // Enter key to save API key
    this.elements.apiKeyField?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveApiKey();
      }
    });
  }

  /**
   * Switch between models
   */
  async switchModel(model) {
    console.log(`[PerspectiveLens] Switching to ${model}...`);

    this.selectedModel = model;

    try {
      // Save to config
      const modelProvider = model === 'nano' ? 'nano' : 'api';
      await ConfigManager.set('analysis.modelProvider', modelProvider);

      // Update UI
      await this.updateUI();

      console.log(`[PerspectiveLens] Switched to ${model}`);
    } catch (error) {
      console.error('[PerspectiveLens] Failed to switch model:', error);
    }
  }

  /**
   * Update entire UI
   */
  async updateUI() {
    try {
      console.log('[Popup] Updating UI for model:', this.selectedModel);

      // Update model tabs
      this.updateModelTabs();

      // Show/hide model cards
      this.elements.nanoCard.style.display =
        this.selectedModel === 'nano' ? 'block' : 'none';
      this.elements.apiCard.style.display =
        this.selectedModel === 'api' ? 'block' : 'none';

      // Update status for selected model
      if (this.selectedModel === 'nano') {
        await this.updateNanoStatus();
      } else {
        await this.updateApiStatus();
      }
    } catch (error) {
      console.error('[PerspectiveLens] Failed to update UI:', error);
    }
  }

  /**
   * Update model tabs
   */
  updateModelTabs() {
    const tabs = [this.elements.tabNano, this.elements.tabApi];

    tabs.forEach(tab => {
      if (tab) {
        const tabModel = tab.dataset.model;
        const isActive = tabModel === this.selectedModel;
        tab.classList.toggle('active', isActive);
      }
    });
  }

  /**
   * Update Gemini Nano status
   */
  async updateNanoStatus() {
    try {
      console.log('[Popup] Requesting Nano status from background...');
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

      console.log('[Popup] Nano status response:', response);

      if (!response || !response.success) {
        console.error('[Popup] Failed to get status:', response);
        this.setNanoStatus('error', 'Error checking status');
        return;
      }

      const { aiStatus } = response.status;

      // Handle different availability states
      switch (aiStatus.availability) {
        case 'readily':
        case 'ready':
        case 'available':
          this.setNanoStatus('success', 'Ready');
          this.elements.nanoDownloadBtn.style.display = 'none';
          this.elements.nanoProgress.style.display = 'none';
          break;

        case 'after-download':
        case 'download':
        case 'downloadable':
          this.setNanoStatus('warning', 'Download required');
          this.elements.nanoDownloadBtn.style.display = 'block';
          this.elements.nanoProgress.style.display = 'none';
          break;

        case 'downloading':
          this.setNanoStatus('info', 'Downloading...');
          this.elements.nanoDownloadBtn.style.display = 'none';
          this.elements.nanoProgress.style.display = 'flex';
          if (aiStatus.downloadProgress) {
            this.updateNanoProgress(aiStatus.downloadProgress);
          }
          break;

        case 'no':
        case 'unavailable':
          this.setNanoStatus('error', 'Unavailable');
          this.elements.nanoDownloadBtn.style.display = 'none';
          this.elements.nanoProgress.style.display = 'none';
          break;

        default:
          this.setNanoStatus('error', `Unknown status: ${aiStatus.availability}`);
          this.elements.nanoDownloadBtn.style.display = 'none';
          this.elements.nanoProgress.style.display = 'none';
      }
    } catch (error) {
      console.error('[PerspectiveLens] Failed to update Nano status:', error);
      this.setNanoStatus('error', 'Error checking status');
    }
  }

  /**
   * Set Nano status
   */
  setNanoStatus(type, message) {
    const statusEl = this.elements.nanoStatus;

    const types = {
      success: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
        class: 'success'
      },
      warning: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        class: 'warning'
      },
      info: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        class: 'info'
      },
      error: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
        class: 'error'
      }
    };

    const config = types[type] || types.error;

    // Icon on the right
    statusEl.innerHTML = `
      <span>${message}</span>
      <span class="status-icon ${config.class}">${config.icon}</span>
    `;
  }

  /**
   * Update Nano download progress
   */
  updateNanoProgress(percent) {
    this.elements.nanoProgressFill.style.width = `${percent}%`;
    this.elements.nanoProgressPercent.textContent = `${percent}%`;
  }

  /**
   * Start Nano model download
   */
  async startNanoDownload() {
    console.log('[PerspectiveLens] Starting Nano download...');

    try {
      this.elements.nanoDownloadBtn.style.display = 'none';
      this.elements.nanoProgress.style.display = 'flex';
      this.setNanoStatus('info', 'Starting download...');

      const response = await chrome.runtime.sendMessage({ type: 'START_MODEL_DOWNLOAD' });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Download failed');
      }

      // Poll for progress
      const pollInterval = setInterval(async () => {
        const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

        if (status && status.success) {
          const { aiStatus } = status.status;

          if (aiStatus.availability === 'downloading' && aiStatus.downloadProgress) {
            this.updateNanoProgress(aiStatus.downloadProgress);
          } else if (aiStatus.availability === 'ready' || aiStatus.availability === 'available') {
            clearInterval(pollInterval);
            await this.updateNanoStatus();
          }
        }
      }, 1000);

      // Timeout after 30 minutes
      setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);

    } catch (error) {
      console.error('[PerspectiveLens] Download failed:', error);
      this.setNanoStatus('error', 'Download failed');
      this.elements.nanoDownloadBtn.style.display = 'block';
      this.elements.nanoProgress.style.display = 'none';
    }
  }

  /**
   * Update API status
   */
  async updateApiStatus() {
    try {
      const apiKey = await APIKeyManager.load();

      console.log('[Popup] API status - has API key:', !!apiKey);

      if (!apiKey) {
        // No API key configured - expand to show input
        this.setApiStatus('warning', 'Not Configured');
        this.elements.apiKeyInput.style.display = 'block';
        return;
      }

      // API key configured - check status
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

      if (response && response.success && response.status.aiStatus) {
        const { aiStatus } = response.status;

        switch (aiStatus.availability) {
          case 'ready':
            this.setApiStatus('success', 'Connected');
            break;
          case 'invalid-key':
            this.setApiStatus('error', 'Invalid API Key');
            break;
          default:
            this.setApiStatus('error', 'Connection Error');
        }
      } else {
        this.setApiStatus('success', 'Configured');
      }

      // Keep card compact when API key is configured
      this.elements.apiKeyInput.style.display = 'none';

    } catch (error) {
      console.error('[PerspectiveLens] Failed to update API status:', error);
      this.setApiStatus('error', 'Error checking status');
    }
  }

  /**
   * Set API status
   */
  setApiStatus(type, message) {
    const statusEl = this.elements.apiStatus;

    const types = {
      success: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
        class: 'success'
      },
      warning: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        class: 'warning'
      },
      error: {
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
        class: 'error'
      }
    };

    const config = types[type] || types.warning;

    // Icon on the right
    statusEl.innerHTML = `
      <span>${message}</span>
      <span class="status-icon ${config.class}">${config.icon}</span>
    `;
  }

  /**
   * Toggle API key visibility
   */
  toggleApiKeyVisibility() {
    const input = this.elements.apiKeyField;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
  }

  /**
   * Save API key
   */
  async saveApiKey() {
    const apiKey = this.elements.apiKeyField.value.trim();

    if (!apiKey) {
      this.showValidation('error', 'Please enter an API key');
      return;
    }

    this.showValidation('validating', 'Validating API key...');

    try {
      // Validate with background service
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_API_KEY',
        apiKey
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Validation failed');
      }

      if (response.isValid) {
        // Save the key
        await APIKeyManager.save(apiKey);

        this.showValidation('success', 'API key saved successfully!');

        // Clear input
        this.elements.apiKeyField.value = '';

        // Update UI after short delay
        setTimeout(() => this.updateUI(), 1500);
      } else {
        this.showValidation('error', response.error || 'Invalid API key');
      }
    } catch (error) {
      console.error('[PerspectiveLens] API key validation failed:', error);
      this.showValidation('error', `Validation failed: ${error.message}`);
    }
  }

  /**
   * Show validation status
   */
  showValidation(type, message) {
    const msgEl = this.elements.validationMsg;

    msgEl.className = `validation-message ${type}`;
    msgEl.style.display = 'block';
    msgEl.textContent = message;

    // Hide after 5 seconds (except for validating state)
    if (type !== 'validating') {
      setTimeout(() => {
        msgEl.style.display = 'none';
      }, 5000);
    }
  }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[PerspectiveLens] Popup DOM loaded, initializing...');
  window.popupManager = new PopupManager();
});
