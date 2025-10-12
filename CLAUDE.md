# 📚 GUIA COMPLETO DO PROJETO PERSPECTIVELENS

> **Leia este documento ANTES de fazer qualquer alteração no código!**
> Este documento contém todas as informações essenciais sobre arquitetura, fluxo de dados, decisões de design e otimizações do projeto.

---

## 📋 ÍNDICE

1. [Visão Geral do Projeto](#-visão-geral-do-projeto)
2. [Arquitetura e Fluxo de Dados](#-arquitetura-e-fluxo-de-dados)
3. [Estrutura de Arquivos](#-estrutura-de-arquivos)
4. [APIs do Chrome utilizadas](#-apis-do-chrome-utilizadas)
5. [Fluxo Completo de Execução](#-fluxo-completo-de-execução)
6. [Módulos Principais](#-módulos-principais)
7. [Problemas Conhecidos e Limitações](#-problemas-conhecidos-e-limitações)
8. [Otimizações Implementadas](#-otimizações-implementadas)
9. [Configurações e Constantes](#-configurações-e-constantes)
10. [Interface do Usuário](#-interface-do-usuário)
11. [Boas Práticas e Padrões](#-boas-práticas-e-padrões)
12. [Ambiente de Desenvolvimento](#-ambiente-de-desenvolvimento)
13. [Notas Importantes](#-notas-importantes)

---

## 🎯 VISÃO GERAL DO PROJETO

**PerspectiveLens** é uma extensão do Chrome que revela como a mesma notícia é reportada globalmente, usando IA on-device (Chrome Built-in AI) para tradução, resumo e análise comparativa.

### Objetivo Principal
Combater o viés de mídia mostrando ao usuário perspectivas de diferentes países e fontes sobre a mesma história.

### Modelo Híbrido Online/Offline
- **Online (requer internet):** Busca de perspectivas via Google News RSS
- **Offline (IA local):** Tradução, resumo, análise comparativa com Gemini Nano

### Stack Tecnológico
- **Plataforma:** Chrome Extension (Manifest V3)
- **APIs:** Chrome Built-in AI (Prompt API, Summarizer API, Translator API, Language Detector API)
- **Linguagem:** JavaScript (ES6 Modules)
- **Fonte de Notícias:** Google News RSS (feed público)
- **Extração de Conteúdo:** Readability.js

**Nota:** Todas as Chrome Built-in AI APIs estão disponíveis no Chrome 138+ (Dev/Canary).

---

## 🏗️ ARQUITETURA E FLUXO DE DADOS

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHROME BROWSER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐        ┌──────────────────────────────┐   │
│  │ Content Script │◄──────►│   Background Service Worker   │   │
│  │  (content.js)  │        │      (background.js)          │   │
│  │                │        │                               │   │
│  │ - Detecta news │        │ - Coordena todo pipeline      │   │
│  │ - Extrai dados │        │ - Gerencia AI APIs            │   │
│  │ - Injeta painel│        │ - Processa análise            │   │
│  └────────────────┘        └──────────────────────────────┘   │
│         ▲                             │                         │
│         │                             ▼                         │
│         │                  ┌──────────────────────┐           │
│         │                  │    API Modules       │           │
│         │                  ├──────────────────────┤           │
│         │                  │ • languageModel.js   │           │
│         │                  │ • newsFetcher.js     │           │
│         │                  │ • contentExtractor   │           │
│         │                  │ • summarizer.js      │           │
│         │                  │ • translator.js      │           │
│         │                  └──────────────────────┘           │
│         │                                                       │
│  ┌────────────────┐                                           │
│  │ Analysis Panel │◄──────── Recebe resultado da análise      │
│  │ (panel-injector│                                           │
│  │  analysis-panel│                                           │
│  │       .js/css) │                                           │
│  └────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   External APIs  │
                    ├──────────────────┤
                    │ • Google News RSS│
                    │ • Gemini Nano    │
                    │   (local model)  │
                    └──────────────────┘
```

### Fluxo de Mensagens

```
Content Script                Background Worker              API Modules
     │                              │                             │
     ├─── NEW_ARTICLE_DETECTED ────►│                             │
     │                              ├─── extractKeywords() ───────►│
     │                              │◄───── [keywords] ────────────┤
     │                              │                             │
     │                              ├─── fetchPerspectives() ─────►│
     │                              │◄───── [articles] ────────────┤
     │                              │                             │
     │                              ├─── extractArticlesContent ──►│
     │                              │◄───── [content] ─────────────┤
     │                              │                             │
     │                              ├─── compareArticles() ───────►│
     │                              │◄───── [analysis] ────────────┤
     │                              │                             │
     │◄───── SHOW_ANALYSIS ─────────┤                             │
     │                              │                             │
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
PerspectiveLens/
│
├── manifest.json                    # Configuração da extensão
│
├── background.js                    # 🎯 Service Worker principal
│   └─ Coordena pipeline completo de análise
│
├── popup.html/js/css                # Interface do popup da extensão
│   └─ Mostra status, estatísticas, controles
│
├── scripts/
│   ├── content.js                   # 🔍 Detecta artigos de notícias
│   └── panel-injector.js            # Injeta painel de análise lateral
│
├── ui/
│   ├── analysis-panel.html          # (não usado - HTML inline)
│   ├── analysis-panel.js            # Renderiza análise comparativa
│   └── analysis-panel.css           # Estilos do painel lateral
│
├── api/                             # 🤖 Wrappers das APIs do Chrome
│   ├── languageModel.js             # Prompt API (Gemini Nano)
│   │   ├─ extractKeywords()         # Extração de palavras-chave
│   │   └─ compareArticles()         # Análise comparativa
│   │
│   ├── newsFetcher.js               # Busca no Google News RSS
│   │   └─ fetchPerspectives()       # Busca em 10 países
│   │
│   ├── contentExtractorTabs.js     # Extração com Chrome Tabs
│   │   └─ extractArticlesContentWithTabs()
│   │
│   ├── summarizer.js                # Summarizer API
│   │   ├─ summarize()               # Resumo geral
│   │   ├─ compressForAnalysis()     # Compressão para análise
│   │   └─ batchCompressForAnalysis() # Compressão em batch
│   │
│   ├── translator.js                # Translator API (preparado)
│   │   ├─ translate()               # Tradução simples
│   │   └─ translateBatch()          # Tradução em batch
│   │
│   └── languageDetector.js          # Language Detector API (preparado)
│       └─ detectLanguageSimple()    # Detecção de idioma
│
├── utils/                           # 🛠️ Utilitários
│   ├── logger.js                    # Sistema de logging centralizado
│   ├── errors.js                    # Classes de erro customizadas
│   ├── prompts.js                   # Carregador de prompts externos
│   ├── languages.js                 # Normalização de códigos de idioma
│   └── contentValidator.js          # Validação de conteúdo extraído
│
├── prompts/                         # 📝 Templates de prompts de IA
│   ├── keyword-extraction.txt       # Prompt para extração de keywords
│   ├── comparative-analysis.txt     # Prompt v1 (obsoleto)
│   ├── comparative-analysis-v2.txt  # Prompt v2 com few-shot examples
│   ├── comparative-analysis-v3-simple.txt
│   └── comparative-analysis-schema.json # JSON Schema para output
│
├── offscreen/
│   ├── offscreen.html               # Documento offscreen (se necessário)
│   ├── offscreen.js                 # Script offscreen
│   └── readability.js               # Biblioteca Readability.js
│
├── images/                          # Ícones da extensão
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
│
├── DOCS/                            # Documentação de referência
│   ├── chrome-ai.txt
│   ├── prompt-ai.txt
│   ├── summarizer.txt
│   ├── translator.txt
│   └── ...
│
├── README.md                        # Documentação pública
├── GUIA-MVP.md                      # PRD em português
├── SETUP-GUIDE.md                   # Guia de instalação
└── CLAUDE.md                        # 👈 ESTE ARQUIVO
```

### Arquivos Não Rastreados (Verificar .gitignore)
- `.env` (contém API keys - NÃO commitar!)
- `node_modules/` (se houver)

---

## 🤖 APIS DO CHROME UTILIZADAS

### 1. **Prompt API (Gemini Nano)** ✅ Implementado
- **Status:** Disponível no Chrome 138+ (Dev/Canary)
- **Uso:** Extração de keywords, análise comparativa
- **Arquivo:** `api/languageModel.js`
- **Funções:**
  - `extractKeywords(title, language)` - Extrai 3-5 palavras-chave
  - `compareArticles(perspectives, options)` - Análise comparativa estruturada
- **Características:**
  - Suporta JSON Schema Constraint (output estruturado garantido)
  - Context window limitado (~8000 chars seguros)
  - Trabalha melhor com input em inglês
  - Usa prompts externos em `/prompts`

### 2. **Summarizer API** ✅ Implementado
- **Status:** Disponível no Chrome 138+
- **Uso:** Compressão de artigos para análise comparativa
- **Arquivo:** `api/summarizer.js`
- **Tipos:**
  - `key-points` - Lista de pontos-chave
  - `teaser` - Preview conciso (usado para compressão)
  - `headline` - Título do artigo
- **Comprimentos:** `short`, `medium`, `long`
- **Compressão:** 70-80% de redução no tamanho do conteúdo

### 3. **Translator API** ✅ Implementado
- **Status:** Disponível no Chrome 138+ (Dev/Canary)
- **Uso:** Tradução de textos entre idiomas diferentes
- **Arquivo:** `api/translator.js`
- **Funções:**
  - `translate(text, sourceLanguage, targetLanguage)` - Tradução simples
  - `translateBatch(texts, sourceLanguage, targetLanguage)` - Tradução em batch (reutiliza tradutor)
  - `canTranslate(sourceLanguage, targetLanguage)` - Verifica disponibilidade do par de idiomas
  - `createTranslator(sourceLanguage, targetLanguage)` - Cria instância de tradutor
- **Características:**
  - Usa **language packs** (modelos especializados por par de idiomas)
  - Download on-demand de pares de idiomas conforme necessário
  - Suporta **BCP 47 language codes** (ex: 'es', 'fr', 'pt', 'en', 'de', 'ar', 'zh', 'ja')
  - Processamento **sequencial** (traduções são enfileiradas)
  - API `translateStreaming()` disponível para textos muito longos
  - Normalização automática de códigos de idioma
- **Download:**
  - Status de download é **privado** por design (protege privacidade do usuário)
  - Não revela quais pares de idiomas o usuário está baixando
  - Progresso pode ser monitorado com evento `downloadprogress`
- **Performance:**
  - Para grandes volumes, agrupar textos e usar loading UI
  - Traduções sequenciais bloqueiam próximas até completarem

### 4. **Language Detector API** ✅ Implementado
- **Status:** Disponível no Chrome 138+ (Dev/Canary)
- **Uso:** Detecção automática de idioma de textos
- **Arquivo:** `api/languageDetector.js`
- **Funções:**
  - `detectLanguageSimple(text)` - Detecta idioma mais provável (simplificado)
  - `LanguageDetector.create()` - Cria instância do detector
  - `detect(text)` - Retorna **ranking completo** de idiomas com confidence
- **Características:**
  - Modelo **muito pequeno** (~poucos MB, já pode estar no Chrome)
  - Download on-demand na primeira utilização
  - Retorna lista **ranqueada** de idiomas com **confidence score (0.0-1.0)**
  - Usa **ranking model** (machine learning para ordenar probabilidades)
  - Desde Chrome 132: pode verificar se idioma específico é suportado
- **Limitações:**
  - **Não cobre todos os idiomas** existentes
  - Funciona melhor com **frases completas** (evitar palavras únicas)
  - Precisão reduzida para textos muito curtos
  - Recomendado: verificar confidence threshold antes de usar resultado

### 5. **Chrome Tabs API** ✅ Usado
- **Uso:** Extração de conteúdo de artigos
- **Arquivo:** `api/contentExtractorTabs.js`
- **Estratégia:**
  - Abre tabs em background (invisíveis ao usuário)
  - Aguarda carregamento e redirects do Google News
  - Injeta Readability.js para extração limpa
  - Processa em paralelo (5 tabs por vez)

---

## ⚙️ FLUXO COMPLETO DE EXECUÇÃO

### Fase 1: Detecção de Notícia (content.js)

```javascript
// 1. Usuário acessa página de notícia
window.addEventListener('load', detectNewsArticle);

// 2. Sistema de pontuação (score >= 3 = notícia)
// - Domain whitelisted: +2
// - Meta tags de artigo: +2
// - Estrutura <article> + <h1>: +1
// - Padrões no texto: +1

// 3. Extração de dados do artigo
const articleData = {
  url: window.location.href,
  source: window.location.hostname,
  language: document.documentElement.lang,
  title: extractTitle(),      // Estratégia inteligente com 8 fallbacks
  publishedDate: extractDate(),
  author: extractAuthor(),
  content: extractContent()
};

// 4. Envio para background worker
chrome.runtime.sendMessage({
  type: 'NEW_ARTICLE_DETECTED',
  data: articleData
});
```

**Sites suportados:** 25+ fontes (ver `manifest.json:content_scripts`)

### Fase 2: Pipeline de Análise (background.js)

```javascript
async function handleNewArticle(articleData) {
  // STEP 1: EXTRAÇÃO DE KEYWORDS (via Prompt API)
  const keywords = await extractKeywords(
    articleData.title,
    articleData.language
  );
  // Output: ['keyword1', 'keyword2', ...] (em inglês)
  // Tempo: ~2-3s

  // STEP 2: BUSCA DE PERSPECTIVAS (via Google News RSS)
  const perspectives = await fetchPerspectives(keywords, articleData);
  // Busca em 10 países em paralelo
  // Retorna até 15 artigos únicos e relevantes
  // Tempo: ~3-5s

  // STEP 3: EXTRAÇÃO DE CONTEÚDO (via Chrome Tabs)
  const perspectivesWithContent = await extractArticlesContentWithTabs(
    perspectives, {
      maxArticles: 10,
      timeout: 15000,
      parallel: true,
      batchSize: 5
    }
  );
  // Abre tabs em background, extrai com Readability
  // Tempo: ~15-30s (depende de redirects)

  // STEP 4: VALIDAÇÃO E COMPRESSÃO (otimização)
  const validArticles = filterValidArticles(perspectivesWithContent);
  const compressedArticles = await batchCompressForAnalysis(
    validArticles, {
      length: 'medium'
    }
  );
  // Remove JavaScript/conteúdo inválido
  // Comprime 70-80% usando Summarizer API
  // Tempo: ~5-10s

  // STEP 5: ANÁLISE COMPARATIVA (via Prompt API + JSON Schema)
  const analysis = await compareArticles(compressedArticles, {
    useCompression: true,
    validateContent: true,
    maxArticles: 8,
    compressionLevel: 'medium',
    useV2Prompt: true
  });
  // Output: JSON estruturado com consensus, disputes, omissions, bias
  // Tempo: ~10-20s

  // STEP 6: ENVIO PARA UI
  chrome.tabs.sendMessage(tabId, {
    type: 'SHOW_ANALYSIS',
    data: { analysis, perspectives, articleData }
  });
}
```

**Tempo total estimado:** 35-70 segundos (depende da qualidade das fontes)

### Fase 3: Exibição de Resultados (panel-injector.js + analysis-panel.js)

```javascript
// Painel lateral injeta na página
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SHOW_ANALYSIS') {
    PanelController.showAnalysis(message.data);
  }
});

// Renderização dos componentes:
// - Summary (resumo da história principal)
// - Stats Bar (números de consensus, disputes, etc)
// - Consensus List (fatos acordados)
// - Disputes List (divergências entre fontes) - expansível
// - Omissions List (informações omitidas)
// - Bias Indicators (sinais de viés) - expansível
// - Footer (fontes analisadas + timestamp)
```

---

## 🔧 MÓDULOS PRINCIPAIS

### background.js - Orquestrador Central

**Responsabilidades:**
- Recebe mensagens de content scripts
- Coordena todo o pipeline de análise
- Gerencia estado de download de modelos
- Atualiza estatísticas em storage
- Envia resultados de volta para UI

**Mensagens suportadas:**
- `NEW_ARTICLE_DETECTED` - Inicia análise
- `EXTRACT_KEYWORDS` - Extração standalone
- `GET_STATUS` - Status da extensão (para popup)
- `START_MODEL_DOWNLOAD` - Baixa modelo Gemini Nano
- `CLEAR_CACHE` - Limpa cache de análises

**Cache de disponibilidade AI:**
```javascript
let aiAvailabilityCache = {
  status: null,
  timestamp: null,
  cacheDuration: 30000  // 30s para evitar checar API constantemente
};
```

### api/languageModel.js - Prompt API (Gemini Nano)

**Função principal: extractKeywords()**
```javascript
// Fluxo de tradução automática:
// 1. Detecta idioma do título (ou usa fornecido)
// 2. Se não for inglês, traduz para inglês
// 3. Extrai keywords em inglês (para NewsAPI)
// 4. Retorna array de strings

// Exemplo:
// Input: "Morre atriz famosa aos 78 anos" (pt)
// Translate: "Famous actress dies at 78" (en)
// Extract: ['actress', 'death', 'age', 'famous']
```

**Função principal: compareArticles()**
```javascript
// Pipeline de otimização:
// 1. Validação de conteúdo (filtra JS/conteúdo inválido)
// 2. Compressão com Summarizer API (70-80% redução)
// 3. Limitação a 8 artigos máximos
// 4. Carrega prompt v2 com few-shot examples
// 5. Usa JSON Schema Constraint para output estruturado
// 6. Retorna objeto com metadados completos

// Output garantido:
{
  consensus: [{ fact, confidence, sources }],
  disputes: [{ topic, significance, perspectives }],
  omissions: { source: [{ fact, relevance, mentioned_by }] },
  bias_indicators: [{ source, type, description, examples }],
  summary: { main_story, key_differences, recommendation },
  metadata: { articlesAnalyzed, compressionUsed, ... }
}
```

### api/newsFetcher.js - Google News RSS

**Estratégia de busca:**
```javascript
// 1. Constrói query inteligente a partir de keywords
//    - Prioriza proper nouns (nomes, lugares)
//    - Adiciona palavras de contexto importantes
//    - Remove palavras genéricas

// 2. Busca em 10 países simultaneamente
const SEARCH_COUNTRIES = [
  { code: 'US', language: 'en', name: 'United States' },
  { code: 'GB', language: 'en', name: 'United Kingdom' },
  { code: 'BR', language: 'pt', name: 'Brazil' },
  { code: 'FR', language: 'fr', name: 'France' },
  { code: 'DE', language: 'de', name: 'Germany' },
  { code: 'ES', language: 'es', name: 'Spain' },
  { code: 'CN', language: 'zh-CN', name: 'China' },
  { code: 'JP', language: 'ja', name: 'Japan' },
  { code: 'IN', language: 'en', name: 'India' },
  { code: 'AU', language: 'en', name: 'Australia' }
];

// 3. Deduplicação por URL e título
// 4. Cálculo de relevância (keyword matching)
// 5. Ordenação por relevância + diversidade geográfica
// 6. Retorna top 15 artigos
```

**Parsing RSS:**
- Service Worker compatível (sem DOMParser)
- Usa regex para extrair items, titles, links
- Separa "Title - Source" do Google News

### api/contentExtractorTabs.js - Extração com Tabs

**Estratégia de extração:**
```javascript
// 1. Cria tab em background (active: false)
// 2. Aguarda carregamento completo
// 3. Aguarda redirects do Google News estabilizarem (~3s)
// 4. Injeta Readability.js no tab
// 5. Executa função de extração na página
// 6. Fecha tab automaticamente
// 7. Retorna conteúdo estruturado

// Processamento em batches:
// - Máximo de 5 tabs simultâneos (evitar sobrecarga)
// - Promise.allSettled para não falhar todo o batch
// - Timeout de 15s por artigo
```

**Estrutura de retorno:**
```javascript
{
  ...article,
  contentExtracted: true,
  extractedContent: {
    title, content, textContent, excerpt,
    byline, siteName, lang, length, url
  },
  extractionMethod: 'chrome-tab', // ou 'readability' ou 'fallback'
  finalUrl: 'https://...', // após redirects
  extractedAt: '2024-10-12T...'
}
```

### utils/contentValidator.js - Validação de Conteúdo

**Checks de qualidade:**
```javascript
// 1. Comprimento mínimo (100 chars, 20 palavras)
// 2. Detecção de JavaScript (padrões de código)
// 3. Ratio de caracteres alfabéticos (>60%)
// 4. Contagem de sentenças (mínimo 3)
// 5. Detecção de spam (caracteres repetidos)

// Score de qualidade (0-1):
const score = (
  (words.length / 100) * 0.3 +
  alphaRatio * 0.3 +
  (sentences.length / 10) * 0.2 +
  (1 - jsRatio) * 0.2
);

// Filtros automáticos:
filterValidArticles(articles);  // Remove artigos inválidos
sanitizeContentForAI(content);  // Limpa conteúdo
getContentExcerpt(content, 200); // Cria excerpt
```

### utils/prompts.js - Carregador de Prompts

**Sistema de templates:**
```javascript
// Prompts armazenados em /prompts/*.txt
// Suporta substituição de variáveis: {{variable}}

const prompt = await getPrompt('comparative-analysis-v2', {
  perspectives: perspectivesText
});

// Carrega de: chrome.runtime.getURL('prompts/...')
// Permite iteração rápida sem recarregar extensão
```

---

## ⚠️ PROBLEMAS CONHECIDOS E LIMITAÇÕES

### 1. Processamento Ineficiente (Identificado)
**Problema:** `background.js` processa 10-15 artigos mas usa apenas 8 na análise
- Linhas: `background.js:140-168`
- Processamento de 20-40% mais artigos que o necessário
- Causa: `maxArticles: 10` na extração, mas `maxArticles: 8` na análise
- **Impacto:** +30-60s no tempo total

**Solução proposta:**
```javascript
// Processar apenas o necessário + margem de segurança
const REQUIRED_ARTICLES = 8;
const SAFETY_MARGIN = 2;

perspectivesWithContent = await extractArticlesContentWithTabs(perspectives, {
  maxArticles: REQUIRED_ARTICLES + SAFETY_MARGIN,  // Apenas 10
  stopEarly: true  // Parar quando tiver artigos suficientes
});
```

### 2. Falta de Feedback ao Usuário
**Problema:** Análise inicia automaticamente sem aviso
- Usuário não sabe que análise está acontecendo
- Sem opção de escolher fontes (internacionais vs nacionais)
- Sem indicador de progresso

**Solução proposta:** Popup de detecção + indicador de progresso (ver seção de melhorias)

### 3. Context Window do Prompt API
**Limitação:** Gemini Nano tem context window limitado
- Máximo seguro: ~8000 chars de input
- Artigos longos podem causar falhas
- **Solução implementada:** Compressão com Summarizer API (70-80% redução)

### 4. Google News Redirects
**Problema:** URLs do Google News redirecionam para fonte original
- Pode levar 1-3 segundos por redirect
- Alguns sites bloqueiam scraping
- **Solução implementada:** `waitForRedirectsToComplete()` com timeout

### 5. Uso das APIs de Tradução e Detecção
**Status:** APIs disponíveis e implementadas no Chrome 138+
- **Translator API:** Totalmente funcional com language packs on-demand
- **Language Detector API:** Totalmente funcional com modelo pequeno
- **Integração:** Já implementada em `api/translator.js` e `api/languageDetector.js`
- **Uso atual:** O projeto usa essas APIs para normalização e tradução automática

### 6. Sites com JavaScript Pesado
**Problema:** Readability pode extrair código JS ao invés de conteúdo
- **Solução implementada:** `contentValidator.js` filtra conteúdo inválido
- Score de qualidade para ranking de artigos

---

## 🚀 OTIMIZAÇÕES IMPLEMENTADAS

### 1. Compressão de Conteúdo (Summarizer API)
```javascript
// Antes: 10 artigos × 3000 chars = 30,000 chars
// Depois: 10 artigos × 600 chars = 6,000 chars (80% redução)

const compressed = await batchCompressForAnalysis(articles, {
  length: 'medium'
});
```

**Benefícios:**
- Cabe no context window do Prompt API
- Análise mais focada em pontos-chave
- Redução de ~20s no tempo de processamento

### 2. Validação de Conteúdo
```javascript
const validArticles = filterValidArticles(perspectives);
// Remove artigos com JavaScript, spam, conteúdo muito curto
```

**Benefícios:**
- Evita enviar lixo para Prompt API
- Melhora qualidade da análise
- Reduz falhas por conteúdo inválido

### 3. Processamento Paralelo com Batches
```javascript
// Processa 5 tabs simultaneamente
await extractArticlesContentWithTabs(articles, {
  parallel: true,
  batchSize: 5
});
```

**Benefícios:**
- Redução de 50% no tempo de extração
- Evita abrir 15 tabs simultaneamente (sobrecarga)

### 4. Cache de Disponibilidade AI
```javascript
// Evita checar AI.availability() a cada 2s
let aiAvailabilityCache = {
  status: 'available',
  timestamp: Date.now(),
  cacheDuration: 30000  // 30s
};
```

**Benefícios:**
- Menos chamadas à API do Chrome
- Popup mais responsivo

### 5. JSON Schema Constraint
```javascript
// Garante output estruturado do Prompt API
await session.prompt(prompt, {
  responseConstraint: jsonSchema,
  omitResponseConstraintInput: true  // Economiza tokens
});
```

**Benefícios:**
- Parsing sempre funciona
- Sem necessidade de try/catch no JSON.parse()
- Fallback estruturado em caso de erro

---

## ⚙️ CONFIGURAÇÕES E CONSTANTES

### Configuração de Análise (background.js)
```javascript
// Quantidade de artigos
const PERSPECTIVES_TO_FETCH = 15;  // Google News busca
const MAX_ARTICLES_TO_PROCESS = 10; // Extração com tabs
const REQUIRED_ARTICLES = 8;        // Análise final

// Timeouts
const EXTRACTION_TIMEOUT = 15000;   // 15s por artigo
const REDIRECT_WAIT = 3000;         // 3s para redirects

// Processamento paralelo
const BATCH_SIZE = 5;               // Tabs simultâneos

// Compressão
const COMPRESSION_LEVEL = 'medium'; // short | medium | long
const USE_COMPRESSION = true;
```

### Países de Busca (newsFetcher.js)
```javascript
const SEARCH_COUNTRIES = [
  { code: 'US', language: 'en', name: 'United States' },
  { code: 'GB', language: 'en', name: 'United Kingdom' },
  { code: 'BR', language: 'pt', name: 'Brazil' },
  { code: 'FR', language: 'fr', name: 'France' },
  { code: 'DE', language: 'de', name: 'Germany' },
  { code: 'ES', language: 'es', name: 'Spain' },
  { code: 'CN', language: 'zh-CN', name: 'China' },
  { code: 'JP', language: 'ja', name: 'Japan' },
  { code: 'IN', language: 'en', name: 'India' },
  { code: 'AU', language: 'en', name: 'Australia' }
];
```

### Thresholds de Validação (contentValidator.js)
```javascript
const QUALITY_THRESHOLDS = {
  minLength: 100,         // Mínimo de caracteres
  minWords: 20,           // Mínimo de palavras
  maxJSRatio: 0.3,        // Máximo 30% de padrões JS
  minAlphaRatio: 0.6,     // Mínimo 60% alfabético
  minSentences: 3,        // Mínimo 3 sentenças
  maxRepeatedChars: 0.2   // Máximo 20% caracteres repetidos
};
```

### Sites Suportados (manifest.json)
25+ sites incluindo:
- Brasil: G1, Folha, Estadão, UOL
- USA: NYT, CNN, Washington Post, Reuters
- UK: BBC, The Guardian
- Internacional: Al Jazeera, AP News, Le Monde, El País, Spiegel
- Ásia: Xinhua, China Daily, Japan Times, South China Morning Post

---

## 🎨 INTERFACE DO USUÁRIO

### Popup (popup.html/js/css)
**Componentes:**
- Logo + título
- Status dos modelos AI (Downloaded/Unavailable/Downloading)
- Barra de progresso (durante download)
- Botão "Download AI Model"
- Estatísticas:
  - Artigos analisados
  - Perspectivas encontradas
  - Cache count
- Botões de ação:
  - Clear Cache
  - Settings (não implementado)
- Footer com links (Help, About)

**Estados:**
```javascript
// AI Status
'available'     → Badge verde "Downloaded"
'unavailable'   → Badge vermelho "Unavailable"
'downloadable'  → Badge amarelo "Not downloaded" + botão
'downloading'   → Badge azul "Downloading..." + barra

// Polling a cada 2s para atualizar durante download
```

### Painel de Análise (analysis-panel.js/css)
**Componentes:**
- Header colapsável
  - Logo SVG inline
  - Título "PerspectiveLens"
  - Botão de toggle (expand/collapse)
- Content area
  - Loading spinner (durante análise)
  - Error state (se falhar)
  - Analysis sections:
    1. **Summary Card**
       - Main story (resumo da história)
       - Key differences (diferenças principais)
       - Recommendation (se houver)
    2. **Stats Bar**
       - Consensus count
       - Disputes count
       - Omissions count
       - Bias indicators count
    3. **Consensus Section** (lista)
       - Fact
       - Confidence badge (high/medium/low)
       - Sources count
    4. **Disputes Section** (lista expansível)
       - Topic
       - Significance badge
       - Perspectives (click para expandir)
         - Source + viewpoint + evidence
    5. **Omissions Section** (lista)
       - Fact
       - Omitted by (source)
       - Relevance badge
       - Mentioned by count
    6. **Bias Indicators Section** (lista expansível)
       - Source
       - Type badge
       - Description
       - Examples (click para expandir)
    7. **Footer**
       - Sources analyzed
       - Timestamp

**Interações:**
- Toggle panel (botão seta)
- Expand/collapse items (click em disputes/bias)
- Auto-expand quando análise completa

**Estilos:**
- Painel lateral direito, fixed position
- Width: 480px (configurável)
- Z-index: 999999 (sobre todo conteúdo)
- Transition suave (300ms)
- Gradient background (purple/blue)
- Cards com shadow
- Badges coloridos por tipo
- Responsive (adapta a telas pequenas)

---

## 📖 BOAS PRÁTICAS E PADRÕES

### ES6 Modules
**Todos os arquivos usam import/export:**
```javascript
// background.js
import { logger } from './utils/logger.js';
import { extractKeywords } from './api/languageModel.js';

// manifest.json
"background": {
  "service_worker": "background.js",
  "type": "module"
}
```

### Sistema de Logging Centralizado
```javascript
// utils/logger.js
logger.info('Message');     // Produção
logger.debug('Details');    // Desenvolvimento
logger.warn('Warning');     // Avisos
logger.error('Error');      // Erros
logger.group('Section');    // Agrupamento
logger.groupEnd();
```

**Filtros por contexto:**
```javascript
// Ver logs de um módulo específico
// DevTools Console → filter: "[LanguageModel]"
```

### Tratamento de Erros
```javascript
// utils/errors.js
class AIModelError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'AIModelError';
    this.context = context;
  }
}

// Uso:
throw new AIModelError('Model not available', {
  reason: 'Chrome version too old'
});
```

### Async/Await Consistente
```javascript
// ✅ BOM
async function processArticle() {
  try {
    const keywords = await extractKeywords(title);
    const perspectives = await fetchPerspectives(keywords);
    return { keywords, perspectives };
  } catch (error) {
    logger.error('Process failed:', error);
    throw error;
  }
}

// ❌ EVITAR: Promise chains
function processArticle() {
  return extractKeywords(title)
    .then(keywords => fetchPerspectives(keywords))
    .catch(error => ...);
}
```

### Separação de Concerns
```
api/        → Chamadas externas (Chrome APIs, Google News)
utils/      → Funções utilitárias puras
scripts/    → Content scripts (DOM interaction)
ui/         → UI components
prompts/    → AI prompts (templates)
```

### Nomenclatura
- **Arquivos:** camelCase.js
- **Funções:** camelCase()
- **Classes:** PascalCase
- **Constantes:** UPPER_SNAKE_CASE
- **Variáveis:** camelCase

### Comentários JSDoc
```javascript
/**
 * Extrai keywords de um título de artigo
 * @param {string} title - Título do artigo (qualquer idioma)
 * @param {string} language - Código do idioma (opcional)
 * @returns {Promise<Array<string>>} Array de keywords em inglês
 */
export async function extractKeywords(title, language = null) {
  // ...
}
```

---

## 🛠️ AMBIENTE DE DESENVOLVIMENTO

### Requisitos
- **Chrome Dev/Canary 138+**
- **16 GB RAM** (ou GPU 4+ GB VRAM)
- **22 GB espaço livre** (para modelos AI)
- **Conexão não medida** (para download inicial)

### Flags do Chrome (OBRIGATÓRIO)
```
chrome://flags/#prompt-api-for-gemini-nano
  → "Enabled (multilingual)"

chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
  → "Enabled"

chrome://flags/#summarization-api-for-gemini-nano
  → "Enabled"

chrome://flags/#translation-api
  → "Enabled"

chrome://flags/#language-detection-api
  → "Enabled"

chrome://flags/#optimization-guide-on-device-model
  → "Enabled BypassPerfRequirement"
```

**Reiniciar Chrome completamente após habilitar!**

### Instalação da Extensão
1. Abrir `chrome://extensions`
2. Ativar "Developer mode"
3. Clicar "Load unpacked"
4. Selecionar pasta `PerspectiveLens`

### Workflow de Desenvolvimento
```bash
# 1. Fazer alterações no código

# 2. Recarregar extensão
chrome://extensions → botão reload

# 3. Testar em site de notícias suportado
# Abrir DevTools:
# - Popup: Right-click extensão → Inspect
# - Background: chrome://extensions → service worker
# - Content: F12 na página

# 4. Verificar logs
# Background: chrome://extensions → service worker → Console
# Content: DevTools → Console
# Filtrar por: "PerspectiveLens"
```

### Debugging
```javascript
// Logs detalhados
logger.setLevel('debug');  // Em utils/logger.js

// Testar funções isoladamente
// No console do background worker:
import { extractKeywords } from './api/languageModel.js';
const keywords = await extractKeywords('Test headline', 'en');
console.log(keywords);

// Testar análise sem recarregar página
// No console do content script:
chrome.runtime.sendMessage({
  type: 'NEW_ARTICLE_DETECTED',
  data: { title: 'Test', url: location.href, ... }
});
```

### Estrutura de Storage
```javascript
// chrome.storage.local
{
  settings: {
    autoAnalyze: true,
    maxCacheSize: 100,
    defaultLanguage: 'en'
  },
  stats: {
    articlesAnalyzed: 0,
    keywordsExtracted: 0,
    perspectivesFound: 0
  },
  cache: [
    // Análises antigas (não implementado totalmente)
  ]
}
```

---

## 📝 NOTAS IMPORTANTES

### 1. Ordem de Modificações Recomendada
Para qualquer feature nova ou bug fix:

```
1. Ler documentação relevante (este arquivo + README.md)
2. Testar comportamento atual
3. Identificar módulo(s) afetado(s)
4. Modificar código
5. Testar isoladamente (console)
6. Recarregar extensão
7. Testar flow completo
8. Verificar logs
9. Commitar com mensagem descritiva
```

### 2. Dependências Externas
- **Readability.js** - `offscreen/readability.js` (standalone, não npm)
- **Chrome Built-in AI** - APIs nativas do Chrome (não requer instalação)
- **Google News RSS** - Feed público (sem API key necessária)

### 3. Não Fazer
❌ **Não adicionar dependências npm sem justificativa forte**
- Extensão deve ser leve e standalone
- Service Workers têm limitações

❌ **Não fazer mudanças estruturais sem entender o fluxo completo**
- Tudo está conectado (background → api → utils)

❌ **Não commitar `.env` ou API keys**
- Já está em `.gitignore`

❌ **Não usar bibliotecas de UI pesadas**
- UI deve ser vanilla JS + CSS

❌ **Não ignorar logs e erros**
- Sistema de logging existe por uma razão

### 4. Performance Considerations
- **Context Window:** Sempre validar tamanho do input para Prompt API
- **Tab Leaks:** Garantir que tabs sejam fechados (try/finally)
- **Memory:** Service Worker pode ser killed a qualquer momento
- **Timeouts:** Sempre usar timeout em operações de rede/tabs

### 5. Segurança
- **CSP:** Manifest V3 tem Content Security Policy estrita
- **Permissions:** Apenas pedir o necessário
- **User Data:** Tudo local (não enviamos dados para servidor)
- **Scraping:** Respeitar robots.txt (Google News é público)

### 6. Testes
Testar em múltiplos cenários:
- ✅ Artigo em inglês (US)
- ✅ Artigo em português (BR)
- ✅ Artigo recente (hoje)
- ✅ Artigo antigo (>7 dias) - pode não ter perspectivas
- ✅ Site com paywall
- ✅ Site com JavaScript pesado
- ✅ Site com redirects múltiplos
- ✅ Navegação rápida (trocar artigo antes de análise completar)

### 7. Roadmap Futuro
Funcionalidades planejadas (não implementadas):
- [ ] Popup de detecção com opção de escolher fontes
- [ ] Indicador de progresso em tempo real
- [ ] Cache persistente de análises (IndexedDB)
- [ ] Modo offline completo
- [ ] Configurações de preferências (idioma, países, etc)
- [ ] Histórico de análises
- [ ] Export de análises (PDF/JSON)
- [ ] Detecção proativa de viés
- [ ] Comparação de headlines
- [ ] Timeline de evolução da notícia

### 8. Contribuindo
Se for fazer Pull Request:
1. Fork o repositório
2. Criar branch: `feature/minha-feature`
3. Seguir padrões de código existentes
4. Adicionar logs apropriados
5. Testar extensivamente
6. Atualizar este CLAUDE.md se necessário
7. Commitar com mensagens descritivas
8. Abrir PR com descrição detalhada

---

## 🔗 RECURSOS ÚTEIS

### Documentação Chrome
- [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in)
- [Prompt API](https://developer.chrome.com/docs/ai/built-in-apis)
- [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api)
- [Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)

### Ferramentas
- [Readability.js](https://github.com/mozilla/readability)
- [Google News RSS](https://news.google.com/rss)

### Arquivos de Referência
- `DOCS/chrome-ai.txt` - Documentação completa Chrome AI
- `DOCS/prompt-ai.txt` - Guia do Prompt API
- `DOCS/summarizer.txt` - Guia do Summarizer API
- `GUIA-MVP.md` - Product Requirements (PT-BR)
- `README.md` - Documentação pública
- `SETUP-GUIDE.md` - Guia de instalação

---

## 🎓 CONCEITOS-CHAVE

### Manifest V3
- Service Worker em vez de background page
- Não persiste estado entre execuções
- Pode ser killed a qualquer momento
- Usa chrome.storage.local para persistência

### Chrome Built-in AI
- Modelos rodando localmente (Gemini Nano)
- Sem custo de API
- Funciona offline (após download)
- ~22 GB de espaço necessário
- Privacidade total (dados não saem do dispositivo)

### Google News RSS
- Feed RSS público do Google News
- Formato: `https://news.google.com/rss/search?q=<query>&hl=<lang>&gl=<country>`
- Retorna até 100 resultados
- URLs redirecionam para fonte original
- Parsing manual (regex) necessário em Service Worker

### Readability
- Algoritmo de extração de conteúdo da Mozilla
- Remove ads, navigation, footers
- Retorna conteúdo principal limpo
- Funciona na maioria dos sites de notícias
- Fallback: seletores CSS comuns

---

**Última atualização:** 2024-10-12
**Versão do projeto:** 1.0
**Autor:** PerspectiveLens Team

---

💡 **DICA FINAL:** Antes de fazer qualquer modificação, sempre:
1. Leia a seção relevante deste documento
2. Entenda o fluxo de dados completo
3. Teste o comportamento atual
4. Faça mudanças incrementais
5. Verifique logs em cada passo
6. Teste extensivamente
7. Atualize documentação se necessário

**Boa sorte! 🚀**
