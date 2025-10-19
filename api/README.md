# API Folder

This folder contains the core API wrapper modules for the PerspectiveLens project. These modules provide abstractions for various Chrome AI APIs and external services used for content extraction, language processing, and news analysis.

## Files Overview

### `contentExtractor.js`
This module handles the extraction of content from web pages using Chrome's tab API and Mozilla's Readability.js library. It implements a robust, multi-strategy approach for extracting article content, including:

- Creating background Chrome tabs for reliable redirect handling (especially important for Google News and other redirect services)
- Injecting Readability.js for high-quality content extraction
- Multiple fallback strategies for different types of content and websites
- Quality validation of extracted content with scoring and retry mechanisms
- Parallel batch processing for improved performance
- Comprehensive logging and error handling

The module includes configuration for quality thresholds and various extraction parameters to ensure high-quality results.

### `languageDetector.js`
A wrapper for Chrome's Language Detector API that detects the language of input text. Features include:

- Availability checking for the Chrome Language Detector API
- Language detection with confidence scoring
- Fallback mechanisms using pattern-based detection
- Batch processing capabilities for multiple texts
- Automatic normalization of language codes to ISO 639-1 standard
- Configuration for confidence thresholds and detection parameters
- Error handling with detailed logging

### `languageModel.js`
Provides integration with Chrome's Prompt API (Gemini Nano) for generative AI tasks. Key functionalities:

- Session management for the Language Model API
- Comparative analysis of multiple articles with structured output
- Progressive multi-stage analysis (context & trust, consensus, factual disputes, perspective differences)
- Automatic language handling with translation to ensure optimal results
- Content compression and validation for efficient processing
- Error handling and quota management specific to Chrome's AI APIs
- Detailed logging and performance metrics

### `newsFetcher.js`
Handles fetching diverse perspectives on news topics using Google News RSS feeds. Features:

- Multi-country RSS searching to get diverse viewpoints
- Automatic title translation to English for better search results
- Smart deduplication and filtering of results
- Country-balanced results to ensure diverse perspectives
- Regex-based RSS parsing (compatible with Service Workers)
- Configuration for search countries, result limits, and query building

### `summarizer.js`
A wrapper for Chrome's Summarizer API that creates concise summaries of content. Key features:

- Multiple summary types: key points, TL;DR, teaser, and headline generation
- Configurable lengths (short, medium, long) and formats (markdown, plain-text)
- Automatic language translation for optimal summarization
- Batch processing with session reuse for efficiency
- Content compression for comparative analysis
- Performance optimization with caching and warming features
- Fallback mechanisms when summarization fails

### `translator.js`
A wrapper for Chrome's Translator API that handles text translation. Functions include:

- Language pair availability checking
- Creation and management of translator instances
- Translation with automatic language code normalization
- Streaming translation for long texts
- Batch translation for multiple texts
- Support for various supported language pairs
- Comprehensive error handling and fallback mechanisms

## Architecture

The API modules follow a consistent pattern:
- Availability checking for Chrome AI APIs
- Configuration handling with sensible defaults
- Robust error handling with detailed logging
- Automatic language normalization
- Fallback mechanisms when primary methods fail
- Performance optimization through session reuse and batch processing where appropriate

These modules form the core functionality of the PerspectiveLens extension, enabling it to extract, analyze, and present diverse perspectives on news articles while handling various international languages effectively.