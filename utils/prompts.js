/**
 * Prompt management utility for PerspectiveLens
 * Handles loading and processing prompt templates
 */

import { logger } from './logger.js';

// Cache for loaded prompts to avoid repeated file reads
const promptCache = new Map();

/**
 * Load a prompt template from file
 * @param {string} name - Prompt filename (without .txt extension)
 * @returns {Promise<string>} - Prompt template content
 */
export async function loadPrompt(name) {
  // Check cache first
  if (promptCache.has(name)) {
    logger.system.debug('Using cached prompt', {
      category: logger.CATEGORIES.GENERAL,
      data: { name }
    });
    return promptCache.get(name);
  }

  try {
    const url = chrome.runtime.getURL(`prompts/${name}.txt`);
    logger.system.debug('Loading prompt from file', {
      category: logger.CATEGORIES.GENERAL,
      data: { name, url }
    });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load prompt: ${name} (${response.status})`);
    }

    const content = await response.text();

    // Cache for future use
    promptCache.set(name, content);

    logger.system.info('Loaded prompt successfully', {
      category: logger.CATEGORIES.GENERAL,
      data: { 
        name,
        contentLength: content.length,
        cached: true
      }
    });
    
    return content;

  } catch (error) {
    logger.system.error('Failed to load prompt', {
      category: logger.CATEGORIES.ERROR,
      error,
      data: { name }
    });
    throw new Error(`Prompt loading failed: ${name}`);
  }
}

/**
 * Process a prompt template with variables
 * @param {string} template - Prompt template with {{variables}}
 * @param {Object} variables - Key-value pairs for substitution
 * @returns {string} - Processed prompt
 */
export function processPrompt(template, variables = {}) {
  let processed = template;

  logger.system.trace('Processing prompt template', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      templateLength: template.length,
      variablesCount: Object.keys(variables).length,
      variableNames: Object.keys(variables)
    }
  });

  // Replace all {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(pattern, String(value));
  }

  // Check for TRULY unprocessed variables (missing from provided variables)
  const allVariablesInTemplate = (template.match(/\{\{([^}]+)\}\}/g) || []).map(v => v.slice(2, -2));
  const providedKeys = Object.keys(variables);
  const missingVariables = allVariablesInTemplate.filter(v => !providedKeys.includes(v));

  if (missingVariables.length > 0) {
    logger.system.warn('Missing variables in prompt - some placeholders were not replaced', {
      category: logger.CATEGORIES.GENERAL,
      data: { 
        missingVariables,
        providedVariables: providedKeys,
        templateSnippet: template.substring(0, 200)
      }
    });
  } else if (Object.keys(variables).length > 0) {
    logger.system.debug('All variables successfully replaced', {
      category: logger.CATEGORIES.GENERAL,
      data: {
        replacedCount: providedKeys.length,
        variableNames: providedKeys
      }
    });
  }

  logger.system.trace('Prompt template processed', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      originalLength: template.length,
      processedLength: processed.length,
      hadMissing: missingVariables.length > 0
    }
  });

  return processed;
}

/**
 * Load and process a prompt in one step
 * @param {string} name - Prompt filename (without .txt)
 * @param {Object} variables - Variables for substitution
 * @returns {Promise<string>} - Processed prompt ready to use
 */
export async function getPrompt(name, variables = {}) {
  logger.system.debug('Getting prompt', {
    category: logger.CATEGORIES.GENERAL,
    data: { 
      name,
      hasVariables: Object.keys(variables).length > 0,
      variableCount: Object.keys(variables).length
    }
  });

  const template = await loadPrompt(name);
  const processed = processPrompt(template, variables);

  logger.system.info('Prompt ready for use', {
    category: logger.CATEGORIES.GENERAL,
    data: {
      name,
      originalLength: template.length,
      finalLength: processed.length,
      variablesApplied: Object.keys(variables).length
    }
  });

  return processed;
}

/**
 * Clear prompt cache (useful for development/testing)
 */
export function clearPromptCache() {
  const size = promptCache.size;
  const cachedPrompts = Array.from(promptCache.keys());
  
  promptCache.clear();
  
  logger.system.info('Cleared prompt cache', {
    category: logger.CATEGORIES.GENERAL,
    data: { 
      clearedCount: size,
      promptNames: cachedPrompts
    }
  });
}

/**
 * Preload commonly used prompts for performance
 */
export async function preloadPrompts() {
  const commonPrompts = [
    'comparative-analysis',
    'comparative-analysis-v2'
  ];

  logger.system.info('Preloading common prompts', {
    category: logger.CATEGORIES.GENERAL,
    data: { prompts: commonPrompts }
  });

  const startTime = Date.now();
  const results = await Promise.allSettled(
    commonPrompts.map(name => loadPrompt(name))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const duration = Date.now() - startTime;

  if (failed > 0) {
    const failedPrompts = results
      .map((r, i) => r.status === 'rejected' ? commonPrompts[i] : null)
      .filter(Boolean);
    
    logger.system.warn('Some prompts failed to preload', {
      category: logger.CATEGORIES.GENERAL,
      data: { 
        succeeded,
        failed,
        total: commonPrompts.length,
        failedPrompts,
        duration
      }
    });
  } else {
    logger.system.info('All prompts preloaded successfully', {
      category: logger.CATEGORIES.GENERAL,
      data: { 
        cacheSize: promptCache.size,
        succeeded,
        duration
      }
    });
  }
}

/**
 * Get information about cached prompts
 * @returns {Object} Cache statistics
 */
export function getCacheInfo() {
  const prompts = Array.from(promptCache.entries()).map(([name, content]) => ({
    name,
    size: content.length
  }));

  return {
    count: promptCache.size,
    prompts,
    totalSize: prompts.reduce((sum, p) => sum + p.size, 0)
  };
}
