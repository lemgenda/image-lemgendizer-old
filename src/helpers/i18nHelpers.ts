/**
 * Pluralization helper functions for i18n
 */

/**
 * Get plural suffix for a given count and language
 * @param {number} count - The count to determine pluralization for
 * @param {string} language - Language code ('en', 'hr', etc.)
 * @returns {string} Plural suffix for the given language
 */
export const getPluralSuffix = (count: number, language: string): string => {
    if (language === 'hr') {
        // Croatian plural rules
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;

        if (lastDigit === 1 && lastTwoDigits !== 11) return 'a';
        if (lastDigit >= 2 && lastDigit <= 4 &&
            (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'e';
        return 'a';
    }

    // English plural rules (default)
    return count === 1 ? '' : 's';
};

/**
 * Format message with count for proper pluralization
 * @param {string} key - Translation key
 * @param {number} count - Count for pluralization
 * @param {string} language - Language code
 * @param {object} translations - Translation object
 * @returns {string} Formatted message
 */
export const formatCountMessage = (
    key: string,
    count: number,
    language: string,
    translations: Record<string, string>
): string => {
    const suffix = getPluralSuffix(count, language);

    if (language === 'hr') {
        return translations[`${key}_${suffix}`] || translations[key];
    }

    // English
    return translations[`${key}_plural`] ?
        (count === 1 ? translations[key] : translations[`${key}_plural`]) :
        translations[key];
};

/**
 * Check if language uses right-to-left script
 * @param {string} language - Language code
 * @returns {boolean} True if RTL language
 */
export const isRTL = (language: string): boolean => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    return rtlLanguages.includes(language);
};
