import { describe, it, expect, beforeEach } from 'vitest';
import {
    getFlagForLanguage,
    getCurrentLanguage,
    getLanguageName,
    getCurrentLanguageObject
} from '../languageUtils';
import { DEFAULT_LANGUAGE } from '../../constants';

describe('languageUtils', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('getFlagForLanguage', () => {
        it('should return correct flag for en', () => {
            expect(getFlagForLanguage('en')).toBe('US');
        });

        it('should return correct flag for hr', () => {
            expect(getFlagForLanguage('hr')).toBe('HR');
        });

        it('should return default for unknown', () => {
            expect(getFlagForLanguage('zz')).toBe('GL');
        });
    });

    describe('getCurrentLanguage', () => {
        it('should return default language if nothing in storage', () => {
            expect(getCurrentLanguage()).toBe(DEFAULT_LANGUAGE);
        });

        it('should return stored language', () => {
            localStorage.setItem('app-language', 'hr');
            expect(getCurrentLanguage()).toBe('hr');
        });
    });

    describe('getLanguageName', () => {
        it('should return correct name for en', () => {
            expect(getLanguageName('en')).toBe('English');
        });

        it('should return Unknown for unknown code', () => {
            expect(getLanguageName('zz')).toBe('Unknown');
        });
    });

    describe('getCurrentLanguageObject', () => {
        it('should find the correct language object', () => {
            const obj = getCurrentLanguageObject('en');
            expect(obj.code).toBe('en');
            expect(obj.flag).toBe('US');
        });

        it('should default to the first language if not found', () => {
            const obj = getCurrentLanguageObject('zz');
            expect(obj.code).toBe('en'); // Assuming 'en' is first in constants
        });
    });
});
