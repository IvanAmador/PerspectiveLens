# 🧪 Teste Imediato - Fluxo de Detecção + Keywords

## ✅ O que foi corrigido:

1. **Cache de AI availability** - Não vai mais checar a cada 2 segundos (cache de 30s)
2. **Logs melhorados** - Ícones e mensagens mais claras
3. **Content script** - Agora mostra resposta do background
4. **Auto-detecção de idioma** - `extractKeywords()` detecta automaticamente se não receber idioma

---

## 📋 Como Testar

### Passo 1: Recarregar extensão
```
1. chrome://extensions
2. Clicar em "Reload" no PerspectiveLens
```

### Passo 2: Abrir console do Background Worker
```
1. chrome://extensions
2. Clicar em "service worker" no PerspectiveLens
```

### Passo 3: Visitar um site de notícias

**Opções de teste:**
- https://www.bbc.com/news (inglês)
- https://www.nytimes.com (inglês)
- https://g1.globo.com (português)
- https://www.xinhuanet.com/english/ (inglês)

### Passo 4: Abrir DevTools da página (F12)

---

## 📊 Logs Esperados

### No Console da Página (DevTools):
```
PerspectiveLens: Starting data extraction...
PerspectiveLens: Extracted Title - Climate summit reaches...
PerspectiveLens: Detection score is 5
PerspectiveLens: News article detected!
PerspectiveLens: Final Extracted data object: {url, title, source, ...}
PerspectiveLens: Sending article data to background worker...
PerspectiveLens: Article processed successfully!
PerspectiveLens: Keywords extracted: ['climate', 'summit', 'agreement', ...]
PerspectiveLens: Status: keywords_extracted
```

### No Console do Background Worker:
```
[PerspectiveLens] Message received: NEW_ARTICLE_DETECTED
[PerspectiveLens] 🔍 Processing new article
[PerspectiveLens] URL: https://www.bbc.com/news/...
[PerspectiveLens] Title: Climate summit reaches historic agreement
[PerspectiveLens] Source: www.bbc.com
[PerspectiveLens] Language: en
[PerspectiveLens] Content length: 4523
[PerspectiveLens] 📝 Starting keyword extraction...
[PerspectiveLens] Auto-detecting language for title: Climate summit...
[PerspectiveLens] Detected language: en
[PerspectiveLens] Creating Language Model session...
[PerspectiveLens] Session created successfully
[PerspectiveLens] Extracting keywords from: Climate summit...
[PerspectiveLens] ✅ Keywords extracted: ['climate', 'summit', 'agreement', 'historic']
[PerspectiveLens] Article processed successfully
```

### No Popup (opcional):
```
[PerspectiveLens] Using cached AI availability: available  ← DEVE VER ISTO EM VEZ DE CHECAR TODA VEZ
```

---

## ✅ Checklist de Verificação

### Detecção de Artigo
- [ ] Página detecta artigo (score >= 3)
- [ ] Mensagem enviada para background
- [ ] Background recebe mensagem

### Processamento
- [ ] Background inicia processamento
- [ ] Idioma detectado automaticamente
- [ ] Keywords extraídos com sucesso
- [ ] Resposta retorna para content script

### Performance
- [ ] Cache de AI availability funciona (log diz "Using cached")
- [ ] Não vê "Language Model availability: available" repetindo toda hora
- [ ] Processamento completa em < 6 segundos

### Logs
- [ ] Ícones aparecem (🔍, 📝, ✅)
- [ ] Informações detalhadas aparecem
- [ ] Nenhum erro no console

---

## 🐛 Se algo der errado:

### "LanguageDetector is not defined"
```
chrome://flags/#language-detection-api → Enabled
Reiniciar Chrome
```

### "Translator API not available"
```
chrome://flags/#translation-api → Enabled
Reiniciar Chrome
```

### Artigo não detectado
```
Verificar score no console da página
Se score < 3, não é artigo de notícia segundo heurística
```

### Nenhuma mensagem no background
```
Verificar se service worker está ativo em chrome://extensions
Pode precisar clicar em "service worker" novamente
```

---

## 🎯 Próximo Passo

Quando este teste passar:
✅ **Implementar Summarizer API** (próxima feature)

---

**Me avise quando testar e mostre os logs!** 🚀
