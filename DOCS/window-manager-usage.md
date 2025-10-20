# ProcessingWindowManager - Usage Guide

## Overview

The `ProcessingWindowManager` creates a dedicated browser window for article content extraction, isolating the processing from the user's browsing experience.

## Benefits

### ✅ User Experience
- **No pollution**: Articles are extracted in a separate window, not in user's active tabs
- **Transparency**: User can expand the window to see progress if curious
- **Professional**: Clean separation of concerns

### ✅ Organization
- **Tab Grouping**: All extraction tabs are grouped together
- **Visual Clarity**: Colored, labeled group makes debugging easy
- **Collapsed**: Group is collapsed by default to save space

### ✅ Cleanup
- **Single Operation**: Close entire window instead of individual tabs
- **Automatic**: Window is cleaned up even if errors occur (finally block)
- **Reliable**: Tracks all tabs and ensures proper cleanup

### ✅ Performance
- **Same Speed**: No performance difference from current approach
- **Batch Processing**: Still processes 10 articles in parallel
- **Resource Management**: Easier to manage and monitor resources

## Architecture

```
┌─────────────────────────────────────────────────┐
│ User's Normal Browsing Window                   │
│ ✓ Untouched                                     │
│ ✓ No interference                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PerspectiveLens Processing Window (Minimized)   │
│                                                 │
│ 📁 PerspectiveLens Processing [Collapsed]      │
│   ├── Tab 1: Article from BBC                  │
│   ├── Tab 2: Article from CNN                  │
│   ├── Tab 3: Article from Al Jazeera           │
│   └── ... (up to 10 parallel)                  │
└─────────────────────────────────────────────────┘
```

## Configuration

### Default Settings (in `config/pipeline.js`)

```javascript
extraction: {
  windowManager: {
    enableGrouping: true,           // Group tabs together
    groupTitle: 'PerspectiveLens Processing',
    groupColor: 'blue',             // Visual identifier
    windowState: 'minimized'        // Hide window from user
  }
}
```

### Window State Options

| State | Behavior | Best For |
|-------|----------|----------|
| `minimized` | Tries to minimize window, falls back to offscreen | **Production** (default) |
| `offscreen` | Moves window off-screen (-2000, -2000) | Reliable fallback |
| `normal` | Keeps window visible | **Debugging** |

### Group Color Options

Available colors: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`

## Usage Examples

### Example 1: Default Usage (Recommended)

```javascript
import { extractArticlesContentWithTabs } from './api/contentExtractor.js';

// Default: Uses window manager with settings from config
const results = await extractArticlesContentWithTabs(articles);

// Window is automatically:
// - Created before extraction starts
// - Used for all article tabs
// - Cleaned up after extraction completes (even on errors)
```

### Example 2: Custom Window Options

```javascript
const results = await extractArticlesContentWithTabs(articles, {
  useWindowManager: true,
  windowManagerOptions: {
    enableGrouping: true,
    groupTitle: 'Debug Session',
    groupColor: 'red',
    windowState: 'normal'  // Keep visible for debugging
  }
});
```

### Example 3: Disable Window Manager (Use Current Window)

```javascript
// Use current window (old behavior)
const results = await extractArticlesContentWithTabs(articles, {
  useWindowManager: false
});
```

### Example 4: Advanced - Manual Window Manager

```javascript
import { createWindowManager } from './api/windowManager.js';

const windowManager = createWindowManager({
  groupColor: 'green',
  windowState: 'normal'
});

try {
  // Create window
  await windowManager.createProcessingWindow();

  // Create tabs manually
  const tab1 = await windowManager.createTab('https://example.com');
  const tab2 = await windowManager.createTab('https://example.org');

  // Check stats
  const stats = await windowManager.getStats();
  console.log('Active tabs:', stats.totalTabs);

  // Process articles...

} finally {
  // Always cleanup
  await windowManager.cleanup();
}
```

## How It Works

### Lifecycle

```
1. extractArticlesContentWithTabs() called
   ↓
2. WindowManager created with config
   ↓
3. Dedicated processing window created
   ├── Try to minimize
   └── Fallback to offscreen if minimize fails
   ↓
4. For each article batch (up to 10 parallel):
   ├── Create tab in processing window
   ├── Add tab to group (if enabled)
   ├── Wait for redirects (Google News)
   ├── Extract content with Readability
   └── Close tab
   ↓
5. All batches processed
   ↓
6. WindowManager.cleanup() called (finally block)
   └── Close entire window
       └── All tabs and groups automatically cleaned up
```

### Error Handling

```javascript
try {
  const results = await extractArticlesContentWithTabs(articles);
} catch (error) {
  // Even if error occurs, window is cleaned up in finally block
  console.error('Extraction failed:', error);
}
```

## Debugging Tips

### See What's Happening

Set `windowState: 'normal'` in config to watch extraction in real-time:

```javascript
// In config/pipeline.js or as option
windowManager: {
  windowState: 'normal'  // Make window visible
}
```

### Check Window Stats

```javascript
const windowManager = createWindowManager();
await windowManager.createProcessingWindow();

const stats = await windowManager.getStats();
console.log(stats);
// {
//   windowId: 12345,
//   groupId: 67890,
//   alive: true,
//   totalTabs: 3,
//   activeTabs: [101, 102, 103],
//   options: {...}
// }
```

### Monitor in Logs

All window operations are logged with the `FETCH` category:

```javascript
// Look for these log messages:
// - "Creating dedicated processing window"
// - "Window minimized successfully" or "Minimizing failed, falling back to offscreen"
// - "Tab group created"
// - "Processing window ready"
// - "Cleaning up processing window"
```

## Migration from Current Implementation

### Before (Current Code)

```javascript
// Creates tabs in current window
const tab = await chrome.tabs.create({
  url: article.link,
  active: false
});

// ... extract content ...

// Close tab manually
await chrome.tabs.remove(tab.id);
```

### After (With WindowManager)

```javascript
// Automatically uses dedicated window
const results = await extractArticlesContentWithTabs(articles);

// That's it! Window manager handles:
// ✓ Window creation
// ✓ Tab creation in dedicated window
// ✓ Tab grouping
// ✓ Cleanup (even on errors)
```

**No changes needed in most cases!** The default behavior now uses the window manager.

## Performance Impact

**Zero performance impact:**
- Same batch processing (10 parallel tabs)
- Same timeout handling (20s per article)
- Same retry mechanism
- Same quality validation

**Only difference:** Tabs are in a separate window instead of current window.

## Known Issues & Limitations

### MV3 Minimize Bug

**Issue:** `chrome.windows.create({ state: 'minimized' })` doesn't work in Manifest V3.

**Solution:** We create the window in normal state, then try to minimize it. If that fails, we fall back to moving it offscreen.

```javascript
// Handled automatically in applyWindowState()
try {
  await chrome.windows.update(windowId, { state: 'minimized' });
} catch (error) {
  // Fallback: move offscreen
  await chrome.windows.update(windowId, { left: -2000, top: -2000 });
}
```

### Tab Grouping Not Critical

If tab grouping fails (e.g., permissions issue), extraction continues normally. Grouping is a nice-to-have feature, not required.

## Troubleshooting

### Window Not Minimizing

**Symptom:** Window stays visible even with `windowState: 'minimized'`

**Cause:** MV3 bug or OS restrictions

**Solution:** Window automatically falls back to offscreen position. Check logs for "Minimizing failed, falling back to offscreen" message.

### Tabs Not Grouping

**Symptom:** Tabs created but not in a group

**Cause:** Permission issue or API error

**Solution:** Check logs for grouping warnings. Extraction works fine without grouping.

### Window Not Cleaning Up

**Symptom:** Processing window remains after extraction

**Cause:** Error in cleanup logic or window manually closed by user

**Solution:** Window manager tracks window state and handles both cases gracefully.

## Best Practices

### ✅ DO

- Use default settings for production
- Use `windowState: 'normal'` for debugging
- Let the window manager handle cleanup (don't close window manually)
- Check logs if something seems wrong

### ❌ DON'T

- Don't manually close the processing window during extraction
- Don't create multiple window managers simultaneously
- Don't modify tabs in the processing window manually
- Don't disable window manager without good reason

## Future Enhancements (Potential)

- [ ] Progress indicator in window title
- [ ] Configurable window size/position
- [ ] Support for multiple concurrent extraction sessions
- [ ] Real-time extraction preview in window
- [ ] Pause/resume extraction controls

## Summary

The `ProcessingWindowManager` provides a clean, professional way to handle article extraction:

- ✅ Better UX: Doesn't pollute user's browsing
- ✅ Better organization: Grouped, labeled tabs
- ✅ Better cleanup: Single operation closes everything
- ✅ Better debugging: Can see what's happening
- ✅ Same performance: No slowdown
- ✅ Zero migration: Works with existing code

**Default behavior is now to use the window manager. No code changes needed!**
