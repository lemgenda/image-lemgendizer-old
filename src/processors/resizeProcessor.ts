import {
    DEFAULT_WEBP_QUALITY,
    ERROR_MESSAGES,
    PROCESSING_THRESHOLDS,
    AVAILABLE_UPSCALE_FACTORS,
    MAX_TOTAL_PIXELS,
    MAX_SAFE_DIMENSION,
    TILE_SIZE,
    UPSCALING_TIMEOUT,
    PROCESSING_ERRORS,
    MAX_TEXTURE_FAILURES,
    SVG_CONSTANTS,
    MIME_TYPE_MAP
} from '../constants';

import {
    calculateUpscaleFactor,
    calculateSafeDimensions
} from '../utils';

// ... (existing code)


// Upscaler state management


// Upscaler state management
let upscalerInstances: Record<string, any> = {};
let upscalerUsageCount: Record<string, number> = {};
let upscalerLastUsed: Record<string, number> = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval: NodeJS.Timeout | null = null;
let aiUpscalingDisabled = false;
let textureManagerFailures = 0;
let cleanupInProgress = false;

/* --- Helpers --- */

/**
 * Applies smart sharpening to canvas using a Web Worker
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} scale - Scale factor
 * @returns {Promise<void>}
 */
const applySmartSharpening = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, scale: number): Promise<void> => {
    return new Promise((resolve) => {
        try {
            const width = canvas.width;
            const height = canvas.height;

            if (width * height > PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_SMART_SHARPENING) {
                resolve();
                return;
            }

            const imageData = ctx.getImageData(0, 0, width, height);

            // Create worker
            const worker = new Worker(new URL('../workers/sharpen.worker.js', import.meta.url));

            worker.onmessage = (e) => {
                if (e.data.processed && e.data.imageData) {
                    ctx.putImageData(e.data.imageData, 0, 0);
                }
                worker.terminate();
                resolve();
            };

            worker.onerror = () => {
                worker.terminate();
                resolve(); // Fail silently to continue processing
            };

            worker.postMessage({
                imageData: imageData,
                width: width,
                height: height,
                threshold: PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_SMART_SHARPENING,
                scale: scale // Passed scale as well just in case
            });

        } catch {
            resolve();
        }
    });
};

/**
 * Converts tensor to canvas
 * @param {Object} tensor - Tensor object
 * @returns {Promise<HTMLCanvasElement>} Canvas element
 */
const tensorToCanvas = async (tensor: any): Promise<HTMLCanvasElement> => {
    const [height, width] = tensor.shape;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    if ((window as any).tf) {
        // Use tf.browser.toPixels for efficient async GPU->CPU transfer
        await (window as any).tf.browser.toPixels(tensor, canvas);
    } else {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        const imageData = ctx.createImageData(width, height);
        const data = await tensor.data(); // Async fetch from GPU
        const channels = tensor.shape[2];

        // Optimized loop
        for (let i = 0; i < data.length; i += channels) {
            const pixelIndex = (i / channels) * 4;
            imageData.data[pixelIndex] = data[i];
            imageData.data[pixelIndex + 1] = data[i + 1];
            imageData.data[pixelIndex + 2] = data[i + 2];
            imageData.data[pixelIndex + 3] = channels === 4 ? data[i + 3] : 255;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    if (tensor.dispose) tensor.dispose();

    return canvas;
};

/**
 * Converts data URL to canvas
 * @param {string} dataURL - Data URL
 * @returns {Promise<HTMLCanvasElement>} Canvas element
 */
const dataURLToCanvas = (dataURL: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas);
            } else {
                reject(new Error("No context"));
            }
        };
        img.onerror = reject;
        img.src = dataURL;
    });
};

/**
 * Loads upscaler from CDN
 * @returns {Promise<void>}
 */
const loadUpscalerFromCDN = (): Promise<void> => {
    return new Promise((resolve) => {
        if ((window as any).Upscaler) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/upscaler@latest/dist/browser/umd/upscaler.min.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Loads upscaler model script
 * @param {string} src - Script source URL
 * @returns {Promise<void>}
 */
const loadUpscalerModelScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const scriptId = `upscaler-model-${src.split('/').pop()}`;
        if (document.getElementById(scriptId)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`${PROCESSING_ERRORS.CONVERSION_FAILED}: ${ERROR_MESSAGES.MODEL_LOAD_FAILED}`));
        document.head.appendChild(script);
    });
};

/**
 * Creates enhanced fallback upscaler
 * @param {number} scale - Scale factor
 * @returns {Object} Fallback upscaler
 */
export const createEnhancedFallbackUpscaler = (scale: number): any => {
    return {
        scale,
        upscale: async (imageElement: HTMLImageElement) => {
            const safeDimensions = calculateSafeDimensions(
                imageElement.naturalWidth,
                imageElement.naturalHeight,
                scale
            );

            const canvas = document.createElement('canvas');
            canvas.width = safeDimensions.width;
            canvas.height = safeDimensions.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No context");

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

            if (safeDimensions.scale >= PROCESSING_THRESHOLDS.DEFAULT_SCALE_FACTOR) {
                await applySmartSharpening(canvas, ctx, safeDimensions.scale);
            }

            return canvas;
        }
    };
};

/* --- Exported Functions --- */

/**
 * Processes SVG resize operation
 * @param {File} svgFile - SVG file
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<File>} Resized SVG file
 */
export const processSVGResize = async (svgFile: File, width: number, height: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const svgText = e.target?.result as string;
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                let originalWidth: number | undefined;
                let originalHeight: number | undefined;

                const widthAttr = svgElement.getAttribute('width');
                if (widthAttr && !isNaN(parseFloat(widthAttr))) {
                    originalWidth = parseFloat(widthAttr);
                }

                const heightAttr = svgElement.getAttribute('height');
                if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                    originalHeight = parseFloat(heightAttr);
                }

                if (!originalWidth || !originalHeight) {
                    const viewBox = svgElement.getAttribute('viewBox');
                    if (viewBox) {
                        const viewBoxParts = viewBox.split(' ').map(parseFloat);
                        if (viewBoxParts.length >= 4) {
                            if (!originalWidth) originalWidth = viewBoxParts[2];
                            if (!originalHeight) originalHeight = viewBoxParts[3];
                        }
                    }
                }

                if (!originalWidth) originalWidth = SVG_CONSTANTS.DEFAULT_WIDTH;
                if (!originalHeight) originalHeight = SVG_CONSTANTS.DEFAULT_HEIGHT;

                const aspectRatio = originalWidth / originalHeight;
                let finalWidth = width;
                let finalHeight = height;

                if (width && !height) {
                    finalWidth = width;
                    finalHeight = Math.round(width / aspectRatio);
                }
                else if (!width && height) {
                    finalHeight = height;
                    finalWidth = Math.round(height * aspectRatio);
                }
                else if (width && height) {
                    finalWidth = width;
                    finalHeight = height;
                }
                else {
                    finalWidth = originalWidth;
                    finalHeight = originalHeight;
                }

                svgElement.setAttribute('width', finalWidth.toString());
                svgElement.setAttribute('height', finalHeight.toString());

                if (!svgElement.hasAttribute('viewBox')) {
                    svgElement.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
                }

                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                const serializer = new XMLSerializer();
                const updatedSVG = serializer.serializeToString(svgElement);

                const blob = new Blob([updatedSVG], { type: MIME_TYPE_MAP.svg });
                const fileName = svgFile.name.replace(/\.svg$/i, `-${finalWidth}x${finalHeight}.svg`);
                resolve(new File([blob], fileName, { type: MIME_TYPE_MAP.svg }));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(svgFile);
    });
};


/**
 * Loads upscaler for specific scale
 * @param {number} scale - Scale factor
 * @returns {Promise<Object>} Upscaler instance
 */
export const loadUpscalerForScale = async (scale: number): Promise<any> => {
    if (upscalerInstances[scale] && upscalerUsageCount[scale] !== undefined) {
        upscalerUsageCount[scale]++;
        upscalerLastUsed[scale] = Date.now();
        return upscalerInstances[scale];
    }

    if (scale === 8) {
        const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        return fallbackUpscaler;
    }

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        if (!(window as any).Upscaler) await loadUpscalerFromCDN();

        let modelGlobalName: string = '';
        switch (scale) {
            case 2:
                await loadUpscalerModelScript('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@latest/dist/umd/2x.min.js');
                modelGlobalName = 'ESRGANSlim2x';
                break;
            case 3:
                await loadUpscalerModelScript('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@latest/dist/umd/3x.min.js');
                modelGlobalName = 'ESRGANSlim3x';
                break;
            case 4:
                await loadUpscalerModelScript('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@latest/dist/umd/4x.min.js');
                modelGlobalName = 'ESRGANSlim4x';
                break;
            default:
                throw new Error(`Unsupported scale: ${scale}`);
        }

        if (!(window as any)[modelGlobalName]) throw new Error(`Model ${modelGlobalName} not loaded`);

        let upscaler;
        upscaler = new (window as any).Upscaler({
            model: (window as any)[modelGlobalName],
        });

        upscalerInstances[scale] = upscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return upscaler;

    } catch {
        const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return fallbackUpscaler;
    }
};

/**
 * Releases upscaler for specific scale
 * @param {number} scale - Scale factor
 */
export const releaseUpscalerForScale = (scale: number): void => {
    if (upscalerUsageCount[scale]) {
        upscalerUsageCount[scale]--;
        upscalerLastUsed[scale] = Date.now();

        if (upscalerUsageCount[scale] <= 0 && currentMemoryUsage > 1000) {
            setTimeout(() => {
                if (upscalerUsageCount[scale] <= 0) {
                    const upscaler = upscalerInstances[scale];
                    if (upscaler && upscaler.dispose) {
                        try { upscaler.dispose(); } catch { /* ignored */ }
                    }
                    delete upscalerInstances[scale];
                    delete upscalerUsageCount[scale];
                    delete upscalerLastUsed[scale];
                }
            }, 1000);
        }
    }
};

/**
 * Safely upscales image
 * @param {Object} upscaler - Upscaler instance
 * @param {HTMLImageElement} img - Image element
 * @param {number} scale - Scale factor
 * @returns {Promise<Object>} Upscale result
 */
export const safeUpscale = async (upscaler: any, img: HTMLImageElement, scale: number): Promise<any> => {
    if (upscalerUsageCount[scale]) upscalerUsageCount[scale]++;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            releaseUpscalerForScale(scale);
            reject(new Error(ERROR_MESSAGES.UPSCALING_FAILED));
        }, UPSCALING_TIMEOUT);

        try {
            upscaler.upscale(img, {
                patchSize: 128,
                padding: 2,
                output: 'tensor' // Force tensor output to avoid sync base64 conversion
            }).then((result: any) => {
                clearTimeout(timeoutId);
                upscalerLastUsed[scale] = Date.now();
                releaseUpscalerForScale(scale);
                resolve(result);
            }).catch((error: any) => {
                clearTimeout(timeoutId);
                releaseUpscalerForScale(scale);
                reject(error);
            });
        } catch (error) {
            clearTimeout(timeoutId);
            releaseUpscalerForScale(scale);
            reject(error);
        }
    });
};

/**
 * Upscales image using tiled approach
 * @param {HTMLImageElement} img - Image element
 * @param {number} scale - Scale factor
 * @param {string} originalName - Original file name
 * @param {string} objectUrl - Object URL (optional)
 * @returns {Promise<File>} Upscaled image file
 */
export const upscaleImageTiled = async (img: HTMLImageElement, scale: number, originalName: string, objectUrl?: string): Promise<File> => {
    // const originalWidth = img.naturalWidth;
    // const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(img.naturalWidth * scale);
    const targetHeight = Math.round(img.naturalHeight * scale);

    const tileSize = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    const xTiles = Math.ceil(targetWidth / tileSize);
    const yTiles = Math.ceil(targetHeight / tileSize);

    for (let y = 0; y < yTiles; y++) {
        for (let x = 0; x < xTiles; x++) {
            const tileX = x * tileSize;
            const tileY = y * tileSize;
            const tileWidth = Math.min(tileSize, targetWidth - tileX);
            const tileHeight = Math.min(tileSize, targetHeight - tileY);

            const srcX = tileX / scale;
            const srcY = tileY / scale;
            const srcWidth = tileWidth / scale;
            const srcHeight = tileHeight / scale;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileWidth;
            tempCanvas.height = tileHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = 'high';

                tempCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, tileWidth, tileHeight);
                await applySmartSharpening(tempCanvas, tempCtx, scale);
                ctx.drawImage(tempCanvas, tileX, tileY);
            }
        }
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, MIME_TYPE_MAP.webp, 0.9);
    });

    if (!blob) throw new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED);

    const extension = originalName.split('.').pop() || 'png';
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-tiled-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: MIME_TYPE_MAP.webp });
};

/**
 * Upscales image with enhanced fallback method
 * @param {File} imageFile - Image file to upscale
 * @param {number} scale - Scale factor
 * @param {string} originalName - Original file name
 * @returns {Promise<File>} Upscaled image file
 */
export const upscaleImageEnhancedFallback = async (imageFile: File, scale: number, originalName: string): Promise<File> => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = objectUrl;
    });

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    if (targetWidth * targetHeight > MAX_TOTAL_PIXELS) {
        URL.revokeObjectURL(objectUrl);
        return upscaleImageTiled(img, scale, originalName);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    if (scale >= PROCESSING_THRESHOLDS.DEFAULT_SCALE_FACTOR) {
        await applySmartSharpening(canvas, ctx, scale);
    }

    URL.revokeObjectURL(objectUrl);

    const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, MIME_TYPE_MAP.webp, 0.9);
    });

    if (!blob) throw new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED);

    const extension = originalName.split('.').pop() || 'png';
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-enhanced-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: MIME_TYPE_MAP.webp });
};


/**
 * Upscales image with AI
 * @param {File} imageFile - Image file to upscale
 * @param {number} scale - Scale factor
 * @param {string} originalName - Original file name
 * @returns {Promise<File>} Upscaled image file
 */
export const upscaleImageWithAI = async (imageFile: File, scale: number, originalName: string): Promise<File> => {
    if (aiUpscalingDisabled) {
        return upscaleImageEnhancedFallback(imageFile, scale, originalName);
    }

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(); // Fix: Void params
            img.src = objectUrl;
        });

        const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);

        if (safeDimensions.wasAdjusted || safeDimensions.width > MAX_SAFE_DIMENSION || safeDimensions.height > MAX_SAFE_DIMENSION) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        }

        const availableScales = AVAILABLE_UPSCALE_FACTORS;
        const maxScaleFactor = Math.max(...AVAILABLE_UPSCALE_FACTORS);
        if (!availableScales.includes(scale as any) || scale > maxScaleFactor) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, Math.min(scale, 4), originalName);
        }

        let upscaler;
        try {
            upscaler = await loadUpscalerForScale(scale as any);
        } catch {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        let upscaleResult;
        try {
            upscaleResult = await safeUpscale(upscaler, img, scale);
        } catch {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        let canvas: HTMLCanvasElement;
        if (upscaleResult instanceof HTMLCanvasElement) {
            canvas = upscaleResult;
        } else if (upscaleResult.tensor) {
            canvas = await tensorToCanvas(upscaleResult.tensor);
        } else if (upscaleResult.src) {
            canvas = await dataURLToCanvas(upscaleResult.src);
        } else if (typeof upscaleResult === 'string') {
            canvas = await dataURLToCanvas(upscaleResult);
        } else {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        URL.revokeObjectURL(objectUrl);

        const blob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, MIME_TYPE_MAP.webp, 0.9);
        });

        if (!blob) throw new Error(ERROR_MESSAGES.UPSCALING_FAILED);

        const extension = originalName.split('.').pop() || 'png';
        const newName = originalName.replace(
            /\.[^/.]+$/,
            `-ai-upscaled-${scale}x.${extension}`
        );

        const upscaledFile = new File([blob], newName, { type: MIME_TYPE_MAP.webp });
        textureManagerFailures = Math.max(0, textureManagerFailures - 1);
        cleanupInProgress = wasCleanupInProgress;
        return upscaledFile;

    } catch {
        textureManagerFailures++;
        if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
        cleanupInProgress = wasCleanupInProgress;

        try {
            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(imageFile);

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = objectUrl;
            });

            const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);
            URL.revokeObjectURL(objectUrl);
            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        } catch {
            throw new Error('AI upscaling failed');
        }
    }
};


/**
 * Resizes image with AI upscaling
 * @param {File} imageFile - Image file
 * @param {number} targetDimension - Target dimension
 * @param {Object} options - Processing options
 * @returns {Promise<{ file: File, upscaled: boolean }>} Resized image file with status
 */
export const resizeImageWithAI = async (imageFile: File, targetDimension: number, _options?: any): Promise<{ file: File, upscaled: boolean }> => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
        };
        img.src = objectUrl;
    });

    let newWidth, newHeight;
    if (img.naturalWidth >= img.naturalHeight) {
        newWidth = targetDimension;
        newHeight = Math.round((img.naturalHeight / img.naturalWidth) * targetDimension);
    } else {
        newHeight = targetDimension;
        newWidth = Math.round((img.naturalWidth / img.naturalHeight) * targetDimension);
    }

    const needsUpscaling = newWidth > img.naturalWidth || newHeight > img.naturalHeight;
    let sourceFile = imageFile;
    let wasUpscaled = false;

    if (needsUpscaling) {
        const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, newWidth, newHeight);
        if (upscaleFactor > 1) {
            sourceFile = await upscaleImageWithAI(sourceFile, upscaleFactor, imageFile.name);
            wasUpscaled = true;
        }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    const finalImg = new Image();
    const finalObjectUrl = URL.createObjectURL(sourceFile);

    await new Promise<void>((resolve, reject) => {
        finalImg.onload = () => resolve();
        finalImg.onerror = () => {
            URL.revokeObjectURL(finalObjectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
        };
        finalImg.src = finalObjectUrl;
    });

    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.drawImage(finalImg, 0, 0, newWidth, newHeight);

    const resizedBlob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, MIME_TYPE_MAP.webp, DEFAULT_WEBP_QUALITY);
    });

    if (!resizedBlob) {
        URL.revokeObjectURL(finalObjectUrl);
        throw new Error(`Failed to create blob for resized image: ${imageFile.name}`);
    }

    URL.revokeObjectURL(finalObjectUrl);
    const processedFile = new File([resizedBlob], imageFile.name.replace(/\.[^/.]+$/, '.webp'), {
        type: MIME_TYPE_MAP.webp
    });

    return { file: processedFile, upscaled: wasUpscaled };
};

/**
 * Resizes image without AI
 * @param {File} imageFile - Image file
 * @param {number} targetDimension - Target dimension
 * @param {Object} options - Processing options
 * @returns {Promise<File>} Resized image file
 */
export const resizeImageStandard = async (imageFile: File, targetDimension: number, _options?: any): Promise<File> => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
        };
        img.src = objectUrl;
    });

    let newWidth, newHeight;
    if (img.naturalWidth >= img.naturalHeight) {
        newWidth = targetDimension;
        newHeight = Math.round((img.naturalHeight / img.naturalWidth) * targetDimension);
    } else {
        newHeight = targetDimension;
        newWidth = Math.round((img.naturalWidth / img.naturalHeight) * targetDimension);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    const resizedBlob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
    });

    if (!resizedBlob) throw new Error("Blob creation failed");

    const processedFile = new File([resizedBlob], imageFile.name.replace(/\.[^/.]+$/, '.webp'), {
        type: 'image/webp'
    });

    return processedFile;
};

/**
 * Cleans up resize processor resources
 */
export const cleanupResizeProcessor = (): void => {
    Object.keys(upscalerInstances).forEach(key => {
        const upscaler = upscalerInstances[key];
        if (upscaler && upscaler.dispose) {
            try { upscaler.dispose(); } catch { /* ignored */ }
        }
    });

    upscalerInstances = {};
    upscalerUsageCount = {};
    upscalerLastUsed = {};
    aiUpscalingDisabled = false;
    textureManagerFailures = 0;

    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }
};

/**
 * Checks if AI upscaling is disabled
 * @returns {boolean} True if AI upscaling is disabled
 */
export const isAIUpscalingDisabled = (): boolean => {
    return aiUpscalingDisabled;
};
