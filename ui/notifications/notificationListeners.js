/**
 * PerspectiveLens Notification Event Listeners
 * Handles user interactions with Chrome notifications
 */

import { notificationManager } from './notificationManager.js';

// ============================================================================
// BUTTON CLICK HANDLERS
// ============================================================================

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log(`[NotificationListeners] Button ${buttonIndex} clicked on ${notificationId}`);

  // Article detected notification
  if (notificationId === 'perspectivelens-article-detected') {
    if (buttonIndex === 0) {
      // Analyze button
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'START_ANALYSIS'
          });
        }
      });
    }
    // buttonIndex 1 is Dismiss - just clear the notification
    chrome.notifications.clear(notificationId);
  }

  // Analysis complete notification
  if (notificationId === 'perspectivelens-complete') {
    if (buttonIndex === 0) {
      // View Results button
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'OPEN_PANEL'
          });
        }
      });
    }
    chrome.notifications.clear(notificationId);
  }

  // Analysis error notification
  if (notificationId === 'perspectivelens-error') {
    if (buttonIndex === 0) {
      // Retry button
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'RETRY_ANALYSIS'
          });
        }
      });
    }
    // buttonIndex 1 is Dismiss
    chrome.notifications.clear(notificationId);
  }

  // Dynamic error notifications (with timestamp)
  if (notificationId.startsWith('perspectivelens-error-')) {
    // Clear on any button click
    chrome.notifications.clear(notificationId);
  }
});

// ============================================================================
// NOTIFICATION CLICKED (body click)
// ============================================================================

chrome.notifications.onClicked.addListener((notificationId) => {
  console.log(`[NotificationListeners] Notification clicked: ${notificationId}`);

  // If analysis complete, clicking opens the panel
  if (notificationId === 'perspectivelens-complete') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'OPEN_PANEL'
        });
      }
    });
    chrome.notifications.clear(notificationId);
  }

  // If article detected, clicking starts analysis
  if (notificationId === 'perspectivelens-article-detected') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'START_ANALYSIS'
        });
      }
    });
    chrome.notifications.clear(notificationId);
  }
});

// ============================================================================
// NOTIFICATION CLOSED
// ============================================================================

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log(`[NotificationListeners] Notification closed: ${notificationId} (by user: ${byUser})`);

  // Clean up from active notifications map
  notificationManager.activeNotifications.delete(notificationId);

  // If user manually closed the article detected notification, log it
  if (notificationId === 'perspectivelens-article-detected' && byUser) {
    console.log('[NotificationListeners] User dismissed article detection');
  }
});

// ============================================================================
// NOTIFICATION PERMISSION CHANGED
// ============================================================================

if (chrome.notifications.onPermissionLevelChanged) {
  chrome.notifications.onPermissionLevelChanged.addListener((level) => {
    console.log(`[NotificationListeners] Permission level changed: ${level}`);

    if (level === 'denied') {
      console.warn('[NotificationListeners] Notifications are now denied by user');
      // Could store this in chrome.storage to warn user later
    }
  });
}

console.log('[PerspectiveLens] Notification listeners initialized');
