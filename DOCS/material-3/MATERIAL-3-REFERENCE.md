# Material Design 3 - Referência para PerspectiveLens

## Visão Geral

Material Design 3 (Material You) é o mais recente sistema de design open-source do Google, focado em personalização, acessibilidade e adaptabilidade.

## Links Oficiais

- **Material Design 3 Homepage**: https://m3.material.io/
- **Desenvolvimento Web**: https://m3.material.io/develop/web
- **Componentes**: https://m3.material.io/components/
- **Material Web Components**: https://material-web.dev/
- **GitHub Repo**: https://github.com/material-components/material-web

## Princípios Fundamentais

### 1. Design Adaptativo
- Suporte automático para modo claro/escuro
- Tokens de design que se adaptam ao contexto
- Responsividade

### 2. Personalização
- Sistema de cores dinâmico
- Tipografia escalável
- Componentes modulares

### 3. Acessibilidade
- Contraste adequado (WCAG AA/AAA)
- Estados de foco visíveis
- Suporte a leitores de tela

## Sistema de Cores

### Estrutura de Cores Material 3

```css
/* Light Mode */
--md-sys-color-primary: #1A73E8;
--md-sys-color-on-primary: #FFFFFF;
--md-sys-color-primary-container: #E8F0FE;
--md-sys-color-on-primary-container: #001D36;

--md-sys-color-secondary: #5F6368;
--md-sys-color-on-secondary: #FFFFFF;
--md-sys-color-secondary-container: #E8EAED;
--md-sys-color-on-secondary-container: #101318;

--md-sys-color-surface: #FFFFFF;
--md-sys-color-on-surface: #1F1F1F;
--md-sys-color-surface-variant: #F1F3F4;
--md-sys-color-on-surface-variant: #444746;

--md-sys-color-error: #D93025;
--md-sys-color-on-error: #FFFFFF;
--md-sys-color-error-container: #FCE8E6;
--md-sys-color-on-error-container: #410002;

--md-sys-color-background: #FAFAFA;
--md-sys-color-on-background: #1F1F1F;

--md-sys-color-outline: #DADCE0;
--md-sys-color-outline-variant: #E8EAED;
```

### Dark Mode

```css
[data-theme='dark'] {
  --md-sys-color-primary: #8AB4F8;
  --md-sys-color-on-primary: #062E6F;
  --md-sys-color-primary-container: #1E3A5F;
  --md-sys-color-on-primary-container: #D2E3FC;

  --md-sys-color-secondary: #9AA0A6;
  --md-sys-color-on-secondary: #2E3134;
  --md-sys-color-secondary-container: #3C4043;
  --md-sys-color-on-secondary-container: #E8EAED;

  --md-sys-color-surface: #202124;
  --md-sys-color-on-surface: #E3E3E3;
  --md-sys-color-surface-variant: #292A2D;
  --md-sys-color-on-surface-variant: #C4C7C5;

  --md-sys-color-error: #F28B82;
  --md-sys-color-on-error: #601410;
  --md-sys-color-error-container: #8C1D18;
  --md-sys-color-on-error-container: #F9DEDC;

  --md-sys-color-background: #202124;
  --md-sys-color-on-background: #E3E3E3;

  --md-sys-color-outline: #5F6368;
  --md-sys-color-outline-variant: #3C4043;
}
```

## Tipografia

### Escala Tipográfica Material 3

```css
/* Display - Grandes títulos */
--md-sys-typescale-display-large: 57px / 64px;
--md-sys-typescale-display-medium: 45px / 52px;
--md-sys-typescale-display-small: 36px / 44px;

/* Headline - Títulos de seção */
--md-sys-typescale-headline-large: 32px / 40px;
--md-sys-typescale-headline-medium: 28px / 36px;
--md-sys-typescale-headline-small: 24px / 32px;

/* Title - Títulos menores */
--md-sys-typescale-title-large: 22px / 28px;
--md-sys-typescale-title-medium: 16px / 24px (weight: 500);
--md-sys-typescale-title-small: 14px / 20px (weight: 500);

/* Body - Texto de corpo */
--md-sys-typescale-body-large: 16px / 24px;
--md-sys-typescale-body-medium: 14px / 20px;
--md-sys-typescale-body-small: 12px / 16px;

/* Label - Rótulos e botões */
--md-sys-typescale-label-large: 14px / 20px (weight: 500);
--md-sys-typescale-label-medium: 12px / 16px (weight: 500);
--md-sys-typescale-label-small: 11px / 16px (weight: 500);
```

### Font Stack

```css
font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Helvetica Neue', Arial, sans-serif;
```

## Elevação e Sombras

Material 3 usa 5 níveis de elevação:

```css
/* Elevation Levels */
--md-sys-elevation-level0: none;
--md-sys-elevation-level1: 0 1px 2px 0 rgba(0,0,0,0.3),
                           0 1px 3px 1px rgba(0,0,0,0.15);
--md-sys-elevation-level2: 0 1px 3px 0 rgba(0,0,0,0.3),
                           0 4px 8px 3px rgba(0,0,0,0.15);
--md-sys-elevation-level3: 0 2px 6px 2px rgba(0,0,0,0.3),
                           0 8px 16px 6px rgba(0,0,0,0.15);
--md-sys-elevation-level4: 0 4px 8px 3px rgba(0,0,0,0.3),
                           0 12px 28px 8px rgba(0,0,0,0.15);
--md-sys-elevation-level5: 0 8px 12px 6px rgba(0,0,0,0.3),
                           0 16px 32px 12px rgba(0,0,0,0.15);
```

## Border Radius (Shape System)

```css
/* Shape Tokens */
--md-sys-shape-corner-none: 0px;
--md-sys-shape-corner-extra-small: 4px;
--md-sys-shape-corner-small: 8px;
--md-sys-shape-corner-medium: 12px;
--md-sys-shape-corner-large: 16px;
--md-sys-shape-corner-extra-large: 28px;
--md-sys-shape-corner-full: 9999px;

/* Component Specific */
--md-button-shape: 20px; /* Full rounded */
--md-card-shape: 12px;
--md-dialog-shape: 28px;
--md-chip-shape: 8px;
--md-fab-shape: 16px;
```

## Componentes Principais

### Buttons

**Tipos:**
1. **Filled** - Ações principais (primary color)
2. **Outlined** - Ações secundárias (outline)
3. **Text** - Ações terciárias (sem fundo)
4. **Elevated** - Com sombra
5. **Tonal** - Com container colorido

**Estados:**
- Default
- Hover
- Focus
- Active
- Disabled

### Cards

**Tipos:**
1. **Elevated** - Com sombra
2. **Filled** - Com cor de fundo
3. **Outlined** - Com borda

### Dialogs (Modals)

**Características:**
- Border radius: 28px
- Backdrop com overlay
- Padding generoso
- Botões de ação no footer

### Progress Indicators

**Tipos:**
1. **Linear** - Barra horizontal
2. **Circular** - Indicador circular
3. **Segmented** - Chrome usa este tipo no Material 3 Expressive

### Notifications

**No Chrome:**
- Usam API nativa `chrome.notifications`
- Seguem o design do sistema operacional
- Tipos: basic, image, list, progress

## Motion & Animation

### Durations

```css
--md-sys-motion-duration-short1: 50ms;
--md-sys-motion-duration-short2: 100ms;
--md-sys-motion-duration-short3: 150ms;
--md-sys-motion-duration-short4: 200ms;
--md-sys-motion-duration-medium1: 250ms;
--md-sys-motion-duration-medium2: 300ms;
--md-sys-motion-duration-medium3: 350ms;
--md-sys-motion-duration-medium4: 400ms;
--md-sys-motion-duration-long1: 450ms;
--md-sys-motion-duration-long2: 500ms;
```

### Easing Functions

```css
--md-sys-motion-easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--md-sys-motion-easing-emphasized: cubic-bezier(0.0, 0.0, 0.2, 1);
--md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1.0);
--md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0.0, 0.8, 0.15);
```

## Chrome Material 3 Expressive (2025)

O Chrome está implementando uma variante "Expressive" do Material 3:

### Mudanças Visuais:
- **Progress indicators**: Segmentados com cantos arredondados
- **Ícones de menu**: Círculos com fundo
- **Tabs**: Botões em containers arredondados
- **Tab groups**: Cores aplicadas a todo o card

### Aplicação no PerspectiveLens:
- Usar indicadores de progresso segmentados
- Botões em containers arredondados
- Cores consistentes com o Chrome

## Best Practices

### 1. Modo Escuro Automático

```javascript
// Detectar preferência do sistema
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

// Listener para mudanças
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
});
```

### 2. Design Tokens

Use variáveis CSS em vez de valores hardcoded:

```css
/* ❌ Evite */
color: #1A73E8;
border-radius: 20px;

/* ✅ Prefira */
color: var(--md-sys-color-primary);
border-radius: var(--md-button-shape);
```

### 3. Acessibilidade

- Contraste mínimo 4.5:1 para texto normal
- Contraste mínimo 3:1 para texto grande
- Estados de foco sempre visíveis
- Usar ARIA labels quando apropriado

### 4. Performance

- Usar `transform` e `opacity` para animações
- Evitar animações em propriedades layout-triggering
- Usar `will-change` com cuidado

## Integração com Chrome Extensions

### Popup/Options Pages

Usar Material 3 tokens diretamente em CSS:

```html
<link rel="stylesheet" href="ui/design-system.css">
```

### Content Scripts

Isolar estilos com prefixos ou Shadow DOM:

```css
.pl-button {
  background: var(--md-sys-color-primary);
  /* ... */
}
```

### Notificações

Usar `chrome.notifications` API - design automático:

```javascript
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icon.png',
  title: 'Título',
  message: 'Mensagem',
  buttons: [{ title: 'Ação' }]
});
```

## Recursos Adicionais

- **Figma Kit**: https://www.figma.com/community/file/1035203688168086460
- **Color Tool**: https://m3.material.io/theme-builder
- **Icons**: https://fonts.google.com/icons
- **Guidelines**: https://m3.material.io/foundations
