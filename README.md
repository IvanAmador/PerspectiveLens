# 🌍 PerspectiveLens

**Chrome Extension that reveals how the same news is reported globally, using Chrome Built-in AI for translation, summarization, and comparative analysis.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue)](https://chrome.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0-green)](https://github.com/yourusername/PerspectiveLens)

> **Hackathon Project:** Chrome Built-in AI Challenge 2025 - Best Hybrid AI Application Category  
> **Status:** ✅ Feature Complete - Production Ready  
> **Chrome Version:** 138+ (Dev/Canary) with AI flags enabled

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Requirements](#requirements)
- [Project Structure](#project-structure)
- [Development](#development)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

PerspectiveLens helps readers understand how the same news story is reported across different countries and media outlets. By automatically detecting news articles, searching for international perspectives, and using Chrome's built-in AI to translate and analyze differences, it reveals media bias and omissions.

### The Problem

- Readers consume news from a single source without realizing regional bias
- Language barriers prevent access to international perspectives
- Lack of non-Western perspectives creates information blind spots
- Existing solutions (Ground News, AllSides) cost $10-15/month and require cloud processing

### The Solution

PerspectiveLens uses a **hybrid online/offline model**:
- **Online:** NewsAPI for finding international perspectives (requires internet)
- **Offline:** Chrome Built-in AI for translation, summarization, and analysis
- **Privacy-first:** Your reading history stays on your device

---

## ✨ Features

### Implemented (v1.0)

- ✅ **Automatic News Detection** - Detects news articles on 25+ major news sites
- ✅ **AI-Powered Keyword Extraction** - Extracts 3-5 key topics using Gemini Nano
- ✅ **Perspective Discovery** - Search Google News RSS for international coverage
- ✅ **Content Extraction** - Extracts article content using Chrome Tabs + Readability.js
- ✅ **Translation Pipeline** - Translate articles using Chrome Translator API
- ✅ **Language Detection** - Automatic language detection using Chrome Language Detector API
- ✅ **Summarization** - Condense articles using Chrome Summarizer API
- ✅ **Comparative Analysis** - Identify consensus, disputes, and omissions with structured output
- ✅ **Content Validation** - Filters invalid/JS content before analysis
- ✅ **Modular Architecture** - Clean separation of concerns (utils, api, ui)
- ✅ **External Prompt Management** - All AI prompts stored in `/prompts` folder
- ✅ **Comprehensive Error Handling** - Custom error classes and logging
- ✅ **Extension Status Dashboard** - Real-time AI model status, cache info
- ✅ **Analysis Panel UI** - Side panel showing comparative analysis results
- ✅ **Design System** - Unified CSS variables and components for consistent styling
- ✅ **Toast Notifications** - Non-intrusive status updates and user feedback
- ✅ **Progress Tracking** - Real-time progress indicators during analysis
- ✅ **SVG Icon Library** - Consistent icons across the extension interface
- ✅ **Responsive UI** - Adapts to different screen sizes and devices

### Planned (v2.0)

- 📅 Detection popup with user confirmation
- 📅 Progress indicator during analysis
- 📅 Cache system (IndexedDB) for offline access to past analyses
- 📅 Source selection (international vs national)
- 📅 Settings page (preferences, countries, etc)
- 📅 Full offline mode for cached articles
- 📅 Export analysis results (PDF/JSON)

---

## 🚀 Installation

> **📘 Quick Setup Guide:** For detailed step-by-step instructions, see [SETUP-GUIDE.md](SETUP-GUIDE.md)

### For Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/PerspectiveLens.git
   cd PerspectiveLens
   ```

2. **Install Chrome 138+ with AI features enabled**
   - Use Chrome Dev/Canary (version 138+)
   - **Enable these flags** (copy and paste URLs):
     ```
     chrome://flags/#prompt-api-for-gemini-nano
     chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
     chrome://flags/#summarization-api-for-gemini-nano
     chrome://flags/#translation-api
     chrome://flags/#language-detection-api
     chrome://flags/#optimization-guide-on-device-model
     ```
   - **Set configurations:**
     - `#prompt-api-for-gemini-nano` → **"Enabled (multilingual)"**
     - `#prompt-api-for-gemini-nano-multimodal-input` → **"Enabled"**
     - `#summarization-api-for-gemini-nano` → **"Enabled"**
     - `#translation-api` → **"Enabled"**
     - `#language-detection-api` → **"Enabled"**
     - `#optimization-guide-on-device-model` → **"Enabled BypassPerfRequirement"**
   - **Restart Chrome** after enabling flags

3. **Create icons** (temporary step)
   ```bash
   # Follow instructions in images/README.md
   # Or use placeholder icons from the web
   ```

4. **Load unpacked extension**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `PerspectiveLens` folder

5. **Configure NewsAPI key** (optional for now)
   - Get free key at [newsapi.org](https://newsapi.org)
   - Copy `.env.example` to `.env`
   - Add your API key

---

## ⚙️ Requirements

### User Requirements

- **Browser:** Chrome 138+ (Windows, macOS, Linux)
- **Storage:** 22 GB free space (for AI models)
- **Memory:** 16 GB RAM (or GPU with 4+ GB VRAM)
- **Network:** Unmetered connection (for model download)

### Developer Requirements

- **Node.js** 18+ (optional, for tooling)
- **Chrome Dev/Canary** 138+
- **NewsAPI Key** (free tier: 100 requests/day)

---

## 📁 Project Structure

```
PerspectiveLens/
├── api/                      # AI API wrappers
│   ├── languageModel.js      # Prompt API (Gemini Nano)
│   ├── newsFetcher.js        # Google News RSS integration
│   ├── contentExtractor.js   # Content extraction utilities
│   ├── contentExtractorTabs.js # Chrome Tabs-based extraction
│   ├── summarizer.js         # Summarizer API wrapper
│   ├── translator.js         # Translator API wrapper
│   └── languageDetector.js   # Language Detection API
├── utils/                    # Shared utilities
│   ├── logger.js             # Centralized logging
│   ├── errors.js             # Custom error classes
│   ├── prompts.js            # Prompt template loader
│   ├── languages.js          # Language code normalization
│   └── contentValidator.js   # Content quality validation
├── ui/                       # User interface components
│   ├── analysis-panel.js     # Side panel for analysis results
│   ├── analysis-panel.css    # Analysis panel styles
│   ├── design-system.css     # Unified design tokens and CSS variables
│   ├── toast-notification.js # Toast notification system
│   ├── toast-notification.css # Toast notification styles
│   ├── progress-tracker.js   # Progress tracking component
│   ├── progress-tracker.css  # Progress tracker styles
│   └── icons.js              # SVG icon library
├── scripts/                  # Content scripts
│   ├── content.js            # Article detection and data extraction
│   └── panel-injector.js     # Analysis panel injection
├── prompts/                  # AI prompt templates
│   ├── keyword-extraction.txt
│   ├── comparative-analysis-v3-simple.txt
│   ├── comparative-analysis-schema.json
│   └── README.md
├── offscreen/                # Offscreen document utilities
│   ├── offscreen.html
│   ├── offscreen.js
│   └── readability.js        # Mozilla Readability.js
├── images/                   # Extension icons (16, 32, 48, 128px)
├── background.js             # Service worker (main logic)
├── popup.html                # Extension popup UI
├── popup.js                  # Popup controller
├── popup.css                 # Popup styles
├── manifest.json             # Extension manifest
├── .env.example              # Environment template
├── GUIA-MVP.md              # Product Requirements (PT-BR)
├── SETUP-GUIDE.md           # Installation and setup guide
└── README.md                # This file
```

### Key Design Decisions

- **ES6 Modules:** All files use `import/export` for better code organization
- **External Prompts:** AI prompts in `/prompts` folder for easy iteration
- **Unified Design System:** CSS variables and components for consistent UI (`ui/design-system.css`)
- **Modular Architecture:** Clear separation of concerns:
  - `api/` - Chrome AI API wrappers and external integrations
  - `utils/` - Reusable utilities and helpers
  - `ui/` - User interface components and styling
  - `scripts/` - Content scripts for DOM interaction
  - Root - Service worker and popup logic
- **Component-Based UI:** Reusable components (toast notifications, progress tracker, icons)
- **Real-time Updates:** Progress broadcasting and user feedback during analysis
- **Privacy-First:** All AI processing happens locally on-device

---

## 🛠️ Development

### Running Locally

1. Make code changes
2. Reload extension at `chrome://extensions`
3. Test on supported news sites (BBC, NYT, etc.)
4. Check logs:
   - Popup: Right-click → Inspect
   - Background: Click "service worker" link
   - Content: Inspect page → Console

### Testing AI Features

```javascript
// In DevTools console (popup or background)
import { extractKeywords } from './api/languageModel.js';

const keywords = await extractKeywords(
  "Brazil approves new climate law",
  "en"
);
console.log(keywords);
```

### Modifying Prompts

1. Edit files in `/prompts` folder
2. Use `{{variable}}` syntax for substitution
3. Reload extension to apply changes
4. Test with different article types

### Adding New Features

1. Create feature branch: `git checkout -b feature/my-feature`
2. Add code in appropriate module folder
3. Update `README.md` and `GUIA-MVP.md`
4. Test thoroughly
5. Submit PR with description

---

## 🏗️ Architecture

### Data Flow

```
User visits news site
    ↓
Content Script detects article (F-001)
    ↓
Extract article data → Send to Background
    ↓
Background Service Worker
    ├─→ Extract keywords (F-002) ✅ DONE
    ├─→ Fetch perspectives via Google News RSS (F-003) ✅ DONE
    ├─→ Extract article content with Chrome Tabs (F-004) ✅ DONE
    ├─→ Detect & translate articles (F-004) ✅ DONE
    ├─→ Validate & compress articles (F-005) ✅ DONE
    ├─→ Compare perspectives with AI (F-006) ✅ DONE
    └─→ Cache results (F-007) 📅 TODO
    ↓
Display in UI panel ✅ DONE
```

### Chrome Built-in AI APIs Used

| API | Status | Usage |
|-----|--------|-------|
| **Prompt API (Gemini Nano)** | ✅ Implemented | Keyword extraction, comparative analysis with JSON Schema |
| **Language Detector API** | ✅ Implemented | Automatic detection of article language |
| **Translator API** | ✅ Implemented | Translate articles to English for analysis |
| **Summarizer API** | ✅ Implemented | Compress articles to fit context window (70-80% reduction) |

### Hybrid Model

- **Requires Internet:** NewsAPI calls, first-time analysis
- **Works Offline:** Translation, summarization, analysis, cached articles

---

## 🗺️ Roadmap

### Phase 1: Foundation ✅ (Completed)
- [x] Project setup and manifest
- [x] News detection (25+ sites)
- [x] Modular architecture
- [x] Keyword extraction with Prompt API
- [x] Error handling and logging
- [x] External prompt system

### Phase 2: AI Pipeline ✅ (Completed)
- [x] Google News RSS integration (10 countries)
- [x] Content extraction with Chrome Tabs
- [x] Translation pipeline (Translator API)
- [x] Language detection (Language Detector API)
- [x] Summarization (Summarizer API)
- [x] Content validation and compression
- [x] Comparative analysis with JSON Schema
- [x] Analysis panel UI

### Phase 3: UX Improvements ✅ (Completed)
- [x] Detection popup with user confirmation
- [x] Progress indicator during analysis (toast notifications + progress tracker)
- [x] Real-time progress broadcasting from background to content scripts
- [x] Loading states and animations (spinners, skeletons, transitions)
- [ ] Source selection (international vs national)
- [ ] Settings page
- [ ] Error messages for users

### Phase 4: Performance & Cache 📅 (Next)
- [ ] IndexedDB cache system
- [ ] Optimize article processing (stop early)
- [ ] Parallel processing improvements
- [ ] Full offline mode for cached articles

### Phase 5: Launch 📅
- [ ] Demo video
- [ ] Documentation and screenshots
- [ ] Chrome Web Store submission
- [ ] Hackathon submission

---

## 🔧 Troubleshooting

### AI Models Not Available

**Problem:** Popup shows "❌ Unavailable" or "❌ API Missing"

**Solutions:**
1. **Check Chrome version:**
   - Must be Chrome 138+ (Dev or Canary)
   - Check: `chrome://version`

2. **Verify flags are enabled:**
   - Visit each flag URL listed in Installation
   - Ensure all are set to "Enabled" (not "Default")
   - For `#prompt-api-for-gemini-nano` → select **"Enabled (multilingual)"**
   - For `#optimization-guide-on-device-model` → select **"Enabled BypassPerfRequirement"**

3. **Restart Chrome completely:**
   - Close ALL Chrome windows
   - Reopen and reload extension

4. **Check system requirements:**
   - **Storage:** 22 GB free space
   - **RAM:** 16 GB (or GPU with 4+ GB VRAM)
   - **Network:** Unmetered connection for initial download

### Model Download Stuck

**Problem:** Download progress stays at 0% or doesn't complete

**Solutions:**
1. Check internet connection (model is ~22 GB)
2. Ensure enough disk space (check downloads folder)
3. Try clearing browser data: `chrome://settings/clearBrowserData`
4. Restart download by reopening popup

### Extension Not Detecting Articles

**Problem:** Content script doesn't run on news sites

**Solutions:**
1. Check if site is in whitelist ([manifest.json:24-49](manifest.json#L24-L49))
2. Reload the page after installing extension
3. Check console for errors: Right-click → Inspect → Console
4. Ensure content script permissions granted

### Keywords Not Extracting

**Problem:** Background script fails to extract keywords

**Solutions:**
1. Check AI models are downloaded (popup status)
2. Open background service worker console:
   - `chrome://extensions` → "service worker" link
   - Check for errors
3. Test manually in console:
   ```javascript
   import { extractKeywords } from './api/languageModel.js';
   await extractKeywords('Test headline', 'en');
   ```

### Prompts Not Loading

**Problem:** Error: "Failed to load prompt: keyword-extraction"

**Solutions:**
1. Check `web_accessible_resources` in [manifest.json:16-20](manifest.json#L16-L20)
2. Verify prompt files exist in `/prompts` folder
3. Reload extension completely

### UI Components Not Working

**Problem:** Progress indicators or toast notifications not showing

**Solutions:**
1. **Check content script loading:**
   - Open DevTools on news site
   - Look for "PerspectiveLens" in Console tab
   - Verify `ui/design-system.css` and component CSS files load

2. **Verify design system styles:**
   ```javascript
   // In content script console
   console.log(getComputedStyle(document.documentElement).getPropertyValue('--color-primary'));
   // Should show value from design-system.css
   ```

3. **Check component initialization:**
   ```javascript
   // Test toast notifications
   if (typeof window.showToast === 'function') {
     window.showToast('Test notification', 'info');
   }
   ```

4. **Progress tracking issues:**
   - Ensure `activeAnalysisTab` is set in background.js
   - Check message passing between background and content scripts
   - Verify progress events are being broadcast

### Performance Issues

**Problem:** Analysis taking too long (>2 minutes)

**Solutions:**
1. **Reduce article processing:**
   - Current: processes up to 15 articles, analyzes only 8
   - Optimize: process fewer articles with better filtering

2. **Check network connectivity:**
   - Google News RSS can be slow in some regions
   - Monitor Chrome DevTools Network tab

3. **Background service worker restart:**
   - Service workers can be terminated after 30 seconds of inactivity
   - Extension should handle restart gracefully (currently improved)

### Common Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "LanguageModel is not defined" | Chrome version too old | Update to Chrome 138+ |
| "No output language was specified" | Missing `expectedOutputs` | Already fixed in latest version |
| "Failed to create AI session" | Models not downloaded | Wait for download or check flags |
| "Prompt loading failed" | File not accessible | Check manifest web_accessible_resources |
| "Network error" | No internet | Check connection (for NewsAPI) |
| "Progress broadcast failed" | Content script not loaded | Reload page after extension installation |
| "CSS variables not found" | Design system not loading | Check ui/design-system.css in web_accessible_resources |
| "Toast function not defined" | Component initialization failed | Verify content scripts load correctly |

---

## 🤝 Contributing

Contributions are welcome! This is a hackathon project, but we'd love to make it production-ready.

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Use ES6+ features
- Add JSDoc comments to functions
- Follow existing file structure
- Run manual tests before PR

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Chrome Built-in AI Team** for making on-device AI possible
- **NewsAPI.org** for free tier access
- **Hackathon organizers** for the challenge
- **Open source community** for inspiration

---

## 📞 Contact

- **Developer:** [Your Name]
- **Email:** your.email@example.com
- **Project Link:** https://github.com/yourusername/PerspectiveLens
- **Issues:** https://github.com/yourusername/PerspectiveLens/issues

---

## 🔗 Resources

- [Chrome Built-in AI Documentation](https://developer.chrome.com/docs/ai/built-in)
- [Prompt API Guide](https://developer.chrome.com/docs/ai/built-in-apis)
- [NewsAPI Documentation](https://newsapi.org/docs)
- [Product Requirements (PT-BR)](GUIA-MVP.md)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)

---

**Built with ❤️ for the Chrome Built-in AI Challenge 2025**
