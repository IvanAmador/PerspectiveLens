# PerspectiveLens Panel - Modular Architecture

## Estrutura Refatorada

O sistema de renderização do painel foi completamente refatorado para suportar análise progressiva multi-etapas com o Gemini Nano.

### Arquitetura

```
ui/panel/
├── panel-renderer.js          # Orquestrador principal
├── panel-styles.css           # Estilos minimalistas Chrome Design System
├── index.js                   # Exports consolidados
└── stages/
    ├── stage1-renderer.js     # Context & Trust Signal
    ├── stage2-renderer.js     # Consensus Facts
    ├── stage3-renderer.js     # Factual Disputes
    └── stage4-renderer.js     # Perspective Differences
```

## Componentes

### PanelRenderer (panel-renderer.js)

Orquestrador que coordena a renderização progressiva das 4 etapas.

**Métodos principais:**

```javascript
// Renderização progressiva (uma etapa por vez)
renderer.updateStage(stage, data, perspectives)

// Renderização completa (todas etapas de uma vez)
renderer.renderComplete(analysis, perspectives)

// Utilitários
renderer.reset()
renderer.renderPerspectivesModal()
renderer.validateAnalysis(analysis)
```

### Stage Renderers

Cada estágio tem seu próprio módulo independente:

#### Stage 1: Context & Trust Signal
- **Dados:** `{ story_summary, trust_signal, reader_action }`
- **Função:** Resumo inicial e sinal de confiança
- **Renderiza:** Card de resumo com badge de confiança

#### Stage 2: Consensus Facts
- **Dados:** `{ consensus: Array<{fact, sources}> }`
- **Função:** Fatos em que múltiplas fontes concordam
- **Renderiza:** Lista de fatos com tags de fontes

#### Stage 3: Factual Disputes
- **Dados:** `{ factual_disputes: Array<{what, claim_a, claim_b, sources_a, sources_b}> }`
- **Função:** Contradições factuais diretas
- **Renderiza:** Comparação lado a lado de claims conflitantes

#### Stage 4: Perspective Differences
- **Dados:** `{ perspective_differences, perspective_differences_2, perspective_differences_3 }`
- **Função:** Diferenças de enquadramento e ênfase
- **Renderiza:** Comparação de abordagens jornalísticas

### PanelLoader (panel-loader.js)

Carrega os módulos ES6 e instancia o painel globalmente.

## Design System

### CSS Minimalista Chrome

O novo `panel-styles.css` segue rigorosamente o Material Design 3 do Chrome:

- **Tokens de design:** Usa exclusivamente variáveis CSS do `design-system.css`
- **Cores:** Adaptação automática dark/light mode
- **Espaçamento:** Sistema baseado em 4px
- **Animações:** Material Motion com easing apropriado
- **Elevação:** Sombras Chrome (shadow-01 a shadow-05)
- **Tipografia:** Sistema hierárquico claro

### Classes CSS Principais

```css
/* Layout */
.pl-panel                    /* Container principal */
.pl-panel-header            /* Header fixo */
.pl-panel-body              /* Área scrollável */
.pl-panel-footer            /* Footer com metadata */

/* Estágios */
.pl-stage                   /* Container de estágio */
.pl-card                    /* Card destaque */
.pl-section                 /* Seção de conteúdo */

/* Componentes */
.pl-badge-{type}            /* Badges: success, warning, error, info */
.pl-list-item-{type}        /* Items: consensus, dispute, perspective */
.pl-source-tag              /* Tag de fonte clicável */
.pl-btn-icon                /* Botão icone circular */
.pl-btn-link                /* Link de texto */

/* Estados */
.pl-state                   /* Loading/error states */
.pl-modal                   /* Modal de perspectivas */
```

## Fluxo de Renderização

### Modo Progressivo

```
1. Stage 1 completa → Renderiza Context & Trust
2. Stage 2 completa → Renderiza Consensus Facts
3. Stage 3 completa → Renderiza Factual Disputes
4. Stage 4 completa → Renderiza Perspective Differences + Footer
```

Cada estágio é **acumulativo** - os dados anteriores são mantidos.

### Modo Completo

```
1. Recebe análise completa
2. Renderiza todas as 4 etapas de uma vez
3. Adiciona footer com metadata
```

## Uso

### Em content.js

```javascript
// Modo progressivo
function handleAnalysisStageComplete(data) {
  window.PerspectiveLensPanel.showAnalysisProgressive(
    data.stage,
    data.stageData,
    data.perspectives
  );
}

// Modo completo
function handleShowAnalysis(data) {
  window.PerspectiveLensPanel.showAnalysis({
    ...data.analysis,
    perspectives: data.perspectives
  });
}
```

### Validação de Dados

Cada renderer tem método `validate()`:

```javascript
const validation = Stage1Renderer.validate(data);
if (!validation.isValid) {
  console.warn('Validation errors:', validation.errors);
}
```

## Benefícios da Refatoração

1. **Manutenibilidade:** Cada estágio em arquivo separado
2. **Testabilidade:** Módulos independentes e validáveis
3. **Performance:** Renderização incremental otimizada
4. **Escalabilidade:** Fácil adicionar novos estágios
5. **Design System:** Consistência visual total com Chrome
6. **Type Safety:** Validação de dados em cada estágio

## Migration Guide

### De analysis-panel.js para panel-loader.js

A API pública permanece a mesma:

```javascript
// Ambas versões suportam:
window.PerspectiveLensPanel.show()
window.PerspectiveLensPanel.hide()
window.PerspectiveLensPanel.showLoading()
window.PerspectiveLensPanel.showError(error)
window.PerspectiveLensPanel.showAnalysis(analysis)
window.PerspectiveLensPanel.showAnalysisProgressive(stage, data, perspectives)
```

Nenhuma mudança necessária em `content.js` ou `background.js`.

## Próximos Passos

- [ ] Adicionar animações de transição entre estágios
- [ ] Implementar skeleton loading para cada estágio
- [ ] Adicionar suporte a temas customizados
- [ ] Criar testes unitários para cada renderer
- [ ] Implementar analytics de visualização por estágio
