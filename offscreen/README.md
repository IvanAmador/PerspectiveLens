# Offscreen Document - Content Extractor

## Setup Instructions

### 1. Download Readability.js

Download the standalone Readability.js library:

```bash
# Using curl
curl -o offscreen/readability.js https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js

# OR using wget
wget -O offscreen/readability.js https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js

# OR download manually from:
# https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js
```

### 2. Verify Installation

Check that `readability.js` is in the `offscreen/` folder:

```
offscreen/
├── offscreen.html
├── offscreen.js
├── readability.js  ← Should be here
└── README.md
```

## How It Works

1. **Background Script** sends extraction request
2. **Offscreen Document** creates hidden iframe
3. **iframe** loads the article URL (handles Google News redirects)
4. **Readability.js** extracts clean content
5. **Result** sent back to background script

## Features

- ✅ Handles Google News redirects automatically
- ✅ Parallel extraction of up to 10 articles
- ✅ Mozilla's Readability algorithm (same as Firefox Reader Mode)
- ✅ Fallback methods if Readability fails
- ✅ 10-second timeout per article
- ✅ Works 100% in background (no visible windows)

## Testing

You can test extraction from the browser console:

```javascript
// Test single URL
chrome.runtime.sendMessage({
  type: 'EXTRACT_CONTENT_OFFSCREEN',
  target: 'offscreen',
  url: 'https://news.google.com/rss/articles/...'
}, console.log);
```
