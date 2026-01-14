/**
 * @file filterProcessor.ts
 * @description Provides image filtering capabilities using the CamanJS library.
 */
import { IMAGE_FILTERS } from '../constants';

// Cache for CamanJS loading promise
let camanLoadingPromise: Promise<void> | null = null;

/**
 * Dynamically loads the CamanJS library from a local vendor path.
 * Ensures the script is only loaded once per session.
 * @returns {Promise<void>} Resolves when the library is ready.
 */
function loadCamanJS(): Promise<void> {
    if ((window as any).Caman) {
        return Promise.resolve();
    }

    if (camanLoadingPromise) {
        return camanLoadingPromise;
    }

    camanLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/src/vendor/caman.js';
        script.type = 'text/javascript';
        script.onload = () => {
            if ((window as any).Caman) {
                resolve();
            } else {
                reject(new Error('CamanJS loaded but window.Caman not found'));
            }
        };
        script.onerror = () => {
            camanLoadingPromise = null;
            reject(new Error('Failed to load CamanJS script'));
        };
        document.head.appendChild(script);
    });

    return camanLoadingPromise;
}

/**
 * Applies a specific image filter to the provided canvas or image element.
 * This function orchestrates the dynamic loading of CamanJS and the application
 * of standard or custom filters (like elliptical vignettes).
 *
 * @param {HTMLImageElement | HTMLCanvasElement} source - Source image or canvas element.
 * @param {string} filterType - Type of filter to apply (from IMAGE_FILTERS).
 * @returns {Promise<HTMLCanvasElement>} A promise resolving to the resulting filtered canvas.
 */
export const applyImageFilter = async (
    source: HTMLImageElement | HTMLCanvasElement,
    filterType: string
): Promise<HTMLCanvasElement> => {
    // 1. Create a fresh canvas and copy source to it
    const canvas = document.createElement('canvas');
    // Ensure we don't carry over previous contexts if source is a used canvas
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }
    ctx.drawImage(source, 0, 0);

    if (filterType === IMAGE_FILTERS.NONE) {
        return canvas;
    }

    // Load CamanJS dynamically
    try {
        await loadCamanJS();
    } catch (_e) {
        return canvas; // Fail gracefully if library cannot be loaded
    }

    const Caman = (window as any).Caman;
    if (!Caman) {
        throw new Error("CamanJS failed to initialize");
    }

    // 2. Apply CamanJS Filter
    return new Promise((resolve, reject) => {
        try {
            // Caman modifies the canvas in-place.
            // We pass the canvas element directly.
            Caman(canvas, function (this: any) {
                try {
                    switch (filterType) {
                        // --- Standard Allowed Filters ---
                        case IMAGE_FILTERS.SEPIA:
                            this.sepia(100);
                            break;
                        case IMAGE_FILTERS.BW:
                            this.greyscale();
                            break;
                        case IMAGE_FILTERS.INVERT:
                            this.invert();
                            break;
                        case IMAGE_FILTERS.VIGNETTE: {
                            // Custom Elliptical Vignette: Scales with aspect ratio to avoid portrait issues
                            const vX = this.canvas.width / 2;
                            const vY = this.canvas.height / 2;

                            this.process("vignette", function (pixel: any) {
                                const loc = pixel.locationXY();
                                const nx = (loc.x - vX) / vX;
                                const ny = (loc.y - vY) / vY;
                                const dist = Math.sqrt(nx * nx + ny * ny);

                                if (dist > 0.7) {
                                    const strength = Math.pow((dist - 0.7) / 0.4, 2) * 1.5;
                                    pixel.r = Math.pow(pixel.r / 255, 1 + strength) * 255;
                                    pixel.g = Math.pow(pixel.g / 255, 1 + strength) * 255;
                                    pixel.b = Math.pow(pixel.b / 255, 1 + strength) * 255;
                                }
                                return pixel;
                            });
                            break;
                        }
                        case IMAGE_FILTERS.RETRO_VINTAGE:
                            this.vintage(); // Use Caman's vintage for Retro
                            break;
                        case IMAGE_FILTERS.HDR:
                            // Approximate HDR with high contrast/vibrance/saturation
                            this.contrast(20);
                            this.saturation(20);
                            this.vibrance(20);
                            // this.sharpen(10); // Optional
                            break;

                        // --- CamanJS Presets ---
                        case IMAGE_FILTERS.VINTAGE:
                            // Manual vintage with film grain
                            this.greyscale();
                            this.contrast(5);
                            this.noise(5); // Film grain effect (increased from default 3)
                            this.sepia(100);
                            this.channels({ red: 8, blue: 2, green: 4 });
                            this.gamma(0.87);
                            this.vignette("40%", 30);
                            break;
                        case IMAGE_FILTERS.LOMO:
                            this.lomo();
                            break;
                        case IMAGE_FILTERS.CLARITY:
                            this.clarity();
                            break;
                        case IMAGE_FILTERS.SIN_CITY:
                            this.sinCity();
                            break;
                        case IMAGE_FILTERS.SUNRISE:
                            this.sunrise();
                            break;
                        case IMAGE_FILTERS.CROSS_PROCESS:
                            this.crossProcess();
                            break;
                        case IMAGE_FILTERS.ORANGE_PEEL:
                            this.orangePeel();
                            break;
                        case IMAGE_FILTERS.LOVE:
                            this.love();
                            break;
                        case IMAGE_FILTERS.GRUNGY:
                            this.grungy();
                            break;
                        case IMAGE_FILTERS.JARQUES:
                            this.jarques();
                            break;
                        case IMAGE_FILTERS.PINHOLE:
                            this.pinhole();
                            break;
                        case IMAGE_FILTERS.OLD_BOOT:
                            this.oldBoot();
                            break;
                        case IMAGE_FILTERS.GLOWING_SUN:
                            this.glowingSun();
                            break;
                        case IMAGE_FILTERS.HAZY_DAYS:
                            this.hazyDays();
                            break;
                        case IMAGE_FILTERS.HER_MAJESTY:
                            this.herMajesty();
                            break;
                        case IMAGE_FILTERS.NOSTALGIA:
                            this.nostalgia();
                            break;
                        case IMAGE_FILTERS.HEMINGWAY:
                            this.hemingway();
                            break;
                        case IMAGE_FILTERS.CONCENTRATE:
                            this.concentrate();
                            break;
                        case IMAGE_FILTERS.NIGHT_VISION: {
                            // Night vision effect
                            this.greyscale();
                            this.contrast(60); // Even more contrast (from 45)
                            this.sharpen(35); // Sharper (from 30)
                            this.brightness(-10);
                            this.colorize('#046704ff', 45);
                            this.channels({ green: 25, red: -20, blue: -20 });
                            this.gamma(0.6); // Lower gamma (from 0.8)

                            // Custom Elliptical Vignette: Scales with aspect ratio to avoid portrait issues
                            const cX = this.canvas.width / 2;
                            const cY = this.canvas.height / 2;

                            this.process("vignette", function (pixel: any) {
                                const loc = pixel.locationXY();
                                // Normalizing distance from center (-1 to 1) relative to width/height
                                const nx = (loc.x - cX) / cX;
                                const ny = (loc.y - cY) / cY;

                                // Elliptical distance formula
                                const dist = Math.sqrt(nx * nx + ny * ny);

                                if (dist > 0.6) {
                                    // Apply power-based darkening for smooth falloff
                                    const strength = Math.pow((dist - 0.6) / 0.5, 2) * 2.0;
                                    pixel.r = Math.pow(pixel.r / 255, 1 + strength) * 255;
                                    pixel.g = Math.pow(pixel.g / 255, 1 + strength) * 255;
                                    pixel.b = Math.pow(pixel.b / 255, 1 + strength) * 255;
                                }
                                return pixel;
                            });
                            break;
                        }

                        default:
                            // No op
                            break;
                    }

                    // Render and resolve
                    this.render(() => {
                        resolve(canvas);
                    });

                } catch (err) {
                    reject(err);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
};
