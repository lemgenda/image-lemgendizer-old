/**
 * @file languageUtils.ts
 * @description Utilities for language detection, management, and flag mapping.
 */
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from '../constants';

export interface LanguageInfo {
    code: string;
    name: string;
    flag: string;
}

/**
 * Gets available languages with flags
 * @returns {Array<LanguageInfo>} Array of language objects with code, name, and flag
 */
export const getLanguagesWithFlags = (): LanguageInfo[] => {
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
export const getFlagForLanguage = (langCode: string): string => {
    const flagMap: { [key: string]: string } = {
        'en': 'US',
        'hr': 'HR'
    };
    return flagMap[langCode] || 'GL';
};

/**
 * Gets the current language from localStorage or defaults
 * @returns {string} Current language code
 */
export const getCurrentLanguage = (): string => {
    return localStorage.getItem('app-language') || DEFAULT_LANGUAGE;
};

/**
 * Changes the application language
 * @param {string} langCode - Language code to change to
 * @param {any} i18n - i18n instance
 */
 
export const changeApplicationLanguage = (langCode: string, i18n: any): void => {
    if (i18n && typeof i18n.changeLanguage === 'function') {
        i18n.changeLanguage(langCode);
    }
    localStorage.setItem('app-language', langCode);
};

/**
 * Gets current language object
 * @param {string} currentLangCode - Current language code
 * @returns {LanguageInfo} Current language object
 */
export const getCurrentLanguageObject = (currentLangCode: string): LanguageInfo => {
    const languages = getLanguagesWithFlags();
    return languages.find(lang => lang.code === currentLangCode) || languages[0];
};

/**
 * Initializes language from storage
 * @param {any} i18n - i18n instance
 * @returns {string} Initialized language code
 */
 
export const initializeLanguage = (i18n: any): string => {
    const lang = getCurrentLanguage();
    if (i18n && typeof i18n.changeLanguage === 'function') {
        i18n.changeLanguage(lang);
    }
    return lang;
};

/**
 * Gets language name by code
 * @param {string} code - Language code
 * @returns {string} Language name
 */
export const getLanguageName = (code: string): string => {
    const lang = AVAILABLE_LANGUAGES.find(l => l.code === code);
    return lang ? lang.name : 'Unknown';
};
