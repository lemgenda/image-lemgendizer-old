import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyImageFilter } from '../filterProcessor';
import { IMAGE_FILTERS } from '../../constants';

// Mock CamanJS
const mockCamanInstance = {
    render: vi.fn((callback) => callback()),
    sepia: vi.fn(),
    greyscale: vi.fn(),
    invert: vi.fn(),
    vintage: vi.fn(),
    contrast: vi.fn(),
    saturation: vi.fn(),
    vibrance: vi.fn(),
    noise: vi.fn(),
    channels: vi.fn(),
    gamma: vi.fn(),
    vignette: vi.fn(),
    lomo: vi.fn(),
    clarity: vi.fn(),
    sinCity: vi.fn(),
    sunrise: vi.fn(),
    crossProcess: vi.fn(),
    orangePeel: vi.fn(),
    love: vi.fn(),
    grungy: vi.fn(),
    jarques: vi.fn(),
    pinhole: vi.fn(),
    oldBoot: vi.fn(),
    glowingSun: vi.fn(),
    hazyDays: vi.fn(),
    herMajesty: vi.fn(),
    nostalgia: vi.fn(),
    hemingway: vi.fn(),
    concentrate: vi.fn(),
    sharpen: vi.fn(),
    brightness: vi.fn(),
    colorize: vi.fn(),
    process: vi.fn(),
    canvas: { width: 100, height: 100 }
};

const mockCamanConstructor = vi.fn((_canvas, callback) => {
    callback.call(mockCamanInstance);
    return mockCamanInstance;
});

// Setup global Caman
beforeEach(() => {
    vi.clearAllMocks();
    (window as any).Caman = mockCamanConstructor;
});

afterEach(() => {
    delete (window as any).Caman;
});

describe('filterProcessor', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: any;

    beforeEach(() => {
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 100;
        mockCanvas.height = 100;
        mockCtx = {
            drawImage: vi.fn(),
            getImageData: vi.fn(),
            putImageData: vi.fn()
        };
        vi.spyOn(mockCanvas, 'getContext').mockReturnValue(mockCtx);
        vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
    });

    it('should return original canvas if filter is NONE', async () => {
        const result = await applyImageFilter(mockCanvas, IMAGE_FILTERS.NONE);
        expect(result).toBeInstanceOf(HTMLCanvasElement);
        expect(mockCamanConstructor).not.toHaveBeenCalled();
    });

    it('should initialize Caman and apply SEPIA filter', async () => {
        await applyImageFilter(mockCanvas, IMAGE_FILTERS.SEPIA);
        expect(mockCamanConstructor).toHaveBeenCalled();
        expect(mockCamanInstance.sepia).toHaveBeenCalledWith(100);
        expect(mockCamanInstance.render).toHaveBeenCalled();
    });

    it('should apply VINTAGE filter (Caman preset)', async () => {
        await applyImageFilter(mockCanvas, IMAGE_FILTERS.VINTAGE);
        expect(mockCamanInstance.greyscale).toHaveBeenCalled();
        expect(mockCamanInstance.contrast).toHaveBeenCalledWith(5);
        expect(mockCamanInstance.noise).toHaveBeenCalledWith(5);
        expect(mockCamanInstance.sepia).toHaveBeenCalledWith(100);
    });

    it('should apply NIGHT_VISION filter (Custom)', async () => {
        await applyImageFilter(mockCanvas, IMAGE_FILTERS.NIGHT_VISION);
        expect(mockCamanInstance.greyscale).toHaveBeenCalled();
        expect(mockCamanInstance.contrast).toHaveBeenCalledWith(60);
        expect(mockCamanInstance.sharpen).toHaveBeenCalledWith(35);
        // Verify custom vignette process was called
        expect(mockCamanInstance.process).toHaveBeenCalledWith('vignette', expect.any(Function));
    });

    it('should handle Caman initialization failure', async () => {
        delete (window as any).Caman;
        vi.spyOn(document.head, 'appendChild').mockImplementation((() => {
            throw new Error('Load failed');
        }) as any);

        const result = await applyImageFilter(mockCanvas, IMAGE_FILTERS.SEPIA);
        // It returns the canvas unmodified if loading fails (caught in try-catch)
        expect(result).toBe(mockCanvas);
    });
});
