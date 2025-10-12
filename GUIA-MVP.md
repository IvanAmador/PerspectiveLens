# **PerspectiveLens - Product Requirements Document**

**Versão:** 3.0
**Última Atualização:** Outubro de 2025
**Status:** Fonte da Verdade
**Projeto:** Chrome Built-in AI Challenge 2025
**Alvo:** Melhor Aplicação de IA Híbrida (prêmio de $9.000)

---

## **1. Sumário Executivo**

### **Visão do Produto**
Uma extensão para Chrome que revela como a mesma notícia é reportada globalmente. Utiliza a IA nativa do Chrome para tradução, resumo e análise comparativa, funcionando em qualquer site de notícias através de um modelo híbrido online/offline, com uma interface que exibe resultados em tempo real e indicadores visuais de sentimento para uma compreensão instantânea.

### **O Problema**
- Leitores consomem notícias de uma única fonte sem perceber o viés regional ou editorial.
- Barreiras linguísticas impedem o acesso a perspectivas internacionais cruciais.
- A falta de perspectivas não-ocidentais cria pontos cegos na compreensão de eventos globais.
- Soluções existentes requerem assinaturas caras e enviam dados de navegação sensíveis para servidores externos.

### **A Solução**
Uma extensão de Chrome que, de forma automática:
1.  Detecta que o usuário está lendo um artigo de notícia em **qualquer site**.
2.  Busca a mesma história em fontes internacionais usando o **Google News RSS**.
3.  Extrai o conteúdo completo dos artigos de forma limpa e segura.
4.  Traduz, resume e analisa o sentimento de cada perspectiva **localmente** (Chrome AI).
5.  **Exibe cada perspectiva na UI assim que fica pronta (streaming)**, oferecendo valor em segundos.
6.  Compara todas as perspectivas e destaca diferenças, consensos e omissões **localmente** (Chrome AI).
7.  Armazena as análises em um cache granular para reuso offline e aceleração de análises futuras.

### **Critérios de Sucesso**
- ✅ Usa 4 APIs de IA nativas do Chrome.
- ✅ **Exibe a primeira perspectiva em menos de 4 segundos**.
- ✅ Processa 5 perspectivas em menos de 15 segundos.
- ✅ Tradução e análise funcionam 100% offline (após o download dos modelos).
- ✅ A busca por notícias requer internet, mas o cache permite acesso offline completo.
- ✅ **Não requer chaves de API ou configuração do usuário.**

---

## **2. Público-Alvo**

### **Personas Primárias**

**Laura - Jornalista Investigativa (28 anos)**
- **Necessidade:** Verificar como a mídia internacional cobre eventos locais.
- **Dor:** Gasta horas traduzindo artigos manualmente.
- **Objetivo:** Identificar ângulos e informações não cobertas pela mídia nacional.

**Dr. Chen - Professor de Relações Internacionais (45 anos)**
- **Necessidade:** Ensinar pensamento crítico sobre o consumo de mídia.
- **Dor:** Preparar manualmente materiais comparativos para aulas é demorado.
- **Objetivo:** Mostrar em tempo real como o "framing" de uma notícia muda entre países.

**Miguel - Investidor (32 anos)**
- **Necessidade:** Entender as reações de mercados internacionais a eventos globais.
- **Dor:** Notícias financeiras de diferentes regiões chegam com atraso e viés.
- **Objetivo:** Antecipar movimentos de mercado com base em uma visão global.

---

## **3. Arquitetura Técnica**

### **3.1 Arquitetura de Alto Nível**
```
Usuário lê notícia → Content Script detecta artigo
                            ↓
                Background Service Worker
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
   Google News RSS                      Chrome Built-in AI APIs
   (requer internet)                    (offline após download)
        ↓                                       ↓
   Busca 5 URLs de perspectivas         Traduz → Resume → Compara
     + Extração de Conteúdo                     ↓
        ↓                                       ↓
        └───────────────────┬───────────────────┘
                            ↓
                Cache Granular (IndexedDB)
                            ↓
            Perspective Panel UI (Streaming)
```

### **3.2 Modelo de Conectividade**

**REQUER INTERNET:** Análise inicial de uma notícia e extração de conteúdo.
**FUNCIONA OFFLINE:** Tradução, resumo, análise comparativa e visualização de análises cacheadas.

---

## **4. Especificações das Funcionalidades**

### **F-001: Detecção de Artigo de Notícia**

**Descrição:** Detectar automaticamente quando o usuário está lendo uma notícia em **qualquer site**.
**Lógica:** Análise heurística baseada em metadados (`article:*`, JSON-LD) e estrutura do DOM (`<h1>`, `<article>`), sem depender de uma whitelist.

### **F-002: Extração de Palavras-chave**

**Descrição:** Extrair de 3 a 5 entidades/tópicos do título do artigo para a busca.
**Stack:** Language Detector API, Prompt API.

### **F-003: Descoberta de Perspectivas**

**Descrição:** Buscar dinamicamente no Google News por matérias semelhantes em diferentes regiões geográficas e linguísticas.
**Estratégia:** Executar buscas paralelas para combinações de país/idioma (EUA/en, China/zh, Brasil/pt, etc.) para garantir diversidade global de forma algorítmica.

### **F-003.5: Extração de Conteúdo Completo**

**Descrição:** Extrair o texto completo de cada artigo, removendo elementos desnecessários.
**Stack:** **Mozilla's Readability.js**, **Offscreen Document API**.
**Processo:** A extração ocorre em um processo separado para não impactar a performance da aba do usuário. O conteúdo limpo é cacheado individualmente.

### **F-004: Pipeline de Tradução**

**Descrição:** Traduzir as perspectivas de outros idiomas para o português.
**Stack:** Translator API.

### **F-005: Pipeline de Resumo**

**Descrição:** Condensar cada perspectiva em 3 pontos-chave.
**Stack:** Summarizer API.

### **F-006: Análise Comparativa e de Sentimento**

**Descrição:** Comparar todos os resumos para identificar consensos, disputas, omissões e o sentimento de cada artigo.
**Stack:** Prompt API.
**Prompt do Sistema (Atualizado):**
```
You are a media analyst. For each article summary provided, determine its sentiment (Positive, Neutral, Negative). Then, compare all summaries and identify:
1. CONSENSUS: Facts all sources agree on.
2. DISPUTES: Points where sources differ.
3. OMISSIONS: Information only some sources mention.
Output a single JSON object with a 'perspectives' array (containing sentiment) and the comparison fields.
```

### **F-007: Gerenciamento de Cache**

**Descrição:** Armazenar dados para acesso offline e performance aprimorada.
**Stack:** IndexedDB.
**Estrutura (Atualizada):**
1.  **Store `analyses`:** Armazena o resultado completo da análise (perspectivas + comparação) para uma URL original. Chave: URL.
2.  **Store `articleContent`:** **Cache granular.** Armazena o conteúdo limpo de *cada artigo individual* extraído pelo Readability.js. Chave: URL do artigo.
**Lógica:** Antes de buscar qualquer URL, o sistema verifica o cache `articleContent`. Se o conteúdo já existir, ele é usado diretamente, economizando uma requisição de rede e processamento.

### **F-008: Interface do Usuário (UI)**

**Descrição:** Um painel flutuante que exibe as perspectivas de forma clara, interativa e **em tempo real**.
**Stack:** Vanilla JavaScript, CSS3.
**Componentes:**
-   **Botão Flutuante:** Ícone de globo (🌍) que indica o status da análise.
-   **Painel Lateral:**
    -   **Streaming de Resultados:** Ao ser aberto, o painel exibe imediatamente 5 "cartões fantasmas" (shimmer effect). Conforme cada perspectiva é processada (traduzida e resumida), seu respectivo cartão é preenchido com os dados. O usuário começa a ver resultados em segundos.
    -   **Card de Perspectiva com Sentimento:** Cada card exibirá o resumo e terá um **indicador visual de sentimento**, como uma borda colorida à esquerda (Verde: Positivo, Amarelo: Neutro, Vermelho: Negativo), permitindo uma análise visual instantânea.
    -   **Seção de Comparação:** Aparece na parte inferior do painel assim que a análise comparativa final (F-006) é concluída.

### **F-009: Popup da Extensão (Atualizado)**

**Descrição:** Um painel de controle interativo, inspirado no mockup fornecido.
**Conteúdo e Funcionalidade:**
```
┌──────────────────────────────────────────────────┐
│   🌐 PerspectiveLens                      v3.0   │
├──────────────────────────────────────────────────┤
│ AI MODELS                                     ↻  │
│ ┌────────────────────────────────────────────┐ │
│ │ 🧠 Gemini Nano        [ Status: ✅ Ready ]   │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│ STATISTICS                                       │
│ ┌───────────────────┐ ┌────────────────────────┐ │
│ │         47        │ │ Clicar para ver Histórico│ │
│ │  Analyses Cached  │ │           →            │ │
│ └───────────────────┘ └────────────────────────┘ │
│                                                  │
├──────────────────────────────────────────────────┤
│  [🗑️ Clear Cache]         [⚙️ Settings]           │
├──────────────────────────────────────────────────┤
│      🐙 GitHub      |      ❓ Help      |      ℹ️ About       │
└──────────────────────────────────────────────────┘
```
-   **Interatividade:** O card de estatísticas "Analyses Cached" é um botão que leva o usuário a uma nova tela com o histórico de análises, permitindo revisitar resultados passados.

---

## **5. Fluxo de Dados (Atualizado para Streaming)**

1.  **AÇÃO DO USUÁRIO:** Abre um artigo de notícia.
2.  **CONTENT SCRIPT:** Detecta a notícia (F-001).
3.  **SERVICE WORKER:** Inicia a análise, busca URLs (F-003) e começa a processar a primeira perspectiva.
4.  **SERVICE WORKER → CONTENT SCRIPT:** Envia mensagem `perspective_ready` com os dados da primeira perspectiva.
5.  **CONTENT SCRIPT:** Atualiza o primeiro card na UI.
6.  *(O processo se repete para as perspectivas 2, 3, 4 e 5)*.
7.  **SERVICE WORKER:** Após processar todas, executa a comparação (F-006).
8.  **SERVICE WORKER → CONTENT SCRIPT:** Envia mensagem `comparison_ready`.
9.  **CONTENT SCRIPT:** Renderiza a seção de análise comparativa.

---

## **8. Requisitos de Performance**

| Métrica | Alvo |
| :--- | :--- |
| **Tempo para a Primeira Perspectiva** | **< 4 segundos** |
| Análise Completa | < 15 segundos |
| Leitura do Cache | < 50ms |
| Uso de Memória | < 100MB |

---

## **16. Registro de Decisões Chave**

| Decisão | Justificativa | Data |
| :--- | :--- | :--- |
| **Substituir NewsAPI.org por Google News RSS** | Remove a necessidade de chave de API e limites, melhorando privacidade e usabilidade. | Out 2025 |
| **Remover a whitelist de domínios** | Torna a extensão universalmente compatível, usando uma busca geo-linguística dinâmica. | Out 2025 |
| **Adotar UI com Streaming de Resultados** | Melhora drasticamente a percepção de performance, entregando valor ao usuário em segundos, em vez de após uma longa espera. | Out 2025 |
| **Implementar Cache Granular de Conteúdo** | Acelera análises futuras ao evitar o download e processamento repetido de artigos que aparecem em diferentes buscas. | Out 2025 |
| **Adicionar Análise de Sentimento Visual** | Fornece uma camada de compreensão rápida e visual, permitindo ao usuário identificar o tom da cobertura global de relance. | Out 2025 |
| **Não usar frameworks (React, etc.)** | Minimiza o tamanho do pacote da extensão e maximiza a performance de renderização. | Out 2025 |

---