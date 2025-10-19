# Scripts Folder

This folder contains the core JavaScript files that power the PerspectiveLens browser extension. These scripts handle the content detection, background processing, and communication between different extension components.

## Files Overview

### `background.js`
The service worker that runs in the background and serves as the orchestrator for all extension functionality. Key responsibilities include:

- **Message Coordination**: Handles communication between content scripts, popup, and UI components
- **AI Pipeline Management**: Coordinates the multi-step analysis pipeline (search perspectives → extract content → comparative analysis)
- **State Management**: Tracks active analysis requests, download progress, and application state
- **Content Extraction**: Uses the API module to extract content from articles using Chrome tabs
- **Perspective Search**: Searches for related articles globally using Google News RSS feeds
- **Comparative Analysis**: Uses Chrome's Language Model API (Gemini Nano) to perform multi-stage analysis of news articles
- **Progress Tracking**: Updates UI with real-time progress of analysis steps
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Statistics Management**: Tracks analysis statistics and usage metrics
- **Model Management**: Handles AI model availability checks and download processes

The background script implements a 4-stage progressive analysis pipeline:
1. Context & Trust (2-3s) - Provides immediate story summary and trust signals
2. Consensus (3-4s) - Identifies facts all sources agree on
3. Factual Disputes (3-5s) - Highlights direct contradictions between sources
4. Perspective Differences (3-5s) - Shows how sources frame the same events differently

### `content.js`
The content script that runs on web pages to detect news articles and interface with the user. Key features:

- **Article Detection**: Uses scoring algorithms to identify news articles based on domain, meta tags, and content structure
- **Content Extraction**: Extracts article titles, content, authors, and publication dates from page DOM
- **User Interface Integration**: Shows toast notifications when news articles are detected
- **Message Handling**: Communicates with the background script to initiate analyses
- **Progress Tracking**: Receives and displays progress updates during analysis
- **UI Component Management**: Interacts with UI components to display analysis results
- **Dependency Loading**: Ensures UI components are loaded before displaying notifications
- **Event Handling**: Listens for user actions to start analysis and retry operations
- **Error Handling**: Manages errors and displays appropriate user notifications

## Architecture

The scripts follow Chrome extension architecture patterns:

1. **Content Script** runs on web pages, detects articles, and provides user interaction
2. **Background Script** runs continuously, manages the analysis pipeline, and coordinates all extension functionality
3. **Communication Layer** handles messaging between content scripts, background script, and UI components
4. **Progress Tracking** provides real-time feedback to users during multi-step analysis

The content script detects news articles by scoring factors like domain reputation, presence of article meta tags, semantic HTML structure, and content patterns. Once detected, it allows users to initiate analysis through a toast notification.

The background script then executes the analysis pipeline:
- Searches globally for related articles using multi-country Google News RSS feeds
- Extracts content from identified articles using tab-based extraction with Readability.js
- Performs comparative analysis using Chrome's AI APIs to identify consensus, disputes, and perspective differences
- Updates the UI progressively as each analysis stage completes