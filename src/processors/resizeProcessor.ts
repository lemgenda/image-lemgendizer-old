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
    MIME_TYPE_MAP,
    AI_SETTINGS
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
const currentMemoryUsage = 0;
let memoryCleanupInterval: NodeJS.Timeout | null = null;
let aiUpscalingDisabled = false;
let textureManagerFailures = 0;
let cleanupInProgress = false;
let loadingPromise: Promise<void> | null = null;

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
 * Loads upscaler and required libraries from local path
 * @returns {Promise<void>}
 */
const loadUpscalerLibraries = (): Promise<void> => {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        if ((window as any).Upscaler && (window as any).tf) {
            return;
        }

        const loadScript = (src: string): Promise<void> => {
            return new Promise((res) => {
                // Check if script is already loaded
                if (document.querySelector(`script[src="${src}"]`)) {
                    res();
                    return;
                }

                const s = document.createElement('script');
                s.src = src;
                s.onload = () => res();
                s.onerror = () => {
                    console.warn(`[AI] Failed to load script: ${src}`);
                    res(); // Fail silently to try next steps or fallback
                };
                document.head.appendChild(s);
            });
        };

        if (!(window as any).tf) {
            await loadScript(`${AI_SETTINGS.LOCAL_LIB_PATH}tf.min.js`);
        }
        // Load WebGPU backend
        await loadScript(`${AI_SETTINGS.LOCAL_LIB_PATH}tf-backend-webgpu.min.js`);

        try {
            // Check if WebGPU is already active to avoid redundant registration logs
            const currentBackend = (window as any).tf?.getBackend();
            if (currentBackend !== 'webgpu') {
                // Attempt to use WebGPU
                await (window as any).tf.setBackend('webgpu');
                await (window as any).tf.ready();
                await (window as any).tf.ready();
            } else {
                await (window as any).tf.ready();
            }
        } catch (e) {
            console.warn('[AI] WebGPU initialization failed, falling back to default:', e);
            // Fallback will likely vary (webgl is usually default if webgpu fails or isn't set)
            try {
                await (window as any).tf.setBackend('webgl');
                await (window as any).tf.ready();
            } catch (err) {
                console.warn('[AI] WebGL fallback also failed:', err);
            }
        }

        if (!(window as any).Upscaler) {
            await loadScript(`${AI_SETTINGS.LOCAL_LIB_PATH}upscaler.min.js`);
        }
    })();

    return loadingPromise;
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
 * Preloads upscaler model for a specific scale
 * @param {number} scale - Scale factor
 * @returns {Promise<void>}
 */
export const preloadUpscalerModel = async (scale: number): Promise<void> => {
    try {
        await loadUpscalerForScale(scale);
    } catch (err) {
        console.warn(`[AI] Failed to preload upscaler x${scale}:`, err);
    }
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
        if (!(window as any).Upscaler) await loadUpscalerLibraries();

        const modelPath = `${AI_SETTINGS.LOCAL_MODEL_PATH}esrgan-slim/x${scale}/model.json`;

        const upscaler = new (window as any).Upscaler({
            model: {
                path: modelPath,
                scale: scale
            },
        });

        // Warmup the model with a tiny tensor if possible
        // Note: upscalerjs doesn't expose the internal tf directly easily here
        // but we can at least ensure instance is created.

        upscalerInstances[scale] = upscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return upscaler;

    } catch (err) {
        console.warn(`[AI] Failed to load local model for x${scale}, falling back:`, err);
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
                patchSize: 32,
                padding: 2,
                output: 'tensor' // Force tensor output to avoid readSync warning on WebGPU
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

        // Handle Tensor output (preferred for WebGPU performance)
        // Check if it looks like a tensor (has shape and data methods/properties)
        if (upscaleResult && typeof upscaleResult.data === 'function' && upscaleResult.shape) {
            const tensor = upscaleResult; // It's a raw tensor
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
