# Análise de Erros Críticos - PerspectiveLens

## Resumo Executivo

O projeto apresenta **inconsistências graves** entre:
1. Schema JSON oficial ([`prompts/comparative-analysis-schema.json`](prompts/comparative-analysis-schema.json))
2. Schema hardcoded em [`api/languageModel.js`](api/languageModel.js:524-582)
3. Prompt template ([`prompts/comparative-analysis-v2.txt`](prompts/comparative-analysis-v2.txt))
4. UI que renderiza os dados ([`ui/analysis-panel.js`](ui/analysis-panel.js), [`scripts/panel-injector.js`](scripts/panel-injector.js))

**Resultado:** O AI pode retornar dados em um formato, mas o UI espera outro, causando bugs de renderização.

---

## ERRO #1: CONSENSUS - Campo `fact` vs `point`

### Schema JSON Oficial (CORRETO)
```json
{
  "consensus": [{
    "fact": "string",           // ✓ Nome correto
    "sources": ["string"],
    "confidence": "high|medium|low"
  }]
}
```

### Schema Hardcoded (ERRADO)
```javascript
// api/languageModel.js:534-542
consensus: {
  items: {
    properties: {
      point: { type: 'string' },  // ❌ ERRADO - deveria ser 'fact'
      sources: { type: 'array' }  // ✓ OK
    }
  }
}
```

### Prompt v2 (CORRETO)
```json
"consensus": [
  {
    "fact": "UK set 2030 as deadline...",  // ✓ Usa 'fact'
    "sources": ["BBC", "Fox News"],
    "confidence": "high"
  }
]
```

### UI (WORKAROUND)
```javascript
// ui/analysis-panel.js:236
const fact = item.fact || item.point || 'No fact provided';
```

**IMPACTO:** AI pode retornar `point` ao invés de `fact`, causando renderização inconsistente.

---

## ERRO #2: DISPUTES.PERSPECTIVES - Array vs Object

### Schema JSON Oficial (CORRETO)
```json
{
  "disputes": [{
    "topic": "string",
    "perspectives": {
      "BBC": {
        "viewpoint": "string",
        "evidence": "string"
      },
      "Fox News": {
        "viewpoint": "string",
        "evidence": "string"
      }
    },
    "significance": "major|minor"
  }]
}
```

### Schema Hardcoded (TOTALMENTE ERRADO)
```javascript
// api/languageModel.js:550-559
perspectives: {
  type: 'array',  // ❌ ERRADO - deveria ser 'object'
  items: {
    properties: {
      view: { type: 'string' },      // ❌ ERRADO - deveria ser 'viewpoint'
      sources: { type: 'array' }     // ❌ ERRADO - não existe no schema oficial
    }
  }
}
```

### Prompt v2 (CORRETO)
```json
"disputes": [{
  "topic": "Industry impact assessment",
  "perspectives": {
    "Fox News": {
      "viewpoint": "Policy could cost thousands of jobs",
      "evidence": "Industry leaders warn..."
    },
    "BBC": {
      "viewpoint": "Industry concerns focused on infrastructure",
      "evidence": "automotive industry representatives..."
    }
  },
  "significance": "major"
}]
```

### UI (WORKAROUND COMPLEXO)
```javascript
// ui/analysis-panel.js:290-327
if (Array.isArray(perspectives)) {
  // Tenta processar como ARRAY
  perspectivesHTML = perspectives.map(p => {
    const source = p.source || p.name;
    const viewpoint = p.viewpoint || p.view;
  });
} else {
  // Tenta processar como OBJETO
  perspectivesHTML = Object.entries(perspectives).map(([sourceName, data]) => {
    // ...
  });
}
```

**IMPACTO CRÍTICO:** AI pode retornar formato incorreto de Array, quebrando a renderização das perspectivas.

---

## ERRO #3: OMISSIONS - String[] vs Object[]

### Schema JSON Oficial (CORRETO)
```json
{
  "omissions": {
    "Fox News": [
      {
        "fact": "Environmental groups praised the policy",
        "mentioned_by": ["BBC"],
        "relevance": "medium"
      }
    ]
  }
}
```

### Schema Hardcoded (ERRADO)
```javascript
// api/languageModel.js:563-568
omissions: {
  type: 'object',
  additionalProperties: {
    type: 'array',
    items: { type: 'string' }  // ❌ ERRADO - deveria ser objeto com fact, mentioned_by, relevance
  }
}
```

**IMPACTO:** AI retornará array de strings simples ao invés de objetos estruturados.

---

## ERRO #4: BIAS_INDICATORS - Estrutura Completamente Diferente

### Schema JSON Oficial (CORRETO)
```json
{
  "bias_indicators": [{
    "source": "Fox News",
    "type": "framing",
    "description": "Frames policy as controversial...",
    "examples": [
      "controversial electric vehicle mandates",
      "burden consumers"
    ]
  }]
}
```

### Schema Hardcoded (ERRADO)
```javascript
// api/languageModel.js:570-579
bias_indicators: {
  items: {
    properties: {
      source: { type: 'string' },
      indicators: { type: 'array', items: { type: 'string' } }
      // ❌ FALTA: type, description, examples
    }
  }
}
```

**IMPACTO:** AI não retornará `type`, `description`, `examples` - apenas `indicators` genéricos.

---

## ERRO #5: SUMMARY - Falta Completamente

### Schema JSON Oficial (CORRETO)
```json
{
  "summary": {
    "main_story": "UK government set 2030 deadline...",
    "key_differences": "Coverage differs...",
    "recommendation": "Readers should recognize..."
  }
}
```

### Schema Hardcoded (NÃO EXISTE!)
```javascript
// api/languageModel.js:530-582
// ❌ Campo 'summary' não está definido no schema!
// Apenas 'main_story' está no root
```

### Prompt v2 (CORRETO)
Inclui `summary` como objeto separado.

### UI (ESPERA AMBOS)
```javascript
// ui/analysis-panel.js:169
const mainStory = analysis.main_story || analysis.summary?.main_story;
```

**IMPACTO:** AI pode retornar `summary` como objeto ou `main_story` no root, causando confusão.

---

## ERRO #6: PERSPECTIVES não está no Response Schema

O schema hardcoded define a estrutura de análise, mas não inclui o array `perspectives` que o UI precisa para listar as fontes analisadas.

### UI Espera
```javascript
// ui/analysis-panel.js:465-492
renderFooter(perspectives) {
  const sourceNames = perspectives
    .map(p => p.source || p.name)
    // ...
}
```

### Background.js Envia
```javascript
// scripts/background.js:492-498
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'SHOW_ANALYSIS',
  data: {
    analysis: comparativeAnalysis,  // ✓ Tem a análise
    perspectives: perspectivesWithContent,  // ✓ Tem as perspectivas
    articleData
  }
});
```

**STATUS:** Isso funciona porque o background.js adiciona manualmente.

---

## ERRO #7: UI Duplicado e Não Utilizado

### Problema
- [`ui/analysis-panel.html`](ui/analysis-panel.html) existe mas NÃO é usado
- [`ui/analysis-panel.js`](ui/analysis-panel.js) existe mas NÃO é injetado automaticamente
- [`scripts/panel-injector.js`](scripts/panel-injector.js) cria seu próprio HTML inline

### Consequência
- Código duplicado
- Manutenção difícil (3 lugares para atualizar)
- Inconsistências entre os painéis

---

## RECOMENDAÇÕES

### PRIORIDADE ALTA (Corrigir Imediatamente)

1. **Alinhar Schema Hardcoded com Schema JSON Oficial**
   - Corrigir [`api/languageModel.js:524-582`](api/languageModel.js:524-582)
   - Usar o schema JSON oficial como fonte única de verdade

2. **Simplificar UI para Um Único Formato**
   - Remover workarounds para múltiplos formatos
   - Assumir que AI sempre seguirá o schema oficial

3. **Consolidar UI**
   - Decidir: usar `analysis-panel.js` ou `panel-injector.js`
   - Remover duplicação

### PRIORIDADE MÉDIA

4. **Melhorar CSS para Seguir Padrão Chrome**
   - Cores mais próximas do Chrome DevTools
   - Tipografia consistente
   - Espaçamentos padronizados

5. **Adicionar Validação de Dados**
   - Validar response da AI contra schema antes de renderizar
   - Log warnings se estrutura estiver incorreta

### PRIORIDADE BAIXA

6. **Documentar Formato de Dados**
   - TypeScript interfaces ou JSDoc completo
   - Exemplos de dados de teste

---

## Próximos Passos

1. Corrigir `loadAnalysisSchema()` em [`api/languageModel.js`](api/languageModel.js:524-582)
2. Atualizar UI para remover workarounds
3. Melhorar CSS para estilo Chrome
4. Testar com dados reais