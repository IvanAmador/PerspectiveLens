# PerspectiveLens Settings Guide

## Overview

PerspectiveLens agora possui uma interface completa de configurações que permite personalizar completamente o comportamento da extensão. As configurações são sincronizadas entre dispositivos através do Chrome Sync e podem ser exportadas/importadas.

## Como Acessar as Configurações

### Opção 1: Via Popup
1. Clique no ícone da extensão PerspectiveLens na barra de ferramentas
2. Clique no botão de engrenagem (⚙️) no canto superior direito
3. Uma nova aba será aberta com a página de configurações

### Opção 2: Via Gerenciador de Extensões
1. Abra `chrome://extensions/`
2. Encontre PerspectiveLens
3. Clique em "Details" → "Extension options"

## Seções de Configuração

### 1. Countries & Articles

Configure quais países e quantos artigos buscar de cada fonte.

#### Seleção de Países
- **Busca**: Use a caixa de pesquisa para filtrar países por nome, código ou idioma
- **Bandeiras**: Identificação visual com emojis de bandeiras
- **Checkbox**: Marque os países que deseja incluir na análise
- **Contador de Artigos**: Defina quantos artigos buscar de cada país (1-10)

**Exemplo de uso:**
```
✅ Brazil (pt) - 3 articles
✅ China (zh-CN) - 2 articles
✅ United States (en) - 5 articles
```

#### Opções Avançadas

**Buffer per country**
- Artigos extras para buscar como backup
- Útil quando alguns artigos falham na extração
- Padrão: 2
- Range: 0-10

**Maximum articles for analysis**
- Limite total de artigos para processar pela IA
- Evita timeouts e sobrecarga
- Padrão: 10
- Range: 1-50

**Allow fallback to other countries**
- Se ativado, usa artigos de outros países quando os preferidos não têm notícias
- Garante sempre ter perspectivas diversas
- Padrão: Ativado

### 2. Content Extraction

Configure os limites de qualidade para extração de conteúdo.

#### Quality Thresholds

**Minimum content length**
- Mínimo de caracteres necessários para considerar um artigo válido
- Filtra notícias muito curtas ou fragmentadas
- Padrão: 3000 chars
- Range: 100-10000

**Maximum content length**
- Máximo de caracteres a processar por artigo
- Limita uso de memória e tempo de processamento
- Padrão: 10000 chars
- Range: 1000-50000

**Minimum word count**
- Mínimo de palavras necessárias
- Complementa a validação por caracteres
- Padrão: 500 words
- Range: 10-5000

**Extraction timeout**
- Tempo máximo de espera para extrair conteúdo de um artigo
- Evita travar em sites lentos
- Padrão: 20000 ms (20 segundos)
- Range: 5000-60000 ms

### 3. AI Analysis

Configure os parâmetros do modelo de IA Gemini Nano.

#### Analysis Settings

**Compression level**
- **Short**: Resumos muito concisos (~2-3 sentenças)
- **Medium**: Resumos balanceados (~4-6 sentenças)
- **Long**: Resumos detalhados (~8-10 sentenças) - Padrão

**Temperature**
- Controla a "criatividade" do modelo
- `0.0` = Muito focado e determinístico
- `0.7` = Balanceado (Padrão)
- `1.0` = Criativo e variado
- Range: 0.0-1.0 (0.1 steps)

**Top-K**
- Número de opções de tokens consideradas em cada passo
- Valores baixos = Mais focado
- Valores altos = Mais diversidade
- Padrão: 3
- Range: 1-10

## Funcionalidades Adicionais

### Export/Import Configurações

#### Exportar
1. Clique no botão "Export" no cabeçalho
2. Um arquivo JSON será baixado com suas configurações
3. Nome do arquivo: `perspective-lens-config-YYYY-MM-DD.json`

#### Importar
1. Clique no botão "Import" no cabeçalho
2. Selecione um arquivo JSON previamente exportado
3. As configurações serão validadas e aplicadas

**Formato do arquivo:**
```json
{
  "version": 1,
  "articleSelection": {
    "perCountry": {
      "BR": 3,
      "CN": 2,
      "US": 5
    },
    "bufferPerCountry": 2,
    "maxForAnalysis": 10,
    "allowFallback": true
  },
  "extraction": {
    "timeout": 20000,
    "qualityThresholds": {
      "minContentLength": 3000,
      "maxContentLength": 10000,
      "minWordCount": 500,
      "maxHtmlRatio": 0.4,
      "minQualityScore": 60
    }
  },
  "analysis": {
    "compressionLevel": "long",
    "model": {
      "temperature": 0.7,
      "topK": 3
    }
  },
  "lastModified": "2025-01-15T10:30:00.000Z"
}
```

### Reset to Defaults

- Clique em "Reset to defaults" no rodapé
- Confirmação será solicitada
- Todas as configurações voltarão aos valores originais

### Auto-Save Indicator

- Aparece após salvar com sucesso
- Ícone de check verde ✓
- Mensagem: "All changes saved"
- Desaparece após 3 segundos

## Sincronização

As configurações são armazenadas usando `chrome.storage.sync`:
- ✅ Sincronizadas automaticamente entre dispositivos
- ✅ Backup na nuvem do Google
- ✅ Máximo de ~100KB de dados
- ✅ Restauradas ao reinstalar a extensão

## Validação

Antes de salvar, o sistema valida:
- ✅ Pelo menos um país selecionado
- ✅ Valores dentro dos ranges permitidos
- ✅ Total de artigos não excede limites
- ✅ Formato JSON correto (no import)

Se houver erros, uma mensagem clara será exibida.

## Atalhos de Teclado

- `Ctrl/Cmd + S` - Salvar configurações

## Design

A interface segue o Chrome Material Design 3:
- 🎨 Paleta de cores nativa do Chrome
- 🌓 Suporte automático a dark mode
- 📱 Design responsivo (desktop, tablet, mobile)
- ♿ Acessível (ARIA labels, navegação por teclado)
- ⚡ Animações fluidas e performáticas

## Dicas de Uso

### Para análises rápidas
```
- Selecione 2-3 países
- 2 artigos por país
- Compression: Short
- Max articles: 6
```

### Para análises profundas
```
- Selecione 5-7 países diversos
- 3-5 artigos por país
- Compression: Long
- Max articles: 20
- Buffer: 3
```

### Para economizar recursos
```
- Min content length: 5000
- Max content length: 8000
- Timeout: 15000
- Temperature: 0.3 (mais focado)
```

## Troubleshooting

**Configurações não salvam**
- Verifique se o Chrome Sync está ativado
- Tente fazer logout/login do Chrome
- Verifique se há espaço no storage sync

**Import falha**
- Verifique se o arquivo JSON está bem formatado
- Use apenas arquivos exportados pela própria extensão
- Não edite manualmente campos desconhecidos

**Performance lenta**
- Reduza o número de países selecionados
- Diminua `maxForAnalysis`
- Aumente `minContentLength` para filtrar mais
- Reduza `timeout` para desistir mais rápido

## Arquitetura Técnica

### Arquivos Principais

```
config/
  ├── configManager.js      # Gerenciamento de storage
  └── pipeline.js           # Defaults e validação

ui/
  ├── options.html          # Página de configurações
  ├── options.css          # Estilos modernos
  └── options.js           # Lógica de UI

popup.js                   # Abre página de opções
manifest.json             # Registra options_page
```

### Fluxo de Dados

```
User Input → ConfigManager.save() → Validation → chrome.storage.sync
                                                        ↓
background.js ← CONFIG_UPDATED message ← storage.onChanged
     ↓
newsFetcher.js, contentExtractor.js, etc.
```

### API do ConfigManager

```javascript
// Carregar configuração (merged com defaults)
const config = await ConfigManager.load();

// Salvar configuração
const result = await ConfigManager.save(newConfig);

// Reset para defaults
await ConfigManager.reset();

// Exportar/Importar
const json = await ConfigManager.export();
await ConfigManager.import(jsonString);

// Acessar valor específico
const value = await ConfigManager.get('articleSelection.maxForAnalysis');
await ConfigManager.set('analysis.temperature', 0.5);
```

## Changelog

### v1.0 - Initial Release
- ✅ Interface completa de configurações
- ✅ Seletor de países com bandeiras
- ✅ Configuração de thresholds de qualidade
- ✅ Parâmetros de AI customizáveis
- ✅ Export/Import de configurações
- ✅ Sincronização via Chrome Sync
- ✅ Design Chrome Material 3
- ✅ Validação em tempo real
- ✅ Toast notifications
- ✅ Suporte a dark mode
- ✅ Responsivo (mobile-ready)
