/**
 * Options Page Controller
 * Handles settings UI for PerspectiveLens
 */

import { ConfigManager } from '../../../config/configManager.js';
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

  populateUI() {
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
