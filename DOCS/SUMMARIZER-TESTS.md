# 🧪 Testes Manuais - Summarizer API

## 🎯 Feature F-005: Summarização de Artigos

### **Funcionalidades Implementadas:**

✅ **Tradução bidirecional automática**
- Input em qualquer idioma → traduz para inglês → resume → traduz de volta

✅ **4 tipos de resumo:**
- `key-points`: Lista de pontos-chave (padrão)
- `tldr`: Resumo curto e direto
- `teaser`: Preview envolvente
- `headline`: Geração de título

✅ **3 tamanhos:**
- `short`: Curto (3 pontos ou 1 frase)
- `medium`: Médio (5 pontos ou 3 frases) - padrão
- `long`: Longo (7 pontos ou 5 frases)

✅ **2 formatos:**
- `markdown`: Com formatação (padrão)
- `plain-text`: Texto simples

---

## 🧪 Como Testar

### **Setup:**
1. Recarregar extensão: `chrome://extensions` → Reload
2. Abrir console do Background Worker
3. Copiar e colar os testes abaixo

---

## Teste 1: Verificar Disponibilidade

```javascript
import { checkSummarizerAvailability } from './api/summarizer.js';

const availability = await checkSummarizerAvailability();
console.log('Summarizer availability:', availability);

// Expected: "available" ou "downloadable"
```

---

## Teste 2: Resumo Simples (Inglês)

```javascript
import { summarize } from './api/summarizer.js';

const text = `
Climate change is accelerating at an alarming rate. Scientists warn that
global temperatures have risen by 1.2°C since pre-industrial times. The
consequences include rising sea levels, extreme weather events, and threats
to biodiversity. Immediate action is needed to reduce carbon emissions and
transition to renewable energy sources. World leaders are meeting to discuss
comprehensive climate policies and international cooperation.
`;

const summary = await summarize(text, {
  type: 'key-points',
  length: 'medium',
  language: 'en'
});

console.log('Summary:', summary);

// Expected: 5 bullet points about climate change
```

---

## Teste 3: Resumo com Tradução Automática (Português → Inglês → Português)

```javascript
import { summarize } from './api/summarizer.js';

const textoPT = `
A mudança climática está acelerando em ritmo alarmante. Cientistas alertam
que as temperaturas globais aumentaram 1,2°C desde a era pré-industrial.
As consequências incluem aumento do nível do mar, eventos climáticos extremos
e ameaças à biodiversidade. Ação imediata é necessária para reduzir emissões
de carbono e fazer a transição para fontes de energia renovável. Líderes
mundiais estão se reunindo para discutir políticas climáticas abrangentes
e cooperação internacional.
`;

const resumoPT = await summarize(textoPT, {
  type: 'key-points',
  length: 'medium',
  language: 'pt', // ou deixe auto-detectar
  translateBack: true // padrão é true
});

console.log('Resumo (PT):', resumoPT);

// Expected: 5 bullet points EM PORTUGUÊS
// Logs esperados:
// [PerspectiveLens] Using provided language: pt
// [PerspectiveLens] Translating text: pt → en
// [PerspectiveLens] Summarizing...
// [PerspectiveLens] ✅ Summary generated
// [PerspectiveLens] Translating summary back: en → pt
```

---

## Teste 4: Gerar Headline

```javascript
import { generateHeadline } from './api/summarizer.js';

const article = `
Breaking news: The Nobel Peace Prize committee announced today that Venezuelan
opposition leader María Corina Machado has been awarded the 2025 Nobel Peace
Prize for her unwavering commitment to democracy and human rights in Venezuela.
The decision comes amid ongoing political turmoil in the country.
`;

const headline = await generateHeadline(article, { language: 'en' });

console.log('Generated headline:', headline);

// Expected: "Venezuelan Opposition Leader Wins Nobel Peace Prize" (ou similar)
```

---

## Teste 5: Gerar TL;DR

```javascript
import { generateTLDR } from './api/summarizer.js';

const longText = `
[Cole aqui o conteúdo completo de um artigo da Folha/G1]
`;

const tldr = await generateTLDR(longText, {
  length: 'short',
  language: 'pt'
});

console.log('TL;DR:', tldr);

// Expected: 1-3 frases resumindo o artigo
```

---

## Teste 6: Batch Summarization

```javascript
import { summarizeBatch } from './api/summarizer.js';

const articles = [
  'Climate summit reaches historic agreement on carbon emissions...',
  'New technology promises to revolutionize renewable energy sector...',
  'Scientists warn about accelerating ice melt in polar regions...'
];

const summaries = await summarizeBatch(articles, {
  type: 'tldr',
  length: 'short'
});

console.log('Batch summaries:', summaries);

// Expected: Array com 3 resumos curtos
```

---

## Teste 7: Fluxo Completo - Artigo Real

```javascript
import { summarize } from './api/summarizer.js';

// 1. Visite um artigo da Folha/G1
// 2. Copie o conteúdo completo
// 3. Cole aqui:

const articleContent = `
[Conteúdo do artigo completo]
`;

const summary = await summarize(articleContent, {
  type: 'key-points',
  length: 'medium',
  translateBack: true // Resume e traduz de volta para PT
});

console.log('=== RESUMO DO ARTIGO ===');
console.log(summary);
```

---

## 📊 Logs Esperados (Fluxo Completo)

### **Artigo em Português:**

```
[PerspectiveLens] Auto-detecting language for summarization...
[PerspectiveLens] Detected language: pt
[PerspectiveLens] Translating text: pt → en
[PerspectiveLens] Creating translator: Portuguese → English
[PerspectiveLens] Translator created: pt→en
[PerspectiveLens] Translation completed: Portuguese → English
[PerspectiveLens] Translated 2456 chars for summarization
[PerspectiveLens] Creating summarizer: type=key-points, length=medium, format=markdown
[PerspectiveLens] Summarizer API availability: available
[PerspectiveLens] Summarizer created successfully
[PerspectiveLens] Summarizing 2134 chars (key-points, medium)
[PerspectiveLens] ✅ Summary generated (423 chars)
[PerspectiveLens] Translating summary back: en → pt
[PerspectiveLens] Creating translator: English → Portuguese
[PerspectiveLens] Translator created: en→pt
[PerspectiveLens] Translation completed: English → Portuguese
[PerspectiveLens] ✅ Summary translated back to original language
```

### **Artigo em Inglês:**

```
[PerspectiveLens] Using provided language: en
[PerspectiveLens] No translation needed (already in en)
[PerspectiveLens] Creating summarizer: type=key-points, length=medium, format=markdown
[PerspectiveLens] Summarizer created successfully
[PerspectiveLens] Summarizing 1845 chars (key-points, medium)
[PerspectiveLens] ✅ Summary generated (387 chars)
```

---

## ✅ Checklist de Validação

### Disponibilidade
- [ ] API disponível (availability check)
- [ ] Download de modelo funciona (se necessário)

### Resumo Básico
- [ ] Resume texto em inglês
- [ ] Gera 5 bullet points (medium)
- [ ] Formato markdown correto
- [ ] Tamanho adequado (não muito longo/curto)

### Tradução Bidirecional
- [ ] Detecta idioma português
- [ ] Traduz PT→EN antes de resumir
- [ ] Resume em inglês
- [ ] Traduz resumo EN→PT
- [ ] Resumo final em português faz sentido

### Tipos de Resumo
- [ ] `key-points` gera bullets
- [ ] `tldr` gera frases curtas
- [ ] `headline` gera título
- [ ] `teaser` gera preview envolvente

### Tamanhos
- [ ] `short` é mais curto
- [ ] `medium` é balanceado
- [ ] `long` é mais detalhado

### Edge Cases
- [ ] Texto muito curto (< 50 chars) gera warning
- [ ] Texto vazio retorna erro
- [ ] Batch processa múltiplos textos
- [ ] Erro em um item não quebra batch

---

## 🎯 Próximos Passos

Quando validar que Summarizer funciona:
✅ **Integrar ao pipeline do background.js**
✅ **Criar NewsAPI integration (F-003)**

---

**Última Atualização:** 10 de Janeiro de 2025
