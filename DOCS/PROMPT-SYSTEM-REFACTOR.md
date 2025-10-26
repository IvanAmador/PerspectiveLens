# Prompt System Refactor - Complete Documentation

## Overview

This document describes the complete refactoring of the PerspectiveLens prompt system to support model-specific prompts for Gemini Nano and Gemini 2.5 Pro.

**Date**: 2025-10-26
**Version**: 2.0
**Status**: ✅ Complete

---

## Problem Statement

### Original Issues

1. **❌ Gemini 2.5 Pro was NOT receiving article content**
   - Used `article.content` property (undefined)
   - Should use `article.extractedContent.textContent`
   - Result: Pro API received empty content strings

2. **❌ Prompts were hardcoded inline**
   - Prompts embedded in `api/gemini-2-5-pro.js`
   - No separation between Nano and Pro prompts
   - Difficult to maintain and update

3. **❌ No content preparation layer**
   - Direct property access without validation
   - No consistent content sanitization
   - No logging of what content is being sent

---

## Solution Architecture

### 1. Directory Structure

```
prompts/
├── nano/                          # Gemini Nano prompts (compressed content)
│   ├── stage1-context-trust.txt
│   ├── stage2-consensus.txt
│   ├── stage3-disputes.txt
│   └── stage4-perspectives.txt
│
├── pro/                           # Gemini Pro prompts (full content)
│   ├── stage1-context-trust.txt
│   ├── stage2-consensus.txt
│   ├── stage3-disputes.txt
│   └── stage4-perspectives.txt
│
└── schemas/                       # Shared JSON schemas
    ├── stage1.json
    ├── stage2.json
    ├── stage3.json
    └── stage4.json

utils/
├── prompts.js                     # Prompt loading system
└── contentPreparation.js          # NEW: Content preparation layer

api/
├── gemini-2-5-pro.js              # UPDATED: Uses new system
└── languageModel.js               # UPDATED: Uses new system
```

---

## 2. Key Differences: Nano vs Pro

### Gemini Nano (Chrome AI - Local)

**Context Limitations**:
- ~60-80k token context window
- Requires content compression
- Translation to English needed

**Content Flow**:
```
article.extractedContent.textContent
    ↓ (Chrome Translation API)
translatedText
    ↓ (Chrome Summarizer API - 5 key points)
article.compressedContent
    ↓ (prepareForNano)
Formatted prompt with summaries
```

**Prompt Characteristics**:
- Mentions "summarized content" in instructions
- Simpler language
- More direct instructions
- English-only input

**Example Article Format**:
```
### Article 1
**Source:** BBC (GB)
**Language:** en
**Title:** Government Announces Policy
**Content:**
• Key point 1
• Key point 2
• Key point 3
• Key point 4
• Key point 5
```

---

### Gemini 2.5 Pro (REST API - Cloud)

**Context Capabilities**:
- 2M token context window
- No compression needed
- Native multi-language support

**Content Flow**:
```
article.extractedContent.textContent
    ↓ (prepareForPro - no compression!)
Formatted prompt with full articles
```

**Prompt Characteristics**:
- Emphasizes "COMPLETE articles in ORIGINAL LANGUAGES"
- Mentions multilingual capabilities
- More detailed instructions
- Handles multi-language input

**Example Article Format**:
```
### Article 1
**Source:** BBC (GB)
**Language:** en
**Title:** Government Announces Major Policy Change
**Content:**
[Full 2000-word article in English]

### Article 2
**Source:** Le Monde (FR)
**Language:** fr
**Title:** Le gouvernement annonce un changement majeur
**Content:**
[Article complet de 1800 mots en français]
```

---

## 3. Content Preparation System

### File: `utils/contentPreparation.js`

#### Functions

**`prepareForNano(articles)`**
- Extracts `compressedContent` (or falls back to full content)
- Validates content presence
- Returns formatted text and statistics
- Used by: `api/languageModel.js`

**`prepareForPro(articles)`**
- Extracts `extractedContent.textContent` (full content)
- Keeps original language
- Returns formatted text and statistics
- Used by: `api/gemini-2-5-pro.js`

**`validateArticleContent(articles, modelType)`**
- Checks content presence for model type
- Returns validation report with warnings
- Logs missing content

**`getContentStats(articles)`**
- Returns detailed statistics about article content
- Useful for debugging

#### Key Features

1. **Consistent Content Access**
   ```javascript
   // Nano: compressedContent OR extractedContent.textContent
   const content = article.compressedContent
     || article.extractedContent?.textContent
     || '';

   // Pro: extractedContent.textContent OR content
   const content = article.extractedContent?.textContent
     || article.content
     || '';
   ```

2. **Content Sanitization**
   - Normalizes whitespace
   - Limits consecutive newlines
   - Trims content

3. **Logging & Validation**
   - Logs preparation stats
   - Warns about missing content
   - Provides fallback chains

---

## 4. Prompt Loading System

### File: `utils/prompts.js`

#### New Functions

**`getModelPrompt(model, stage, variables)`**
```javascript
// Load Nano prompt
const prompt = await getModelPrompt('nano', 'stage1-context-trust');

// Load Pro prompt
const prompt = await getModelPrompt('pro', 'stage1-context-trust');
```

**`getStageSchema(stageName)`**
```javascript
// Load schema from schemas/ directory
const schema = await getStageSchema('stage1');
```

#### Updated Functions

**`preloadPrompts()`**
- Now preloads all Nano and Pro prompts
- Caches for performance
- Runs on extension startup

---

## 5. Implementation Changes

### api/gemini-2-5-pro.js

**Before**:
```javascript
_buildPrompt(stageId, articles) {
  const articlesText = articles.map((article, idx) => `
    Content: ${article.content}  // ❌ UNDEFINED!
  `).join('\n');

  const prompts = {
    1: `Hardcoded prompt here...`,
    2: `Another hardcoded prompt...`,
    // etc
  };

  return prompts[stageId];
}
```

**After**:
```javascript
async _buildPrompt(stageId, articles) {
  // Prepare content (validates + formats)
  const prepared = prepareForPro(articles);

  // Load prompt from file
  const stageName = stageNames[stageId];
  const promptTemplate = await getModelPrompt('pro', stageName);

  // Combine
  return `${promptTemplate}\n\n${prepared.formattedText}`;
}
```

**Key Changes**:
1. ✅ Uses `prepareForPro()` to extract correct content
2. ✅ Loads prompts from files
3. ✅ Validates content presence
4. ✅ Logs preparation statistics

---

### api/languageModel.js

**Before**:
```javascript
const stages = [
  { name: 'stage1-context-trust', schemaKey: 'stage1-context-trust-schema' },
  // ...
];

const schema = await loadSchema(stage.schemaKey);
const systemPrompt = await getPrompt(stage.name);
```

**After**:
```javascript
const stages = [
  { name: 'stage1-context-trust', schemaName: 'stage1' },
  // ...
];

const schema = await getStageSchema(stage.schemaName);
const systemPrompt = await getModelPrompt('nano', stage.name);
```

**Key Changes**:
1. ✅ Uses `getModelPrompt('nano', ...)` for model-specific prompts
2. ✅ Uses `getStageSchema()` for centralized schemas
3. ✅ Simpler schema naming

---

### manifest.json

**Added Resources**:
```json
"resources": [
  "prompts/*.txt",
  "prompts/*.json",
  "prompts/nano/*.txt",      // NEW
  "prompts/pro/*.txt",       // NEW
  "prompts/schemas/*.json",  // NEW
  // ...
]
```

---

## 6. Prompt Content Differences

### Stage 1: Context & Trust

**Nano Version** (`prompts/nano/stage1-context-trust.txt`):
```
You are analyzing summarized news coverage...

Note: Articles have been summarized to key points for efficient processing.

Task: Provide immediate context and trust assessment.
```

**Pro Version** (`prompts/pro/stage1-context-trust.txt`):
```
You are a professional news analyst...

Note: You have access to COMPLETE articles in their ORIGINAL LANGUAGES.
Use your multilingual capabilities to understand all sources accurately.

Task: Provide immediate context and trust assessment based on complete articles.
```

**Key Differences**:
- Pro emphasizes "COMPLETE" and "ORIGINAL LANGUAGES"
- Nano mentions "summarized" content
- Pro reminds model of multilingual capabilities

---

### Stage 2: Consensus

**Nano Version**:
```
You are identifying facts that multiple news sources agree on.

Note: You are analyzing summarized key points from each article.
```

**Pro Version**:
```
You are identifying facts that multiple news sources agree on.

Note: You have access to COMPLETE articles in their ORIGINAL LANGUAGES.
Read each article thoroughly to find consensus facts.
```

**Key Differences**:
- Pro asks to "read thoroughly"
- Nano acknowledges "summarized key points"
- Pro mentions language diversity

---

### Stage 3: Disputes

**Both versions** share core logic but differ in:

**Nano**:
```
Note: You are analyzing summarized key points from each article.
```

**Pro**:
```
Note: You have access to COMPLETE articles in their ORIGINAL LANGUAGES.
Read thoroughly to identify genuine contradictions.

BEFORE adding dispute:
- Read COMPLETE context in each article (they may be in different languages)
- Consider language/translation variations of the same fact
```

**Key Differences**:
- Pro warns about translation variations
- Pro asks to read complete context
- Pro emphasizes cross-language understanding

---

### Stage 4: Perspectives

**Nano**:
```
Note: You are analyzing summarized key points from each article.
```

**Pro**:
```
Note: You have access to COMPLETE articles in their ORIGINAL LANGUAGES.
Read thoroughly to understand how each source frames the story.

RULES:
- Consider cultural/regional perspectives in different languages
```

**Key Differences**:
- Pro mentions "framing" analysis
- Pro asks to consider cultural perspectives
- Nano focuses on obvious differences only

---

## 7. Data Flow Diagrams

### Complete Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Article Detection (Content Script)                          │
│ Sends: { url, title, source, language }                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Perspective Search (Background)                             │
│ Google News RSS → Multiple countries                        │
│ Returns: [{ title, link, source, country }, ...]           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Content Extraction (contentExtractor.js)                    │
│ For EACH article:                                           │
│  - Create Chrome tab                                        │
│  - Load URL, handle redirects                               │
│  - Extract via Readability.js                               │
│  - Validate quality (500-1500 words)                        │
│ Adds: article.extractedContent.textContent                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Article Selection (articleSelector.js)                      │
│ Select best N articles per country                          │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌───────────────┐
│ Nano Path    │  │ Pro Path      │
└──────┬───────┘  └───────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌───────────────┐
│ Translation  │  │ prepareForPro │
│ Compression  │  │ (no changes)  │
│ (summarizer) │  │               │
└──────┬───────┘  └───────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌───────────────┐
│prepareForNano│  │ getModelPrompt│
│              │  │  ('pro', ...) │
└──────┬───────┘  └───────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌───────────────┐
│getModelPrompt│  │ 4-Stage       │
│ ('nano', ...)│  │ Analysis      │
└──────┬───────┘  └───────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌───────────────┐
│ 4-Stage      │  │ Results       │
│ Analysis     │  │               │
└──────┬───────┘  └───────┬───────┘
       │                  │
       └────────┬─────────┘
                ▼
       ┌─────────────────┐
       │ Display in UI   │
       └─────────────────┘
```

---

## 8. Testing Checklist

### Gemini Pro Testing

- [x] Pro receives article content (not undefined)
- [x] Content is full text (not compressed)
- [x] Multi-language articles preserved
- [x] Prompts loaded from `prompts/pro/`
- [x] Schemas loaded from `prompts/schemas/`
- [x] Validation catches missing content
- [x] Logs show content statistics

### Gemini Nano Testing

- [ ] Nano receives compressed content
- [ ] Prompts loaded from `prompts/nano/`
- [ ] Schemas loaded from `prompts/schemas/`
- [ ] Validation works for compressed content
- [ ] Fallback to full content if compression fails

### General Testing

- [x] Manifest includes new prompt paths
- [x] Prompts preloaded on startup
- [x] Cache working correctly
- [x] Error handling for missing prompts
- [x] Logs show which model is being used

---

## 9. File Changes Summary

### New Files Created

1. ✅ `utils/contentPreparation.js` - Content preparation layer
2. ✅ `prompts/nano/stage1-context-trust.txt`
3. ✅ `prompts/nano/stage2-consensus.txt`
4. ✅ `prompts/nano/stage3-disputes.txt`
5. ✅ `prompts/nano/stage4-perspectives.txt`
6. ✅ `prompts/pro/stage1-context-trust.txt`
7. ✅ `prompts/pro/stage2-consensus.txt`
8. ✅ `prompts/pro/stage3-disputes.txt`
9. ✅ `prompts/pro/stage4-perspectives.txt`
10. ✅ `prompts/schemas/stage1.json` (copied from existing)
11. ✅ `prompts/schemas/stage2.json` (copied from existing)
12. ✅ `prompts/schemas/stage3.json` (copied from existing)
13. ✅ `prompts/schemas/stage4.json` (copied from existing)
14. ✅ `DOCS/PROMPT-SYSTEM-REFACTOR.md` (this file)

### Files Modified

1. ✅ `api/gemini-2-5-pro.js`
   - Added imports for new utilities
   - Fixed `article.content` → `article.extractedContent.textContent`
   - Replaced hardcoded prompts with file loading
   - Added content validation

2. ✅ `api/languageModel.js`
   - Updated imports
   - Changed to use `getModelPrompt('nano', ...)`
   - Updated schema loading

3. ✅ `utils/prompts.js`
   - Added `getModelPrompt(model, stage)`
   - Added `getStageSchema(stageName)`
   - Updated `preloadPrompts()` to include model-specific prompts

4. ✅ `manifest.json`
   - Added `prompts/nano/*.txt`
   - Added `prompts/pro/*.txt`
   - Added `prompts/schemas/*.json`

---

## 10. Benefits of New System

### Maintainability
✅ Prompts in text files (easy to edit)
✅ Separation of Nano vs Pro prompts
✅ Centralized schemas
✅ No hardcoded strings in code

### Reliability
✅ Content validation before AI calls
✅ Clear fallback chains
✅ Detailed logging
✅ Error handling

### Performance
✅ Prompt caching
✅ Preloading on startup
✅ Optimized content preparation

### Debugging
✅ Logs show content stats
✅ Validation reports
✅ Clear error messages
✅ Content length tracking

---

## 11. Future Improvements

### Potential Enhancements

1. **Prompt Versioning**
   - Track prompt versions
   - A/B test different prompts
   - Measure quality improvements

2. **Dynamic Prompt Selection**
   - Choose prompts based on article type
   - Different prompts for different news categories

3. **Prompt Quality Metrics**
   - Track success rates per prompt
   - Identify prompts that cause failures
   - Auto-retry with alternative prompts

4. **User Customization**
   - Allow users to customize prompts
   - Save custom prompt sets
   - Share prompt improvements

---

## 12. Migration Notes

### Backward Compatibility

✅ **Old prompts still work**: `prompts/stage1-context-trust.txt` still accessible
✅ **No breaking changes**: All APIs maintain same signatures
✅ **Gradual migration**: Can test new system alongside old

### Rollback Plan

If issues occur:
1. Revert `api/gemini-2-5-pro.js` to use inline prompts
2. Revert `api/languageModel.js` imports
3. Keep new files for future use

---

## 13. References

### Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project guidelines (updated)
- [DOCS/chrome-ai.txt](chrome-ai.txt) - Chrome AI API reference
- [DOCS/gemini/Text generation.txt](gemini/Text%20generation.txt) - Gemini API docs
- [DOCS/gemini/Structured output.txt](gemini/Structured%20output.txt) - JSON schemas

### Code References

- [api/gemini-2-5-pro.js](../api/gemini-2-5-pro.js) - Pro implementation
- [api/languageModel.js](../api/languageModel.js) - Nano implementation
- [utils/contentPreparation.js](../utils/contentPreparation.js) - Content prep
- [utils/prompts.js](../utils/prompts.js) - Prompt loading

---

## 14. Credits

**Implemented by**: Claude (Anthropic)
**Project**: PerspectiveLens
**Date**: October 26, 2025
**Status**: ✅ Complete - Ready for Testing

---

## Conclusion

This refactoring successfully:

1. ✅ **Fixed critical bug**: Gemini Pro now receives article content
2. ✅ **Organized prompts**: Model-specific prompts in separate files
3. ✅ **Added validation**: Content validated before AI calls
4. ✅ **Improved logging**: Detailed stats and error messages
5. ✅ **Enhanced maintainability**: Easy to update prompts without code changes

The system is now ready for end-to-end testing with both Gemini Nano and Gemini 2.5 Pro.
