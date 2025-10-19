# Images Folder

This folder contains the icon assets for the PerspectiveLens browser extension. These icons are used in the browser's extension interface and represent the extension visually.

## Files Overview

### Extension Icons

#### `icon-16.png`
A 16x16 pixel icon used primarily in the browser's address bar and extension management pages. This small icon represents the extension when space is limited.

#### `icon-32.png`
A 32x32 pixel icon used in various extension UI elements and high-DPI displays where a slightly larger icon is needed while maintaining clarity at small sizes.

#### `icon-48.png`
A 48x48 pixel icon used in the browser's extension management pages and in the Chrome Web Store listing. This size provides better detail visibility in extension management interfaces.

#### `icon-128.png`
A 128x128 pixel icon used as the main promotional image for the extension in the Chrome Web Store and as a high-resolution version for display in extension management when larger icons are needed. This is typically the most detailed version of the extension's icon.

## Usage

These icons are referenced in the extension's manifest.json file, where different sizes are specified for different contexts. The browser automatically selects the appropriate icon size based on the context where it's being displayed.

The icons typically feature the PerspectiveLens branding and are designed to be visually recognizable even at small sizes, following browser extension icon design best practices.