# Plano: Toast Único com Progress Bar e Mensagens User-Friendly

## Objetivo

Simplificar a UI durante análise para mostrar **um único toast persistente** com:
- Barra de progresso animada
- Mensagens relevantes focadas em IA e processamento
- Flags dos países sendo analisados
- Indicadores visuais de operações de IA
- Design Chrome-like (Material 3)

## Análise do Fluxo Atual

### Fases da Análise (baseado em console.txt)

```
1. INÍCIO (0-5%)
   └─ Content extracted successfully
   └─ Searching for related articles globally...

2. DETECÇÃO E TRADUÇÃO (5-25%)
   ├─ Detecting title language → Portuguese (BR)
   ├─ Translating title pt → en (AI)
   ├─ Pre-translating to: Chinese (CN), Arabic (PS), Russian (RU)
   └─ All translations completed

3. BUSCA DE ARTIGOS (25-45%)
   ├─ Searching in: Brazil, China, Palestine, Russia, USA
   ├─ RSS feed parsed (articlesFound per country)
   └─ Found X articles from Y countries

4. EXTRAÇÃO DE CONTEÚDO (45-65%)
   ├─ Processing X articles...
   ├─ Creating processing window
   ├─ Extracting: Source 1, Source 2, Source 3...
   ├─ Content extraction completed (X/Y successful)
   └─ Successfully extracted X/Y articles

5. SELEÇÃO INTELIGENTE (65-70%)
   └─ Selecting best articles per country...

6. COMPRESSÃO COM IA (70-85%)
   ├─ Starting article compression (AI)
   ├─ Creating Summarizer session (AI)
   ├─ Detecting languages: pt, ru, en...
   ├─ Translating for summarization: pt→en, ru→en (AI)
   └─ Compression completed (reduction: 83.3%)

7. ANÁLISE MULTI-ESTÁGIO (85-100%)
   ├─ Stage 1/4: Context & Trust (AI)
   ├─ Stage 2/4: Consensus (AI)
   ├─ Stage 3/4: Disputes (AI)
   ├─ Stage 4/4: Perspectives (AI)
   └─ Analysis complete
```

### Estimativa de Tempo por Fase

```javascript
// Baseado nos logs reais
{
  detection: 2000,        // ~2s (language detection + initial translation)
  search: 3000,          // ~3s (parallel RSS feeds)
  extraction: 15000,     // ~15s (tabs, redirects, readability)
  compression: 100000,   // ~100s (MAIOR GARGALO - Summarizer AI)
  analysis: 25000        // ~25s (4 stages with Language Model)
}
// TOTAL: ~145s (2min 25s)
```

## Arquitetura Proposta

### 1. Sistema de Logs User-Friendly

**Adicionar ao logger.js:**

```javascript
// Tipos de log context
const LogContext = {
  SYSTEM: 'SYSTEM',  // Logs técnicos (existente)
  USER: 'USER'       // Logs amigáveis para toast (NOVO)
};

// Estrutura de user log
{
  context: 'USER',
  phase: 'detection' | 'search' | 'extraction' | 'compression' | 'analysis',
  progress: 0-100,
  message: 'User-friendly message',
  icon: 'AI' | 'FLAG' | 'EXTRACT' | 'SEARCH',
  metadata: {
    countries?: ['BR', 'CN', ...],
    language?: 'pt',
    aiOperation?: 'translation' | 'summarization' | 'analysis'
  }
}
```

**Métodos adicionais:**

```javascript
// utils/logger.js
export function logUserProgress(phase, progress, message, metadata = {}) {
  const userLog = {
    context: 'USER',
    phase,
    progress,
    message,
    timestamp: Date.now(),
    ...metadata
  };

  // Broadcast para toast
  chrome.runtime.sendMessage({
    type: 'USER_PROGRESS',
    data: userLog
  });

  // Log técnico também
  log(message, metadata);
}

export function logUserAI(operation, details) {
  logUserProgress(
    details.phase,
    details.progress,
    details.message,
    {
      icon: 'AI',
      aiOperation: operation,
      ...details
    }
  );
}
```

### 2. Single Toast Component

**Criar: ui/single-toast.js**

```javascript
/**
 * SingleToast - Toast único e persistente durante análise
 *
 * Features:
 * - Progress bar linear (Material 3)
 * - Mensagens dinâmicas
 * - Flags de países animadas
 * - Ícones de IA quando aplicável
 * - Auto-dismiss ao completar
 */

class SingleToast {
  constructor() {
    this.container = null;
    this.progressBar = null;
    this.messageElement = null;
    this.flagsContainer = null;
    this.currentProgress = 0;
  }

  show(title) {
    // Cria toast se não existir
    if (!this.container) {
      this.create();
    }

    this.container.classList.add('visible');
    this.updateTitle(title);
    this.updateProgress(0);
  }

  create() {
    // HTML structure com Material 3
  }

  updateProgress(percent, animated = true) {
    // Atualiza barra de progresso
    // Smooth animation usando CSS transitions
  }

  updateMessage(message, icon = null, flags = []) {
    // Atualiza mensagem principal
    // Adiciona ícone se for operação AI
    // Mostra flags de países se aplicável
  }

  addFlag(countryCode) {
    // Adiciona flag animada ao container
    // Usa SVGs de icons/flags/
  }

  showAIIndicator(operation) {
    // Mostra ícone de sparkle/chip para AI
    // operation: 'translation' | 'summarization' | 'analysis'
  }

  dismiss() {
    // Fade out suave
    // Remove após animação
  }
}

export const singleToast = new SingleToast();
```

**Criar: ui/single-toast.css**

```css
.perspective-single-toast {
  /* Container do toast */
  position: fixed;
  top: var(--spacing-4);
  right: var(--spacing-4);
  width: 400px;
  background: var(--md-sys-color-surface-container);
  border-radius: var(--md-card-shape);
  box-shadow: var(--md-elevation-3);
  padding: var(--spacing-4);
  z-index: 9999;

  /* Animação de entrada */
  transform: translateX(450px);
  opacity: 0;
  transition: all 0.3s var(--md-easing-standard);
}

.perspective-single-toast.visible {
  transform: translateX(0);
  opacity: 1;
}

/* Progress bar */
.toast-progress {
  height: 4px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: var(--spacing-3);
}

.toast-progress-fill {
  height: 100%;
  background: var(--md-sys-color-primary);
  transition: width 0.3s var(--md-easing-emphasized);
  border-radius: 2px;
}

/* Mensagem */
.toast-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  color: var(--md-sys-color-on-surface);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.toast-ai-icon {
  /* Ícone de sparkle/chip para AI */
  width: 16px;
  height: 16px;
  color: var(--md-sys-color-tertiary);
  animation: pulse-ai 2s infinite;
}

@keyframes pulse-ai {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Flags */
.toast-flags {
  display: flex;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
  flex-wrap: wrap;
}

.toast-flag {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--md-sys-color-outline-variant);
  animation: flag-pop 0.3s var(--md-easing-standard);
}

@keyframes flag-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

### 3. Integração com Background

**Modificar: scripts/background.js**

Adicionar emissão de user logs em pontos-chave:

```javascript
import { logUserProgress, logUserAI } from '../utils/logger.js';

// FASE 1: DETECÇÃO
logUserProgress('detection', 5, 'Detecting article language...', {
  icon: 'AI'
});

logUserAI('language-detection', {
  phase: 'detection',
  progress: 10,
  message: `Language detected: ${languageName} (${confidence}%)`,
  metadata: { language, confidence }
});

// FASE 2: TRADUÇÃO
logUserAI('translation', {
  phase: 'detection',
  progress: 15,
  message: `Translating title to English...`,
  metadata: { from: sourceLang, to: 'en' }
});

// FASE 3: BUSCA
logUserProgress('search', 30, 'Searching articles globally...', {
  icon: 'SEARCH',
  countries: ['BR', 'CN', 'PS', 'RU', 'US']
});

// FASE 4: EXTRAÇÃO
logUserProgress('extraction', 50, `Extracting content from ${total} articles...`, {
  icon: 'EXTRACT'
});

// FASE 5: COMPRESSÃO (IMPORTANTE - mostra IA trabalhando)
logUserAI('summarization', {
  phase: 'compression',
  progress: 75,
  message: `Summarizing articles with AI...`,
  metadata: { articlesCount, reduction: '83.3%' }
});

// FASE 6: ANÁLISE
logUserAI('analysis', {
  phase: 'analysis',
  progress: 90,
  message: `AI Analysis: Stage ${currentStage}/4`,
  metadata: { stage: currentStage, stageName }
});

// CONCLUÍDO
logUserProgress('complete', 100, 'Analysis complete!', {
  icon: 'SUCCESS'
});
```

### 4. Listener no Content Script

**Modificar: scripts/content.js**

```javascript
import { singleToast } from '../ui/single-toast.js';

// Listen para user progress
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USER_PROGRESS') {
    const { phase, progress, message: msg, icon, metadata } = message.data;

    // Atualiza toast
    singleToast.updateProgress(progress);
    singleToast.updateMessage(msg, icon);

    // Adiciona flags se presente
    if (metadata.countries) {
      metadata.countries.forEach(code => {
        singleToast.addFlag(code);
      });
    }

    // Mostra indicador AI se aplicável
    if (icon === 'AI' && metadata.aiOperation) {
      singleToast.showAIIndicator(metadata.aiOperation);
    }

    // Auto-dismiss ao completar
    if (progress >= 100) {
      setTimeout(() => singleToast.dismiss(), 2000);
    }
  }

  if (message.type === 'START_ANALYSIS') {
    singleToast.show('Analyzing article...');
  }
});
```

## Mensagens User-Friendly

### Mapeamento: Log Técnico → User Message

```javascript
// Exemplo de transformação
const USER_MESSAGES = {
  // Detecção
  'Creating Language Detector instance': null, // não mostrar
  'Language Detector created successfully': 'Detecting language with AI...',
  'High confidence language detection': (data) =>
    `Detected: ${data.languageName} (${data.confidencePercent})`,

  // Tradução
  'Creating translator': (data) =>
    `Translating ${data.sourceLang} to ${data.targetLang}...`,
  'Translation completed successfully': (data) =>
    `Translated (${data.originalLength} to ${data.translatedLength} chars)`,

  // Busca
  'Searching Google News': (data) =>
    `Searching in ${countryNames[data.country]}...`,
  'RSS feed parsed': (data) =>
    `Found ${data.articlesFound} articles`,

  // Extração
  'Starting batch content extraction': (data) =>
    `Extracting ${data.total} articles in parallel...`,
  'Article extraction successful': (data) =>
    `Extracted: ${data.source}`,

  // Compressão (CRÍTICO - mostrar AI)
  'Creating Summarizer instance': 'Creating AI summarizer...',
  'Summarizer created successfully': 'AI summarizer ready',
  'Compressing article': (data) =>
    `AI summarizing: ${data.source} (${data.index}/${data.total})`,
  'Article compressed successfully': (data) =>
    `Compressed ${data.reduction} - ${data.source}`,

  // Análise (CRÍTICO - mostrar AI)
  'Starting Stage 1': 'AI analyzing context & trust...',
  'Stage 1 completed': 'Stage 1/4 complete',
  'Starting Stage 2': 'AI finding consensus...',
  'Stage 2 completed': 'Stage 2/4 complete',
  'Starting Stage 3': 'AI detecting disputes...',
  'Stage 3 completed': 'Stage 3/4 complete',
  'Starting Stage 4': 'AI analyzing perspectives...',
  'Stage 4 completed': 'Stage 4/4 complete',

  // Conclusão
  'Analysis completed successfully': (data) =>
    `Analysis complete! Found ${data.perspectivesFound} perspectives`
};
```

## Design System Chrome-like

**Atualizar: ui/design-system.css**

Aproximar mais do Chrome usando:

```css
/* Chrome Material 3 Expressive */
:root {
  /* Colors - Chrome blue scheme */
  --md-sys-color-primary: #1A73E8;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #D3E3FD;
  --md-sys-color-on-primary-container: #001B3D;

  --md-sys-color-secondary: #5E5E62;
  --md-sys-color-on-secondary: #FFFFFF;

  --md-sys-color-tertiary: #8430CE; /* Purple para AI */
  --md-sys-color-on-tertiary: #FFFFFF;

  /* Surface - mais próximo do Chrome */
  --md-sys-color-surface: #FFFFFF;
  --md-sys-color-surface-container: #F8F9FA;
  --md-sys-color-surface-container-high: #F1F3F4;
  --md-sys-color-on-surface: #202124;

  /* Outline */
  --md-sys-color-outline: #DADCE0;
  --md-sys-color-outline-variant: #E8EAED;

  /* Elevation - Chrome style */
  --md-elevation-1: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
  --md-elevation-2: 0 1px 2px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15);
  --md-elevation-3: 0 4px 8px 3px rgba(60,64,67,0.15), 0 1px 3px 0 rgba(60,64,67,0.3);

  /* Shape - Chrome radii */
  --md-card-shape: 12px;
  --md-button-shape: 20px;
  --md-chip-shape: 16px;

  /* Typography - Google Sans / Roboto */
  --font-family-base: 'Google Sans', 'Roboto', -apple-system, system-ui, sans-serif;

  /* Easing - Chrome animations */
  --md-easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
  --md-easing-emphasized: cubic-bezier(0.2, 0.0, 0, 1);
}

/* Dark theme - Chrome dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --md-sys-color-primary: #A8C7FA;
    --md-sys-color-on-primary: #001B3D;
    --md-sys-color-primary-container: #004A99;
    --md-sys-color-on-primary-container: #D3E3FD;

    --md-sys-color-surface: #1F1F1F;
    --md-sys-color-surface-container: #2C2C2C;
    --md-sys-color-surface-container-high: #363636;
    --md-sys-color-on-surface: #E8EAED;

    --md-sys-color-outline: #5F6368;
    --md-sys-color-outline-variant: #444746;
  }
}
```

## Ícones de IA

Criar componente visual para indicar operações de IA:

```html
<!-- AI Sparkle Icon -->
<svg class="ai-icon" viewBox="0 0 24 24">
  <path d="M12 2L9.19 8.63L2 11.44l7.19 2.81L12 22l2.81-7.75L22 11.44l-7.19-2.81z"/>
</svg>

<!-- Chip Icon (Alternative) -->
<svg class="ai-icon" viewBox="0 0 24 24">
  <path d="M6 4h12v2h2v2h2v8h-2v2h-2v2H6v-2H4v-2H2V8h2V6h2V4z"/>
</svg>
```

## Arquivos a Deletar

```
DOCS/deprecated/
├── toast-notification.js        → Deletar após migração
├── toast-notification.css       → Deletar após migração
├── progress-tracker.js          → Deletar após migração
└── progress-tracker.css         → Deletar após migração
```

## Timeline de Implementação

### Fase 1: Logger System (2-3 horas)
- [ ] Adicionar LogContext.USER ao logger.js
- [ ] Criar logUserProgress() e logUserAI()
- [ ] Criar mapeamento de mensagens user-friendly
- [ ] Testar broadcast de user logs

### Fase 2: Single Toast Component (3-4 horas)
- [ ] Criar ui/single-toast.js
- [ ] Criar ui/single-toast.css (Material 3 Chrome-like)
- [ ] Implementar progress bar animada
- [ ] Implementar flag system integration
- [ ] Implementar AI indicators
- [ ] Testar animações e transições

### Fase 3: Background Integration (4-5 horas)
- [ ] Refatorar background.js para emitir user logs
- [ ] Mapear todos os pontos críticos do fluxo
- [ ] Adicionar country flags nas mensagens de busca
- [ ] Adicionar AI indicators em operações de IA
- [ ] Testar fluxo completo end-to-end

### Fase 4: Content Script Listener (1-2 horas)
- [ ] Implementar listener em content.js
- [ ] Conectar com singleToast
- [ ] Implementar auto-dismiss
- [ ] Testar sincronização de mensagens

### Fase 5: Design System Update (2 horas)
- [ ] Atualizar design-system.css para Chrome-like
- [ ] Ajustar cores, shadows, radii
- [ ] Implementar dark mode perfeito
- [ ] Testar consistência visual

### Fase 6: Cleanup (1 hora)
- [ ] Remover toast-notification.js/css
- [ ] Remover progress-tracker.js/css
- [ ] Atualizar manifest.json
- [ ] Remover imports antigos

### Fase 7: Testing & Polish (2-3 horas)
- [ ] Testar com artigo real completo
- [ ] Verificar todas as mensagens
- [ ] Ajustar timings se necessário
- [ ] Polish visual final

**Total estimado: 15-20 horas**

## Priorização

### Crítico (Must Have)
1. Logger system com USER context
2. Single toast básico com progress
3. Mensagens user-friendly principais
4. Integration com background events

### Importante (Should Have)
1. Flag icons animados
2. AI indicators visuais
3. Chrome-like design refinado
4. Dark mode perfeito

### Nice to Have
1. Animações super polidas
2. Mensagens extremamente detalhadas
3. Easter eggs (ex: sparkle animation quando IA completa)

## Mensagens User-Friendly Prioritárias

Focar em mostrar **quando IA está trabalhando**:

```
Alta prioridade (mostrar sempre):
  - "Detecting language with AI..."
  - "Translating [lang] to [lang]..."
  - "AI summarizing articles..."
  - "AI analyzing: Stage X/4"

Média prioridade (mostrar se relevante):
  - "Searching in [country]..."
  - "Found X articles from Y countries"
  - "Extracting content..."

Baixa prioridade (pode omitir):
  - Detalhes técnicos de redirect
  - Window manager operations
  - Tab creation/cleanup
```

## Referências Visuais

### Toast Position
```
┌─────────────────────────────┐
│ Browser Window              │
│                             │
│                    ┌────────┤
│                    │ TOAST  │
│                    │ [====] │ ← Progress
│                    │ msg    │
│                    │ BR CN  │ ← Flags
│                    └────────┤
│                             │
└─────────────────────────────┘
```

### Progress Bar States
```
Starting:    [====------] 10%
Translating: [======----] 25%
Searching:   [========--] 45%
Extracting:  [=========-] 65%
Summarizing: [=========-] 80% ← LONGO (IA working)
Analyzing:   [==========] 95%
Complete:    [==========] 100%
```

## Código Exemplo: Mensagem Completa

```javascript
// Exemplo de como vai aparecer no toast

// Momento 1 (5%):
"Detecting language with AI..."
Progress: 5%

// Momento 2 (15%):
"Translating Portuguese to English..."
Progress: 15%

// Momento 3 (30%):
"Searching articles in: [BR] [CN] [PS] [RU] [US]"
Progress: 30%

// Momento 4 (50%):
"Extracting content from 4 articles..."
Progress: 50%

// Momento 5 (75%) - CRÍTICO:
"AI summarizing articles... (83.3% compression)"
Progress: 75%
[Barra fica aqui um tempo - usuário vê IA trabalhando]

// Momento 6 (90%):
"AI Analysis: Stage 2/4 - Finding consensus..."
Progress: 90%

// Momento 7 (100%):
"Analysis complete! Found 3 perspectives"
Progress: 100%
[Auto-dismiss após 2s]
```

## Próximos Passos

1. Aprovar este plano
2. Decidir se quer implementação fase por fase ou completa
3. Começar pela Fase 1 (Logger System)
