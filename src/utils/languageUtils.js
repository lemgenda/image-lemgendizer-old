import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from '../constants';

/**
 * Gets available languages.
 * @returns {Array<Object>} Array of language objects
 */
export const getLanguages = () => {
    return AVAILABLE_LANGUAGES;
};

/**
 * Gets current language object.
 * @param {string} currentLangCode - Current language code
 * @returns {Object} Current language object
 */
export const getCurrentLanguage = (currentLangCode) => {
    return AVAILABLE_LANGUAGES.find(lang => lang.code === currentLangCode) ||
        AVAILABLE_LANGUAGES.find(lang => lang.code === DEFAULT_LANGUAGE) ||
        AVAILABLE_LANGUAGES[0];
};

/**
 * Gets language name by code
 * @param {string} code - Language code
 * @returns {string} Language name
 */
export const getLanguageName = (code) => {
    const lang = AVAILABLE_LANGUAGES.find(l => l.code === code);
    return lang ? lang.name : 'Unknown';
};