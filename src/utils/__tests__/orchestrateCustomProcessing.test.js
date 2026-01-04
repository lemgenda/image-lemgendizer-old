import { describe, it, expect, vi } from 'vitest';
import { orchestrateCustomProcessing } from '../generalUtils';
import { IMAGE_FORMATS, PROCESSING_MODES } from '../../constants';

// Mock the processors
vi.mock('../../processors', () => ({
    processLemGendaryResize: vi.fn(),
    processLemGendaryCrop: vi.fn(),
    processSmartCrop: vi.fn(),
    processSimpleSmartCrop: vi.fn(),
    processLengendaryOptimize: vi.fn((file, quality, format) => {
        // Return a dummy file
        return Promise.resolve(new File([''], `mock.${format}`, { type: `image/${format}` }));
    }),
    processTemplateImages: vi.fn()
}));

// Mock ensureFileObject which is called inside orchestrateCustomProcessing via processors... wait,
// orchestrateCustomProcessing calls logic directly too?
// No, it handles the loop.
// But it accesses `image.file`.

describe('orchestrateCustomProcessing', () => {
    it('should use batch rename logic when output.rename is true', async () => {
        const images = [{
            file: new File([''], 'test.png', { type: 'image/png' }),
            name: 'test.png',
            type: 'image/png'
        }];

        const processingConfig = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                rename: true,
                newFileName: 'NewName'
            },
            batchRename: {
                pattern: 'NewName', // This might be overwritten or used
                casing: 'uppercase', // Advanced option
                startSequence: 10,
                stepSequence: 1,
                zerosPadding: 3
            },
            compression: { quality: 0.8 }
        };

        const results = await orchestrateCustomProcessing(images, processingConfig, false);

        expect(results).toHaveLength(1);
        // Expect casing to be applied (NEWNAME-010.webp)
        // Note: My logic appends -{counter} if no tokens.
        // And uppercase casing applies to the WHOLE name usually?
        // Let's check renameUtils logic for casing.
        // It applies casing to the RESULT of the pattern replacement.

        // Pattern = "NewName-{counter}" (appended automatically)
        // Result = "NewName-010"
        // Uppercase = "NEWNAME-010"


        expect(results[0].name).toBe('NEWNAME-010.WEBP');
    });

    it('should respect tokens in newFileName', async () => {
        const images = [{
            file: new File([''], 'test.png', { type: 'image/png' }),
            name: 'test.png',
            type: 'image/png'
        }];

        const processingConfig = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                rename: true,
                newFileName: 'prefix_{counter}_suffix'
            },
            batchRename: {
                pattern: 'ignored',
                startSequence: 1,
                zerosPadding: 2
            },
            compression: { quality: 0.8 }
        };

        const results = await orchestrateCustomProcessing(images, processingConfig, false);

        expect(results[0].name).toBe('prefix_01_suffix.webp');
    });

    it('should fall back to simple logic (append counter) if no tokens', async () => {
        const images = [{
            file: new File([''], 'test.png', { type: 'image/png' }),
            name: 'test.png',
            type: 'image/png'
        }];

        const processingConfig = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                rename: true,
                newFileName: 'Simple'
            },
            // No batchRename options provided (null/undefined)
            batchRename: null,
            compression: { quality: 0.8 }
        };

        const results = await orchestrateCustomProcessing(images, processingConfig, false);

        // Should append -{counter} automatically -> Simple-001 (default padding 3, start 1)
        expect(results[0].name).toBe('Simple-001.webp');
    });
});
