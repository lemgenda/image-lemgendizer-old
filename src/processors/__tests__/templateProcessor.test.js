import { describe, it, expect } from 'vitest';
import {
    getTemplateById,
    getTemplatesByCategory,
    calculateTotalTemplateFiles,
    getCategoryDisplayName,
    requiresSmartCrop,
    groupTemplatesByCategory
} from '../templateProcessor';

describe('templateProcessor', () => {
    const mockTemplates = [
        { id: 't1', category: 'web', width: 800, height: 600 },
        { id: 't2', category: 'instagram', width: 1080, height: 1080 },
        { id: 't3', category: 'web', width: 1920, height: 1080 }
    ];

    describe('getTemplateById', () => {
        it('should return correct template', () => {
            expect(getTemplateById('t1', mockTemplates)).toBe(mockTemplates[0]);
        });
        it('should return null for unknown id', () => {
            expect(getTemplateById('unknown', mockTemplates)).toBeNull();
        });
    });

    describe('getTemplatesByCategory', () => {
        it('should filter by category', () => {
            const result = getTemplatesByCategory('web', mockTemplates);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('t1');
            expect(result[1].id).toBe('t3');
        });
    });

    describe('calculateTotalTemplateFiles', () => {
        it('should count selected templates', () => {
            expect(calculateTotalTemplateFiles(['t1', 't2'], mockTemplates, false, false)).toBe(2);
        });

        it('should add favicon files if selected', () => {
            // Basic mode adds 5 extra files + array length. Assuming array length > 0 in real config
            const count = calculateTotalTemplateFiles(['t1'], mockTemplates, true, false, 0, 'basic');
            expect(count).toBeGreaterThan(5);
        });

        it('should add screenshot count', () => {
            expect(calculateTotalTemplateFiles([], mockTemplates, false, true, 3)).toBe(3);
        });
    });

    describe('getCategoryDisplayName', () => {
        it('should return known category names', () => {
            expect(getCategoryDisplayName('web')).toBe('Web Images');
            expect(getCategoryDisplayName('instagram')).toBe('Instagram');
        });
        it('should return default for unknown', () => {
            expect(getCategoryDisplayName('unknown')).toBe('Social Media');
        });
    });

    describe('requiresSmartCrop', () => {
        it('should true for social media/instagram', () => {
            expect(requiresSmartCrop({ category: 'instagram', width: 100, height: 100 })).toBe(true);
        });
        it('should true for extreme aspect ratios', () => {
            expect(requiresSmartCrop({ category: 'web', width: 1000, height: 100 })).toBe(true); // 10:1 ratio
        });
        it('should false for balanced web images', () => {
            expect(requiresSmartCrop({ category: 'web', width: 800, height: 600 })).toBe(false);
        });
    });

    describe('groupTemplatesByCategory', () => {
        it('should group templates', () => {
            const groups = groupTemplatesByCategory(mockTemplates);
            expect(Object.keys(groups)).toContain('web');
            expect(Object.keys(groups)).toContain('instagram');
            expect(groups.web).toHaveLength(2);
            expect(groups.instagram).toHaveLength(1);
        });
    });
});
