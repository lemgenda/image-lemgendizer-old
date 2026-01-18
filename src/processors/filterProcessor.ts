import { IMAGE_FILTERS } from '../constants';
import { ColorCorrectionOptions } from '../types';

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
 * Applies image adjustments and/or a specific image filter to the provided canvas or image element.
 *
 * @param {HTMLImageElement | HTMLCanvasElement} source - Source image or canvas element.
 * @param {string} filterType - Type of filter to apply (from IMAGE_FILTERS).
 * @param {ColorCorrectionOptions} [colorCorrection] - Optional color correction settings.
 * @returns {Promise<HTMLCanvasElement>} A promise resolving to the resulting filtered canvas.
 */
export const applyImageFilter = async (
    source: HTMLImageElement | HTMLCanvasElement,
    filterType: string,
    colorCorrection?: ColorCorrectionOptions
): Promise<HTMLCanvasElement> => {
    // 1. Create a fresh canvas and copy source to it
    const canvas = document.createElement('canvas');
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }
    ctx.drawImage(source, 0, 0);

    const hasFilter = filterType && filterType !== IMAGE_FILTERS.NONE;
    const hasColorCorrection = colorCorrection && colorCorrection.enabled;

    if (!hasFilter && !hasColorCorrection) {
        return canvas;
    }

    // Load CamanJS dynamically
    try {
        await loadCamanJS();
    } catch (_e) {
        return canvas;
    }

    const Caman = (window as any).Caman;
    if (!Caman) {
        throw new Error("CamanJS failed to initialize");
    }

    // 2. Apply CamanJS Filter/Adjustments
    return new Promise((resolve, reject) => {
        try {
            Caman(canvas, function (this: any) {
                try {
                    // Apply Color Correction first if enabled
                    if (hasColorCorrection && colorCorrection) {
                        if (colorCorrection.brightness !== 0) this.brightness(colorCorrection.brightness);
                        if (colorCorrection.contrast !== 0) this.contrast(colorCorrection.contrast);
                        if (colorCorrection.saturation !== 0) this.saturation(colorCorrection.saturation);
                        if (colorCorrection.vibrance !== 0) this.vibrance(colorCorrection.vibrance);
                        if (colorCorrection.exposure !== 0) this.exposure(colorCorrection.exposure);
                        if (colorCorrection.hue !== 0) this.hue(colorCorrection.hue);
                        if (colorCorrection.sepia !== 0) this.sepia(colorCorrection.sepia);
                        if (colorCorrection.gamma !== 1.0) this.gamma(colorCorrection.gamma);
                        if (colorCorrection.noise !== 0) this.noise(colorCorrection.noise);
                        if (colorCorrection.clip !== 0) this.clip(colorCorrection.clip);
                        if (colorCorrection.sharpen !== 0) this.sharpen(colorCorrection.sharpen);
                        if (colorCorrection.stackBlur !== 0) this.stackBlur(colorCorrection.stackBlur);
                    }

                    // Apply Presets (though in our UI they are mutually exclusive)
                    if (hasFilter) {
                        switch (filterType) {
                            case IMAGE_FILTERS.SEPIA: this.sepia(100); break;
                            case IMAGE_FILTERS.BW: this.greyscale(); break;
                            case IMAGE_FILTERS.INVERT: this.invert(); break;
                            case IMAGE_FILTERS.VIGNETTE: {
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
                            case IMAGE_FILTERS.RETRO_VINTAGE: this.vintage(); break;
                            case IMAGE_FILTERS.HDR:
                                this.contrast(20);
                                this.saturation(20);
                                this.vibrance(20);
                                break;
                            case IMAGE_FILTERS.VINTAGE:
                                this.greyscale();
                                this.contrast(5);
                                this.noise(5);
                                this.sepia(100);
                                this.channels({ red: 8, blue: 2, green: 4 });
                                this.gamma(0.87);
                                this.vignette("40%", 30);
                                break;
                            case IMAGE_FILTERS.LOMO: this.lomo(); break;
                            case IMAGE_FILTERS.CLARITY: this.clarity(); break;
                            case IMAGE_FILTERS.SIN_CITY: this.sinCity(); break;
                            case IMAGE_FILTERS.SUNRISE: this.sunrise(); break;
                            case IMAGE_FILTERS.CROSS_PROCESS: this.crossProcess(); break;
                            case IMAGE_FILTERS.ORANGE_PEEL: this.orangePeel(); break;
                            case IMAGE_FILTERS.LOVE: this.love(); break;
                            case IMAGE_FILTERS.GRUNGY: this.grungy(); break;
                            case IMAGE_FILTERS.JARQUES: this.jarques(); break;
                            case IMAGE_FILTERS.PINHOLE: this.pinhole(); break;
                            case IMAGE_FILTERS.OLD_BOOT: this.oldBoot(); break;
                            case IMAGE_FILTERS.GLOWING_SUN: this.glowingSun(); break;
                            case IMAGE_FILTERS.HAZY_DAYS: this.hazyDays(); break;
                            case IMAGE_FILTERS.HER_MAJESTY: this.herMajesty(); break;
                            case IMAGE_FILTERS.NOSTALGIA: this.nostalgia(); break;
                            case IMAGE_FILTERS.HEMINGWAY: this.hemingway(); break;
                            case IMAGE_FILTERS.CONCENTRATE: this.concentrate(); break;
                            case IMAGE_FILTERS.NIGHT_VISION: {
                                this.greyscale();
                                this.contrast(60);
                                this.sharpen(35);
                                this.brightness(-10);
                                this.colorize('#046704ff', 45);
                                this.channels({ green: 25, red: -20, blue: -20 });
                                this.gamma(0.6);
                                const cX = this.canvas.width / 2;
                                const cY = this.canvas.height / 2;
                                this.process("vignette", function (pixel: any) {
                                    const loc = pixel.locationXY();
                                    const nx = (loc.x - cX) / cX;
                                    const ny = (loc.y - cY) / cY;
                                    const dist = Math.sqrt(nx * nx + ny * ny);
                                    if (dist > 0.6) {
                                        const strength = Math.pow((dist - 0.6) / 0.5, 2) * 2.0;
                                        pixel.r = Math.pow(pixel.r / 255, 1 + strength) * 255;
                                        pixel.g = Math.pow(pixel.g / 255, 1 + strength) * 255;
                                        pixel.b = Math.pow(pixel.b / 255, 1 + strength) * 255;
                                    }
                                    return pixel;
                                });
                                break;
                            }
                        }
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
