# WindowManager - Versão Final Simplificada

## O Que Mudou

### ❌ Removido: Tab Grouping
**Por quê?**
- API de grouping estava bugada
- Criava múltiplos grupos ao invés de um
- Não é essencial para a funcionalidade

### ✅ Adicionado: Página HTML Informativa
**O quê?**
- Janela abre com [offscreen/processing.html](../offscreen/processing.html)
- Página bonita explicando o que está acontecendo
- Usuário pode expandir a janela para ver

### ✅ Melhorado: Reutilização da Janela
**Como funciona agora:**
1. Cria janela UMA vez com a página HTML
2. REUTILIZA a mesma janela para TODOS os batches
3. Fecha TUDO no final (janela + todas as tabs)

## Arquitetura Atual

```
┌─────────────────────────────────────────────────┐
│ Usuário inicia extração                         │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ WindowManager.createProcessingWindow()          │
│ - Cria janela minimizada                        │
│ - Abre processing.html (aba informativa)        │
│ - Aplica estado (minimized/offscreen/normal)    │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ BATCH 1 (até 10 artigos em paralelo)           │
│ ├─ Tab 1: Article from BBC                     │
│ ├─ Tab 2: Article from CNN                     │
│ └─ ...                                          │
│                                                 │
│ Tabs são fechadas após extração                │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ BATCH 2 (MESMA janela, novas tabs)             │
│ ├─ Tab 3: Article from Al Jazeera              │
│ ├─ Tab 4: Article from Reuters                 │
│ └─ ...                                          │
│                                                 │
│ Tabs são fechadas após extração                │
└──────────────────┬──────────────────────────────┘
                   ↓
                  ...
                   ↓
┌─────────────────────────────────────────────────┐
│ WindowManager.cleanup()                         │
│ - Fecha a janela INTEIRA                       │
│ - Todas as tabs são fechadas automaticamente   │
└─────────────────────────────────────────────────┘
```

## Estrutura da Janela

```
┌──────────────────────────────────────────────┐
│ Processing Window (Minimizada)                │
├──────────────────────────────────────────────┤
│                                              │
│ [Tab 1] processing.html (permanece sempre)  │
│   └─ Página bonita explicando o processo    │
│                                              │
│ [Tab 2] BBC Article (criada e fechada)      │
│ [Tab 3] CNN Article (criada e fechada)      │
│ ...                                          │
│                                              │
└──────────────────────────────────────────────┘
```

## Código Simplificado

### WindowManager Class

```javascript
class ProcessingWindowManager {
  constructor(options) {
    this.windowId = null;
    this.tabIds = [];
    this.infoTabId = null;  // Tab do processing.html
    this.options = options;
  }

  async createProcessingWindow() {
    // Cria janela UMA vez
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL('offscreen/processing.html'),
      focused: false
    });

    this.windowId = win.id;
    this.infoTabId = win.tabs[0].id;  // processing.html

    // Minimiza
    await this.applyWindowState(this.options.windowState);
  }

  async createTab(url) {
    // Reutiliza janela existente
    const tab = await chrome.tabs.create({
      url,
      windowId: this.windowId,  // Mesma janela
      active: false
    });

    this.tabIds.push(tab.id);
    return tab;
  }

  async removeTab(tabId) {
    // Remove tab individual
    await chrome.tabs.remove(tabId);
    this.tabIds = this.tabIds.filter(id => id !== tabId);
  }

  async cleanup() {
    // Fecha TUDO de uma vez
    await chrome.windows.remove(this.windowId);
    this.reset();
  }
}
```

## Página Informativa (processing.html)

### Visual

- **Design moderno:** Gradiente roxo, card branco
- **Logo:** 🔍 PerspectiveLens
- **Spinner animado:** Mostra que está processando
- **Informações:**
  - Status: Active
  - Mode: Background Extraction
  - Window Type: Dedicated Processing

### Mensagens

1. **O que está acontecendo?**
   - Extração de artigos em background tabs

2. **Por que janela separada?**
   - Mantém navegação organizada
   - Fecha automaticamente

3. **Posso fechar?**
   - Sim, mas interrompe o processo
   - Melhor deixar terminar

## Configuração

### config/pipeline.js

```javascript
extraction: {
  windowManager: {
    // Minimizar janela (fallback para offscreen se falhar)
    windowState: 'minimized',

    // Mostrar processing.html
    showInfoPage: true
  }
}
```

### Opções de windowState

| Estado | Comportamento |
|--------|---------------|
| `minimized` | Tenta minimizar, fallback para offscreen |
| `offscreen` | Move para (-2000, -2000) - invisível |
| `normal` | Janela visível (para debugging) |

## Uso

### Padrão (Automático)

```javascript
// Usa configuração padrão
const results = await extractArticlesContentWithTabs(articles);

// WindowManager faz automaticamente:
// 1. Cria janela minimizada
// 2. Mostra processing.html
// 3. Processa todos os batches
// 4. Fecha tudo no final
```

### Debug (Janela Visível)

```javascript
// Ver o que está acontecendo
const results = await extractArticlesContentWithTabs(articles, {
  windowManagerOptions: {
    windowState: 'normal'  // Janela visível
  }
});
```

### Sem Página Informativa

```javascript
// Apenas janela em branco
const results = await extractArticlesContentWithTabs(articles, {
  windowManagerOptions: {
    showInfoPage: false  // Não mostrar HTML
  }
});
```

## Fluxo de Execução

### 1. Inicialização
```
extractArticlesContentWithTabs() chamada
  ↓
WindowManager criado
  ↓
createProcessingWindow()
  ↓
Janela criada com processing.html
  ↓
Janela minimizada
```

### 2. Processamento (Batch 1)
```
Para cada artigo no batch:
  ↓
createTab(article.url)
  ↓
Tab criada na MESMA janela
  ↓
Extração executada
  ↓
removeTab(tabId)
  ↓
Tab fechada
```

### 3. Processamento (Batch 2, 3, ...)
```
MESMA janela reutilizada
  ↓
Novas tabs criadas
  ↓
Extração executada
  ↓
Tabs fechadas
```

### 4. Finalização
```
Todos os batches completos
  ↓
windowManager.cleanup()
  ↓
chrome.windows.remove(windowId)
  ↓
Janela inteira fechada
  ↓
processing.html + todas as tabs fechadas
```

## Benefícios

### ✅ Simplicidade
- Sem complexidade de grouping
- Apenas criar/fechar tabs
- Uma janela para tudo

### ✅ Transparência
- Usuário vê processing.html se expandir janela
- Entende o que está acontecendo
- Visual profissional

### ✅ Eficiência
- Reutiliza mesma janela
- Não cria janela nova por batch
- Cleanup simples (uma operação)

### ✅ Confiabilidade
- Sem bugs de grouping
- Lógica direta
- Fácil de debugar

## Comparação: Antes vs Depois

| Aspecto | Versão com Grouping | Versão Simplificada |
|---------|---------------------|---------------------|
| **Grupos** | ❌ Múltiplos grupos bugados | ✅ Sem grouping |
| **Janelas** | ❌ Nova janela por batch | ✅ Reutiliza mesma |
| **Blank tabs** | ❌ Aba blank por batch | ✅ processing.html único |
| **Cleanup** | ❌ Complexo | ✅ Simples (fecha janela) |
| **Visual** | ⚠️ Grupos coloridos bugados | ✅ HTML informativo bonito |
| **Código** | ❌ ~500 linhas | ✅ ~400 linhas |

## Debugging

### Ver Logs

```javascript
// Procurar por:
[WindowManager] Creating dedicated processing window
[WindowManager] Window created (windowId: 123)
[WindowManager] Info page tab created (tabId: 456)
[WindowManager] Processing window ready (state: minimized)
[WindowManager] Creating tab in processing window
[WindowManager] Tab created successfully
[WindowManager] Tab removed
[WindowManager] Cleaning up processing window
[WindowManager] Processing window closed
```

### Janela Visível para Debug

```javascript
// Na config
windowManager: {
  windowState: 'normal',
  showInfoPage: true
}

// Ou via opção
const results = await extractArticlesContentWithTabs(articles, {
  windowManagerOptions: { windowState: 'normal' }
});
```

### Verificar Stats

```javascript
const windowManager = createWindowManager();
await windowManager.createProcessingWindow();

const stats = await windowManager.getStats();
console.log(stats);
// {
//   windowId: 123,
//   alive: true,
//   totalTabs: 5,
//   activeTabs: [101, 102, 103, 104, 105],
//   infoTabId: 100,  // processing.html
//   options: { ... }
// }
```

## Performance

**Sem impacto:**
- ✅ Mesma velocidade de processamento
- ✅ Mesmo número de tabs paralelas (10)
- ✅ Mesmos timeouts

**Melhorias:**
- ⚡ Reutiliza janela (não cria múltiplas)
- ⚡ Sem overhead de grouping API
- ⚡ Cleanup mais rápido (uma operação)

## Checklist Final

- [x] ✅ Sem múltiplos grupos
- [x] ✅ Página HTML informativa
- [x] ✅ Reutiliza mesma janela para todos os batches
- [x] ✅ Cleanup fecha tudo de uma vez
- [x] ✅ Tabs vão para janela correta
- [x] ✅ Sem aba blank extra
- [x] ✅ Código simplificado
- [x] ✅ Fácil de debugar

## Resumo

**Versão final:**
- 🎨 **HTML informativo** ao invés de aba blank
- 🔄 **Reutiliza janela** para todos os batches
- 🗑️ **Sem grouping** (removido por bugs)
- 🧹 **Cleanup simples** (fecha janela inteira)
- ✨ **Código limpo** e fácil de manter

**Pronto para uso!** 🚀
