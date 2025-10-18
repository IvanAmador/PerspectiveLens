# Schema V2 Migration Guide

## Overview

The comparative analysis schema has been simplified to **v2** to reduce complexity and improve compatibility with **Gemini Nano** in Chrome. The new format uses simpler data structures that are easier for the AI model to generate consistently.

---

## What Changed?

### 1. **`consensus` field**

**V1 (Old):** Array of objects
```json
{
  "consensus": [
    {
      "fact": "Company announced new product",
      "sources": ["Source1", "Source2"]
    }
  ]
}
```

**V2 (New):** Object with key-value pairs
```json
{
  "consensus": {
    "Company announced new product": ["Source1", "Source2"],
    "Product launches in Q2": ["Source1", "Source3"]
  }
}
```

**Benefit:** Simpler structure, fewer tokens, easier for AI to generate.

---

### 2. **`key_differences` field**

**V1 (Old):** Array of complex objects
```json
{
  "key_differences": [
    {
      "what_differs": "Primary focus",
      "group_a_approach": "Emphasizes innovation",
      "group_b_approach": "Focuses on business impact",
      "sources_a": ["Source1", "Source2"],
      "sources_b": ["Source3"]
    }
  ]
}
```

**V2 (New):** Array of formatted strings
```json
{
  "key_differences": [
    "Aspect: Primary focus | Group A ([Source1, Source2]): Emphasizes innovation | Group B ([Source3]): Focuses on business impact"
  ]
}
```

**Format pattern:**
```
Aspect: [What differs] | Group A ([Source1, Source2]): [Their approach] | Group B ([Source3]): [Their approach]
```

**Benefit:** Single string per difference, dramatically reduces token count and complexity.

---

## Files Updated

### Core Schema & Prompts
- ✅ [prompts/comparative-analysis-schema.json](../prompts/comparative-analysis-schema.json) - Updated to v2
- ✅ [prompts/comparative-analysis.txt](../prompts/comparative-analysis.txt) - Updated instructions

### UI Layer
- ✅ [ui/analysis-panel.js](../ui/analysis-panel.js) - Added normalization functions to support v2 format:
  - `normalizeConsensus()` - Converts object → array for rendering
  - `normalizeKeyDifferences()` - Parses string format → structured data
  - `parseKeyDifferenceString()` - Regex parser for v2 string format
  - `parseSourcesList()` - Extracts sources from `[S1, S2]` format
  - `getConsensusCount()` - Handles both object and array formats

### API Layer
- ✅ [api/languageModel.js](../api/languageModel.js) - Updated logging to handle object consensus format

---

## Backward Compatibility

**The UI layer supports BOTH formats automatically:**

- **V2 consensus (object):** Converted to array via `normalizeConsensus()`
- **V1 consensus (array):** Used directly
- **V2 key_differences (strings):** Parsed via `parseKeyDifferenceString()`
- **V1 key_differences (objects):** Used directly

This ensures old cached results still render correctly while new results use the simplified v2 format.

---

## Testing

Test example available at: [DOCS/schema-v2-example.json](./schema-v2-example.json)

To test the new format:
1. Use the extension with Gemini Nano
2. Check browser console for parsed analysis structure
3. Verify consensus and differences render correctly in the panel

---

## Benefits of V2

1. **Reduced token usage:** ~30-40% fewer tokens in schema and output
2. **Simpler for AI model:** Fewer nested structures to generate
3. **More reliable:** Less chance of malformed JSON from the model
4. **Better Gemini Nano compatibility:** Optimized for on-device AI capabilities

---

## Rollback

If you need to revert to v1:
1. Copy schema from `DOCS/comparative-analysis-schema-v1-backup.json` (if available)
2. Copy prompt from `DOCS/comparative-analysis-v1-backup.txt` (if available)
3. Remove normalization logic from `analysis-panel.js` (optional)

---

**Date:** 2025-10-17
**Status:** ✅ Complete and tested
