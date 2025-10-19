# PerspectiveLens

PerspectiveLens is an advanced browser extension that provides comparative news analysis using Chrome's built-in AI APIs. The extension helps users understand news stories from multiple international perspectives by automatically finding, extracting, and comparing coverage from diverse news sources around the world.

## Overview

PerspectiveLens addresses the challenge of media bias and limited perspectives by automatically:
- Detecting news articles as you browse
- Searching for the same story across multiple international sources
- Extracting clean article content using advanced extraction algorithms
- Performing comparative analysis using Chrome's Gemini Nano AI
- Presenting structured insights highlighting consensus, disputes, and different framing approaches

The extension works seamlessly with Chrome's AI capabilities (available in Chrome 138+) to provide on-demand analysis of news coverage without requiring external APIs or services.

## Features

### Core Functionality
- **Automatic Article Detection**: Identifies news articles and offers analysis with a simple notification
- **International Perspective Search**: Finds related articles from multiple countries and languages
- **Content Extraction**: Uses Readability.js to extract clean content from complex web pages
- **Multilingual Support**: Handles articles in multiple languages with automatic translation
- **AI-Powered Analysis**: Leverages Chrome's built-in AI models for comparative analysis

### Analysis Features
- **Consensus Identification**: Shows facts that multiple sources agree on
- **Factual Disputes**: Highlights direct contradictions between sources
- **Perspective Differences**: Reveals how different outlets frame the same events
- **Trust Signal Assessment**: Provides guidance on the reliability of the story
- **Progressive Analysis**: Shows results as each analysis stage completes (2-3 seconds for initial results)

### User Experience
- **Material Design Interface**: Clean, modern UI following Material Design 3 principles
- **Toast Notifications**: Unobtrusive notifications when articles are detected
- **Progress Tracking**: Real-time progress updates with detailed logging
- **Source Linking**: Clickable links to all referenced articles
- **Responsive Design**: Works well on different screen sizes

## Architecture

The extension follows a modern architectural pattern with separation of concerns across multiple folders:

### Core Components
- **API Layer** (`api/`): Wrapper modules for Chrome AI APIs (Language Detector, Translator, Summarizer, and Language Model)
- **Background Service** (`scripts/background.js`): Orchestrates the analysis pipeline and coordinates API calls
- **Content Script** (`scripts/content.js`): Detects articles on web pages and manages UI components
- **UI Components** (`ui/`): Modern panel system with toast notifications and progress tracking
- **Utilities** (`utils/`): Logging, error handling, language utilities, and content validation
- **Prompts** (`prompts/`): AI prompt templates and JSON schemas for structured output
- **Offscreen Document** (`offscreen/`): Content extraction using Readability.js in a hidden context

### Root Files
- **`manifest.json`**: Chrome extension manifest with permissions, content scripts, and service worker configuration
- **`popup.html`**: Extension popup UI for checking AI model status
- **`popup.css`**: Styling for the popup UI using Material Design 3
- **`popup.js`**: JavaScript for popup functionality and AI model status management
- **`.env.example`**: Example environment configuration file

### AI Pipeline
1. **Article Detection**: Content script identifies news articles using scoring algorithms
2. **Content Extraction**: Extracts clean content using Readability.js and Chrome tabs
3. **Perspective Search**: Finds related articles globally using Google News RSS feeds
4. **Content Processing**: Extracts content from perspective articles
5. **Comparative Analysis**: Uses Chrome's Language Model API for multi-stage analysis
6. **Result Presentation**: Displays structured analysis in user-friendly format

### Progressive Analysis
The analysis pipeline is divided into 4 stages for optimal user experience:
- **Stage 1** (2-3s): Context & Trust - Story summary and initial guidance
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
2. A notification will appear when the extension detects a news article
3. Click "Analyze" to start the analysis process
4. View results in the side panel showing:
   - Story summary and trust assessment
   - Consensus facts agreed upon by sources
   - Factual disputes between sources
   - Perspective differences in framing
5. Open linked articles to read the original content

## Configuration

Configuration options include:
- **Environment Variables**: Use `.env.example` as a template for development settings
- **Popup Settings**: Accessible through the extension's popup interface
- **Cache Settings**: Configurable cache size and time-to-live
- **Language Settings**: Default and supported languages for analysis

## Technology Stack

- **Chrome Extensions API**: For browser integration and content extraction
- **Chrome AI APIs**: Gemini Nano for language detection, translation, summarization, and analysis
- **JavaScript ES6+**: Modern language features and modules
- **Material Design 3**: For consistent UI/UX design
- **Readability.js**: For content extraction from web pages
- **JSON Schema**: For structured AI output validation
- **SVG Icons**: Material Design icons for visual elements

## Folder Structure

- `api/`: Chrome AI API wrapper modules
- `scripts/`: Background service worker and content script
- `ui/`: User interface components and styling
- `utils/`: Utility functions and shared modules
- `prompts/`: AI prompt templates and schemas
- `offscreen/`: Content extraction using offscreen documents
- `images/`: Extension icons and images

## Troubleshooting

### Common Issues
- **AI models not available**: Ensure Chrome 138+ is installed and AI features are enabled
- **Content extraction fails**: Some sites have anti-bot measures that prevent content extraction
- **Analysis results incomplete**: Limited perspectives available for certain stories

### Popup Interface
The extension popup provides:
- AI model status checking
- Model download functionality
- Settings access
- GitHub project link

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