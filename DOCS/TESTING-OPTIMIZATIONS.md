# 🧪 Testing Optimizations Guide

**How to test and verify the performance optimizations in PerspectiveLens**

---

## 🎯 Testing Checklist

### Phase 1: Content Validation Testing

**Goal:** Verify that JavaScript/invalid content is properly filtered

#### Test 1.1: Valid Content
```javascript
// In DevTools Console (background service worker)
import { validateArticleContent } from './utils/contentValidator.js';

const validText = `
Breaking news: The government announced new climate policies today.
The policy includes investments in renewable energy and carbon reduction targets.
Environmental groups praised the move while industry representatives expressed concerns.
`;

const result = validateArticleContent(validText, 'Test Article');
console.log(result);
// Expected: { valid: true, score: 0.7-0.9, ... }
```

#### Test 1.2: Invalid Content (JavaScript)
```javascript
const invalidText = `
window.wiz_progress&&window.wiz_progress();
function() { var x = 10; console.log(x); }
const app = new Vue({ data: {} });
`;

const result = validateArticleContent(invalidText, 'Invalid Test');
console.log(result);
// Expected: { valid: false, reason: 'High JS pattern ratio...', ... }
```

#### Test 1.3: Filter Array of Articles
```javascript
import { filterValidArticles } from './utils/contentValidator.js';

const testArticles = [
  {
    source: 'Good Source',
    extractedContent: {
      textContent: 'Valid article with proper news content...'
    }
  },
  {
    source: 'Bad Source',
    extractedContent: {
      textContent: 'window.wiz_progress();function(){...}'
    }
  }
];

const filtered = filterValidArticles(testArticles);
console.log(`Kept ${filtered.length}/${testArticles.length} articles`);
// Expected: Kept 1/2 articles
```

---

### Phase 2: Compression Testing

**Goal:** Verify Summarizer API reduces content by 70-80%

#### Test 2.1: Single Article Compression
```javascript
import { compressForAnalysis } from './api/summarizer.js';

const longArticle = `
[Paste a full news article here - 3000+ characters]
`;

console.log('Original length:', longArticle.length);

const compressed = await compressForAnalysis(longArticle, {
  source: 'Test Article',
  length: 'medium'
});

console.log('Compressed length:', compressed.length);
console.log('Reduction:', ((1 - compressed.length / longArticle.length) * 100).toFixed(1) + '%');
// Expected: 70-80% reduction
```

#### Test 2.2: Batch Compression
```javascript
import { batchCompressForAnalysis } from './api/summarizer.js';

const testArticles = [
  { source: 'BBC', extractedContent: { textContent: 'Long article 1...' } },
  { source: 'CNN', extractedContent: { textContent: 'Long article 2...' } },
  { source: 'Reuters', extractedContent: { textContent: 'Long article 3...' } }
];

const compressed = await batchCompressForAnalysis(testArticles, {
  length: 'medium'
});

compressed.forEach(article => {
  console.log(`${article.source}: ${article.originalLength} → ${article.compressedLength} (${article.compressionRatio}% reduction)`);
});
```

---

### Phase 3: End-to-End Analysis Testing

**Goal:** Verify full pipeline works with optimizations

#### Test 3.1: Analyze Real Articles

1. **Navigate to a news article** (e.g., BBC News, NYTimes)
2. **Open DevTools** → Console → Select "Service Worker" context
3. **Monitor logs** for analysis pipeline:

```
Expected log sequence:
✓ [PerspectiveLens] 🔍 Processing new article
✓ [PerspectiveLens] ✅ Keywords extracted: [...]
✓ [PerspectiveLens] ✅ Found 10 perspectives
✓ [PerspectiveLens] ✅ Extracted content from 8/10 articles
✓ [PerspectiveLens] 🔍 Starting OPTIMIZED comparative analysis
✓ [PerspectiveLens] 📋 Step 1: Validating content quality...
✓ [PerspectiveLens] ✅ Validation: 6/8 articles passed
✓ [PerspectiveLens] 🗜️ Step 2: Compressing articles...
✓ [PerspectiveLens] ✅ Compression: 28500 → 5700 chars (80% reduction)
✓ [PerspectiveLens] 📝 Step 3: Preparing input...
✓ [PerspectiveLens] ✅ Input prepared: 6200 chars for 6 articles
✓ [PerspectiveLens] 🤖 Step 6: Running analysis with Gemini Nano...
✓ [PerspectiveLens] ✅ Analysis completed successfully
✓ [PerspectiveLens] Consensus: 5 points
✓ [PerspectiveLens] Disputes: 3 topics
✓ [PerspectiveLens] Omissions: 2 sources
```

#### Test 3.2: Compare Different Configurations

**Configuration A: Maximum Optimization**
```javascript
// In background.js, modify compareArticles options:
{
  useCompression: true,
  validateContent: true,
  maxArticles: 5,
  compressionLevel: 'short',
  useV2Prompt: false
}
// Expected: Fast, high success rate, less detailed
```

**Configuration B: Balanced (Default)**
```javascript
{
  useCompression: true,
  validateContent: true,
  maxArticles: 8,
  compressionLevel: 'medium',
  useV2Prompt: true
}
// Expected: Good speed, high success rate, good detail
```

**Configuration C: Maximum Quality**
```javascript
{
  useCompression: true,
  validateContent: true,
  maxArticles: 10,
  compressionLevel: 'long',
  useV2Prompt: true
}
// Expected: Slower, may have more failures, most detailed
```

**Configuration D: No Optimization (Baseline)**
```javascript
{
  useCompression: false,
  validateContent: false,
  maxArticles: 3,  // MUST be low!
  useV2Prompt: false
}
// Expected: High failure rate, serves as baseline
```

---

### Phase 4: Performance Metrics Collection

#### Test 4.1: Success Rate Over Multiple Articles

Create a test script to analyze 20 different news articles:

```javascript
// test-success-rate.js
const testUrls = [
  'https://www.bbc.com/news/...',
  'https://www.nytimes.com/...',
  // ... 18 more URLs
];

let successes = 0;
let failures = 0;

for (const url of testUrls) {
  try {
    // Trigger analysis
    // Check if comparativeAnalysis.error === false
    if (!analysis.error) {
      successes++;
    } else {
      failures++;
    }
  } catch (error) {
    failures++;
  }
}

console.log(`Success Rate: ${(successes / testUrls.length * 100).toFixed(1)}%`);
// Target: > 85%
```

#### Test 4.2: Timing Benchmarks

```javascript
const startTime = performance.now();

// Run full analysis
await compareArticles(articles, {...});

const endTime = performance.now();
console.log(`Analysis time: ${((endTime - startTime) / 1000).toFixed(2)}s`);

// Targets:
// - With compression: 12-18s
// - Without compression: 8-12s (when successful)
```

---

## 📊 Expected Results

### Content Validation

| Test | Pass Criteria |
|------|---------------|
| Valid article | `valid: true`, `score > 0.6` |
| JavaScript content | `valid: false`, reason mentions JS |
| Short text | `valid: false`, reason mentions length |
| Filter function | Removes 20-30% of bad articles |

### Compression

| Test | Pass Criteria |
|------|---------------|
| Single article (3000 chars) | Compressed to 600-900 chars (70-80% reduction) |
| Batch (5 articles) | All compressed successfully |
| Short article (<500 chars) | Skipped compression (returned as-is) |

### End-to-End Analysis

| Configuration | Success Rate | Avg Time | Detail Level |
|---------------|--------------|----------|--------------|
| Max Optimization | >90% | 10-15s | Medium |
| Balanced (Default) | 85-95% | 12-18s | High |
| Max Quality | 75-85% | 15-25s | Very High |
| No Optimization | 10-20% | 8-12s* | N/A |

*When successful

---

## 🐛 Common Test Failures

### Issue: Validation passes bad content

**Debug:**
```javascript
import { validateArticleContent } from './utils/contentValidator.js';
const result = validateArticleContent(suspiciousText, 'Debug');
console.log('Validation details:', result);
```

**Fix:** Adjust thresholds in `utils/contentValidator.js`

### Issue: Compression fails

**Debug:**
```javascript
// Check Summarizer availability
import { checkSummarizerAvailability } from './api/summarizer.js';
const availability = await checkSummarizerAvailability();
console.log('Summarizer status:', availability);
// Should be: 'readily' or 'after-download'
```

### Issue: Analysis still fails after optimization

**Debug:**
```javascript
// Check input length
console.log('Input length:', analysis.metadata.totalInputLength);
// Should be: < 8000 chars

// Check article count
console.log('Articles analyzed:', analysis.metadata.articlesAnalyzed);
// Should be: ≤ maxArticles setting
```

---

## 📝 Test Report Template

After testing, document results:

```markdown
## Test Results - [Date]

### Configuration Tested
- useCompression: true/false
- validateContent: true/false
- maxArticles: X
- compressionLevel: short/medium/long

### Results
- Total articles tested: X
- Successful analyses: X (X%)
- Failed analyses: X (X%)
- Average input length: X chars
- Average time: X seconds

### Issues Found
1. [Description]
2. [Description]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

---

## 🎯 Optimization Verification

✅ **Optimizations are working correctly if:**

1. **Content Validation**
   - 20-30% of articles filtered (some have bad content)
   - No JavaScript patterns in final input
   - Validation scores logged for each article

2. **Compression**
   - 70-80% size reduction observed
   - Compression time < 5s per article
   - Fallback to truncation if compression fails

3. **Analysis Success**
   - Success rate > 85%
   - Input length consistently < 8000 chars
   - Metadata confirms optimizations used

4. **Output Quality**
   - Consensus points identified (3-8 typical)
   - Disputes clearly described
   - Omissions tracked per source
   - Summary coherent and accurate

---

## 🔄 Iterative Testing Process

1. **Baseline Test** (No optimizations)
   - Record success rate, failures, common errors

2. **Enable Validation Only**
   - Compare success rate improvement
   - Check filtered article count

3. **Enable Compression Only**
   - Compare token reduction
   - Check analysis quality

4. **Enable Both (Full Optimization)**
   - Verify maximum success rate
   - Confirm both systems work together

5. **Tune Parameters**
   - Adjust `maxArticles`, `compressionLevel`
   - Find sweet spot for your use case

---

**Happy Testing! 🚀**
