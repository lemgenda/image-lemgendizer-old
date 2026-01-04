import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
    getInitialTheme,
    isDarkMode,
    getOppositeTheme,
    getThemeIconClass,
    getThemeTooltip,
    applyTheme
} from '../themeUtils';
import { THEME_CONFIG, THEME_SWITCH } from '../../constants';
import type { Theme } from '../../types';

describe('themeUtils', () => {
    let getItemSpy: Mock;
    let setItemSpy: Mock;

    beforeEach(() => {
        // Mock localStorage
        getItemSpy = vi.spyOn(window.localStorage, 'getItem') as Mock;
        setItemSpy = vi.spyOn(window.localStorage, 'setItem') as Mock;

        // Mock matchMedia
        if (!vi.isMockFunction(window.matchMedia)) {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn(),
            });
        }

        // Reset matchMedia to default "not matches"
        (window.matchMedia as Mock).mockImplementation((query: string) => ({
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
            (window.matchMedia as Mock).mockImplementation(() => ({
                matches: true
            }));
            expect(getInitialTheme()).toBe(THEME_CONFIG.DARK);
        });
    });

    describe('theme helpers', () => {
        it('should return correct opposite theme', () => {
            expect(getOppositeTheme(THEME_CONFIG.DARK as Theme)).toBe(THEME_CONFIG.LIGHT);
            expect(getOppositeTheme(THEME_CONFIG.LIGHT as Theme)).toBe(THEME_CONFIG.DARK);
        });

        it('should identify dark mode', () => {
            expect(isDarkMode(THEME_CONFIG.DARK as Theme)).toBe(true);
            expect(isDarkMode(THEME_CONFIG.LIGHT as Theme)).toBe(false);
        });

        it('should return correct icon class', () => {
            expect(getThemeIconClass(THEME_CONFIG.DARK as Theme)).toBe(THEME_SWITCH.ICONS.LIGHT);
            expect(getThemeIconClass(THEME_CONFIG.LIGHT as Theme)).toBe(THEME_SWITCH.ICONS.DARK);
        });

        it('should return correct tooltip', () => {
            expect(getThemeTooltip(THEME_CONFIG.DARK as Theme)).toBe(THEME_SWITCH.TOOLTIPS.LIGHT);
        });
    });

    describe('applyTheme', () => {
        it('should set attribute and local storage', () => {
            applyTheme(THEME_CONFIG.DARK as Theme);
            expect(document.documentElement.getAttribute('data-theme')).toBe(THEME_CONFIG.DARK);
            expect(setItemSpy).toHaveBeenCalledWith(THEME_CONFIG.STORAGE_KEY, THEME_CONFIG.DARK);
        });
    });
});
