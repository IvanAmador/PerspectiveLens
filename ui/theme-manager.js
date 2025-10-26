/**
 * Theme Manager - Automatic Dark/Light Mode Detection
 * Synchronizes theme across all extension contexts (popup, options, content script)
 */

class ThemeManager {
  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.currentTheme = null;
    this.storageKey = 'perspectiveLens_theme_preference';
  }

  /**
   * Initialize theme manager - detects system preference and applies theme
   * @returns {Promise<string>} Current theme ('light' or 'dark')
   */
  async init() {
    try {
      // Try to load user preference first
      const storedPreference = await this.loadPreference();

      if (storedPreference) {
        this.applyTheme(storedPreference);
      } else {
        // Use system preference
        this.applySystemTheme();
      }

      // Listen for system theme changes
      this.mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't set a manual preference
        this.loadPreference().then(pref => {
          if (!pref) {
            this.applyTheme(e.matches ? 'dark' : 'light');
          }
        }).catch(err => {
          // If preference loading fails, just apply system theme
          console.warn('[ThemeManager] Could not load preference on theme change:', err);
          this.applyTheme(e.matches ? 'dark' : 'light');
        });
      });

      return this.currentTheme;
    } catch (error) {
      // Handle context invalidation gracefully
      if (error.message?.includes('Extension context invalidated')) {
        console.warn('[ThemeManager] Extension context invalidated during init, using system preference');
        this.applySystemTheme();
        return this.currentTheme;
      }
      console.error('[ThemeManager] Initialization error:', error);
      // Fallback to light mode
      this.applyTheme('light');
      return 'light';
    }
  }

  /**
   * Apply system theme preference
   */
  applySystemTheme() {
    const isDark = this.mediaQuery.matches;
    this.applyTheme(isDark ? 'dark' : 'light');
  }

  /**
   * Apply a specific theme
   * @param {string} theme - 'light' or 'dark'
   */
  applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      console.warn(`[ThemeManager] Invalid theme: ${theme}, defaulting to light`);
      theme = 'light';
    }

    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Apply theme to Shadow DOM host element
    const shadowHost = document.getElementById('perspective-lens-root');
    if (shadowHost) {
      shadowHost.setAttribute('data-theme', theme);
      console.log(`[ThemeManager] Applied theme to Shadow DOM: ${theme}`);
    }

    // Emit custom event for other components that need to react
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme }
    }));
  }

  /**
   * Manually set theme preference (overrides system preference)
   * @param {string} theme - 'light', 'dark', or 'system'
   */
  async setTheme(theme) {
    if (theme === 'system') {
      // Clear manual preference and use system
      await this.clearPreference();
      this.applySystemTheme();
    } else {
      // Save manual preference
      await this.savePreference(theme);
      this.applyTheme(theme);
    }
  }

  /**
   * Get current theme
   * @returns {string} Current theme ('light' or 'dark')
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Load user preference from storage
   * @returns {Promise<string|null>} Stored theme or null
   */
  async loadPreference() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
          chrome.storage.local.get([this.storageKey], (result) => {
            // Check for extension context invalidation
            if (chrome.runtime.lastError) {
              console.warn('[ThemeManager] Extension context invalidated, using fallback');
              resolve(null);
              return;
            }
            resolve(result[this.storageKey] || null);
          });
        });
      }
      // Fallback to localStorage for non-extension contexts
      return localStorage.getItem(this.storageKey);
    } catch (error) {
      // Handle context invalidation gracefully
      if (error.message?.includes('Extension context invalidated')) {
        console.warn('[ThemeManager] Extension context invalidated, using system preference');
        return null;
      }
      console.error('[ThemeManager] Error loading preference:', error);
      return null;
    }
  }

  /**
   * Save user preference to storage
   * @param {string} theme - Theme to save
   */
  async savePreference(theme) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ [this.storageKey]: theme });
        // Check for extension context invalidation
        if (chrome.runtime.lastError) {
          console.warn('[ThemeManager] Extension context invalidated, could not save preference');
          return;
        }
      } else {
        localStorage.setItem(this.storageKey, theme);
      }
    } catch (error) {
      // Handle context invalidation gracefully
      if (error.message?.includes('Extension context invalidated')) {
        console.warn('[ThemeManager] Extension context invalidated, preference not saved');
        return;
      }
      console.error('[ThemeManager] Error saving preference:', error);
    }
  }

  /**
   * Clear user preference (revert to system preference)
   */
  async clearPreference() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove([this.storageKey]);
        // Check for extension context invalidation
        if (chrome.runtime.lastError) {
          console.warn('[ThemeManager] Extension context invalidated, could not clear preference');
          return;
        }
      } else {
        localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      // Handle context invalidation gracefully
      if (error.message?.includes('Extension context invalidated')) {
        console.warn('[ThemeManager] Extension context invalidated, preference not cleared');
        return;
      }
      console.error('[ThemeManager] Error clearing preference:', error);
    }
  }

  /**
   * Check if dark mode is currently active
   * @returns {boolean}
   */
  isDarkMode() {
    return this.currentTheme === 'dark';
  }

  /**
   * Toggle between light and dark mode
   * @returns {Promise<string>} New theme
   */
  async toggle() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    await this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Destroy theme manager - cleanup listeners
   */
  destroy() {
    this.mediaQuery.removeEventListener('change', this.applySystemTheme);
  }
}

// Create singleton instance
const themeManager = new ThemeManager();

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => themeManager.init());
} else {
  themeManager.init();
}

// Export for use in modules and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = themeManager;
}

// Make available globally
window.themeManager = themeManager;
