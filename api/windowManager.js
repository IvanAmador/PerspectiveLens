/**
 * Processing Window Manager for PerspectiveLens
 *
 * Manages a dedicated browser window for article content extraction:
 * - Creates isolated window (minimized/offscreen) to avoid disrupting user
 * - Shows informative HTML page explaining the process
 * - Reuses same window for all batches
 * - Handles cleanup automatically
 *
 * Why separate window?
 * - Clean separation from user's browsing
 * - Easy cleanup (close entire window vs individual tabs)
 * - Better user transparency (can expand to see what's happening)
 * - Professional appearance
 */

import { logger } from '../utils/logger.js';
import { PIPELINE_CONFIG } from '../config/pipeline.js';

export class ProcessingWindowManager {
  constructor(options = {}) {
    this.windowId = null;
    this.tabIds = [];
    this.infoTabId = null;  // The tab showing processing.html

    this.options = {
      windowState: options.windowState ?? 'minimized', // 'minimized', 'normal', 'offscreen'
      showInfoPage: options.showInfoPage ?? true,      // Show processing.html
      ...options
    };

    logger.system.debug('WindowManager initialized', {
      category: logger.CATEGORIES.FETCH,
      data: { options: this.options }
    });
  }

  /**
   * Create dedicated processing window with info page
   *
   * @returns {Promise<number>} Window ID
   */
  async createProcessingWindow() {
    if (this.windowId) {
      // Verify window still exists
      const isAlive = await this.isWindowAlive();
      if (isAlive) {
        logger.system.debug('Processing window already exists', {
          category: logger.CATEGORIES.FETCH,
          data: { windowId: this.windowId }
        });
        return this.windowId;
      } else {
        logger.system.warn('Existing window was closed, creating new one', {
          category: logger.CATEGORIES.FETCH,
          data: { oldWindowId: this.windowId }
        });
        this.reset();
      }
    }

    logger.system.info('Creating dedicated processing window', {
      category: logger.CATEGORIES.FETCH,
      data: { state: this.options.windowState }
    });

    try {
      // Create window with info page or blank
      const url = this.options.showInfoPage
        ? chrome.runtime.getURL('offscreen/processing.html')
        : 'about:blank';

      const win = await chrome.windows.create({
        url,
        type: 'normal',
        focused: false,        // Don't steal focus from user
        state: 'normal',       // Start normal, then apply state
        width: 800,
        height: 600,
        left: 100,
        top: 100
      });

      this.windowId = win.id;

      // Track the info tab
      if (this.options.showInfoPage && win.tabs && win.tabs.length > 0) {
        this.infoTabId = win.tabs[0].id;
        logger.system.debug('Info page tab created', {
          category: logger.CATEGORIES.FETCH,
          data: { tabId: this.infoTabId }
        });
      }

      logger.system.debug('Window created', {
        category: logger.CATEGORIES.FETCH,
        data: {
          windowId: this.windowId,
          infoTabId: this.infoTabId
        }
      });

      // Apply desired state (minimized/offscreen/normal)
      await this.applyWindowState(this.options.windowState);

      logger.system.info('Processing window ready', {
        category: logger.CATEGORIES.FETCH,
        data: {
          windowId: this.windowId,
          state: this.options.windowState
        }
      });

      return this.windowId;
    } catch (error) {
      logger.system.error('Failed to create processing window', {
        category: logger.CATEGORIES.ERROR,
        error,
        data: { options: this.options }
      });
      throw error;
    }
  }

  /**
   * Apply window state (minimized, offscreen, or normal)
   *
   * @param {string} state - 'minimized', 'offscreen', or 'normal'
   * @returns {Promise<void>}
   */
  async applyWindowState(state) {
    if (!this.windowId) {
      throw new Error('Window must be created before applying state');
    }

    try {
      if (state === 'minimized') {
        // Try to minimize (may fail in MV3)
        try {
          await chrome.windows.update(this.windowId, { state: 'minimized' });

          logger.system.debug('Window minimized successfully', {
            category: logger.CATEGORIES.FETCH,
            data: { windowId: this.windowId }
          });
        } catch (error) {
          logger.system.warn('Minimizing failed, falling back to offscreen', {
            category: logger.CATEGORIES.FETCH,
            error
          });

          // Fallback: Move offscreen
          await this.applyWindowState('offscreen');
        }
      } else if (state === 'offscreen') {
        // Move window off screen (works reliably)
        await chrome.windows.update(this.windowId, {
          left: -2000,
          top: -2000,
          state: 'normal'
        });

        logger.system.debug('Window moved offscreen', {
          category: logger.CATEGORIES.FETCH,
          data: { windowId: this.windowId }
        });
      } else if (state === 'normal') {
        // Keep visible (useful for debugging)
        logger.system.debug('Window kept in normal state', {
          category: logger.CATEGORIES.FETCH,
          data: { windowId: this.windowId }
        });
      } else {
        logger.system.warn('Unknown window state, using offscreen', {
          category: logger.CATEGORIES.FETCH,
          data: { state }
        });
        await this.applyWindowState('offscreen');
      }
    } catch (error) {
      logger.system.error('Failed to apply window state', {
        category: logger.CATEGORIES.ERROR,
        error,
        data: { state, windowId: this.windowId }
      });
      // Don't throw - window still usable
    }
  }

  /**
   * Create a new tab in the processing window
   *
   * @param {string} url - URL to load
   * @returns {Promise<chrome.tabs.Tab>} Created tab
   */
  async createTab(url) {
    // Ensure window exists
    if (!this.windowId) {
      await this.createProcessingWindow();
    }

    // Verify window is still alive
    const isAlive = await this.isWindowAlive();
    if (!isAlive) {
      logger.system.warn('Processing window was closed, recreating', {
        category: logger.CATEGORIES.FETCH
      });
      this.reset();
      await this.createProcessingWindow();
    }

    logger.system.trace('Creating tab in processing window', {
      category: logger.CATEGORIES.FETCH,
      data: {
        url: url.substring(0, 80),
        windowId: this.windowId
      }
    });

    try {
      // Create tab in processing window
      const tab = await chrome.tabs.create({
        url,
        windowId: this.windowId,
        active: false,
        pinned: false
      });

      // Verify tab was created in correct window
      if (tab.windowId !== this.windowId) {
        logger.system.error('Tab created in wrong window!', {
          category: logger.CATEGORIES.ERROR,
          data: {
            expectedWindow: this.windowId,
            actualWindow: tab.windowId,
            tabId: tab.id
          }
        });

        // Try to move tab to correct window
        try {
          await chrome.tabs.move(tab.id, {
            windowId: this.windowId,
            index: -1
          });
          logger.system.info('Tab moved to correct window', {
            category: logger.CATEGORIES.FETCH,
            data: { tabId: tab.id }
          });
        } catch (moveError) {
          logger.system.error('Failed to move tab to correct window', {
            category: logger.CATEGORIES.ERROR,
            error: moveError
          });
        }
      }

      // Track tab
      this.tabIds.push(tab.id);

      logger.system.trace('Tab created successfully', {
        category: logger.CATEGORIES.FETCH,
        data: {
          tabId: tab.id,
          windowId: tab.windowId,
          totalTabs: this.tabIds.length
        }
      });

      return tab;
    } catch (error) {
      logger.system.error('Failed to create tab', {
        category: logger.CATEGORIES.ERROR,
        error,
        data: {
          url: url.substring(0, 80),
          windowId: this.windowId
        }
      });
      throw error;
    }
  }

  /**
   * Remove a tab from tracking (after successful extraction)
   *
   * @param {number} tabId - Tab to remove
   * @param {boolean} closeTab - Whether to close the tab
   * @returns {Promise<void>}
   */
  async removeTab(tabId, closeTab = true) {
    const index = this.tabIds.indexOf(tabId);
    if (index > -1) {
      this.tabIds.splice(index, 1);
    }

    if (closeTab) {
      try {
        await chrome.tabs.remove(tabId);

        logger.system.trace('Tab removed', {
          category: logger.CATEGORIES.FETCH,
          data: { tabId, remainingTabs: this.tabIds.length }
        });
      } catch (error) {
        logger.system.trace('Tab already closed', {
          category: logger.CATEGORIES.FETCH,
          data: { tabId }
        });
      }
    }
  }

  /**
   * Check if window still exists
   *
   * @returns {Promise<boolean>}
   */
  async isWindowAlive() {
    if (!this.windowId) return false;

    try {
      await chrome.windows.get(this.windowId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get window statistics
   *
   * @returns {Promise<Object>} Window stats
   */
  async getStats() {
    const alive = await this.isWindowAlive();

    return {
      windowId: this.windowId,
      alive,
      totalTabs: this.tabIds.length,
      activeTabs: this.tabIds,
      infoTabId: this.infoTabId,
      options: this.options
    };
  }

  /**
   * Reset internal state
   */
  reset() {
    this.windowId = null;
    this.tabIds = [];
    this.infoTabId = null;
  }

  /**
   * Cleanup: Close processing window and all tabs
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.windowId) {
      logger.system.debug('No window to cleanup', {
        category: logger.CATEGORIES.FETCH
      });
      return;
    }

    logger.system.info('Cleaning up processing window', {
      category: logger.CATEGORIES.FETCH,
      data: {
        windowId: this.windowId,
        tabCount: this.tabIds.length
      }
    });

    try {
      // Close entire window (automatically closes all tabs)
      await chrome.windows.remove(this.windowId);

      logger.system.info('Processing window closed', {
        category: logger.CATEGORIES.FETCH,
        data: { windowId: this.windowId }
      });
    } catch (error) {
      logger.system.warn('Window already closed or cleanup failed', {
        category: logger.CATEGORIES.FETCH,
        error,
        data: { windowId: this.windowId }
      });
    } finally {
      // Reset state
      this.reset();
    }
  }
}

/**
 * Helper function to create a window manager with config defaults
 *
 * @param {Object} overrides - Override default options
 * @returns {ProcessingWindowManager}
 */
export function createWindowManager(overrides = {}) {
  const config = PIPELINE_CONFIG.extraction.windowManager || {};

  return new ProcessingWindowManager({
    ...config,
    ...overrides
  });
}
