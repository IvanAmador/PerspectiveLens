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
    logger.debug(`Using cached prompt: ${name}`);
    return promptCache.get(name);
  }

  try {
    const url = chrome.runtime.getURL(`prompts/${name}.txt`);
    logger.debug(`Loading prompt from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load prompt: ${name} (${response.status})`);
    }

    const content = await response.text();

    // Cache for future use
    promptCache.set(name, content);

    logger.info(`Loaded prompt: ${name}`);
    return content;

  } catch (error) {
    logger.error(`Failed to load prompt ${name}:`, error);
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

  // Replace all {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(pattern, String(value));
  }

  // Check for unprocessed variables (debugging)
  const unprocessed = processed.match(/\{\{[^}]+\}\}/g);
  if (unprocessed) {
    logger.warn('Unprocessed variables in prompt:', unprocessed);
  }

  return processed;
}

/**
 * Load and process a prompt in one step
 * @param {string} name - Prompt filename (without .txt)
 * @param {Object} variables - Variables for substitution
 * @returns {Promise<string>} - Processed prompt ready to use
 */
export async function getPrompt(name, variables = {}) {
  const template = await loadPrompt(name);
  return processPrompt(template, variables);
}

/**
 * Clear prompt cache (useful for development/testing)
 */
export function clearPromptCache() {
  const size = promptCache.size;
  promptCache.clear();
  logger.info(`Cleared ${size} cached prompts`);
}

/**
 * Preload commonly used prompts for performance
 */
export async function preloadPrompts() {
  const commonPrompts = [
    'keyword-extraction',
    'comparative-analysis'
  ];

  logger.info('Preloading common prompts...');

  await Promise.all(
    commonPrompts.map(name => loadPrompt(name).catch(err => {
      logger.warn(`Failed to preload ${name}:`, err);
    }))
  );

  logger.info(`Preloaded ${promptCache.size} prompts`);
}
