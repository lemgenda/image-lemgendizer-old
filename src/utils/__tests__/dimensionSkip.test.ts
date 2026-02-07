import { describe, it, expect, vi } from 'vitest';
import { getProcessingConfiguration } from '../../processors/imageProcessor';
import { orchestrateCustomProcessing } from '../generalUtils';
import { IMAGE_FORMATS, PROCESSING_MODES } from '../../constants';

// Mock the processors
vi.mock('../../processors', async () => {
    const actual = await vi.importActual('../../processors') as any;
    return {
        ...actual,
        processLemGendaryResize: vi.fn(),
        processLemGendaryCrop: vi.fn(),
        processSmartCrop: vi.fn(),
        processSimpleSmartCrop: vi.fn(),
        processLengendaryOptimize: vi.fn((_file, _quality, format) => {
            return Promise.resolve(new File([''], `mock.${format}`, { type: `image/${format}` }));
        })
    };
});

// We need to import the mocked functions to check calls
import { processLemGendaryResize, processSmartCrop } from '../../processors';

describe('Dimension Skip Logic', () => {
    const mockImage = {
        file: new File([''], 'test.png', { type: 'image/png' }),
        name: 'test.png',
        type: 'image/png',
        size: 0,
        id: '1',
        preview: '',
        originalWidth: 100,
        originalHeight: 100
    };

    it('should set enabled: false if dimension is empty in getProcessingConfiguration', () => {
        const options = {
            showResize: true,
            resizeDimension: '', // Empty
            showCrop: true,
            cropWidth: '1080',
            cropHeight: '' // One empty
        };

        const config = getProcessingConfiguration(options);

        expect(config.resize.enabled).toBe(false);
        expect(config.crop.enabled).toBe(false);
    });

    it('should NOT call processors if dimension is empty', async () => {
        const options = {
            processingMode: PROCESSING_MODES.CUSTOM,
            showResize: true,
            resizeDimension: '',
            showCrop: true,
            cropWidth: '',
            cropHeight: '',
            output: {
                formats: [IMAGE_FORMATS.WEBP],
                quality: 85,
                rename: false,
                newFileName: ''
            }
        };

        // We use the real orchestrateCustomProcessing but the mocked processors
        await orchestrateCustomProcessing([mockImage], options as any, false);

        expect(processLemGendaryResize).not.toHaveBeenCalled();
        expect(processSmartCrop).not.toHaveBeenCalled();
    });
});
