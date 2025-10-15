# Manual Testing Guide - PerspectiveLens

## 🧪 Como Testar Cada Feature

Este documento contém instruções para testar manualmente cada feature implementada, usando o console do Chrome DevTools.

---

## Setup Inicial

### 1. Abrir DevTools

**Para Background Worker:**
1. Abrir `chrome://extensions`
2. Encontrar "PerspectiveLens"
3. Clicar em **"service worker"**
4. Console do background abrirá

**Para Popup:**
1. Clicar no ícone da extensão
2. Right-click no popup → **Inspect**
3. Console do popup abrirá

---

## Feature 1: Language Detector API ✅

### Teste 1.1: Verificar Disponibilidade

```javascript
// No console do background worker
import { checkLanguageDetectorAvailability } from './api/languageDetector.js';

const availability = await checkLanguageDetectorAvailability();
console.log('LanguageDetector availability:', availability);
// Expected: "available" ou "downloadable"
```

### Teste 1.2: Detectar Inglês

```javascript
import { detectLanguage } from './api/languageDetector.js';

const text = 'Breaking news: Climate summit reaches historic agreement';
const result = await detectLanguage(text);

console.log('Detected language:', result.language); // Expected: "en"
console.log('Confidence:', result.confidence);       // Expected: > 0.9
console.log('Alternatives:', result.alternatives);
```

### Teste 1.3: Detectar Português

```javascript
import { detectLanguage } from './api/languageDetector.js';

const text = 'Brasil aprova nova lei do clima';
const result = await detectLanguage(text);

console.log('Detected language:', result.language); // Expected: "pt"
console.log('Confidence:', result.confidence);       // Expected: > 0.9
```

### Teste 1.4: Detectar Chinês

```javascript
import { detectLanguage } from './api/languageDetector.js';

const text = '中国达成历史性气候协议';
const result = await detectLanguage(text);

console.log('Detected language:', result.language); // Expected: "zh"
console.log('Confidence:', result.confidence);
```

### Teste 1.5: Detectar Árabe

```javascript
import { detectLanguage } from './api/languageDetector.js';

const text = 'اتفاق تاريخي بشأن تغير المناخ';
const result = await detectLanguage(text);

console.log('Detected language:', result.language); // Expected: "ar"
console.log('Confidence:', result.confidence);
```

### Teste 1.6: Detecção Simples (com fallback)

```javascript
import { detectLanguageSimple } from './api/languageDetector.js';

const lang1 = await detectLanguageSimple('Climate change is real');
console.log('Language:', lang1); // Expected: "en"

const lang2 = await detectLanguageSimple('Mudança climática é real');
console.log('Language:', lang2); // Expected: "pt"

const lang3 = await detectLanguageSimple('气候变化');
console.log('Language:', lang3); // Expected: "zh"
```

---

## Feature 2: Translator API ✅

### Teste 2.1: Verificar Disponibilidade

```javascript
import { checkTranslatorAvailability } from './api/translator.js';

const available = await checkTranslatorAvailability();
console.log('Translator API available:', available);
// Expected: true
```

### Teste 2.2: Verificar Pares de Idiomas

```javascript
import { canTranslate } from './api/translator.js';

// Testar en→pt
const enPt = await canTranslate('en', 'pt');
console.log('en→pt available:', enPt); // Expected: true

// Testar zh→pt
const zhPt = await canTranslate('zh', 'pt');
console.log('zh→pt available:', zhPt); // Expected: true

// Testar ar→pt
const arPt = await canTranslate('ar', 'pt');
console.log('ar→pt available:', arPt); // Expected: true
```

### Teste 2.3: Traduzir Inglês → Português

```javascript
import { translate } from './api/translator.js';

const original = 'Breaking news: Climate summit reaches historic agreement on carbon emissions';
console.log('Original (EN):', original);

const translated = await translate(original, 'en', 'pt');
console.log('Translated (PT):', translated);

// Expected: Texto traduzido para português
// Exemplo: "Últimas notícias: Cúpula do clima alcança acordo histórico sobre emissões de carbono"
```

### Teste 2.4: Traduzir Chinês → Português

```javascript
import { translate } from './api/translator.js';

const original = '中国达成历史性气候协议';
console.log('Original (ZH):', original);

const translated = await translate(original, 'zh', 'pt');
console.log('Translated (PT):', translated);

// Expected: Texto traduzido para português
```

### Teste 2.5: Pular Tradução (mesmo idioma)

```javascript
import { translate } from './api/translator.js';

const original = 'Este texto já está em português';
console.log('Original (PT):', original);

const result = await translate(original, 'pt', 'pt');
console.log('Result:', result);

// Expected: Mesmo texto (não traduz pt→pt)
console.assert(result === original, 'Should skip translation');
```

### Teste 2.6: Tradução em Lote

```javascript
import { translateBatch } from './api/translator.js';

const texts = [
  'Climate change is a global challenge',
  'World leaders meet to discuss solutions',
  'New technology could reduce emissions'
];

console.log('Original texts (EN):', texts);

const translations = await translateBatch(texts, 'en', 'pt');
console.log('Translated texts (PT):', translations);

// Expected: Array com 3 textos traduzidos
console.assert(translations.length === 3, 'Should translate all texts');
```

### Teste 2.7: Verificar Necessidade de Tradução

```javascript
import { needsTranslation } from './api/translator.js';

console.log('en needs translation:', needsTranslation('en')); // true
console.log('pt needs translation:', needsTranslation('pt')); // false
console.log('zh needs translation:', needsTranslation('zh')); // true
console.log('ar needs translation:', needsTranslation('ar')); // true
```

---

## Feature 3: Fluxo Integrado (Language Detector + Translator)

### Teste 3.1: Detectar e Traduzir Automaticamente

```javascript
import { detectLanguageSimple } from './api/languageDetector.js';
import { translate, needsTranslation } from './api/translator.js';

async function detectAndTranslate(text) {
  console.log('Original:', text);

  // Detectar idioma
  const lang = await detectLanguageSimple(text);
  console.log('Detected language:', lang);

  // Traduzir se necessário
  if (needsTranslation(lang)) {
    const translated = await translate(text, lang, 'pt');
    console.log('Translated:', translated);
    return translated;
  } else {
    console.log('Already in Portuguese, no translation needed');
    return text;
  }
}

// Testar com inglês
await detectAndTranslate('Climate change is a global crisis');

// Testar com chinês
await detectAndTranslate('气候变化是全球危机');

// Testar com português
await detectAndTranslate('Mudança climática é uma crise global');
```

### Teste 3.2: Processar Múltiplas Perspectivas

```javascript
import { detectLanguageSimple } from './api/languageDetector.js';
import { translate } from './api/translator.js';

const perspectives = [
  { source: 'NYT', text: 'US announces new climate policy' },
  { source: 'Xinhua', text: '中国支持气候行动' },
  { source: 'BBC', text: 'Climate summit yields agreement' },
  { source: 'Folha', text: 'Brasil apoia acordo climático' }
];

for (const p of perspectives) {
  console.group(`Processing: ${p.source}`);

  const lang = await detectLanguageSimple(p.text);
  console.log('Language:', lang);

  const translated = await translate(p.text, lang, 'pt');
  console.log('Translated:', translated);

  console.groupEnd();
}
```

---

## ✅ Checklist de Testes

### Language Detector API
- [ ] API disponível (availability check)
- [ ] Detecta inglês corretamente
- [ ] Detecta português corretamente
- [ ] Detecta chinês corretamente
- [ ] Detecta árabe corretamente
- [ ] Fallback funciona para texto ambíguo
- [ ] Confidence score > 0.7 para textos claros

### Translator API
- [ ] API disponível (availability check)
- [ ] Traduz en→pt corretamente
- [ ] Traduz zh→pt corretamente
- [ ] Traduz ar→pt corretamente
- [ ] Traduz es→pt corretamente
- [ ] Pula tradução pt→pt (mesmo idioma)
- [ ] Tradução em lote funciona
- [ ] needsTranslation() retorna correto

### Integração
- [ ] Detectar + Traduzir em sequência funciona
- [ ] Múltiplas perspectivas processadas corretamente
- [ ] Logs aparecem no console do background
- [ ] Erros são tratados gracefully

---

## 🐛 Problemas Comuns

### "LanguageDetector is not defined"
**Causa:** Chrome version < 138 ou flag não habilitada
**Solução:**
1. Verificar Chrome version: `chrome://version`
2. Habilitar flag: `chrome://flags/#language-detection-api` → "Enabled"
3. Reiniciar Chrome completamente

### "Translator API not available"
**Causa:** Flag não habilitada
**Solução:**
1. Habilitar flag: `chrome://flags/#translation-api` → "Enabled"
2. Reiniciar Chrome completamente

### "Model downloading..."
**Causa:** Modelos ainda sendo baixados
**Solução:**
1. Aguardar download completar (pode levar alguns minutos)
2. Monitor progress nos logs: `Downloaded X%`
3. **IMPORTANTE:** Pode fechar popup, download continua em background!

### Tradução retorna texto original
**Causa:** Modelo ainda não disponível ou idioma não suportado
**Solução:**
1. Verificar se `canTranslate(lang, 'pt')` retorna true
2. Aguardar download de modelos
3. Ver logs para detalhes do erro

---

## 📊 Logs Esperados

### Sucesso - Language Detection
```
[PerspectiveLens] LanguageDetector availability: available
[PerspectiveLens] Creating LanguageDetector...
[PerspectiveLens] LanguageDetector created successfully
[PerspectiveLens] Detected language: en (confidence: 99.8%)
```

### Sucesso - Translation
```
[PerspectiveLens] Translator API available: true
[PerspectiveLens] Creating translator: en→pt
[PerspectiveLens] Translator created successfully
[PerspectiveLens] Translating 85 chars: en→pt
[PerspectiveLens] Translation completed successfully
```

### Download de Modelo
```
[PerspectiveLens] LanguageDetector download: 10%
[PerspectiveLens] LanguageDetector download: 45%
[PerspectiveLens] LanguageDetector download: 100%
```

---

---

## Feature 4: Integração Completa (Detector + Translator + Prompt API) ✅

### Teste 4.1: Extrair Keywords de Título em Inglês

```javascript
import { extractKeywords } from './api/languageModel.js';

const title = 'Biden announces new climate policy for carbon reduction';
console.log('Title (EN):', title);

const keywords = await extractKeywords(title);
console.log('Keywords:', keywords);

// Expected: ['biden', 'climate', 'policy', 'carbon', 'reduction']
// Logs esperados:
// [PerspectiveLens] Auto-detecting language for title: ...
// [PerspectiveLens] Detected language: en
// [PerspectiveLens] Extracting keywords from: Biden announces...
// [PerspectiveLens] Extracted keywords: [...]
```

### Teste 4.2: Extrair Keywords de Título em Português (com tradução automática)

```javascript
import { extractKeywords } from './api/languageModel.js';

const title = 'Brasil anuncia nova política climática para redução de carbono';
console.log('Title (PT):', title);

const keywords = await extractKeywords(title);
console.log('Keywords:', keywords);

// Expected: keywords em inglês (ex: ['brazil', 'climate', 'policy', ...])
// Logs esperados:
// [PerspectiveLens] Auto-detecting language for title: Brasil anuncia...
// [PerspectiveLens] Detected language: pt
// [PerspectiveLens] Translating title to English for Prompt API...
// [PerspectiveLens] Translated title: Brazil announces new climate policy...
// [PerspectiveLens] Extracting keywords from: Brazil announces...
// [PerspectiveLens] Extracted keywords: [...]
```

### Teste 4.3: Extrair Keywords de Título em Chinês

```javascript
import { extractKeywords } from './api/languageModel.js';

const title = '中国宣布新的气候政策以减少碳排放';
console.log('Title (ZH):', title);

const keywords = await extractKeywords(title);
console.log('Keywords:', keywords);

// Expected: keywords em inglês após tradução
// Logs esperados:
// [PerspectiveLens] Auto-detecting language for title: 中国宣布...
// [PerspectiveLens] Detected language: zh
// [PerspectiveLens] Translating title to English for Prompt API...
// [PerspectiveLens] Translated title: China announces new climate policy...
// [PerspectiveLens] Extracting keywords from: China announces...
// [PerspectiveLens] Extracted keywords: [...]
```

### Teste 4.4: Extrair Keywords de Título em Árabe

```javascript
import { extractKeywords } from './api/languageModel.js';

const title = 'الصين تعلن سياسة مناخية جديدة للحد من انبعاثات الكربون';
console.log('Title (AR):', title);

const keywords = await extractKeywords(title);
console.log('Keywords:', keywords);

// Expected: keywords em inglês após tradução
```

### Teste 4.5: Testar com Artigo Real Detectado

```javascript
// No console do background worker, após visitar um site de notícias

// Enviar mensagem simulando detecção de artigo
chrome.runtime.sendMessage({
  type: 'NEW_ARTICLE_DETECTED',
  data: {
    url: 'https://www.bbc.com/news/example',
    title: 'Climate summit reaches historic agreement',
    content: 'Full article content...',
    source: 'bbc.com',
    language: 'en'
  }
}, (response) => {
  console.log('Article processed:', response);
  console.log('Keywords:', response.data.keywords);
});

// Expected response:
// {
//   success: true,
//   data: {
//     articleData: {...},
//     keywords: ['climate', 'summit', 'agreement', ...],
//     status: 'keywords_extracted',
//     timestamp: '...'
//   }
// }
```

### Teste 4.6: Testar Fallback (se APIs falharem)

```javascript
import { extractKeywords } from './api/languageModel.js';

// Simular falha forçando erro
const title = ''; // Título vazio deve usar fallback

try {
  const keywords = await extractKeywords(title);
  console.log('Fallback keywords:', keywords);
} catch (error) {
  console.error('Error:', error.message);
}

// Expected: Fallback para ['news', 'article'] ou erro graceful
```

---

## ✅ Checklist de Testes - Integração Completa

### Fluxo Básico
- [ ] Título em inglês → extrai keywords diretamente
- [ ] Título em português → detecta, traduz, extrai keywords
- [ ] Título em chinês → detecta, traduz, extrai keywords
- [ ] Título em árabe → detecta, traduz, extrai keywords
- [ ] Título em espanhol → detecta, traduz, extrai keywords
- [ ] Título em francês → detecta, traduz, extrai keywords

### Logs e Debugging
- [ ] Logs de detecção de idioma aparecem
- [ ] Logs de tradução aparecem (quando necessário)
- [ ] Logs de extração de keywords aparecem
- [ ] Keywords extraídos fazem sentido para o título
- [ ] Fallback funciona se APIs falharem

### Performance
- [ ] Detecção de idioma < 1s
- [ ] Tradução < 3s
- [ ] Extração de keywords < 2s
- [ ] Total end-to-end < 6s

---

## 🎯 Próximo Passo

Depois de validar que a integração completa funciona:
✅ Seguir para Feature 5: **Summarizer API** ([api/summarizer.js](../api/summarizer.js))

---

**Última Atualização:** 9 de Janeiro de 2025
