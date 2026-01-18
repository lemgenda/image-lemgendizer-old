
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhanceImageWithMaxim } from '../aiEnhancementsProcessor';
import { MAXIM_TASKS } from '../../constants/aiConstants';
import * as aiWorkerUtils from '../../utils/aiWorkerUtils';

// Mock the worker utils
vi.mock('../../utils/aiWorkerUtils', () => ({
    enhanceInWorker: vi.fn(),
    initAIWorker: vi.fn()
}));

describe('aiEnhancementsProcessor', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
        // Setup mock canvas
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 100;
        mockCanvas.height = 100;
        mockCtx = mockCanvas.getContext('2d')!;

        // Fill properly to ensure getImageData works
        mockCtx.fillStyle = 'red';
        mockCtx.fillRect(0, 0, 100, 100);

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return original canvas if no tasks provided', async () => {
        const result = await enhanceImageWithMaxim(mockCanvas, []);
        expect(result).toBeInstanceOf(HTMLCanvasElement);
        // Dimensions should match
        expect(result.width).toBe(100);
        expect(result.height).toBe(100);
        expect(aiWorkerUtils.enhanceInWorker).not.toHaveBeenCalled();
    });

    it('should process image with single task', async () => {
        // Mock successful worker response
        const mockResponse = {
            data: new Float32Array(100 * 100 * 4), // Flattened RGBA
            shape: [100, 100] as [number, number],
            task: MAXIM_TASKS.DENOISING
        };
        (aiWorkerUtils.enhanceInWorker as any).mockResolvedValue(mockResponse);

        const onProgress = vi.fn();
        const result = await enhanceImageWithMaxim(mockCanvas, [MAXIM_TASKS.DENOISING], onProgress);

        expect(result).toBeInstanceOf(HTMLCanvasElement);
        expect(aiWorkerUtils.enhanceInWorker).toHaveBeenCalledTimes(1); // 1 tile (100x100 < 192x192)
        expect(onProgress).toHaveBeenCalled();

        // Verify call arguments
        const callArgs = (aiWorkerUtils.enhanceInWorker as any).mock.calls[0];
        expect(callArgs[1]).toBe(MAXIM_TASKS.DENOISING);
    });

    it('should process image with multiple tasks sequentially', async () => {
        const mockResponse = {
            data: new Float32Array(100 * 100 * 4),
            shape: [100, 100] as [number, number],
            task: 'test'
        };
        (aiWorkerUtils.enhanceInWorker as any).mockResolvedValue(mockResponse);

        const tasks = [MAXIM_TASKS.DENOISING, MAXIM_TASKS.DEBLURRING];
        await enhanceImageWithMaxim(mockCanvas, tasks);

        // Should be called twice (once per task for the single tile)
        expect(aiWorkerUtils.enhanceInWorker).toHaveBeenCalledTimes(2);
        expect((aiWorkerUtils.enhanceInWorker as any).mock.calls[0][1]).toBe(MAXIM_TASKS.DENOISING);
        expect((aiWorkerUtils.enhanceInWorker as any).mock.calls[1][1]).toBe(MAXIM_TASKS.DEBLURRING);
    });

    it('should handle tiling for large images', async () => {
        // Create large canvas (e.g., 300x300, tile size is 192)
        // 300 / 192 = ~1.5 -> 2 cols, 2 rows = 4 tiles
        const bigCanvas = document.createElement('canvas');
        bigCanvas.width = 300;
        bigCanvas.height = 300;

        const mockResponse = {
            data: new Float32Array(192 * 192 * 4), // Max tile size data
            shape: [192, 192] as [number, number],
            task: MAXIM_TASKS.LOW_LIGHT
        };
        (aiWorkerUtils.enhanceInWorker as any).mockResolvedValue(mockResponse);

        await enhanceImageWithMaxim(bigCanvas, [MAXIM_TASKS.LOW_LIGHT]);

        // 4 tiles * 1 task = 4 calls
        expect(aiWorkerUtils.enhanceInWorker).toHaveBeenCalledTimes(4);
    });
});
