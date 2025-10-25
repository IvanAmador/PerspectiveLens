# Logging System Refactoring

## Date: 2025-10-25

## Overview
Complete refactoring of the logging and toast notification system to fix critical race conditions, message delivery failures, and architectural issues.

## Problems Fixed

### 1. Race Condition in Message Broadcast
**Before**: Logger used `chrome.tabs.query({ active: true })` which returned ALL active tabs across ALL windows, causing logs to be sent to wrong tabs or lost entirely.

**After**: Logger now maintains a `currentTabId` context and sends messages only to the specific tab where analysis is running.

### 2. Multiple Message Types Causing Complexity
**Before**: System used 3 different message types (`LOG_EVENT`, `USER_PROGRESS`, `PROGRESS_UPDATE`) creating synchronization issues.

**After**: Consolidated to single `USER_PROGRESS` message type for all user-facing updates, simplifying the message flow. `LOG_EVENT` is completely deprecated and removed from the pipeline.

### 3. Silent Broadcast Failures
**Before**: Message delivery failures were silently ignored with empty catch blocks, making debugging impossible.

**After**: Implemented retry logic with exponential backoff (50ms, 100ms) and detailed error logging for all failures.

### 4. No TabId Context in Logger
**Before**: Logger had no awareness of which tab was associated with the current analysis.

**After**: Logger now accepts and tracks tabId through `startRequest(operation, tabId)` and `setTabId(tabId)` methods.

### 5. Duplicate Broadcast Mechanisms
**Before**: Code tried to use both `window.dispatchEvent` and `chrome.tabs.sendMessage` simultaneously, causing confusion.

**After**: Removed `window.dispatchEvent` mechanism, using only `chrome.tabs.sendMessage` from background to content script.

## Architecture Changes

### Logger Module (`utils/logger.js`)

#### New State Management
```javascript
const state = {
  currentRequestId: null,
  currentTabId: null,  // NEW: Track target tab
  history: [],
  rateLimitTracker: new Map(),
  requestTimings: new Map()
};
```

#### New Functions
- `setTabId(tabId)`: Set the target tab for all subsequent logs
- `getCurrentTabId()`: Get the current target tab ID
- `sendMessageToTab(tabId, message, retries)`: Send message with retry logic

#### Updated Functions
- `startRequest(operation, tabId)`: Now accepts optional tabId parameter
- `broadcastToUI(entry)`: **DEPRECATED** - does nothing, kept for compatibility
- `logUserProgress(phase, progress, message, metadata)`: Uses tabId-targeted sending (primary method for UI updates)
- `log(level, context, message, options)`: No longer broadcasts LOG_EVENT to UI

### Background Service (`scripts/background.js`)

#### Message Handler Updates
```javascript
// START_ANALYSIS handler
const tabId = sender.tab?.id || null;
activeAnalysis.tabId = tabId;
activeAnalysis.requestId = logger.startRequest('article_analysis', tabId);
```

All analysis operations now properly set the tabId context in logger at the start of the request.

### Content Script (`scripts/content.js`)

#### Simplified Message Handlers
Removed handlers:
- `LOG_EVENT` - no longer used
- `PROGRESS_UPDATE` - consolidated into USER_PROGRESS
- `handleLogEvent()` function - removed
- `handleProgressUpdate()` function - removed
- `perspectivelens:log` event listener - removed

Kept handlers:
- `USER_PROGRESS` - primary progress updates
- `SHOW_ANALYSIS` - complete analysis results
- `ANALYSIS_STAGE_COMPLETE` - progressive updates
- `ANALYSIS_FAILED` - error handling

## Message Flow (New Architecture)

```
Background (analysis starts)
    ↓
logger.startRequest('article_analysis', tabId)  // Sets context
    ↓
logger.logUserProgress(phase, progress, message)
    ↓
sendMessageToTab(tabId, {type: 'USER_PROGRESS', ...})  // Targeted send
    ↓
chrome.tabs.sendMessage(specificTabId, message)  // With retry
    ↓
Content Script: handleUserProgress(payload)
    ↓
singleToast.updateProgress() / updateMessage()
```

## Benefits

1. **Reliability**: Messages are guaranteed to reach the correct tab with retry logic
2. **Debugging**: All failures are logged with detailed context
3. **Simplicity**: Single message type reduces complexity
4. **Performance**: Targeted sending is more efficient than broadcasting
5. **Maintainability**: Clear separation of concerns and simpler code paths

## Migration Guide

### For Developers

No changes needed in most code. The logger API remains compatible:

```javascript
// Old way (still works)
logger.user.info('Message');
logger.logUserProgress('phase', 50, 'Message');

// New way (recommended)
logger.startRequest('operation', tabId);  // At operation start
logger.user.info('Message');  // Automatically uses tabId
logger.logUserProgress('phase', 50, 'Message');  // Targeted delivery
logger.clearRequest();  // At operation end
```

### Deprecated Files

Moved to `DOCS/deprecated/`:
- `toast-notification.js` - replaced by single-toast.js
- `toast-notification.css` - replaced by single-toast.css
- `progress-tracker.js` - functionality integrated into single-toast
- `progress-tracker.css` - functionality integrated into single-toast

## Common Errors Fixed

### Error: "Could not establish connection. Receiving end does not exist."
**Cause**: Logger was sending `LOG_EVENT` messages to content script, but content script no longer had a handler for this message type.

**Solution**:
1. Deprecated `broadcastToUI()` to do nothing
2. Removed `LOG_EVENT` broadcast from `log()` function
3. All UI updates now use `logUserProgress()` exclusively
4. Only `USER` and `BOTH` context logs should reach the UI (via logUserProgress), not all system logs

## Testing Checklist

- [ ] Start analysis on one tab, verify logs appear in correct tab
- [ ] Start analysis on multiple tabs sequentially, verify isolation
- [ ] Test with tab not focused (background tab)
- [ ] Test with multiple windows open
- [ ] Verify retry logic on slow network
- [ ] Check error logging in console for failures
- [ ] Verify no "Could not establish connection" errors in console
- [ ] Confirm only USER_PROGRESS messages are sent to content script

## Future Improvements

1. Add metrics for message delivery success rate
2. Implement message queuing for offline scenarios
3. Add visual indicator in toast when retries are happening
4. Consider WebSocket for real-time bidirectional communication
