/**
 * Options Page Controller
 * Handles settings UI for PerspectiveLens
 */

import { ConfigManager } from '../../../config/configManager.js';
import { APIKeyManager } from '../../../config/apiKeyManager.js';
import { availableCountries } from '../../../config/availableCountries.js';

// Use centralized country data
const COUNTRIES = availableCountries.map(country => ({
  code: country.code,
  name: country.name,
  language: country.language,
  continent: country.continent,
  icon: country.icon
}));

// Get flag SVG path for a country
function getFlagPath(countryCode) {
  const country = COUNTRIES.find(c => c.code === countryCode);
  if (country && country.icon) {
    return chrome.runtime.getURL(country.icon);
  }
  // Fallback for countries without icon path
  return chrome.runtime.getURL(`icons/flags/${countryCode.toLowerCase()}.svg`);
}

// Group and sort countries by continent, with selected countries at the top
function organizeCountries(selectedCountryCodes = []) {
  // Separate selected and unselected countries
  const selected = COUNTRIES.filter(c => selectedCountryCodes.includes(c.code));
  const unselected = COUNTRIES.filter(c => !selectedCountryCodes.includes(c.code));

  // Sort selected countries alphabetically
  selected.sort((a, b) => a.name.localeCompare(b.name));

  // Group unselected countries by continent
  const continents = {};
  unselected.forEach(country => {
    const continent = country.continent || 'Other';
    if (!continents[continent]) {
      continents[continent] = [];
    }
    continents[continent].push(country);
  });

  // Sort countries within each continent alphabetically
  Object.keys(continents).forEach(continent => {
    continents[continent].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Sort continents alphabetically
  const sortedContinents = Object.keys(continents).sort();

  return { selected, continents, sortedContinents };
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
      selectedCountriesGrid: document.getElementById('selected-countries-grid'),
      btnManageCountries: document.getElementById('btn-manage-countries'),
      countryList: document.getElementById('country-list'),
      countrySearch: document.getElementById('country-search'),
      selectedCount: document.getElementById('selected-count'),
      totalArticles: document.getElementById('total-articles'),
      bufferPerCountry: document.getElementById('buffer-per-country'),
      maxForAnalysis: document.getElementById('max-for-analysis'),
      allowFallback: document.getElementById('allow-fallback'),

      // Modal
      modalOverlay: document.getElementById('country-modal-overlay'),
      modalClose: document.getElementById('modal-close'),
      modalCancel: document.getElementById('modal-cancel'),
      modalApply: document.getElementById('modal-apply'),
      modalSelectedCount: document.getElementById('modal-selected-count'),
      modalTotalArticles: document.getElementById('modal-total-articles'),

      // Extraction
      minContentLength: document.getElementById('min-content-length'),
      maxContentLength: document.getElementById('max-content-length'),
      minWordCount: document.getElementById('min-word-count'),
      timeout: document.getElementById('timeout'),

      // Model Selection
      modelOptions: document.querySelectorAll('.model-option'),

      // API Key Section
      apiKeySection: document.getElementById('api-key-section'),
      apiKeyStatus: document.getElementById('api-key-status'),
      apiKeyInput: document.getElementById('api-key-input'),
      btnValidateKey: document.getElementById('btn-validate-key'),
      btnRemoveKey: document.getElementById('btn-remove-key'),

      // Gemini Nano Settings
      nanoSettings: document.getElementById('nano-settings'),
      compressionRadios: document.querySelectorAll('input[name="compression"]'),
      nanoTemperature: document.getElementById('nano-temperature'),
      nanoTemperatureValue: document.getElementById('nano-temperature-value'),
      nanoTopK: document.getElementById('nano-top-k'),
      nanoTopKValue: document.getElementById('nano-top-k-value'),

      // Gemini 2.5 Pro Settings
      proSettings: document.getElementById('pro-settings'),
      proTemperature: document.getElementById('pro-temperature'),
      proTemperatureValue: document.getElementById('pro-temperature-value'),
      proTopK: document.getElementById('pro-top-k'),
      proTopKValue: document.getElementById('pro-top-k-value'),
      proTopP: document.getElementById('pro-top-p'),
      proTopPValue: document.getElementById('pro-top-p-value'),
      proThinkingBudget: document.getElementById('pro-thinking-budget'),

      // Footer
      resetBtn: document.getElementById('reset-defaults'),
      saveBtn: document.getElementById('save-settings'),
      saveIndicator: document.getElementById('save-indicator')
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

    // Modal buttons
    this.elements.btnManageCountries?.addEventListener('click', () => this.openModal());
    this.elements.modalClose?.addEventListener('click', () => this.closeModal());
    this.elements.modalCancel?.addEventListener('click', () => this.closeModal());
    this.elements.modalApply?.addEventListener('click', () => this.applyModalSelection());

    // Close modal on overlay click
    this.elements.modalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.modalOverlay) {
        this.closeModal();
      }
    });

    // Country search
    this.elements.countrySearch?.addEventListener('input', (e) => {
      this.filterCountries(e.target.value);
    });

    // Model selection
    this.elements.modelOptions.forEach(option => {
      option.addEventListener('click', () => {
        const model = option.dataset.model;
        this.switchModel(model);
      });
    });

    // API Key management
    this.elements.btnValidateKey?.addEventListener('click', () => this.validateAndSaveApiKey());
    this.elements.btnRemoveKey?.addEventListener('click', () => this.removeApiKey());

    // Nano range sliders
    this.elements.nanoTemperature?.addEventListener('input', (e) => {
      this.elements.nanoTemperatureValue.textContent = e.target.value;
      this.markDirty();
    });

    this.elements.nanoTopK?.addEventListener('input', (e) => {
      this.elements.nanoTopKValue.textContent = e.target.value;
      this.markDirty();
    });

    // Pro range sliders
    this.elements.proTemperature?.addEventListener('input', (e) => {
      this.elements.proTemperatureValue.textContent = e.target.value;
      this.markDirty();
    });

    this.elements.proTopK?.addEventListener('input', (e) => {
      this.elements.proTopKValue.textContent = e.target.value;
      this.markDirty();
    });

    this.elements.proTopP?.addEventListener('input', (e) => {
      this.elements.proTopPValue.textContent = e.target.value;
      this.markDirty();
    });

    // Footer buttons
    this.elements.resetBtn?.addEventListener('click', () => this.resetToDefaults());
    this.elements.saveBtn?.addEventListener('click', () => this.save());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
      }

      // Close modal on Escape
      if (e.key === 'Escape' && this.elements.modalOverlay?.classList.contains('show')) {
        this.closeModal();
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

  async populateUI() {
    // Countries - render selected countries on main page
    this.renderSelectedCountries();

    // Advanced options
    this.elements.bufferPerCountry.value = this.currentConfig.articleSelection?.bufferPerCountry || 2;
    this.elements.maxForAnalysis.value = this.currentConfig.articleSelection?.maxForAnalysis || 10;
    this.elements.allowFallback.checked = this.currentConfig.articleSelection?.allowFallback !== false;

    // Extraction
    this.elements.minContentLength.value = this.currentConfig.extraction?.qualityThresholds?.minContentLength || 3000;
    this.elements.maxContentLength.value = this.currentConfig.extraction?.qualityThresholds?.maxContentLength || 10000;
    this.elements.minWordCount.value = this.currentConfig.extraction?.qualityThresholds?.minWordCount || 500;
    this.elements.timeout.value = this.currentConfig.extraction?.timeout || 20000;

    // Model Provider
    const modelProvider = this.currentConfig.analysis?.modelProvider || 'gemini-nano';
    this.switchModel(modelProvider, false);

    // Gemini Nano Settings
    const compression = this.currentConfig.analysis?.compressionLevel || 'long';
    this.elements.compressionRadios.forEach(radio => {
      radio.checked = radio.value === compression;
    });

    const nanoTemp = this.currentConfig.analysis?.model?.temperature || 0.7;
    this.elements.nanoTemperature.value = nanoTemp;
    this.elements.nanoTemperatureValue.textContent = nanoTemp;

    const nanoTopK = this.currentConfig.analysis?.model?.topK || 3;
    this.elements.nanoTopK.value = nanoTopK;
    this.elements.nanoTopKValue.textContent = nanoTopK;

    // Gemini 2.5 Pro Settings
    const proConfig = this.currentConfig.analysis?.gemini25Pro || {};

    const proTemp = proConfig.temperature || 0.7;
    this.elements.proTemperature.value = proTemp;
    this.elements.proTemperatureValue.textContent = proTemp;

    const proTopK = proConfig.topK || 40;
    this.elements.proTopK.value = proTopK;
    this.elements.proTopKValue.textContent = proTopK;

    const proTopP = proConfig.topP || 0.95;
    this.elements.proTopP.value = proTopP;
    this.elements.proTopPValue.textContent = proTopP;

    const thinkingBudget = proConfig.thinkingBudget ?? -1;
    this.elements.proThinkingBudget.value = thinkingBudget;

    // API Key Status
    await this.updateApiKeyStatus();
  }

  renderSelectedCountries() {
    const selectedCountries = this.currentConfig.articleSelection?.perCountry || {};
    const selectedCodes = Object.keys(selectedCountries);

    if (selectedCodes.length === 0) {
      this.elements.selectedCountriesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--color-text-tertiary); padding: 32px;">No countries selected. Click "Manage countries" to get started.</div>';
      this.updateMainStats(0, 0);
      return;
    }

    const html = selectedCodes.map(code => {
      const country = COUNTRIES.find(c => c.code === code);
      if (!country) return '';

      const articleCount = selectedCountries[code];
      const flagPath = getFlagPath(code);

      return `
        <div class="selected-country-card">
          <img src="${flagPath}" alt="${country.name} flag" class="country-flag" onerror="this.style.display='none'">
          <div class="selected-country-info">
            <div class="selected-country-name">${country.name}</div>
            <div class="selected-country-count">${articleCount} article${articleCount > 1 ? 's' : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    this.elements.selectedCountriesGrid.innerHTML = html;

    // Update stats
    const totalArticles = selectedCodes.reduce((sum, code) => sum + (selectedCountries[code] || 0), 0);
    this.updateMainStats(selectedCodes.length, totalArticles);
  }

  updateMainStats(countryCount, articleCount) {
    this.elements.selectedCount.textContent = countryCount;
    this.elements.totalArticles.textContent = articleCount;
  }

  openModal() {
    // Render country list in modal
    this.renderCountryList();

    // Show modal with animation
    this.elements.modalOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.elements.modalOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  applyModalSelection() {
    // Gather selections from modal
    const perCountry = {};
    this.elements.countryList.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      const countryCode = checkbox.value;
      const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);
      perCountry[countryCode] = parseInt(articleInput.value) || 2;
    });

    // Update current config
    if (!this.currentConfig.articleSelection) {
      this.currentConfig.articleSelection = {};
    }
    this.currentConfig.articleSelection.perCountry = perCountry;

    // Update main view with new selections
    this.renderSelectedCountries();

    // Close modal
    this.closeModal();

    // Mark as dirty since selection changed
    this.markDirty();
  }

  renderCountryList() {
    const selectedCountries = this.currentConfig.articleSelection?.perCountry || {};
    const selectedCodes = Object.keys(selectedCountries);

    // Organize countries by continent with selected at top
    const { selected, continents, sortedContinents } = organizeCountries(selectedCodes);

    // Helper function to render a country item
    const renderCountryItem = (country) => {
      const isSelected = country.code in selectedCountries;
      const articleCount = selectedCountries[country.code] || 2;
      const flagPath = getFlagPath(country.code);

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
    };

    // Build HTML with sections
    let html = '';

    // Selected countries section (if any)
    if (selected.length > 0) {
      html += '<div class="continent-section selected-section">';
      html += '<div class="continent-header">Selected Countries</div>';
      html += selected.map(renderCountryItem).join('');
      html += '</div>';
    }

    // Continent sections
    sortedContinents.forEach(continent => {
      html += `<div class="continent-section">`;
      html += `<div class="continent-header">${continent}</div>`;
      html += continents[continent].map(renderCountryItem).join('');
      html += '</div>';
    });

    this.elements.countryList.innerHTML = html;

    // Add event listeners
    this.elements.countryList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const countryCode = e.target.value;
        const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);

        articleInput.disabled = !e.target.checked;
        this.updateCountryStats();
      });
    });

    this.elements.countryList.querySelectorAll('.country-article-count').forEach(input => {
      input.addEventListener('change', () => {
        this.updateCountryStats();
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

    // Update modal stats
    this.elements.modalSelectedCount.textContent = selectedCount;
    this.elements.modalTotalArticles.textContent = totalArticles;
  }

  filterCountries(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    // Filter country items
    this.elements.countryList.querySelectorAll('.country-item').forEach(item => {
      const countryCode = item.dataset.country;
      const country = COUNTRIES.find(c => c.code === countryCode);

      if (!country) return;

      const matches =
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase().includes(term) ||
        country.language.toLowerCase().includes(term) ||
        (country.continent && country.continent.toLowerCase().includes(term));

      item.classList.toggle('hidden', !matches && term);
    });

    // Hide/show continent sections based on whether they have visible items
    this.elements.countryList.querySelectorAll('.continent-section').forEach(section => {
      const visibleItems = section.querySelectorAll('.country-item:not(.hidden)');
      section.style.display = visibleItems.length > 0 ? 'flex' : 'none';
    });
  }

  gatherConfig() {
    const perCountry = {};
    this.elements.countryList.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      const countryCode = checkbox.value;
      const articleInput = this.elements.countryList.querySelector(`input[data-country="${countryCode}"]`);
      perCountry[countryCode] = parseInt(articleInput.value) || 2;
    });

    // Get selected model provider
    let modelProvider = 'gemini-nano';
    this.elements.modelOptions.forEach(option => {
      if (option.classList.contains('active')) {
        modelProvider = option.dataset.model;
      }
    });

    // Gemini Nano settings
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
        modelProvider,
        compressionLevel,
        model: {
          temperature: parseFloat(this.elements.nanoTemperature.value) || 0.7,
          topK: parseInt(this.elements.nanoTopK.value) || 3
        },
        gemini25Pro: {
          model: 'gemini-2.5-pro',
          temperature: parseFloat(this.elements.proTemperature.value) || 0.7,
          topK: parseInt(this.elements.proTopK.value) || 40,
          topP: parseFloat(this.elements.proTopP.value) || 0.95,
          thinkingBudget: parseInt(this.elements.proThinkingBudget.value) || -1
        }
      }
    };
  }

  switchModel(model, markDirty = true) {
    // Update active state on buttons
    this.elements.modelOptions.forEach(option => {
      if (option.dataset.model === model) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });

    // Show/hide appropriate sections
    if (model === 'gemini-nano') {
      this.elements.nanoSettings.style.display = 'block';
      this.elements.proSettings.style.display = 'none';
      this.elements.apiKeySection.style.display = 'none';
    } else if (model === 'gemini-2.5-pro') {
      this.elements.nanoSettings.style.display = 'none';
      this.elements.proSettings.style.display = 'block';
      this.elements.apiKeySection.style.display = 'block';
    }

    if (markDirty) {
      this.markDirty();
    }
  }

  async updateApiKeyStatus() {
    const hasKey = await APIKeyManager.exists();

    if (hasKey) {
      this.elements.apiKeyStatus.dataset.status = 'connected';
      this.elements.apiKeyStatus.querySelector('.status-text').textContent = 'API key configured';
      this.elements.btnRemoveKey.style.display = 'inline-block';
      this.elements.apiKeyInput.value = '';
      this.elements.apiKeyInput.placeholder = 'API key is saved (hidden for security)';
    } else {
      this.elements.apiKeyStatus.dataset.status = 'not-configured';
      this.elements.apiKeyStatus.querySelector('.status-text').textContent = 'API key not configured';
      this.elements.btnRemoveKey.style.display = 'none';
      this.elements.apiKeyInput.placeholder = 'Enter your API key...';
    }
  }

  async validateAndSaveApiKey() {
    const apiKey = this.elements.apiKeyInput.value.trim();

    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    // Disable button and show loading state
    this.elements.btnValidateKey.disabled = true;
    this.elements.btnValidateKey.textContent = 'Validating...';

    try {
      // Use validateAndSave which combines validation + save
      const result = await APIKeyManager.validateAndSave(apiKey);

      if (result.success) {
        await this.updateApiKeyStatus();
        this.showSaveIndicator();
      } else {
        this.elements.apiKeyStatus.dataset.status = 'invalid';
        this.elements.apiKeyStatus.querySelector('.status-text').textContent = 'Invalid API key';
        alert('Invalid API key: ' + (result.error || 'Validation failed'));
      }
    } catch (error) {
      console.error('[Options] Error saving API key:', error);
      alert('Error saving API key: ' + error.message);
    } finally {
      // Re-enable button
      this.elements.btnValidateKey.disabled = false;
      this.elements.btnValidateKey.textContent = 'Validate & Save';
    }
  }

  async removeApiKey() {
    const confirm = window.confirm('Are you sure you want to remove the API key? You will need to add it again to use Gemini 2.5 Pro.');

    if (!confirm) return;

    try {
      await APIKeyManager.remove();
      await this.updateApiKeyStatus();
      this.showSaveIndicator();
    } catch (error) {
      console.error('[Options] Error removing API key:', error);
      alert('Error removing API key: ' + error.message);
    }
  }

  async save() {
    try {
      const config = this.gatherConfig();

      // Validate if Gemini 2.5 Pro is selected but no API key
      if (config.analysis.modelProvider === 'gemini-2.5-pro') {
        const hasKey = await APIKeyManager.exists();
        if (!hasKey) {
          alert('Please configure an API key before using Gemini 2.5 Pro. Add your API key in the API Configuration section above.');
          return;
        }
      }

      const result = await ConfigManager.save(config);

      if (result.success) {
        this.isDirty = false;
        this.showSaveIndicator();
      } else {
        console.error('[Options] Validation failed:', result.errors.join(', '));
        alert('Validation failed: ' + result.errors.join(', '));
      }
    } catch (error) {
      console.error('[Options] Error saving config:', error);
      alert('Save failed: ' + error.message);
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
        this.showSaveIndicator();
      } else {
        console.error('[Options] Reset failed:', result.errors.join(', '));
        alert('Reset failed: ' + result.errors.join(', '));
      }
    } catch (error) {
      console.error('[Options] Error resetting config:', error);
      alert('Reset failed: ' + error.message);
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
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const optionsPage = new OptionsPage();
  optionsPage.init();
});
