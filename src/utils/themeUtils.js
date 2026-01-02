import { THEME_CONFIG, THEME_SWITCH } from '../constants';

/**
 * Gets the initial theme based on saved preference or system preference
 * @returns {string} Initial theme name
 */
export const getInitialTheme = () => {
    const savedTheme = localStorage.getItem(THEME_CONFIG.STORAGE_KEY);

    if (savedTheme) {
        return savedTheme;
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? THEME_CONFIG.DARK : THEME_CONFIG.LIGHT;
    }
};

/**
 * Applies theme to the document
 * @param {string} theme - Theme name to apply
 */
export const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_CONFIG.STORAGE_KEY, theme);
};

/**
 * Gets the opposite theme
 * @param {string} currentTheme - Current theme name
 * @returns {string} Opposite theme name
 */
export const getOppositeTheme = (currentTheme) => {
    return currentTheme === THEME_CONFIG.DARK ? THEME_CONFIG.LIGHT : THEME_CONFIG.DARK;
};

/**
 * Creates a system theme change listener
 * @param {Function} onThemeChange - Callback function when system theme changes
 * @returns {Function} Cleanup function to remove listener
 */
export const createSystemThemeListener = (onThemeChange) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e) => {
        if (!localStorage.getItem(THEME_CONFIG.STORAGE_KEY)) {
            const newTheme = e.matches ? THEME_CONFIG.DARK : THEME_CONFIG.LIGHT;
            onThemeChange(newTheme);
        }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
};

/**
 * Checks if theme is dark mode
 * @param {string} theme - Theme name
 * @returns {boolean} True if theme is dark mode
 */
export const isDarkMode = (theme) => {
    return theme === THEME_CONFIG.DARK;
};

/**
 * Gets theme icon class based on theme
 * @param {string} theme - Theme name
 * @returns {string} Icon class name
 */
export const getThemeIconClass = (theme) => {
    return isDarkMode(theme) ? THEME_SWITCH.ICONS.LIGHT : THEME_SWITCH.ICONS.DARK;
};

/**
 * Gets theme tooltip text based on theme
 * @param {string} theme - Theme name
 * @returns {string} Tooltip text
 */
export const getThemeTooltip = (theme) => {
    return isDarkMode(theme) ? THEME_SWITCH.TOOLTIPS.LIGHT : THEME_SWITCH.TOOLTIPS.DARK;
};