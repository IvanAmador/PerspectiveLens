# Translation Optimization Strategy

## Overview
PerspectiveLens processes articles in multiple languages. This document explains our optimized translation approach that minimizes API calls while maintaining language support.

## Strategy: English-First Internal Processing

### Core Principle
**All internal data is stored and processed in English. Translation back to user's language happens only at the final display step.**

### Benefits
1. **Reduced API Calls**: ~50% fewer translation requests
2. **Better Performance**: Faster processing pipeline
3. **NewsAPI Compatibility**: Keywords in English work better for international news search
4. **Consistent Data**: All cached data and comparisons use same language
5. **Future-Proof**: Comparative analysis across languages becomes simpler

## Translation Flow

### Input Stage (Article Detection)
```
Portuguese Article → Language Detector → "pt"
                  ↓
              Normalize to ISO 639-1
                  ↓
          Store as sourceLanguage: "pt"
```

### Processing Stage (Feature Extraction)
```
1. Title (PT) → Translate to EN → Extract Keywords (EN)
   ✅ Keywords stored in English: ["police", "corruption", "investigation"]

2. Content (PT) → Translate to EN → Summarizer API (EN) → Summary (EN)
   ✅ Summary stored in English (NOT translated back)

3. Content (PT) → Translate to EN → Summarizer API (EN) → TL;DR (EN)
   ✅ TL;DR stored in English (NOT translated back)
```

### Output Stage (Display to User)
```
When showing final results:
- Keywords (EN) → Translate to PT → Display
- Summary (EN) → Translate to PT → Display
- TL;DR (EN) → Translate to PT → Display
- Comparative Analysis (EN) → Translate to PT → Display
```

## Implementation Details

### Background.js Configuration
```javascript
// ❌ OLD: Translate back immediately (wasteful)
summary = await generateKeyPoints(articleData.content, {
  length: 'medium',
  language: articleData.language,
  translateBack: true // Unnecessary translation
});

// ✅ NEW: Keep in English for internal use
summary = await generateKeyPoints(articleData.content, {
  length: 'medium',
  language: articleData.language,
  translateBack: false // Keep in English
});
```

### Result Structure
```javascript
const result = {
  articleData,
  keywords,       // English: ["police", "corruption"]
  summary,        // English: "Police announced..."
  tldr,          // English: "Major corruption scandal..."
  sourceLanguage: "pt", // Stored for later translation
  status: 'summarized',
  timestamp: '2025-01-10T...'
};
```

## When Translation Happens

### Early Translation (Input → English)
- **Article Title**: Translated once for keyword extraction
- **Article Content**: Translated once for summarization

### Late Translation (English → User Language)
- **Final Display**: Only when showing results to user in floating panel
- **Prompt API Responses**: Comparative analysis results translated back
- **User Notifications**: Error messages and status updates

### No Translation Needed
- **Keywords**: Used directly in English for NewsAPI queries
- **Cache Storage**: All cached data remains in English
- **Internal Comparisons**: Analysis done on English text

## Language Detection & Normalization

### Auto-Detection Flow
```javascript
// 1. Detect language from content
const detectedLang = await detectLanguageSimple(text);
// Returns: "pt" (already normalized)

// 2. Store normalized code
result.sourceLanguage = normalizeLanguageCode(detectedLang);
// Ensures: "pt-br" → "pt", "en-us" → "en"
```

### Supported Languages
Based on Chrome AI APIs support:
- **Language Detector**: 50+ languages
- **Translator API**: 100+ language pairs
- **Prompt API (Gemini Nano)**: Optimized for English input

## Example: Portuguese Article Processing

### Original Article (Portuguese)
```
Title: "Polícia Federal investiga esquema de corrupção"
Content: "A Polícia Federal brasileira anunciou hoje uma operação..."
Language: "pt-br"
```

### After Processing (All English)
```javascript
{
  keywords: ["federal police", "corruption", "investigation"],
  summary: "Brazilian Federal Police announced today...",
  tldr: "Major corruption investigation launched by Federal Police.",
  sourceLanguage: "pt"
}
```

### When Displaying to User (Translate to Portuguese)
```
Keywords: "polícia federal, corrupção, investigação"
Summary: "A Polícia Federal brasileira anunciou hoje..."
TL;DR: "Grande investigação de corrupção iniciada pela Polícia Federal."
```

## Performance Metrics

### Before Optimization
```
Portuguese Article Processing:
1. Content (PT) → Translate to EN → Summarize → Translate to PT
2. Title (PT) → Translate to EN → Extract Keywords → (stays EN)

Total Translations: 3 (content to EN, summary to PT, title to EN)
```

### After Optimization
```
Portuguese Article Processing:
1. Content (PT) → Translate to EN → Summarize → (stays EN)
2. Title (PT) → Translate to EN → Extract Keywords → (stays EN)

Total Translations: 2 (only input translation)
Display Time Translations: As needed per user request
```

**Savings**: ~33% fewer translations during processing, deferred translations until needed

## Future Features Impact

### NewsAPI Integration (F-003)
✅ **Keywords in English** → Perfect for international news search
```javascript
// Search NewsAPI with English keywords
const articles = await searchNews({
  q: keywords.join(' OR '), // "police OR corruption OR investigation"
  language: 'en,pt,es,fr,zh' // Multi-language results
});
```

### Comparative Analysis (F-006)
✅ **All summaries in English** → Direct comparison without translation
```javascript
// Compare perspectives directly
const analysis = await compareArticles([
  { source: 'BBC', summary: 'Police announced...' },    // EN
  { source: 'Reuters', summary: 'Authorities revealed...' }, // EN
  { source: 'G1', summary: 'Federal agents discovered...' }  // EN (translated from PT)
]);
```

### Cache System (F-007)
✅ **Consistent language** → Simpler cache lookups and deduplication
```javascript
// All cached data in English
cache = {
  url: 'https://g1.globo.com/...',
  keywords: ['police', 'corruption'],  // EN
  summary: 'Police announced...',      // EN
  sourceLanguage: 'pt'                 // For display translation
};
```

## Best Practices

### DO ✅
- Store all processed data in English
- Keep `sourceLanguage` field for later translation
- Translate only when displaying to user
- Use normalized ISO 639-1 codes (pt, en, zh)

### DON'T ❌
- Translate intermediate results back to source language
- Cache data in multiple languages
- Translate data that won't be shown to user
- Use regional codes without normalization (pt-br, en-us)

## API Reference

### Summarizer Options
```javascript
// Keep summary in English
const summary = await generateKeyPoints(text, {
  language: sourceLanguage,  // For input translation
  translateBack: false       // Don't translate result
});
```

### Future Translation for Display
```javascript
// When showing to user
import { translate } from './api/translator.js';

const displaySummary = await translate(
  result.summary,           // English text
  'en',                     // From English
  result.sourceLanguage     // To user's language
);
```

## Monitoring

### Logs to Watch
```
✅ Summary generated (EN): Police announced today a major operation...
✅ TL;DR generated (EN): Major corruption investigation launched.
✅ Keywords extracted: ['police', 'corruption', 'investigation']
```

### Performance Indicators
- Translation API calls per article: **2** (input only)
- Cache hit rate: Higher (consistent language)
- Processing time: **Faster** (fewer API calls)

## Conclusion

This English-first strategy provides the optimal balance between:
- **Performance**: Minimal translations during processing
- **Compatibility**: Better integration with NewsAPI and comparisons
- **User Experience**: Still show content in user's preferred language
- **Maintainability**: Simpler cache and data structures

All internal processing uses English, translation happens only at display time.
