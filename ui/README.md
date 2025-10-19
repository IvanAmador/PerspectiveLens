# UI Folder

This folder contains all the user interface components for the PerspectiveLens extension. These components provide a rich, interactive experience for users to view analysis results, track progress, and interact with the extension's features.

## Files Overview

### Main UI Components

#### `analysis-panel.js`
The original analysis panel component that displays comparative analysis results. Features include:

- Collapsible panel interface with Material Design aesthetic
- Progressive rendering support for multi-stage analysis
- Interactive elements for expanding/collapsing content sections
- Source linking functionality to open articles in new tabs
- Perspectives modal displaying all found articles with summaries
- Error handling and retry functionality
- Support for multiple data formats (v1 legacy and v2 structured formats)
- HTML escaping for XSS protection
- Responsive design for different screen sizes

#### `analysis-panel-v2.js`
An updated version of the analysis panel that follows a more modular, progressive rendering approach. Uses the new PanelRenderer system with separate stage renderers.

#### `toast-notification.js`
A Material Design-styled toast notification system that provides user feedback at the corner of the screen. Features include:

- Multiple toast types (info, success, warning, error, analyze, document)
- Action buttons with customizable callbacks
- Auto-dismiss functionality with configurable durations
- Closeable and non-closeable options
- Specialized methods for different use cases (article detection, analysis started, errors)
- Progress indicators for long-running operations
- HTML escaping for XSS protection

#### `progress-tracker.js`
A comprehensive progress tracking system that displays analysis progress in a terminal-style interface. Features include:

- Real-time log display with filtering capabilities
- Terminal-style interface with color-coded log levels
- Progress bars for overall analysis and individual steps
- Filter system for log levels (ERROR, WARN, INFO, DEBUG, TRACE), contexts (USER, SYSTEM, BOTH) and categories
- Copy-to-clipboard functionality for log export
- Collapsible interface for space efficiency
- Panel-aware positioning that moves to the left when analysis panel is visible
- Legacy compatibility methods for backward compatibility

### Panel Subsystem (Modern Architecture)

#### `panel/index.js`
Module entry point that exports all panel-related components, providing a clean ES module interface.

#### `panel/panel-renderer.js`
The main orchestrator for progressive multi-stage rendering. Coordinating the rendering of 4 analysis stages:

- Stage 1: Context & Trust Signal
- Stage 2: Consensus Facts  
- Stage 3: Factual Disputes
- Stage 4: Perspective Differences
- Source linking functionality
- Complete analysis rendering for non-progressive mode
- Validation of analysis data
- Dynamic event listener attachment

#### `panel/stages/stage1-renderer.js` to `stage4-renderer.js`
Individual stage renderers that handle the display of specific analysis stages:

- **Stage 1**: Context & Trust Signal - Shows story summary, trust assessment, and reader guidance
- **Stage 2**: Consensus Facts - Displays facts agreed upon by multiple sources
- **Stage 3**: Factual Disputes - Highlights direct contradictions between sources
- **Stage 4**: Perspective Differences - Shows how sources frame the same events differently
- Each includes validation, metadata, and proper formatting

#### `panel/panel-styles.css`
CSS styles for the modern panel system, implementing Material Design principles with:

- Responsive design for different screen sizes
- Collapsible panel interface
- Color-coded elements for different types of information
- Card-based layout for organized content
- Terminal-style interface elements
- Smooth animations and transitions
- Dark/light theme support
- Custom scrollbar styling

#### `panel/README.md`
Documentation for the panel module architecture.

### Core UI Infrastructure

#### `panel-loader.js`
Dynamically loads the modular panel system as ES modules, providing backward compatibility with the legacy panel system while supporting the new modular architecture.

#### `icons.js`
A placeholder file that would contain SVG icon definitions used across UI components.

#### `design-system.css`
Shared CSS variables and design tokens that provide consistent styling across all UI components, implementing Material Design 3 principles with:

- Color palette variables
- Typography scales and font definitions
- Spacing system
- Border radius values
- Shadow definitions
- Animation timing and easing functions
- Responsive breakpoints

### Supporting UI Files

#### `analysis-panel.html`
HTML template for the analysis panel (if needed for iframe or popup contexts).

#### `analysis-panel.css`
CSS styles for the original analysis panel, implementing Material Design with:

- Fixed positioning panel
- Collapsible interface
- Card-based layout
- Responsive design
- Color-coded sections
- Smooth animations
- Scrollbar customization

#### `toast-notification.css`
CSS styles for the toast notification system with:

- Corner positioning
- Slide-in animations
- Color-coded types
- Action button styling
- Close button styling
- Responsive design

#### `progress-tracker.css`
CSS styles for the progress tracker terminal interface with:

- Terminal-style appearance
- Color-coded log levels
- Filter panel styling
- Progress bar implementation
- Collapsible interface
- Responsive design

## Architecture

The UI system follows a modular architecture pattern:

1. **Content Script Integration**: UI components are injected by content scripts and communicate with background services
2. **Progressive Rendering**: Analysis results are displayed progressively as each stage completes
3. **Material Design System**: Consistent design language across all components
4. **Event-Driven Communication**: Messages flow between components via event listeners and chrome.runtime API
5. **Modular Components**: Separate files for different UI elements that can be loaded independently
6. **Backward Compatibility**: Legacy methods are maintained for existing code while new features use modern patterns

The modern panel system (v2) uses ES modules to provide a cleaner architecture with separate stage renderers, while maintaining compatibility with the original panel implementation.