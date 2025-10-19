/**
 * Options Page Controller
 * Handles settings UI for PerspectiveLens
 */

import { ConfigManager } from '../config/configManager.js';

// Country data - flag SVG filenames match country names in lowercase
const COUNTRIES = [
  { code: 'AE', name: 'United Arab Emirates', language: 'ar' },
  { code: 'AR', name: 'Argentina', language: 'es' },
  { code: 'AT', name: 'Austria', language: 'de' },
  { code: 'AU', name: 'Australia', language: 'en' },
  { code: 'BD', name: 'Bangladesh', language: 'bn' },
  { code: 'BE', name: 'Belgium', language: 'nl' },
  { code: 'BG', name: 'Bulgaria', language: 'bg' },
  { code: 'BR', name: 'Brazil', language: 'pt' },
  { code: 'CA', name: 'Canada', language: 'en' },
  { code: 'CH', name: 'Switzerland', language: 'de' },
  { code: 'CL', name: 'Chile', language: 'es' },
  { code: 'CN', name: 'China', language: 'zh-CN' },
  { code: 'CO', name: 'Colombia', language: 'es' },
  { code: 'CZ', name: 'Czech Republic', language: 'cs' },
  { code: 'DE', name: 'Germany', language: 'de' },
  { code: 'DK', name: 'Denmark', language: 'da' },
  { code: 'EG', name: 'Egypt', language: 'ar' },
  { code: 'ES', name: 'Spain', language: 'es' },
  { code: 'FI', name: 'Finland', language: 'fi' },
  { code: 'FR', name: 'France', language: 'fr' },
  { code: 'GB', name: 'United Kingdom', language: 'en' },
  { code: 'GR', name: 'Greece', language: 'el' },
  { code: 'HK', name: 'Hong Kong', language: 'zh-HK' },
  { code: 'HR', name: 'Croatia', language: 'hr' },
  { code: 'HU', name: 'Hungary', language: 'hu' },
  { code: 'ID', name: 'Indonesia', language: 'id' },
  { code: 'IE', name: 'Ireland', language: 'en' },
  { code: 'IL', name: 'Israel', language: 'he' },
  { code: 'IN', name: 'India', language: 'en' },
  { code: 'IT', name: 'Italy', language: 'it' },
  { code: 'JP', name: 'Japan', language: 'ja' },
  { code: 'KR', name: 'South Korea', language: 'ko' },
  { code: 'LT', name: 'Lithuania', language: 'lt' },
  { code: 'MX', name: 'Mexico', language: 'es' },
  { code: 'MY', name: 'Malaysia', language: 'en' },
  { code: 'NL', name: 'Netherlands', language: 'nl' },
  { code: 'NO', name: 'Norway', language: 'no' },
  { code: 'NZ', name: 'New Zealand', language: 'en' },
  { code: 'PL', name: 'Poland', language: 'pl' },
  { code: 'PT', name: 'Portugal', language: 'pt' },
  { code: 'RO', name: 'Romania', language: 'ro' },
  { code: 'RU', name: 'Russia', language: 'ru' },
  { code: 'SA', name: 'Saudi Arabia', language: 'ar' },
  { code: 'SE', name: 'Sweden', language: 'sv' },
  { code: 'SG', name: 'Singapore', language: 'en' },
  { code: 'SI', name: 'Slovenia', language: 'sl' },
  { code: 'SK', name: 'Slovakia', language: 'sk' },
  { code: 'TH', name: 'Thailand', language: 'th' },
  { code: 'TR', name: 'Turkey', language: 'tr' },
  { code: 'TW', name: 'Taiwan', language: 'zh-TW' },
  { code: 'UA', name: 'Ukraine', language: 'uk' },
  { code: 'US', name: 'United States', language: 'en' },
  { code: 'VN', name: 'Vietnam', language: 'vi' },
  { code: 'ZA', name: 'South Africa', language: 'en' }
];

// Get flag SVG path for a country
function getFlagPath(countryName) {
  const flagName = countryName.toLowerCase();
  return chrome.runtime.getURL(`icons/flags/${flagName}.svg`);
}

class OptionsPage {
  constructor() {
    this.currentConfig = null;
    this.isDirty = false;
    this.elements = {};
  }

  async init() {
    this.cacheElements();
    this.setupEventListeners();
    await this.loadConfiguration();
    this.populateUI();

    console.log('[Options] Initialized');
  }

  cacheElements() {
    this.elements = {
      // Navigation
      navItems: document.querySelectorAll('.nav-item'),
      sections: document.querySelectorAll('.content-section'),

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

      // Footer
      resetBtn: document.getElementById('reset-defaults'),
      saveBtn: document.getElementById('save-settings'),
      saveIndicator: document.getElementById('save-indicator'),

      // Toast
      toast: document.getElementById('settings-toast'),
      toastTitle: document.getElementById('toast-title'),
      toastMessage: document.getElementById('toast-message')
    };
  }

  setupEventListeners() {
    // Navigation
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

    // Footer buttons
    this.elements.resetBtn?.addEventListener('click', () => this.resetToDefaults());
    this.elements.saveBtn?.addEventListener('click', () => this.save());

    // Mark as dirty on any change
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('change', () => this.markDirty());
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
      }
    });
  }

  async loadConfiguration() {
    this.currentConfig = await ConfigManager.load();
  }

  switchSection(sectionName) {
    this.elements.navItems.forEach(item => {
      if (item.dataset.section === sectionName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.elements.sections.forEach(section => {
      if (section.id === `section-${sectionName}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });
  }

  populateUI() {
    // Countries
    this.renderCountryList();

    // Advanced options
    this.elements.bufferPerCountry.value = this.currentConfig.articleSelection?.bufferPerCountry || 2;
    this.elements.maxForAnalysis.value = this.currentConfig.articleSelection?.maxForAnalysis || 10;
    this.elements.allowFallback.checked = this.currentConfig.articleSelection?.allowFallback !== false;

    // Extraction
    this.elements.minContentLength.value = this.currentConfig.extraction?.qualityThresholds?.minContentLength || 3000;
    this.elements.maxContentLength.value = this.currentConfig.extraction?.qualityThresholds?.maxContentLength || 10000;
    this.elements.minWordCount.value = this.currentConfig.extraction?.qualityThresholds?.minWordCount || 500;
    this.elements.timeout.value = this.currentConfig.extraction?.timeout || 20000;

    // Analysis
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

  renderCountryList() {
    const selectedCountries = this.currentConfig.articleSelection?.perCountry || {};

    const html = COUNTRIES.map(country => {
      const isSelected = country.code in selectedCountries;
      const articleCount = selectedCountries[country.code] || 2;
      const flagPath = getFlagPath(country.name);

      return `
        <div class="country-item" data-country="${country.code}">
          <div class="country-checkbox">
            <input type="checkbox"
                   id="country-${country.code}"
                   value="${country.code}"
                   ${isSelected ? 'checked' : ''}>
          </div>
          <img src="${flagPath}" alt="${country.name} flag" class="country-flag" onerror="this.style.display='none'">
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

    // Add event listeners
    this.elements.countryList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const countryCode = e.target.value;
        const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);

        articleInput.disabled = !e.target.checked;
        this.updateCountryStats();
        this.markDirty();
      });
    });

    this.elements.countryList.querySelectorAll('.country-article-count').forEach(input => {
      input.addEventListener('change', () => {
        this.updateCountryStats();
        this.markDirty();
      });
    });

    this.updateCountryStats();
  }

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

      item.classList.toggle('hidden', !matches && term);
    });
  }

  gatherConfig() {
    const perCountry = {};
    this.elements.countryList.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      const countryCode = checkbox.value;
      const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);
      perCountry[countryCode] = parseInt(articleInput.value) || 2;
    });

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

  async save() {
    try {
      const config = this.gatherConfig();
      const result = await ConfigManager.save(config);

      if (result.success) {
        this.isDirty = false;
        this.showSaveIndicator();
        this.showToast('success', 'Settings saved', 'Your preferences have been updated successfully');
      } else {
        this.showToast('error', 'Validation failed', result.errors.join(', '));
      }
    } catch (error) {
      console.error('[Options] Error saving config:', error);
      this.showToast('error', 'Save failed', error.message);
    }
  }

  async resetToDefaults() {
    const confirm = window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.');

    if (!confirm) return;

    try {
      const result = await ConfigManager.reset();

      if (result.success) {
        await this.loadConfiguration();
        this.populateUI();
        this.isDirty = false;

        this.showToast('success', 'Settings reset', 'All settings have been restored to defaults');
      } else {
        this.showToast('error', 'Reset failed', result.errors.join(', '));
      }
    } catch (error) {
      console.error('[Options] Error resetting config:', error);
      this.showToast('error', 'Reset failed', error.message);
    }
  }


  markDirty() {
    this.isDirty = true;
    this.elements.saveIndicator?.classList.remove('show');
  }

  showSaveIndicator() {
    this.elements.saveIndicator?.classList.add('show');
    setTimeout(() => {
      this.elements.saveIndicator?.classList.remove('show');
    }, 3000);
  }

  showToast(type, title, message) {
    const prefix = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    this.elements.toastTitle.textContent = `${prefix} ${title}`;
    this.elements.toastMessage.textContent = message;

    this.elements.toast.classList.add('show');
    this.elements.toast.setAttribute('data-type', type);

    setTimeout(() => {
      this.elements.toast.classList.remove('show');
    }, 4000);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const optionsPage = new OptionsPage();
  optionsPage.init();
});
