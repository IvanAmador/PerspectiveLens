📋 Plano de Implementação: Integração Gemini 2.5 Pro API
Analisando o projeto PerspectiveLens e as capacidades do Gemini 2.5 Pro, aqui está o plano completo de implementação com foco em excelente UX/UI e integração perfeita:
🎯 Visão Geral da Implementação
Objetivo
Permitir que usuários escolham entre Gemini Nano (Chrome nativo, grátis) e Gemini 2.5 Pro (API do Google AI Studio, requer chave) com transição suave e onboarding intuitivo.
Vantagens do Gemini 2.5 Pro
Sem necessidade de tradução/resumo - Contexto gigantesco (até 2 milhões de tokens)
Análise mais profunda - Modelo muito mais poderoso com thinking capabilities
Structured output nativo - JSON schemas mais confiáveis
Flexibilidade - Não depende de disponibilidade do Chrome AI
📐 Arquitetura da Solução
1. Configuração (config/pipeline.js)
PIPELINE_CONFIG = {
  // ... configurações existentes ...
  
  analysis: {
    // NOVO: Seleção de modelo
    modelProvider: 'gemini-nano',  // 'gemini-nano' | 'gemini-2.5-pro'
    
    // NOVO: Configurações do Gemini 2.5 Pro
    gemini25Pro: {
      apiKey: '',  // Armazenado em chrome.storage.sync (criptografado)
      model: 'gemini-2.5-pro',  // ou 'gemini-2.5-flash' para velocidade
      thinkingBudget: -1,  // Dynamic thinking (default)
      includeThoughts: false,  // Não mostrar thoughts ao usuário por padrão
      skipTranslation: true,  // Pro pode processar multi-língua diretamente
      skipCompression: true,  // Pro tem contexto suficiente para artigos completos
      temperature: 0.7,
      topK: 40,
      topP: 0.95
    },
    
    // Configurações existentes do Nano
    useCompression: true,  // Só usado com Nano
    compressionLevel: 'long',
    model: {
      temperature: 0.7,
      topK: 3
    },
    // ...
  }
}
2. Nova API Wrapper (/api/gemini-2-5-pro.js)
/**
 * Gemini 2.5 Pro API Wrapper
 * Substitui Nano quando usuário configura API key
 */

class Gemini25ProAPI {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = config.model || 'gemini-2.5-pro';
    this.config = config;
  }

  /**
   * Verifica disponibilidade da API
   * @returns {Promise<'ready'|'invalid-key'|'network-error'>}
   */
  async checkAvailability() {
    if (!this.apiKey) return 'invalid-key';
    
    try {
      const response = await fetch(`${this.baseUrl}/${this.model}`, {
        headers: { 'x-goog-api-key': this.apiKey }
      });
      
      if (response.ok) return 'ready';
      if (response.status === 401 || response.status === 403) return 'invalid-key';
      return 'network-error';
    } catch (error) {
      logger.system.error('Gemini 2.5 Pro availability check failed', { error });
      return 'network-error';
    }
  }

  /**
   * Análise comparativa progressiva (4 estágios)
   * Compatível com a interface existente do languageModel.js
   */
  async compareArticlesProgressive(articles, onStageComplete, options = {}) {
    const startTime = Date.now();
    const stages = [
      { id: 1, name: 'context-trust', prompt: this._buildStage1Prompt(articles) },
      { id: 2, name: 'consensus', prompt: this._buildStage2Prompt(articles) },
      { id: 3, name: 'disputes', prompt: this._buildStage3Prompt(articles) },
      { id: 4, name: 'perspectives', prompt: this._buildStage4Prompt(articles) }
    ];

    const results = {};
    
    for (const stage of stages) {
      const stageStart = Date.now();
      
      try {
        const stageResult = await this._executeStage(stage, articles);
        results[stage.name] = stageResult;
        
        // Callback de progresso
        if (onStageComplete) {
          await onStageComplete({
            stage: stage.id,
            name: stage.name,
            result: stageResult,
            duration: Date.now() - stageStart,
            success: true
          });
        }
      } catch (error) {
        logger.system.error(`Stage ${stage.id} failed`, { error, stage: stage.name });
        
        if (onStageComplete) {
          await onStageComplete({
            stage: stage.id,
            name: stage.name,
            error: error.message,
            duration: Date.now() - stageStart,
            success: false
          });
        }
        
        // Stage 1 e 2 são críticos
        if (stage.id <= 2) throw error;
      }
    }

    return {
      ...results,
      metadata: {
        modelProvider: 'gemini-2.5-pro',
        model: this.model,
        articlesAnalyzed: articles.length,
        totalDuration: Date.now() - startTime,
        // Pro não usa compression
        compressionUsed: false,
        thinkingBudget: this.config.thinkingBudget
      }
    };
  }

  /**
   * Executa um estágio individual
   */
  async _executeStage(stage, articles) {
    const schema = this._getSchemaForStage(stage.id);
    
    const payload = {
      contents: [{ parts: [{ text: stage.prompt }] }],
      generationConfig: {
        temperature: this.config.temperature || 0.7,
        topK: this.config.topK || 40,
        topP: this.config.topP || 0.95,
        responseMimeType: 'application/json',
        responseSchema: schema,
        // Thinking config
        thinkingConfig: {
          thinkingBudget: this.config.thinkingBudget || -1,
          includeThoughts: this.config.includeThoughts || false
        }
      }
    };

    const response = await this._makeRequest(payload);
    
    // Parse JSON response
    const text = response.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  }

  /**
   * Faz requisição para API
   */
  async _makeRequest(payload, retries = 2) {
    const url = `${this.baseUrl}/${this.model}:generateContent`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`API Error: ${error.error?.message || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (attempt === retries) throw error;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Constrói prompt do Stage 1 (sem tradução, artigos originais)
   */
  _buildStage1Prompt(articles) {
    // IMPORTANTE: Pro pode processar multi-língua diretamente
    const articlesText = articles.map((article, idx) => `
### Article ${idx + 1} - ${article.country} (${article.language})
**Title:** ${article.title}
**Source:** ${article.source}
**Content:**
${article.content}  // Conteúdo COMPLETO sem compression
---
    `).join('\n');

    return `You are analyzing international news coverage to help readers understand different perspectives.

${articlesText}

Analyze these articles (in their original languages) and provide:
1. A clear summary of the main story
2. A trust signal assessment
3. Recommended reader action

Respond ONLY in English with JSON matching the provided schema.`;
  }

  // Métodos similares para stages 2, 3, 4...
  _buildStage2Prompt(articles) { /* ... */ }
  _buildStage3Prompt(articles) { /* ... */ }
  _buildStage4Prompt(articles) { /* ... */ }

  /**
   * Schemas JSON para cada estágio (compatíveis com prompts/ existentes)
   */
  _getSchemaForStage(stageId) {
    // Usar schemas existentes de /prompts/schemas/
    // mas adaptados para responseSchema do Gemini API
    const schemas = {
      1: { /* schema stage 1 */ },
      2: { /* schema stage 2 */ },
      3: { /* schema stage 3 */ },
      4: { /* schema stage 4 */ }
    };
    return schemas[stageId];
  }
}

export { Gemini25ProAPI };
3. Gerenciamento de API Key (config/apiKeyManager.js)
/**
 * Gerencia armazenamento seguro da API key
 */

const API_KEY_STORAGE_KEY = 'perspectiveLens_gemini_api_key';

class APIKeyManager {
  /**
   * Salva API key criptografada
   */
  static async save(apiKey) {
    // Validação básica
    if (!apiKey || !apiKey.startsWith('AIza')) {
      throw new Error('Invalid API key format');
    }

    // Armazena no chrome.storage.sync (já é criptografado pelo Chrome)
    await chrome.storage.sync.set({
      [API_KEY_STORAGE_KEY]: apiKey
    });

    logger.system.info('API key saved successfully');
  }

  /**
   * Carrega API key
   */
  static async load() {
    const result = await chrome.storage.sync.get(API_KEY_STORAGE_KEY);
    return result[API_KEY_STORAGE_KEY] || null;
  }

  /**
   * Remove API key
   */
  static async remove() {
    await chrome.storage.sync.remove(API_KEY_STORAGE_KEY);
    logger.system.info('API key removed');
  }

  /**
   * Valida API key fazendo uma chamada de teste
   */
  static async validate(apiKey) {
    const api = new Gemini25ProAPI(apiKey);
    const status = await api.checkAvailability();
    return status === 'ready';
  }

  /**
   * Retorna API key mascarada para exibição
   */
  static mask(apiKey) {
    if (!apiKey) return '';
    return `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
  }
}

export { APIKeyManager };
4. Modificações no Background Service (scripts/background.js)
import { Gemini25ProAPI } from '../api/gemini-2-5-pro.js';
import { APIKeyManager } from '../config/apiKeyManager.js';

// Novo handler para validação de API key
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'VALIDATE_API_KEY') {
    (async () => {
      try {
        const isValid = await APIKeyManager.validate(request.apiKey);
        sendResponse({ success: true, isValid });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;  // Async response
  }

  if (request.type === 'GET_STATUS') {
    (async () => {
      const config = await ConfigManager.load();
      
      // Status do modelo atual
      if (config.analysis.modelProvider === 'gemini-2.5-pro') {
        const apiKey = await APIKeyManager.load();
        if (!apiKey) {
          sendResponse({
            model: 'gemini-2.5-pro',
            status: 'api-key-required',
            message: 'API key não configurada'
          });
          return;
        }

        const api = new Gemini25ProAPI(apiKey);
        const availability = await api.checkAvailability();
        
        sendResponse({
          model: 'gemini-2.5-pro',
          status: availability === 'ready' ? 'ready' : 'error',
          message: availability === 'ready' 
            ? 'Gemini 2.5 Pro conectado' 
            : 'Erro na API key',
          apiKeyMasked: APIKeyManager.mask(apiKey)
        });
      } else {
        // Status do Nano (existente)
        const nanoStatus = await checkNanoAvailability();
        sendResponse(nanoStatus);
      }
    })();
    return true;
  }

  // ... handlers existentes ...
});

/**
 * Análise com roteamento de modelo
 */
async function handleNewArticle(articleData) {
  const tabId = sender.tab?.id;
  const requestId = logger.startRequest('article_analysis', tabId);
  
  try {
    const config = await ConfigManager.load();
    
    // 1. Language Detection (sempre necessário para metadados)
    logger.logUserProgress('detection', 5, 'Detecting article language...');
    const language = await detectLanguage(articleData.content);
    
    // 2. Search Perspectives
    logger.logUserProgress('search', 15, 'Searching international coverage...', {
      icon: 'SEARCH'
    });
    const perspectives = await searchPerspectives(articleData, config);
    
    // 3. Extract Content
    logger.logUserProgress('extraction', 35, 'Extracting article content...');
    const extractedArticles = await extractArticles(perspectives);
    
    // 4. Select Best Articles
    const selectedArticles = selectArticles(extractedArticles, config);
    
    // 5. ROTEAMENTO DE MODELO
    let analysisResult;
    
    if (config.analysis.modelProvider === 'gemini-2.5-pro') {
      // ===== GEMINI 2.5 PRO PIPELINE =====
      logger.logUserProgress('analysis', 50, 'Analyzing with Gemini 2.5 Pro...', {
        icon: 'AI'
      });
      
      const apiKey = await APIKeyManager.load();
      const proAPI = new Gemini25ProAPI(apiKey, config.analysis.gemini25Pro);
      
      // SEM tradução/compression - Pro processa diretamente
      analysisResult = await proAPI.compareArticlesProgressive(
        selectedArticles,
        async (stageResult) => {
          // Callback de progresso por stage
          chrome.tabs.sendMessage(tabId, {
            type: 'ANALYSIS_STAGE_COMPLETE',
            payload: stageResult
          });
        }
      );
      
    } else {
      // ===== GEMINI NANO PIPELINE (EXISTENTE) =====
      logger.logUserProgress('translation', 50, 'Translating articles...');
      // ... pipeline existente com tradução e compression ...
      
      analysisResult = await compareArticlesProgressive(
        compressedArticles,
        stageCallback
      );
    }
    
    // 6. Enviar resultados
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_ANALYSIS',
      payload: analysisResult
    });
    
  } catch (error) {
    logger.system.error('Analysis failed', { error });
    chrome.tabs.sendMessage(tabId, {
      type: 'ANALYSIS_FAILED',
      error: error.message
    });
  } finally {
    logger.endRequest(requestId);
    logger.clearRequest();
  }
}
5. UI do Popup (popup.html + popup.js)
5.1. HTML atualizado (popup.html)
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="ui/design-system.css">
  <link rel="stylesheet" href="popup.css">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body>
  <div class="popup-container">
    <!-- Model Selector -->
    <div class="model-selector">
      <label class="section-label">AI Model</label>
      <div class="model-options">
        <button id="selectNano" class="model-option" data-model="gemini-nano">
          <span class="material-icons">memory</span>
          <div class="model-info">
            <span class="model-name">Gemini Nano</span>
            <span class="model-desc">Chrome built-in, free</span>
          </div>
          <span class="check-icon material-icons">check_circle</span>
        </button>
        
        <button id="selectPro" class="model-option" data-model="gemini-2.5-pro">
          <span class="material-icons">cloud</span>
          <div class="model-info">
            <span class="model-name">Gemini 2.5 Pro</span>
            <span class="model-desc">API key required</span>
          </div>
          <span class="check-icon material-icons">check_circle</span>
        </button>
      </div>
    </div>

    <!-- Gemini Nano Status -->
    <div id="nanoStatus" class="model-status hidden">
      <div class="status-header">
        <span class="material-icons status-icon">memory</span>
        <span class="status-title">Gemini Nano</span>
        <span id="nanoStatusBadge" class="status-badge"></span>
      </div>
      
      <p id="nanoStatusMessage" class="status-message"></p>
      
      <!-- Download Button -->
      <button id="downloadNano" class="btn-primary hidden">
        <span class="material-icons">download</span>
        Download Model
      </button>
      
      <!-- Download Progress -->
      <div id="downloadProgress" class="progress-container hidden">
        <div class="progress-bar">
          <div id="progressFill" class="progress-fill"></div>
        </div>
        <span id="progressText" class="progress-text">0%</span>
      </div>
    </div>

    <!-- Gemini 2.5 Pro Status -->
    <div id="proStatus" class="model-status hidden">
      <div class="status-header">
        <span class="material-icons status-icon">cloud</span>
        <span class="status-title">Gemini 2.5 Pro</span>
        <span id="proStatusBadge" class="status-badge"></span>
      </div>
      
      <p id="proStatusMessage" class="status-message"></p>
      
      <!-- API Key Input -->
      <div id="apiKeySection" class="api-key-section">
        <label for="apiKeyInput">API Key</label>
        <div class="input-group">
          <input 
            type="password" 
            id="apiKeyInput" 
            placeholder="AIza..." 
            autocomplete="off"
          >
          <button id="toggleApiKey" class="btn-icon">
            <span class="material-icons">visibility</span>
          </button>
        </div>
        
        <div class="api-key-actions">
          <button id="saveApiKey" class="btn-primary">
            <span class="material-icons">save</span>
            Save Key
          </button>
          <a 
            href="https://aistudio.google.com/apikey" 
            target="_blank" 
            class="btn-link"
          >
            Get API Key
            <span class="material-icons">open_in_new</span>
          </a>
        </div>
        
        <!-- Validation Status -->
        <div id="validationStatus" class="validation-status hidden">
          <span class="material-icons"></span>
          <span class="validation-text"></span>
        </div>
      </div>
      
      <!-- Current Key Display -->
      <div id="currentKeyDisplay" class="current-key-display hidden">
        <div class="key-display">
          <span class="material-icons">vpn_key</span>
          <span id="maskedKey" class="masked-key"></span>
          <button id="removeApiKey" class="btn-icon btn-danger">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Link -->
    <div class="footer">
      <button id="openSettings" class="btn-text">
        <span class="material-icons">settings</span>
        Advanced Settings
      </button>
    </div>
  </div>

  <script type="module" src="popup.js"></script>
</body>
</html>
5.2. JavaScript do Popup (popup.js)
import { APIKeyManager } from './config/apiKeyManager.js';
import { ConfigManager } from './config/configManager.js';

class PopupManager {
  constructor() {
    this.selectedModel = 'gemini-nano';
    this.init();
  }

  async init() {
    // Carregar modelo selecionado
    const config = await ConfigManager.load();
    this.selectedModel = config.analysis.modelProvider;
    
    // Setup listeners
    this.setupModelSelector();
    this.setupApiKeyHandlers();
    this.setupNanoHandlers();
    
    // Atualizar UI
    await this.updateUI();
    
    // Auto-refresh a cada 30s
    setInterval(() => this.updateUI(), 30000);
  }

  setupModelSelector() {
    const nanoBtn = document.getElementById('selectNano');
    const proBtn = document.getElementById('selectPro');
    
    nanoBtn.addEventListener('click', () => this.switchModel('gemini-nano'));
    proBtn.addEventListener('click', () => this.switchModel('gemini-2.5-pro'));
  }

  async switchModel(model) {
    this.selectedModel = model;
    
    // Salvar no config
    await ConfigManager.set('analysis.modelProvider', model);
    
    // Atualizar UI
    await this.updateUI();
    
    // Feedback visual
    this.showToast(`Switched to ${model === 'gemini-nano' ? 'Gemini Nano' : 'Gemini 2.5 Pro'}`);
  }

  async updateUI() {
    // Atualizar botões de seleção
    document.querySelectorAll('.model-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.model === this.selectedModel);
    });
    
    // Mostrar status relevante
    document.getElementById('nanoStatus').classList.toggle('hidden', this.selectedModel !== 'gemini-nano');
    document.getElementById('proStatus').classList.toggle('hidden', this.selectedModel !== 'gemini-2.5-pro');
    
    // Atualizar status do modelo atual
    if (this.selectedModel === 'gemini-nano') {
      await this.updateNanoStatus();
    } else {
      await this.updateProStatus();
    }
  }

  async updateNanoStatus() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    const badge = document.getElementById('nanoStatusBadge');
    const message = document.getElementById('nanoStatusMessage');
    const downloadBtn = document.getElementById('downloadNano');
    
    switch (response.status) {
      case 'ready':
        badge.textContent = 'Ready';
        badge.className = 'status-badge success';
        message.textContent = 'Model is ready for analysis';
        downloadBtn.classList.add('hidden');
        break;
        
      case 'download':
        badge.textContent = 'Download Required';
        badge.className = 'status-badge warning';
        message.textContent = 'Download Gemini Nano to start analyzing';
        downloadBtn.classList.remove('hidden');
        break;
        
      case 'downloading':
        badge.textContent = 'Downloading...';
        badge.className = 'status-badge info';
        message.textContent = `Downloading model... ${response.progress}%`;
        downloadBtn.classList.add('hidden');
        this.updateDownloadProgress(response.progress);
        break;
        
      default:
        badge.textContent = 'Unavailable';
        badge.className = 'status-badge error';
        message.textContent = 'Gemini Nano not available in this Chrome version';
        downloadBtn.classList.add('hidden');
    }
  }

  async updateProStatus() {
    const apiKey = await APIKeyManager.load();
    
    const badge = document.getElementById('proStatusBadge');
    const message = document.getElementById('proStatusMessage');
    const apiKeySection = document.getElementById('apiKeySection');
    const currentKeyDisplay = document.getElementById('currentKeyDisplay');
    
    if (!apiKey) {
      // Sem API key
      badge.textContent = 'Not Configured';
      badge.className = 'status-badge warning';
      message.textContent = 'Enter your Google AI Studio API key to use Gemini 2.5 Pro';
      apiKeySection.classList.remove('hidden');
      currentKeyDisplay.classList.add('hidden');
    } else {
      // Validar API key
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      if (response.status === 'ready') {
        badge.textContent = 'Connected';
        badge.className = 'status-badge success';
        message.textContent = 'API key validated successfully';
        apiKeySection.classList.add('hidden');
        currentKeyDisplay.classList.remove('hidden');
        document.getElementById('maskedKey').textContent = response.apiKeyMasked;
      } else {
        badge.textContent = 'Invalid Key';
        badge.className = 'status-badge error';
        message.textContent = 'API key is invalid or expired';
        apiKeySection.classList.remove('hidden');
        currentKeyDisplay.classList.add('hidden');
      }
    }
  }

  setupApiKeyHandlers() {
    const input = document.getElementById('apiKeyInput');
    const toggleBtn = document.getElementById('toggleApiKey');
    const saveBtn = document.getElementById('saveApiKey');
    const removeBtn = document.getElementById('removeApiKey');
    
    // Toggle visibility
    toggleBtn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.querySelector('.material-icons').textContent = isPassword ? 'visibility_off' : 'visibility';
    });
    
    // Save key
    saveBtn.addEventListener('click', async () => {
      const apiKey = input.value.trim();
      
      if (!apiKey) {
        this.showValidation('error', 'Please enter an API key');
        return;
      }
      
      this.showValidation('validating', 'Validating API key...');
      
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'VALIDATE_API_KEY',
          apiKey
        });
        
        if (response.isValid) {
          await APIKeyManager.save(apiKey);
          this.showValidation('success', 'API key saved successfully!');
          input.value = '';
          setTimeout(() => this.updateUI(), 1500);
        } else {
          this.showValidation('error', 'Invalid API key');
        }
      } catch (error) {
        this.showValidation('error', 'Validation failed: ' + error.message);
      }
    });
    
    // Remove key
    removeBtn.addEventListener('click', async () => {
      if (confirm('Remove API key? You will need to enter it again to use Gemini 2.5 Pro.')) {
        await APIKeyManager.remove();
        await this.updateUI();
        this.showToast('API key removed');
      }
    });
  }

  showValidation(type, message) {
    const status = document.getElementById('validationStatus');
    const icon = status.querySelector('.material-icons');
    const text = status.querySelector('.validation-text');
    
    status.classList.remove('hidden', 'success', 'error', 'validating');
    status.classList.add(type);
    
    const icons = {
      success: 'check_circle',
      error: 'error',
      validating: 'hourglass_empty'
    };
    
    icon.textContent = icons[type];
    text.textContent = message;
  }

  setupNanoHandlers() {
    const downloadBtn = document.getElementById('downloadNano');
    downloadBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'START_MODEL_DOWNLOAD' });
      await this.updateUI();
    });
  }

  updateDownloadProgress(percent) {
    const progressContainer = document.getElementById('downloadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressContainer.classList.remove('hidden');
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
  }

  showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// Initialize
new PopupManager();
6. Options Page (ui/pages/options/options.html + options.js)
Adicionar seção na página de opções:
<!-- Nova seção: AI Model Configuration -->
<section class="settings-section" id="modelSettings">
  <h2>
    <span class="material-icons">smart_toy</span>
    AI Model Configuration
  </h2>
  
  <div class="setting-group">
    <label class="setting-label">Model Provider</label>
    <div class="model-selector-options">
      <label class="radio-option">
        <input type="radio" name="modelProvider" value="gemini-nano">
        <div class="radio-content">
          <span class="radio-title">Gemini Nano</span>
          <span class="radio-desc">Free, built into Chrome. Requires model download.</span>
        </div>
      </label>
      
      <label class="radio-option">
        <input type="radio" name="modelProvider" value="gemini-2.5-pro">
        <div class="radio-content">
          <span class="radio-title">Gemini 2.5 Pro</span>
          <span class="radio-desc">More powerful, requires Google AI Studio API key.</span>
        </div>
      </label>
    </div>
  </div>
  
  <!-- Gemini 2.5 Pro Settings (mostrado apenas se Pro selecionado) -->
  <div id="proSettings" class="subsection hidden">
    <div class="setting-group">
      <label for="proModel">Model Version</label>
      <select id="proModel">
        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best quality)</option>
        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Faster)</option>
      </select>
    </div>
    
    <div class="setting-group">
      <label for="thinkingBudget">Thinking Budget</label>
      <select id="thinkingBudget">
        <option value="-1">Dynamic (Recommended)</option>
        <option value="0">Disabled (Fastest)</option>
        <option value="1024">Low (1K tokens)</option>
        <option value="8192">Medium (8K tokens)</option>
        <option value="16384">High (16K tokens)</option>
      </select>
      <span class="setting-desc">Higher budgets enable deeper reasoning but take longer</span>
    </div>
    
    <div class="setting-group">
      <label>
        <input type="checkbox" id="skipTranslation">
        Skip Translation
      </label>
      <span class="setting-desc">Process articles in original languages (Pro can handle multi-lingual content)</span>
    </div>
    
    <div class="setting-group">
      <label>
        <input type="checkbox" id="skipCompression">
        Use Full Article Content
      </label>
      <span class="setting-desc">Send complete articles without summarization (Pro has larger context window)</span>
    </div>
  </div>
</section>
🎨 Design System (popup.css additions)
/* Model Selector */
.model-selector {
  margin-bottom: var(--spacing-6);
}

.model-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.model-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border: 2px solid var(--md-sys-color-outline);
  border-radius: var(--shape-corner-medium);
  background: var(--md-sys-color-surface-container);
  cursor: pointer;
  transition: all 0.2s ease;
}

.model-option:hover {
  background: var(--md-sys-color-surface-container-high);
  border-color: var(--md-sys-color-primary);
}

.model-option.selected {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
}

.model-option .material-icons {
  font-size: 32px;
  color: var(--md-sys-color-on-surface);
}

.model-option.selected .material-icons {
  color: var(--md-sys-color-primary);
}

.model-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.model-name {
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.model-desc {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.check-icon {
  color: var(--md-sys-color-primary);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.model-option.selected .check-icon {
  opacity: 1;
}

/* API Key Section */
.api-key-section {
  margin-top: var(--spacing-4);
  padding: var(--spacing-4);
  background: var(--md-sys-color-surface-container-low);
  border-radius: var(--shape-corner-medium);
}

.input-group {
  display: flex;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
}

.input-group input {
  flex: 1;
  padding: var(--spacing-3);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--shape-corner-small);
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font-family: 'Roboto Mono', monospace;
}

.api-key-actions {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
}

.validation-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border-radius: var(--shape-corner-small);
  margin-top: var(--spacing-3);
}

.validation-status.success {
  background: var(--md-sys-color-success-container);
  color: var(--md-sys-color-on-success-container);
}

.validation-status.error {
  background: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
}

.validation-status.validating {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

/* Current Key Display */
.current-key-display {
  margin-top: var(--spacing-4);
  padding: var(--spacing-3);
  background: var(--md-sys-color-surface-container-low);
  border-radius: var(--shape-corner-medium);
}

.key-display {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.masked-key {
  flex: 1;
  font-family: 'Roboto Mono', monospace;
  color: var(--md-sys-color-on-surface-variant);
}

/* Toast Notification */
.toast {
  position: fixed;
  bottom: var(--spacing-4);
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  padding: var(--spacing-3) var(--spacing-5);
  background: var(--md-sys-color-inverse-surface);
  color: var(--md-sys-color-inverse-on-surface);
  border-radius: var(--shape-corner-small);
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 1000;
}

.toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
📱 Onboarding Experience
First-Time User Flow
Cenário 1: Primeiro uso com Nano
Usuário instala extensão
Abre popup → vê Gemini Nano selecionado por padrão
Status mostra "Download Required" com botão destacado
Clica "Download Model" → progresso em tempo real
Download completo → "Ready to analyze!"
Cenário 2: Primeiro uso com Pro
Usuário instala extensão
Abre popup → vê as duas opções
Clica em "Gemini 2.5 Pro"
Vê campo de API key com link "Get API Key"
Clica no link → abre AI Studio (nova aba)
Copia API key → cola no campo
Clica "Save Key" → validação em tempo real
Sucesso → "Connected! Ready to analyze"
Indicadores Visuais
[Gemini Nano]       [✓ Ready]
[Gemini 2.5 Pro]    [⚠ Not Configured]

↓ Usuário seleciona Pro

[Gemini Nano]       
[Gemini 2.5 Pro]    [✓ Connected]  ← Status muda após configurar
🔄 Migration Strategy
Para Usuários Existentes
Quando usuário atualiza a extensão:
// Em background.js - onInstalled event
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const config = await ConfigManager.load();
    
    // Se não tem modelProvider definido, setar Nano como padrão
    if (!config.analysis.modelProvider) {
      await ConfigManager.set('analysis.modelProvider', 'gemini-nano');
      
      // Mostrar notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'PerspectiveLens Updated!',
        message: 'New feature: Choose between Gemini Nano and Gemini 2.5 Pro. Check the popup to learn more!'
      });
    }
  }
});
✅ Checklist de Implementação

### BACKEND (Completo ✅)
- [x] API Key Manager (`config/apiKeyManager.js`)
- [x] Gemini 2.5 Pro API Wrapper (`api/gemini-2-5-pro.js`)
- [x] Pipeline Configuration (`config/pipeline.js`)
- [x] Background Service routing (`scripts/background.js`)

### FRONTEND (Pendente 🚧)
- [ ] Popup HTML (`popup.html`)
- [ ] Popup JavaScript (`ui/pages/popup/popup.js`)
- [ ] Popup CSS (`ui/pages/popup/popup.css`)
- [ ] Options Page HTML (`ui/pages/options/options.html`)
- [ ] Options Page JavaScript (`ui/pages/options/options.js`)
- [ ] Manifest.json updates (`manifest.json`)

### TESTING (Pendente ⏳)
- [ ] API key validation flow
- [ ] Model switching functionality
- [ ] Analysis with Gemini Nano
- [ ] Analysis with Gemini 2.5 Pro
- [ ] Progressive stage updates
📊 Resumo do Plano
Arquivos Novos (6 arquivos)
✅ api/gemini-2-5-pro.js - API wrapper para Gemini 2.5 Pro
✅ config/apiKeyManager.js - Gerenciamento seguro de API keys
✅ prompts/gemini-pro/ - Prompts otimizados para Pro (sem compression)
Arquivos Modificados (7 arquivos)
✅ config/pipeline.js - Adicionar configurações Pro
✅ scripts/background.js - Roteamento de modelos + handlers de validação
✅ popup.html - UI de seleção de modelo + API key
✅ popup.js - Lógica de switching + validação
✅ popup.css - Estilos Material Design 3
✅ ui/pages/options/options.html - Seção de configuração avançada
✅ ui/pages/options/options.js - Handlers de Pro settings
Benefícios da Implementação
UX/UI:
✅ Onboarding intuitivo com 2 cliques
✅ Validação em tempo real de API key
✅ Feedback visual claro de status
✅ Material Design 3 consistente
✅ Toggle simples entre modelos
Performance:
✅ Pro não precisa tradução (processa multi-língua)
✅ Pro não precisa compression (contexto gigante)
✅ Pipeline mais rápido com menos etapas
✅ Thinking capabilities para análise mais profunda
Flexibilidade:
✅ Usuários podem escolher baseado em necessidades
✅ Nano: Grátis, offline, privado
✅ Pro: Poderoso, confiável, atualizado