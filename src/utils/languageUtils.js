import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from '../constants';

/**
 * Gets available languages with flags
 * @returns {Array<Object>} Array of language objects with code, name, and flag
 */
export const getLanguagesWithFlags = () => {
    return AVAILABLE_LANGUAGES.map(lang => ({
        code: lang.code,
        name: lang.name,
        flag: getFlagForLanguage(lang.code)
    }));
};

/**
 * Gets flag emoji for language code
 * @param {string} langCode - Language code
 * @returns {string} Flag emoji
 */
export const getFlagForLanguage = (langCode) => {
    const flagMap = {
        'en': 'US',
        'hr': 'HR'
    };
    return flagMap[langCode] || 'GL';
};

/**
 * Gets the current language from localStorage or defaults
 * @returns {string} Current language code
 */
export const getCurrentLanguage = () => {
    return localStorage.getItem('app-language') || DEFAULT_LANGUAGE;
};

/**
 * Changes the application language
 * @param {string} langCode - Language code to change to
 * @param {Object} i18n - i18n instance
 */
export const changeApplicationLanguage = (langCode, i18n) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('app-language', langCode);
};

/**
 * Gets current language object
 * @param {string} currentLangCode - Current language code
 * @returns {Object} Current language object
 */
export const getCurrentLanguageObject = (currentLangCode) => {
    const languages = getLanguagesWithFlags();
    return languages.find(lang => lang.code === currentLangCode) || languages[0];
};

/**
 * Initializes language from storage
 * @param {Object} i18n - i18n instance
 * @returns {string} Initialized language code
 */
export const initializeLanguage = (i18n) => {
    const lang = getCurrentLanguage();
    i18n.changeLanguage(lang);
    return lang;
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