/**
 * Processing Page Script
 * Handles communication with background script for status updates
 */

// Listen for messages from background script to update status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_PROCESSING_STATUS') {
    // Could update UI with progress information
    console.log('[Processing Page] Status update:', message.data);

    // Future: Update UI elements with progress
    // updateProgressUI(message.data);
  }
});

console.log('[Processing Page] Loaded - Chrome Material Design');

// Optional: Update UI with progress information
function updateProgressUI(data) {
  // Can be implemented later to show:
  // - Number of articles processed
  // - Current batch
  // - Estimated time remaining
  // etc.
}
