import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    safeCleanupGPUMemory,
    cleanupBlobUrls,
} from '../memoryUtils';

describe('memoryUtils', () => {
    let mockTf;

    beforeEach(() => {
        // Mock global TF object
        mockTf = {
            memory: vi.fn().mockReturnValue({ numBytesInGPU: 1024 * 1024 * 100 }), // 100MB
            disposeVariables: vi.fn(),
            engine: vi.fn().mockReturnValue({
                startScope: vi.fn(),
                endScope: vi.fn()
            }),
            ENV: { reset: vi.fn() }
        };
        global.window.tf = mockTf;

        // Mock URL
        if (!global.URL) global.URL = {};
        global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GPU Memory Management', () => {
        it('should safe cleanup variables when triggered', () => {
            safeCleanupGPUMemory();
            expect(mockTf.disposeVariables).toHaveBeenCalled();
        });
    });

    describe('Resource Cleanup', () => {
        it('should revoke blob URLs', () => {
            const images = [
                { url: 'blob:img1', name: 'test1' },
                { url: 'http://example.com', name: 'test2' } // Should not revoke
            ];
            cleanupBlobUrls(images);
            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:img1');
            expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith('http://example.com');
        });

        it('should nullify urls after cleanup', () => {
            const images = [{ url: 'blob:img1' }];
            cleanupBlobUrls(images);
            expect(images[0].url).toBeNull();
        });
    });
});
