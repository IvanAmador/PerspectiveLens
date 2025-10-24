# Plano de Refatoração UI - PerspectiveLens

## Objetivo

Refatorar completamente a UI da extensão PerspectiveLens para seguir Material Design 3, integrar com o estilo nativo do Chrome, e substituir sistema de toasts/terminal por `chrome.notifications` API.

## Princípios

1. ✅ **Material Design 3** - Seguir especificações oficiais
2. ✅ **Chrome Native** - Integração perfeita com Chrome
3. ✅ **Modo Escuro Automático** - Detectar preferência do sistema
4. ✅ **Centralização** - design-system.css como única fonte de verdade
5. ✅ **User-Friendly** - Notificações inteligentes e não intrusivas
6. ✅ **Performance** - Menos JavaScript, mais CSS

---

## FASE 1: PREPARAÇÃO E SETUP

### Task 1.1: Adicionar Permission ao Manifest
**Duração**: 5 min
**Prioridade**: Alta

**Ação**:
- Adicionar `"notifications"` às permissions em `manifest.json`

**Arquivo**:
- `manifest.json`

**Documentação**:
- [@DOCS/chrome-apis/chrome.notifications](chrome-apis/chrome.notifications)

**Código**:
```json
{
  "permissions": [
    "storage",
    "offscreen",
    "tabs",
    "scripting",
    "notifications"  // ← ADICIONAR
  ]
}
```

---

### Task 1.2: Criar Estrutura de Pastas
**Duração**: 5 min
**Prioridade**: Alta

**Ação**:
- Criar pasta `ui/notifications/`
- Preparar para novos arquivos

**Comandos**:
```bash
mkdir ui/notifications
```

---

### Task 1.3: Backup de Arquivos Antigos
**Duração**: 5 min
**Prioridade**: Média

**Ação**:
- Mover arquivos antigos para `DOCS/deprecated/`

**Arquivos a mover**:
- `ui/toast-notification.js`
- `ui/toast-notification.css`
- `ui/progress-tracker.js`
- `ui/progress-tracker.css`

**Comando**:
```bash
mkdir DOCS/deprecated
mv ui/toast-notification.* DOCS/deprecated/
mv ui/progress-tracker.* DOCS/deprecated/
```

---

## FASE 2: NOTIFICATION MANAGER

### Task 2.1: Criar NotificationManager
**Duração**: 2-3 horas
**Prioridade**: Alta

**Arquivo novo**: `ui/notifications/notificationManager.js`

**Documentação**:
- [@DOCS/chrome-apis/chrome.notifications](chrome-apis/chrome.notifications)
- [@DOCS/material-3/MATERIAL-3-REFERENCE.md](material-3/MATERIAL-3-REFERENCE.md)

**Funcionalidades**:
1. Wrapper para `chrome.notifications`
2. Gerenciamento de estado de notificações
3. Update de notificações existentes (evitar spam)
4. Queue de notificações (não mostrar 10 ao mesmo tempo)
5. Integração com logger.js

**Estrutura**:
```javascript
/**
 * PerspectiveLens Notification Manager
 * Intelligent notification system using chrome.notifications API
 */

class NotificationManager {
  constructor() {
    this.activeNotifications = new Map();
    this.notificationQueue = [];
    this.currentAnalysisId = null;
  }

  /**
   * Show notification or update existing
   */
  async show(id, options) {
    // Se já existe, fazer update ao invés de criar nova
    if (this.activeNotifications.has(id)) {
      await chrome.notifications.update(id, options);
    } else {
      await chrome.notifications.create(id, options);
      this.activeNotifications.set(id, options);
    }
  }

  /**
   * Clear notification
   */
  async clear(id) {
    await chrome.notifications.clear(id);
    this.activeNotifications.delete(id);
  }

  /**
   * Analysis lifecycle notifications
   */
  async startAnalysis(articleTitle) { /* ... */ }
  async updateSearchProgress(countriesFound) { /* ... */ }
  async updateExtractionProgress(current, total) { /* ... */ }
  async updateAnalysisStage(stage, totalStages) { /* ... */ }
  async completeAnalysis(articlesCount, countriesCount) { /* ... */ }
  async failAnalysis(errorMessage, canRetry) { /* ... */ }

  /**
   * General purpose notifications
   */
  async showSuccess(title, message) { /* ... */ }
  async showError(title, message, actions) { /* ... */ }
  async showWarning(title, message) { /* ... */ }
  async showInfo(title, message) { /* ... */ }
}

// Singleton export
export const notificationManager = new NotificationManager();

// Legacy compatibility wrapper
if (typeof window !== 'undefined') {
  window.PerspectiveLensNotifications = notificationManager;
}
```

**Notification IDs**:
- `perspectivelens-analysis` - Notificação principal do processo
- `perspectivelens-progress` - Progress updates
- `perspectivelens-complete` - Success
- `perspectivelens-error` - Error
- `perspectivelens-info-{timestamp}` - Info/warning temporárias

---

### Task 2.2: Criar Event Listeners
**Duração**: 1 hora
**Prioridade**: Alta

**Arquivo**: `ui/notifications/notificationListeners.js`

**Funcionalidades**:
- Listener para botões (View Results, Retry, etc.)
- Listener para close
- Comunicação com content script

**Código**:
```javascript
/**
 * Notification Event Listeners
 */

import { notificationManager } from './notificationManager.js';

// Button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'perspectivelens-complete') {
    if (buttonIndex === 0) {
      // View Results button
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_PANEL' });
        }
      });
    }
  }

  if (notificationId === 'perspectivelens-error') {
    if (buttonIndex === 0) {
      // Retry button
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'RETRY_ANALYSIS' });
        }
      });
    }
  }

  // Clear notification after action
  chrome.notifications.clear(notificationId);
});

// Notification closed
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  notificationManager.activeNotifications.delete(notificationId);
});
```

**Onde carregar**:
- `scripts/background.js` (import no topo)

---

### Task 2.3: Integrar com Logger
**Duração**: 1 hora
**Prioridade**: Média

**Arquivo**: `utils/logger.js` (modificar)

**Mudança**:
- Logger deve automaticamente criar notificações para logs `USER` context
- Usar notification manager ao invés de broadcasts

**Código adicional**:
```javascript
// No topo do logger.js
import { notificationManager } from '../ui/notifications/notificationManager.js';

// Modificar broadcastToUI para usar notifications
async function broadcastToUI(entry) {
  // Se for USER context e categoria relevante, mostrar notificação
  if (entry.context === 'USER' && entry.level === 'INFO') {
    // Mapear categoria para notification type
    if (entry.category === 'search') {
      await notificationManager.updateSearchProgress(entry.data);
    } else if (entry.category === 'fetch') {
      await notificationManager.updateExtractionProgress(entry.data);
    } else if (entry.category === 'analyze') {
      await notificationManager.updateAnalysisStage(entry.data);
    }
  }

  // Manter dispatch de evento para outros componentes
  // ...
}
```

---

## FASE 3: INTEGRAÇÃO COM BACKGROUND.JS

### Task 3.1: Substituir Calls de Toast
**Duração**: 2 horas
**Prioridade**: Alta

**Arquivo**: `scripts/background.js`

**Ações**:
1. Remover referências a `window.PerspectiveLensToast`
2. Adicionar calls para `notificationManager`
3. Integrar com estágios de processamento

**Mudanças**:

```javascript
// No topo
import { notificationManager } from '../ui/notifications/notificationManager.js';

// Substituir em handleNewArticle():

// ❌ OLD
logger.progress(logger.CATEGORIES.SEARCH, {
  status: 'active',
  userMessage: 'Searching for related articles globally...',
  progress: 0
});

// ✅ NEW
await notificationManager.startAnalysis(articleData.title);

// ❌ OLD
logger.progress(logger.CATEGORIES.SEARCH, {
  status: 'completed',
  userMessage: `Found ${perspectives.length} articles from multiple countries`,
  progress: 100
});

// ✅ NEW
await notificationManager.updateSearchProgress({
  articlesFound: perspectives.length,
  countries: [...new Set(perspectives.map(p => p.country))]
});

// Similar para outras etapas...
```

**Pontos de integração**:
1. Linha 196: `handleNewArticle` - Start analysis
2. Linha 237: Após `fetchPerspectives` - Search complete
3. Linha 305: Durante `extractArticlesContentWithTabs` - Extraction progress
4. Linha 466: Callback de stages - AI analysis progress
5. Linha 583: Analysis complete
6. Linha 621: Analysis error

---

### Task 3.2: Remover Progress Tracker
**Duração**: 1 hora
**Prioridade**: Alta

**Arquivos**:
- `scripts/background.js`
- `scripts/content.js`
- `manifest.json`

**Ações**:
1. Remover imports de progress-tracker
2. Remover calls `window.PerspectiveLensProgress.*`
3. Remover do manifest.json web_accessible_resources
4. Remover do content_scripts

**Manifest.json**:
```json
// REMOVER estas linhas:
"ui/progress-tracker.css",
"ui/progress-tracker.js",
```

---

## FASE 4: CENTRALIZAÇÃO DE CSS

### Task 4.1: Auditar design-system.css
**Duração**: 30 min
**Prioridade**: Alta

**Arquivo**: `ui/design-system.css`

**Ação**:
- Verificar se todos os tokens Material 3 estão presentes
- Adicionar tokens faltantes (se houver)
- Organizar por categoria

**Documentação**:
- [@DOCS/material-3/MATERIAL-3-REFERENCE.md](material-3/MATERIAL-3-REFERENCE.md)

**Tokens a verificar**:
- ✅ Cores (light/dark)
- ✅ Tipografia
- ✅ Spacing
- ✅ Border radius
- ✅ Shadows
- ✅ Transitions
- ✅ Z-index
- ⚠️ Motion easing (adicionar Material 3 easing)
- ⚠️ Component-specific tokens

**Adicionar se faltar**:
```css
/* Motion & Easing (Material 3) */
--md-sys-motion-easing-emphasized: cubic-bezier(0.0, 0.0, 0.2, 1);
--md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1.0);
--md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0.0, 0.8, 0.15);

/* Component Shapes */
--md-button-shape: var(--radius-full); /* 20px full rounded */
--md-card-shape: var(--radius-md);     /* 12px */
--md-dialog-shape: var(--radius-2xl);  /* 28px */
--md-chip-shape: var(--radius-sm);     /* 8px */
--md-fab-shape: var(--radius-lg);      /* 16px */
```

---

### Task 4.2: Refatorar popup.css
**Duração**: 1 hora
**Prioridade**: Alta

**Arquivo**: `popup.css`

**Ação**:
- Substituir TODOS os valores hardcoded por variáveis CSS
- Usar tokens de design-system.css

**Exemplo**:
```css
/* ❌ ANTES */
.popup-header {
  background: #1A73E8;
  color: #FFFFFF;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
}

/* ✅ DEPOIS */
.popup-header {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}
```

**Checklist**:
- [ ] Cores → variáveis
- [ ] Padding/margin → spacing system
- [ ] Border radius → radius system
- [ ] Font sizes → typescale
- [ ] Shadows → elevation levels
- [ ] Transitions → transition presets

---

### Task 4.3: Refatorar ui/options.css
**Duração**: 1 hora
**Prioridade**: Alta

**Arquivo**: `ui/options.css`

**Ação**: Mesmo processo do popup.css

**Documentação**: [@DOCS/material-3/MATERIAL-3-REFERENCE.md](material-3/MATERIAL-3-REFERENCE.md)

---

### Task 4.4: Refatorar ui/analysis-panel.css
**Duração**: 1-2 horas
**Prioridade**: Alta

**Arquivo**: `ui/analysis-panel.css`

**Ação**: Converter para tokens Material 3

**Atenção especial**:
- Cards de artigos
- Badges de país
- Progress indicators
- Botões de ação

---

### Task 4.5: Refatorar ui/panel/panel-styles.css
**Duração**: 1-2 horas
**Prioridade**: Alta

**Arquivo**: `ui/panel/panel-styles.css`

**Ação**: Converter para tokens Material 3

---

### Task 4.6: Refatorar ui/settings-modal.css
**Duração**: 1 hora
**Prioridade**: Média

**Arquivo**: `ui/settings-modal.css`

**Ação**: Converter para tokens Material 3

**Atenção**:
- Modal backdrop (overlay)
- Border radius do dialog (28px - Material 3 Expressive)
- Botões de ação

---

## FASE 5: AUTO DARK MODE

### Task 5.1: Criar Dark Mode Script
**Duração**: 30 min
**Prioridade**: Alta

**Arquivo novo**: `ui/theme-manager.js`

**Documentação**: [@DOCS/material-3/MATERIAL-3-REFERENCE.md](material-3/MATERIAL-3-REFERENCE.md) - Best Practices

**Código**:
```javascript
/**
 * PerspectiveLens Theme Manager
 * Auto dark mode detection and management
 */

(function() {
  'use strict';

  function updateTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    console.log(`[PerspectiveLens] Theme updated: ${isDark ? 'dark' : 'light'}`);
  }

  // Initial detection
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  updateTheme(darkModeQuery.matches);

  // Listen for system theme changes
  darkModeQuery.addEventListener('change', (e) => {
    updateTheme(e.matches);
  });

  // Export for manual control (se necessário)
  window.PerspectiveLensTheme = {
    setTheme: (theme) => {
      if (theme === 'auto') {
        updateTheme(darkModeQuery.matches);
      } else {
        updateTheme(theme === 'dark');
      }
    },
    getTheme: () => {
      return document.documentElement.getAttribute('data-theme') || 'light';
    },
    isSystemDark: () => darkModeQuery.matches
  };
})();
```

---

### Task 5.2: Adicionar a Páginas HTML
**Duração**: 15 min
**Prioridade**: Alta

**Arquivos**:
- `popup.html`
- `options.html`
- `ui/analysis-panel.html`
- `ui/settings-modal.html`

**Ação**:
Adicionar script antes do closing `</body>`:

```html
<script src="ui/theme-manager.js"></script>
```

Para content scripts (analysis-panel, settings-modal):
```javascript
// No início do arquivo JS
import '../theme-manager.js';
```

---

## FASE 6: CHROME MATERIAL 3 EXPRESSIVE

### Task 6.1: Segmented Progress Indicator
**Duração**: 2 horas
**Prioridade**: Média

**Arquivo**: `ui/design-system.css` (adicionar componente)

**Documentação**: [@DOCS/material-3/MATERIAL-3-REFERENCE.md](material-3/MATERIAL-3-REFERENCE.md) - Chrome Material 3 Expressive

**Código**:
```css
/* Segmented Progress Indicator (Chrome style) */
.pl-progress-segmented {
  display: flex;
  gap: var(--spacing-1);
  height: 4px;
  width: 100%;
}

.pl-progress-segment {
  flex: 1;
  background: var(--md-sys-color-surface-variant);
  border-radius: var(--radius-full);
  transition: background var(--transition-base);
}

.pl-progress-segment.active {
  background: var(--md-sys-color-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

.pl-progress-segment.complete {
  background: var(--md-sys-color-primary);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

**Onde usar**:
- Popup durante análise
- Notificações de progresso (se conseguir customizar)

---

### Task 6.2: Icon Buttons com Background
**Duração**: 1 hora
**Prioridade**: Baixa

**Arquivo**: `ui/design-system.css`

**Código**:
```css
/* Icon Buttons (Chrome Material 3 Expressive) */
.pl-icon-button {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: var(--radius-full);
  background: var(--md-sys-color-surface-variant);
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
  color: var(--md-sys-color-on-surface-variant);
}

.pl-icon-button:hover {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.pl-icon-button:active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  transform: scale(0.95);
}

.pl-icon-button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
```

---

## FASE 7: FLAGS E ÍCONES

### Task 7.1: Flag Icon System
**Duração**: 2 horas
**Prioridade**: Média

**Arquivo novo**: `ui/flags.js`

**Recursos**:
- `icons/flags/*.svg`

**Funcionalidade**:
```javascript
/**
 * Flag Icon System
 * Maps country codes to flag SVG paths
 */

const FLAGS_PATH = chrome.runtime.getURL('icons/flags/');

export const FLAGS = {
  'BR': { emoji: '🇧🇷', svg: `${FLAGS_PATH}br.svg`, name: 'Brazil' },
  'US': { emoji: '🇺🇸', svg: `${FLAGS_PATH}us.svg`, name: 'United States' },
  'GB': { emoji: '🇬🇧', svg: `${FLAGS_PATH}gb.svg`, name: 'United Kingdom' },
  'CN': { emoji: '🇨🇳', svg: `${FLAGS_PATH}cn.svg`, name: 'China' },
  'FR': { emoji: '🇫🇷', svg: `${FLAGS_PATH}fr.svg`, name: 'France' },
  // ...adicionar todos os países
};

/**
 * Get flag emoji for country code
 */
export function getFlagEmoji(countryCode) {
  return FLAGS[countryCode]?.emoji || '🏳️';
}

/**
 * Get flag SVG URL for country code
 */
export function getFlagSVG(countryCode) {
  return FLAGS[countryCode]?.svg || null;
}

/**
 * Get flag HTML element
 */
export function getFlagElement(countryCode, options = {}) {
  const { size = 20, useEmoji = false } = options;

  if (useEmoji) {
    return `<span class="flag-emoji">${getFlagEmoji(countryCode)}</span>`;
  }

  const svg = getFlagSVG(countryCode);
  if (svg) {
    return `<img src="${svg}" alt="${FLAGS[countryCode].name}" width="${size}" height="${size}" class="flag-icon">`;
  }

  return getFlagEmoji(countryCode);
}
```

---

### Task 7.2: Integrar Flags nas Notificações
**Duração**: 1 hora
**Prioridade**: Média

**Arquivo**: `ui/notifications/notificationManager.js`

**Uso**:
```javascript
import { getFlagEmoji } from '../flags.js';

// Na notificação de search complete
async updateSearchProgress(data) {
  const { articlesFound, countries } = data;
  const flagsStr = countries.map(c => getFlagEmoji(c)).join(' ');

  await this.show('perspectivelens-progress', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('images/icon-128.png'),
    title: 'Perspectives Found',
    message: `Found ${articlesFound} articles from ${countries.length} countries\n${flagsStr}`,
    progress: 50
  });
}
```

---

### Task 7.3: Chrome UI Icons
**Duração**: 1 hora
**Prioridade**: Baixa

**Recursos**: `DOCS/chrome-ui/icons/*.svg`

**Ação**:
- Copiar ícones relevantes para `icons/ui/`
- Criar sprite SVG ou imports individuais
- Usar em botões e UI elements

---

## FASE 8: LIMPEZA E OTIMIZAÇÃO

### Task 8.1: Deletar Arquivos Antigos
**Duração**: 15 min
**Prioridade**: Alta

**Arquivos a deletar** (após migração completa):
```bash
# Mover para DOCS/deprecated/ ou deletar diretamente
rm ui/toast-notification.js
rm ui/toast-notification.css
rm ui/progress-tracker.js
rm ui/progress-tracker.css
```

---

### Task 8.2: Atualizar Manifest
**Duração**: 15 min
**Prioridade**: Alta

**Arquivo**: `manifest.json`

**Ações**:
1. Remover referências a arquivos deletados
2. Adicionar novos arquivos
3. Verificar web_accessible_resources

**Mudanças**:
```json
{
  "web_accessible_resources": [
    {
      "resources": [
        // REMOVER
        // "ui/toast-notification.css",
        // "ui/toast-notification.js",
        // "ui/progress-tracker.css",
        // "ui/progress-tracker.js",

        // ADICIONAR
        "ui/theme-manager.js",
        "ui/notifications/notificationManager.js",
        "ui/notifications/notificationListeners.js",
        "ui/flags.js",

        // MANTER
        "ui/design-system.css",
        "ui/analysis-panel.css",
        // ...
      ]
    }
  ],
  "content_scripts": [
    {
      "js": [
        // REMOVER
        // "ui/toast-notification.js",
        // "ui/progress-tracker.js",

        // ADICIONAR (se necessário)
        "ui/theme-manager.js",

        // MANTER
        "ui/panel-loader.js",
        "scripts/content.js"
      ],
      "css": [
        // REMOVER
        // "ui/toast-notification.css",
        // "ui/progress-tracker.css",

        // MANTER
        "ui/design-system.css",
        "ui/panel/panel-styles.css"
      ]
    }
  ]
}
```

---

### Task 8.3: Verificar Imports
**Duração**: 30 min
**Prioridade**: Alta

**Arquivos a verificar**:
- `scripts/background.js`
- `scripts/content.js`
- `ui/panel-loader.js`
- Todos os arquivos que usavam toast/progress

**Ação**:
- Remover imports antigos
- Adicionar imports novos
- Testar se não quebrou nada

---

### Task 8.4: Limpar Código Comentado
**Duração**: 30 min
**Prioridade**: Baixa

**Ação**:
- Remover código comentado antigo
- Remover console.logs desnecessários
- Limpar TODOs resolvidos

---

## FASE 9: TESTES E POLIMENTO

### Task 9.1: Testes Funcionais
**Duração**: 2-3 horas
**Prioridade**: Alta

**Cenários de teste**:

1. **Fluxo completo de análise**
   - [ ] Detectar artigo
   - [ ] Iniciar análise
   - [ ] Mostrar notificações corretas
   - [ ] Progresso atualizado
   - [ ] Notificação de sucesso
   - [ ] Botão "View Results" funciona

2. **Modo escuro**
   - [ ] Dark mode automático detecta sistema
   - [ ] Troca automática ao mudar preferência do sistema
   - [ ] Todas as páginas respondem (popup, options, panel)
   - [ ] Cores corretas em dark mode

3. **Notificações**
   - [ ] Não mostrar notificações demais (max 5-6)
   - [ ] Update de notificações funciona (não cria duplicadas)
   - [ ] Botões de ação funcionam
   - [ ] Fechamento limpa estado corretamente

4. **CSS Centralizado**
   - [ ] Todos os componentes usam variáveis CSS
   - [ ] Nenhum valor hardcoded
   - [ ] Consistência visual em todas as páginas

5. **Flags e Ícones**
   - [ ] Flags aparecem corretamente
   - [ ] SVGs carregam
   - [ ] Fallback para emojis funciona

---

### Task 9.2: Testes de Performance
**Duração**: 1 hora
**Prioridade**: Média

**Métricas**:
- [ ] Tempo de carregamento do popup (< 100ms)
- [ ] Tempo de injeção do panel (< 200ms)
- [ ] Uso de memória (não deve aumentar vs versão antiga)
- [ ] Animações smooth (60fps)

---

### Task 9.3: Polimento Visual
**Duração**: 2-3 horas
**Prioridade**: Baixa

**Ações**:
- [ ] Ajustar spacing para perfeição pixel-perfect
- [ ] Verificar alinhamentos
- [ ] Adicionar micro-interações (hover states, etc.)
- [ ] Testar em diferentes resoluções
- [ ] Screenshots para documentação

---

## FASE 10: DOCUMENTAÇÃO

### Task 10.1: Atualizar README
**Duração**: 1 hora
**Prioridade**: Média

**Arquivo**: `README.md` (se existir) ou criar

**Conteúdo**:
- Novas funcionalidades (chrome.notifications)
- Como funciona o sistema de notificações
- Dark mode automático
- Screenshots

---

### Task 10.2: Changelog
**Duração**: 30 min
**Prioridade**: Baixa

**Arquivo**: `CHANGELOG.md`

**Conteúdo**:
```markdown
# Changelog

## [2.0.0] - 2025-10-20

### Added
- Chrome native notifications system
- Automatic dark mode detection
- Material Design 3 integration
- Flag icons for countries
- Centralized CSS design system

### Removed
- Custom toast notification system
- Terminal progress tracker view

### Changed
- All UI components now use Material 3 design tokens
- Improved notification intelligence (less spam)
- Better progress indication

### Fixed
- Dark mode inconsistencies
- CSS duplication
```

---

### Task 10.3: Criar Guia de Contribuição
**Duração**: 1 hora
**Prioridade**: Baixa

**Arquivo**: `DOCS/CONTRIBUTING.md`

**Conteúdo**:
- Como usar design-system.css
- Como adicionar novos componentes
- Padrões de código
- Como testar

---

## RESUMO DE ESTIMATIVAS

### Por Prioridade

**Alta Prioridade**: ~18-22 horas
- Notification Manager: 5h
- Background.js integration: 3h
- CSS refactoring: 6-8h
- Dark mode: 1h
- Testing: 3h

**Média Prioridade**: ~8-10 horas
- Logger integration: 1h
- Flags system: 3h
- Segmented progress: 2h
- Performance tests: 1h
- Documentation: 2h

**Baixa Prioridade**: ~6-8 horas
- Icon buttons: 1h
- Chrome UI icons: 1h
- Code cleanup: 1h
- Visual polish: 3-4h

**TOTAL**: 32-40 horas (~5 dias de trabalho focado)

---

## CHECKLIST FINAL

Antes de considerar a refatoração completa:

### Funcionalidade
- [ ] Notificações funcionam perfeitamente
- [ ] Todas as páginas HTML migraram
- [ ] Dark mode funciona automaticamente
- [ ] Flags aparecem corretamente
- [ ] Botões de ação funcionam
- [ ] Não há erros no console

### Código
- [ ] Nenhum arquivo antigo sendo usado
- [ ] Todos os CSS usam variáveis
- [ ] Imports limpos e corretos
- [ ] Código comentado removido
- [ ] Manifest.json atualizado

### Design
- [ ] Material 3 aplicado em toda UI
- [ ] Consistência visual
- [ ] Dark mode perfeito
- [ ] Animações smooth
- [ ] Pixel-perfect alignment

### Performance
- [ ] Popup rápido (< 100ms)
- [ ] Panel injection rápida (< 200ms)
- [ ] Sem memory leaks
- [ ] Notificações não causam lag

### Documentação
- [ ] README atualizado
- [ ] CHANGELOG criado
- [ ] Screenshots atualizados
- [ ] Comentários no código

---

## RECURSOS E REFERÊNCIAS

### Documentação Criada
1. [@DOCS/material-3/MATERIAL-3-REFERENCE.md](material-3/MATERIAL-3-REFERENCE.md)
2. [@DOCS/UI-REFACTORING-ANALYSIS.md](UI-REFACTORING-ANALYSIS.md)
3. [@DOCS/chrome-apis/chrome.notifications](chrome-apis/chrome.notifications)

### Chrome APIs
- https://developer.chrome.com/docs/extensions/reference/api/notifications
- https://developer.chrome.com/docs/extensions/reference/api/tabs
- https://developer.chrome.com/docs/extensions/mv3/

### Material Design 3
- https://m3.material.io/
- https://material-web.dev/
- https://m3.material.io/components/

### Flags SVG
- `icons/flags/*.svg` (já existentes no projeto)

### Chrome UI Icons
- `DOCS/chrome-ui/icons/*.svg` (já existentes no projeto)

---

## PRÓXIMOS PASSOS

1. **Revisar este plano** com o time/stakeholders
2. **Priorizar tarefas** (se tempo limitado)
3. **Criar branch** para refatoração
4. **Começar pela Fase 1** (preparação)
5. **Ir fase por fase** testando entre cada uma
6. **Fazer commits granulares** para facilitar rollback
7. **Testar extensivamente** antes de merge

---

**Boa refatoração! 🚀**
