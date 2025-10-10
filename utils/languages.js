/**
 * Language normalization and validation utilities
 * Handles ISO 639-1 (2-letter) and ISO 639-3 (3-letter) codes
 * Ensures compatibility between Language Detector, Translator, and Prompt APIs
 *
 * Reference:
 * - ISO 639-1: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 * - Chrome APIs: https://developer.chrome.com/docs/ai/
 */

import { logger } from './logger.js';

/**
 * Comprehensive language code mappings
 * Maps all variants to normalized ISO 639-1 codes
 */
const LANGUAGE_CODE_MAPPINGS = {
  // Portuguese variants
  'pt': 'pt',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'por': 'pt',

  // English variants
  'en': 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',
  'eng': 'en',

  // Spanish variants
  'es': 'es',
  'es-es': 'es',
  'es-mx': 'es',
  'es-ar': 'es',
  'spa': 'es',

  // French variants
  'fr': 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  'fra': 'fr',
  'fre': 'fr',

  // German variants
  'de': 'de',
  'de-de': 'de',
  'de-at': 'de',
  'de-ch': 'de',
  'deu': 'de',
  'ger': 'de',

  // Chinese variants
  'zh': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zho': 'zh',
  'chi': 'zh',

  // Japanese variants
  'ja': 'ja',
  'ja-jp': 'ja',
  'jpn': 'ja',

  // Arabic variants
  'ar': 'ar',
  'ar-sa': 'ar',
  'ar-ae': 'ar',
  'ara': 'ar',

  // Korean variants
  'ko': 'ko',
  'ko-kr': 'ko',
  'kor': 'ko',

  // Russian variants
  'ru': 'ru',
  'ru-ru': 'ru',
  'rus': 'ru',

  // Italian variants
  'it': 'it',
  'it-it': 'it',
  'ita': 'it',

  // Dutch variants
  'nl': 'nl',
  'nl-nl': 'nl',
  'nld': 'nl',
  'dut': 'nl',

  // Polish variants
  'pl': 'pl',
  'pl-pl': 'pl',
  'pol': 'pl',

  // Turkish variants
  'tr': 'tr',
  'tr-tr': 'tr',
  'tur': 'tr',

  // Swedish variants
  'sv': 'sv',
  'sv-se': 'sv',
  'swe': 'sv',

  // Danish variants
  'da': 'da',
  'da-dk': 'da',
  'dan': 'da',

  // Norwegian variants
  'no': 'no',
  'nb': 'no',
  'nn': 'no',
  'nor': 'no',

  // Finnish variants
  'fi': 'fi',
  'fi-fi': 'fi',
  'fin': 'fi',

  // Czech variants
  'cs': 'cs',
  'cs-cz': 'cs',
  'ces': 'cs',
  'cze': 'cs',

  // Hebrew variants
  'he': 'he',
  'he-il': 'he',
  'heb': 'he',

  // Hindi variants
  'hi': 'hi',
  'hi-in': 'hi',
  'hin': 'hi',

  // Thai variants
  'th': 'th',
  'th-th': 'th',
  'tha': 'th',

  // Vietnamese variants
  'vi': 'vi',
  'vi-vn': 'vi',
  'vie': 'vi'
};

/**
 * Languages supported by Chrome Language Detector API
 * Based on Chrome 138+ capabilities
 */
const DETECTOR_SUPPORTED_LANGUAGES = [
  'en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'ru',
  'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'sv', 'da', 'no',
  'fi', 'cs', 'he', 'th', 'vi'
];

/**
 * Languages supported by Chrome Translator API
 * For translation to/from English
 */
const TRANSLATOR_SUPPORTED_LANGUAGES = [
  'en', 'es', 'pt', 'fr', 'de', 'ar', 'zh', 'ja'
];

/**
 * Languages supported by Chrome Prompt API (Gemini Nano)
 * IMPORTANT: Only en, es, ja are supported for OUTPUT
 */
const PROMPT_API_OUTPUT_LANGUAGES = ['en', 'es', 'ja'];

/**
 * Preferred language for Prompt API processing
 * English provides best results across all models
 */
const PROMPT_API_PREFERRED_LANGUAGE = 'en';

/**
 * Normalize language code to ISO 639-1 (2-letter code)
 * Handles all common variants and regional codes
 *
 * @param {string} langCode - Language code (any format)
 * @returns {string} Normalized ISO 639-1 code
 */
export function normalizeLanguageCode(langCode) {
  if (!langCode || typeof langCode !== 'string') {
    return 'en';
  }

  // Convert to lowercase and trim
  const cleaned = langCode.toLowerCase().trim();

  // Direct lookup in mappings
  if (LANGUAGE_CODE_MAPPINGS[cleaned]) {
    return LANGUAGE_CODE_MAPPINGS[cleaned];
  }

  // Extract base code (before hyphen or underscore)
  const baseCode = cleaned.split(/[-_]/)[0];
  if (LANGUAGE_CODE_MAPPINGS[baseCode]) {
    return LANGUAGE_CODE_MAPPINGS[baseCode];
  }

  // If 2-letter code not in mappings, assume it's valid ISO 639-1
  if (baseCode.length === 2) {
    return baseCode;
  }

  // Default to English
  return 'en';
}

/**
 * Check if language is supported by Language Detector API
 * @param {string} langCode - Language code (will be normalized)
 * @returns {boolean}
 */
export function isDetectorSupported(langCode) {
  const normalized = normalizeLanguageCode(langCode);
  return DETECTOR_SUPPORTED_LANGUAGES.includes(normalized);
}

/**
 * Check if language is supported by Translator API
 * @param {string} langCode - Language code (will be normalized)
 * @returns {boolean}
 */
export function isTranslatorSupported(langCode) {
  const normalized = normalizeLanguageCode(langCode);
  return TRANSLATOR_SUPPORTED_LANGUAGES.includes(normalized);
}

/**
 * Check if language is supported by Prompt API for output
 * @param {string} langCode - Language code (will be normalized)
 * @returns {boolean}
 */
export function isPromptAPIOutputSupported(langCode) {
  const normalized = normalizeLanguageCode(langCode);
  return PROMPT_API_OUTPUT_LANGUAGES.includes(normalized);
}

/**
 * Get the preferred language for Prompt API processing
 * @returns {string} 'en'
 */
export function getPromptAPIPreferredLanguage() {
  return PROMPT_API_PREFERRED_LANGUAGE;
}

/**
 * Determine if translation is needed from source to target language
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {boolean}
 */
export function needsTranslation(sourceLang, targetLang) {
  const normalizedSource = normalizeLanguageCode(sourceLang);
  const normalizedTarget = normalizeLanguageCode(targetLang);

  // Same language, no translation needed
  if (normalizedSource === normalizedTarget) {
    return false;
  }

  // Check if both languages are supported by Translator
  if (!isTranslatorSupported(normalizedSource)) {
    logger.warn(`Source language not supported for translation: ${sourceLang}`);
    return false;
  }

  if (!isTranslatorSupported(normalizedTarget)) {
    logger.warn(`Target language not supported for translation: ${targetLang}`);
    return false;
  }

  return true;
}

/**
 * Get human-readable language name
 * @param {string} langCode - Language code
 * @returns {string} Language name
 */
export function getLanguageName(langCode) {
  const normalized = normalizeLanguageCode(langCode);

  const names = {
    'en': 'English',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'nl': 'Dutch',
    'pl': 'Polish',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'tr': 'Turkish',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'cs': 'Czech',
    'he': 'Hebrew',
    'th': 'Thai',
    'vi': 'Vietnamese'
  };

  return names[normalized] || normalized.toUpperCase();
}

/**
 * Get all supported languages for a specific API
 * @param {string} api - 'detector' | 'translator' | 'prompt'
 * @returns {Array<string>} Array of ISO 639-1 codes
 */
export function getSupportedLanguages(api) {
  switch (api) {
    case 'detector':
      return [...DETECTOR_SUPPORTED_LANGUAGES];
    case 'translator':
      return [...TRANSLATOR_SUPPORTED_LANGUAGES];
    case 'prompt':
      return [...PROMPT_API_OUTPUT_LANGUAGES];
    default:
      logger.warn(`Unknown API: ${api}`);
      return [];
  }
}

/**
 * Validate language code and provide helpful error message
 * @param {string} langCode - Language code to validate
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, normalized: string, error: string|null}}
 */
export function validateLanguageCode(langCode, context = '') {
  if (!langCode) {
    return {
      valid: false,
      normalized: 'en',
      error: `Missing language code${context ? ` for ${context}` : ''}`
    };
  }

  const normalized = normalizeLanguageCode(langCode);

  return {
    valid: true,
    normalized,
    error: null
  };
}
