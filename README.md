# PerspectiveLens

PerspectiveLens is an advanced browser extension that provides comparative news analysis using a hybrid AI approach. The extension helps users understand news stories from multiple international perspectives by automatically finding, extracting, and comparing coverage from diverse news sources around the world using both Chrome's built-in AI and cloud-based models.

## Overview

PerspectiveLens addresses the challenge of media bias and limited perspectives by automatically:
- Detecting news articles as you browse with universal, language-agnostic detection
- Searching for the same story across multiple international sources in 40+ languages
- Extracting clean article content using advanced extraction algorithms with a dedicated processing window
- Performing comparative analysis using Chrome's Gemini Nano AI or cloud-based models with intelligent fallback
- Presenting structured insights highlighting consensus, disputes, and different framing approaches

The extension works seamlessly with Chrome's AI capabilities (available in Chrome 138+) and optionally integrates with Google AI Studio API for enhanced processing when needed.

## Features

### Core Functionality
- **Universal Article Detection**: Language-agnostic, 5-layer detection system (Schema.org, Open Graph, Semantic HTML, Content Heuristics, URL Patterns)
- **International Perspective Search**: Finds related articles from 100+ countries across 6 continents
- **Advanced Content Extraction**: Multi-strategy approach using Readability.js, smart selectors, and quality validation
- **Hybrid AI Processing**: Uses Chrome's built-in Gemini Nano or cloud-based Gemini models with intelligent fallback
- **Multilingual Support**: Handles articles in 40+ languages with automatic translation and analysis

### Analysis Features
- **4-Stage Progressive Analysis** with immediate feedback:
  - Stage 1 (2-3s): Context & Trust - Story summary and reliability assessment
  - Stage 2 (3-4s): Consensus - Facts agreed upon by multiple sources
  - Stage 3 (3-5s): Factual Disputes - Direct contradictions between sources
  - Stage 4 (3-5s): Perspective Differences - How sources frame events differently
- **Rate Limit Management**: Reactive system that learns from API responses and automatically falls back
- **Content Compression**: Optimizes articles for AI context windows while preserving meaning
- **Structured Output**: JSON-formatted results using schemas for consistency

### Advanced Capabilities
- **Dedicated Processing Window**: Creates isolated window for content extraction with informative UI
- **Parallel Processing**: Efficient batch extraction with configurable timeouts and settings
- **Quality Validation**: Comprehensive content assessment with retry mechanisms for low-quality results
- **Intelligent Model Routing**: Selects best available model based on user preferences and rate limits
- **Privacy-First**: Client-side processing with optional cloud services for enhanced capacity

### User Experience
- **Material Design Interface**: Clean, modern UI following Material Design 3 principles
- **Toast Notifications**: Unobtrusive notifications with real-time progress tracking
- **Progressive Results**: Immediate feedback as each analysis stage completes
- **Configurable Settings**: Comprehensive options for countries, extraction, and AI models
- **Responsive Design**: Works well on different screen sizes

## Architecture

The extension follows a modern architectural pattern with separation of concerns across multiple folders:

### Core Components
- **API Layer** (`api/`): Wrapper modules for Chrome AI APIs (Language Detector, Translator, Summarizer, Language Model) and Google AI Studio API
- **Model Router** (`api/modelRouter.js`): Intelligent model selection with automatic fallback based on rate limits
- **Background Service** (`scripts/background.js`): Orchestrates the analysis pipeline and coordinates API calls
- **Content Script** (`scripts/content.js`): Detects articles on web pages and manages UI components
- **UI Components** (`ui/`): Modern panel system with toast notifications and progress tracking
- **Utilities** (`utils/`): Logging, error handling, language utilities, content validation, and rate limit caching
- **Configuration** (`config/`): Centralized pipeline configuration with user preference management
- **Prompts** (`prompts/`): AI prompt templates and JSON schemas for structured output
- **Offscreen Document** (`offscreen/`): Content extraction and processing with dedicated window management

### Root Files
- **`manifest.json`**: Chrome extension manifest with permissions, content scripts, and service worker configuration
- **`popup.html`**: Extension popup UI for checking AI model status and settings
- **`ui/pages/options/options.html`**: Comprehensive settings interface with Material Design 3
- **`offscreen/processing.html`**: Dedicated processing window interface for content extraction

### AI Pipeline
1. **Article Detection**: Universal 5-layer system detects articles with language-agnostic approach
2. **Perspective Search**: Finds related articles globally using Google News RSS feeds with automatic translation
3. **Content Extraction**: Advanced multi-strategy extraction with quality validation and retry mechanisms
4. **Content Processing**: Translation, compression, and optimization for AI analysis
5. **Comparative Analysis**: Either Chrome's Gemini Nano or cloud-based models with progressive 4-stage analysis
6. **Result Presentation**: Structured output in user-friendly format with source linking

### Hybrid AI Strategy
The extension implements a sophisticated hybrid AI approach:
- **Primary**: Chrome's built-in Gemini Nano for local, private processing
- **Fallback**: Google AI Studio API models (Gemini 2.5 Pro/Flash/Flash-Lite) with intelligent routing
- **Rate Limit Management**: Reactive system that learns from 429 responses and automatically selects available models
- **Model Preferences**: User-configurable model priority with automatic fallback when rate-limited

### Progressive Analysis
The analysis pipeline is divided into 4 stages for optimal user experience:
- **Stage 1** (2-3s): Context & Trust - Story summary and reliability assessment
- **Stage 2** (3-4s): Consensus - Facts agreed upon by multiple sources
- **Stage 3** (3-5s): Factual Disputes - Direct contradictions between sources
- **Stage 4** (3-5s): Perspective Differences - How sources frame events differently

## Prerequisites

- Chrome 138+ with Gemini Nano AI features enabled
- Windows, macOS, or Linux operating system
- Internet connection for fetching articles
- Chrome Extension Developer Mode for installation

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/PerspectiveLens.git
   ```

2. Install dependencies for content extraction:
   ```bash
   # Download Readability.js to the offscreen folder
   curl -o offscreen/readability.js https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js
   ```

3. Open Chrome and navigate to `chrome://extensions/`

4. Enable "Developer mode"

5. Click "Load unpacked" and select the PerspectiveLens folder

6. Enable the extension

## Usage

1. Browse to a news article
2. A notification will appear when the extension detects a news article using the universal detection system
3. Click "Analyze" to start the analysis process
4. Configure AI model preferences in the options page (options available for Gemini Nano or API models)
5. View progressive results in the side panel showing:
   - Story summary and trust assessment
   - Consensus facts agreed upon by sources (Stage 1)
   - Factual disputes between sources (Stage 2)
   - Perspective differences in framing (Stage 3)
   - Comprehensive analysis (Stage 4)
6. Access source articles through the perspectives modal

## Configuration

Comprehensive configuration options available through the settings interface:
- **Country Selection**: Choose which countries to search for perspectives
- **Article Limits**: Configure how many articles per country to analyze
- **Model Provider**: Select between Gemini Nano (local) or API models (cloud)
- **Model Preferences**: Set priority order and configuration for API models
- **Content Extraction**: Adjust quality thresholds, timeouts, and processing settings
- **Advanced Options**: Configure buffer settings and fallback behavior

## Technology Stack

- **Chrome Extensions API**: For browser integration and content extraction
- **Chrome AI APIs**: Gemini Nano for language detection, translation, summarization, and analysis
- **Google AI Studio API**: Cloud-based models with intelligent fallback capabilities
- **JavaScript ES6+**: Modern language features and modules
- **Material Design 3**: For consistent UI/UX design
- **Readability.js**: For content extraction from web pages
- **JSON Schema**: For structured AI output validation
- **SVG Icons**: Material Design icons for visual elements
- **Shadow DOM**: For UI isolation and styling consistency

## Folder Structure

- `api/`: Chrome AI and Google AI Studio API wrapper modules with model routing
- `scripts/`: Background service worker and content script
- `ui/`: User interface components, styling, and pages (popup, options)
- `utils/`: Utility functions and shared modules
- `config/`: Configuration management and pipeline defaults
- `prompts/`: AI prompt templates and schemas
- `offscreen/`: Content extraction and processing with dedicated window management
- `images/`: Extension icons and images
- `icons/`: Country flags and UI icons

## Troubleshooting

### Common Issues
- **AI models not available**: Ensure Chrome 138+ is installed and AI features are enabled via `chrome://flags/#prompt-api-for-gemini-nano`
- **Content extraction fails**: Some sites have anti-bot measures; the extension retries with alternative methods
- **Rate limit issues**: The extension automatically falls back to other models when rate-limited
- **Extension not loading**: Check that Readability.js is in the offscreen folder

### Popup Interface
The extension popup provides:
- AI model status checking (Nano or API)
- Model download functionality for Nano
- Settings access and configuration
- GitHub project link

### Options Interface
The comprehensive options page includes:
- Country selection and article count configuration
- Content extraction quality settings
- AI model provider selection (Nano vs API)
- API key management for cloud models
- Model priority configuration with drag-and-drop reordering
- Per-model parameter tuning

### Enabling AI Features
If AI models are not available, enable them via:
1. Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
2. Enable the flag
3. Restart Chrome

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Mozilla Readability.js for content extraction capabilities
- Chrome AI team for the on-device AI APIs
- Material Design team for the design system
- News source providers for accessible content

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---
*PerspectiveLens - Bringing Global Perspectives to Local News*