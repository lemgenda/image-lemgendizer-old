import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getInitialTheme,
    isDarkMode,
    getOppositeTheme,
    getThemeIconClass,
    getThemeTooltip,
    applyTheme
} from '../themeUtils';
import { THEME_CONFIG, THEME_SWITCH } from '../../constants';

describe('themeUtils', () => {
    let getItemSpy, setItemSpy;

    beforeEach(() => {
        // Mock localStorage
        // Since setupTests.js replaces window.localStorage with a custom object,
        // we must spy on that object directly, not Storage.prototype.
        getItemSpy = vi.spyOn(window.localStorage, 'getItem');
        setItemSpy = vi.spyOn(window.localStorage, 'setItem');

        // Mock matchMedia
        // window.matchMedia is likely already mocked in setupTests.js,
        // but we can ensure consistent behavior here if needed or override implementation.
        // If setupTests.js defines it as a mock, we can just spy on it or assume it's there.
        // Ideally, we shouldn't redefine it if it's already a mock to avoid conflicts.
        if (!vi.isMockFunction(window.matchMedia)) {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn(),
            });
        }

        // Reset matchMedia to default "not matches"
        window.matchMedia.mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Clear mocks state but not implementation if it came from setupTests
        vi.clearAllMocks();
    });

    describe('getInitialTheme', () => {
        it('should return saved theme if present', () => {
            getItemSpy.mockReturnValue(THEME_CONFIG.DARK);
            expect(getInitialTheme()).toBe(THEME_CONFIG.DARK);
        });

        it('should return light if no saved theme and no preference', () => {
            getItemSpy.mockReturnValue(null);
            expect(getInitialTheme()).toBe(THEME_CONFIG.LIGHT);
        });

        it('should return dark if system prefers dark', () => {
            getItemSpy.mockReturnValue(null);
            window.matchMedia.mockImplementation(() => ({
                matches: true
            }));
            expect(getInitialTheme()).toBe(THEME_CONFIG.DARK);
        });
    });

    describe('theme helpers', () => {
        it('should return correct opposite theme', () => {
            expect(getOppositeTheme(THEME_CONFIG.DARK)).toBe(THEME_CONFIG.LIGHT);
            expect(getOppositeTheme(THEME_CONFIG.LIGHT)).toBe(THEME_CONFIG.DARK);
        });

        it('should identify dark mode', () => {
            expect(isDarkMode(THEME_CONFIG.DARK)).toBe(true);
            expect(isDarkMode(THEME_CONFIG.LIGHT)).toBe(false);
        });

        it('should return correct icon class', () => {
            expect(getThemeIconClass(THEME_CONFIG.DARK)).toBe(THEME_SWITCH.ICONS.LIGHT);
            expect(getThemeIconClass(THEME_CONFIG.LIGHT)).toBe(THEME_SWITCH.ICONS.DARK);
        });

        it('should return correct tooltip', () => {
            expect(getThemeTooltip(THEME_CONFIG.DARK)).toBe(THEME_SWITCH.TOOLTIPS.LIGHT);
        });
    });

    describe('applyTheme', () => {
        it('should set attribute and local storage', () => {
            applyTheme(THEME_CONFIG.DARK);
            expect(document.documentElement.getAttribute('data-theme')).toBe(THEME_CONFIG.DARK);
            expect(setItemSpy).toHaveBeenCalledWith(THEME_CONFIG.STORAGE_KEY, THEME_CONFIG.DARK);
        });
    });
});
