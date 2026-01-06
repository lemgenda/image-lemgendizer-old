import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { processAiQualityImprovement } from '../aiQualityImprovementProcessor';
import { MAXIM_MODEL_URLS } from '../../constants/sharedConstants';
import * as aiLoaderUtils from '../../utils/aiLoaderUtils';

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', async () => {
    return {
        browser: {
            fromPixels: vi.fn(),
            toPixels: vi.fn()
        },
        loadGraphModel: vi.fn()
    };
});

// Mock aiLoaderUtils
vi.mock('../../utils/aiLoaderUtils', () => ({
    loadMaximModel: vi.fn()
}));

describe('aiQualityImprovementProcessor', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockTensor: any;
    let mockModel: any;

    beforeEach(() => {
        // Setup mock canvas
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 100;
        mockCanvas.height = 100;

        // Setup mock tensor
        mockTensor = {
            expandDims: vi.fn().mockReturnThis(),
            toFloat: vi.fn().mockReturnThis(),
            div: vi.fn().mockReturnThis(),
            mul: vi.fn().mockReturnThis(),
            clipByValue: vi.fn().mockReturnThis(),
            squeeze: vi.fn().mockReturnThis(),
            toInt: vi.fn().mockReturnThis(),
            dispose: vi.fn()
        };

        // Setup mock model
        mockModel = {
            predict: vi.fn().mockReturnValue(mockTensor),
            dispose: vi.fn()
        };

        // Reset mocks
        vi.clearAllMocks();

        // Setup default mock returns
        (tf.browser.fromPixels as any).mockReturnValue(mockTensor);
        (aiLoaderUtils.loadMaximModel as any).mockResolvedValue(mockModel);
    });

    it('should return original canvas if no options selected', async () => {
        const options = { deblur: false, denoise: false }; // all false
        const onProgress = vi.fn();

        const result = await processAiQualityImprovement(mockCanvas, options, onProgress);

        expect(result).toBe(mockCanvas);
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('should load correct model for deblur', async () => {
        const options = { deblur: true };
        const onProgress = vi.fn();

        await processAiQualityImprovement(mockCanvas, options, onProgress);

        expect(aiLoaderUtils.loadMaximModel).toHaveBeenCalledWith(MAXIM_MODEL_URLS.DEBLUR);
        expect(onProgress).toHaveBeenCalled();
    });

    it('should process image logic correctly', async () => {
        const options = { denoise: true };
        const onProgress = vi.fn();

        await processAiQualityImprovement(mockCanvas, options, onProgress);

        expect(tf.browser.fromPixels).toHaveBeenCalledWith(mockCanvas);
        expect(mockModel.predict).toHaveBeenCalled();
        expect(tf.browser.toPixels).toHaveBeenCalled();
        expect(mockTensor.dispose).toHaveBeenCalled();
        expect(mockModel.dispose).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        const options = { deblur: true };
        const onProgress = vi.fn();
        const error = new Error('Model load failed');

        (aiLoaderUtils.loadMaximModel as any).mockRejectedValue(error);

        await expect(processAiQualityImprovement(mockCanvas, options, onProgress))
            .rejects.toThrow('Model load failed');
    });
});
