/**
 * Processing Page Script
 * Handles communication with background script for status updates
 * Manages theme detection and UI updates
 */

// Theme management - detect and apply system preference
function detectAndApplyTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = prefersDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  console.log('[Processing Page] Theme applied:', theme);
}

// Initialize theme on load
detectAndApplyTheme();

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const theme = e.matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  console.log('[Processing Page] Theme changed to:', theme);
});

// Listen for messages from background script to update status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_PROCESSING_STATUS') {
    console.log('[Processing Page] Status update:', message.data);
    updateProgressUI(message.data);
  }
});

console.log('[Processing Page] Loaded - Material Design 3');

// Update UI with progress information
function updateProgressUI(data) {
  // Future implementation:
  // - Number of articles processed
  // - Current batch
  // - Estimated time remaining
  // - Progress percentage

  if (!data) return;

  // Example: Update status value
  if (data.articlesProcessed !== undefined) {
    const statusElement = document.querySelector('.status-value');
    if (statusElement) {
      statusElement.textContent = `Processing (${data.articlesProcessed} completed)`;
    }
  }
}
