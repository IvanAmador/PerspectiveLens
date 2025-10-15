# Prompts for PerspectiveLens

This directory contains all AI prompts used by the extension. Prompts are externalized from code to allow easy modification and testing.

## Available Prompts

### keyword-extraction.txt
Extracts 3-5 key entities/topics from article headlines for NewsAPI search.

**Variables:**
- `{{title}}` - Article headline
- `{{language}}` - Detected language code (en, es, ja, etc.)

**Usage:** F-002 Keyword Extraction

### comparative-analysis.txt
Analyzes multiple news perspectives to identify consensus, disputes, and omissions.

**Variables:**
- `{{perspectives}}` - Formatted list of article summaries

**Usage:** F-006 Comparative Analysis

## Template Syntax

Use double curly braces for variable substitution:
- `{{variable_name}}` will be replaced with actual values at runtime

## Adding New Prompts

1. Create a new `.txt` file in this directory
2. Use the template syntax for variables
3. Document the prompt in this README
4. Import and use in the appropriate API module
