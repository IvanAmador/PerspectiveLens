# PerspectiveLens - Product Requirements Document

**Version:** 1.0  
**Last Updated:** October 2025  
**Status:** Source of Truth  
**Project:** Chrome Built-in AI Challenge 2025  
**Target:** Best Hybrid AI Application ($9,000 prize)

---

## 1. Executive Summary

### Product Vision
Chrome Extension que revela como a mesma notícia é reportada globalmente, usando Chrome Built-in AI para tradução, resumo e análise comparativa — com modelo híbrido online/offline.

### The Problem
- Leitores consomem notícias de fonte única sem perceber viés regional
- Barreiras linguísticas impedem acesso a perspectivas internacionais
- Falta de perspectivas não-ocidentais (China, mundo árabe) cria blind spots
- Soluções existentes (Ground News, AllSides) custam $10-15/mês e requerem cloud
- Dados sensíveis (histórico de leitura) vão para servidores externos

**Example:** Notícia sobre "acordo climático" pode ser reportada como:
- NYT: Foco em custos econômicos para empresas americanas
- BBC: Foco em metas de redução de carbono
- Xinhua: Foco em cooperação global e papel da China
- Al Jazeera: Foco em impacto em países em desenvolvimento
- Sem ferramenta = leitor vê apenas 1 perspectiva

### The Solution
Extension que automaticamente:
1. Detecta artigos de notícias
2. Busca mesma história em fontes internacionais (NewsAPI)
3. Traduz perspectivas localmente (Chrome AI)
4. Resume cada perspectiva (Chrome AI)
5. Compara e destaca diferenças (Chrome AI)
6. Cache para reuso offline

### Success Criteria
- ✅ Usa 4 Chrome Built-in AI APIs
- ✅ Processa 5 perspectivas em <15 segundos
- ✅ Tradução e análise funcionam offline (após modelos baixados)
- ✅ Busca de notícias requer internet (NewsAPI)
- ✅ Cache permite revisitar análises offline

---

## 2. Target Audience

### Primary Personas

**Laura - Jornalista Investigativa (28 anos)**
- Needs: Verificar como mídia internacional cobre eventos locais
- Pain: Gasta horas traduzindo manualmente
- Goal: Identificar ângulos não cobertos pela mídia nacional
- Usage: 10-15 análises/dia

**Dr. Chen - Professor de Relações Internacionais (45 anos)**
- Needs: Ensinar pensamento crítico sobre mídia
- Pain: Preparar comparações manuais para aula
- Goal: Mostrar framing diferente em tempo real
- Usage: 3-5 análises/semana para aulas

**Miguel - Investidor (32 anos)**
- Needs: Ver reações de mercados internacionais
- Pain: Notícias financeiras têm delay regional
- Goal: Antecipar movimentos de mercado
- Usage: 20-30 análises/dia durante trading hours

---

## 3. Technical Architecture

### 3.1 High-Level Architecture

```
User reads news → Content Script detects article
                      ↓
              Background Service Worker
                      ↓
        ┌─────────────┴─────────────┐
        ↓                           ↓
   NewsAPI.org              Chrome Built-in AI APIs
   (requires internet)      (offline after download)
        ↓                           ↓
   Fetch 5 perspectives    Translate → Summarize → Compare
        ↓                           ↓
        └───────────┬───────────────┘
                    ↓
              IndexedDB Cache
                    ↓
         Perspective Panel UI
```

### 3.2 Connectivity Model

**REQUIRES INTERNET:**
- ✅ First-time analysis (NewsAPI call)
- ✅ Finding international perspectives
- ✅ News search and discovery

**WORKS OFFLINE:**
- ✅ Translation (after AI models downloaded)
- ✅ Summarization (after AI models downloaded)
- ✅ Comparative analysis (after AI models downloaded)
- ✅ Viewing cached analyses
- ✅ Re-analyzing cached articles

**MODEL:** Hybrid Online/Offline

---

## 4. Feature Specifications

### F-001: News Article Detection

**Description:** Automatically detect when user is reading a news article

**Stack:**
- Content Script (JavaScript ES2022)
- Heuristic analysis (no external dependencies)
- DOM parsing (native APIs)

**Triggers:**
- Page load on news domains
- URL pattern matching
- Metadata detection (`<meta property="article:*">`)

**Detection Logic:**
```
Score = 0
+ 2 points if domain in whitelist (bbc.com, nytimes.com, etc.)
+ 2 points if has news metadata (article:published_time, etc.)
+ 1 point if has article structure (h1, article, time tags)
+ 1 point if content has news patterns ("reported", "announced")

If score >= 3: Is News Article
```

**Whitelisted Domains (25 sources):**
- Brasil: g1.globo.com, folha.uol.com.br, estadao.com.br, uol.com.br
- USA: nytimes.com, cnn.com, washingtonpost.com, reuters.com
- UK: bbc.com, theguardian.com
- International: aljazeera.com, apnews.com
- Europe: lemonde.fr, elpais.com, spiegel.de
- China: xinhuanet.com, chinadaily.com.cn, globaltimes.cn, peopledaily.com.cn
- Asia (other): scmp.com, straitstimes.com, japantimes.co.jp
- LATAM: clarin.com, lanacion.com.ar

**Extracted Data:**
```
{
  url: string,
  title: string,
  content: string (full text),
  publishedDate: Date,
  author: string,
  source: string (domain),
  language: string (detected)
}
```

**Performance Target:** <100ms detection time

**Error Handling:**
- If detection fails: Show manual "Analyze as News" button
- If extraction fails: Fall back to title + first 500 chars

---

### F-002: Keyword Extraction

**Description:** Extract 3-5 key entities/topics from article for search

**Stack:**
- Language Detector API (Chrome 138+)
- Prompt API (Chrome 138+)

**Process:**
1. Detect language of title
2. Send title to Prompt API
3. Extract keywords (entities, locations, events)

**Prompt Template:**
```
Extract 3-5 key entities/topics from this headline.
Output ONLY comma-separated keywords, no explanation.

Headline: {title}
Language: {detectedLanguage}

Examples:
"Brazil approves new climate law" → brazil, climate law, approval
"Tesla CEO announces new factory" → tesla, ceo, factory, announcement
```

**Output Format:**
```
keywords: ["keyword1", "keyword2", "keyword3"]
```

**Performance Target:** <2 seconds

**Error Handling:**
- If Prompt API fails: Use simple word frequency analysis
- Fallback: Extract capitalized words + proper nouns

---

### F-003: Perspective Discovery

**Description:** Search NewsAPI for same story in international sources

**Stack:**
- NewsAPI.org (REST API)
- Background Service Worker (fetch API)

**API Configuration:**
```
Endpoint: https://newsapi.org/v2/everything
Method: GET
Rate Limit: 100 requests/day (free tier)
```

**Search Strategy:**
```
Query 6 geographic/linguistic groups:
1. English/USA (us): NYT, CNN, Washington Post
2. English/UK (gb): BBC, Guardian
3. Chinese/China (cn): Xinhua, Global Times, China Daily, People's Daily
4. Arabic/Middle East (ae): Al Jazeera
5. Spanish/Spain (es): El País
6. French/France (fr): Le Monde

Per query parameters:
- q: {keywords joined with OR}
- from: {article_date - 1 day}
- language: {group language}
- sortBy: relevancy
- pageSize: 2 (top 2 per group)

Note: Total = 12 articles fetched, deduplicated to best 5 for diversity
```

**Deduplication Logic:**
```
For each article:
  key = source_name + first_30_chars_of_title
  if key seen before: skip
  else: add to results

Diversity filter:
  max 1 article per source
  return top 5 by relevancy
```

**Response Format:**
```
[{
  source: string,
  title: string,
  description: string,
  content: string,
  url: string,
  publishedAt: string (ISO),
  language: string (ISO 639-1),
  country: string (ISO 3166-1)
}]
```

**Performance Target:** <5 seconds for all queries

**Error Handling:**
- If 0 results: Show "No international coverage found"
- If <3 results: Show "Limited perspectives available"
- If API fails: Check cache, fallback to offline mode
- If rate limit: Show "Daily quota exceeded, try tomorrow"

---

### F-004: Translation Pipeline

**Description:** Translate non-Portuguese perspectives to Portuguese

**Stack:**
- Language Detector API (Chrome 138+)
- Translator API (Chrome 138+)

**Supported Language Pairs:**
```
Source → Target (pt-BR):
- en (English) → pt
- es (Spanish) → pt
- fr (French) → pt
- de (German) → pt
- ar (Arabic) → pt
- zh (Chinese Simplified) → pt
- ja (Japanese) → pt

Note: Chrome Translator API supports these pairs in Chrome 138+
Priority order for testing: en, zh, ar, es, fr, de, ja
```

**Process per Article:**
```
1. Detect language: LanguageDetector.detect(title)
2. If confidence < 0.7: Skip translation, show original
3. If language === 'pt': Skip translation
4. Create translator: Translator.create({sourceLanguage, targetLanguage: 'pt'})
5. Translate content (first 1000 chars only for performance)
```

**Caching Strategy:**
```
Key: hash(content + sourceLanguage + targetLanguage)
TTL: 7 days
Storage: IndexedDB

Check cache before translating
```

**Performance Target:** <3 seconds per translation

**Error Handling:**
- If translator unavailable: Show original with "(Untranslated)" badge
- If translation fails: Retry once, then show original
- If model not downloaded: Show "Downloading translation model... X%"

---

### F-005: Summarization Pipeline

**Description:** Condense each perspective to 3 key points

**Stack:**
- Summarizer API (Chrome 138+)

**Configuration:**
```
type: 'key-points'
length: 'short' (3 bullet points)
format: 'plain-text'
```

**Input:** Translated content (max 1000 chars)

**Process:**
```
1. Create summarizer session (reuse if exists)
2. Input: translated_content || original_content
3. Output: 3 key points as plain text
```

**Output Format:**
```
"Point 1 about main event. Point 2 about context. Point 3 about implications."
```

**Performance Target:** <2 seconds per summary

**Error Handling:**
- If summarizer fails: Use first 200 chars as fallback
- If result too long: Truncate to 3 sentences
- If model not ready: Show "Preparing summarizer..."

---

### F-006: Comparative Analysis

**Description:** Compare perspectives and identify consensus/disputes

**Stack:**
- Prompt API (Chrome 138+)

**System Prompt:**
```
You are a media analyst. Compare news articles and identify:
1. Facts all sources agree on (CONSENSUS)
2. Facts that differ between sources (DISPUTES)
3. Information only some sources mention (OMISSIONS)

Output JSON only, no explanation.
```

**Input:**
```
Article 1 (NYT, USA):
{summary}

Article 2 (BBC, UK):
{summary}

Article 3 (Xinhua, China):
{summary}

Article 4 (Al Jazeera, Middle East):
{summary}

Article 5 (Le Monde, France):
{summary}
```

**Expected Output:**
```json
{
  "consensus": [
    "All sources confirm event X happened on date Y",
    "All agree on the main participants"
  ],
  "disputes": [
    {
      "topic": "Cause of event",
      "perspectives": {
        "NYT": "Economic pressure",
        "BBC": "Environmental concerns",
        "Xinhua": "International cooperation and mutual benefit",
        "Al Jazeera": "Regional political dynamics"
      }
    }
  ],
  "omissions": {
    "NYT": ["Did not mention local community impact"],
    "Xinhua": ["Omitted criticism from opposition"],
    "BBC": ["Did not cover corporate involvement"]
  }
}
```

**Fallback Parsing:**
If JSON parse fails, extract text sections:
- Look for "consensus:", "all agree", "sources confirm"
- Look for "dispute:", "differ", "disagree"
- Extract as raw text

**Performance Target:** <5 seconds

**Error Handling:**
- If JSON invalid: Show raw analysis text
- If Prompt API fails: Show simple side-by-side, no comparison
- If too slow (>10s): Timeout and show partial results

---

### F-007: Cache Management

**Description:** Store analyses for offline access

**Stack:**
- IndexedDB (via `idb` library)

**Database Schema:**
```
Database: perspectiveLens
Version: 1

Store: analyses
  keyPath: 'id' (auto-increment)
  indexes:
    - 'url' (unique)
    - 'timestamp'
    - 'keywords'

Store: translations
  keyPath: 'hash'
  indexes:
    - 'timestamp'

Store: metadata
  keyPath: 'key'
```

**Data Structure - analyses:**
```
{
  id: number,
  url: string (original article),
  originalArticle: {
    title, content, date, source, language
  },
  keywords: string[],
  perspectives: [{
    source, title, summary, sentiment, url,
    originalLanguage, translatedContent
  }],
  comparison: {
    consensus, disputes, omissions
  },
  timestamp: Date,
  lastAccessed: Date
}
```

**Cache Strategy:**
```
Write:
  - On successful analysis completion
  - Update lastAccessed on each view

Read:
  - Check cache before NewsAPI call
  - If found and age < 24h: Use cache
  - If found and age > 24h: Refresh in background

Eviction:
  - Max 100 analyses stored
  - LRU (Least Recently Used) eviction
  - Manual clear via popup
```

**Performance Target:**
- Write: <100ms
- Read: <50ms

---

### F-008: User Interface

**Description:** Floating panel showing perspectives

**Stack:**
- Vanilla JavaScript (DOM manipulation)
- CSS3 (Grid, Flexbox, Animations)
- No frameworks

**Components:**

**A. Floating Button**
```
Position: Fixed, bottom-right (20px, 20px)
Size: 56px circle
Style: Material Design floating action button
Badge: Shows "5" when perspectives found
States:
  - Idle: Gray, "🌍" icon
  - Detecting: Pulse animation
  - Ready: Blue, badge with count
  - Error: Red, "⚠️" icon
```

**B. Slide-in Panel**
```
Position: Fixed, right side
Size: 400px wide, 80vh height
Animation: Slide from right (300ms ease-out)
Z-index: 999999

Sections:
  1. Header (60px)
     - Title "🌍 Global Perspectives"
     - Close button
  
  2. Original Article Info (80px)
     - "Reading: {title}"
     - "Source: {source} {flag}"
  
  3. Perspectives List (scrollable)
     - 5 perspective cards
  
  4. Comparison Analysis (collapsible)
     - Consensus section
     - Disputes section
     - Omissions section
```

**C. Perspective Card**
```
Layout:
┌─────────────────────────────────┐
│ 🇺🇸 NYT        😊 Positive      │
│─────────────────────────────────│
│ • Key point 1                   │
│ • Key point 2                   │
│ • Key point 3                   │
│─────────────────────────────────│
│ [Read original →]               │
└─────────────────────────────────┘

Examples of diversity:
- 🇺🇸 New York Times (English)
- 🇬🇧 BBC (English)  
- 🇨🇳 Xinhua (Chinese → translated)
- 🇦🇪 Al Jazeera (Arabic → translated)
- 🇫🇷 Le Monde (French → translated)

Border-left color:
  - Green: Sentiment > 0.3
  - Yellow: -0.3 to 0.3
  - Red: < -0.3
```

**D. Loading States**
```
1. "🔍 Detecting article..."
2. "🌐 Searching perspectives... (2/5 found)"
3. "💬 Translating..." (show per article)
4. "📝 Analyzing..."
5. "✅ Ready"
```

**Responsive Design:**
- Min width: 360px
- Max width: 500px
- Mobile: Full screen overlay

**Accessibility:**
- WCAG 2.1 Level AA
- Keyboard navigation (Tab, Enter, Esc)
- Screen reader support (ARIA labels)
- Focus indicators

---

### F-009: Extension Popup

**Description:** Settings and status page

**Stack:**
- HTML5
- Vanilla JavaScript
- CSS3

**Content:**
```
┌──────────────────────────────┐
│   PerspectiveLens            │
├──────────────────────────────┤
│                              │
│  Status: ✅ Ready            │
│  Models: ✅ Downloaded       │
│  API Key: ✅ Configured      │
│                              │
│  Today's Usage:              │
│  ▓▓▓▓▓▓░░░░ 67/100 searches │
│                              │
│  Cache: 47 analyses          │
│  [Clear Cache]               │
│                              │
│  [Configure API Key]         │
│  [View Documentation]        │
│                              │
└──────────────────────────────┘
```

**Functionality:**
- Show API quota usage
- Configure NewsAPI key
- Clear cache
- Link to GitHub docs
- Show version number

---

## 5. Data Flow

### Complete User Journey

```
1. USER ACTION: Opens news article on NYT
   ↓
2. CONTENT SCRIPT: Detects news (F-001)
   ↓
3. CONTENT SCRIPT: Extracts data (F-001)
   ↓
4. CONTENT SCRIPT → SERVICE WORKER: "analyze_article" message
   ↓
5. SERVICE WORKER: Check cache (F-007)
   ↓ (cache miss)
6. SERVICE WORKER: Extract keywords (F-002)
   ↓
7. SERVICE WORKER: Fetch perspectives (F-003) [REQUIRES INTERNET]
   ↓
8. SERVICE WORKER: For each perspective:
   a. Detect language (F-004)
   b. Translate if needed (F-004) [OFFLINE]
   c. Summarize (F-005) [OFFLINE]
   ↓
9. SERVICE WORKER: Compare all (F-006) [OFFLINE]
   ↓
10. SERVICE WORKER: Save to cache (F-007)
    ↓
11. SERVICE WORKER → CONTENT SCRIPT: "analysis_complete" message
    ↓
12. CONTENT SCRIPT: Render UI (F-008)
    ↓
13. USER: Views perspectives, clicks links, closes panel
```

**Total Time Budget:** <15 seconds end-to-end

**Breakdown:**
- Detection + extraction: <0.5s
- Keyword extraction: 2s
- NewsAPI search: 5s
- Translation (5 articles): 3s
- Summarization (5 articles): 2s
- Comparison: 2s
- Render: 0.5s
**TOTAL:** ~15s

---

## 6. Chrome Built-in AI API Usage

### API-001: Language Detector

**When:** F-002 (keywords), F-004 (translation)

**Usage Pattern:**
```
const detector = await ai.languageDetector.create();
const results = await detector.detect(text);
const topLanguage = results[0].detectedLanguage; // ISO 639-1
const confidence = results[0].confidence; // 0.0 - 1.0
```

**Quota Assumptions:**
- Unlimited detections per session
- Instant results (<100ms)

**Error States:**
- API unavailable: Fallback to metadata language
- Low confidence (<0.7): Use 'en' as default

---

### API-002: Translator

**When:** F-004

**Usage Pattern:**
```
const translator = await ai.translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'pt'
});
const translated = await translator.translate(text);
```

**Session Management:**
- Cache translator instances per language pair
- Reuse across multiple translations
- Destroy on extension unload

**Quota Assumptions:**
- Max 10 translations per minute
- Max 5000 chars per translation
- Model auto-downloaded (first use ~100MB)

**Error States:**
- Model downloading: Show progress bar
- Translation timeout (>5s): Use original
- API unavailable: Show original with badge

---

### API-003: Summarizer

**When:** F-005

**Usage Pattern:**
```
const summarizer = await ai.summarizer.create({
  type: 'key-points',
  length: 'short',
  format: 'plain-text'
});
const summary = await summarizer.summarize(text);
```

**Input Constraints:**
- Max 1000 characters input
- Pre-truncate long articles

**Quota Assumptions:**
- One summarizer session reused
- ~2s per summary
- Model ~200MB

**Error States:**
- Model unavailable: Use first 200 chars
- Timeout (>5s): Use truncated text
- Result too short: Append "..."

---

### API-004: Prompt (Language Model)

**When:** F-002 (keywords), F-006 (comparison)

**Usage Pattern:**
```
const session = await ai.languageModel.create({
  systemPrompt: "You are a media analyst..."
});
const result = await session.prompt(userPrompt);
```

**Token Management:**
```
// Check usage
console.log(`${session.tokensSoFar}/${session.maxTokens}`);
console.log(`${session.tokensLeft} remaining`);

// Destroy when done
session.destroy();
```

**Quota Assumptions:**
- Max 10,000 tokens per session
- Create new session per analysis
- Destroy after use

**Error States:**
- Quota exceeded: Fall back to simple text matching
- JSON parse fails: Use raw text output
- Model unavailable: Skip advanced analysis

---

## 7. Error Handling Matrix

| Error | User Impact | Handling | User Message |
|-------|-------------|----------|--------------|
| Not a news article | Low | Hide badge | (none) |
| NewsAPI rate limit | High | Use cache only | "Daily quota exceeded. Showing cached results." |
| NewsAPI 0 results | Medium | Show message | "No international coverage found for this story." |
| Translation fails | Medium | Show original | "(Untranslated - EN)" |
| Summarizer fails | Low | Use truncated text | (none visible) |
| Comparison fails | Low | Show perspectives only | (hide comparison section) |
| Cache full | Low | Auto-evict LRU | (none) |
| Model downloading | Medium | Show progress | "Downloading AI model... 47%" |
| No internet (first use) | High | Block analysis | "Internet required for first analysis." |
| No internet (cached) | None | Use cache | (none) |

---

## 8. Performance Requirements

| Metric | Target | Measured By |
|--------|--------|-------------|
| Initial detection | <100ms | Content script load to detection |
| NewsAPI response | <5s | Fetch start to response |
| Single translation | <3s | API call to result |
| Single summary | <2s | API call to result |
| Complete analysis | <15s | User click to UI render |
| Cache read | <50ms | Query to result |
| Cache write | <100ms | Save initiation to completion |
| UI render | <500ms | Data received to visible |
| Memory usage | <100MB | Chrome task manager |
| Extension size | <2MB | Build output |

---

## 9. Security & Privacy

### Data Handling

**NEVER Sent to External Servers:**
- ✅ Article full text (only title/URL to NewsAPI)
- ✅ User reading history
- ✅ Translated content
- ✅ Cached analyses
- ✅ User preferences

**Sent to External Services:**
- ⚠️ Article title + URL → NewsAPI (HTTPS)
- ⚠️ Keywords → NewsAPI (HTTPS)

**Stored Locally Only:**
- IndexedDB: All analyses, translations, cache
- Chrome Storage: API key, preferences
- No cloud sync
- No telemetry

### API Key Security

**NewsAPI Key Storage:**
```
Location: chrome.storage.local (encrypted by Chrome)
Never: In source code, git, public
Access: Background script only
```

**User Provides Own Key:**
- Required for production use
- Instructions in popup
- Validated on save
- Masked in UI (●●●●●●key123)

---

## 10. Testing Strategy

### Unit Tests (Not Required for MVP)
- Individual functions in utils/
- Detector heuristics
- Cache operations

### Integration Tests (Manual)

**T-001: Happy Path**
```
1. Navigate to https://www.bbc.com/news
2. Open any article
3. Verify badge appears with count
4. Click badge
5. Verify panel opens
6. Verify 5 perspectives load within 15s
7. Verify each has translation + summary
8. Verify comparison section shows
9. Close panel
10. Reopen → should load from cache instantly
```

**T-002: Edge Cases**
```
- Non-news page → no badge
- News with 0 international coverage → appropriate message
- Article in Portuguese → no translation needed
- Very old article (>30 days) → "Limited historical coverage"
- Rate limit hit → cache-only mode message
- Chinese source returned → verify translation zh→pt works
- Mixed language results (en, zh, ar, fr) → all translated to pt
```

**T-003: Offline Behavior**
```
1. Analyze article (creates cache)
2. Disconnect internet
3. Revisit same article
4. Click badge
5. Verify loads from cache
6. Try new article
7. Verify shows "Internet required" message
```

**T-004: Stress Testing**
```
- 20 consecutive analyses (test quota)
- Very long article (10k words)
- Article with special characters
- Multiple tabs open simultaneously
```

### Browser Compatibility

**Required:**
- ✅ Chrome 138+ (Stable)
- ✅ Windows 10+, macOS 13+, Linux

**Not Supported:**
- ❌ Chrome <138
- ❌ Other browsers (Firefox, Safari, Edge without Chromium 138+)
- ❌ Mobile (Chrome Android/iOS)

---

## 11. Deployment

### Build Process

**Development:**
```
npm install
npm run dev
→ Loads unpacked extension in chrome://extensions
→ Hot reload on changes
```

**Production:**
```
npm run build
→ Outputs to dist/
→ Generates manifest.json
→ Creates .zip for Chrome Web Store
```

**Chrome Web Store:**
- Category: Productivity
- Age Rating: Everyone
- Price: Free
- Permissions explanation: Required

### Distribution

**Hackathon Submission:**
1. Public GitHub repo
2. Chrome Web Store link OR .zip file
3. Demo video (YouTube)
4. README with setup instructions

**Post-Hackathon:**
- Chrome Web Store (free)
- Open source (MIT license)
- Community contributions welcome

**Special Considerations for Chinese Sources:**
- NewsAPI.org includes: Xinhua, China Daily, Global Times, People's Daily
- These are English-language editions of Chinese outlets (accessible globally)
- Translation API handles zh→pt for Chinese-language content when available
- Provides crucial non-Western perspective on global events
- Particularly valuable for stories about Asia, trade, climate, technology

---

## 12. Success Metrics

### Hackathon Judging (100 points)

**Functionality (30 pts):**
- ✅ Scalable to any news topic
- ✅ Works in 150+ countries
- ✅ Multiple audience types (journalists, students, investors)

**Purpose (25 pts):**
- ✅ Meaningfully improves news verification workflow
- ✅ Unlocks new capability: offline multi-language comparison
- ✅ Previously impractical without cloud services

**Content (20 pts):**
- ✅ Clean, modern UI
- ✅ Visual comparison with color coding
- ✅ Professional design quality

**User Experience (15 pts):**
- ✅ One-click activation
- ✅ Results in <15s
- ✅ Intuitive interface

**Technical Execution (10 pts):**
- ✅ Uses 4 Chrome Built-in AI APIs
- ✅ Showcases Prompt API for complex analysis
- ✅ Demonstrates hybrid online/offline model

**TARGET:** 85+ points (Top 3)

### Post-Launch Metrics

- GitHub stars: >100 in first week
- Chrome Web Store installs: >1,000 in first month
- Media coverage: Feature in Chrome Developers blog
- Community: 5+ contributors

---

## 13. Development Timeline

### Week 1: Foundation (Nov 4-10)
**Goal:** Basic detection + NewsAPI working

- Day 1-2: Project setup, manifest, build config
- Day 3-4: News detection (F-001) + test on 20 sites
- Day 5-7: NewsAPI integration (F-003) + test queries

**Deliverable:** Can detect news and fetch perspectives

---

### Week 2: AI Pipeline (Nov 11-17)
**Goal:** Translation + summarization working

- Day 8-10: Language detection (F-002) + Translator API (F-004)
- Day 11-12: Summarizer API (F-005)
- Day 13-14: Prompt API for comparison (F-006)

**Deliverable:** End-to-end pipeline works (no UI)

---

### Week 3: UI + Polish (Nov 18-24)
**Goal:** Fully functional extension

- Day 15-17: UI components (F-008)
- Day 18-19: Cache system (F-007)
- Day 20-21: Error handling + edge cases

**Deliverable:** Working extension, ready for demo

---

### Week 4: Launch (Nov 25-Dec 1)
**Goal:** Submit to hackathon

- Day 22-24: Demo video script + recording
- Day 25-26: Documentation (README, screenshots)
- Day 27-28: Testing + bug fixes
- Day 29: Submit to Chrome Web Store
- Day 30: Submit to hackathon

**Deliverable:** Submitted!

---

## 14. Out of Scope (Future Versions)

**v2.0 Features:**
- Fact-checking integration (Google Fact Check API)
- Timeline showing story evolution over days
- Sentiment trend analysis
- Export as PDF report
- Browser history analysis (privacy-respecting)

**v3.0 Features:**
- User accounts (optional)
- Shared analyses
- Browser extension for Firefox/Edge
- Mobile app (React Native)
- API for third-party integrations

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Perspective** | One news article about the same event from a specific source/country (e.g., NYT/USA, Xinhua/China, BBC/UK) |
| **Analysis** | Complete set of perspectives + comparison for one original article |
| **Consensus** | Facts that all perspectives agree on |
| **Dispute** | Facts where perspectives differ (often reveals editorial bias) |
| **Omission** | Information mentioned by some but not all sources (what each outlet chooses NOT to cover) |
| **Session** | AI API instance that maintains context |
| **Cache** | Local storage (IndexedDB) of past analyses |
| **Hybrid** | Combination of online (NewsAPI) and offline (AI) operations |
| **LRU** | Least Recently Used (cache eviction strategy) |
| **Global Diversity** | Inclusion of Western (US/EU) and non-Western (China, Middle East) sources |

---

## 16. Key Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| NewsAPI.org over alternatives | Best free tier (100/day), most reliable | Oct 2025 |
| 5 perspectives max | Balance between diversity and performance | Oct 2025 |
| Include Chinese sources | Critical for true global perspective, represents 1.4B people | Oct 2025 |
| Hybrid model (not 100% offline) | NewsAPI requires internet, AI APIs work offline | Oct 2025 |
| No React/frameworks | Minimize bundle size, maximize performance | Oct 2025 |
| Summarize before translate | Faster: translate 200 words vs 5000 words | Oct 2025 |
| Cache TTL 24h | Balance freshness vs. quota usage | Oct 2025 |
| Floating button UI | Non-invasive, familiar pattern | Oct 2025 |
| Limit to Chrome 138+ | Required for stable Built-in AI APIs | Oct 2025 |

---

## 17. Contact & Resources

**GitHub:** [to be created]  
**Demo Video:** [to be created]  
**Chrome Web Store:** [to be published]  

**Developer:** [Your Name]  
**Documentation:** README.md in repo  
**Support:** GitHub Issues  

**External Dependencies:**
- NewsAPI.org: https://newsapi.org/docs
- Chrome Built-in AI: https://developer.chrome.com/docs/ai/built-in
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

---

**END OF DOCUMENT**

This PRD is the source of truth for development. Any changes must be documented here with rationale and date.mock n