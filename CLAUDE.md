# PerspectiveLens - Development Guidelines

## Project Overview

PerspectiveLens is an advanced Chrome extension that provides comparative news analysis using AI models. The extension helps users understand news stories from multiple international perspectives by automatically finding, extracting, and comparing coverage from diverse news sources around the world.

The extension offers two AI model providers:
- **Gemini Nano** (Local): Chrome's built-in AI (available in Chrome 138+) running locally on device - free, private, no API key required
- **API Models** (Cloud): Intelligent multi-model system with automatic fallback:
  - **Gemini 2.5 Pro**: Most capable model (5 RPM / 100 RPD)
  - **Gemini 2.5 Flash**: Fast model with good performance (10 RPM / 250 RPD)
  - **Gemini 2.5 Flash Lite**: High-volume fallback model (15 RPM / 1000 RPD)
  - Requires Google AI Studio API key, supports larger contexts and multi-language processing
  - Automatically falls back to next model when rate limits are hit

The extension identifies news articles as users browse, searches for the same story across multiple international sources, extracts clean article content using advanced extraction algorithms, performs comparative analysis using the selected AI model, and presents structured insights highlighting consensus, disputes, and different framing approaches.

## Architecture

The extension follows a modern architectural pattern with separation of concerns across multiple folders:

### Core Components
- **API Layer** (`api/`):
  - Chrome AI API wrappers (Language Detector, Translator, Summarizer, Language Model) for Gemini Nano
  - `api/geminiAPI.js`: Unified REST API wrapper for Gemini 2.5 Pro/Flash/Flash Lite with progressive analysis support
  - `api/modelRouter.js`: Intelligent model selection with automatic fallback on rate limits
- **Config Layer** (`config/`):
  - `config/pipeline.js`: Default configuration for all AI models
  - `config/configManager.js`: Configuration management and persistence
  - `config/apiKeyManager.js`: Secure API key storage and validation for API models
- **Utilities** (`utils/`):
  - `utils/rateLimitCache.js`: Reactive rate limit tracking based on API 429 responses
- **Background Service** (`scripts/background.js`): Orchestrates the analysis pipeline, routes between AI models, and coordinates API calls
- **Content Script** (`scripts/content.js`): Detects articles on web pages, creates Shadow DOM, and manages UI components
- **UI Components** (`ui/`):
  - Modern panel system with toast notifications and progress tracking, rendered inside Shadow DOM
  - Popup interface (`popup.html`, `ui/pages/popup/popup.js`, `ui/pages/popup/popup.css`) for model selection and status
- **Utilities** (`utils/`): Logging, error handling, language utilities, and content validation
- **Prompts** (`prompts/`): AI prompt templates and JSON schemas for structured output
- **Offscreen Document** (`offscreen/`): Content extraction using Readability.js in a hidden context

### Shadow DOM Architecture
**CRITICAL**: The extension uses Shadow DOM for complete style isolation between the extension UI and host websites.

- **Shadow Host**: `<div id="perspective-lens-root">` created in Light DOM
- **Shadow Root**: Attached in "open" mode for debugging
- **Shadow Container**: `<div id="pl-shadow-container">` inside Shadow Root where all UI components are injected
- **Global References**: `window.__PL_SHADOW_ROOT__` and `window.__PL_SHADOW_CONTAINER__` for component access

**Key Implementation Details**:
1. Shadow DOM is created by `createShadowDOM()` function in `scripts/content.js`
2. CSS files are fetched and injected as `<style>` elements (not `<link>` tags)
3. CSS variables use `:host` instead of `:root` (automatic conversion during injection)
4. Theme selectors use `:host([data-theme='dark'])` instead of `[data-theme='dark']`
5. Theme changes are synchronized to shadow host element via `themeChanged` event

### Root Files
- **`manifest.json`**: Chrome extension manifest with permissions, content scripts, and service worker configuration
- **`popup.html`**: Extension popup UI for model selection and status checking
- **`ui/pages/popup/popup.css`**: Styling for the popup UI using Material Design 3
- **`ui/pages/popup/popup.js`**: JavaScript for popup functionality, model switching, and AI model status management

### AI Model System

#### Model Selection
Users can choose between two AI model providers via the popup and options interfaces:
- **Gemini Nano** (`nano`): Free, private, on-device processing. Requires Chrome 138+ with AI features enabled.
- **API Models** (`api`): Cloud-based processing with automatic fallback. Requires Google AI Studio API key.

#### Model Routing
The background service (`scripts/background.js`) routes analysis requests to the appropriate model based on `config.analysis.modelProvider`:
- **Gemini Nano path** (`nano`): Uses Chrome AI APIs (translation → compression → analysis with Language Model API)
- **API Models path** (`api`): Intelligent model selection with automatic fallback:
  1. `ModelRouter` checks `preferredModels` array (default: Pro → Flash → Flash Lite)
  2. Queries `RateLimitCache` to find first available model
  3. Creates `GeminiAPI` instance with selected model
  4. On 429 error, records rate limit and retries with next available model
  5. Full article content processing (no translation/compression needed due to larger context window)

#### Rate Limit Management
- **Reactive System**: Rate limits tracked based on API 429 responses (not local counters)
- **RateLimitCache** (`utils/rateLimitCache.js`):
  - Extracts `retryDelay` from API error response
  - Stores block in `chrome.storage.local` with expiration time
  - Provides `isModelAvailable()` check before each request
- **Automatic Fallback**: When a model hits rate limit, automatically uses next preferred model
- **User Notification**: Toast shows which models are rate limited and which fallback is being used

#### API Key Management
- Stored securely in `chrome.storage.sync` (encrypted by Chrome)
- Managed by `config/apiKeyManager.js`
- Validated against Google AI Studio API before saving
- User can add/remove API key via popup and options interfaces
- Single API key shared across all API models (Pro, Flash, Flash Lite)

### AI Pipeline
1. **Article Detection**: Content script identifies news articles using scoring algorithms
2. **Content Extraction**: Extracts clean content using Readability.js and Chrome tabs
3. **Perspective Search**: Finds related articles globally using Google News RSS feeds
4. **Content Processing**: Extracts content from perspective articles
5. **Comparative Analysis**: Routes to selected AI provider with automatic fallback:
   - **Nano**: Translation → Compression → Analysis
   - **API**: Model selection → Rate limit check → Analysis (with fallback on 429 errors)
6. **Result Presentation**: Displays structured analysis in user-friendly format

### Progressive Analysis
The analysis pipeline is divided into 4 stages for optimal user experience:
- **Stage 1** (2-3s): Context & Trust - Story summary and initial guidance
- **Stage 2** (3-4s): Consensus - Facts agreed upon by multiple sources
- **Stage 3** (3-5s): Factual Disputes - Direct contradictions between sources
- **Stage 4** (3-5s): Perspective Differences - How sources frame events differently

## Design System Requirements

### Material Design 3 Implementation

**CRITICAL REQUIREMENT**: All CSS variables and design tokens must be defined in `ui/design-system.css`. This file is the single source of truth for all design elements in the project.

All UI components, popup interfaces, options pages, and toast notifications must use the variables defined in `ui/design-system.css` following Material Design 3 principles. All styling must be consistent with Chrome's Material Design 3 implementation.

### Chrome Material 3 Expressive Guidelines

Follow the Chrome Material 3 Expressive variant as specified in `DOCS/material-3/MATERIAL-3-REFERENCE.md`:

#### Progress Indicators
- Use segmented progress indicators with rounded corners
- Follow Chrome's expressive motion patterns

#### Button Styles
- All buttons should have rounded containers (20px radius for filled buttons)
- Use the Chrome-specific color palette from design-system.css
- Implement proper hover, focus, and active states

#### Tabs
- Use rounded button containers for tabs
- Apply consistent colors across the entire card

#### Color System
Use the Material Design 3 color system from `ui/design-system.css`:
- Primary colors with proper accessibility contrast ratios
- Secondary and tertiary color schemes
- Surface and background colors with proper elevation
- Proper dark mode support with automatic system preference detection

#### Typography
- Use Roboto font family with Chrome's specific weights
- Follow Material 3 type scale (display, headline, title, body, label)
- Maintain proper line heights and spacing

#### Elevation and Shadows
- Use Chrome-specific elevation levels from the design system
- Implement proper shadow tokens for different surfaces

#### Corner Radius (Shape System)
- Apply consistent border radius tokens to all components
- Use appropriate radius values for different component types

### Mode Management
- Automatically detect system preference for dark/light mode
- Provide smooth transitions between themes
- Store user preference while respecting system settings

## Configuration Management Requirements

**CRITICAL REQUIREMENT**: All APIs and backend functionality must utilize configurations defined by the user through `config/configManager.js`.

### Configuration System Architecture
The configuration system consists of:

1. **`config/pipeline.js`**: Contains the default `PIPELINE_CONFIG` object which serves as the single source of truth for all configuration values
2. **`config/configManager.js`**: Handles loading, saving, and merging of user configurations with defaults
3. **User-defined settings**: Stored in Chrome's `storage.sync` area using the key 'perspectiveLens_config'

### Configuration Management Rules
1. **Default Values**: All default configuration values are defined in `config/pipeline.js` in the `PIPELINE_CONFIG` object
2. **User Preferences**: Users can override any default value through the options page, with values stored in chrome.storage.sync
3. **Merging Logic**: The ConfigManager uses deep merge functionality to combine user preferences with defaults
   - **Partial Updates**: The `save()` method accepts partial config objects and merges them with existing saved config
   - **Validation on Merged Config**: Validation runs on the final merged configuration, not just the update
4. **Storage Optimization**: Large static reference data (like `availableCountries`) is excluded from storage to stay within Chrome's 8,192 byte quota per item
   - Static data is always loaded from `PIPELINE_CONFIG` defaults on every `load()` call
   - Only user preferences are persisted to storage
5. **Validation**: All configuration changes must be validated before saving
6. **Broadcasting**: Configuration changes are automatically broadcast to all extension contexts (content scripts, service worker, popup)

### Configuration Sections
The system provides configuration for:
- **Model Selection**: `analysis.modelProvider` - Choose between `'nano'` or `'api'`
- **Preferred Models**: `analysis.preferredModels` - Array defining fallback order for API models (default: `['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']`)
- **Model Configs**: `analysis.models` - Per-model configuration object:
  - `gemini-nano`: temperature, topK
  - `gemini-2.5-pro`: temperature, topK, topP, thinkingBudget, includeThoughts
  - `gemini-2.5-flash`: temperature, topK, topP, thinkingBudget (0), includeThoughts
  - `gemini-2.5-flash-lite`: temperature, topK, topP, thinkingBudget (0), includeThoughts
- **Article Selection**: Number of articles to analyze per country, buffer settings, maximum analysis limits
- **Search Settings**: Google News RSS configuration, timeout settings, retry attempts
- **Content Extraction**: Quality thresholds, timeout values, parallel processing settings
- **AI Analysis**: Compression levels for Nano, thinking budget for Pro

### API Integration
All backend APIs and services must use the configuration system through:
- `ConfigManager.load()` to get current configuration
- `ConfigManager.get(path)` to get specific configuration values
- `ConfigManager.set(path, value)` to update specific configuration values
- Listening for 'CONFIG_UPDATED' messages to respond to configuration changes

## UI Component Styling Requirements

### Popup Interface
The extension popup (`popup.html`) provides model selection and status monitoring:

**Layout Structure**:
- Header with title and settings button
- Model selector tabs (Gemini Nano / Gemini 2.5 Pro)
- Status cards showing current model state
- Footer with GitHub link

**Design Principles**:
- Cards are fixed width (340px) and centered horizontally and vertically
- Tab-based model switching with "Local" and "API" badges
- Status indicators use Material Design 3 icons (check, warning, error)
- Clean, minimal layout with consistent spacing
- Remove API key button appears inline with status when connected

**Status States**:
- **Gemini Nano**: Ready, Download Required, Downloading, Unavailable
- **API Models**: Connected, Not Configured, Invalid API Key

**Implementation Details**:
- Managed by `PopupManager` class in `ui/pages/popup/popup.js`
- Uses `ConfigManager` for model selection persistence
- Uses `APIKeyManager` for secure API key storage
- All elements use `box-sizing: border-box` for consistent sizing
- Vertical centering via `.content { justify-content: center }`
- Horizontal centering via `.section { max-width: 340px; align-items: center }`

### Shadow DOM Integration
**CRITICAL**: All UI components in content scripts (toast, panel) are rendered inside Shadow DOM for style isolation.

**How to Access Shadow DOM in Components**:
```javascript
// Get shadow container reference
const shadowContainer = window.__PL_SHADOW_CONTAINER__;

// Inject component into shadow container
shadowContainer.appendChild(this.element);

// Query elements within shadow DOM
const element = shadowContainer.querySelector('#my-element');
```

**Important Rules**:
1. **NEVER** inject UI elements into `document.body` - always use `window.__PL_SHADOW_CONTAINER__`
2. **NEVER** query the Light DOM for extension UI elements - query within the shadow container
3. Wait for shadow container to be ready using `window.__PL_SHADOW_CONTAINER__` check
4. All CSS for content script UI must be loaded into the Shadow Root (handled automatically by `createShadowDOM()`)

### CSS Variable Usage
- All color values must use CSS variables defined in `ui/design-system.css`
- All spacing values must use the spacing system variables (e.g., `var(--spacing-4)`)
- All typography values must use font variables from the design system
- All animations and transitions must use standard easing and duration variables
- All corner radius values must use the shape system variables
- All shadow values must use elevation variables from the design system

**Shadow DOM CSS Specifics**:
- CSS variables are automatically converted from `:root` to `:host` during injection
- Theme selectors are converted from `[data-theme='dark']` to `:host([data-theme='dark'])`
- All CSS files in `createShadowDOM()` are fetched and injected as inline `<style>` elements

### Component-Specific Requirements
- **Popup Interface**: Must use Material Design 3 components with proper Chrome styling
- **Options Page**: Must follow Material Design 3 layout patterns with proper navigation
- **Toast Notifications**: Must use Chrome-style notifications with proper Material Design 3 styling, rendered in Shadow DOM
- **Analysis Panel**: Must follow Chrome's Material 3 Expressive patterns for content display, rendered in Shadow DOM
- **Progress Indicators**: Must use segmented progress indicators as per Chrome Material 3
- **Buttons and Controls**: Must use Material Design 3 button styles with proper states

### Dark/Light Theme Support
- All components must automatically adapt to system theme preferences
- Theme is managed by `ThemeManager` singleton in `ui/theme-manager.js`
- Theme is applied to both `document.documentElement` and `#perspective-lens-root` (shadow host)
- Shadow DOM automatically receives theme updates via `themeChanged` event listener
- CSS uses `:host([data-theme='dark'])` selector for dark mode styles (auto-converted from `[data-theme='dark']`)
- Ensure proper contrast ratios in both themes (WCAG AA minimum)

## Logging System Architecture

**CRITICAL REQUIREMENT**: All logging must follow the structured logging system defined in `utils/logger.js`. The system provides dual-context logging (USER vs SYSTEM) with tab-targeted message delivery.

### Logging Contexts

The logger supports three contexts:
1. **SYSTEM**: Technical logs for debugging (console only, never sent to UI)
2. **USER**: User-facing messages (sent to UI via toast notifications)
3. **BOTH**: Important messages for both audiences

### Core Logging Functions

**For System/Debug Logging** (console only):
```javascript
logger.system.trace('Detailed trace info', { category: logger.CATEGORIES.GENERAL });
logger.system.debug('Debug details', { category: logger.CATEGORIES.SEARCH });
logger.system.info('System info', { category: logger.CATEGORIES.ANALYZE });
logger.system.warn('Warning message', { category: logger.CATEGORIES.ERROR });
logger.system.error('Error occurred', { category: logger.CATEGORIES.ERROR, error });
```

**For User-Facing Progress Updates** (console + toast UI):
```javascript
// Primary method for UI updates
logger.logUserProgress(
  'search',        // phase: detection, translation, search, extraction, compression, analysis, complete
  45,              // progress: 0-100
  'Searching articles from 8 countries...',  // user-friendly message
  {
    icon: 'SEARCH',           // Optional: 'AI', 'SEARCH', 'EXTRACT', 'TRANSLATE', 'SUCCESS'
    countries: ['US', 'BR'],  // Optional: country codes for flags
    articlesCount: 15         // Optional: metadata
  }
);

// For AI operations with special indicator
logger.logUserAI('translation', {
  phase: 'translation',
  progress: 20,
  message: 'Translating title to English...',
  metadata: { from: 'pt', to: 'en' }
});
```

**For Critical Messages** (both console and UI):
```javascript
logger.both.info('Analysis completed successfully');
logger.both.warn('Some articles could not be loaded');
logger.both.error('Analysis failed', { error });
```

### Request Tracking and Tab Context

**CRITICAL**: Always set tab context at the start of operations:

```javascript
// At start of analysis (in background.js)
const tabId = sender.tab?.id || null;
const requestId = logger.startRequest('article_analysis', tabId);

// Logger now sends all USER_PROGRESS messages to this specific tab
logger.logUserProgress('search', 30, 'Searching...');

// At end of analysis
const duration = logger.endRequest(requestId);
logger.clearRequest();  // Clears both requestId and tabId
```

### Message Flow Architecture

```
Background Service Worker
    ↓
logger.startRequest('operation', tabId) ← Sets tab context
    ↓
logger.logUserProgress(phase, progress, message)
    ↓
sendMessageToTab(tabId, {type: 'USER_PROGRESS', payload})
    ↓ (with retry logic: 50ms, 100ms exponential backoff)
chrome.tabs.sendMessage(specificTabId, message)
    ↓
Content Script: handleUserProgress(payload)
    ↓
singleToast.updateProgress() / updateMessage() / addFlag()
```

### Important Rules

1. **NEVER use `logger.user.info()` for progress updates** - This logs to console but doesn't update the toast. Use `logger.logUserProgress()` instead.

2. **NEVER broadcast to all tabs** - Always use tab-specific messaging through the logger context.

3. **System logs stay in console** - Only USER and BOTH contexts should be user-visible.

4. **Deprecated functions**:
   - ~~`broadcastToUI()`~~ - Does nothing, kept for compatibility only
   - ~~`LOG_EVENT` message type~~ - Removed from pipeline
   - ~~`PROGRESS_UPDATE` message type~~ - Consolidated into USER_PROGRESS

5. **Message types in use**:
   - `USER_PROGRESS` - Progress updates and user-facing logs
   - `SHOW_ANALYSIS` - Complete analysis results
   - `ANALYSIS_STAGE_COMPLETE` - Progressive analysis updates
   - `ANALYSIS_FAILED` - Error notifications

### Log Categories

Use appropriate categories for filtering and debugging:
```javascript
logger.CATEGORIES.GENERAL    // General operations
logger.CATEGORIES.EXTRACT    // Content extraction
logger.CATEGORIES.SEARCH     // Article search
logger.CATEGORIES.FETCH      // Content fetching
logger.CATEGORIES.ANALYZE    // AI analysis
logger.CATEGORIES.TRANSLATE  // Translation operations
logger.CATEGORIES.COMPRESS   // Content compression
logger.CATEGORIES.VALIDATE   // Validation operations
logger.CATEGORIES.ERROR      // Error handling
```

### Common Pitfalls to Avoid

❌ **Wrong**: Broadcasting without tab context
```javascript
logger.logUserProgress('search', 50, 'Searching...');  // No tab set!
```

✅ **Correct**: Set tab context first
```javascript
logger.startRequest('analysis', tabId);
logger.logUserProgress('search', 50, 'Searching...');
```

❌ **Wrong**: Using user.info() for UI updates
```javascript
logger.user.info('Analyzing articles...', { progress: 75 });  // Won't update toast!
```

✅ **Correct**: Use logUserProgress for toast updates
```javascript
logger.logUserProgress('analysis', 75, 'Analyzing articles...');
```

❌ **Wrong**: Trying to send messages manually
```javascript
chrome.tabs.sendMessage(tabId, {type: 'USER_PROGRESS', ...});  // No retry logic!
```

✅ **Correct**: Let logger handle message delivery
```javascript
logger.logUserProgress('search', 30, 'Message');  // Has retry + error handling
```

### Error Handling

The logger automatically handles:
- Retry logic with exponential backoff (2 retries: 50ms, 100ms)
- Detailed error logging when messages fail
- Tab availability checking
- Connection failures

Failed message deliveries are logged to console with full context:
```
[Logger] Failed to send message after retries: {
  tabId: 123456,
  messageType: 'USER_PROGRESS',
  error: 'Could not establish connection...',
  attempts: 3
}
```

### Reference Documentation

For complete details on the logging system refactoring, see:
- `DOCS/LOGGING-SYSTEM-REFACTOR.md` - Full refactoring documentation
- `utils/logger.js` - Logger implementation

## Chrome Extension Specific Requirements

### Manifest Configuration
- All UI resources must be listed in `web_accessible_resources` in manifest.json
- Content scripts must include the design system CSS
- Proper permissions must be requested for all functionality

### Storage Integration
- Use Chrome's storage.sync API for user preferences
- ConfigManager must handle all storage operations
- Implement proper error handling for storage operations

### Messaging System
- Use Chrome's messaging APIs for communication between contexts
- **CRITICAL**: Use the structured logger for all UI updates (see Logging System Architecture)
- Implement proper error handling for cross-context communication
- Ensure configuration changes are properly broadcast to all contexts
- Always set tab context before sending user-facing messages

### Performance Considerations
- Minimize DOM manipulation in content scripts
- Use efficient algorithms for article detection and processing
- Implement proper caching for configuration values
- Follow Chrome extension performance best practices
- Use logger's retry logic instead of implementing custom retry mechanisms

### AI Model Integration
When integrating new AI models or modifying existing ones:

**Gemini Nano (Chrome AI)**:
- Located in `api/` folder with individual API wrappers
- Requires translation and compression due to context window limits
- Availability states: 'readily', 'ready', 'available', 'after-download', 'downloading', 'no', 'unavailable'
- Free and private, runs on-device
- Config key: `models['gemini-nano']`

**API Models (REST API)**:
- Implemented in `api/geminiAPI.js` (unified client)
- Supports three models:
  - `gemini-2.5-pro`: 2M token context, dynamic thinking, 5 RPM / 100 RPD
  - `gemini-2.5-flash`: 2M token context, no thinking, 10 RPM / 250 RPD
  - `gemini-2.5-flash-lite`: 2M token context, no thinking, 15 RPM / 1000 RPD
- Direct full-text processing (no translation/compression needed)
- Progressive analysis with `onStageComplete` callback support
- JSON schema validation for structured output
- Requires API key stored via `APIKeyManager`
- Config keys: `models['gemini-2.5-pro']`, `models['gemini-2.5-flash']`, `models['gemini-2.5-flash-lite']`

**Model Routing**:
- Background service checks `config.analysis.modelProvider` (`'nano'` or `'api'`)
- For `'api'`, `ModelRouter` selects best available model from `preferredModels` array
- Rate limit handling via `RateLimitCache` with automatic fallback
- Each model implements consistent interface for `compareArticlesProgressive()`

**Rate Limit Flow**:
1. Request starts → `ModelRouter.selectBestAvailableModel()`
2. Check each model in `preferredModels` order via `RateLimitCache.isModelAvailable()`
3. Use first available model
4. On 429 error → `ModelRouter.handleRateLimitError()` records block
5. Retry with next available model via `ModelRouter.getNextAvailableModel()`

## Development Workflow

### New Component Development

**For Content Script UI Components** (Toast, Panel, etc.):
1. Always start by referencing `ui/design-system.css` for available variables
2. Use Material Design 3 patterns from `DOCS/material-3/MATERIAL-3-REFERENCE.md`
3. **CRITICAL**: Inject elements into `window.__PL_SHADOW_CONTAINER__`, NEVER into `document.body`
4. Wait for Shadow DOM to be ready before creating UI:
   ```javascript
   async waitForShadowRoot() {
     let retries = 0;
     while (retries < 30) {
       if (window.__PL_SHADOW_CONTAINER__) {
         return true;
       }
       await new Promise(resolve => setTimeout(resolve, 100));
       retries++;
     }
     return false;
   }
   ```
5. Query elements within shadow container, not Light DOM:
   ```javascript
   const element = window.__PL_SHADOW_CONTAINER__.querySelector('#my-element');
   ```
6. Access configuration values through `config/configManager.js`
7. Test in both light and dark modes
8. Validate accessibility compliance

**For Popup/Options Pages** (outside Shadow DOM):
1. Use standard DOM methods (`document.body`, `document.querySelector`)
2. Follow same design system and Material Design 3 patterns
3. Theme is applied to `document.documentElement`

### UI Updates
1. Update `ui/design-system.css` first when changing design tokens
2. Verify all components continue to work with new tokens
3. Test theme switching functionality
4. Ensure proper contrast ratios are maintained

### Configuration Changes
1. Update `config/pipeline.js` for new default values
2. Update `config/configManager.js` for new validation logic if needed
3. Update options page to expose new settings to users
4. Test configuration saving, loading, and broadcasting

### Logging in New Features
1. **Start of operation**: Call `logger.startRequest(operationName, tabId)` to set context
2. **System debugging**: Use `logger.system.debug()` or `logger.system.info()` for technical logs
3. **User progress updates**: Use `logger.logUserProgress(phase, progress, message, metadata)` for toast notifications
4. **AI operations**: Use `logger.logUserAI(operation, details)` for AI-specific progress
5. **Errors**: Use `logger.system.error()` for technical errors, `logger.user.error()` for user-facing errors
6. **End of operation**: Call `logger.endRequest(requestId)` and `logger.clearRequest()` to clean up

## Quality Assurance

### Design System Compliance
- All color values must come from the design system
- All spacing must use the 4px base unit system
- All typography must follow Material Design 3 scales
- All components must work in both light and dark modes

### Configuration Validation
- All user input must be validated before saving
- Configuration changes must be properly broadcast
- Default values must be maintained when not overridden
- Error handling must be implemented for all configuration operations

### Shadow DOM Compliance
**CRITICAL REQUIREMENTS**:
- All content script UI components must render inside `window.__PL_SHADOW_CONTAINER__`
- NEVER inject extension UI into `document.body` or Light DOM
- NEVER query Light DOM for extension UI elements
- Wait for `window.__PL_SHADOW_CONTAINER__` to exist before creating UI
- All CSS for Shadow DOM components is automatically injected by `createShadowDOM()`
- CSS variables use `:host` (auto-converted from `:root`)
- Theme selectors use `:host([data-theme='dark'])` (auto-converted from `[data-theme='dark']`)

### Logging Standards
- Always set tab context with `logger.startRequest(operation, tabId)` before logging
- Use `logger.logUserProgress()` for all user-facing toast notifications
- Use `logger.system.*` for technical debugging (stays in console)
- Never manually send messages to tabs - let the logger handle delivery
- Check console for failed message delivery warnings during development
- Use appropriate log categories for filtering and debugging

### Chrome Extension Standards
- Follow Chrome extension best practices
- Implement proper error handling
- Ensure efficient resource usage
- Maintain security best practices