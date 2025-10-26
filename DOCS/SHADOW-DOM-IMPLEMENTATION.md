# Shadow DOM Implementation - PerspectiveLens

## Overview

PerspectiveLens uses Shadow DOM to achieve complete style isolation between the extension UI and host websites. This prevents bidirectional CSS conflicts where website styles affect the extension and vice versa.

## Architecture

### Structure

```
Light DOM
└── <div id="perspective-lens-root" data-theme="light|dark">
    └── #shadow-root (open)
        ├── <style> (shadow-root.css)
        ├── <style> (design-system.css - converted to :host)
        ├── <style> (single-toast.css)
        ├── <style> (panel-styles.css)
        └── <div id="pl-shadow-container">
            ├── Toast Component
            └── Panel Component
```

### Key Files

- **`scripts/content.js`**: Creates Shadow DOM via `createShadowDOM()` function
- **`ui/shadow-root.css`**: Shadow host and container styles
- **`ui/design-system.css`**: Design tokens (automatically converted for Shadow DOM)
- **`ui/theme-manager.js`**: Manages theme and syncs to shadow host
- **`ui/components/toast/single-toast.js`**: Toast component (renders in Shadow DOM)
- **`ui/components/panel/panel-loader.js`**: Panel component (renders in Shadow DOM)

## Implementation Details

### 1. Shadow DOM Creation

The `createShadowDOM()` function in `scripts/content.js`:

```javascript
async function createShadowDOM() {
  // Create shadow host
  const shadowHost = document.createElement('div');
  shadowHost.id = 'perspective-lens-root';

  // Apply theme
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  shadowHost.setAttribute('data-theme', currentTheme);

  // Attach shadow root (open mode)
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // Create container
  const container = document.createElement('div');
  container.id = 'pl-shadow-container';
  shadowRoot.appendChild(container);

  // Fetch and inject CSS
  const cssFiles = [
    'ui/shadow-root.css',
    'ui/design-system.css',
    'ui/components/toast/single-toast.css',
    'ui/components/panel/panel-styles.css'
  ];

  for (const cssFile of cssFiles) {
    const url = chrome.runtime.getURL(cssFile);
    const response = await fetch(url);
    let cssText = await response.text();

    // Convert :root to :host for Shadow DOM
    if (cssFile === 'ui/design-system.css') {
      cssText = cssText.replace(/:root/g, ':host');
      cssText = cssText.replace(/\[data-theme='dark'\]/g, ":host([data-theme='dark'])");
    }

    const styleEl = document.createElement('style');
    styleEl.textContent = cssText;
    shadowRoot.appendChild(styleEl);
  }

  document.body.appendChild(shadowHost);

  // Store global references
  window.__PL_SHADOW_ROOT__ = shadowRoot;
  window.__PL_SHADOW_CONTAINER__ = container;
}
```

### 2. CSS Conversion for Shadow DOM

**Critical Discovery**: CSS variables defined with `:root` do NOT work in Shadow DOM.

**Solution**: Automatic conversion during CSS injection:
- `:root` → `:host`
- `[data-theme='dark']` → `:host([data-theme='dark'])`

**Why This Works**:
- In Light DOM, `:root` refers to `<html>`
- In Shadow DOM, `:host` refers to the shadow host element
- By converting selectors, CSS variables become accessible within Shadow DOM

### 3. Theme Management

**ThemeManager Integration**:

```javascript
// In theme-manager.js
applyTheme(theme) {
  // Apply to document
  document.documentElement.setAttribute('data-theme', theme);

  // Apply to shadow host
  const shadowHost = document.getElementById('perspective-lens-root');
  if (shadowHost) {
    shadowHost.setAttribute('data-theme', theme);
  }

  // Emit event
  window.dispatchEvent(new CustomEvent('themeChanged', {
    detail: { theme }
  }));
}
```

**Event Listener in Content Script**:

```javascript
// In content.js initialize()
window.addEventListener('themeChanged', (event) => {
  const shadowHost = document.getElementById('perspective-lens-root');
  if (shadowHost && event.detail?.theme) {
    shadowHost.setAttribute('data-theme', event.detail.theme);
  }
});
```

### 4. Component Integration

**How Components Access Shadow DOM**:

```javascript
// In single-toast.js or panel-loader.js

// 1. Wait for shadow container
async waitForShadowRoot() {
  let retries = 0;
  while (retries < 30) {
    if (window.__PL_SHADOW_CONTAINER__) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  return false;
}

// 2. Create component
create() {
  const shadowContainer = window.__PL_SHADOW_CONTAINER__;
  if (!shadowContainer) {
    console.error('Shadow container not available');
    return;
  }

  this.element = document.createElement('div');
  this.element.className = 'my-component';

  // Inject into shadow container (NOT document.body!)
  shadowContainer.appendChild(this.element);
}

// 3. Query within shadow DOM
querySelector(selector) {
  const shadowContainer = window.__PL_SHADOW_CONTAINER__;
  return shadowContainer?.querySelector(selector);
}
```

## Benefits

1. **Complete Style Isolation**: Website CSS cannot affect extension UI
2. **No Style Leakage**: Extension CSS cannot affect website
3. **Theme Support**: Full light/dark mode support with automatic sync
4. **Clean Encapsulation**: Extension UI is completely separate from page DOM
5. **No Conflicts**: ID and class names won't conflict with website

## Important Rules

### DO ✅

- Inject all UI into `window.__PL_SHADOW_CONTAINER__`
- Wait for shadow container before creating UI
- Query elements within shadow container
- Use global references `window.__PL_SHADOW_ROOT__` and `window.__PL_SHADOW_CONTAINER__`
- Let `createShadowDOM()` handle CSS injection

### DON'T ❌

- Inject UI into `document.body` or Light DOM
- Query Light DOM for extension UI elements
- Use `:root` in new CSS (use CSS variables from design-system.css)
- Manually inject `<link>` tags (use `<style>` instead)
- Skip waiting for shadow container to be ready

## Troubleshooting

### Styles Not Appearing

**Problem**: CSS not applied to components
**Cause**: CSS variables using `:root` instead of `:host`
**Solution**: Already handled automatically in `createShadowDOM()` conversion

### Theme Not Updating

**Problem**: Dark mode not working
**Cause**: Theme attribute not on shadow host
**Solution**: ThemeManager automatically applies to shadow host

### Component Not Visible

**Problem**: Component created but not visible
**Cause**: Injected into Light DOM instead of Shadow DOM
**Solution**: Use `window.__PL_SHADOW_CONTAINER__.appendChild(element)`

### Cannot Query Element

**Problem**: `querySelector()` returns null
**Cause**: Querying Light DOM instead of Shadow DOM
**Solution**: Use `window.__PL_SHADOW_CONTAINER__.querySelector(selector)`

## Migration Notes

When migrating old Light DOM components to Shadow DOM:

1. Replace `document.body` with `window.__PL_SHADOW_CONTAINER__`
2. Replace `document.querySelector()` with `window.__PL_SHADOW_CONTAINER__.querySelector()`
3. Add `waitForShadowRoot()` method
4. Remove any direct `<link>` CSS injections (handled by `createShadowDOM()`)

## Performance

- CSS is fetched once during Shadow DOM creation
- No runtime CSS injection overhead
- Theme changes only update one attribute
- Minimal impact on page performance
