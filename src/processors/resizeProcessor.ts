import {
    DEFAULT_WEBP_QUALITY,
    ERROR_MESSAGES,
    PROCESSING_THRESHOLDS,
    AVAILABLE_UPSCALE_FACTORS,
    MAX_TOTAL_PIXELS,
    MAX_SAFE_DIMENSION,
    TILE_SIZE,
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
    const [height, width, channels] = tensor.shape;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    const imageData = ctx.createImageData(width, height);
    const data = await tensor.data(); // Async fetch from GPU to prevent blocking main thread

    for (let i = 0; i < data.length; i += channels) {
        const pixelIndex = i / channels * 4;
        imageData.data[pixelIndex] = data[i];
        imageData.data[pixelIndex + 1] = data[i + 1];
        imageData.data[pixelIndex + 2] = data[i + 2];
        if (channels === 4) {
            imageData.data[pixelIndex + 3] = data[i + 3];
        } else {
            imageData.data[pixelIndex + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);

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


import { upscaleInWorker, preloadUpscalerInWorker } from '../utils/aiWorkerUtils';

/**
 * Preloads upscaler model for a specific scale
 * @param {number} scale - Scale factor
 * @returns {Promise<void>}
 */
export const preloadUpscalerModel = async (scale: number): Promise<void> => {
    try {
        await preloadUpscalerInWorker(scale);
    } catch {
        /* ignored */
    }
};


/**
 * Loads upscaler for specific scale
 * @param {number} scale - Scale factor
 * @returns {Promise<Object>} Upscaler instance/proxy
 */
export const loadUpscalerForScale = async (scale: number): Promise<any> => {
    if (scale === 8) {
        return createEnhancedFallbackUpscaler(scale);
    }

    // Now handled by worker, we return a proxy object
    return {
        isWorker: true,
        scale,
        upscale: async (img: HTMLImageElement) => {
            return upscaleInWorker(img, scale);
        }
    };
};

/**
 * Releases upscaler for specific scale
 * @param {number} scale - Scale factor
 */
export const releaseUpscalerForScale = (_scale: number): void => {
    // Worker handles its own memory/cleanup for now
};

/**
 * Safely upscales image
 * @param {Object} upscaler - Upscaler instance/proxy
 * @param {HTMLImageElement} img - Image element
 * @param {number} scale - Scale factor
 * @returns {Promise<Object>} Upscale result
 */
export const safeUpscale = async (upscaler: any, img: HTMLImageElement, scale: number): Promise<any> => {
    if (upscaler.isWorker) {
        return upscaleInWorker(img, scale);
    }

    // Fallback for non-worker upscalers (like enhanced fallback)
    return upscaler.upscale(img);
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
export const upscaleImageWithAI = async (imageFile: File, scale: number, originalName: string): Promise<{ file: File; scale?: number; model?: string }> => {
    if (aiUpscalingDisabled) {
        const fallbackFile = await upscaleImageEnhancedFallback(imageFile, scale, originalName);
        return { file: fallbackFile, scale, model: 'enhanced-fallback' };
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
            const fallbackFile = await upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
            return { file: fallbackFile, scale: safeDimensions.scale, model: 'enhanced-fallback' };
        }

        const availableScales = AVAILABLE_UPSCALE_FACTORS;
        const maxScaleFactor = Math.max(...AVAILABLE_UPSCALE_FACTORS);
        if (!availableScales.includes(scale as any) || scale > maxScaleFactor) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            const fallbackFile = await upscaleImageEnhancedFallback(imageFile, Math.min(scale, 4), originalName);
            return { file: fallbackFile, scale: Math.min(scale, 4), model: 'enhanced-fallback' };
        }

        let upscaler;
        try {
            upscaler = await loadUpscalerForScale(scale as any);
        } catch {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            const fallbackFile = await upscaleImageEnhancedFallback(imageFile, scale, originalName);
            return { file: fallbackFile, scale, model: 'enhanced-fallback' };
        }

        let upscaleResult;
        try {
            upscaleResult = await safeUpscale(upscaler, img, scale);
        } catch {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            const fallbackFile = await upscaleImageEnhancedFallback(imageFile, scale, originalName);
            return { file: fallbackFile, scale, model: 'enhanced-fallback' };
        }

        let canvas: HTMLCanvasElement;

        if (upscaleResult.data && upscaleResult.shape) {
            // Handle worker result (Float32Array)
            canvas = document.createElement('canvas');
            const [height, width] = upscaleResult.shape;
            canvas.width = width;
            canvas.height = height;
            const tf = (window as any).tf;
            if (tf) {
                // Reconstruct tensor to use toPixels for high quality
                const tensor = tf.tensor(upscaleResult.data, [...upscaleResult.shape, 3], 'float32');
                await tf.browser.toPixels(tensor, canvas);
                tensor.dispose();
            } else {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const imageData = ctx.createImageData(width, height);
                    const data = upscaleResult.data;
                    // Note: This assumes data is already in 0-255 range
                    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
                        imageData.data[j] = data[i];
                        imageData.data[j + 1] = data[i + 1];
                        imageData.data[j + 2] = data[i + 2];
                        imageData.data[j + 3] = 255;
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
            }
        } else if (upscaleResult && typeof upscaleResult.data === 'function' && upscaleResult.shape) {
            const tensor = upscaleResult;
            canvas = document.createElement('canvas');
            const [height, width] = tensor.shape;
            canvas.width = width;
            canvas.height = height;
            await (window as any).tf.browser.toPixels(tensor, canvas);
            tensor.dispose();
        } else if (upscaleResult instanceof HTMLCanvasElement) {
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
            const fallbackFile = await upscaleImageEnhancedFallback(imageFile, scale, originalName);
            return { file: fallbackFile, scale, model: 'enhanced-fallback' };
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
        return { file: upscaledFile, scale, model: 'esrgan-slim' };

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
            const fallbackFile = await upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
            return { file: fallbackFile, scale: safeDimensions.scale, model: 'enhanced-fallback' };
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
 * @returns {Promise<File>} Resized image file
 */
export const resizeImageWithAI = async (imageFile: File, targetDimension: number, _options?: any): Promise<{ file: File; scale?: number }> => {
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
    let finalScale: number | undefined;

    if (needsUpscaling) {
        const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, newWidth, newHeight);
        if (upscaleFactor > 1) {
            const aiResult = await upscaleImageWithAI(sourceFile, upscaleFactor, imageFile.name);
            sourceFile = aiResult.file;
            finalScale = aiResult.scale;
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

    return { file: processedFile, scale: finalScale };
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
    aiUpscalingDisabled = false;
    textureManagerFailures = 0;
};

/**
 * Checks if AI upscaling is disabled
 * @returns {boolean} True if AI upscaling is disabled
 */
export const isAIUpscalingDisabled = (): boolean => {
    return aiUpscalingDisabled;
};
