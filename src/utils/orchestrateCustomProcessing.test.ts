import { describe, it, expect, vi } from 'vitest';
import { orchestrateCustomProcessing } from './generalUtils';
import { IMAGE_FORMATS, PROCESSING_MODES } from '../constants';
import type { ProcessingOptions, ImageFile } from '../types';

// Mock the processors
vi.mock('../../processors', () => ({
    processLemGendaryResize: vi.fn(),
    processLemGendaryCrop: vi.fn(),
    processSmartCrop: vi.fn(),
    processSimpleSmartCrop: vi.fn(),
    processLengendaryOptimize: vi.fn((_file, _quality, format) => {
        // Return a dummy file
        return Promise.resolve(new File([''], `mock.${format}`, { type: `image/${format}` }));
    }),
    processTemplateImages: vi.fn()
}));

describe('orchestrateCustomProcessing', () => {
    it('should use batch rename logic when output.rename is true', async () => {
        const images: ImageFile[] = [{
            file: new File([''], 'test.png', { type: 'image/png' }),
            name: 'test.png',
            type: 'image/png',
            size: 0,
            id: '1',
            preview: '',
            originalWidth: 100,
            originalHeight: 100
        }];

        const processingConfig = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                quality: 85,
                rename: true,
                newFileName: 'NewName'
            },
            batchRename: {
                pattern: 'NewName',
                find: '',
                replace: '',
                useRegex: false,
                casing: 'uppercase',
                startSequence: 10,
                stepSequence: 1,
                zerosPadding: 3,
                dateFormat: 'YYYY-MM-DD'
            },
            compression: { quality: 80, fileSize: '100' }
        };

        const results = await orchestrateCustomProcessing(
            images,
            processingConfig as ProcessingOptions,
            false
        );

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('NEWNAME-010.WEBP');
    });

    it('should respect tokens in newFileName', async () => {
        const images: ImageFile[] = [{
            file: new File([''], 'test.png', { type: 'image/png' }),
            name: 'test.png',
            type: 'image/png',
            size: 0,
            id: '1',
            preview: '',
            originalWidth: 100,
            originalHeight: 100
        }];

        const processingConfig: Partial<ProcessingOptions> = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                quality: 85,
                rename: true,
                newFileName: 'prefix_{counter}_suffix'
            },
            batchRename: {
                pattern: 'ignored',
                find: '',
                replace: '',
                useRegex: false,
                startSequence: 1,
                zerosPadding: 2,
                stepSequence: 1,
                casing: 'original',
                dateFormat: 'YYYY-MM-DD'
            },
            compression: { quality: 80, fileSize: '100' }
        };

        const results = await orchestrateCustomProcessing(
            images,
            processingConfig as ProcessingOptions,
            false
        );

        expect(results[0].name).toBe('prefix_01_suffix.webp');
    });

    it('should fall back to simple logic (append counter) if no tokens', async () => {
        const images: ImageFile[] = [{
            file: new File([''], 'test.png', { type: 'image/png' }),
            name: 'test.png',
            type: 'image/png',
            size: 0,
            id: '1',
            preview: '',
            originalWidth: 100,
            originalHeight: 100
        }];

        const processingConfig: Partial<ProcessingOptions> = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                quality: 85,
                rename: true,
                newFileName: 'Simple'
            },
            // No batchRename options provided (null/undefined)
            batchRename: undefined,
            compression: { quality: 80, fileSize: '100' }
        };

        const results = await orchestrateCustomProcessing(
            images,
            processingConfig as ProcessingOptions,
            false
        );

        // Should append -{counter} automatically -> Simple-001 (default padding 3, start 1)
        expect(results[0].name).toBe('Simple-001.webp');
    });
});
