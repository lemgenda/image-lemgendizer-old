import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { processAiQualityImprovement, clearModelCacheForTesting } from '../aiQualityImprovementProcessor';
import { MAXIM_MODEL_URLS } from '../../constants/sharedConstants';
import * as aiLoaderUtils from '../../utils/aiLoaderUtils';

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', async () => {
    return {
        browser: {
            fromPixels: vi.fn(),
            toPixels: vi.fn()
        },
        loadGraphModel: vi.fn(),
        tidy: (fn: any) => fn()
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
        clearModelCacheForTesting(); // Ensure clean cache

        // Setup mock canvas
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 100;
        mockCanvas.height = 100;

        // Setup mock tensor
        mockTensor = {
            shape: [100, 100, 3], // Added shape
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

        const result = await processAiQualityImprovement(mockCanvas, options, onProgress, (key: string) => key);

        expect(result).toBe(mockCanvas);
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('should load correct model for deblur', async () => {
        const options = { deblur: true };
        const onProgress = vi.fn();

        await processAiQualityImprovement(mockCanvas, options, onProgress, (key: string) => key);

        expect(aiLoaderUtils.loadMaximModel).toHaveBeenCalledWith(MAXIM_MODEL_URLS.DEBLUR);
        expect(onProgress).toHaveBeenCalled();
    });

    it('should process image logic correctly', async () => {
        const options = { denoise: true };
        const onProgress = vi.fn();

        await processAiQualityImprovement(mockCanvas, options, onProgress, (key: string) => key);

        expect(tf.browser.fromPixels).toHaveBeenCalledWith(mockCanvas);
        expect(mockModel.predict).toHaveBeenCalled();
        expect(tf.browser.toPixels).toHaveBeenCalled();
        expect(mockTensor.dispose).toHaveBeenCalled();
        // expect(mockModel.dispose).toHaveBeenCalled(); // Model should NOT be disposed due to caching
    });

    it('should handle errors gracefully', async () => {
        const options = { deblur: true };
        const onProgress = vi.fn();
        const error = new Error('Model load failed');

        (aiLoaderUtils.loadMaximModel as any).mockRejectedValue(error);

        await expect(processAiQualityImprovement(mockCanvas, options, onProgress, (key: string) => key))
            .rejects.toThrow('Model load failed');
    });

    it('should use tiling for large images', async () => {
        const options = { denoise: true };
        const onProgress = vi.fn();

        // Setup large canvas (> 1024)
        mockCanvas.width = 2000;
        mockCanvas.height = 2000;
        // Mock tensor shape to match
        mockTensor.shape = [2000, 2000, 3];

        await processAiQualityImprovement(mockCanvas, options, onProgress, (key: string) => key);

        // Verify it ran through successfully (mocking makes actual tiling verification hard
        // without spying on internal processWithTiling, but we ensure no crash and model called)
        expect(mockModel.predict).toHaveBeenCalled();
        // Tiling calls predict for each tile. 2000x2000 with 1024 size ~ 4 tiles.
        // We expect multiple calls or at least one if we don't spy nicely.
        // Actually, with the current mocks, processWithTiling calls tf.browser.fromPixels(tileData)
        // which returns mockTensor, then mockModel.predict(mockTensor).
        // So predict should be called multiple times.
        expect(mockModel.predict.mock.calls.length).toBeGreaterThan(1);
    });
});
