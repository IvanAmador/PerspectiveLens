/**
 * Nano Model Manager
 * Unified state management for ALL Chrome Built-in AI APIs
 *
 * Manages availability, download, and status for:
 * - Prompt API (Gemini Nano) - Comparative analysis
 * - Translator API - Title translation
 * - Summarizer API - Article compression
 * - Language Detector API - Language detection
 *
 * Reference: https://developer.chrome.com/docs/ai/built-in
 * Updated: January 2025 with correct Chrome flags
 */

// ===== Chrome Flags (Critical Information) =====

/**
 * REQUIRED Chrome flags for PerspectiveLens
 * These MUST be enabled for full functionality
 *
 * Based on Chrome 138+ (Stable) and research from January 2025
 */
const REQUIRED_FLAGS = {
  // CRITICAL: Prompt API (basic, not multimodal)
  promptAPI: {
    name: 'Prompt API for Gemini Nano',
    url: 'chrome://flags/#prompt-api-for-gemini-nano',
    shortUrl: '#prompt-api-for-gemini-nano',
    value: 'Enabled',
    critical: true,
    purpose: 'Enables Prompt API for comparative analysis',
    affectsAPIs: ['prompt']
  },

  // CRITICAL: Optimization Guide (enables automatic model download)
  optimizationGuide: {
    name: 'Optimization Guide On Device Model',
    url: 'chrome://flags/#optimization-guide-on-device-model',
    shortUrl: '#optimization-guide-on-device-model',
    value: 'Enabled BypassPerfRequirement',
    critical: true,
    purpose: 'Enables automatic Gemini Nano model download and bypasses performance requirements',
    affectsAPIs: ['prompt', 'summarizer'],
    note: 'Model downloads automatically after restart - no manual chrome://components update needed'
  },

  // CRITICAL: Summarization API
  summarizationAPI: {
    name: 'Summarization API for Gemini Nano',
    url: 'chrome://flags/#summarization-api-for-gemini-nano',
    shortUrl: '#summarization-api-for-gemini-nano',
    value: 'Enabled',
    critical: true,
    purpose: 'Enables Summarizer API for article compression',
    affectsAPIs: ['summarizer']
  },

  // OPTIONAL: Language Detection (may be built-in from Chrome 138+)
  languageDetection: {
    name: 'Language Detection API',
    url: 'chrome://flags/#language-detection-api',
    shortUrl: '#language-detection-api',
    value: 'Enabled',
    critical: false,
    purpose: 'Enables Language Detector API (may work without flag)',
    affectsAPIs: ['languageDetector']
  }
};

/**
 * Chrome internals pages for troubleshooting
 */
const CHROME_INTERNALS = {
  onDeviceInternals: {
    name: 'On-Device Model Status',
    url: 'chrome://on-device-internals/',
    purpose: 'Check model download status, size, and troubleshooting info'
  },
  components: {
    name: 'Chrome Components',
    url: 'chrome://components/',
    purpose: 'Advanced: View all Chrome components (automatic updates)'
  }
};

// ===== API State Constants =====

/**
 * Availability states returned by Chrome AI APIs
 * Reference: chrome.dev/docs/ai/prompt-api#model_download
 */
const AVAILABILITY_STATES = {
  READILY: 'readily',       // Chrome 138-139: Ready without download
  READY: 'ready',           // Chrome 140+: Ready for immediate use
  AVAILABLE: 'available',   // Model available after download
  AFTER_DOWNLOAD: 'after-download', // Requires download with user gesture
  DOWNLOADABLE: 'downloadable',     // Can be downloaded
  DOWNLOADING: 'downloading',       // Download in progress
  NO: 'no',                        // Hardware insufficient
  UNAVAILABLE: 'unavailable'       // API not available
};

/**
 * User-friendly UI states (mapped from availability states)
 */
const UI_STATES = {
  READY: 'ready',                    // All APIs ready to use
  DOWNLOAD_REQUIRED: 'download-required',  // User needs to download
  DOWNLOADING: 'downloading',        // Download in progress
  CHECKING: 'checking',              // Checking availability
  FLAGS_DISABLED: 'flags-disabled',  // Chrome flags not enabled
  COMPONENT_UPDATE_NEEDED: 'component-update-needed', // Need to update chrome://components
  HARDWARE_INSUFFICIENT: 'hardware-insufficient', // Hardware doesn't meet requirements
  NOT_SUPPORTED: 'not-supported',    // Browser doesn't support API
  PARTIAL_READY: 'partial-ready'     // Some APIs ready, others not
};

/**
 * Hardware requirements for Gemini Nano
 * Reference: chrome.dev/docs/ai/built-in#hardware
 */
const HARDWARE_REQUIREMENTS = {
  STORAGE_GB: 22,           // Minimum free storage
  VRAM_GB: 4,              // Minimum VRAM for GPU inference
  RAM_GB: 16,              // Minimum RAM for CPU inference
  CPU_CORES: 4,            // Minimum CPU cores
  CONNECTION: 'unmetered', // Requires unmetered connection
  MIN_CHROME_VERSION: 138  // Minimum Chrome version
};

// ===== Nano Model Manager Class =====

/**
 * Centralized manager for all Chrome Built-in AI APIs
 */
export class NanoModelManager {
  constructor() {
    /**
     * Configuration for each Built-in AI API
     */
    this.apis = {
      prompt: {
        name: 'Prompt API',
        displayName: 'Analysis',
        checkFn: () => typeof self.LanguageModel !== 'undefined',
        availabilityFn: () => self.LanguageModel.availability(),
        createFn: (opts) => self.LanguageModel.create(opts),
        requiresFlags: ['promptAPI', 'optimizationGuide'],
        modelSize: '~1.7 GB',
        description: 'Comparative article analysis with Gemini Nano',
        critical: true
      },
      translator: {
        name: 'Translator API',
        displayName: 'Translation',
        checkFn: () => typeof self.Translator !== 'undefined',
        availabilityFn: async () => {
          // Translator API requires options object with sourceLanguage and targetLanguage
          // We check English to Spanish to detect general availability
          try {
            return await self.Translator.availability({
              sourceLanguage: 'en',
              targetLanguage: 'es'
            });
          } catch (error) {
            console.warn('[NanoModelManager] Translator availability check failed:', error);
            return AVAILABILITY_STATES.UNAVAILABLE;
          }
        },
        createFn: (opts) => self.Translator.create(opts),
        requiresFlags: [], // No flags needed (stable API)
        modelSize: '~100 MB per language pair',
        description: 'Title translation for global search',
        critical: true
      },
      summarizer: {
        name: 'Summarizer API',
        displayName: 'Summarization',
        checkFn: () => typeof self.Summarizer !== 'undefined',
        availabilityFn: () => self.Summarizer.availability(),
        createFn: (opts) => self.Summarizer.create(opts),
        requiresFlags: ['summarizationAPI', 'optimizationGuide'],
        modelSize: 'Shared with Gemini Nano',
        description: 'Article content compression',
        critical: true
      },
      languageDetector: {
        name: 'Language Detector API',
        displayName: 'Language Detection',
        checkFn: () => typeof self.LanguageDetector !== 'undefined',
        availabilityFn: () => self.LanguageDetector.availability(),
        createFn: (opts) => self.LanguageDetector.create(opts),
        requiresFlags: [], // May work without flag in Chrome 138+
        modelSize: '~10 MB',
        description: 'Automatic language identification',
        critical: false
      }
    };

    // Download state cache
    this.downloadState = {
      inProgress: false,
      currentAPI: null,
      progress: 0,
      loaded: 0, // Fraction of model downloaded (0.0 to 1.0)
      startTime: null,
      estimatedSize: 0
    };

    // Availability cache (30 seconds)
    this.availabilityCache = {
      data: null,
      timestamp: null,
      duration: 30000
    };
  }

  // ===== Public API =====

  /**
   * Check availability of all APIs
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Object>} Status for each API
   */
  async checkAllAPIs(useCache = true) {
    // Check cache first
    if (useCache && this.isCacheValid()) {
      console.log('[NanoModelManager] Using cached availability');
      return this.availabilityCache.data;
    }

    console.log('[NanoModelManager] Checking all APIs availability...');
    const results = {};

    for (const [apiKey, api] of Object.entries(this.apis)) {
      try {
        // Check if this API is currently downloading
        if (this.downloadState.inProgress && this.downloadState.currentAPI === apiKey) {
          results[apiKey] = {
            name: api.name,
            displayName: api.displayName,
            supported: true,
            availability: AVAILABILITY_STATES.DOWNLOADING,
            uiState: UI_STATES.DOWNLOADING,
            requiresFlags: api.requiresFlags,
            description: api.description,
            modelSize: api.modelSize,
            message: `Downloading... ${this.downloadState.progress}%`,
            critical: api.critical
          };
          console.log(`[NanoModelManager] ${api.name}: downloading (${this.downloadState.progress}%)`);
          continue;
        }

        // Check if API exists in browser
        const isSupported = api.checkFn();

        if (!isSupported) {
          const hasMissingFlags = api.requiresFlags.length > 0;

          results[apiKey] = {
            name: api.name,
            displayName: api.displayName,
            supported: false,
            availability: AVAILABILITY_STATES.UNAVAILABLE,
            uiState: hasMissingFlags
              ? UI_STATES.FLAGS_DISABLED
              : UI_STATES.NOT_SUPPORTED,
            requiresFlags: api.requiresFlags,
            missingFlags: api.requiresFlags.map(flagKey => REQUIRED_FLAGS[flagKey]),
            message: hasMissingFlags
              ? `Enable required Chrome flags: ${api.requiresFlags.join(', ')}`
              : 'API not available in this Chrome version',
            critical: api.critical
          };
          continue;
        }

        // Check availability status
        const availability = await api.availabilityFn();
        const uiState = this.mapAvailabilityToUIState(availability, api.requiresFlags.length > 0);

        results[apiKey] = {
          name: api.name,
          displayName: api.displayName,
          supported: true,
          availability,
          uiState,
          requiresFlags: api.requiresFlags,
          description: api.description,
          modelSize: api.modelSize,
          message: this.getStatusMessage(availability),
          critical: api.critical
        };

        console.log(`[NanoModelManager] ${api.name}: ${availability}`);

      } catch (error) {
        console.error(`[NanoModelManager] Error checking ${api.name}:`, error);
        results[apiKey] = {
          name: api.name,
          displayName: api.displayName,
          supported: false,
          availability: AVAILABILITY_STATES.UNAVAILABLE,
          uiState: UI_STATES.NOT_SUPPORTED,
          error: error.message,
          message: `Error: ${error.message}`,
          critical: api.critical
        };
      }
    }

    // Update cache
    this.availabilityCache.data = results;
    this.availabilityCache.timestamp = Date.now();

    return results;
  }

  /**
   * Get overall system status (unified view)
   * @returns {Promise<Object>} Unified status with overall state
   */
  async getSystemStatus() {
    // Don't use cache if download is in progress to get real-time status
    const useCache = !this.downloadState.inProgress;
    const apiStatuses = await this.checkAllAPIs(useCache);
    const hardware = await this.checkHardwareRequirements();
    const flags = await this.checkRequiredFlags();
    const chromeVersion = this.checkChromeVersion();

    // Determine overall UI state
    const overallState = this.determineOverallState(apiStatuses, flags);

    // Check if critical APIs are ready
    const criticalAPIs = Object.entries(apiStatuses)
      .filter(([_, api]) => api.critical);

    const allCriticalReady = criticalAPIs.every(([_, api]) =>
      this.isAPIReady(api.availability)
    );

    // Get download progress if any API is downloading
    const downloadingAPI = Object.entries(apiStatuses)
      .find(([_, api]) => api.availability === AVAILABILITY_STATES.DOWNLOADING);

    // Check which flags are missing
    const missingFlags = Object.entries(flags)
      .filter(([_, flag]) => flag.required && !flag.enabled)
      .map(([key, _]) => REQUIRED_FLAGS[key]);

    return {
      overall: {
        state: overallState,
        ready: allCriticalReady,
        message: this.getOverallMessage(overallState, apiStatuses),
        downloadInProgress: !!downloadingAPI,
        flagsEnabled: missingFlags.length === 0,
        missingFlags
      },
      apis: apiStatuses,
      hardware,
      flags,
      chromeVersion,
      download: this.downloadState,
      internals: CHROME_INTERNALS,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start downloading models for a specific API
   * @param {string} apiKey - API to download (e.g., 'prompt', 'translator')
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<Object>} Created session
   */
  async downloadAPI(apiKey, onProgress = null) {
    const api = this.apis[apiKey];
    if (!api) {
      throw new Error(`Unknown API: ${apiKey}`);
    }

    // Check if API exists in browser
    if (!api.checkFn()) {
      throw new Error(`${api.name} is not available in this browser. Make sure required Chrome flags are enabled.`);
    }

    // Check current availability status
    console.log(`[NanoModelManager] Checking ${api.name} availability before download...`);
    const availability = await api.availabilityFn();
    console.log(`[NanoModelManager] ${api.name} availability: ${availability}`);

    // Validate that download is needed and allowed
    if (availability === AVAILABILITY_STATES.READILY ||
        availability === AVAILABILITY_STATES.READY ||
        availability === AVAILABILITY_STATES.AVAILABLE) {
      throw new Error(`${api.name} is already available. No download needed.`);
    }

    if (availability === AVAILABILITY_STATES.UNAVAILABLE) {
      throw new Error(`${api.name} is unavailable on this device. Check hardware requirements and Chrome flags.`);
    }

    if (availability === AVAILABILITY_STATES.NO) {
      throw new Error(`${api.name} cannot be used on this device (hardware insufficient or flags disabled).`);
    }

    // Only proceed if downloadable, after-download, or downloading
    if (availability !== AVAILABILITY_STATES.DOWNLOADABLE &&
        availability !== AVAILABILITY_STATES.AFTER_DOWNLOAD &&
        availability !== AVAILABILITY_STATES.DOWNLOADING) {
      throw new Error(`${api.name} is not in a downloadable state (current: ${availability}). Enable required Chrome flags first.`);
    }

    console.log(`[NanoModelManager] Starting download for ${api.name}...`);

    this.downloadState.inProgress = true;
    this.downloadState.currentAPI = apiKey;
    this.downloadState.progress = 0;
    this.downloadState.loaded = 0;
    this.downloadState.startTime = Date.now();
    this.downloadState.estimatedSize = this.getEstimatedSize(apiKey);

    try {
      console.log(`[NanoModelManager] Creating session with monitor for ${api.name}...`);
      console.log(`[NanoModelManager] Current availability before create():`, availability);

      const self = this; // Capture this context
      let progressEventFired = false;

      // Diagnostic timeout to check if event fires
      const diagnosticTimeout = setTimeout(() => {
        if (!progressEventFired) {
          console.warn(`[NanoModelManager] WARNING: No downloadprogress events fired after 3 seconds`);
          console.warn(`[NanoModelManager] This may indicate:`);
          console.warn(`  - Model already cached/downloaded`);
          console.warn(`  - Download completing too quickly`);
          console.warn(`  - Chrome bug with downloadprogress event`);
          console.warn(`[NanoModelManager] Check chrome://on-device-internals for model status`);
        }
      }, 3000);

      const session = await api.createFn({
        monitor(m) {
          console.log(`[NanoModelManager] Monitor function called for ${api.name}`);
          console.log(`[NanoModelManager] Monitor object:`, m);
          console.log(`[NanoModelManager] Monitor addEventListener exists:`, typeof m.addEventListener === 'function');

          m.addEventListener('downloadprogress', (e) => {
            progressEventFired = true;
            clearTimeout(diagnosticTimeout);

            const progress = e.loaded === 0 ? 0 : Math.max(1, Math.round(e.loaded * 100));

            console.log(`[NanoModelManager] *** DOWNLOAD PROGRESS EVENT FIRED ***`, {
              api: api.name,
              loaded: e.loaded,
              total: e.total,
              progress: progress + '%',
              rawEvent: e,
              timestamp: new Date().toISOString()
            });

            // Update internal state using captured context
            self.downloadState.progress = progress;
            self.downloadState.loaded = e.loaded || 0;

            // Call progress callback
            if (onProgress) {
              console.log(`[NanoModelManager] Calling onProgress callback with:`, {
                progress,
                apiName: api.displayName,
                loaded: e.loaded
              });

              onProgress({
                progress,
                apiKey,
                apiName: api.displayName,
                loaded: e.loaded,
                estimatedSize: self.downloadState.estimatedSize
              });
            } else {
              console.error(`[NanoModelManager] onProgress callback is NULL!`);
            }
          });

          console.log(`[NanoModelManager] downloadprogress event listener registered successfully`);
        }
      });

      // Clean up diagnostic timeout
      clearTimeout(diagnosticTimeout);

      console.log(`[NanoModelManager] ${api.name} session created successfully`, {
        sessionExists: !!session,
        progressEventFired,
        finalProgress: self.downloadState.progress
      });

      this.downloadState.inProgress = false;
      this.downloadState.progress = 100;
      this.downloadState.loaded = 1.0;

      // Invalidate cache to force refresh
      this.invalidateCache();

      // Destroy session immediately (best practice)
      if (session && typeof session.destroy === 'function') {
        session.destroy();
      }

      return session;

    } catch (error) {
      console.error(`[NanoModelManager] Download failed for ${api.name}:`, error);
      this.downloadState.inProgress = false;
      this.downloadState.progress = 0;
      this.downloadState.loaded = 0;
      throw error;
    }
  }

  /**
   * Check hardware requirements
   * @returns {Promise<Object>} Hardware status
   */
  async checkHardwareRequirements() {
    const result = {
      storage: null,
      connection: null,
      meets: true,
      issues: []
    };

    // Check storage using Storage API
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const availableGB = (estimate.quota - estimate.usage) / (1024 ** 3);
        const requiredGB = HARDWARE_REQUIREMENTS.STORAGE_GB;

        result.storage = {
          available: Math.round(availableGB * 10) / 10,
          required: requiredGB,
          sufficient: availableGB >= requiredGB,
          unit: 'GB'
        };

        if (availableGB < requiredGB) {
          result.meets = false;
          result.issues.push({
            type: 'storage',
            severity: 'critical',
            message: `Need ${requiredGB} GB free storage, have ${Math.round(availableGB)} GB`
          });
        }
      } else {
        result.storage = {
          available: null,
          required: HARDWARE_REQUIREMENTS.STORAGE_GB,
          sufficient: null,
          message: 'Storage API not available'
        };
      }
    } catch (error) {
      console.error('[NanoModelManager] Storage check failed:', error);
      result.storage = { error: error.message };
    }

    // Check connection type (metered vs unmetered)
    try {
      if ('connection' in navigator) {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const isMetered = conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';

        result.connection = {
          type: isMetered ? 'metered' : 'unmetered',
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          isMetered,
          suitable: !isMetered
        };

        if (isMetered) {
          result.meets = false;
          result.issues.push({
            type: 'connection',
            severity: 'warning',
            message: 'Model download requires unmetered Wi-Fi or ethernet connection'
          });
        }
      } else {
        result.connection = {
          type: 'unknown',
          suitable: null,
          message: 'Connection API not available'
        };
      }
    } catch (error) {
      console.error('[NanoModelManager] Connection check failed:', error);
      result.connection = { error: error.message };
    }

    // Note about GPU/CPU requirements (cannot check via JS)
    result.requirements = {
      gpu: `${HARDWARE_REQUIREMENTS.VRAM_GB}GB+ VRAM`,
      cpu: `${HARDWARE_REQUIREMENTS.RAM_GB}GB+ RAM, ${HARDWARE_REQUIREMENTS.CPU_CORES}+ cores`,
      note: 'GPU/CPU requirements cannot be verified via JavaScript'
    };

    return result;
  }

  /**
   * Check if required Chrome flags are enabled
   * @returns {Promise<Object>} Flags status
   */
  async checkRequiredFlags() {
    const results = {};

    // Check each required flag
    for (const [flagKey, flagConfig] of Object.entries(REQUIRED_FLAGS)) {
      results[flagKey] = {
        ...flagConfig,
        enabled: false,
        checked: false,
        message: ''
      };

      try {
        // Determine which API this flag affects
        const affectedAPIs = flagConfig.affectsAPIs || [];

        if (affectedAPIs.length === 0) {
          // No specific API to check, assume enabled
          results[flagKey].enabled = true;
          results[flagKey].checked = true;
          results[flagKey].message = 'No API check available';
          continue;
        }

        // Check if any affected API is actually available (not just exists)
        let anyAPIAvailable = false;
        for (const apiKey of affectedAPIs) {
          const api = this.apis[apiKey];
          if (api && api.checkFn()) {
            // API exists in browser, now check if it's actually usable
            try {
              const availability = await api.availabilityFn();

              // If availability() works and returns anything except 'unavailable',
              // the flag is likely enabled
              if (availability && availability !== AVAILABILITY_STATES.UNAVAILABLE) {
                anyAPIAvailable = true;
                break;
              }
            } catch (error) {
              // If availability() throws error, flag might be disabled
              console.warn(`[NanoModelManager] Flag check for ${flagKey}: availability() failed`, error);
            }
          }
        }

        results[flagKey].enabled = anyAPIAvailable;
        results[flagKey].checked = true;
        results[flagKey].message = anyAPIAvailable
          ? 'Flag enabled (API functional)'
          : `Flag disabled or not functional (${flagConfig.shortUrl})`;

      } catch (error) {
        results[flagKey].enabled = false;
        results[flagKey].checked = true;
        results[flagKey].message = `Error checking: ${error.message}`;
      }
    }

    return results;
  }

  /**
   * Get Chrome version
   * @returns {number|null} Chrome version or null
   */
  getChromeVersion() {
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Check if Chrome version meets requirements
   * @returns {Object} Version check result
   */
  checkChromeVersion() {
    const version = this.getChromeVersion();
    const minVersion = HARDWARE_REQUIREMENTS.MIN_CHROME_VERSION;

    return {
      current: version,
      required: minVersion,
      meets: version >= minVersion,
      message: version
        ? version >= minVersion
          ? `Chrome ${version} (supported)`
          : `Chrome ${version} (requires ${minVersion}+)`
        : 'Not Chrome or version detection failed'
    };
  }

  /**
   * Get flags setup guide
   * @returns {Object} Step-by-step instructions
   */
  getFlagsSetupGuide() {
    return {
      title: 'Enable Chrome AI Features',
      steps: [
        {
          number: 1,
          title: 'Enable Prompt API',
          description: 'Enables Gemini Nano for analysis',
          action: `Go to ${REQUIRED_FLAGS.promptAPI.url}`,
          shortUrl: REQUIRED_FLAGS.promptAPI.shortUrl,
          value: REQUIRED_FLAGS.promptAPI.value
        },
        {
          number: 2,
          title: 'Enable Optimization Guide',
          description: 'Enables model download (bypass performance requirements)',
          action: `Go to ${REQUIRED_FLAGS.optimizationGuide.url}`,
          shortUrl: REQUIRED_FLAGS.optimizationGuide.shortUrl,
          value: REQUIRED_FLAGS.optimizationGuide.value
        },
        {
          number: 3,
          title: 'Enable Summarization API',
          description: 'Enables article compression',
          action: `Go to ${REQUIRED_FLAGS.summarizationAPI.url}`,
          shortUrl: REQUIRED_FLAGS.summarizationAPI.shortUrl,
          value: REQUIRED_FLAGS.summarizationAPI.value
        },
        {
          number: 4,
          title: 'Restart Chrome',
          description: 'Changes take effect after restart',
          action: 'Click "Relaunch" button or restart Chrome manually',
          note: 'Gemini Nano will download automatically in the background (~1.7 GB)'
        }
      ],
      estimatedTime: '5-10 minutes (including automatic model download)',
      troubleshooting: {
        title: 'If models do not download automatically',
        steps: [
          'Wait 1-2 minutes after restart for download to start',
          'Check status at chrome://on-device-internals/',
          'Ensure you have 22GB+ free storage and unmetered connection',
          'Try disabling and re-enabling the flags'
        ]
      }
    };
  }

  /**
   * Invalidate availability cache
   */
  invalidateCache() {
    this.availabilityCache.data = null;
    this.availabilityCache.timestamp = null;
    console.log('[NanoModelManager] Cache invalidated');
  }

  // ===== Helper Methods =====

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    if (!this.availabilityCache.data || !this.availabilityCache.timestamp) {
      return false;
    }
    const age = Date.now() - this.availabilityCache.timestamp;
    return age < this.availabilityCache.duration;
  }

  /**
   * Map API availability state to UI state
   */
  mapAvailabilityToUIState(availability, requiresFlags) {
    if (!availability) return UI_STATES.CHECKING;

    switch (availability) {
      case AVAILABILITY_STATES.READILY:
      case AVAILABILITY_STATES.READY:
      case AVAILABILITY_STATES.AVAILABLE:
        return UI_STATES.READY;

      case AVAILABILITY_STATES.AFTER_DOWNLOAD:
      case AVAILABILITY_STATES.DOWNLOADABLE:
        return UI_STATES.DOWNLOAD_REQUIRED;

      case AVAILABILITY_STATES.DOWNLOADING:
        return UI_STATES.DOWNLOADING;

      case AVAILABILITY_STATES.NO:
        return UI_STATES.HARDWARE_INSUFFICIENT;

      case AVAILABILITY_STATES.UNAVAILABLE:
        return requiresFlags ? UI_STATES.FLAGS_DISABLED : UI_STATES.NOT_SUPPORTED;

      default:
        return UI_STATES.NOT_SUPPORTED;
    }
  }

  /**
   * Check if API is ready to use
   */
  isAPIReady(availability) {
    return [
      AVAILABILITY_STATES.READILY,
      AVAILABILITY_STATES.READY,
      AVAILABILITY_STATES.AVAILABLE
    ].includes(availability);
  }

  /**
   * Determine overall system state from individual API states
   */
  determineOverallState(apiStatuses, flagsStatus) {
    const states = Object.values(apiStatuses).map(api => api.uiState);
    const criticalAPIs = Object.values(apiStatuses).filter(api => api.critical);

    // Check if critical flags are disabled
    const criticalFlagsMissing = Object.values(flagsStatus || {})
      .filter(flag => flag.critical && !flag.enabled);

    if (criticalFlagsMissing.length > 0) {
      return UI_STATES.FLAGS_DISABLED;
    }

    // Check if any critical API has flags disabled
    const hasFlagsDisabled = criticalAPIs.some(api =>
      api.uiState === UI_STATES.FLAGS_DISABLED
    );
    if (hasFlagsDisabled) return UI_STATES.FLAGS_DISABLED;

    // Check if any API is downloading
    const isDownloading = states.includes(UI_STATES.DOWNLOADING);
    if (isDownloading) return UI_STATES.DOWNLOADING;

    // Check if all critical APIs are ready
    const allCriticalReady = criticalAPIs.every(api =>
      api.uiState === UI_STATES.READY
    );
    if (allCriticalReady) return UI_STATES.READY;

    // Check if any critical API needs download
    const needsDownload = criticalAPIs.some(api =>
      api.uiState === UI_STATES.DOWNLOAD_REQUIRED
    );
    if (needsDownload) return UI_STATES.DOWNLOAD_REQUIRED;

    // Check hardware issues
    const hasHardwareIssues = states.includes(UI_STATES.HARDWARE_INSUFFICIENT);
    if (hasHardwareIssues) return UI_STATES.HARDWARE_INSUFFICIENT;

    // Mixed states
    const someReady = states.includes(UI_STATES.READY);
    if (someReady) return UI_STATES.PARTIAL_READY;

    return UI_STATES.NOT_SUPPORTED;
  }

  /**
   * Get user-friendly message for availability state
   */
  getStatusMessage(availability) {
    const messages = {
      [AVAILABILITY_STATES.READILY]: 'Ready to use',
      [AVAILABILITY_STATES.READY]: 'Ready to use',
      [AVAILABILITY_STATES.AVAILABLE]: 'Ready to use',
      [AVAILABILITY_STATES.AFTER_DOWNLOAD]: 'Download required',
      [AVAILABILITY_STATES.DOWNLOADABLE]: 'Download required',
      [AVAILABILITY_STATES.DOWNLOADING]: 'Downloading model...',
      [AVAILABILITY_STATES.NO]: 'Hardware insufficient',
      [AVAILABILITY_STATES.UNAVAILABLE]: 'Not available'
    };
    return messages[availability] || 'Unknown status';
  }

  /**
   * Get overall system message
   */
  getOverallMessage(state, apiStatuses) {
    const messages = {
      [UI_STATES.READY]: 'All systems ready',
      [UI_STATES.DOWNLOAD_REQUIRED]: 'Download AI models to continue',
      [UI_STATES.DOWNLOADING]: 'Downloading AI models...',
      [UI_STATES.FLAGS_DISABLED]: 'Enable Chrome flags to continue',
      [UI_STATES.COMPONENT_UPDATE_NEEDED]: 'Update chrome://components',
      [UI_STATES.HARDWARE_INSUFFICIENT]: 'Hardware does not meet requirements',
      [UI_STATES.NOT_SUPPORTED]: 'Chrome AI not supported',
      [UI_STATES.PARTIAL_READY]: 'Some features available',
      [UI_STATES.CHECKING]: 'Checking system status...'
    };
    return messages[state] || 'Checking status...';
  }

  /**
   * Get estimated download size for API
   */
  getEstimatedSize(apiKey) {
    const sizes = {
      prompt: 1.7, // GB
      translator: 0.1, // GB (per language pair)
      summarizer: 0, // Shared with prompt
      languageDetector: 0.01 // GB
    };
    return sizes[apiKey] || 0;
  }
}

// ===== Export Singleton Instance =====

export const nanoModelManager = new NanoModelManager();

// ===== Export Constants =====

export {
  REQUIRED_FLAGS,
  CHROME_INTERNALS,
  AVAILABILITY_STATES,
  UI_STATES,
  HARDWARE_REQUIREMENTS
};
