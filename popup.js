/**
 * PerspectiveLens Popup Script
 * Handles UI interactions and AI model status
 */

// ===== DOM Elements =====
const modelsStatus = document.getElementById('models-status');
const aiStatusCard = document.getElementById('ai-status-card');
const downloadProgress = document.getElementById('download-progress');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const progressSize = document.getElementById('progress-size');
const downloadModelBtn = document.getElementById('download-model');
const refreshStatusBtn = document.getElementById('refresh-status');
const settingsBtn = document.getElementById('settings-btn');

// ===== AI Model Status Check =====
async function checkAIStatus() {
  try {
    // Show loading state
    modelsStatus.innerHTML = `
      <span class="spinner"></span>
      <span>Checking...</span>
    `;
    aiStatusCard.className = 'status-card';

    // Request status from background script
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    if (!response.success) {
      console.error('[PerspectiveLens] Failed to get status:', response.error);
      updateStatus('error', 'Error checking status');
      return;
    }

    const { aiStatus } = response.status;
    console.log('[PerspectiveLens] AI Status:', aiStatus);
    
    // Update UI based on availability
    if (aiStatus.availability === 'available') {
      updateStatus('ready', 'Ready');
    } else if (aiStatus.availability === 'downloadable') {
      updateStatus('download', 'Download Required');
      showDownloadButton();
    } else if (aiStatus.availability === 'downloading') {
      updateStatus('downloading', 'Downloading...');
      if (aiStatus.downloadProgress > 0) {
        showDownloadProgress(aiStatus.downloadProgress);
      }
    } else {
      updateStatus('unavailable', 'Not Available');
    }
  } catch (error) {
    console.error('[PerspectiveLens] Error checking AI status:', error);
    updateStatus('error', 'Error checking status');
  }
}

// ===== Update Status Display =====
function updateStatus(state, message) {
  const icons = {
    ready: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 10L12 15M12 15L17 10M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    downloading: '<span class="spinner"></span>',
    unavailable: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  modelsStatus.innerHTML = `
    ${icons[state] || ''}
    <span>${message}</span>
  `;

  // Update card state
  aiStatusCard.className = 'status-card';
  if (state === 'ready') {
    aiStatusCard.classList.add('success');
  } else if (state === 'error' || state === 'unavailable') {
    aiStatusCard.classList.add('error');
  } else if (state === 'downloading' || state === 'download') {
    aiStatusCard.classList.add('downloading');
  }
}

// ===== Show Download Button =====
function showDownloadButton() {
  downloadModelBtn.style.display = 'inline-flex';
  downloadProgress.style.display = 'none';
}

// ===== Show Download Progress =====
function showDownloadProgress(percent) {
  downloadModelBtn.style.display = 'none';
  downloadProgress.style.display = 'flex';
  
  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  
  // Estimate size (Gemini Nano is ~1.7GB)
  const totalMB = 1700;
  const loadedMB = Math.round((percent / 100) * totalMB);
  progressSize.textContent = `${loadedMB} MB / ${(totalMB / 1024).toFixed(1)} GB`;
}

// ===== Handle Model Download =====
async function downloadModel() {
  try {
    console.log('[PerspectiveLens] Starting model download via background...');
    
    downloadModelBtn.style.display = 'none';
    downloadProgress.style.display = 'flex';
    aiStatusCard.classList.add('downloading');
    updateStatus('downloading', 'Starting download...');

    // Request download from background script
    const response = await chrome.runtime.sendMessage({ type: 'START_MODEL_DOWNLOAD' });
    
    if (!response.success) {
      console.error('[PerspectiveLens] Download failed:', response.error);
      updateStatus('error', 'Download failed');
      downloadProgress.style.display = 'none';
      downloadModelBtn.style.display = 'inline-flex';
      aiStatusCard.classList.remove('downloading');
      return;
    }

    // Start polling for progress
    const progressInterval = setInterval(async () => {
      try {
        const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        
        if (statusResponse.success) {
          const { aiStatus } = statusResponse.status;
          
          if (aiStatus.availability === 'downloading' && aiStatus.downloadProgress > 0) {
            showDownloadProgress(aiStatus.downloadProgress);
          } else if (aiStatus.availability === 'available') {
            // Download complete
            clearInterval(progressInterval);
            downloadProgress.style.display = 'none';
            updateStatus('ready', 'Ready');
            console.log('[PerspectiveLens] Model downloaded successfully');
          }
        }
      } catch (error) {
        console.error('[PerspectiveLens] Error polling status:', error);
      }
    }, 1000); // Poll every second

    // Timeout after 30 minutes
    setTimeout(() => {
      clearInterval(progressInterval);
    }, 30 * 60 * 1000);
    
  } catch (error) {
    console.error('[PerspectiveLens] Error downloading model:', error);
    downloadProgress.style.display = 'none';
    downloadModelBtn.style.display = 'inline-flex';
    updateStatus('error', 'Download failed');
    aiStatusCard.classList.remove('downloading');
  }
}

// ===== Open Settings =====
function openSettings() {
  // Open options page in new tab
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
}

// ===== Event Listeners =====
refreshStatusBtn?.addEventListener('click', () => {
  console.log('[PerspectiveLens] Refresh status clicked');
  checkAIStatus();
});

downloadModelBtn?.addEventListener('click', () => {
  console.log('[PerspectiveLens] Download model clicked');
  downloadModel();
});

settingsBtn?.addEventListener('click', () => {
  console.log('[PerspectiveLens] Settings clicked');
  openSettings();
});

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('[PerspectiveLens] Popup loaded, checking AI status...');
  checkAIStatus();
  
  // Refresh status every 30 seconds while popup is open
  setInterval(checkAIStatus, 30000);
});
