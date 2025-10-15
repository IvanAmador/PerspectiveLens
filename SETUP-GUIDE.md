# 🚀 Quick Setup Guide - PerspectiveLens

## Prerequisites

- **Chrome Dev or Canary** (version 138+)
- **22 GB free disk space** (for AI models)
- **16 GB RAM** (or GPU with 4+ GB VRAM)
- **Unmetered internet** (for initial model download)

---

## Step 1: Enable Chrome Flags ⚙️

**Copy and paste each URL into Chrome address bar:**

### Required Flags

```
chrome://flags/#prompt-api-for-gemini-nano
chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
chrome://flags/#summarization-api-for-gemini-nano
chrome://flags/#optimization-guide-on-device-model
```

### Configuration

1. **`#prompt-api-for-gemini-nano`**
   - Set to: **"Enabled (multilingual)"** ⚠️ NOT just "Enabled"!
   - This enables multilingual support (en, es, ja)

2. **`#prompt-api-for-gemini-nano-multimodal-input`**
   - Set to: **"Enabled"**
   - Enables multimodal input support

3. **`#summarization-api-for-gemini-nano`**
   - Set to: **"Enabled"**
   - Required for article summarization (v1.1)

4. **`#optimization-guide-on-device-model`**
   - Set to: **"Enabled BypassPerfRequirement"**
   - Bypasses performance requirements for testing

### Optional Flags (for future features)

```
chrome://flags/#translation-api
chrome://flags/#language-detection-api
```

- Set both to: **"Enabled"** (if available in your Chrome version)

### ⚠️ IMPORTANT
**Restart Chrome completely** after enabling flags!
- Close ALL Chrome windows
- Reopen Chrome

---

## Step 2: Verify AI Model Status 🤖

1. Open Chrome DevTools Console:
   - Press `F12` or Right-click → Inspect
   - Go to **Console** tab

2. Check if Prompt API is available:
   ```javascript
   // Paste this in console
   if (typeof LanguageModel !== 'undefined') {
       console.log('✅ Prompt API available');
       LanguageModel.availability().then(status => {
           console.log('Model status:', status);
       });
   } else {
       console.log('❌ Prompt API not available - check flags!');
   }
   ```

3. **Expected outputs:**
   - `available` → Model ready to use ✅
   - `downloadable` → Model can be downloaded 📥
   - `downloading` → Model downloading now ⏳
   - `unavailable` → Check RAM/storage ❌

---

## Step 3: Download Gemini Nano Model 📦

If status is `downloadable`:

```javascript
// This will trigger model download
const session = await LanguageModel.create({
    expectedOutputs: [
        { type: 'text', languages: ['en', 'es', 'ja'] }
    ],
    monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
            console.log(`Download: ${Math.round(e.loaded * 100)}%`);
        });
    }
});

// Once complete, you'll see: "Download: 100%"
session.destroy();
```

**Note:** Download is ~22 GB and may take 10-30 minutes depending on your connection.

---

## Step 4: Install PerspectiveLens Extension 📦

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/PerspectiveLens.git
   cd PerspectiveLens
   ```

2. **Create placeholder icons** (temporary):
   - Download any 4 PNG icons (16x16, 32x32, 48x48, 128x128)
   - Place in `images/` folder
   - Or follow instructions in `images/README.md`

3. **Load unpacked extension:**
   - Open `chrome://extensions`
   - Enable **"Developer mode"** (top-right toggle)
   - Click **"Load unpacked"**
   - Select the `PerspectiveLens` folder

4. **Verify installation:**
   - Extension icon appears in toolbar
   - Click icon → Popup opens
   - Check "AI Models" status

---

## Step 5: Test the Extension ✅

### Test 1: Check Popup Status

1. Click extension icon
2. Verify status indicators:
   - **AI Models:** ✅ Downloaded (or ⏳ Downloading)
   - **API Key:** ⚠️ Not Set (normal for now)
   - **Cache:** 0 analyses

### Test 2: Test Keyword Extraction

1. Open extension popup
2. Right-click popup → **Inspect**
3. In DevTools Console, paste:
   ```javascript
   // Test keyword extraction
   chrome.runtime.sendMessage({
       type: 'EXTRACT_KEYWORDS',
       title: 'Biden announces new climate policy in Paris summit',
       language: 'en'
   }, response => {
       console.log('Keywords:', response);
   });
   ```

4. **Expected output:**
   ```javascript
   {
       success: true,
       keywords: ['biden', 'climate', 'policy', 'paris', 'summit']
   }
   ```

### Test 3: Visit News Site

1. Visit a supported news site:
   - https://www.bbc.com/news
   - https://www.nytimes.com
   - https://www.theguardian.com

2. Open DevTools Console (F12)

3. Look for logs:
   ```
   [PerspectiveLens] Starting data extraction...
   [PerspectiveLens] Detection score is 5
   [PerspectiveLens] News article detected!
   ```

4. Check background service worker:
   - Go to `chrome://extensions`
   - Find PerspectiveLens
   - Click **"service worker"** link
   - See logs: "Article processed successfully"

---

## Common Issues & Fixes 🔧

### Issue 1: "LanguageModel is not defined"
**Cause:** Chrome version too old or flags not enabled

**Fix:**
1. Check Chrome version: `chrome://version` (must be 138+)
2. Verify flags are enabled (see Step 1)
3. Restart Chrome completely

### Issue 2: AI Models show "❌ Unavailable"
**Cause:** Insufficient RAM or storage

**Fix:**
1. Check free disk space (need 22 GB)
2. Check RAM (need 16 GB or GPU with 4+ GB VRAM)
3. Try flag: `#optimization-guide-on-device-model` → "Enabled BypassPerfRequirement"

### Issue 3: Model download stuck at 0%
**Cause:** Network issue or cache problem

**Fix:**
1. Check internet connection (stable, unmetered)
2. Clear browser data: `chrome://settings/clearBrowserData`
3. Restart Chrome and retry

### Issue 4: Extension not detecting articles
**Cause:** Site not whitelisted or script not loaded

**Fix:**
1. Check if site is in `manifest.json` content_scripts matches
2. Reload page after installing extension
3. Check console for errors

### Issue 5: "No output language was specified"
**Cause:** Old version of code

**Fix:**
1. Pull latest code: `git pull origin main`
2. Reload extension
3. This error is already fixed in current version

---

## Advanced Testing 🧪

### Test Prompt System

```javascript
// In background service worker console (chrome://extensions)

// Import modules
const { getPrompt } = await import('./utils/prompts.js');

// Test prompt loading
const prompt = await getPrompt('keyword-extraction', {
    title: 'Test headline',
    language: 'en'
});

console.log('Loaded prompt:', prompt);
```

### Test AI Session Creation

```javascript
// In background service worker console
const { createSession } = await import('./api/languageModel.js');

const session = await createSession();
const result = await session.prompt('Say hello in 3 languages');
console.log(result);

session.destroy();
```

### Monitor Background Messages

```javascript
// In background service worker console
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('📨 Message received:', msg);
    return true;
});
```

---

## Next Steps 🎯

Once setup is complete:

1. ✅ **Test on multiple news sites** - Verify detection works
2. ✅ **Check keyword extraction** - Ensure AI is working
3. 📅 **Implement F-003** - Add NewsAPI integration (next iteration)
4. 📅 **Build UI panel** - Create floating perspective panel
5. 📅 **Record demo** - Prepare for hackathon submission

---

## Getting Help 💬

- **Check logs:**
  - Popup: Right-click → Inspect → Console
  - Background: `chrome://extensions` → "service worker"
  - Content: Page → Inspect → Console

- **Common logs to look for:**
  - `[PerspectiveLens]` prefix on all logs
  - `✅` for success, `❌` for errors
  - Grouped logs with `▶` arrows (expandable)

- **File issues:**
  - GitHub Issues: https://github.com/yourusername/PerspectiveLens/issues
  - Include Chrome version, OS, and error logs

---

## Reference Links 🔗

- [Chrome Built-in AI Docs](https://developer.chrome.com/docs/ai/built-in)
- [Prompt API Guide](https://developer.chrome.com/docs/ai/built-in-apis)
- [Project README](README.md)
- [Feature Roadmap](GUIA-MVP.md)
- [Changelog](CHANGELOG.md)

---

**Setup Complete! 🎉** Your PerspectiveLens extension is ready for development!
