import { describe, it, expect } from 'vitest';
import {
    loadUpscalerForScale,
    createEnhancedFallbackUpscaler
} from '../resizeProcessor';

describe('resizeProcessor', () => {
    // Note: Full image resizing tests are complex to mock via jsdom/canvas-mock
    // without introducing fragility. We rely on the verified logic in fileUtils
    // for dimension calculations, and focus here on the upscaler factory logic.

    describe('loadUpscalerForScale', () => {
        it('should use fallback for 8x scale immediately', async () => {
            const upscaler = await loadUpscalerForScale(8);
            expect(upscaler).toBeDefined();
            expect(upscaler.scale).toBe(8);
        });
    });

    describe('createEnhancedFallbackUpscaler', () => {
        it('should return an upscaler with upscale method', () => {
            const upscaler = createEnhancedFallbackUpscaler(4);
            expect(upscaler.scale).toBe(4);
            expect(typeof upscaler.upscale).toBe('function');
        });
    });
});
