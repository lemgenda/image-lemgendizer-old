
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProcessingConfiguration } from '../imageProcessor';
import { processLengendaryOptimize } from '../imageProcessor';
import { IMAGE_FILTERS, IMAGE_FORMATS } from '../../constants';
import * as filterProcessor from '../filterProcessor';

// Mock filter processor
vi.mock('../filterProcessor', () => ({
    applyImageFilter: vi.fn().mockImplementation((canvas) => Promise.resolve(canvas))
}));

// Mock CamanJS loading
vi.mock('../../utils', async () => {
    const actual = await vi.importActual('../../utils');
    return {
        ...actual as any,
        validateImageFilesBeforeProcessing: vi.fn().mockReturnValue([]),
        checkImageTransparency: vi.fn().mockResolvedValue(false)
    };
});

describe('Color Correction Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getProcessingConfiguration', () => {
        it('should correctly map color correction options', () => {
            const inputOptions = {
                colorCorrection: {
                    enabled: true,
                    brightness: 10,
                    contrast: 20,
                    saturation: -5,
                    exposure: 5,
                    sepia: 0,
                    gamma: 1.2
                },
                filters: { enabled: false }
            };

            const config = getProcessingConfiguration(inputOptions);

            expect(config.filters.enabled).toBe(false);
            expect(config.colorCorrection).toBeDefined();
            expect(config.colorCorrection.enabled).toBe(true);
            expect(config.colorCorrection.brightness).toBe(10);
            expect(config.colorCorrection.contrast).toBe(20);
            expect(config.colorCorrection.saturation).toBe(-5);
            expect(config.colorCorrection.gamma).toBe(1.2);
        });
    });

    describe('processLengendaryOptimize Integration', () => {
        it('should call applyImageFilter when color correction is enabled', async () => {
            const mockFile = new File([''], 'test.png', { type: 'image/png' });
            const processingOptions = {
                colorCorrection: {
                    enabled: true,
                    brightness: 10
                },
                output: { quality: 0.8, format: 'png' }
            } as any;

            // Mock URL and Image
            global.URL.createObjectURL = vi.fn(() => 'blob:test');
            global.URL.revokeObjectURL = vi.fn();

            // Mock Canvas
            // Mock Canvas
            const mockContext = {
                fillStyle: '',
                fillRect: vi.fn(),
                drawImage: vi.fn(),
                clearRect: vi.fn(),
                canvas: {
                    width: 100,
                    height: 100,
                    toBlob: (cb: any) => cb(new Blob(['test'], { type: 'image/png' }))
                }
            };

            const mockCanvas = {
                width: 100,
                height: 100,
                getContext: vi.fn(() => mockContext),
                toBlob: (cb: any) => cb(new Blob(['test'], { type: 'image/png' }))
            };

            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') return mockCanvas as any;
                return originalCreateElement(tag);
            });

            // Mock Image

            // Allow capturing the instance to trigger onload later
            let capturedImageInstance: any;

            class MockImage {
                naturalWidth = 100;
                naturalHeight = 100;
                onload = () => { };
                src = '';
                constructor() {
                    // eslint-disable-next-line @typescript-eslint/no-this-alias
                    capturedImageInstance = this;
                }
            }
            vi.stubGlobal('Image', MockImage);

            const processPromise = processLengendaryOptimize(
                mockFile,
                0.8,
                IMAGE_FORMATS.PNG,
                IMAGE_FILTERS.NONE,
                null,
                processingOptions
            );

            // Trigger onload
            // Trigger onload
            setTimeout(() => {
                if (capturedImageInstance && capturedImageInstance.onload) {
                    capturedImageInstance.onload();
                }
            }, 0);

            await processPromise;

            expect(filterProcessor.applyImageFilter).toHaveBeenCalled();
            const args = (filterProcessor.applyImageFilter as any).mock.calls[0];
            expect(args[2]).toEqual(processingOptions.colorCorrection);
        });
    });
});
