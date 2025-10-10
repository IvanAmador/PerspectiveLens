# UI Architecture - PerspectiveLens

## Download Behavior: Background vs Popup

### ⚠️ IMPORTANTE: Você NÃO precisa manter o popup aberto!

O download do modelo AI acontece no **background service worker**, não no popup. Isso significa:

✅ **Você pode fechar o popup** - o download continua
✅ **Você pode fechar todas as abas** - o download continua
✅ **Você pode reiniciar o Chrome** - o download continua (se configurado)

### Como Funciona

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Popup UI  │         │ Background.js    │         │ Chrome API  │
│             │         │ (Service Worker) │         │             │
└─────────────┘         └──────────────────┘         └─────────────┘
       │                         │                            │
       │  1. Click "Download"    │                            │
       ├────────────────────────>│                            │
       │                         │                            │
       │                         │  2. LanguageModel.create() │
       │                         ├───────────────────────────>│
       │                         │                            │
       │                         │  3. Download starts        │
       │                         │<───────────────────────────│
       │  4. Response: success   │                            │
       │<────────────────────────│                            │
       │                         │                            │
       │  5. Close popup ✓       │  Download continues! ⏬    │
       │                         │<───────────────────────────│
       │                         │  (22 GB)                   │
       │                         │                            │
       │  6. Open popup again    │                            │
       ├────────────────────────>│                            │
       │                         │                            │
       │  7. Poll status         │                            │
       ├────────────────────────>│                            │
       │                         │                            │
       │  8. Get progress: 45%   │                            │
       │<────────────────────────│                            │
       │                         │                            │
       │  Show progress bar 45%  │                            │
```

## Arquitetura de Componentes

### 1. Popup UI ([popup.html](../popup.html), [popup.js](../popup.js))

**Responsabilidades:**
- ✅ Exibir status atual
- ✅ Polling a cada 2 segundos para atualizar UI
- ✅ Botões de ação (Download, Clear Cache, etc)
- ❌ NÃO gerencia o download
- ❌ NÃO persiste estado

**Lifecycle:**
```javascript
// Quando abre
DOMContentLoaded → initElements() → loadStatus() → startPolling()

// Enquanto aberto
Polling every 2s → loadStatus() → updateUI()

// Quando fecha
unload → stopPolling()
```

### 2. Background Service Worker ([background.js](../background.js))

**Responsabilidades:**
- ✅ Gerencia download do modelo AI
- ✅ Persiste estado global (downloadState)
- ✅ Responde a mensagens do popup
- ✅ Processa artigos detectados
- ✅ Extrai keywords

**Estado Global:**
```javascript
downloadState = {
  inProgress: boolean,  // Download ativo?
  progress: number,     // 0-100
  session: Session|null // Sessão AI ativa
}
```

**Message Handlers:**
- `GET_STATUS` → Retorna status completo (AI, cache, stats)
- `START_MODEL_DOWNLOAD` → Inicia download em background
- `CLEAR_CACHE` → Limpa cache
- `NEW_ARTICLE_DETECTED` → Processa artigo
- `EXTRACT_KEYWORDS` → Extrai keywords

### 3. Communication Flow

#### Popup → Background

```javascript
// Popup.js
const response = await chrome.runtime.sendMessage({
  type: 'START_MODEL_DOWNLOAD'
});

// Background.js recebe
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_MODEL_DOWNLOAD') {
    startModelDownload()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error }));
    return true; // Async response
  }
});
```

#### Background → Popup (via polling)

```javascript
// Popup.js (polling a cada 2s)
setInterval(async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_STATUS'
  });
  updateUI(response.status);
}, 2000);
```

## Design da Nova UI

### Visual Hierarchy

```
┌─────────────────────────────────────┐
│  🌍 PerspectiveLens          v1.0   │  ← Header (gradient)
├─────────────────────────────────────┤
│                                     │
│  AI MODELS                    🔄    │  ← Section header
│  ┌───────────────────────────────┐ │
│  │ Gemini Nano   ● Downloaded   │ │  ← Status card
│  └───────────────────────────────┘ │
│                                     │
│  NEWSAPI                    Setup   │
│  ┌───────────────────────────────┐ │
│  │ API Key       ● Configured   │ │
│  └───────────────────────────────┘ │
│                                     │
│  STATISTICS                         │
│  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │  5  │  │  3  │  │ 12  │        │  ← Stats grid
│  │ Art │  │Cache│  │Persp│        │
│  └─────┘  └─────┘  └─────┘        │
│                                     │
│  [🗑 Clear Cache] [⚙ Settings]     │  ← Actions
│                                     │
├─────────────────────────────────────┤
│  GitHub | Help | About              │  ← Footer
└─────────────────────────────────────┘
```

### States & Variants

#### AI Model States

| State | Badge | Extra UI | Card Style |
|-------|-------|----------|------------|
| `available` | `● Downloaded` (green) | - | `.success` border |
| `unavailable` | `● Unavailable` (red) | - | `.error` border |
| `downloadable` | `● Not downloaded` (yellow) | "Download" button | - |
| `downloading` | `● Downloading...` (blue) | Progress bar | `.downloading` border |

#### Download Progress Bar

```html
<div class="progress-container">
  <div class="progress-bar">
    <div class="progress-fill" style="width: 45%"></div>
  </div>
  <div class="progress-text">
    <span>45%</span>
    <span>9.9 GB / 22 GB</span>
  </div>
</div>
```

## CSS Architecture

### Design System

```css
/* Color Palette (Google Material inspired) */
--primary: #4285f4       /* Blue - primary actions */
--success: #0f9d58       /* Green - success states */
--warning: #f4b400       /* Yellow - warnings */
--error: #db4437         /* Red - errors */

/* Spacing Scale */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 24px

/* Component Patterns */
.status-card → Card with hover effect
.badge → Small pill with dot indicator
.stats-grid → 3-column grid with hover lift
.btn-primary → Full-width blue button
.btn-secondary → Outlined button
```

### Responsive Behavior

```css
/* Default: 380px width */
body { width: 380px; min-height: 500px; }

/* Small screens: 320px */
@media (max-width: 360px) {
  body { width: 320px; }
  .stats-grid { grid-template-columns: 1fr; }
}
```

## Performance Optimizations

### 1. Polling Strategy

```javascript
// Popup.js
const POLL_INTERVAL = 2000; // 2 seconds

// Only poll while popup is open
DOMContentLoaded → startPolling()
unload → stopPolling()
```

**Why 2 seconds?**
- ✅ Fast enough to feel responsive
- ✅ Slow enough to not spam background
- ✅ Balance between UX and performance

### 2. State Management

```javascript
// Background.js - Global state (persists)
let downloadState = {
  inProgress: false,
  progress: 0,
  session: null
};

// Popup.js - Local state (doesn't persist)
const elements = { ... }; // DOM references
let statusInterval = null; // Polling timer
```

### 3. Download Progress Tracking

```javascript
// Background.js
const session = await createSession({}, (progress) => {
  // Update global state
  downloadState.progress = progress;
  logger.debug(`Download: ${progress}%`);
});
```

**Key Points:**
- Progress stored in background global state
- Popup reads via `GET_STATUS` message
- Progress survives popup close/reopen

## Testing the UI

### Manual Test Cases

#### Test 1: Download with popup open
1. Open popup
2. Click "Download AI Model"
3. **Expected:** Progress bar appears, updates in real-time
4. **Expected:** Can see percentage and GB downloaded

#### Test 2: Download with popup closed
1. Open popup
2. Click "Download AI Model"
3. **Close popup immediately**
4. Wait 10 seconds
5. **Open popup again**
6. **Expected:** Progress bar shows current progress
7. **Expected:** Download continues from where it was

#### Test 3: Status polling
1. Open popup
2. Open DevTools Console
3. **Expected:** See polling logs every 2 seconds
4. **Expected:** UI updates automatically

#### Test 4: Clear cache
1. Open popup
2. Click "Clear Cache"
3. Confirm dialog
4. **Expected:** Cache count → 0
5. **Expected:** Button shows "✓ Cleared" briefly

### Debug Tools

```javascript
// In popup DevTools console
// Force refresh status
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, console.log);

// Start download manually
chrome.runtime.sendMessage({ type: 'START_MODEL_DOWNLOAD' }, console.log);

// Check background state (in background worker console)
console.log(downloadState);
```

## Common Issues & Fixes

### Issue 1: "Download stuck at 0%"

**Cause:** Background worker might have restarted

**Fix:**
1. Check background worker console for errors
2. Try refreshing status (🔄 button)
3. Restart Chrome completely

### Issue 2: "Popup not updating"

**Cause:** Polling might have stopped

**Fix:**
1. Close and reopen popup
2. Check console for errors
3. Verify background worker is running

### Issue 3: "Progress bar not showing"

**Cause:** `downloadProgress` element display style

**Fix:**
```javascript
// Should be set in showAIDownloading()
elements.downloadProgress.style.display = 'flex';
```

## Future Improvements

### v1.1
- [ ] Toast notifications instead of alerts
- [ ] Offline indicator
- [ ] Settings page (full page)
- [ ] API key input in popup

### v1.2
- [ ] Dark mode support
- [ ] Keyboard shortcuts
- [ ] Accessibility improvements (ARIA labels)
- [ ] Animation polish

### v2.0
- [ ] Floating panel for perspectives
- [ ] Inline article analysis
- [ ] Real-time collaboration

---

## Key Takeaways

✅ **Download happens in BACKGROUND** - popup is just a status display

✅ **Popup polls every 2 seconds** - gets fresh status from background

✅ **Close popup anytime** - download continues

✅ **Professional UI** - Google Material inspired design

✅ **Responsive feedback** - progress bars, badges, state changes

---

**Last Updated:** January 9, 2025
**Version:** 1.0.0
