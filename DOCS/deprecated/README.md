# Deprecated UI Components

This directory contains UI components that have been replaced by more modern, consolidated implementations.

## Deprecated Files

### Toast Notification System (v1)
- **Files:** `toast-notification.js`, `toast-notification.css`
- **Deprecated:** January 2025
- **Reason:** Replaced by unified `single-toast` component
- **Replacement:** `ui/components/toast/single-toast.js`

### Analysis Toast
- **Files:** `analysis-toast.js`, `analysis-toast.css`
- **Deprecated:** January 2025
- **Reason:** Functionality merged into unified `single-toast` component
- **Replacement:** `ui/components/toast/single-toast.js` with analysis mode

### Progress Tracker
- **Files:** `progress-tracker.js`, `progress-tracker.css`
- **Deprecated:** December 2024
- **Reason:** Replaced by `single-toast` with progress tracking capabilities
- **Replacement:** `ui/components/toast/single-toast.js`

## Migration Notes

All deprecated components have been removed from:
- `manifest.json` web_accessible_resources
- Content script imports
- Background service worker references

The unified `single-toast` component provides all functionality from these deprecated components:
- Multi-type notifications (info, success, warning, error, analyze, document)
- Progress tracking with expandable logs
- Article detection notifications
- Analysis progress visualization

## Preservation

These files are preserved for reference purposes only and should not be used in active development.
