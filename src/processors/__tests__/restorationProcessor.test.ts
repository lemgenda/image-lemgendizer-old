import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processLemGendaryRestoration } from '../restorationProcessor';
import * as aiWorkerUtils from '../../utils/aiWorkerUtils';

// Mock dependencies
vi.mock('../../utils/aiWorkerUtils', () => ({
    restoreInWorker: vi.fn()
}));

describe('restorationProcessor', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock URL and DOM
        global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
        global.URL.revokeObjectURL = vi.fn();

        // Mock Canvas
        const mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn().mockReturnValue({
                putImageData: vi.fn()
            }),
            toBlob: vi.fn((callback) => callback(new Blob([''], { type: 'image/png' })))
        };

        // Mock Document and Image
        global.document.createElement = vi.fn((tagName) => {
            if (tagName === 'canvas') return mockCanvas as any;
            if (tagName === 'img') {
                const img = {
                    onload: null,
                    onerror: null,
                    set src(_val: string) {
                        setTimeout(() => (img as any).onload(), 0);
                    }
                };
                return img as any;
            }
            return {};
        }) as any;
    });

    it('should correctly process restoration and name the output file', async () => {
        const mockFile = new File([''], 'test-image.jpg', { type: 'image/jpeg' });
        const mockImageData = { width: 100, height: 100, data: new Uint8ClampedArray(40000) } as ImageData;

        vi.mocked(aiWorkerUtils.restoreInWorker).mockResolvedValue(mockImageData);

        const result = await processLemGendaryRestoration(mockFile, 'CodeFormer');

        expect(aiWorkerUtils.restoreInWorker).toHaveBeenCalledWith(
            expect.anything(),
            'CodeFormer',
            undefined,
            {}
        );
        expect(result.name).toBe('test-image-restored-CodeFormer.jpg');
        expect(result.type).toBe('image/png'); // restorationProcessor uses PNG for lossless
    });

    it('should throw an error if restoration fails', async () => {
        const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        vi.mocked(aiWorkerUtils.restoreInWorker).mockRejectedValue(new Error('AI execution failed'));

        await expect(processLemGendaryRestoration(mockFile, 'CodeFormer'))
            .rejects.toThrow('Restoration failed');
    });

    it('should pass options and progress callback to worker', async () => {
        const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        const mockImageData = { width: 10, height: 10, data: new Uint8ClampedArray(400) } as ImageData;
        const progressCb = vi.fn();
        const options = { fidelity: 0.5 };

        vi.mocked(aiWorkerUtils.restoreInWorker).mockResolvedValue(mockImageData);

        await processLemGendaryRestoration(mockFile, 'CodeFormer', progressCb, options);

        expect(aiWorkerUtils.restoreInWorker).toHaveBeenCalledWith(
            expect.anything(),
            'CodeFormer',
            progressCb,
            options
        );
    });
});
