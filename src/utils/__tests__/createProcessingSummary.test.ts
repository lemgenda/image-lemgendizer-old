import { describe, it, expect } from 'vitest';
import { createProcessingSummary } from '../fileUtils';
import { PROCESSING_MODES } from '../../constants';

describe('createProcessingSummary', () => {
    const mockT = (key: string, options?: any) => {
        if (key === 'operations.aiUpscalingWithModel') return `AI upscaling with ${options.model}`;
        return key;
    };

    it('should include upscale model in summary when available', () => {
        const result = {
            imagesProcessed: 1,
            totalFiles: 1,
            success: true,
            processedImagesList: [
                { aiUpscaleScale: 2, aiUpscaleModel: 'esrgan-slim' }
            ]
        };
        const options = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: { formats: ['webp'], quality: 0.8 },
            resize: { enabled: false },
            crop: { enabled: false },
            filters: { enabled: false },
            watermark: { enabled: false }
        } as any;

        const summary = createProcessingSummary(result, options, mockT as any);

        expect(summary.upscalingUsed).toBe(true);
        expect(summary.upscaleScale).toBe(2);
        expect(summary.upscaleModel).toBe('esrgan-slim');
        expect(summary.operations).toContain('AI upscaling with x2 (esrgan-slim)');
    });

    it('should handle upscale summary without model name', () => {
        const result = {
            imagesProcessed: 1,
            totalFiles: 1,
            success: true,
            processedImagesList: [
                { aiUpscaleScale: 4 }
            ]
        };
        const options = {
            processingMode: PROCESSING_MODES.CUSTOM,
            output: { formats: ['webp'], quality: 0.8 },
            resize: { enabled: false },
            crop: { enabled: false },
            filters: { enabled: false },
            watermark: { enabled: false }
        } as any;

        const summary = createProcessingSummary(result, options, mockT as any);

        expect(summary.upscalingUsed).toBe(true);
        expect(summary.upscaleScale).toBe(4);
        expect(summary.operations).toContain('AI upscaling with x4');
    });
});
