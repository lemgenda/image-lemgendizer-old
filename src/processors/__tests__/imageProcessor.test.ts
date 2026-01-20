import { describe, it, expect } from 'vitest';
import { getProcessingConfiguration } from '../imageProcessor';
import { CROP_MODES, PROCESSING_MODES, IMAGE_FORMATS } from '../../constants';
import type { ProcessingMode, CropMode } from '../../types';

describe('imageProcessor', () => {
    describe('getProcessingConfiguration', () => {
        it('should return correct defaults when options are empty', () => {
            const options = {};
            const config = getProcessingConfiguration(options as any);

            expect(config.compression.quality).toBe(0.8);
            expect(config.resize.enabled).toBe(false);
            expect(config.resize.dimension).toBe(1200);
            expect(config.crop.enabled).toBe(false);
            expect(config.crop.width).toBe(1080);
        });

        it('should correctly map user provided options', () => {
            const options = {
                compression: { quality: 90, fileSize: '500' },
                showResize: true,
                resizeDimension: '1500',
                showCrop: true,
                cropWidth: '1920',
                cropHeight: '1080',
                cropMode: CROP_MODES.SMART,
                processingMode: PROCESSING_MODES.TEMPLATES,
                selectedTemplates: ['template1', 'template2']
            };
            const config = getProcessingConfiguration(options as any);

            expect(config.compression.quality).toBe(0.9);
            expect(config.compression.targetSize).toBe(500);
            expect(config.resize.enabled).toBe(true);
            expect(config.resize.dimension).toBe(1500);
            expect(config.crop.enabled).toBe(true);
            expect(config.crop.width).toBe(1920);
            expect(config.crop.height).toBe(1080);
            expect(config.crop.mode).toBe(CROP_MODES.SMART as CropMode);
            expect(config.templates.mode).toBe(PROCESSING_MODES.TEMPLATES as ProcessingMode);
            expect(config.templates.mode).toBe(PROCESSING_MODES.TEMPLATES as ProcessingMode);
            expect(config.templates.selected).toEqual(['template1', 'template2']);
        });

        it('should correctly map aiEnhancements options', () => {
            const options = {
                aiEnhancements: {
                    enabled: true,
                    tasks: ['deblurring']
                }
            };
            const config = getProcessingConfiguration(options as any);

            expect(config.aiEnhancements.enabled).toBe(true);
            expect(config.aiEnhancements.tasks).toEqual(['deblurring']);
        });

        it('should handle missing output formats by defaulting to webp', () => {
            const options = { output: {} };
            const config = getProcessingConfiguration(options as any);
            expect(config.output.formats).toEqual([IMAGE_FORMATS.WEBP]);
        });
    });
});
