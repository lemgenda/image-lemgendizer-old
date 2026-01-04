import { describe, it, expect } from 'vitest';
import {
    getTemplateById,
    getTemplatesByCategory,
    calculateTotalTemplateFiles,
    getCategoryDisplayName,
    requiresSmartCrop,
    groupTemplatesByCategory
} from '../templateProcessor';
import type { AppTemplate } from '../../types';

describe('templateProcessor', () => {
    const mockTemplates: AppTemplate[] = [
        {
            id: 't1', category: 'web', width: 800, height: 600, name: 'Web 800', platform: 'web', templateName: 'web-800', cropMode: 'center',
            cropConfig: { useSmartCrop: false, strategy: 'center', preserveLogos: false, prioritySubject: '', minSubjectSize: 0, maxPadding: 0, tightCrop: false, quality: 80, format: 'webp' }
        },
        {
            id: 't2', category: 'instagram', width: 1080, height: 1080, name: 'Insta', platform: 'instagram', templateName: 'insta-post', cropMode: 'smart',
            cropConfig: { useSmartCrop: true, strategy: 'ai_priority', preserveLogos: true, prioritySubject: 'person', minSubjectSize: 200, maxPadding: 20, tightCrop: true, quality: 85, format: 'webp' }
        },
        {
            id: 't3', category: 'web', width: 1920, height: 1080, name: 'Web Full', platform: 'web', templateName: 'web-1080', cropMode: 'center',
            cropConfig: { useSmartCrop: false, strategy: 'center', preserveLogos: false, prioritySubject: '', minSubjectSize: 0, maxPadding: 0, tightCrop: false, quality: 80, format: 'webp' }
        }
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
            expect(calculateTotalTemplateFiles(['t1', 't2'], mockTemplates, false, false, 0)).toBe(2);
        });

        it('should add favicon files if selected', () => {
            // Basic mode adds 5 extra files + array length.
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
            expect(requiresSmartCrop({ category: 'instagram', width: 100, height: 100 } as any)).toBe(true);
        });
        it('should true for extreme aspect ratios', () => {
            expect(requiresSmartCrop({ category: 'web', width: 1000, height: 100 } as any)).toBe(true); // 10:1 ratio
        });
        it('should false for balanced web images', () => {
            expect(requiresSmartCrop({ category: 'web', width: 800, height: 600 } as any)).toBe(false);
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
