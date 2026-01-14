/**
 * @file themeUtils.ts
 * @description Utilities for application theming, including theme switching, persistence, and
 * system preference integration.
 */
import { THEME_CONFIG, THEME_SWITCH } from '../constants';
import { Theme } from '../types';

/**
 * Gets the initial theme based on saved preference or system preference
 * @returns {Theme} Initial theme name
 */
export const getInitialTheme = (): Theme => {
    const savedTheme = localStorage.getItem(THEME_CONFIG.STORAGE_KEY) as Theme;

    if (savedTheme && Object.values(THEME_CONFIG).includes(savedTheme as any)) {
        return savedTheme;
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? THEME_CONFIG.DARK as Theme : THEME_CONFIG.LIGHT as Theme;
    }
};

/**
 * Applies theme to the document
 * @param {Theme} theme - Theme name to apply
 */
export const applyTheme = (theme: Theme): void => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_CONFIG.STORAGE_KEY, theme);
};

/**
 * Gets the opposite theme
 * @param {Theme} currentTheme - Current theme name
 * @returns {Theme} Opposite theme name
 */
export const getOppositeTheme = (currentTheme: Theme): Theme => {
    return currentTheme === THEME_CONFIG.DARK ? THEME_CONFIG.LIGHT as Theme : THEME_CONFIG.DARK as Theme;
};

/**
 * Creates a system theme change listener
 * @param {Function} onThemeChange - Callback function when system theme changes
 * @returns {Function} Cleanup function to remove listener
 */
export const createSystemThemeListener = (onThemeChange: (theme: Theme) => void): (() => void) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem(THEME_CONFIG.STORAGE_KEY)) {
            const newTheme = e.matches ? THEME_CONFIG.DARK : THEME_CONFIG.LIGHT;
            onThemeChange(newTheme as Theme);
        }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
};

/**
 * Checks if theme is dark mode
 * @param {Theme} theme - Theme name
 * @returns {boolean} True if theme is dark mode
 */
export const isDarkMode = (theme: Theme): boolean => {
    return theme === THEME_CONFIG.DARK;
};

/**
 * Gets theme icon class based on theme
 * @param {Theme} theme - Theme name
 * @returns {string} Icon class name
 */
export const getThemeIconClass = (theme: Theme): string => {
    return isDarkMode(theme) ? THEME_SWITCH.ICONS.LIGHT : THEME_SWITCH.ICONS.DARK;
};

/**
 * Gets theme tooltip text based on theme
 * @param {Theme} theme - Theme name
 * @returns {string} Tooltip text
 */
export const getThemeTooltip = (theme: Theme): string => {
    return isDarkMode(theme) ? THEME_SWITCH.TOOLTIPS.LIGHT : THEME_SWITCH.TOOLTIPS.DARK;
};
