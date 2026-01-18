import { describe, it, expect } from 'vitest';
import { calculatePercentage, normalizeUrl, cleanUrl } from './generalUtils';

describe('generalUtils', () => {
    describe('calculatePercentage', () => {
        it('should correctly calculate percentage', () => {
            expect(calculatePercentage(0, 100, 50)).toBe(50);
            expect(calculatePercentage(10, 20, 15)).toBe(50);
            expect(calculatePercentage(0, 1, 0.75)).toBe(75);
        });
    });

    describe('normalizeUrl', () => {
        it('should add default protocol if missing', () => {
            expect(normalizeUrl('example.com')).toBe('https://example.com');
        });

        it('should not add protocol if already present', () => {
            expect(normalizeUrl('http://example.com')).toBe('http://example.com');
            expect(normalizeUrl('https://example.com')).toBe('https://example.com');
        });

        it('should remove localhost:5173 prefix', () => {
            expect(normalizeUrl('localhost:5173/example.com')).toBe('https://example.com');
        });

        it('should return empty string for empty input', () => {
            expect(normalizeUrl('')).toBe('');
            expect(normalizeUrl('   ')).toBe('');
        });

        it('should fix multiple slashes after protocol', () => {
            expect(normalizeUrl('https:///example.com')).toBe('https://example.com');
        });
    });

    describe('cleanUrl', () => {
        it('should remove localhost prefix and extra slashes', () => {
            expect(cleanUrl('localhost:5173/example.com')).toBe('example.com');
            expect(cleanUrl('https:///example.com')).toBe('https://example.com');
        });

        it('should return empty string for empty input', () => {
            expect(cleanUrl('')).toBe('');
        });
    });
});
