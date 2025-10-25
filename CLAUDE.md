# PerspectiveLens - Development Guidelines

## Project Overview

PerspectiveLens is an advanced Chrome extension that provides comparative news analysis using Chrome's built-in AI APIs. The extension helps users understand news stories from multiple international perspectives by automatically finding, extracting, and comparing coverage from diverse news sources around the world.

The extension works seamlessly with Chrome's AI capabilities (available in Chrome 138+) to provide on-demand analysis of news coverage without requiring external APIs or services. It identifies news articles as users browse, searches for the same story across multiple international sources, extracts clean article content using advanced extraction algorithms, performs comparative analysis using Chrome's Gemini Nano AI, and presents structured insights highlighting consensus, disputes, and different framing approaches.

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

## Design System Requirements

### Material Design 3 Implementation

**CRITICAL REQUIREMENT**: All CSS variables and design tokens must be defined in `ui/design-system.css`. This file is the single source of truth for all design elements in the project.

All UI components, popup interfaces, options pages, and toast notifications must use the variables defined in `ui/design-system.css` following Material Design 3 principles. All styling must be consistent with Chrome's Material Design 3 implementation.

### Chrome Material 3 Expressive Guidelines

Follow the Chrome Material 3 Expressive variant as specified in `DOCS/material-3/MATERIAL-3-REFERENCE.md`:

#### Progress Indicators
- Use segmented progress indicators with rounded corners
- Follow Chrome's expressive motion patterns

#### Button Styles
- All buttons should have rounded containers (20px radius for filled buttons)
- Use the Chrome-specific color palette from design-system.css
- Implement proper hover, focus, and active states

#### Tabs
- Use rounded button containers for tabs
- Apply consistent colors across the entire card

#### Color System
Use the Material Design 3 color system from `ui/design-system.css`:
- Primary colors with proper accessibility contrast ratios
- Secondary and tertiary color schemes
- Surface and background colors with proper elevation
- Proper dark mode support with automatic system preference detection

#### Typography
- Use Roboto font family with Chrome's specific weights
- Follow Material 3 type scale (display, headline, title, body, label)
- Maintain proper line heights and spacing

#### Elevation and Shadows
- Use Chrome-specific elevation levels from the design system
- Implement proper shadow tokens for different surfaces

#### Corner Radius (Shape System)
- Apply consistent border radius tokens to all components
- Use appropriate radius values for different component types

### Mode Management
- Automatically detect system preference for dark/light mode
- Provide smooth transitions between themes
- Store user preference while respecting system settings

## Configuration Management Requirements

**CRITICAL REQUIREMENT**: All APIs and backend functionality must utilize configurations defined by the user through `config/configManager.js`.

### Configuration System Architecture
The configuration system consists of:

1. **`config/pipeline.js`**: Contains the default `PIPELINE_CONFIG` object which serves as the single source of truth for all configuration values
2. **`config/configManager.js`**: Handles loading, saving, and merging of user configurations with defaults
3. **User-defined settings**: Stored in Chrome's `storage.sync` area using the key 'perspectiveLens_config'

### Configuration Management Rules
1. **Default Values**: All default configuration values are defined in `config/pipeline.js` in the `PIPELINE_CONFIG` object
2. **User Preferences**: Users can override any default value through the options page, with values stored in chrome.storage.sync
3. **Merging Logic**: The ConfigManager uses deep merge functionality to combine user preferences with defaults
4. **Validation**: All configuration changes must be validated before saving
5. **Broadcasting**: Configuration changes are automatically broadcast to all extension contexts (content scripts, service worker, popup)

### Configuration Sections
The system provides configuration for:
- **Article Selection**: Number of articles to analyze per country, buffer settings, maximum analysis limits
- **Search Settings**: Google News RSS configuration, timeout settings, retry attempts
- **Content Extraction**: Quality thresholds, timeout values, parallel processing settings
- **AI Analysis**: Model parameters (temperature, topK), compression levels, analysis stages

### API Integration
All backend APIs and services must use the configuration system through:
- `ConfigManager.load()` to get current configuration
- `ConfigManager.get(path)` to get specific configuration values
- `ConfigManager.set(path, value)` to update specific configuration values
- Listening for 'CONFIG_UPDATED' messages to respond to configuration changes

## UI Component Styling Requirements

### CSS Variable Usage
- All color values must use CSS variables defined in `ui/design-system.css`
- All spacing values must use the spacing system variables (e.g., `var(--spacing-4)`)
- All typography values must use font variables from the design system
- All animations and transitions must use standard easing and duration variables
- All corner radius values must use the shape system variables
- All shadow values must use elevation variables from the design system

### Component-Specific Requirements
- **Popup Interface**: Must use Material Design 3 components with proper Chrome styling
- **Options Page**: Must follow Material Design 3 layout patterns with proper navigation
- **Toast Notifications**: Must use Chrome-style notifications with proper Material Design 3 styling
- **Analysis Panel**: Must follow Chrome's Material 3 Expressive patterns for content display
- **Progress Indicators**: Must use segmented progress indicators as per Chrome Material 3
- **Buttons and Controls**: Must use Material Design 3 button styles with proper states

### Dark/Light Theme Support
- All components must automatically adapt to system theme preferences
- Use `[data-theme='dark']` and `[data-theme='light']` selectors where needed
- Ensure proper contrast ratios in both themes (WCAG AA minimum)

## Chrome Extension Specific Requirements

### Manifest Configuration
- All UI resources must be listed in `web_accessible_resources` in manifest.json
- Content scripts must include the design system CSS
- Proper permissions must be requested for all functionality

### Storage Integration
- Use Chrome's storage.sync API for user preferences
- ConfigManager must handle all storage operations
- Implement proper error handling for storage operations

### Messaging System
- Use Chrome's messaging APIs for communication between contexts
- Implement proper error handling for cross-context communication
- Ensure configuration changes are properly broadcast to all contexts

### Performance Considerations
- Minimize DOM manipulation in content scripts
- Use efficient algorithms for article detection and processing
- Implement proper caching for configuration values
- Follow Chrome extension performance best practices

## Development Workflow

### New Component Development
1. Always start by referencing `ui/design-system.css` for available variables
2. Use Material Design 3 patterns from `DOCS/material-3/MATERIAL-3-REFERENCE.md`
3. Access configuration values through `config/configManager.js`
4. Test in both light and dark modes
5. Validate accessibility compliance

### UI Updates
1. Update `ui/design-system.css` first when changing design tokens
2. Verify all components continue to work with new tokens
3. Test theme switching functionality
4. Ensure proper contrast ratios are maintained

### Configuration Changes
1. Update `config/pipeline.js` for new default values
2. Update `config/configManager.js` for new validation logic if needed
3. Update options page to expose new settings to users
4. Test configuration saving, loading, and broadcasting

## Quality Assurance

### Design System Compliance
- All color values must come from the design system
- All spacing must use the 4px base unit system
- All typography must follow Material Design 3 scales
- All components must work in both light and dark modes

### Configuration Validation
- All user input must be validated before saving
- Configuration changes must be properly broadcast
- Default values must be maintained when not overridden
- Error handling must be implemented for all configuration operations

### Chrome Extension Standards
- Follow Chrome extension best practices
- Implement proper error handling
- Ensure efficient resource usage
- Maintain security best practices