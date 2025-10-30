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
      modelOptions: document.querySelectorAll('.model-card'),

      // API Key Section
      apiKeySection: document.getElementById('api-key-section'),
      apiKeyStatus: document.getElementById('api-key-status'),
      apiKeyInput: document.getElementById('api-key-input'),
      btnValidateKey: document.getElementById('btn-validate-key'),
      btnRemoveKey: document.getElementById('btn-remove-key'),
      btnToggleVisibility: document.getElementById('btn-toggle-visibility'),

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

    // Setup toggle switches for fallback models
    document.querySelectorAll('.model-toggle-input').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const item = e.target.closest('.model-config-item');
        if (e.target.checked) {
          item.classList.remove('disabled');
        } else {
          item.classList.add('disabled');
        }
        this.markDirty();
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
    this.elements.btnToggleVisibility?.addEventListener('click', () => this.togglePasswordVisibility());

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

    this.elements.proThinkingBudget?.addEventListener('change', () => {
      this.markDirty();
    });

    // Article selection fields
    this.elements.bufferPerCountry?.addEventListener('change', () => {
      this.markDirty();
    });

    this.elements.maxForAnalysis?.addEventListener('change', () => {
      this.markDirty();
    });

    this.elements.allowFallback?.addEventListener('change', () => {
      this.markDirty();
    });

    // Extraction fields
    this.elements.minContentLength?.addEventListener('change', () => {
      this.markDirty();
    });

    this.elements.maxContentLength?.addEventListener('change', () => {
      this.markDirty();
    });

    this.elements.minWordCount?.addEventListener('change', () => {
      this.markDirty();
    });

    this.elements.timeout?.addEventListener('change', () => {
      this.markDirty();
    });

    // Compression level radios
    this.elements.compressionRadios?.forEach(radio => {
      radio.addEventListener('change', () => {
        this.markDirty();
      });
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
    console.log('[Options] Configuration loaded:', {
      bufferPerCountry: this.currentConfig.articleSelection?.bufferPerCountry,
      maxForAnalysis: this.currentConfig.articleSelection?.maxForAnalysis,
      countries: Object.keys(this.currentConfig.articleSelection?.perCountry || {}),
      modelProvider: this.currentConfig.analysis?.modelProvider
    });
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
    const bufferValue = this.currentConfig.articleSelection?.bufferPerCountry || 2;
    const maxAnalysisValue = this.currentConfig.articleSelection?.maxForAnalysis || 10;

    console.log('[Options] Populating UI fields:', {
      bufferPerCountry: bufferValue,
      maxForAnalysis: maxAnalysisValue,
      element: this.elements.bufferPerCountry ? 'exists' : 'null'
    });

    this.elements.bufferPerCountry.value = bufferValue;
    this.elements.maxForAnalysis.value = maxAnalysisValue;
    this.elements.allowFallback.checked = this.currentConfig.articleSelection?.allowFallback !== false;

    // Extraction
    this.elements.minContentLength.value = this.currentConfig.extraction?.qualityThresholds?.minContentLength || 3000;
    this.elements.maxContentLength.value = this.currentConfig.extraction?.qualityThresholds?.maxContentLength || 10000;
    this.elements.minWordCount.value = this.currentConfig.extraction?.qualityThresholds?.minWordCount || 500;
    this.elements.timeout.value = this.currentConfig.extraction?.timeout || 20000;

    // Model Provider
    const modelProvider = this.currentConfig.analysis?.modelProvider || 'nano';
    this.switchModel(modelProvider, false);

    // Gemini Nano Settings
    const compression = this.currentConfig.analysis?.compressionLevel || 'long';
    this.elements.compressionRadios.forEach(radio => {
      radio.checked = radio.value === compression;
    });

    // Get Nano settings from models.gemini-nano
    const nanoConfig = this.currentConfig.analysis?.models?.['gemini-nano'] || {};
    const nanoTemp = nanoConfig.temperature || 0.7;
    this.elements.nanoTemperature.value = nanoTemp;
    this.elements.nanoTemperatureValue.textContent = nanoTemp;

    const nanoTopK = nanoConfig.topK || 3;
    this.elements.nanoTopK.value = nanoTopK;
    this.elements.nanoTopKValue.textContent = nanoTopK;

    // API Models Settings - use gemini-2.5-pro config
    const proConfig = this.currentConfig.analysis?.models?.['gemini-2.5-pro'] || {};

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

    // Model Priorities - Load first to reorder DOM
    this.loadModelPriorities();

    // Setup drag and drop AFTER DOM is reordered
    this.setupDragAndDrop();
  }

  loadModelPriorities() {
    const preferredModels = this.currentConfig.analysis?.preferredModels || [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    const container = document.getElementById('models-sortable-list');
    const items = Array.from(container.querySelectorAll('.model-config-item'));

    // Reorder items based on preferredModels
    const sortedItems = [];

    // Add items in preferredModels order
    preferredModels.forEach((modelId, index) => {
      const item = items.find(i => i.dataset.model === modelId);
      if (item) {
        sortedItems.push(item);

        // Set toggle state based on whether it's enabled
        const toggle = item.querySelector('.model-toggle-input');
        if (toggle) {
          // Primary (first item) is always enabled, no toggle needed
          if (index === 0) {
            item.classList.remove('disabled');
          } else {
            // Fallback items are enabled by being in preferredModels
            toggle.checked = true;
            item.classList.remove('disabled');
          }
        }
      }
    });

    // Add remaining items as disabled
    items.forEach(item => {
      if (!sortedItems.includes(item)) {
        sortedItems.push(item);
        // Disable items not in preferredModels
        const toggle = item.querySelector('.model-toggle-input');
        if (toggle) {
          toggle.checked = false;
          item.classList.add('disabled');
        }
      }
    });

    // Reorder DOM
    sortedItems.forEach(item => container.appendChild(item));

    // Update positions and badges (this will also handle toggle visibility)
    this.updateModelPositions();
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
    // Get perCountry from current config (already set by modal)
    // DO NOT try to read from countryList - it's only populated when modal is open
    const perCountry = this.currentConfig.articleSelection?.perCountry || {};

    console.log('[Options] gatherConfig() - perCountry from currentConfig:', {
      perCountry: Object.keys(perCountry),
      counts: perCountry
    });

    // Get selected model provider (new values: 'nano' or 'api')
    let modelProvider = 'nano';
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

    // Gather settings for all models
    // Use ?? instead of || to allow 0 values
    const nanoTemperature = parseFloat(this.elements.nanoTemperature.value ?? 0.7);
    const nanoTopK = parseInt(this.elements.nanoTopK.value ?? 3);

    const proTemperature = parseFloat(this.elements.proTemperature.value ?? 0.7);
    const proTopK = parseInt(this.elements.proTopK.value ?? 40);
    const proTopP = parseFloat(this.elements.proTopP.value ?? 0.95);
    const thinkingBudget = parseInt(this.elements.proThinkingBudget.value ?? -1);

    // Get model priorities
    const modelPriorities = this.getModelPriorities();

    // Read bufferPerCountry and maxForAnalysis from UI elements
    const bufferPerCountryValue = parseInt(this.elements.bufferPerCountry?.value ?? 2);
    const maxForAnalysisValue = parseInt(this.elements.maxForAnalysis?.value ?? 10);
    const allowFallbackValue = this.elements.allowFallback?.checked ?? true;

    console.log('[Options] gatherConfig() - articleSelection values:', {
      perCountryKeys: Object.keys(perCountry),
      bufferPerCountry: bufferPerCountryValue,
      bufferElement: this.elements.bufferPerCountry ? 'exists' : 'null',
      bufferElementValue: this.elements.bufferPerCountry?.value,
      maxForAnalysis: maxForAnalysisValue,
      allowFallback: allowFallbackValue
    });

    return {
      articleSelection: {
        perCountry,
        bufferPerCountry: bufferPerCountryValue,
        maxForAnalysis: maxForAnalysisValue,
        allowFallback: allowFallbackValue
      },
      extraction: {
        timeout: parseInt(this.elements.timeout.value ?? 20000),
        qualityThresholds: {
          minContentLength: parseInt(this.elements.minContentLength.value ?? 3000),
          maxContentLength: parseInt(this.elements.maxContentLength.value ?? 10000),
          minWordCount: parseInt(this.elements.minWordCount.value ?? 500),
          maxHtmlRatio: this.currentConfig.extraction?.qualityThresholds?.maxHtmlRatio || 0.4,
          minQualityScore: this.currentConfig.extraction?.qualityThresholds?.minQualityScore || 60
        }
      },
      analysis: {
        modelProvider,
        compressionLevel,
        // Use configured model priorities
        preferredModels: modelPriorities,
        // New models structure with per-model configs
        models: {
          'gemini-nano': {
            displayName: 'Gemini Nano',
            temperature: nanoTemperature,
            topK: nanoTopK
          },
          'gemini-2.5-pro': {
            displayName: 'Gemini 2.5 Pro',
            temperature: proTemperature,
            topK: proTopK,
            topP: proTopP,
            thinkingBudget: thinkingBudget,
            includeThoughts: false
          },
          'gemini-2.5-flash': {
            displayName: 'Gemini 2.5 Flash',
            temperature: proTemperature,
            topK: proTopK,
            topP: proTopP,
            thinkingBudget: 0,  // Flash doesn't use thinking
            includeThoughts: false
          },
          'gemini-2.5-flash-lite': {
            displayName: 'Gemini 2.5 Flash Lite',
            temperature: proTemperature,
            topK: proTopK,
            topP: proTopP,
            thinkingBudget: 0,  // Flash Lite doesn't use thinking
            includeThoughts: false
          }
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
    if (model === 'nano') {
      this.elements.nanoSettings.style.display = 'block';
      this.elements.proSettings.style.display = 'none';
      this.elements.apiKeySection.style.display = 'none';
    } else if (model === 'api') {
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

    // Get all status icons
    const iconInfo = this.elements.apiKeyStatus.querySelector('.status-icon-info');
    const iconSuccess = this.elements.apiKeyStatus.querySelector('.status-icon-success');
    const iconError = this.elements.apiKeyStatus.querySelector('.status-icon-error');

    if (hasKey) {
      this.elements.apiKeyStatus.dataset.status = 'connected';
      this.elements.apiKeyStatus.querySelector('.status-title').textContent = 'API key configured';
      this.elements.apiKeyStatus.querySelector('.status-subtitle').textContent = 'Ready to use cloud models';
      this.elements.btnRemoveKey.style.display = 'inline-flex';
      this.elements.apiKeyInput.value = '';
      this.elements.apiKeyInput.placeholder = 'API key is saved (hidden for security)';

      // Show success icon
      iconInfo.style.display = 'none';
      iconSuccess.style.display = 'block';
      iconError.style.display = 'none';
    } else {
      this.elements.apiKeyStatus.dataset.status = 'not-configured';
      this.elements.apiKeyStatus.querySelector('.status-title').textContent = 'API key not configured';
      this.elements.apiKeyStatus.querySelector('.status-subtitle').textContent = 'Add your API key to use cloud models';
      this.elements.btnRemoveKey.style.display = 'none';
      this.elements.apiKeyInput.placeholder = 'Enter your API key...';

      // Show info icon
      iconInfo.style.display = 'block';
      iconSuccess.style.display = 'none';
      iconError.style.display = 'none';
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
        // Get all status icons
        const iconInfo = this.elements.apiKeyStatus.querySelector('.status-icon-info');
        const iconSuccess = this.elements.apiKeyStatus.querySelector('.status-icon-success');
        const iconError = this.elements.apiKeyStatus.querySelector('.status-icon-error');

        this.elements.apiKeyStatus.dataset.status = 'invalid';
        this.elements.apiKeyStatus.querySelector('.status-title').textContent = 'Invalid API key';
        this.elements.apiKeyStatus.querySelector('.status-subtitle').textContent = 'Please check your API key and try again';

        // Show error icon
        iconInfo.style.display = 'none';
        iconSuccess.style.display = 'none';
        iconError.style.display = 'block';

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
    const confirm = window.confirm('Are you sure you want to remove the API key? You will need to add it again to use API models.');

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

  togglePasswordVisibility() {
    const input = this.elements.apiKeyInput;
    const iconShow = this.elements.btnToggleVisibility.querySelector('.icon-show');
    const iconHide = this.elements.btnToggleVisibility.querySelector('.icon-hide');

    if (input.type === 'password') {
      input.type = 'text';
      iconShow.style.display = 'none';
      iconHide.style.display = 'block';
    } else {
      input.type = 'password';
      iconShow.style.display = 'block';
      iconHide.style.display = 'none';
    }
  }

  setupDragAndDrop() {
    const items = document.querySelectorAll('.model-config-item');
    let draggedItem = null;

    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', item.innerHTML);
      });

      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
        items.forEach(i => i.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedItem !== item) {
          // Remove drag-over from all items
          items.forEach(i => i.classList.remove('drag-over'));

          // Add drag-over to current item
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', (e) => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();

        if (draggedItem !== item) {
          const container = document.getElementById('models-sortable-list');
          const allItems = Array.from(container.children);
          const draggedIndex = allItems.indexOf(draggedItem);
          const targetIndex = allItems.indexOf(item);

          if (draggedIndex < targetIndex) {
            container.insertBefore(draggedItem, item.nextSibling);
          } else {
            container.insertBefore(draggedItem, item);
          }

          // Update positions and badges
          this.updateModelPositions();
          this.markDirty();
        }

        items.forEach(i => i.classList.remove('drag-over'));
      });
    });
  }

  updateModelPositions() {
    const items = document.querySelectorAll('.model-config-item');
    items.forEach((item, index) => {
      item.dataset.position = index;

      const badge = item.querySelector('.model-priority-badge');

      if (index === 0) {
        // Primary model
        badge.textContent = 'Primary';
        // Always enable primary and remove disabled class
        item.classList.remove('disabled');
        // Add is-primary class to hide toggle via CSS
        item.classList.add('is-primary');
      } else {
        // Fallback models
        badge.textContent = 'Fallback';
        // Remove is-primary class to show toggle via CSS
        item.classList.remove('is-primary');
      }
    });
  }

  getModelPriorities() {
    const items = document.querySelectorAll('.model-config-item');
    const modelStates = Array.from(items).map(item => ({
      model: item.dataset.model,
      position: parseInt(item.dataset.position),
      disabled: item.classList.contains('disabled')
    }));

    // Sort by position
    modelStates.sort((a, b) => a.position - b.position);

    // Return only enabled models
    return modelStates
      .filter(state => !state.disabled)
      .map(state => state.model);
  }

  async save() {
    try {
      const config = this.gatherConfig();

      console.log('[Options] Saving configuration', {
        articleSelection: config.articleSelection ? {
          perCountry: Object.keys(config.articleSelection.perCountry || {}),
          bufferPerCountry: config.articleSelection.bufferPerCountry,
          maxForAnalysis: config.articleSelection.maxForAnalysis
        } : 'missing',
        analysis: config.analysis ? {
          modelProvider: config.analysis.modelProvider,
          preferredModels: config.analysis.preferredModels,
          compressionLevel: config.analysis.compressionLevel
        } : 'missing'
      });

      // Validate if API models selected but no API key
      if (config.analysis.modelProvider === 'api' || config.analysis.modelProvider === 'gemini-2.5-pro') {
        const hasKey = await APIKeyManager.exists();
        if (!hasKey) {
          alert('Please configure an API key before using API models. Add your API key in the API Configuration section above.');
          return;
        }
      }

      const result = await ConfigManager.save(config);

      if (result.success) {
        console.log('[Options] ConfigManager.save() completed successfully');

        // Reload config from storage to ensure currentConfig is in sync
        await this.loadConfiguration();
        console.log('[Options] Configuration reloaded from storage');

        // Verify the saved configuration
        const verification = await ConfigManager.load();
        console.log('[Options] Verification check:', {
          modelProvider: verification.analysis?.modelProvider,
          countries: Object.keys(verification.articleSelection?.perCountry || {}),
          bufferPerCountry: verification.articleSelection?.bufferPerCountry,
          maxForAnalysis: verification.articleSelection?.maxForAnalysis,
          preferredModels: verification.analysis?.preferredModels
        });

        this.isDirty = false;
        this.showSaveIndicator();

        console.log('[Options] Config saved and reloaded successfully');
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

  // Export for debugging
  window.optionsPage = optionsPage;
});
