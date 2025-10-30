/**
 * Settings Modal Controller
 * Handles UI interactions for the settings modal
 */

import { ConfigManager } from '../../../config/configManager.js';

// Country data
const COUNTRIES = [
  { code: 'AE', name: 'United Arab Emirates', language: 'ar', flag: '🇦🇪' },
  { code: 'AR', name: 'Argentina', language: 'es', flag: '🇦🇷' },
  { code: 'AT', name: 'Austria', language: 'de', flag: '🇦🇹' },
  { code: 'AU', name: 'Australia', language: 'en', flag: '🇦🇺' },
  { code: 'BD', name: 'Bangladesh', language: 'bn', flag: '🇧🇩' },
  { code: 'BE', name: 'Belgium', language: 'nl', flag: '🇧🇪' },
  { code: 'BG', name: 'Bulgaria', language: 'bg', flag: '🇧🇬' },
  { code: 'BR', name: 'Brazil', language: 'pt', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', language: 'en', flag: '🇨🇦' },
  { code: 'CH', name: 'Switzerland', language: 'de', flag: '🇨🇭' },
  { code: 'CL', name: 'Chile', language: 'es', flag: '🇨🇱' },
  { code: 'CN', name: 'China', language: 'zh-CN', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', language: 'es', flag: '🇨🇴' },
  { code: 'CZ', name: 'Czech Republic', language: 'cs', flag: '🇨🇿' },
  { code: 'DE', name: 'Germany', language: 'de', flag: '🇩🇪' },
  { code: 'DK', name: 'Denmark', language: 'da', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', language: 'ar', flag: '🇪🇬' },
  { code: 'ES', name: 'Spain', language: 'es', flag: '🇪🇸' },
  { code: 'FI', name: 'Finland', language: 'fi', flag: '🇫🇮' },
  { code: 'FR', name: 'France', language: 'fr', flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom', language: 'en', flag: '🇬🇧' },
  { code: 'GR', name: 'Greece', language: 'el', flag: '🇬🇷' },
  { code: 'HK', name: 'Hong Kong', language: 'zh-HK', flag: '🇭🇰' },
  { code: 'HR', name: 'Croatia', language: 'hr', flag: '🇭🇷' },
  { code: 'HU', name: 'Hungary', language: 'hu', flag: '🇭🇺' },
  { code: 'ID', name: 'Indonesia', language: 'id', flag: '🇮🇩' },
  { code: 'IE', name: 'Ireland', language: 'en', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', language: 'he', flag: '🇮🇱' },
  { code: 'IN', name: 'India', language: 'en', flag: '🇮🇳' },
  { code: 'IT', name: 'Italy', language: 'it', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', language: 'ja', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', language: 'ko', flag: '🇰🇷' },
  { code: 'LT', name: 'Lithuania', language: 'lt', flag: '🇱🇹' },
  { code: 'MX', name: 'Mexico', language: 'es', flag: '🇲🇽' },
  { code: 'MY', name: 'Malaysia', language: 'en', flag: '🇲🇾' },
  { code: 'NL', name: 'Netherlands', language: 'nl', flag: '🇳🇱' },
  { code: 'NO', name: 'Norway', language: 'no', flag: '🇳🇴' },
  { code: 'NZ', name: 'New Zealand', language: 'en', flag: '🇳🇿' },
  { code: 'PL', name: 'Poland', language: 'pl', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', language: 'pt', flag: '🇵🇹' },
  { code: 'RO', name: 'Romania', language: 'ro', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', language: 'ru', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', language: 'ar', flag: '🇸🇦' },
  { code: 'SE', name: 'Sweden', language: 'sv', flag: '🇸🇪' },
  { code: 'SG', name: 'Singapore', language: 'en', flag: '🇸🇬' },
  { code: 'SI', name: 'Slovenia', language: 'sl', flag: '🇸🇮' },
  { code: 'SK', name: 'Slovakia', language: 'sk', flag: '🇸🇰' },
  { code: 'TH', name: 'Thailand', language: 'th', flag: '🇹🇭' },
  { code: 'TR', name: 'Turkey', language: 'tr', flag: '🇹🇷' },
  { code: 'TW', name: 'Taiwan', language: 'zh-TW', flag: '🇹🇼' },
  { code: 'UA', name: 'Ukraine', language: 'uk', flag: '🇺🇦' },
  { code: 'US', name: 'United States', language: 'en', flag: '🇺🇸' },
  { code: 'VN', name: 'Vietnam', language: 'vi', flag: '🇻🇳' },
  { code: 'ZA', name: 'South Africa', language: 'en', flag: '🇿🇦' }
];

export class SettingsModal {
  constructor() {
    this.modal = null;
    this.currentConfig = null;
    this.originalConfig = null;
    this.isDirty = false;

    this.elements = {};
  }

  /**
   * Initialize the modal
   */
  async init() {
    // Load modal HTML
    await this.loadModalHTML();

    // Cache DOM elements
    this.cacheElements();

    // Setup event listeners
    this.setupEventListeners();

    console.log('[SettingsModal] Initialized');
  }

  /**
   * Load modal HTML into the page
   */
  async loadModalHTML() {
    try {
      const response = await fetch(chrome.runtime.getURL('ui/pages/options/settings-modal.html'));
      const html = await response.text();

      // Create container and insert HTML
      const container = document.createElement('div');
      container.innerHTML = html;

      // Add to body
      document.body.appendChild(container.firstElementChild);

      this.modal = document.getElementById('settings-modal');
    } catch (error) {
      console.error('[SettingsModal] Error loading modal HTML:', error);
    }
  }

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      modal: document.getElementById('settings-modal'),
      overlay: document.getElementById('modal-overlay'),
      closeBtn: document.getElementById('close-settings'),
      cancelBtn: document.getElementById('cancel-settings'),
      saveBtn: document.getElementById('save-settings'),
      resetBtn: document.getElementById('reset-defaults'),
      exportBtn: document.getElementById('export-config'),
      importBtn: document.getElementById('import-config'),
      importFileInput: document.getElementById('import-file-input'),

      // Navigation
      navItems: document.querySelectorAll('.nav-item'),
      sections: document.querySelectorAll('.settings-section'),

      // Countries
      countryList: document.getElementById('country-list'),
      countrySearch: document.getElementById('country-search'),
      selectedCount: document.getElementById('selected-count'),
      totalArticles: document.getElementById('total-articles'),
      bufferPerCountry: document.getElementById('buffer-per-country'),
      maxForAnalysis: document.getElementById('max-for-analysis'),
      allowFallback: document.getElementById('allow-fallback'),

      // Extraction
      minContentLength: document.getElementById('min-content-length'),
      maxContentLength: document.getElementById('max-content-length'),
      minWordCount: document.getElementById('min-word-count'),
      timeout: document.getElementById('timeout'),

      // Analysis
      compressionRadios: document.querySelectorAll('input[name="compression"]'),
      temperature: document.getElementById('temperature'),
      temperatureValue: document.getElementById('temperature-value'),
      topK: document.getElementById('top-k'),
      topKValue: document.getElementById('top-k-value'),

      // Toast
      toast: document.getElementById('settings-toast'),
      toastIcon: document.getElementById('toast-icon'),
      toastTitle: document.getElementById('toast-title'),
      toastMessage: document.getElementById('toast-message')
    };
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Close modal
    this.elements.closeBtn?.addEventListener('click', () => this.close());
    this.elements.cancelBtn?.addEventListener('click', () => this.close());
    this.elements.overlay?.addEventListener('click', () => this.close());

    // Save settings
    this.elements.saveBtn?.addEventListener('click', () => this.save());

    // Reset to defaults
    this.elements.resetBtn?.addEventListener('click', () => this.resetToDefaults());

    // Export/Import
    this.elements.exportBtn?.addEventListener('click', () => this.exportConfig());
    this.elements.importBtn?.addEventListener('click', () => this.elements.importFileInput.click());
    this.elements.importFileInput?.addEventListener('change', (e) => this.importConfig(e));

    // Navigation between sections
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        this.switchSection(section);
      });
    });

    // Country search
    this.elements.countrySearch?.addEventListener('input', (e) => {
      this.filterCountries(e.target.value);
    });

    // Range sliders
    this.elements.temperature?.addEventListener('input', (e) => {
      this.elements.temperatureValue.textContent = e.target.value;
      this.markDirty();
    });

    this.elements.topK?.addEventListener('input', (e) => {
      this.elements.topKValue.textContent = e.target.value;
      this.markDirty();
    });

    // Mark as dirty on any input change
    const inputs = this.modal?.querySelectorAll('input, select, textarea');
    inputs?.forEach(input => {
      input.addEventListener('change', () => this.markDirty());
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  /**
   * Open the modal
   */
  async open() {
    if (!this.modal) {
      await this.init();
    }

    // Load current configuration
    this.currentConfig = await ConfigManager.load();
    this.originalConfig = JSON.parse(JSON.stringify(this.currentConfig));

    // Populate UI with current config
    this.populateUI();

    // Show modal
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    this.isDirty = false;

    console.log('[SettingsModal] Opened');
  }

  /**
   * Close the modal
   */
  close() {
    if (this.isDirty) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }

    this.modal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    console.log('[SettingsModal] Closed');
  }

  /**
   * Check if modal is open
   */
  isOpen() {
    return this.modal?.getAttribute('aria-hidden') === 'false';
  }

  /**
   * Switch between sections
   */
  switchSection(sectionName) {
    // Update navigation
    this.elements.navItems.forEach(item => {
      if (item.dataset.section === sectionName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update sections
    this.elements.sections.forEach(section => {
      if (section.id === `section-${sectionName}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });
  }

  /**
   * Populate UI with current configuration
   */
  populateUI() {
    // Countries section
    this.renderCountryList();

    // Advanced options
    this.elements.bufferPerCountry.value = this.currentConfig.articleSelection?.bufferPerCountry || 2;
    this.elements.maxForAnalysis.value = this.currentConfig.articleSelection?.maxForAnalysis || 10;
    this.elements.allowFallback.checked = this.currentConfig.articleSelection?.allowFallback !== false;

    // Extraction section
    this.elements.minContentLength.value = this.currentConfig.extraction?.qualityThresholds?.minContentLength || 3000;
    this.elements.maxContentLength.value = this.currentConfig.extraction?.qualityThresholds?.maxContentLength || 10000;
    this.elements.minWordCount.value = this.currentConfig.extraction?.qualityThresholds?.minWordCount || 500;
    this.elements.timeout.value = this.currentConfig.extraction?.timeout || 30000;

    // Analysis section
    const compression = this.currentConfig.analysis?.compressionLevel || 'long';
    this.elements.compressionRadios.forEach(radio => {
      radio.checked = radio.value === compression;
    });

    const temperature = this.currentConfig.analysis?.model?.temperature || 0.7;
    this.elements.temperature.value = temperature;
    this.elements.temperatureValue.textContent = temperature;

    const topK = this.currentConfig.analysis?.model?.topK || 3;
    this.elements.topK.value = topK;
    this.elements.topKValue.textContent = topK;
  }

  /**
   * Render country list
   */
  renderCountryList() {
    const selectedCountries = this.currentConfig.articleSelection?.perCountry || {};

    const html = COUNTRIES.map(country => {
      const isSelected = country.code in selectedCountries;
      const articleCount = selectedCountries[country.code] || 2;

      return `
        <div class="country-item" data-country="${country.code}">
          <div class="country-checkbox">
            <input type="checkbox"
                   id="country-${country.code}"
                   value="${country.code}"
                   ${isSelected ? 'checked' : ''}>
          </div>
          <div class="country-flag">${country.flag}</div>
          <div class="country-info">
            <label for="country-${country.code}" class="country-name">${country.name}</label>
            <div class="country-lang">${country.language}</div>
          </div>
          <div class="country-articles">
            <input type="number"
                   min="1"
                   max="10"
                   value="${articleCount}"
                   data-country="${country.code}"
                   ${isSelected ? '' : 'disabled'}
                   class="country-article-count">
          </div>
        </div>
      `;
    }).join('');

    this.elements.countryList.innerHTML = html;

    // Add event listeners for country checkboxes
    this.elements.countryList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const countryCode = e.target.value;
        const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);

        if (e.target.checked) {
          articleInput.disabled = false;
        } else {
          articleInput.disabled = true;
        }

        this.updateCountryStats();
        this.markDirty();
      });
    });

    // Add event listeners for article count inputs
    this.elements.countryList.querySelectorAll('.country-article-count').forEach(input => {
      input.addEventListener('change', () => {
        this.updateCountryStats();
        this.markDirty();
      });
    });

    this.updateCountryStats();
  }

  /**
   * Update country statistics
   */
  updateCountryStats() {
    const checkboxes = this.elements.countryList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedCount = checkboxes.length;

    let totalArticles = 0;
    checkboxes.forEach(checkbox => {
      const countryCode = checkbox.value;
      const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);
      totalArticles += parseInt(articleInput.value) || 0;
    });

    this.elements.selectedCount.textContent = selectedCount;
    this.elements.totalArticles.textContent = totalArticles;
  }

  /**
   * Filter countries by search term
   */
  filterCountries(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    this.elements.countryList.querySelectorAll('.country-item').forEach(item => {
      const countryCode = item.dataset.country;
      const country = COUNTRIES.find(c => c.code === countryCode);

      if (!country) return;

      const matches =
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase().includes(term) ||
        country.language.toLowerCase().includes(term);

      if (matches || !term) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  }

  /**
   * Gather configuration from UI
   */
  gatherConfig() {
    // Countries
    const perCountry = {};
    this.elements.countryList.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      const countryCode = checkbox.value;
      const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);
      perCountry[countryCode] = parseInt(articleInput.value) || 2;
    });

    // Get selected compression level
    let compressionLevel = 'long';
    this.elements.compressionRadios.forEach(radio => {
      if (radio.checked) compressionLevel = radio.value;
    });

    return {
      articleSelection: {
        perCountry,
        bufferPerCountry: parseInt(this.elements.bufferPerCountry.value) || 2,
        maxForAnalysis: parseInt(this.elements.maxForAnalysis.value) || 10,
        allowFallback: this.elements.allowFallback.checked
      },
      extraction: {
        timeout: parseInt(this.elements.timeout.value) || 20000,
        qualityThresholds: {
          minContentLength: parseInt(this.elements.minContentLength.value) || 3000,
          maxContentLength: parseInt(this.elements.maxContentLength.value) || 10000,
          minWordCount: parseInt(this.elements.minWordCount.value) || 500,
          maxHtmlRatio: this.currentConfig.extraction?.qualityThresholds?.maxHtmlRatio || 0.4,
          minQualityScore: this.currentConfig.extraction?.qualityThresholds?.minQualityScore || 60
        }
      },
      analysis: {
        compressionLevel,
        model: {
          temperature: parseFloat(this.elements.temperature.value) || 0.7,
          topK: parseInt(this.elements.topK.value) || 3
        }
      }
    };
  }

  /**
   * Save configuration
   */
  async save() {
    try {
      const config = this.gatherConfig();

      console.log('[SettingsModal] Saving configuration', {
        articleSelection: config.articleSelection ? {
          perCountry: Object.keys(config.articleSelection.perCountry || {}),
          bufferPerCountry: config.articleSelection.bufferPerCountry,
          maxForAnalysis: config.articleSelection.maxForAnalysis
        } : 'missing',
        analysis: config.analysis ? {
          compressionLevel: config.analysis.compressionLevel
        } : 'missing'
      });

      // Save using ConfigManager
      const result = await ConfigManager.save(config);

      if (result.success) {
        console.log('[SettingsModal] Configuration saved successfully');

        // Reload to verify
        const verification = await ConfigManager.load();
        console.log('[SettingsModal] Verification check:', {
          countries: Object.keys(verification.articleSelection?.perCountry || {}),
          bufferPerCountry: verification.articleSelection?.bufferPerCountry,
          maxForAnalysis: verification.articleSelection?.maxForAnalysis
        });

        this.showToast('success', 'Settings saved', 'Your preferences have been updated');
        this.isDirty = false;
        this.originalConfig = JSON.parse(JSON.stringify(config));

        // Close modal after short delay
        setTimeout(() => this.close(), 1000);
      } else {
        console.error('[SettingsModal] Validation failed:', result.errors);
        this.showToast('error', 'Validation failed', result.errors.join(', '));
      }
    } catch (error) {
      console.error('[SettingsModal] Error saving config:', error);
      this.showToast('error', 'Save failed', error.message);
    }
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults() {
    const confirm = window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.');

    if (!confirm) return;

    try {
      const result = await ConfigManager.reset();

      if (result.success) {
        // Reload config and UI
        this.currentConfig = await ConfigManager.load();
        this.populateUI();
        this.isDirty = false;

        this.showToast('success', 'Settings reset', 'All settings have been restored to defaults');
      } else {
        this.showToast('error', 'Reset failed', result.errors.join(', '));
      }
    } catch (error) {
      console.error('[SettingsModal] Error resetting config:', error);
      this.showToast('error', 'Reset failed', error.message);
    }
  }

  /**
   * Export configuration to JSON file
   */
  async exportConfig() {
    try {
      const jsonString = await ConfigManager.export();

      // Create download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `perspective-lens-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);

      this.showToast('success', 'Config exported', 'Configuration file downloaded');
    } catch (error) {
      console.error('[SettingsModal] Error exporting config:', error);
      this.showToast('error', 'Export failed', error.message);
    }
  }

  /**
   * Import configuration from JSON file
   */
  async importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await ConfigManager.import(text);

      if (result.success) {
        // Reload config and UI
        this.currentConfig = await ConfigManager.load();
        this.populateUI();
        this.isDirty = false;

        this.showToast('success', 'Config imported', 'Configuration has been imported successfully');
      } else {
        this.showToast('error', 'Import failed', result.errors.join(', '));
      }
    } catch (error) {
      console.error('[SettingsModal] Error importing config:', error);
      this.showToast('error', 'Import failed', error.message);
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }

  /**
   * Mark configuration as dirty (has unsaved changes)
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * Show toast notification
   */
  showToast(type, title, message) {
    const icons = {
      success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
      error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`,
      info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>`
    };

    this.elements.toastIcon.innerHTML = icons[type] || icons.info;
    this.elements.toastTitle.textContent = title;
    this.elements.toastMessage.textContent = message;

    this.elements.toast.classList.add('show');

    setTimeout(() => {
      this.elements.toast.classList.remove('show');
    }, 4000);
  }
}

// Create singleton instance
export const settingsModal = new SettingsModal();
