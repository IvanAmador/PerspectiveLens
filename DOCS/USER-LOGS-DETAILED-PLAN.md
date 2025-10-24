# USER LOGS DETAILED PLAN - PerspectiveLens

## ANÁLISE PROFUNDA DO console.txt

### Timeline Real de Operações (Baseada em Timestamps)

Este documento analisa linha por linha o console.txt e identifica TODAS as operações que devem ter logs user-friendly, com timings reais e mensagens adequadas.

---

## MAPEAMENTO COMPLETO: OPERAÇÃO → DURAÇÃO → LOG

### FASE 1: INICIALIZAÇÃO (0-5%)
**Duração total: ~0s (instantâneo)**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 1-5 | Background worker & config load | Instantâneo | ❌ Sem log user | ✅ OK - operação interna |

**Decisão**: Não logar - operação invisível para usuário.

---

### FASE 2: DETECÇÃO DE IDIOMA (5-10%)
**Duração total: ~150ms**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 13-14 | Detect title language START | 0ms | ❌ Sem log user | ⚠️ **ADICIONAR LOG DE INÍCIO** |
| 15-21 | Language Detector API + Detection | ~140ms | ✅ Logs técnicos | ✅ OK - detalhado demais |
| 22-23 | Detection complete | 143ms total | ❌ Sem log user | ⚠️ **ADICIONAR LOG DE SUCESSO** |

**Problemas identificados**:
1. ✅ Já temos log no background.js (linhas 218-229) usando `logger.logUserAI` e `logger.logUserProgress`
2. ❌ MAS o log está em "detection" phase quando deveria estar ANTES da operação

**Código atual** (background.js:218-229):
```javascript
// FASE 1: DETECÇÃO (5-15%)
// Detect language with AI
logger.logUserAI('language-detection', {
  phase: 'detection',
  progress: 10,
  message: 'Detecting article language with AI...',
  metadata: {}
});

// Language detected (assuming we have the language from articleData)
logger.logUserProgress('detection', 15, `Language detected: ${articleData.language || 'Unknown'}`, {
  icon: 'SUCCESS',
  detectedLanguage: articleData.language
});
```

**❌ PROBLEMA**: O log de INÍCIO está CORRETO, mas o log de SUCESSO está usando `articleData.language` que já vem pronto. Não está esperando a detecção real.

**✅ SOLUÇÃO**: Mover os logs para DENTRO de `fetchPerspectives` onde a detecção realmente acontece.

---

### FASE 3: TRADUÇÃO DO TÍTULO PARA INGLÊS (10-15%)
**Duração total: ~580ms**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 24 | Translation pt→en START | 0ms | ❌ Sem log user | ⚠️ **ADICIONAR LOG DE INÍCIO** |
| 25-33 | Translator creation + translation | ~575ms | ✅ Logs técnicos | ✅ OK - detalhado |
| 34 | Translation complete | 577ms total | ❌ Sem log user | ⚠️ **ADICIONAR LOG DE SUCESSO** |

**Problemas identificados**:
1. ❌ Logs no background.js estão em "translation" phase mas NÃO estão aguardando resultado real
2. ❌ Log mostra `from: articleData.language` mas não espera a tradução completar

**Código atual** (background.js:241-253):
```javascript
// FASE 2: TRADUÇÃO (15-25%)
// Translate title to English
logger.logUserAI('translation', {
  phase: 'translation',
  progress: 18,
  message: 'Translating title to English...',
  metadata: { from: articleData.language || 'unknown', to: 'en' }
});

// Pre-translate for multiple languages
logger.logUserProgress('translation', 22, 'Pre-translating for global search...', {
  icon: 'TRANSLATE',
  targetLanguages: ['zh', 'ar', 'ru', 'en']
});
```

**❌ PROBLEMA**:
- Log de INÍCIO está OK mas progress está em 18% (deveria ser ~12%)
- Log de "Pre-translating" aparece ANTES da tradução principal completar
- Não há log quando tradução pt→en completa

**✅ SOLUÇÃO**: Mover logs para DENTRO de `fetchPerspectives`.

---

### FASE 4: PRÉ-TRADUÇÃO PARALELA (15-20%)
**Duração total: ~1350ms (operação LENTA)**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 35-36 | Pre-translation START | 0ms | ❌ Sem log user | ⚠️ **ADICIONAR LOG DE INÍCIO** |
| 37-47 | 3x Translator creation (parallel) | ~200ms | ✅ Logs técnicos | ✅ OK |
| 48 | Waiting for all translations | - | ✅ Log existe | ⚠️ **MAS SEM LOG USER** |
| 50-63 | Translators created | ~225ms | ✅ Logs técnicos | ✅ OK |
| 64-69 | Translations complete | ~1343ms total | ✅ Logs técnicos | ⚠️ **ADICIONAR LOG USER** |
| 70 | All translations cached | 1344ms total | ✅ Log existe | ⚠️ **MAS SEM LOG USER** |

**Problemas identificados**:
1. ❌ Esta é uma operação LENTA (~1.3s) mas NÃO aparece para o usuário
2. ❌ Log em background.js (linha 250) mostra ANTES da operação, não durante
3. ❌ Usuário vê "Pre-translating" por 1.3s sem feedback

**✅ SOLUÇÃO**: Adicionar logs user-friendly:
- **ANTES**: "Preparing translations for global search..."
- **DURANTE**: "Translating to Chinese, Arabic, Russian..." (com progress)
- **DEPOIS**: "Translations ready for 5 languages"

---

### FASE 5: BUSCA PARALELA (20-35%)
**Duração total: ~1226ms**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 71 | Parallel search START | 0ms | ✅ Log existe | ⚠️ **MAS progress está errado** |
| 72-101 | Build queries + search 5 countries | ~100ms | ✅ Logs técnicos | ✅ OK |
| 102-111 | RSS fetch + parse | ~1221ms | ✅ Logs técnicos | ⚠️ **SEM LOG USER** |
| 112 | Parallel searches complete | 1226ms total | ✅ Log existe | ⚠️ **MAS SEM LOG USER** |

**Código atual** (background.js:266-273):
```javascript
// FASE 3: BUSCA (25-45%)
logger.logUserProgress('search', 30, 'Searching articles globally...', {
  icon: 'SEARCH',
  countries: searchConfig.countries.map(c => c.code)
});

// Pass search config to newsFetcher
perspectives = await fetchPerspectives(articleData.title, articleData, searchConfig);
```

**❌ PROBLEMA**:
- Log mostra progress 30% mas a operação demora ~1.2s (deveria ter feedback durante)
- Usuário fica 1.2s vendo "Searching..." sem saber se está travado

**✅ SOLUÇÃO**:
- Adicionar callback de progresso em `fetchPerspectives`
- Mostrar "Searching Brazil...", "Searching China...", etc

---

### FASE 6: EXTRAÇÃO DE CONTEÚDO (35-60%)
**Duração total: ~15s (OPERAÇÃO MAIS LENTA)**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 120-123 | Content extraction START | 0ms | ✅ Log existe | ⚠️ **Progress está errado** |
| 124-130 | Window Manager setup | ~100ms | ✅ Logs técnicos | ✅ OK |
| 131-143 | Create tabs (3 articles) | ~200ms | ✅ Logs técnicos | ⚠️ **SEM LOG USER** |
| 144-168 | Redirect detection | ~3000ms | ✅ Logs técnicos | ⚠️ **SEM LOG USER - LONGO** |
| 169-189 | Readability extraction | ~5500ms | ✅ Logs técnicos | ⚠️ **SEM LOG USER - LONGO** |
| 191-233 | Retry low quality | ~4500ms | ✅ Logs técnicos | ⚠️ **SEM LOG USER - LONGO** |
| 234 | Extraction complete | ~15000ms total | ✅ Log existe | ⚠️ **MAS SEM LOG USER** |

**Código atual** (background.js:332-356):
```javascript
// FASE 4: EXTRAÇÃO (45-65%)
logger.logUserProgress('extraction', 50, `Extracting content from ${perspectives.length} articles...`, {
  icon: 'EXTRACT',
  articlesCount: perspectives.length
});

logger.system.debug('Starting content extraction', {
  category: logger.CATEGORIES.FETCH,
  data: {
    articlesCount: perspectives.length,
    note: 'Extracting ALL articles, selection happens later'
  }
});

logger.progress(logger.CATEGORIES.FETCH, {
  status: 'active',
  userMessage: `Processing ${perspectives.length} articles...`,
  systemMessage: `Starting batch extraction with parallel processing`,
  progress: 20
});

// Extract content from ALL articles (no limit here)
// Configuration from pipeline.js is used as defaults
perspectivesWithContent = await extractArticlesContentWithTabs(perspectives);
```

**❌ PROBLEMA CRÍTICO**:
- **Esta é a 2ª operação MAIS LENTA (~15s)**
- Usuário vê "Processing 3 articles..." por **15 SEGUNDOS** sem feedback
- Progress fica em 50% por 15s - parece travado
- Não mostra quando cada artigo é completado

**✅ SOLUÇÃO**:
- Adicionar callback de progresso em `extractArticlesContentWithTabs`
- Mostrar "Extracting O Globo...", "Extracting PCR News...", "Extracting Yahoo..."
- Atualizar progress incrementalmente (50% → 52% → 55% → 60% → 65%)

---

### FASE 7: SELEÇÃO DE ARTIGOS (60-65%)
**Duração total: ~10ms (rápido)**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 246-266 | Article selection | ~10ms | ✅ Logs técnicos | ✅ OK - rápido |

**✅ JÁ ESTÁ BOM** - Operação rápida, logs OK.

---

### FASE 8: COMPRESSÃO COM AI (65-80%)
**Duração total: ~98s (OPERAÇÃO MAIS LENTA - 100 SEGUNDOS)**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 281-288 | Summarizer creation | ~6256ms (6.3s) | ✅ Logs técnicos | ❌ **SEM LOG USER - MUITO LONGO** |
| 289 | Session created | 6257ms total | ✅ Log existe | ❌ **SEM LOG USER** |
| 290-335 | Article 1 (O Globo) compression | ~31s | ✅ Logs técnicos | ❌ **SEM LOG USER - MUITO LONGO** |
| - | - Language detection | ~200ms | ✅ Logs técnicos | ✅ OK |
| - | - Translation pt→en | ~21s | ✅ Logs técnicos | ❌ **SEM LOG USER - MUITO LONGO** |
| - | - Summarization | ~9s | ✅ Logs técnicos | ❌ **SEM LOG USER** |
| 336-343 | Article 2 (PCR News) compression | ~92s | ✅ Logs técnicos | ❌ **SEM LOG USER - MUITO LONGO** |
| - | - Language detection | ~480ms | ✅ Logs técnicos | ✅ OK |
| - | - Translation ru→en | ~75s (streaming) | ✅ Logs técnicos | ❌ **SEM LOG USER - MUITO LONGO** |
| - | - Summarization | ~16s | ✅ Logs técnicos | ❌ **SEM LOG USER** |
| 335 | Article 3 (Yahoo) compression | ~19s | ✅ Logs técnicos | ❌ **SEM LOG USER** |
| - | - Language detection | ~650ms | ✅ Logs técnicos | ✅ OK |
| - | - No translation (already en) | 0s | ✅ Log existe | ✅ OK |
| - | - Summarization | ~18s | ✅ Logs técnicos | ❌ **SEM LOG USER** |
| 345-347 | Compression complete | ~97772ms (98s) | ✅ Log existe | ❌ **SEM LOG USER** |

**Código atual** (background.js:503-526):
```javascript
// FASE 5: COMPRESSÃO (65-85%) - AI trabalhando
logger.logUserAI('summarization', {
  phase: 'compression',
  progress: 70,
  message: 'Creating AI summarizer...',
  metadata: {}
});

logger.system.info('Starting progressive multi-stage analysis', {
  category: logger.CATEGORIES.ANALYZE,
  data: {
    articlesCount: selectedArticles.length,
    stages: 4,
    note: 'Using centralized config for analysis parameters'
  }
});

logger.logUserAI('summarization', {
  phase: 'compression',
  progress: 75,
  message: `AI summarizing ${selectedArticles.length} articles...`,
  metadata: { articlesCount: selectedArticles.length }
});
```

**❌ PROBLEMA CRÍTICO - O PIOR DE TODOS**:
- **Esta é a operação MAIS LENTA (98 segundos = 1min38s)**
- Usuário vê "AI summarizing 3 articles..." por **98 SEGUNDOS**
- Progress fica em 75% por quase 2 minutos - parece COMPLETAMENTE TRAVADO
- Não mostra:
  - ❌ Criação do summarizer (6s)
  - ❌ Detecção de idioma de cada artigo
  - ❌ **TRADUÇÕES (21s + 75s = 96s) - ESSAS SÃO INVISÍVEIS**
  - ❌ Summarização de cada artigo
  - ❌ Progress incremental

**✅ SOLUÇÃO URGENTE**:
1. **ANTES de criar summarizer**: "Creating AI summarizer..." (progress 68%)
2. **APÓS criar summarizer**: "Summarizer ready" (progress 70%)
3. **Para cada artigo**:
   - "Processing article 1/3: O Globo..." (progress 72%)
   - "Detecting language..." (progress 73%)
   - **SE PRECISA TRADUZIR**: "Translating from Portuguese to English..." (progress 74-78%)
   - "Summarizing with AI..." (progress 79-82%)
   - "Article 1/3 complete" (progress 83%)
4. **Repeat para artigos 2 e 3**
5. **APÓS tudo**: "Compression complete" (progress 85%)

**Progress distribution baseado em tempo real**:
- Summarizer creation (6s / 98s = 6%): 68% → 70%
- Article 1 (31s / 98s = 32%): 70% → 80%
- Article 2 (92s / 98s = 48%): 80% → 92% (!)
- Article 3 (19s / 98s = 19%): 92% → 98%
- Finalization (1s): 98% → 100%

**⚠️ ATENÇÃO**: Article 2 leva METADE do tempo total (92s de 200s totais) - precisa MUITO feedback.

---

### FASE 9: ANÁLISE AI - 4 STAGES (80-100%)
**Duração total: ~23s**

| Linha | Operação | Duração Real | Status Atual | Ação Necessária |
|-------|----------|--------------|--------------|-----------------|
| 350-372 | Stage 1: Context & Trust | ~4418ms (4.4s) | ✅ Logs técnicos | ⚠️ **Log DEPOIS, não ANTES** |
| 373-395 | Stage 2: Consensus | ~7814ms (7.8s) | ✅ Logs técnicos | ⚠️ **Log DEPOIS, não ANTES** |
| 396-418 | Stage 3: Disputes | ~4978ms (5.0s) | ✅ Logs técnicos | ⚠️ **Log DEPOIS, não ANTES** |
| 419-441 | Stage 4: Perspectives | ~5565ms (5.6s) | ✅ Logs técnicos | ⚠️ **Log DEPOIS, não ANTES** |
| 442 | Analysis complete | ~22775ms (23s) | ✅ Log existe | ✅ OK |

**Código atual** (background.js:539-600):
```javascript
const analysisResult = await compareArticlesProgressive(
  selectedArticles,
  // Stage completion callback - updates UI progressively
  async (stageNumber, stageData) => {
    // FASE 6: ANÁLISE (85-100%) - AI stages
    const stageProgress = [88, 92, 96, 98];
    const stageMessages = [
      'AI analyzing context & trust...',
      'AI finding consensus...',
      'AI detecting disputes...',
      'AI analyzing perspectives...'
    ];

    if (stageNumber >= 1 && stageNumber <= 4) {
      logger.logUserAI('analysis', {
        phase: 'analysis',
        progress: stageProgress[stageNumber - 1],
        message: stageMessages[stageNumber - 1],
        metadata: { stage: stageNumber }
      });
    }

    // ... rest of callback
  }
);
```

**❌ PROBLEMA**:
- **Callback é chamado DEPOIS do stage completar**
- Usuário vê "AI analyzing context & trust..." APÓS stage 1 acabar
- Deveria ver ANTES de cada stage iniciar
- Progress está OK mas mensagem aparece no momento errado

**✅ SOLUÇÃO**:
- Adicionar log ANTES de iniciar cada stage (em `compareArticlesProgressive`)
- Callback atual mantém log de SUCESSO
- Resultado:
  - **ANTES Stage 1**: "Starting Context & Trust analysis..." (85%)
  - **DEPOIS Stage 1**: "Context & Trust complete" (88%)
  - **ANTES Stage 2**: "Starting Consensus analysis..." (88%)
  - **DEPOIS Stage 2**: "Consensus complete" (92%)
  - etc.

---

## RESUMO: PROBLEMAS CRÍTICOS POR PRIORIDADE

### 🔴 CRÍTICO (Usuário fica >10s sem feedback)

1. **COMPRESSÃO/TRADUÇÃO (98s totais)**
   - ❌ Summarizer creation (6s) - invisível
   - ❌ Article 1 translation pt→en (21s) - **INVISÍVEL**
   - ❌ Article 2 translation ru→en (75s) - **INVISÍVEL - PIOR CASO**
   - ❌ Article summarizations (19s + 16s + 18s) - invisíveis

2. **EXTRAÇÃO DE CONTEÚDO (15s)**
   - ❌ Redirect detection (3s) - invisível
   - ❌ Readability extraction (5.5s) - invisível
   - ❌ Retry (4.5s) - invisível

### 🟡 IMPORTANTE (Usuário fica 1-10s sem feedback)

3. **PRÉ-TRADUÇÃO PARALELA (1.3s)**
   - ❌ 3 traduções paralelas - invisíveis

4. **BUSCA PARALELA (1.2s)**
   - ⚠️ Tem log mas sem progresso incremental

### 🟢 MENOR (Feedback está OK mas pode melhorar)

5. **STAGES DE ANÁLISE (23s)**
   - ⚠️ Logs aparecem DEPOIS, não ANTES

6. **DETECÇÃO DE IDIOMA (150ms)**
   - ✅ Rápido, logs OK

7. **TRADUÇÃO TÍTULO (580ms)**
   - ✅ Rápido, logs OK

---

## PLANO DE AÇÃO: ONDE ADICIONAR LOGS

### 1. TRADUÇÃO DE ARTIGOS (api/translator.js)

**Arquivo**: `c:\Users\ivano\Documents\GitHub\PerspectiveLens\api\translator.js`

**Função**: `translateText()`

**Adicionar ANTES da tradução** (linha ~180):
```javascript
// Log user-friendly ANTES de traduzir
if (text.length > 1000) { // Only for long texts (articles)
  logger.logUserAI('translation', {
    phase: 'compression',
    progress: null, // Will be calculated by caller
    message: `Translating from ${getLanguageName(sourceLang)} to ${getLanguageName(targetLang)}...`,
    metadata: {
      from: sourceLang,
      to: targetLang,
      textLength: text.length
    }
  });
}

// Existing translation code...
const result = await translator.translate(text);
```

**Adicionar APÓS tradução** (linha ~200):
```javascript
// Log success
if (text.length > 1000) {
  logger.logUserProgress('compression', null,
    `Translation complete (${sourceLang}→${targetLang})`, {
    icon: 'SUCCESS',
    originalLength: text.length,
    translatedLength: result.length
  });
}
```

---

### 2. SUMMARIZAÇÃO (api/summarizer.js)

**Arquivo**: `c:\Users\ivano\Documents\GitHub\PerspectiveLens\api\summarizer.js`

**Função**: `compressBatchWithSessionReuse()` (linha ~350)

**Adicionar no INÍCIO**:
```javascript
logger.logUserAI('summarization', {
  phase: 'compression',
  progress: 68,
  message: 'Creating AI summarizer...',
  metadata: { articlesCount: articles.length }
});

// Create session...
const session = await createSummarizer(...);

logger.logUserProgress('compression', 70, 'Summarizer ready', {
  icon: 'SUCCESS',
  sessionCreated: true
});
```

**Adicionar no LOOP de artigos** (linha ~380):
```javascript
for (let i = 0; i < articles.length; i++) {
  const article = articles[i];

  // Calculate progress based on article position
  const baseProgress = 70;
  const progressPerArticle = 15; // 70% to 85% spread across articles
  const articleProgress = baseProgress + (i / articles.length) * progressPerArticle;

  logger.logUserProgress('compression', Math.round(articleProgress),
    `Processing article ${i+1}/${articles.length}: ${article.source}`, {
    icon: 'PROCESSING',
    articleIndex: i + 1,
    totalArticles: articles.length,
    source: article.source
  });

  // Detect language
  logger.logUserProgress('compression', Math.round(articleProgress + 1),
    `Detecting language...`, {
    icon: 'AI'
  });

  const lang = await detectLanguage(article.content);

  // Translate if needed
  if (lang !== 'en') {
    logger.logUserAI('translation', {
      phase: 'compression',
      progress: Math.round(articleProgress + 2),
      message: `Translating from ${getLanguageName(lang)} to English...`,
      metadata: {
        from: lang,
        to: 'en',
        articleSource: article.source,
        contentLength: article.content.length
      }
    });

    const translated = await translate(article.content, lang, 'en');

    logger.logUserProgress('compression', Math.round(articleProgress + 8),
      `Translation complete`, {
      icon: 'SUCCESS',
      from: lang,
      to: 'en'
    });
  }

  // Summarize
  logger.logUserAI('summarization', {
    phase: 'compression',
    progress: Math.round(articleProgress + 10),
    message: `Summarizing with AI...`,
    metadata: {
      articleSource: article.source
    }
  });

  const summary = await session.summarize(translatedContent);

  logger.logUserProgress('compression', Math.round(articleProgress + progressPerArticle),
    `Article ${i+1}/${articles.length} complete`, {
    icon: 'SUCCESS',
    source: article.source,
    compressionRatio: calculateRatio(original, compressed)
  });
}

logger.logUserProgress('compression', 85, 'All articles compressed', {
  icon: 'SUCCESS',
  totalArticles: articles.length
});
```

---

### 3. EXTRAÇÃO DE CONTEÚDO (api/contentExtractor.js)

**Arquivo**: `c:\Users\ivano\Documents\GitHub\PerspectiveLens\api\contentExtractor.js`

**Função**: `extractArticlesContentWithTabs()` (linha ~100)

**Adicionar callback de progresso**:
```javascript
async function extractArticlesContentWithTabs(articles, options = {}) {
  const {
    onProgress = null, // NEW: Progress callback
    ...otherOptions
  } = options;

  logger.logUserProgress('extraction', 50,
    `Extracting content from ${articles.length} articles...`, {
    icon: 'EXTRACT',
    articlesCount: articles.length
  });

  const results = [];
  const baseProgress = 50;
  const progressRange = 15; // 50% to 65%

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const articleProgress = baseProgress + (i / articles.length) * progressRange;

    logger.logUserProgress('extraction', Math.round(articleProgress),
      `Extracting ${article.source}...`, {
      icon: 'EXTRACT',
      articleIndex: i + 1,
      totalArticles: articles.length,
      source: article.source
    });

    // Extract...
    const result = await extractSingleArticle(article);
    results.push(result);

    logger.logUserProgress('extraction', Math.round(articleProgress + (progressRange / articles.length)),
      `Extracted ${article.source}`, {
      icon: 'SUCCESS',
      source: article.source,
      contentLength: result.extractedContent?.textContent?.length || 0
    });
  }

  logger.logUserProgress('extraction', 65,
    `Extracted ${results.length}/${articles.length} articles`, {
    icon: 'SUCCESS',
    successful: results.filter(r => r.contentExtracted).length,
    total: articles.length
  });

  return results;
}
```

---

### 4. PRÉ-TRADUÇÃO (api/newsFetcher.js)

**Arquivo**: `c:\Users\ivano\Documents\GitHub\PerspectiveLens\api\newsFetcher.js`

**Função**: `fetchPerspectives()` onde ocorre pre-translate (linha ~200)

**Adicionar ANTES do loop**:
```javascript
logger.logUserProgress('translation', 18,
  `Preparing translations for ${uniqueLanguages.length} languages...`, {
  icon: 'TRANSLATE',
  languages: uniqueLanguages
});

// Start pre-translation
const translationPromises = uniqueLanguages.map(async (lang, index) => {
  logger.logUserAI('translation', {
    phase: 'translation',
    progress: 18 + (index / uniqueLanguages.length) * 4, // 18-22%
    message: `Translating to ${getLanguageName(lang)}...`,
    metadata: {
      language: lang,
      from: 'en',
      index: index + 1,
      total: uniqueLanguages.length
    }
  });

  const result = await translate(englishTitle, 'en', lang);

  return result;
});

const translations = await Promise.all(translationPromises);

logger.logUserProgress('translation', 22,
  `Translations ready for ${uniqueLanguages.length} languages`, {
  icon: 'SUCCESS',
  languages: uniqueLanguages
});
```

---

### 5. BUSCA PARALELA (api/newsFetcher.js)

**Mesmo arquivo, função**: `searchParallel()` (linha ~300)

**Adicionar progress incremental**:
```javascript
async function searchParallel(countries, translations) {
  const results = [];
  const baseProgress = 25;
  const progressRange = 20; // 25-45%

  logger.logUserProgress('search', 25,
    `Searching in ${countries.length} countries...`, {
    icon: 'SEARCH',
    countries: countries.map(c => c.code)
  });

  const searchPromises = countries.map(async (country, index) => {
    logger.logUserProgress('search', Math.round(baseProgress + (index / countries.length) * progressRange),
      `Searching ${country.name}...`, {
      icon: 'SEARCH',
      country: country.code,
      countryName: country.name,
      index: index + 1,
      total: countries.length
    });

    const articles = await searchCountry(country, translations[country.language]);

    logger.logUserProgress('search', Math.round(baseProgress + ((index + 0.5) / countries.length) * progressRange),
      `Found ${articles.length} from ${country.name}`, {
      icon: 'SUCCESS',
      country: country.code,
      articlesFound: articles.length
    });

    return articles;
  });

  const allArticles = await Promise.all(searchPromises);

  const totalArticles = allArticles.flat().length;

  logger.logUserProgress('search', 45,
    `Found ${totalArticles} articles from ${countries.length} countries`, {
    icon: 'SUCCESS',
    totalArticles,
    countries: countries.length
  });

  return allArticles.flat();
}
```

---

### 6. STAGES DE ANÁLISE (api/languageModel.js)

**Arquivo**: `c:\Users\ivano\Documents\GitHub\PerspectiveLens\api\languageModel.js`

**Função**: `compareArticlesProgressive()` (linha ~500)

**Adicionar log ANTES de cada stage**:
```javascript
async function compareArticlesProgressive(articles, stageCallback, options = {}) {
  const stages = [
    { number: 1, name: 'Context & Trust', progress: 85 },
    { number: 2, name: 'Consensus', progress: 88 },
    { number: 3, name: 'Disputes', progress: 92 },
    { number: 4, name: 'Perspectives', progress: 96 }
  ];

  const results = {};

  for (const stage of stages) {
    // LOG ANTES DO STAGE INICIAR
    logger.logUserAI('analysis', {
      phase: 'analysis',
      progress: stage.progress,
      message: `Starting ${stage.name} analysis...`,
      metadata: {
        stage: stage.number,
        stageName: stage.name
      }
    });

    // Execute stage
    const stageResult = await executeStage(stage.number, articles);
    results[`stage${stage.number}`] = stageResult;

    // LOG APÓS STAGE COMPLETAR (via callback existente)
    if (stageCallback) {
      await stageCallback(stage.number, {
        name: stage.name,
        data: stageResult
      });
    }

    // User-friendly completion log
    logger.logUserProgress('analysis', stage.progress + 2,
      `${stage.name} complete`, {
      icon: 'SUCCESS',
      stage: stage.number,
      stageName: stage.name
    });
  }

  return results;
}
```

---

## PROGRESS DISTRIBUTION - VALORES CORRETOS

Baseado nas durações REAIS do console.txt:

```
OPERAÇÃO                        DURAÇÃO    PROGRESS    PESO
─────────────────────────────────────────────────────────────
Initialization                    0s        0-5%        -
Language Detection              0.15s      5-10%       0.1%
Title Translation (pt→en)       0.58s      10-12%      0.5%
Pre-translation (3 langs)       1.35s      12-18%      1.2%
Parallel Search                 1.23s      18-25%      1.1%
Content Extraction              15.0s      25-45%      13.6%
Article Selection               0.01s      45-50%      0.01%
─────────────────────────────────────────────────────────────
COMPRESSION TOTAL               98.0s      50-85%      88.5%
  - Summarizer creation          6.3s      50-52%      5.7%
  - Article 1 (O Globo)         31.0s      52-66%      28.0%
    - Lang detect                0.2s      52-53%      0.2%
    - Translation pt→en         21.6s      53-62%      19.5%
    - Summarization              9.2s      62-66%      8.3%
  - Article 2 (PCR News)        92.0s      66-82%      83.0%
    - Lang detect                0.5s      66-67%      0.5%
    - Translation ru→en         75.2s      67-79%      68.0%
    - Summarization             16.3s      79-82%      14.7%
  - Article 3 (Yahoo)           19.0s      82-85%      17.2%
    - Lang detect                0.7s      82-83%      0.6%
    - No translation             0.0s      -           -
    - Summarization             18.3s      83-85%      16.5%
─────────────────────────────────────────────────────────────
ANALYSIS STAGES TOTAL           22.8s      85-100%     20.6%
  - Stage 1: Context & Trust     4.4s      85-88%      4.0%
  - Stage 2: Consensus           7.8s      88-92%      7.0%
  - Stage 3: Disputes            5.0s      92-96%      4.5%
  - Stage 4: Perspectives        5.6s      96-100%     5.1%
─────────────────────────────────────────────────────────────
TOTAL                          138.3s      100%        100%
```

**Observações críticas**:
1. **Compression é 71% do tempo total** (98s de 138s)
2. **Article 2 sozinho é 67% do tempo de compression** (92s de 98s)
3. **Translation ru→en sozinha é 54% do tempo total** (75s de 138s)

**PRIORIDADE MÁXIMA**: Mostrar progresso detalhado durante tradução russa.

---

## CÓDIGO EXEMPLO: TRADUÇÃO COM PROGRESS

**api/translator.js - função translateText()**:

```javascript
async function translateText(text, sourceLang, targetLang, options = {}) {
  const {
    onProgress = null, // NEW: callback for progress updates
    progressContext = {} // NEW: context for progress messages
  } = options;

  // Create translator
  const translator = await createTranslator(sourceLang, targetLang);

  // For long texts (>1000 chars), show user-friendly progress
  const isLongText = text.length > 1000;
  const isArticleTranslation = progressContext.phase === 'compression';

  if (isLongText && isArticleTranslation) {
    // Log START of translation
    logger.logUserAI('translation', {
      phase: progressContext.phase,
      progress: progressContext.startProgress || null,
      message: `Translating from ${getLanguageName(sourceLang)} to ${getLanguageName(targetLang)}...`,
      metadata: {
        from: sourceLang,
        to: targetLang,
        textLength: text.length,
        articleSource: progressContext.articleSource || 'Unknown'
      }
    });
  }

  // Translate (use streaming for very long texts)
  let result;
  if (text.length > 10000) {
    // Streaming translation with progress updates
    result = await translator.translateStreaming(text, {
      onChunk: (chunkIndex, totalChunks) => {
        if (onProgress && isArticleTranslation) {
          const chunkProgress = chunkIndex / totalChunks;
          const progressRange = (progressContext.endProgress || 100) - (progressContext.startProgress || 0);
          const currentProgress = (progressContext.startProgress || 0) + (chunkProgress * progressRange);

          onProgress(currentProgress, {
            operation: 'translation',
            chunk: chunkIndex,
            totalChunks,
            from: sourceLang,
            to: targetLang
          });
        }
      }
    });
  } else {
    // Standard translation
    result = await translator.translate(text);
  }

  // Log COMPLETION
  if (isLongText && isArticleTranslation) {
    logger.logUserProgress(progressContext.phase, progressContext.endProgress || null,
      `Translation complete (${sourceLang}→${targetLang})`, {
      icon: 'SUCCESS',
      from: sourceLang,
      to: targetLang,
      originalLength: text.length,
      translatedLength: result.length,
      articleSource: progressContext.articleSource || 'Unknown'
    });
  }

  return result;
}
```

**Uso em summarizer.js**:

```javascript
// Inside compressBatchWithSessionReuse(), for each article:

if (detectedLang !== 'en') {
  // Calculate progress range for this article's translation
  const articleIndex = i;
  const totalArticles = articles.length;
  const baseProgress = 70;
  const progressPerArticle = 15 / totalArticles;

  const translationStartProgress = baseProgress + (articleIndex * progressPerArticle) + 2;
  const translationEndProgress = translationStartProgress + (progressPerArticle * 0.6); // 60% of article time

  const translated = await translateText(article.content, detectedLang, 'en', {
    progressContext: {
      phase: 'compression',
      startProgress: translationStartProgress,
      endProgress: translationEndProgress,
      articleSource: article.source,
      articleIndex: articleIndex + 1,
      totalArticles
    }
  });
}
```

---

## CHECKLIST DE IMPLEMENTAÇÃO

### 🔴 CRÍTICO - Fazer PRIMEIRO

- [ ] **1. Adicionar logs em api/translator.js**
  - [ ] Log ANTES de traduzir (linha ~180)
  - [ ] Log APÓS traduzir (linha ~200)
  - [ ] Suporte para progressContext
  - [ ] Suporte para onProgress callback

- [ ] **2. Adicionar logs em api/summarizer.js - compressBatchWithSessionReuse()**
  - [ ] Log criação do summarizer (linha ~350)
  - [ ] Loop de artigos com progress (linha ~380)
  - [ ] Log detecção de idioma por artigo
  - [ ] Log tradução por artigo (com progressContext)
  - [ ] Log summarização por artigo
  - [ ] Log conclusão de cada artigo
  - [ ] Log conclusão geral

- [ ] **3. Adicionar logs em api/contentExtractor.js - extractArticlesContentWithTabs()**
  - [ ] Log início da extração (linha ~100)
  - [ ] Loop de artigos com progress
  - [ ] Log por artigo sendo extraído
  - [ ] Log conclusão de cada artigo
  - [ ] Log conclusão geral

### 🟡 IMPORTANTE - Fazer DEPOIS

- [ ] **4. Adicionar logs em api/newsFetcher.js**
  - [ ] Pre-tradução: log antes do loop
  - [ ] Pre-tradução: log por idioma
  - [ ] Pre-tradução: log conclusão
  - [ ] Busca: log por país
  - [ ] Busca: log resultados por país
  - [ ] Busca: log conclusão geral

- [ ] **5. Adicionar logs em api/languageModel.js - compareArticlesProgressive()**
  - [ ] Log ANTES de cada stage iniciar
  - [ ] Log APÓS cada stage completar (já existe via callback)

### 🟢 POLIMENTO - Fazer POR ÚLTIMO

- [ ] **6. Remover logs do background.js que foram movidos**
  - [ ] Remover logs de detecção de idioma (movido para newsFetcher)
  - [ ] Remover logs de tradução (movido para translator/newsFetcher)
  - [ ] Remover logs duplicados de compression (movido para summarizer)

- [ ] **7. Ajustar progress values no background.js**
  - [ ] Atualizar FASE 1: DETECÇÃO (5-10%)
  - [ ] Atualizar FASE 2: TRADUÇÃO (10-25%)
  - [ ] Atualizar FASE 3: BUSCA (25-45%)
  - [ ] Atualizar FASE 4: EXTRAÇÃO (45-65%)
  - [ ] Atualizar FASE 5: COMPRESSÃO (65-85%)
  - [ ] Atualizar FASE 6: ANÁLISE (85-100%)

---

## MENSAGENS USER-FRIENDLY - REFERÊNCIA RÁPIDA

### Detecção de Idioma
```javascript
// ANTES
logger.logUserAI('language-detection', {
  phase: 'detection',
  progress: 5,
  message: 'Detecting article language...',
  metadata: {}
});

// DEPOIS
logger.logUserProgress('detection', 10, 'Language detected: Portuguese', {
  icon: 'SUCCESS',
  detectedLanguage: 'pt'
});
```

### Tradução de Título
```javascript
// ANTES
logger.logUserAI('translation', {
  phase: 'translation',
  progress: 10,
  message: 'Translating title to English...',
  metadata: { from: 'pt', to: 'en' }
});

// DEPOIS
logger.logUserProgress('translation', 12, 'Title translated', {
  icon: 'SUCCESS',
  from: 'pt',
  to: 'en'
});
```

### Pré-Tradução
```javascript
// ANTES
logger.logUserProgress('translation', 12, 'Preparing translations...', {
  icon: 'TRANSLATE',
  languages: ['zh', 'ar', 'ru']
});

// DURANTE (por idioma)
logger.logUserAI('translation', {
  phase: 'translation',
  progress: 14, // incrementa
  message: 'Translating to Chinese...',
  metadata: { language: 'zh', from: 'en' }
});

// DEPOIS
logger.logUserProgress('translation', 18, 'Translations ready for 5 languages', {
  icon: 'SUCCESS',
  languages: ['pt', 'zh', 'ar', 'ru', 'en']
});
```

### Busca Paralela
```javascript
// ANTES
logger.logUserProgress('search', 25, 'Searching globally...', {
  icon: 'SEARCH',
  countries: ['BR', 'CN', 'PS', 'RU', 'US']
});

// DURANTE (por país)
logger.logUserProgress('search', 28, 'Searching Brazil...', {
  icon: 'SEARCH',
  country: 'BR'
});

// DEPOIS
logger.logUserProgress('search', 45, 'Found 15 articles from 5 countries', {
  icon: 'SUCCESS',
  totalArticles: 15,
  countries: 5
});
```

### Extração de Conteúdo
```javascript
// ANTES
logger.logUserProgress('extraction', 50, 'Extracting 3 articles...', {
  icon: 'EXTRACT',
  articlesCount: 3
});

// DURANTE (por artigo)
logger.logUserProgress('extraction', 52, 'Extracting O Globo...', {
  icon: 'EXTRACT',
  source: 'O Globo',
  index: 1,
  total: 3
});

// DEPOIS (cada artigo)
logger.logUserProgress('extraction', 55, 'Extracted O Globo', {
  icon: 'SUCCESS',
  source: 'O Globo',
  contentLength: 4293
});

// FINAL
logger.logUserProgress('extraction', 65, 'Extracted 3/3 articles', {
  icon: 'SUCCESS',
  successful: 3,
  total: 3
});
```

### Compressão - Summarizer
```javascript
// CRIAÇÃO
logger.logUserAI('summarization', {
  phase: 'compression',
  progress: 68,
  message: 'Creating AI summarizer...',
  metadata: {}
});

logger.logUserProgress('compression', 70, 'Summarizer ready', {
  icon: 'SUCCESS'
});
```

### Compressão - Por Artigo
```javascript
// INÍCIO DO ARTIGO
logger.logUserProgress('compression', 72, 'Processing article 1/3: O Globo', {
  icon: 'PROCESSING',
  articleIndex: 1,
  total: 3,
  source: 'O Globo'
});

// DETECÇÃO
logger.logUserProgress('compression', 73, 'Detecting language...', {
  icon: 'AI'
});

// TRADUÇÃO (SE NECESSÁRIO)
logger.logUserAI('translation', {
  phase: 'compression',
  progress: 74,
  message: 'Translating from Portuguese to English...',
  metadata: {
    from: 'pt',
    to: 'en',
    articleSource: 'O Globo'
  }
});

// TRADUÇÃO COMPLETA
logger.logUserProgress('compression', 78, 'Translation complete', {
  icon: 'SUCCESS',
  from: 'pt',
  to: 'en'
});

// SUMMARIZAÇÃO
logger.logUserAI('summarization', {
  phase: 'compression',
  progress: 79,
  message: 'Summarizing with AI...',
  metadata: {
    articleSource: 'O Globo'
  }
});

// ARTIGO COMPLETO
logger.logUserProgress('compression', 83, 'Article 1/3 complete', {
  icon: 'SUCCESS',
  source: 'O Globo',
  compressionRatio: '77.5%'
});
```

### Análise - Stages
```javascript
// ANTES Stage 1
logger.logUserAI('analysis', {
  phase: 'analysis',
  progress: 85,
  message: 'Starting Context & Trust analysis...',
  metadata: { stage: 1 }
});

// DEPOIS Stage 1
logger.logUserProgress('analysis', 88, 'Context & Trust complete', {
  icon: 'SUCCESS',
  stage: 1
});

// Repetir para stages 2, 3, 4...
```

### Conclusão
```javascript
logger.logUserProgress('complete', 100, 'Analysis complete!', {
  icon: 'SUCCESS',
  articlesAnalyzed: 3,
  totalDuration: '2m18s'
});
```

---

## RESUMO EXECUTIVO

### O QUE ESTÁ ERRADO AGORA

1. **Usuário fica 98s (1min38s) vendo "AI summarizing..."** sem saber se travou
   - Não mostra traduções longas (21s + 75s)
   - Não mostra progresso por artigo
   - Progress fica parado em 75%

2. **Usuário fica 15s vendo "Processing 3 articles..."** sem feedback
   - Não mostra quando cada artigo é extraído
   - Progress fica parado em 50%

3. **Logs aparecem DEPOIS das operações**, não ANTES
   - Stage logs aparecem quando stage já acabou
   - Usuário vê "AI analyzing..." APÓS análise completar

4. **Traduções são completamente invisíveis**
   - Pre-tradução (1.3s) - invisível
   - Tradução pt→en (21s) - **INVISÍVEL**
   - Tradução ru→en (75s) - **INVISÍVEL - CRÍTICO**

### O QUE FAZER

1. ✅ **Adicionar logs em translator.js**
   - Mostrar ANTES de traduzir
   - Mostrar DEPOIS de traduzir
   - Adicionar suporte para progressContext

2. ✅ **Adicionar logs em summarizer.js**
   - Mostrar criação do summarizer (6s)
   - Mostrar progresso POR ARTIGO
   - Mostrar detecção de idioma
   - Mostrar tradução (com progress)
   - Mostrar summarização
   - Atualizar progress incrementalmente

3. ✅ **Adicionar logs em contentExtractor.js**
   - Mostrar progresso POR ARTIGO
   - Mostrar quando cada artigo completa
   - Atualizar progress incrementalmente

4. ✅ **Adicionar logs em newsFetcher.js**
   - Mostrar pre-tradução por idioma
   - Mostrar busca por país
   - Atualizar progress incrementalmente

5. ✅ **Adicionar logs em languageModel.js**
   - Mostrar ANTES de cada stage iniciar
   - Manter logs DEPOIS (via callback)

### IMPACTO ESPERADO

**Antes**:
- Usuário vê "AI summarizing..." por 98s
- Parece travado
- Nenhum feedback

**Depois**:
- "Creating AI summarizer..." (6s)
- "Processing article 1/3: O Globo"
  - "Detecting language..."
  - "Translating from Portuguese to English..." (21s com progress)
  - "Summarizing with AI..." (9s)
  - "Article 1/3 complete"
- "Processing article 2/3: PCR News"
  - "Detecting language..."
  - "Translating from Russian to English..." (75s com progress)
  - "Summarizing with AI..." (16s)
  - "Article 2/3 complete"
- "Processing article 3/3: Yahoo"
  - "Detecting language..."
  - "Summarizing with AI..." (18s)
  - "Article 3/3 complete"
- "All articles compressed"
- Progress atualiza de 70% → 85% gradualmente

**Resultado**: Usuário sempre sabe o que está acontecendo, nunca fica >5s sem feedback.

---

## PRÓXIMOS PASSOS

1. ✅ **Revisar este documento** - Está completo e preciso?
2. ⏳ **Implementar translator.js** - Adicionar logs de tradução
3. ⏳ **Implementar summarizer.js** - Adicionar logs de compression detalhados
4. ⏳ **Implementar contentExtractor.js** - Adicionar logs de extraction por artigo
5. ⏳ **Implementar newsFetcher.js** - Adicionar logs de pre-tradução e busca
6. ⏳ **Implementar languageModel.js** - Adicionar logs ANTES dos stages
7. ⏳ **Testar end-to-end** - Verificar que todos os logs aparecem corretamente
8. ⏳ **Ajustar timings** - Calibrar progress values baseado em testes reais

---

**Documento criado em**: 2025-10-23
**Baseado em**: console.txt (análise linha por linha)
**Autor**: Claude (análise detalhada)
**Status**: ✅ COMPLETO - Pronto para implementação
