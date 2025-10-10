# 🧪 Testando APIs no Console do Background Worker

## 🎯 Setup Inicial

### 1. **Recarregar a extensão:**
```
chrome://extensions → Reload
```

### 2. **Abrir console do Background Worker:**
```
chrome://extensions → Clicar em "service worker" no PerspectiveLens
```

### 3. **Aguardar APIs carregarem:**
Você verá estas mensagens no console:
```
[PerspectiveLens] Background service worker initialized
[PerspectiveLens] 📝 Summarizer API loaded - Access via: summarizerAPI.summarize()
[PerspectiveLens] 🌐 Translator API loaded - Access via: translatorAPI.translate()
[PerspectiveLens] 🔍 Language Detector API loaded - Access via: languageDetectorAPI.detectLanguageSimple()
[PerspectiveLens] 🤖 Language Model API loaded - Access via: languageModelAPI.extractKeywords()
[PerspectiveLens] 💡 All APIs will be available in ~1 second
```

---

## 📋 APIs Disponíveis no Console

Depois do carregamento, você pode usar diretamente:

- ✅ `summarizerAPI` - Resumir textos
- ✅ `translatorAPI` - Traduzir textos
- ✅ `languageDetectorAPI` - Detectar idiomas
- ✅ `languageModelAPI` - Extrair keywords

---

## 🧪 TESTES - Summarizer API

### Teste 1: Verificar Disponibilidade

```javascript
const availability = await summarizerAPI.checkSummarizerAvailability();
console.log('Summarizer availability:', availability);

// Expected: "available" ou "downloadable"
```

### Teste 2: Resumo Simples (Inglês)

```javascript
const text = `
Climate change is accelerating at an alarming rate. Scientists warn that
global temperatures have risen by 1.2°C since pre-industrial times. The
consequences include rising sea levels, extreme weather events, and threats
to biodiversity. Immediate action is needed to reduce carbon emissions and
transition to renewable energy sources. World leaders are meeting to discuss
comprehensive climate policies and international cooperation.
`;

const summary = await summarizerAPI.summarize(text, {
  type: 'key-points',
  length: 'medium',
  language: 'en'
});

console.log('=== SUMMARY ===');
console.log(summary);

// Expected: 5 bullet points sobre mudança climática
```

### Teste 3: Resumo em Português (com tradução bidirecional)

```javascript
const textoPT = `
A mudança climática está acelerando em ritmo alarmante. Cientistas alertam
que as temperaturas globais aumentaram 1,2°C desde a era pré-industrial.
As consequências incluem aumento do nível do mar, eventos climáticos extremos
e ameaças à biodiversidade. Ação imediata é necessária para reduzir emissões
de carbono e fazer a transição para fontes de energia renovável. Líderes
mundiais estão se reunindo para discutir políticas climáticas abrangentes
e cooperação internacional.
`;

const resumoPT = await summarizerAPI.summarize(textoPT, {
  type: 'key-points',
  length: 'medium',
  language: 'pt',
  translateBack: true
});

console.log('=== RESUMO (PT) ===');
console.log(resumoPT);

// Expected: 5 bullet points EM PORTUGUÊS
```

### Teste 4: Gerar Headline

```javascript
const article = `
Breaking news: The Nobel Peace Prize committee announced today that Venezuelan
opposition leader María Corina Machado has been awarded the 2025 Nobel Peace
Prize for her unwavering commitment to democracy and human rights in Venezuela.
The decision comes amid ongoing political turmoil in the country.
`;

const headline = await summarizerAPI.generateHeadline(article, { language: 'en' });

console.log('=== GENERATED HEADLINE ===');
console.log(headline);

// Expected: "Venezuelan Opposition Leader Wins Nobel Peace Prize" (ou similar)
```

### Teste 5: TL;DR

```javascript
const longText = `
[Cole aqui o texto completo de um artigo]
`;

const tldr = await summarizerAPI.generateTLDR(longText, {
  length: 'short',
  language: 'pt'
});

console.log('=== TL;DR ===');
console.log(tldr);

// Expected: 1-3 frases resumindo
```

---

## 🧪 TESTES - Translator API

### Teste: Traduzir Português → Inglês

```javascript
const textoPT = 'Brasil anuncia nova política climática para redução de carbono';

const translated = await translatorAPI.translate(textoPT, 'pt', 'en');

console.log('Original (PT):', textoPT);
console.log('Translated (EN):', translated);

// Expected: "Brazil announces new climate policy for carbon reduction"
```

### Teste: Traduzir Inglês → Português

```javascript
const textoEN = 'Climate summit reaches historic agreement';

const traduzido = await translatorAPI.translate(textoEN, 'en', 'pt');

console.log('Original (EN):', textoEN);
console.log('Traduzido (PT):', traduzido);

// Expected: "Cúpula climática alcança acordo histórico"
```

---

## 🧪 TESTES - Language Detector API

### Teste: Detectar Idioma

```javascript
const texto1 = 'Brasil anuncia nova lei climática';
const lang1 = await languageDetectorAPI.detectLanguageSimple(texto1);
console.log(`"${texto1}" → ${lang1}`);
// Expected: pt

const texto2 = 'Climate change is a global crisis';
const lang2 = await languageDetectorAPI.detectLanguageSimple(texto2);
console.log(`"${texto2}" → ${lang2}`);
// Expected: en

const texto3 = '中国宣布新的气候政策';
const lang3 = await languageDetectorAPI.detectLanguageSimple(texto3);
console.log(`"${texto3}" → ${lang3}`);
// Expected: zh
```

---

## 🧪 TESTES - Language Model API

### Teste: Extrair Keywords

```javascript
const title = 'Brasil anuncia nova política climática para redução de carbono';

const keywords = await languageModelAPI.extractKeywords(title);

console.log('Title:', title);
console.log('Keywords:', keywords);

// Expected: ['brazil', 'climate', 'policy', 'carbon', 'reduction']
```

---

## 🔧 Comandos Úteis

### Ver funções disponíveis em uma API:

```javascript
// Ver todas as funções do Summarizer
console.log(Object.keys(summarizerAPI));

// Ver funções do Translator
console.log(Object.keys(translatorAPI));

// Ver funções do Language Detector
console.log(Object.keys(languageDetectorAPI));

// Ver funções do Language Model
console.log(Object.keys(languageModelAPI));
```

### Limpar console:

```javascript
clear()
```

---

## 📊 Logs Esperados

### Summarizer (PT → EN → PT):

```
[PerspectiveLens] Auto-detecting language for summarization...
[PerspectiveLens] Detected language: pt
[PerspectiveLens] Translating text: pt → en
[PerspectiveLens] Creating translator: Portuguese → English
[PerspectiveLens] Translation pt→en: available
[PerspectiveLens] Translator created: pt→en
[PerspectiveLens] Translating 324 chars: pt→en
[PerspectiveLens] Translation completed: Portuguese → English
[PerspectiveLens] Translated 324 chars for summarization
[PerspectiveLens] Creating summarizer: type=key-points, length=medium, format=markdown
[PerspectiveLens] Summarizer API availability: available
[PerspectiveLens] Summarizer created successfully
[PerspectiveLens] Summarizing 287 chars (key-points, medium)
[PerspectiveLens] ✅ Summary generated (156 chars)
[PerspectiveLens] Translating summary back: en → pt
[PerspectiveLens] Creating translator: English → Portuguese
[PerspectiveLens] Translator created: en→pt
[PerspectiveLens] Translation completed: English → Portuguese
[PerspectiveLens] ✅ Summary translated back to original language
```

---

## 🚨 Troubleshooting

### "summarizerAPI is not defined"
**Solução:** Aguardar 1-2 segundos após recarregar. Verificar se viu a mensagem `💡 All APIs will be available`.

### "Summarizer API not available"
**Solução:** Verificar flags do Chrome:
- `chrome://flags/#summarization-api-for-gemini-nano` → Enabled

### "Translator API not available"
**Solução:** Verificar flags do Chrome:
- `chrome://flags/#translation-api` → Enabled

### "LanguageDetector is not defined"
**Solução:** Verificar flags do Chrome:
- `chrome://flags/#language-detection-api` → Enabled

### Modelo downloading...
**Solução:** Aguardar download completar (pode levar minutos na primeira vez).

---

## ✅ Teste Rápido Completo

Cole isto no console para testar tudo de uma vez:

```javascript
// Teste rápido de todas as APIs
console.log('🧪 Iniciando testes...\n');

// 1. Language Detector
const lang = await languageDetectorAPI.detectLanguageSimple('Brasil anuncia nova lei');
console.log('✅ Language Detector:', lang);

// 2. Translator
const translated = await translatorAPI.translate('Hello world', 'en', 'pt');
console.log('✅ Translator:', translated);

// 3. Language Model
const keywords = await languageModelAPI.extractKeywords('Climate change summit');
console.log('✅ Keywords:', keywords);

// 4. Summarizer
const summary = await summarizerAPI.summarize('Climate change is real. We need action.', {
  type: 'tldr',
  length: 'short',
  language: 'en'
});
console.log('✅ Summarizer:', summary);

console.log('\n🎉 Todos os testes passaram!');
```

---

**Última Atualização:** 10 de Janeiro de 2025
