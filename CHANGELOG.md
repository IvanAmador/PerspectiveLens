# Changelog - PerspectiveLens

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-01-09

### ✅ Fixed

- **CRITICAL:** Fixed `LanguageModel.create()` missing `expectedOutputs` parameter
  - Added support for all available languages: `['en', 'es', 'ja']`
  - Resolves error: "No output language was specified in a LanguageModel API request"
  - Location: [popup.js:30-32](popup.js#L30-L32), [api/languageModel.js:47-49](api/languageModel.js#L47-L49)

### 🆕 Added

#### Architecture Improvements

- **Modular Structure:** Created organized folder structure
  - `api/` - AI API wrappers
  - `utils/` - Shared utilities (logger, errors, prompts)
  - `prompts/` - External prompt templates
  - `scripts/` - Content scripts

- **External Prompt System:**
  - All AI prompts moved to `/prompts` folder as `.txt` files
  - Template variable substitution: `{{variable}}`
  - Prompt caching for performance
  - Easy to modify without code changes
  - Files: [utils/prompts.js](utils/prompts.js), [prompts/](prompts/)

- **Comprehensive Error Handling:**
  - Custom error classes: `AIModelError`, `APIError`, `ValidationError`
  - Centralized error handler with logging
  - User-friendly error messages
  - File: [utils/errors.js](utils/errors.js)

- **Centralized Logging:**
  - Consistent logging across all modules
  - Log levels: ERROR, WARN, INFO, DEBUG
  - Grouped logs for better debugging
  - File: [utils/logger.js](utils/logger.js)

#### New Modules

- **`api/languageModel.js`** - Prompt API wrapper
  - `checkAvailability()` - Check AI model status
  - `createSession()` - Create session with proper config
  - `extractKeywords()` - Extract 3-5 keywords from headlines (F-002 ✅)
  - `compareArticles()` - Comparative analysis (F-006 🚧)
  - `getModelParams()` - Get model parameters

- **`utils/prompts.js`** - Prompt template loader
  - `loadPrompt()` - Load prompt from file with caching
  - `processPrompt()` - Variable substitution
  - `getPrompt()` - Load and process in one call
  - `preloadPrompts()` - Preload common prompts

#### Refactored Files

- **`background.js`** - Completely rewritten
  - Now uses ES6 modules
  - Message handler for multiple message types
  - Implements F-002 (Keyword Extraction) ✅
  - Proper async error handling
  - Extension installation handler
  - Global error handlers

- **`popup.js`** - Completely rewritten
  - Uses new `api/languageModel.js` module
  - Better UI state management
  - Real-time download progress
  - Improved error handling
  - Cache management

- **`manifest.json`** - Updated
  - Added `"type": "module"` for background service worker
  - Added `web_accessible_resources` for prompt files
  - Proper ES6 module support

- **`popup.html`** - Updated
  - Added `type="module"` to script tag

#### Documentation

- **`README.md`** - Complete documentation
  - Installation instructions
  - Development guide
  - Architecture overview
  - Roadmap
  - Contributing guidelines

- **`prompts/README.md`** - Prompt documentation
  - Available prompts
  - Variable syntax
  - Usage examples

- **`images/README.md`** - Icon instructions
  - Required sizes
  - SVG template
  - Conversion tools

- **`.env.example`** - Environment template
  - NewsAPI key configuration
  - Development settings
  - Cache settings

- **`SETUP-GUIDE.md`** - Quick setup guide
  - Detailed Chrome flags configuration (multilingual, multimodal)
  - Step-by-step installation
  - Test commands and verification
  - Common troubleshooting

- **`.gitignore`** - Git ignore rules
  - Environment files
  - IDE files
  - Build artifacts

### 🔄 Changed

- **Code Organization:**
  - Split monolithic files into focused modules
  - Consistent import/export patterns
  - Clear separation of concerns

- **Error Messages:**
  - More descriptive error logs
  - User-friendly messages in UI
  - Contextual error handling

- **Performance:**
  - Prompt caching reduces file reads
  - Reusable AI sessions where appropriate
  - Proper resource cleanup (session.destroy())

### 🗑️ Removed

- Hardcoded AI prompts from code
- Unused variables and imports
- Console.log statements replaced with logger

---

## Implementation Status

### ✅ Completed (v1.0)

1. **F-001: News Article Detection** - Content script working
2. **F-002: Keyword Extraction** - Implemented with Prompt API
3. **Architecture:** Modular, clean, documented
4. **Error Handling:** Comprehensive system
5. **Logging:** Centralized logger
6. **Prompts:** External template system

### 🚧 In Progress (v1.1)

- F-003: Perspective Discovery (NewsAPI integration)
- F-004: Translation Pipeline (Translator API)
- F-005: Summarization (Summarizer API)
- F-006: Comparative Analysis (partial implementation)
- F-007: Cache Management (IndexedDB)

### 📅 Planned (v2.0)

- F-008: User Interface (floating panel)
- F-009: Extension Popup (settings page)
- Language Detection API integration
- Full offline mode

---

## Migration Guide

### For Developers

If you had the old version of the code:

1. **Update imports:**
   ```javascript
   // Old
   console.log("PerspectiveLens:", message);

   // New
   import { logger } from './utils/logger.js';
   logger.info(message);
   ```

2. **Use new AI wrapper:**
   ```javascript
   // Old
   const session = await LanguageModel.create();

   // New
   import { createSession } from './api/languageModel.js';
   const session = await createSession();
   ```

3. **External prompts:**
   ```javascript
   // Old
   const prompt = `Extract keywords from: ${title}`;

   // New
   import { getPrompt } from './utils/prompts.js';
   const prompt = await getPrompt('keyword-extraction', { title });
   ```

4. **Reload extension:**
   - Go to `chrome://extensions`
   - Click reload button
   - Check service worker console for errors

---

## Testing Checklist

- [x] Extension loads without errors
- [x] Popup opens and shows status
- [x] AI model availability check works
- [x] Keyword extraction works (test manually in console)
- [x] Prompts load from files correctly
- [x] Error handling works (test with invalid inputs)
- [x] Logger outputs to console
- [ ] Content script detects news articles (needs testing on live sites)
- [ ] Background receives messages from content script
- [ ] Cache operations work

---

## Known Issues

1. **Icons missing:** Placeholder icons needed in `/images` folder
   - Solution: Follow instructions in `images/README.md`

2. **NewsAPI not integrated yet:** F-003 not implemented
   - Will be added in next iteration

3. **No UI panel yet:** F-008 not implemented
   - Currently only shows popup status

---

## Next Steps

1. Create placeholder icons for testing
2. Implement NewsAPI integration (F-003)
3. Add Translation API wrapper
4. Add Summarizer API wrapper
5. Build floating panel UI
6. Implement IndexedDB cache
7. End-to-end testing on real news sites
8. Record demo video for hackathon

---

**Last Updated:** January 9, 2025
**Version:** 1.0.0-alpha
**Status:** Refactoring Complete ✅
