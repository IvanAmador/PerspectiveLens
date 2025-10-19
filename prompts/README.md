# Prompts Folder

This folder contains the AI prompt templates and JSON schemas used by PerspectiveLens for analyzing and comparing news articles. These prompts guide the Chrome AI Language Model API to generate structured, consistent output for comparative news analysis.

## Files Overview

### Prompt Text Files

#### `comparative-analysis.txt`
A comprehensive prompt for multi-faceted news comparison that guides the AI to analyze articles across four dimensions: story summary, reader guidance, consensus facts, and key differences. It includes detailed formatting rules for the `key_differences` field to ensure consistent output structure, requiring sources to be split into exactly two groups with specific formatting.

#### `stage1-context-trust.txt`
A prompt for the first stage of progressive analysis that focuses on providing immediate context and trust assessment. It instructs the AI to generate a concise story summary, assign a trust signal level (high_agreement, some_conflicts, or major_disputes), and provide actionable reader guidance. Designed to be fast (2-3 seconds) for immediate user feedback.

#### `stage2-consensus.txt`
A prompt for identifying facts that multiple news sources agree on. It focuses on finding consensus that validates the story's credibility, with rules to include only facts confirmed by at least 2 sources and to be specific rather than vague. Helps readers identify what they can trust as true.

#### `stage3-disputes.txt`
A prompt specifically designed to identify direct factual contradictions between sources. It focuses on verifiable facts that sources dispute (such as casualty numbers, dates, or other quantifiable information) rather than differences in framing or emphasis. This helps readers understand where sources genuinely disagree on basic facts.

#### `stage4-perspectives.txt`
A prompt for analyzing how different sources frame the same story differently. It focuses on differences in emphasis, context, word choice, and narrative structure rather than factual disputes. This helps readers understand how different outlets shape their coverage of the same events.

#### `keyword-extraction.txt`
A simple prompt template for extracting 3-5 key entities or topics from article headlines. Uses a fill-in-the-blank approach with variables for title and language. Provides examples across multiple languages to ensure consistent behavior regardless of source language.

### JSON Schema Files

#### `comparative-analysis-schema.json`
Defines the expected structure for comprehensive comparative analysis results, including required fields like `story_summary`, `reader_guidance`, `consensus`, and `key_differences` with specific constraints on content length and format.

#### `stage1-context-trust-schema.json`
Schema for Stage 1 results with specific format requirements for the `story_summary` (max 25 words), `trust_signal` (enum of three values), and `reader_action` (max 20 words).

#### `stage2-consensus-schema.json`
Schema for consensus fact identification results, requiring an object where keys are factual statements and values are arrays of sources confirming each fact.

#### `stage3-disputes-schema.json`
Schema for factual dispute identification with requirements for structured presentation of contradictory claims.

#### `stage4-perspectives-schema.json`
Schema for perspective differences analysis, focusing on differences in framing, emphasis, and narrative approach between sources.

## Architecture

The prompt system follows a progressive analysis approach where complex comparative analysis is broken down into four focused stages:

1. **Context & Trust** (Stage 1): Quick assessment providing immediate context and trust signal
2. **Consensus** (Stage 2): Identification of agreed-upon facts
3. **Disputes** (Stage 3): Identification of factual contradictions
4. **Perspectives** (Stage 4): Analysis of differences in framing and emphasis

This progressive approach allows the UI to display results incrementally and provides better quality analysis by focusing the AI on one task at a time. Each prompt is paired with a corresponding JSON schema that ensures consistent, structured output that can be reliably used by the application.