# Utils Folder

This folder contains utility functions and shared modules that support the core functionality of the PerspectiveLens extension. These utilities provide common functionality like logging, error handling, language processing, prompt management, and content validation.

## Files Overview

### `logger.js`
A professional structured logging system that provides dual-context logging (user-facing and system-technical messages). Key features include:

- **Structured Logging**: JSON-formatted log entries with rich metadata including timestamps, request IDs, categories, and data
- **Log Levels**: Support for ERROR, WARN, INFO, DEBUG, and TRACE levels following standard severity hierarchy
- **Dual Contexts**: Separate logging contexts for USER (user-facing messages) and SYSTEM (technical debugging info) with BOTH option for comprehensive logging
- **Request Tracking**: Request ID generation and tracking for following operations across multiple components
- **Category-Based Organization**: Pre-defined categories for different operation types (extract, keywords, search, fetch, analyze, etc.)
- **Progress Tracking Integration**: Specialized logging for progress updates to UI components
- **UI Broadcasting**: Automatic broadcasting of logs to UI components for real-time display
- **Rate Limiting**: Prevention of excessive logging through rate limiting mechanisms
- **Data Sanitization**: Automatic removal of sensitive information (passwords, tokens, etc.) from logs
- **Configurable Levels**: Different log levels for console output vs. UI display

### `errors.js`
Custom error classes and error handling utilities that provide specific error types for better error management. Features include:

- **Custom Error Classes**: `PerspectiveLensError`, `AIModelError`, `APIError`, and `ValidationError` with specific properties and codes
- **Error Handler Utility**: Centralized error handling with logging and analytics capabilities
- **User-Friendly Messages**: Pre-defined friendly error messages for different error scenarios
- **Extended Error Information**: Additional properties like timestamps, context, and detailed information for debugging

### `languages.js`
Language normalization and validation utilities that handle ISO 639-1 and ISO 639-3 language codes with compatibility for Chrome's AI APIs. Key functions include:

- **Language Code Normalization**: Converts various language code formats (BCP 47, ISO 639-3, etc.) to normalized ISO 639-1 codes
- **API-Specific Support Detection**: Checks if languages are supported by Chrome's Language Detector, Translator, and Prompt APIs
- **Translation Needs Assessment**: Determines if translation is needed between source and target languages
- **Comprehensive Language Mappings**: Extensive mappings for Portuguese, English, Spanish, French, German, Chinese, Japanese, Korean, Russian, and many other languages
- **Human-Readable Names**: Conversion of language codes to human-readable names
- **Validation Functions**: Comprehensive language code validation with helpful error messages

### `prompts.js`
Prompt management utility that handles loading and processing of AI prompt templates from the prompts folder. Features include:

- **Prompt Template Loading**: Asynchronous loading of prompt templates from external files
- **Variable Substitution**: Template processing with variable replacement ({{variable}} syntax)
- **Caching System**: In-memory caching to avoid repeated file reads for frequently used prompts
- **JSON Schema Loading**: Loading and parsing of JSON schemas for structured AI output
- **Preloading Capability**: Performance optimization through preloading of common prompts
- **Error Handling**: Comprehensive error handling for missing or invalid prompt files
- **Cache Management**: Utilities for clearing and managing the prompt cache

### `contentValidator.js`
Content validation and sanitization utilities that ensure article content meets quality requirements for AI processing. Features include:

- **Quality Scoring**: Comprehensive content quality assessment based on length, structure, and other factors
- **Content Filtering**: Filtering of articles to only include those meeting quality requirements
- **Content Sanitization**: Removal of excessive whitespace, control characters, and other problematic content for AI processing
- **Structure Validation**: Checking of article structure for required fields and minimum content
- **Excerpt Generation**: Creation of content excerpts for preview purposes
- **Statistical Analysis**: Content statistics including word count, sentence count, and paragraph count
- **Quality Thresholds**: Configurable quality thresholds for content validation

## Architecture

The utils follow a modular architecture with each file focusing on a specific domain of functionality:

1. **Separation of Concerns**: Each utility module handles a specific area (logging, errors, languages, etc.)
2. **Export Standards**: Modules export specific functions and classes that can be imported by other parts of the system
3. **Consistent Interfaces**: Common patterns for error handling and logging across all utilities
4. **Integration Points**: Utilities are designed to work together (e.g., logger used by other utilities, language functions used in content processing)
5. **Performance Optimization**: Caching and rate limiting to prevent performance issues
6. **Security**: Automatic sanitization of sensitive data and validation of inputs

These utilities form the foundation layer of the PerspectiveLens application, providing reliable and reusable functionality across the API, UI, and background components.