# Offscreen Folder

This folder contains the offscreen document implementation for PerspectiveLens, which enables content extraction from web pages in a hidden browser context. This approach is necessary to bypass CORS restrictions and handle complex redirect scenarios like Google News URLs that would otherwise be impossible to process from a background script.

## Files Overview

### `offscreen.html`
The HTML document that runs as an offscreen context in the browser. Key features:

- Hidden document structure (display: none) that runs in the background
- Container for dynamic iframes used for content extraction
- Script tags to load Readability.js and offscreen.js
- Basic styling to ensure the document remains hidden from users
- Contains the necessary structure to host iframes for content extraction

### `offscreen.js`
The JavaScript logic that powers the offscreen content extraction process. Key functionalities:

- **Message handling**: Listens for messages from the background script requesting content extraction
- **Google News redirect resolution**: Automatically resolves Google News redirect URLs to get the actual article URLs
- **Content extraction**: Uses Readability.js in an iframe context to extract clean article content
- **Fallback mechanisms**: Implements alternative extraction methods when Readability fails
- **Fetch-based extraction**: Provides an alternative method using fetch API for CORS-friendly sites
- **Timeout handling**: Implements 10-second timeouts per extraction to prevent hanging
- **Error handling**: Comprehensive error handling with fallback strategies
- **Resource cleanup**: Proper iframe cleanup and resource management

### `readability.js`
Mozilla's Readability.js library that powers the content extraction algorithm. This is the same algorithm used in Firefox Reader Mode, providing:

- Robust content extraction using heuristics to identify main article content
- Removal of navigation, ads, and other non-content elements
- Preservation of the most important content elements
- High-quality text extraction for analysis

### `Readability-readerable.js`
A utility script that contains the `isProbablyReaderable` function, which determines if a document is likely suitable for readability processing. Features:

- Heuristic analysis of document structure to determine readability potential
- Evaluation of content length and element types
- Filtering of documents unlikely to provide meaningful content
- Optimization to avoid processing documents that would yield poor results

### `README.md`
Setup instructions and usage documentation for the offscreen content extraction system, including:

- Download instructions for the Readability.js library
- File structure verification
- Explanation of how the offscreen system works
- Feature list and testing instructions
- Troubleshooting guidance

## Architecture

The offscreen system works by creating a temporary hidden document context in the browser where:

1. The background script sends an extraction request to the offscreen document
2. The offscreen document creates a hidden iframe and loads the target URL
3. The content is processed with Readability.js to extract clean article content
4. The extracted content is returned to the background script
5. The iframe is properly cleaned up to prevent resource leaks

This approach is essential for PerspectiveLens to handle complex content extraction scenarios while respecting browser security restrictions.