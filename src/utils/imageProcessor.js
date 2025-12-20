// ============================================
// IMAGE PROCESSOR - Complete Fixed Implementation
// ============================================

// ============================================
// SECTION 1: MEMORY MANAGEMENT CONSTANTS
// ============================================

// WebGL texture size limits
const MAX_TEXTURE_SIZE = 16384; // Standard WebGL limit
const MAX_SAFE_DIMENSION = 4096; // Conservative limit to avoid memory issues
const MAX_TOTAL_PIXELS = 4000000; // 4MP limit for AI processing

// GPU memory management
let aiModel = null;
let aiModelLoading = false;
let upscalerInstances = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval = null;
let aiUpscalingDisabled = false;
let textureManagerFailures = 0;
const MAX_TEXTURE_FAILURES = 3;

// Track which upscaler instances are in use and when they were last used
let upscalerUsageCount = {};
let upscalerLastUsed = {};
let cleanupInProgress = false;

/**
 * Initialize GPU memory monitoring
 */
const initializeGPUMemoryMonitor = () => {
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
    }

    // Check less frequently and be less aggressive
    memoryCleanupInterval = setInterval(monitorGPUMemory, 10000); // 10 seconds
};

/**
 * Monitor GPU memory usage
 */
const monitorGPUMemory = () => {
    if (cleanupInProgress) {
        return; // Don't start a new cleanup while one is in progress
    }

    if (window.tf && tf.memory()) {
        const memoryInfo = tf.memory();
        currentMemoryUsage = (memoryInfo.numBytesInGPU || 0) / (1024 * 1024); // MB

        // Only clean up if memory is VERY high and no models are in use
        const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);

        if (currentMemoryUsage > 3000 && !upscalersInUse) { // 3GB threshold
            console.warn(`Very high GPU memory usage: ${currentMemoryUsage.toFixed(2)} MB, cleaning up...`);
            safeCleanupGPUMemory();
        }
    }
};

/**
 * Safe GPU memory cleanup that doesn't dispose models that are in use
 */
const safeCleanupGPUMemory = () => {
    if (cleanupInProgress) return;

    cleanupInProgress = true;

    try {
        console.log('Performing safe GPU memory cleanup...');

        if (window.tf) {
            // Only clean up if no upscalers are currently in use
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);

            if (!upscalersInUse) {
                // Dispose of unused upscaler instances (not used in last 30 seconds)
                const now = Date.now();
                Object.keys(upscalerInstances).forEach(key => {
                    if (upscalerUsageCount[key] === 0 &&
                        (!upscalerLastUsed[key] || (now - upscalerLastUsed[key] > 30000))) {
                        const upscaler = upscalerInstances[key];
                        if (upscaler && upscaler.dispose) {
                            try {
                                upscaler.dispose();
                                console.log(`Disposed unused upscaler ${key}x`);
                            } catch (e) {
                                console.warn(`Error disposing upscaler ${key}:`, e);
                            }
                        }
                        delete upscalerInstances[key];
                        delete upscalerUsageCount[key];
                        delete upscalerLastUsed[key];
                    }
                });

                // Run garbage collection on unused tensors only
                window.tf.disposeVariables();
                window.tf.engine().startScope();
                window.tf.engine().endScope();
            } else {
                console.log('Skipping GPU cleanup - upscalers are in use');
            }
        }

        currentMemoryUsage = 0;

    } catch (error) {
        console.warn('Error during safe GPU cleanup:', error);
    } finally {
        cleanupInProgress = false;
    }
};

/**
 * Aggressive cleanup - ONLY CALL THIS MANUALLY WHEN NEEDED
 */
const cleanupGPUMemory = () => {
    if (cleanupInProgress) return;

    cleanupInProgress = true;

    console.log('Performing aggressive GPU memory cleanup...');

    try {
        if (window.tf) {
            // First, check if any operations are in progress
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);

            if (upscalersInUse) {
                console.warn('Cannot perform aggressive cleanup - models are in use');
                cleanupInProgress = false;
                return;
            }

            // Force dispose of all models
            if (aiModel && aiModel.dispose) {
                aiModel.dispose();
                aiModel = null;
                console.log('Disposed AI model');
            }

            // Dispose of all upscaler instances
            Object.keys(upscalerInstances).forEach(key => {
                const upscaler = upscalerInstances[key];
                if (upscaler && upscaler.dispose) {
                    try {
                        upscaler.dispose();
                        console.log(`Disposed upscaler ${key}x`);
                    } catch (e) {
                        console.warn(`Error disposing upscaler ${key}:`, e);
                    }
                }
            });

            // Clear all caches
            upscalerInstances = {};
            upscalerUsageCount = {};
            upscalerLastUsed = {};

            // Force garbage collection
            window.tf.disposeVariables();
            window.tf.engine().startScope();
            window.tf.engine().endScope();

            // Clear TF.js cache
            if (window.tf.ENV) {
                window.tf.ENV.reset();
            }
        }

        currentMemoryUsage = 0;

        // Reset failure counters since we cleaned everything
        aiUpscalingDisabled = false;
        textureManagerFailures = 0;

    } catch (error) {
        console.warn('Error during aggressive GPU cleanup:', error);
    } finally {
        cleanupInProgress = false;
    }
};

// Initialize memory monitoring
if (typeof window !== 'undefined') {
    window.addEventListener('load', initializeGPUMemoryMonitor);
}

// ============================================
// SECTION 2: CORE IMAGE PROCESSING FUNCTIONS
// ============================================

/**
 * LemGendary Resize: Smart resize maintaining aspect ratio
 */
export const processLemGendaryResize = async (images, dimension, options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);
            let processedFile;

            if (imageFile.type === 'image/svg+xml') {
                processedFile = await processSVGResize(imageFile, dimension);
            } else {
                const img = new Image();
                const objectUrl = URL.createObjectURL(imageFile);

                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve();
                    };
                    img.onerror = (error) => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error(`Failed to load image: ${image.name}`));
                    };
                    img.src = objectUrl;
                });

                let newWidth, newHeight;
                if (img.naturalWidth >= img.naturalHeight) {
                    newWidth = dimension;
                    newHeight = Math.round((img.naturalHeight / img.naturalWidth) * dimension);
                } else {
                    newHeight = dimension;
                    newWidth = Math.round((img.naturalWidth / img.naturalHeight) * dimension);
                }

                const needsUpscaling = newWidth > img.naturalWidth || newHeight > img.naturalHeight;
                let sourceFile = imageFile;

                if (needsUpscaling) {
                    const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, newWidth, newHeight);
                    sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, image.name);
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const finalImg = new Image();
                const finalObjectUrl = URL.createObjectURL(sourceFile);

                await new Promise((resolve, reject) => {
                    finalImg.onload = resolve;
                    finalImg.onerror = () => {
                        URL.revokeObjectURL(finalObjectUrl);
                        reject(new Error(`Failed to load final image: ${image.name}`));
                    };
                    finalImg.src = finalObjectUrl;
                });

                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.drawImage(finalImg, 0, 0, newWidth, newHeight);

                const resizedBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/webp', 0.85);
                });

                URL.revokeObjectURL(finalObjectUrl);
                processedFile = new File([resizedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), {
                    type: 'image/webp'
                });
            }

            const optimizedFile = await optimizeForWeb(processedFile, options.quality, options.format);

            results.push({
                original: { ...image, file: imageFile },
                resized: optimizedFile,
                dimensions: { width: dimension, height: dimension },
                isSVG: imageFile.type === 'image/svg+xml',
                optimized: true
            });

        } catch (error) {
            console.error(`Error resizing ${image.name}:`, error);
            results.push({
                original: image,
                resized: image.file instanceof File ? image.file : null,
                dimensions: { width: dimension, height: dimension },
                isSVG: image.file?.type === 'image/svg+xml',
                optimized: false,
                error: error.message
            });
        }
    }

    return results;
};

/**
 * LemGendary Crop: Resizes image to cover dimensions, then crops from position
 */
export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);
            let croppedFile;

            if (imageFile.type === 'image/svg+xml') {
                const img = new Image();
                const svgUrl = URL.createObjectURL(imageFile);

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = svgUrl;
                });

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const scale = Math.max(width / img.width, height / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;

                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = scaledWidth;
                tempCanvas.height = scaledHeight;
                tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

                const cropCanvas = document.createElement('canvas');
                const cropCtx = cropCanvas.getContext('2d');
                cropCanvas.width = width;
                cropCanvas.height = height;

                const { offsetX, offsetY } = calculateCropOffset(scaledWidth, scaledHeight, width, height, cropPosition);

                cropCtx.drawImage(
                    tempCanvas,
                    offsetX, offsetY, width, height,
                    0, 0, width, height
                );

                const croppedBlob = await new Promise(resolve => {
                    cropCanvas.toBlob(resolve, 'image/png', 0.85);
                });

                croppedFile = new File([croppedBlob], image.name.replace(/\.svg$/i, '.png'), {
                    type: 'image/png'
                });

                URL.revokeObjectURL(svgUrl);

            } else {
                const img = new Image();
                const objectUrl = URL.createObjectURL(imageFile);

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Failed to load image'));
                    };
                    img.src = objectUrl;
                });

                const needsUpscaling = width > img.naturalWidth || height > img.naturalHeight;
                let sourceFile = imageFile;

                if (needsUpscaling) {
                    const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, width, height);
                    sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, image.name);
                }

                URL.revokeObjectURL(objectUrl);

                const resized = await resizeImageForCrop(sourceFile, width, height);
                croppedFile = await cropFromResized(resized, width, height, cropPosition, imageFile);
            }

            const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedFile,
                dimensions: { width, height },
                isSVG: imageFile.type === 'image/svg+xml',
                optimized: true
            });

        } catch (error) {
            console.error(`Error cropping ${image.name}:`, error);
            results.push({
                original: image,
                cropped: image.file instanceof File ? image.file : null,
                dimensions: { width, height },
                isSVG: image.file?.type === 'image/svg+xml',
                optimized: false,
                error: error.message
            });
        }
    }

    return results;
};

// ============================================
// SECTION 3: AI PROCESSING FUNCTIONS
// ============================================

/**
 * Load AI model for smart cropping with fallback
 */
export const loadAIModel = async () => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        if (!window.tf) {
            await loadTensorFlowFromCDN();
        }

        if (!window.tf) {
            throw new Error('TensorFlow.js not available');
        }

        if (!window.cocoSsd) {
            await loadCocoSsdFromCDN();
        }

        if (window.cocoSsd) {
            aiModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
            console.log('AI model loaded successfully from CDN');
        } else {
            throw new Error('COCO-SSD not available');
        }

        aiModelLoading = false;
        return aiModel;
    } catch (error) {
        console.warn('AI model loading failed, using fallback:', error);
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        console.log('Using simple AI fallback model');
        return aiModel;
    }
};

/**
 * Load TensorFlow.js from CDN
 */
const loadTensorFlowFromCDN = () => {
    return new Promise((resolve, reject) => {
        if (window.tf) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
        script.onload = () => {
            console.log('TensorFlow.js loaded from CDN');
            resolve();
        };
        script.onerror = () => {
            console.warn('Failed to load TensorFlow.js from CDN');
            resolve();
        };
        document.head.appendChild(script);
    });
};

/**
 * Load COCO-SSD from CDN
 */
const loadCocoSsdFromCDN = () => {
    return new Promise((resolve, reject) => {
        if (window.cocoSsd) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
        script.onload = () => {
            console.log('COCO-SSD loaded from CDN');
            resolve();
        };
        script.onerror = () => {
            console.warn('Failed to load COCO-SSD from CDN');
            resolve();
        };
        document.head.appendChild(script);
    });
};

/**
 * Create a simple AI model fallback
 */
const createSimpleAIModel = () => {
    return {
        detect: async (imgElement) => {
            console.log('Using simple AI fallback detection');
            const width = imgElement.naturalWidth || imgElement.width;
            const height = imgElement.naturalHeight || imgElement.height;

            return [{
                bbox: [width * 0.25, height * 0.25, width * 0.5, height * 0.5],
                class: 'person',
                score: 0.8
            }];
        }
    };
};

/**
 * Load UpscalerJS model via CDN with protection against cleanup
 */
const loadUpscalerForScale = async (scale) => {
    // Check if we already have a valid instance that wasn't disposed
    if (upscalerInstances[scale] && upscalerUsageCount[scale] !== undefined) {
        upscalerUsageCount[scale]++;
        upscalerLastUsed[scale] = Date.now();
        console.log(`Reusing existing ${scale}x upscaler instance`);
        return upscalerInstances[scale];
    }

    console.log(`Loading UpscalerJS model for ${scale}x scaling...`);

    // Prevent cleanup while loading
    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        // For 8x: browser doesn't support it well, use enhanced fallback
        if (scale === 8) {
            console.warn('8x model not well supported in browser, using enhanced fallback');
            const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
            upscalerInstances[scale] = fallbackUpscaler;
            upscalerUsageCount[scale] = 1;
            upscalerLastUsed[scale] = Date.now();
            cleanupInProgress = wasCleanupInProgress;
            return fallbackUpscaler;
        }

        // Load UpscalerJS library
        if (!window.Upscaler) {
            await loadUpscalerFromCDN();
        }

        // Load the specific model based on scale
        let modelGlobalName;
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

        if (!window[modelGlobalName]) {
            throw new Error(`Model ${modelGlobalName} not loaded`);
        }

        // Create upscaler instance with error handling
        let upscaler;
        try {
            upscaler = new window.Upscaler({
                model: window[modelGlobalName],
            });
        } catch (createError) {
            console.warn(`Failed to create upscaler instance for ${scale}x:`, createError);
            throw createError;
        }

        upscalerInstances[scale] = upscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        console.log(`UpscalerJS ${scale}x model loaded successfully`);

        cleanupInProgress = wasCleanupInProgress;
        return upscaler;

    } catch (error) {
        console.warn(`Failed to load UpscalerJS ${scale}x model:`, error);
        const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return fallbackUpscaler;
    }
};

/**
 * Load UpscalerJS library from CDN
 */
const loadUpscalerFromCDN = () => {
    return new Promise((resolve, reject) => {
        if (window.Upscaler) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/upscaler@latest/dist/browser/umd/upscaler.min.js';
        script.onload = () => {
            console.log('UpscalerJS library loaded from CDN');
            resolve();
        };
        script.onerror = () => {
            console.warn('Failed to load UpscalerJS library from CDN');
            resolve();
        };
        document.head.appendChild(script);
    });
};

/**
 * Load specific UpscalerJS model script
 */
const loadUpscalerModelScript = (src) => {
    return new Promise((resolve, reject) => {
        const scriptId = `upscaler-model-${src.split('/').pop()}`;
        if (document.getElementById(scriptId)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = src;
        script.onload = () => {
            console.log(`UpscalerJS model loaded: ${src}`);
            resolve();
        };
        script.onerror = () => {
            console.warn(`Failed to load UpscalerJS model: ${src}`);
            reject(new Error(`Failed to load model: ${src}`));
        };
        document.head.appendChild(script);
    });
};

/**
 * Release an upscaler instance when done with it
 */
const releaseUpscalerForScale = (scale) => {
    if (upscalerUsageCount[scale]) {
        upscalerUsageCount[scale]--;
        upscalerLastUsed[scale] = Date.now();

        // If no one is using this upscaler and we need memory, clean it up
        if (upscalerUsageCount[scale] <= 0 && currentMemoryUsage > 1000) {
            setTimeout(() => {
                if (upscalerUsageCount[scale] <= 0) {
                    const upscaler = upscalerInstances[scale];
                    if (upscaler && upscaler.dispose) {
                        try {
                            upscaler.dispose();
                        } catch (e) {
                            console.warn(`Error disposing released upscaler ${scale}x:`, e);
                        }
                    }
                    delete upscalerInstances[scale];
                    delete upscalerUsageCount[scale];
                    delete upscalerLastUsed[scale];
                }
            }, 1000); // Wait 1 second before cleaning up
        }
    }
};

/**
 * Safe upscale with proper resource management
 */
const safeUpscale = async (upscaler, img, scale) => {
    // Mark this upscaler as in use
    if (upscalerUsageCount[scale]) {
        upscalerUsageCount[scale]++;
    }

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            // Release the upscaler on timeout
            releaseUpscalerForScale(scale);
            reject(new Error('Upscaling timeout'));
        }, 45000);

        try {
            upscaler.upscale(img, {
                patchSize: 32,
                padding: 2
            }).then((result) => {
                clearTimeout(timeoutId);
                // Update last used time
                upscalerLastUsed[scale] = Date.now();
                // Release the upscaler when done
                releaseUpscalerForScale(scale);
                resolve(result);
            }).catch((error) => {
                clearTimeout(timeoutId);
                // Release the upscaler on error
                releaseUpscalerForScale(scale);
                reject(error);
            });
        } catch (error) {
            clearTimeout(timeoutId);
            // Release the upscaler on error
            releaseUpscalerForScale(scale);
            reject(error);
        }
    });
};

/**
 * Create enhanced fallback upscaler
 */
const createEnhancedFallbackUpscaler = (scale) => {
    return {
        scale,
        upscale: async (imageElement) => {
            console.log(`Using enhanced fallback upscaler for ${scale}x scaling`);

            // Calculate safe dimensions
            const safeDimensions = calculateSafeDimensions(
                imageElement.naturalWidth,
                imageElement.naturalHeight,
                scale
            );

            const canvas = document.createElement('canvas');
            canvas.width = safeDimensions.width;
            canvas.height = safeDimensions.height;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

            // Apply smart sharpening for better results
            if (safeDimensions.scale >= 2) {
                applySmartSharpening(canvas, ctx, safeDimensions.scale);
            }

            return canvas;
        }
    };
};

/**
 * Apply smart sharpening to canvas while preserving color
 */
const applySmartSharpening = (canvas, ctx, scale) => {
    try {
        const width = canvas.width;
        const height = canvas.height;

        if (width * height > 4000000) {
            console.log('Image too large for sharpening, skipping');
            return;
        }

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Create a copy for reading
        const originalData = new Uint8ClampedArray(data);

        // Simple sharpening filter - apply to each channel separately
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                // Get surrounding pixels for each channel
                for (let channel = 0; channel < 3; channel++) { // Only RGB, not Alpha
                    const channelIdx = idx + channel;

                    const top = originalData[channelIdx - width * 4];
                    const bottom = originalData[channelIdx + width * 4];
                    const left = originalData[channelIdx - 4];
                    const right = originalData[channelIdx + 4];
                    const center = originalData[channelIdx];

                    // Apply simple sharpening to each channel independently
                    const sharpened = Math.min(255, Math.max(0,
                        center * 1.5 - (top + bottom + left + right) * 0.125
                    ));

                    data[channelIdx] = sharpened;
                }
                // Alpha channel (idx + 3) remains unchanged
            }
        }

        ctx.putImageData(imageData, 0, 0);
    } catch (error) {
        console.warn('Sharpening failed:', error);
    }
};

/**
 * Calculate safe dimensions for upscaling
 */
const calculateSafeDimensions = (originalWidth, originalHeight, scale) => {
    let targetWidth = Math.round(originalWidth * scale);
    let targetHeight = Math.round(originalHeight * scale);

    // Check if dimensions exceed WebGL limits
    if (targetWidth > MAX_TEXTURE_SIZE || targetHeight > MAX_TEXTURE_SIZE) {
        console.warn(`Target dimensions ${targetWidth}x${targetHeight} exceed WebGL limits, adjusting...`);

        // Calculate maximum safe scale
        const maxWidthScale = MAX_SAFE_DIMENSION / originalWidth;
        const maxHeightScale = MAX_SAFE_DIMENSION / originalHeight;
        const safeScale = Math.min(maxWidthScale, maxHeightScale, scale);

        targetWidth = Math.round(originalWidth * safeScale);
        targetHeight = Math.round(originalHeight * safeScale);

        console.log(`Adjusted scale from ${scale}x to ${safeScale.toFixed(2)}x`);
        return { width: targetWidth, height: targetHeight, scale: safeScale, wasAdjusted: true };
    }

    // Check if total pixels exceed safe limit
    const totalPixels = targetWidth * targetHeight;
    if (totalPixels > MAX_TOTAL_PIXELS) {
        console.warn(`Target pixels ${totalPixels} exceed safe limit, adjusting...`);

        // Calculate safe scale based on pixel limit
        const safeScale = Math.sqrt(MAX_TOTAL_PIXELS / (originalWidth * originalHeight));
        targetWidth = Math.round(originalWidth * safeScale);
        targetHeight = Math.round(originalHeight * safeScale);

        console.log(`Adjusted scale from ${scale}x to ${safeScale.toFixed(2)}x (pixel limit)`);
        return { width: targetWidth, height: targetHeight, scale: safeScale, wasAdjusted: true };
    }

    return { width: targetWidth, height: targetHeight, scale: scale, wasAdjusted: false };
};

/**
 * Calculate upscale factor with safety limits
 */
const calculateUpscaleFactor = (originalWidth, originalHeight, targetWidth, targetHeight) => {
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;
    const requiredScale = Math.max(widthScale, heightScale);

    const availableScales = [2, 3, 4];

    // Find the smallest scale that meets requirements
    for (const scale of availableScales) {
        if (scale >= requiredScale) {
            // Check if this scale would exceed limits
            const safeDimensions = calculateSafeDimensions(
                originalWidth,
                originalHeight,
                scale
            );

            if (!safeDimensions.wasAdjusted) {
                console.log(`Using AI scale ${scale}x for required ${requiredScale.toFixed(2)}x`);
                return scale;
            } else {
                console.log(`Scale ${scale}x would exceed limits, trying lower scale`);
            }
        }
    }

    // If no AI scale works, use enhanced fallback
    if (requiredScale > 1) {
        console.log(`No safe AI scale found, using enhanced fallback for ${requiredScale.toFixed(2)}x`);
        return Math.min(requiredScale, 2); // Cap at 2x for fallback
    }

    return 1;
};

/**
 * Upscale image with AI - PREVENT CLEANUP DURING PROCESSING
 */
const upscaleImageWithAI = async (imageFile, scale, originalName) => {
    // If AI upscaling has been disabled due to failures, use fallback immediately
    if (aiUpscalingDisabled) {
        console.log('AI upscaling disabled due to previous failures, using fallback');
        return upscaleImageEnhancedFallback(imageFile, scale, originalName);
    }

    // Prevent cleanup during AI processing
    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        console.log(`Attempting AI upscaling at ${scale}x for ${originalName}`);

        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        console.log(`Original image size: ${img.naturalWidth}x${img.naturalHeight}`);

        // Calculate safe dimensions
        const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);

        // If dimensions exceed limits, use fallback immediately
        if (safeDimensions.wasAdjusted || safeDimensions.width > MAX_SAFE_DIMENSION || safeDimensions.height > MAX_SAFE_DIMENSION) {
            console.log('Image dimensions exceed safe limits, using enhanced fallback');
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        }

        // Check if scale is supported
        const availableScales = [2, 3, 4];
        if (!availableScales.includes(scale) || scale > 4) {
            console.warn(`Scale ${scale}x not supported, using enhanced fallback`);
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, Math.min(scale, 2), originalName);
        }

        // Try to load upscaler with error handling
        let upscaler;
        try {
            upscaler = await loadUpscalerForScale(scale);
        } catch (loadError) {
            console.warn('Failed to load upscaler:', loadError);
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) {
                aiUpscalingDisabled = true;
                console.error('Too many texture failures, disabling AI upscaling');
            }
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        // Upscale with error protection
        let upscaleResult;
        try {
            upscaleResult = await safeUpscale(upscaler, img, scale);
        } catch (upscaleError) {
            console.warn('AI upscaling failed with texture error:', upscaleError);
            textureManagerFailures++;

            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) {
                aiUpscalingDisabled = true;
                console.error('Too many texture failures, disabling AI upscaling completely');
            }

            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        // Handle different return types from UpscalerJS
        let canvas;
        if (upscaleResult instanceof HTMLCanvasElement) {
            canvas = upscaleResult;
        } else if (upscaleResult.tensor) {
            canvas = await tensorToCanvas(upscaleResult.tensor);
        } else if (upscaleResult.src) {
            canvas = await dataURLToCanvas(upscaleResult.src);
        } else if (typeof upscaleResult === 'string') {
            canvas = await dataURLToCanvas(upscaleResult);
        } else {
            console.warn('Unknown upscale result type, using fallback:', typeof upscaleResult);
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        console.log(`AI upscaled to: ${canvas.width}x${canvas.height}`);

        URL.revokeObjectURL(objectUrl);

        // Create blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/webp', 0.9);
        });

        if (!blob) {
            throw new Error('Failed to create blob from upscaled canvas');
        }

        const extension = originalName.split('.').pop();
        const newName = originalName.replace(
            /\.[^/.]+$/,
            `-ai-upscaled-${scale}x.${extension}`
        );

        const upscaledFile = new File([blob], newName, { type: 'image/webp' });

        console.log(`AI upscaling completed successfully: ${originalName} upscaled ${scale}x`);

        // Reset failure counter on success
        textureManagerFailures = Math.max(0, textureManagerFailures - 1);

        cleanupInProgress = wasCleanupInProgress;
        return upscaledFile;

    } catch (error) {
        console.warn('AI upscaling failed:', error);

        textureManagerFailures++;
        if (textureManagerFailures >= MAX_TEXTURE_FAILURES) {
            aiUpscalingDisabled = true;
            console.error('Too many failures, disabling AI upscaling');
        }

        cleanupInProgress = wasCleanupInProgress;

        // Use fallback
        try {
            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(imageFile);

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = objectUrl;
            });

            const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);
            URL.revokeObjectURL(objectUrl);

            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        } catch (fallbackError) {
            console.error('Even fallback failed:', fallbackError);
            throw error;
        }
    }
};

/**
 * Convert tensor to canvas
 */
const tensorToCanvas = async (tensor) => {
    return new Promise((resolve) => {
        // Convert tensor to data URL
        const [height, width, channels] = tensor.shape;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = tensor.dataSync();

        // Copy tensor data to image data
        for (let i = 0; i < data.length; i += channels) {
            const pixelIndex = i / channels * 4;
            imageData.data[pixelIndex] = data[i]; // R
            imageData.data[pixelIndex + 1] = data[i + 1]; // G
            imageData.data[pixelIndex + 2] = data[i + 2]; // B
            if (channels === 4) {
                imageData.data[pixelIndex + 3] = data[i + 3]; // A
            } else {
                imageData.data[pixelIndex + 3] = 255; // Full opacity
            }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas);

        // Dispose tensor
        if (tensor.dispose) {
            tensor.dispose();
        }
    });
};

/**
 * Convert data URL to canvas
 */
const dataURLToCanvas = (dataURL) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = dataURL;
    });
};

/**
 * Enhanced fallback upscaling with tiling for large images
 */
const upscaleImageEnhancedFallback = async (imageFile, scale, originalName) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    console.log(`Enhanced fallback upscaling: ${originalWidth}x${originalHeight} -> ${targetWidth}x${targetHeight}`);

    // Check if image is too large for single canvas
    if (targetWidth * targetHeight > 4000000) { // 4MP limit for single canvas
        console.log('Image too large for single canvas, using tiled upscaling');
        URL.revokeObjectURL(objectUrl);
        return upscaleImageTiled(img, scale, originalName);
    }

    // Use single canvas for smaller images
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Set high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw image with smoothing
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Apply smart sharpening
    if (scale >= 2) {
        applySmartSharpening(canvas, ctx, scale);
    }

    URL.revokeObjectURL(objectUrl);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-enhanced-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

/**
 * Tiled upscaling for very large images
 */
const upscaleImageTiled = async (img, scale, originalName, objectUrl) => {
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    // Create offscreen canvas for tiling
    const TILE_SIZE = 2048; // Process in 2048px tiles
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Calculate tiles
    const xTiles = Math.ceil(targetWidth / TILE_SIZE);
    const yTiles = Math.ceil(targetHeight / TILE_SIZE);

    console.log(`Processing ${xTiles}x${yTiles} tiles`);

    // Process each tile
    for (let y = 0; y < yTiles; y++) {
        for (let x = 0; x < xTiles; x++) {
            const tileX = x * TILE_SIZE;
            const tileY = y * TILE_SIZE;
            const tileWidth = Math.min(TILE_SIZE, targetWidth - tileX);
            const tileHeight = Math.min(TILE_SIZE, targetHeight - tileY);

            // Calculate source dimensions
            const srcX = tileX / scale;
            const srcY = tileY / scale;
            const srcWidth = tileWidth / scale;
            const srcHeight = tileHeight / scale;

            // Create temporary canvas for this tile
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileWidth;
            tempCanvas.height = tileHeight;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';

            // Draw tile from source image
            tempCtx.drawImage(
                img,
                srcX, srcY, srcWidth, srcHeight,
                0, 0, tileWidth, tileHeight
            );

            // Apply sharpening to tile
            applySmartSharpening(tempCanvas, tempCtx, scale);

            // Copy tile to main canvas
            ctx.drawImage(tempCanvas, tileX, tileY);
        }
    }

    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-tiled-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

/**
 * AI Smart Crop: Resizes first, detects main subject, crops intelligently
 */
export const processSmartCrop = async (imageFile, targetWidth, targetHeight, options = { quality: 0.85, format: 'webp' }) => {
    // Check if AI upscaling is disabled
    if (aiUpscalingDisabled) {
        console.log('AI upscaling disabled, using simple smart crop');
        return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }

    // Prevent cleanup during AI processing
    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        console.log('Starting AI smart crop with memory management...');

        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        // Check if image is too large for AI processing
        const totalPixels = img.naturalWidth * img.naturalHeight;
        if (totalPixels > MAX_TOTAL_PIXELS) {
            console.log(`Image too large for AI processing (${totalPixels} pixels), using simple smart crop`);
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
        }

        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = imageFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            if (upscaleFactor > 1) {
                sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, imageFile.name);
            }
        }

        URL.revokeObjectURL(objectUrl);

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);

        // Load AI model with timeout
        const modelPromise = loadAIModel();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI model loading timeout')), 10000)
        );

        const model = await Promise.race([modelPromise, timeoutPromise]);
        const loadedImg = await loadImage(resized.file);
        const predictions = await model.detect(loadedImg.element);
        const mainSubject = findMainSubject(predictions, loadedImg.width, loadedImg.height);

        let croppedFile;

        if (mainSubject) {
            console.log('Using AI-detected subject for cropping');
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile);
        } else {
            console.log('No AI subject detected, using focal point detection');
            const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
            const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
        }

        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

        console.log('AI smart crop completed successfully');
        cleanupInProgress = wasCleanupInProgress;
        return optimizedFile;

    } catch (error) {
        console.error('AI smart crop error:', error);

        // Disable AI upscaling if we get texture errors
        if (error.message.includes('texture') || error.message.includes('WebGL') || error.message.includes('in operator')) {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) {
                aiUpscalingDisabled = true;
                console.error('Too many texture errors, disabling AI upscaling');
            }
        }

        cleanupInProgress = wasCleanupInProgress;
        return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }
};

/**
 * Simple Smart Crop: Resizes first, uses basic edge detection
 */
export const processSimpleSmartCrop = async (imageFile, targetWidth, targetHeight, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = imageFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            if (upscaleFactor > 1) {
                sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, imageFile.name);
            }
        }

        URL.revokeObjectURL(objectUrl);

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);
        const loadedImg = await loadImage(resized.file);

        const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
        const adjustedPosition = adjustCropPositionForFocalPoint(cropPosition, focalPoint, loadedImg.width, loadedImg.height);
        const croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
        console.error('Simple smart crop error:', error);
        const cropResults = await processLemGendaryCrop(
            [{ file: imageFile, name: imageFile.name }],
            targetWidth,
            targetHeight,
            cropPosition,
            options
        );
        return cropResults[0]?.cropped || imageFile;
    }
};

/**
 * Find main subject from AI predictions
 */
const findMainSubject = (predictions, imgWidth, imgHeight) => {
    if (!predictions || predictions.length === 0) return null;

    const validPredictions = predictions.filter(pred =>
        pred.score > 0.3 &&
        !['book', 'cell phone', 'remote', 'keyboard', 'mouse'].includes(pred.class)
    );

    if (validPredictions.length === 0) return null;

    const scoredPredictions = validPredictions.map(pred => {
        const bbox = pred.bbox;
        const area = bbox[2] * bbox[3];
        const centerX = bbox[0] + bbox[2] / 2;
        const centerY = bbox[1] + bbox[3] / 2;

        const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - imgWidth / 2, 2) +
            Math.pow(centerY - imgHeight / 2, 2)
        );

        const sizeScore = area / (imgWidth * imgHeight);
        const confidenceScore = pred.score;
        const maxDistance = Math.sqrt(Math.pow(imgWidth / 2, 2) + Math.pow(imgHeight / 2, 2));
        const centralityScore = 1 - (distanceFromCenter / maxDistance);

        let classWeight = 1.0;
        if (['person', 'man', 'woman', 'boy', 'girl'].includes(pred.class)) classWeight = 1.5;
        if (pred.class.includes('face')) classWeight = 1.3;
        if (['dog', 'cat', 'bird'].includes(pred.class)) classWeight = 1.2;

        const score = (sizeScore * 0.4 + confidenceScore * 0.4 + centralityScore * 0.2) * classWeight;

        return {
            ...pred,
            score,
            bbox,
            area,
            centerX,
            centerY
        };
    });

    scoredPredictions.sort((a, b) => b.score - a.score);
    return scoredPredictions[0];
};

/**
 * Simple focal point detection without TensorFlow
 */
const detectFocalPointSimple = async (imgElement, width, height) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imgElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let totalX = 0, totalY = 0, count = 0;
    const edgeThreshold = 30;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            const lum = getLuminance(data, idx);
            const lumRight = getLuminance(data, idx + 4);
            const lumDown = getLuminance(data, idx + width * 4);

            const edgeStrength = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);

            if (edgeStrength > edgeThreshold) {
                totalX += x;
                totalY += y;
                count++;
            }
        }
    }

    if (count > 0) {
        return {
            x: Math.round(totalX / count),
            y: Math.round(totalY / count)
        };
    }

    return {
        x: Math.round(width / 2),
        y: Math.round(height / 2)
    };
};

/**
 * Adjust crop position based on focal point
 */
const adjustCropPositionForFocalPoint = (position, focalPoint, width, height) => {
    const THRESHOLD = 0.3;

    const centerX = width / 2;
    const centerY = height / 2;

    const dx = Math.abs(focalPoint.x - centerX) / centerX;
    const dy = Math.abs(focalPoint.y - centerY) / centerY;

    if (dx > THRESHOLD || dy > THRESHOLD) {
        const isLeft = focalPoint.x < centerX;
        const isRight = focalPoint.x > centerX;
        const isTop = focalPoint.y < centerY;
        const isBottom = focalPoint.y > centerY;

        if (isLeft && isTop) return 'top-left';
        if (isRight && isTop) return 'top-right';
        if (isLeft && isBottom) return 'bottom-left';
        if (isRight && isBottom) return 'bottom-right';
        if (isTop) return 'top';
        if (isBottom) return 'bottom';
        if (isLeft) return 'left';
        if (isRight) return 'right';
    }

    return position;
};

// ============================================
// SECTION 4: SVG PROCESSING FUNCTIONS
// ============================================

export const processSVGResize = async (svgFile, width, height) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const svgText = e.target.result;
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                const originalWidth = parseFloat(svgElement.getAttribute('width')) ||
                    svgElement.viewBox?.baseVal?.width || 100;
                const originalHeight = parseFloat(svgElement.getAttribute('height')) ||
                    svgElement.viewBox?.baseVal?.height || 100;

                const aspectRatio = originalWidth / originalHeight;

                let finalWidth = width;
                let finalHeight = height;

                if (width <= height) {
                    finalWidth = width;
                    finalHeight = Math.round(width / aspectRatio);
                } else {
                    finalHeight = height;
                    finalWidth = Math.round(height * aspectRatio);
                }

                svgElement.setAttribute('width', finalWidth.toString());
                svgElement.setAttribute('height', finalHeight.toString());

                if (!svgElement.hasAttribute('viewBox')) {
                    svgElement.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
                }

                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                const serializer = new XMLSerializer();
                const updatedSVG = serializer.serializeToString(svgElement);

                const blob = new Blob([updatedSVG], { type: 'image/svg+xml' });
                const fileName = svgFile.name.replace(/\.svg$/i, `-${finalWidth}x${finalHeight}.svg`);
                resolve(new File([blob], fileName, { type: 'image/svg+xml' }));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(svgFile);
    });
};

export const convertSVGToRaster = async (svgFile, width, height, format = 'png') => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                if (format === 'jpg' || format === 'jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                const imgAspectRatio = img.width / img.height;
                const targetAspectRatio = width / height;

                let drawWidth, drawHeight, drawX, drawY;

                if (imgAspectRatio > targetAspectRatio) {
                    drawWidth = width;
                    drawHeight = width / imgAspectRatio;
                    drawX = 0;
                    drawY = (height - drawHeight) / 2;
                } else {
                    drawHeight = height;
                    drawWidth = height * imgAspectRatio;
                    drawX = (width - drawWidth) / 2;
                    drawY = 0;
                }

                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

                let mimeType, extension;
                switch (format) {
                    case 'jpg':
                    case 'jpeg':
                        mimeType = 'image/jpeg';
                        extension = 'jpg';
                        break;
                    case 'png':
                        mimeType = 'image/png';
                        extension = 'png';
                        break;
                    case 'webp':
                        mimeType = 'image/webp';
                        extension = 'webp';
                        break;
                    default:
                        mimeType = 'image/png';
                        extension = 'png';
                }

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create blob'));
                            return;
                        }

                        const fileName = svgFile.name.replace(/\.svg$/i, `-${width}x${height}.${extension}`);
                        resolve(new File([blob], fileName, { type: mimeType }));
                    },
                    mimeType,
                    0.9
                );
            };

            img.onerror = reject;
            img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(svgFile);
    });
};

// ============================================
// SECTION 5: HELPER FUNCTIONS (Internal)
// ============================================

const resizeImageForCrop = async (imageFile, targetWidth, targetHeight) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
            const scaledWidth = Math.round(img.naturalWidth * scale);
            const scaledHeight = Math.round(img.naturalHeight * scale);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;

            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(url);

                    if (!blob) {
                        reject(new Error('Failed to create resized image'));
                        return;
                    }

                    resolve({
                        file: new File([blob], 'resized-temp.webp', { type: 'image/webp' }),
                        width: scaledWidth,
                        height: scaledHeight,
                        scale
                    });
                },
                'image/webp',
                0.85
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

const loadImage = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            resolve({
                element: img,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

const calculateCropOffset = (srcWidth, srcHeight, targetWidth, targetHeight, position) => {
    let offsetX, offsetY;

    switch (position) {
        case 'top-left':
            offsetX = 0;
            offsetY = 0;
            break;
        case 'top':
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = 0;
            break;
        case 'top-right':
            offsetX = srcWidth - targetWidth;
            offsetY = 0;
            break;
        case 'left':
            offsetX = 0;
            offsetY = Math.round((srcHeight - targetHeight) / 2);
            break;
        case 'right':
            offsetX = srcWidth - targetWidth;
            offsetY = Math.round((srcHeight - targetHeight) / 2);
            break;
        case 'bottom-left':
            offsetX = 0;
            offsetY = srcHeight - targetHeight;
            break;
        case 'bottom':
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = srcHeight - targetHeight;
            break;
        case 'bottom-right':
            offsetX = srcWidth - targetWidth;
            offsetY = srcHeight - targetHeight;
            break;
        case 'center':
        default:
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = Math.round((srcHeight - targetHeight) / 2);
    }

    offsetX = Math.max(0, Math.min(offsetX, srcWidth - targetWidth));
    offsetY = Math.max(0, Math.min(offsetY, srcHeight - targetHeight));

    return { offsetX, offsetY };
};

const cropFromResized = async (resized, targetWidth, targetHeight, position, originalFile) => {
    const img = await loadImage(resized.file);

    let offsetX, offsetY;

    if (typeof position === 'string') {
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, position);
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    }
    else if (position && position.bbox) {
        const bbox = position.bbox;
        const [x, y, width, height] = bbox;

        const subjectCenterX = x + width / 2;
        const subjectCenterY = y + height / 2;

        offsetX = subjectCenterX - targetWidth / 2;
        offsetY = subjectCenterY - targetHeight / 2;

        const margin = Math.min(50, width * 0.1, height * 0.1);

        if (x < margin) offsetX = Math.max(0, offsetX - (margin - x));
        if (x + width > resized.width - margin) offsetX = Math.min(offsetX, resized.width - targetWidth);
        if (y < margin) offsetY = Math.max(0, offsetY - (margin - y));
        if (y + height > resized.height - margin) offsetY = Math.min(offsetY, resized.height - targetHeight);
    }
    else if (position && position.x !== undefined && position.y !== undefined) {
        offsetX = position.x - targetWidth / 2;
        offsetY = position.y - targetHeight / 2;
    }
    else {
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, 'center');
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    }

    offsetX = Math.max(0, Math.min(offsetX, resized.width - targetWidth));
    offsetY = Math.max(0, Math.min(offsetY, resized.height - targetHeight));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(
        img.element,
        offsetX, offsetY, targetWidth, targetHeight,
        0, 0, targetWidth, targetHeight
    );

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalFile.name.split('.').pop();
    let suffix = '-cropped';

    if (typeof position === 'string' && position !== 'center') {
        suffix = `-${position}-crop`;
    } else if (position && position.bbox) {
        suffix = '-smart-crop';
    } else if (position && position.x !== undefined) {
        suffix = '-focal-crop';
    }

    const newName = originalFile.name.replace(
        /\.[^/.]+$/,
        `${suffix}-${targetWidth}x${targetHeight}.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

const getLuminance = (data, idx) => {
    if (idx < 0 || idx >= data.length) return 0;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
};

// ============================================
// SECTION 6: UTILITY FUNCTIONS (Exported)
// ============================================

export const imageToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const getImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight,
                orientation: img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait'
            });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);

        setTimeout(() => URL.revokeObjectURL(img.src), 1000);
    });
};

export const imageToBlob = (img, format = 'webp', quality = 0.85) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let mimeType;
        switch (format.toLowerCase()) {
            case 'jpg':
            case 'jpeg':
                mimeType = 'image/jpeg';
                break;
            case 'png':
                mimeType = 'image/png';
                break;
            case 'webp':
            default:
                mimeType = 'image/webp';
        }

        canvas.toBlob(resolve, mimeType, quality);
    });
};

export const createImageObjects = (files) => {
    return Array.from(files).map(file => {
        const fileObj = file instanceof File ? file : new File([file], file.name || 'image', { type: file.type });

        return {
            id: Date.now() + Math.random(),
            file: fileObj,
            name: fileObj.name,
            url: URL.createObjectURL(fileObj),
            size: fileObj.size,
            type: fileObj.type,
            optimized: false
        };
    });
};

export const cleanupBlobUrls = (imageObjects) => {
    imageObjects?.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
            } catch (e) {
                // Ignore errors
            }
        }
    });
};

export const ensureFileObject = async (image) => {
    if (image.file instanceof File || image.file instanceof Blob) {
        return image.file;
    }

    if (image.url && image.url.startsWith('blob:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            console.warn('Failed to fetch blob from URL:', error);
            throw new Error('Invalid image file');
        }
    }

    if (image.url && image.url.startsWith('data:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            console.warn('Failed to convert data URL to file:', error);
            throw new Error('Invalid image file');
        }
    }

    throw new Error('No valid file data found');
};

/**
 * Optimize for web with fixed transparency check
 */
export const optimizeForWeb = async (imageFile, quality = 0.8, format = 'webp') => {
    if (!(imageFile instanceof File) && !(imageFile instanceof Blob)) {
        throw new Error('Invalid image file provided to optimizeForWeb');
    }

    if (imageFile.type === 'image/svg+xml') {
        return convertSVGToRaster(imageFile, 1000, 1000, format);
    }

    // Check transparency BEFORE creating the promise
    const hasTransparency = await checkImageTransparency(imageFile);
    const needsWhiteBackground = (format === 'jpg' || format === 'jpeg') && hasTransparency;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d');

            if (needsWhiteBackground) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw the image - this preserves color channels
            ctx.drawImage(img, 0, 0);

            let mimeType, extension;
            switch (format.toLowerCase()) {
                case 'jpg':
                case 'jpeg':
                    mimeType = 'image/jpeg';
                    extension = 'jpg';
                    break;
                case 'png':
                    mimeType = 'image/png';
                    extension = 'png';
                    break;
                case 'webp':
                    mimeType = 'image/webp';
                    extension = 'webp';
                    break;
                default:
                    mimeType = 'image/webp';
                    extension = 'webp';
            }

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(objectUrl);

                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }

                    const originalName = imageFile.name || 'image';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newName = `${baseName}.${extension}`;
                    resolve(new File([blob], newName, { type: mimeType }));
                },
                mimeType,
                quality
            );
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            console.error('Image load error:', err);
            reject(new Error('Failed to load image'));
        };

        img.src = objectUrl;
    });
};

/**
 * Process template images - DISABLE CLEANUP DURING PROCESSING
 */
export const processTemplateImages = async (image, selectedTemplates, useSmartCrop = false, aiModelLoaded = false) => {
    const processedImages = [];
    const imageFile = await ensureFileObject(image);
    const isSVG = imageFile.type === 'image/svg+xml';
    const hasTransparency = isSVG ? false : await checkImageTransparency(imageFile);

    // Check image size before processing templates
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });

    URL.revokeObjectURL(objectUrl);

    const totalPixels = img.naturalWidth * img.naturalHeight;
    const isLargeImage = totalPixels > 4000000; // 4MP

    console.log(`Processing ${selectedTemplates.length} templates for ${image.name} (${img.naturalWidth}x${img.naturalHeight})`);

    // Group templates by similar dimensions to reduce AI upscaling calls
    const templatesByDimensions = {};
    selectedTemplates.forEach(template => {
        const key = template.height === 'auto' ?
            `auto_${template.width}` :
            `${template.width}x${template.height}`;

        if (!templatesByDimensions[key]) {
            templatesByDimensions[key] = [];
        }
        templatesByDimensions[key].push(template);
    });

    console.log(`Grouped into ${Object.keys(templatesByDimensions).length} dimension groups`);

    // Disable cleanup during template processing
    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        // Process each dimension group
        for (const [dimKey, templates] of Object.entries(templatesByDimensions)) {
            try {
                console.log(`Processing dimension group: ${dimKey}`);

                let processedFile = imageFile;
                const template = templates[0]; // Use first template's dimensions

                if (template.width && template.height) {
                    if (template.height === 'auto') {
                        // Simple resize for auto-height templates
                        const resizeResults = await processLemGendaryResize(
                            [{ ...image, file: imageFile }],
                            template.width
                        );
                        if (resizeResults.length > 0) {
                            processedFile = resizeResults[0].resized;
                        }
                    } else {
                        // Smart crop for fixed dimensions
                        if (useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled) {
                            try {
                                processedFile = await processSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height
                                );
                            } catch (error) {
                                console.warn('AI smart crop failed for template group, using simple smart crop:', error);
                                processedFile = await processSimpleSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height,
                                    'center'
                                );
                            }
                        } else {
                            // Use focal point detection for better cropping
                            try {
                                processedFile = await processSimpleSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height,
                                    'center'
                                );
                            } catch (error) {
                                console.warn('Smart crop failed, using basic crop:', error);
                                const cropResults = await processLemGendaryCrop(
                                    [{ ...image, file: imageFile }],
                                    template.width,
                                    template.height,
                                    'center'
                                );
                                if (cropResults.length > 0) {
                                    processedFile = cropResults[0].cropped;
                                }
                            }
                        }
                    }
                }

                // Create optimized versions for all templates in this group
                for (const template of templates) {
                    const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp');
                    const jpgPngFile = await optimizeForWeb(processedFile, 0.85, hasTransparency ? 'png' : 'jpg');

                    const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`;

                    // WebP version
                    const webpName = `${baseName}.webp`;
                    processedImages.push({
                        ...image,
                        file: webpFile,
                        name: webpName,
                        template: template,
                        format: 'webp',
                        processed: true,
                        aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                    });

                    // PNG/JPG version based on category
                    if (template.category === 'web' || template.category === 'logo') {
                        const pngName = `${baseName}.${hasTransparency ? 'png' : 'jpg'}`;
                        processedImages.push({
                            ...image,
                            file: jpgPngFile,
                            name: pngName,
                            template: template,
                            format: hasTransparency ? 'png' : 'jpg',
                            processed: true,
                            aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                        });
                    } else {
                        const jpgName = `${baseName}.jpg`;
                        const socialJpgFile = await optimizeForWeb(processedFile, 0.85, 'jpg');
                        processedImages.push({
                            ...image,
                            file: socialJpgFile,
                            name: jpgName,
                            template: template,
                            format: 'jpg',
                            processed: true,
                            aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                        });
                    }
                }

                // Don't clean up between dimension groups - wait until all processing is done
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (groupError) {
                console.error(`Error processing dimension group ${dimKey}:`, groupError);
                // Continue with other groups
            }
        }

    } finally {
        // Re-enable cleanup after all template processing is done
        cleanupInProgress = wasCleanupInProgress;

        // Now do a safe cleanup
        setTimeout(safeCleanupGPUMemory, 100);
    }

    return processedImages;
};

/**
 * Process custom images batch with memory leak fixes
 */
export const processCustomImagesBatch = async (selectedImages, processingOptions, aiModelLoaded = false) => {
    const processedImages = [];
    const formats = processingOptions.output.formats || ['webp'];

    // Clean up memory before starting batch
    safeCleanupGPUMemory();

    for (let i = 0; i < selectedImages.length; i++) {
        const image = selectedImages[i];

        try {
            let baseProcessedFile = await ensureFileObject(image);

            let resizeResult = null;
            let cropResult = null;

            if (processingOptions.showResize && processingOptions.resizeDimension) {
                const resizeDimension = parseInt(processingOptions.resizeDimension);
                if (resizeDimension > MAX_SAFE_DIMENSION) {
                    console.warn(`Resize dimension ${resizeDimension} exceeds safe limit, capping at ${MAX_SAFE_DIMENSION}`);
                    processingOptions.resizeDimension = String(MAX_SAFE_DIMENSION);
                }

                const resizeResults = await processLemGendaryResize(
                    [{ ...image, file: baseProcessedFile }],
                    parseInt(processingOptions.resizeDimension)
                );
                if (resizeResults.length > 0 && resizeResults[0].resized) {
                    resizeResult = resizeResults[0].resized;
                    baseProcessedFile = resizeResult;
                }

                // Clean up after resize
                safeCleanupGPUMemory();
            }

            if (processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight) {
                const cropWidth = parseInt(processingOptions.cropWidth);
                const cropHeight = parseInt(processingOptions.cropHeight);

                // Check if crop dimensions are reasonable
                if (cropWidth > MAX_SAFE_DIMENSION || cropHeight > MAX_SAFE_DIMENSION) {
                    console.warn(`Crop dimensions ${cropWidth}x${cropHeight} exceed safe limits, adjusting`);
                    throw new Error('Crop dimensions too large');
                }

                if (processingOptions.cropMode === 'smart' && aiModelLoaded && !aiUpscalingDisabled) {
                    try {
                        const smartCropFile = await processSmartCrop(
                            baseProcessedFile,
                            cropWidth,
                            cropHeight
                        );
                        cropResult = smartCropFile;
                        baseProcessedFile = smartCropFile;
                    } catch (aiError) {
                        console.warn('AI smart crop failed, using standard crop:', aiError);
                        const cropResults = await processLemGendaryCrop(
                            [{ ...image, file: baseProcessedFile }],
                            cropWidth,
                            cropHeight,
                            processingOptions.cropPosition
                        );
                        if (cropResults.length > 0 && cropResults[0].cropped) {
                            cropResult = cropResults[0].cropped;
                            baseProcessedFile = cropResult;
                        }
                    }
                } else {
                    const cropResults = await processLemGendaryCrop(
                        [{ ...image, file: baseProcessedFile }],
                        cropWidth,
                        cropHeight,
                        processingOptions.cropPosition
                    );
                    if (cropResults.length > 0 && cropResults[0].cropped) {
                        cropResult = cropResults[0].cropped;
                        baseProcessedFile = cropResult;
                    }
                }

                // Clean up after crop
                safeCleanupGPUMemory();
            }

            for (const format of formats) {
                let processedFile = baseProcessedFile;
                let finalName = image.name;

                const baseName = image.name.replace(/\.[^/.]+$/, '');
                let extension = '';

                if (processingOptions.output.rename && processingOptions.output.newFileName) {
                    const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;

                    if (format === 'original') {
                        extension = image.name.split('.').pop();
                        finalName = `${numberedName}.${extension}`;
                        processedFile = new File([await ensureFileObject(image)], finalName, {
                            type: image.type || processedFile.type
                        });
                    } else {
                        extension = format;
                        finalName = `${numberedName}.${extension}`;
                    }
                } else {
                    const suffix = getOperationSuffix(processingOptions);

                    if (format === 'original') {
                        extension = image.name.split('.').pop();
                        finalName = `${baseName}${suffix}.${extension}`;
                        processedFile = new File([await ensureFileObject(image)], finalName, {
                            type: image.type || processedFile.type
                        });
                    } else {
                        extension = format;
                        finalName = `${baseName}${suffix}.${extension}`;
                    }
                }

                if (format !== 'original') {
                    const hasTransparency = await checkImageTransparency(processedFile);
                    let targetFormat = format;

                    if (targetFormat === 'jpg' && hasTransparency) {
                        targetFormat = 'png';
                    }

                    processedFile = await optimizeForWeb(
                        processedFile,
                        processingOptions.compression.quality / 100,
                        targetFormat
                    );

                    if (targetFormat !== format) {
                        extension = targetFormat;
                        finalName = finalName.replace(`.${format}`, `.${targetFormat}`);
                    } else {
                        extension = targetFormat;
                        finalName = finalName.replace(/\.[^/.]+$/, '') + '.' + targetFormat;
                    }
                }

                if (processedFile.name !== finalName) {
                    processedFile = new File([processedFile], finalName, {
                        type: processedFile.type
                    });
                }

                processedImages.push({
                    ...image,
                    file: processedFile,
                    name: finalName,
                    url: URL.createObjectURL(processedFile),
                    processed: true,
                    format: format === 'original'
                        ? image.type?.split('/')[1] || 'webp'
                        : extension,
                    operations: {
                        resized: !!resizeResult,
                        cropped: !!cropResult,
                        aiUsed: processingOptions.cropMode === 'smart' && aiModelLoaded && !aiUpscalingDisabled && !!cropResult
                    }
                });
            }

        } catch (error) {
            console.error(`Error processing ${image.name}:`, error);

            // Try to process without AI if AI failed
            if (error.message.includes('AI') || error.message.includes('memory') || error.message.includes('texture')) {
                console.log('Attempting non-AI processing as fallback...');
                try {
                    // Process with standard crop instead
                    const cropResults = await processLemGendaryCrop(
                        [{ ...image, file: await ensureFileObject(image) }],
                        parseInt(processingOptions.cropWidth || 1000),
                        parseInt(processingOptions.cropHeight || 1000),
                        processingOptions.cropPosition || 'center'
                    );

                    if (cropResults.length > 0) {
                        for (const format of formats) {
                            const finalName = `${image.name.replace(/\.[^/.]+$/, '')}-fallback.${format}`;
                            processedImages.push({
                                ...image,
                                file: cropResults[0].cropped,
                                name: finalName,
                                url: URL.createObjectURL(cropResults[0].cropped),
                                processed: true,
                                format: format,
                                error: 'AI processing failed, used standard crop'
                            });
                        }
                        continue;
                    }
                } catch (fallbackError) {
                    console.error('Fallback also failed:', fallbackError);
                }
            }

            // If everything fails, add error entries
            for (const format of formats) {
                const baseName = image.name.replace(/\.[^/.]+$/, '');
                const suffix = getOperationSuffix(processingOptions);
                const extension = format === 'original' ? image.name.split('.').pop() : format;
                const finalName = `${baseName}${suffix}.${extension}`;

                processedImages.push({
                    ...image,
                    file: null,
                    name: finalName,
                    processed: false,
                    format: format,
                    error: error.message
                });
            }
        }

        // Clean up between images
        if (i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
            safeCleanupGPUMemory();
        }
    }

    // Final cleanup
    safeCleanupGPUMemory();

    return processedImages;
};

const getOperationSuffix = (processingOptions) => {
    const parts = [];

    if (processingOptions.showResize && processingOptions.resizeDimension) {
        parts.push(`resized-${processingOptions.resizeDimension}`);
    }

    if (processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight) {
        const cropType = processingOptions.cropMode === 'smart' ? 'smart-crop' : 'crop';
        parts.push(`${cropType}-${processingOptions.cropWidth}x${processingOptions.cropHeight}`);

        if (processingOptions.cropMode === 'standard' && processingOptions.cropPosition !== 'center') {
            parts.push(processingOptions.cropPosition);
        }
    }

    if (processingOptions.compression.quality < 100) {
        parts.push(`q${processingOptions.compression.quality}`);
    }

    return parts.length > 0 ? `-${parts.join('-')}` : '';
};

export const processLemGendaryRename = async (images, baseName) => {
    return images.map((image, index) => {
        const extension = image.name.split('.').pop();
        const newName = baseName
            ? `${baseName}-${String(index + 1).padStart(2, '0')}.${extension}`
            : image.name;

        return {
            original: image,
            renamed: new File([image.file], newName, { type: image.type }),
            newName
        };
    });
};

export const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
        if (file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const svgText = e.target.result;
                const hasTransparency = svgText.includes('fill="none"') ||
                    svgText.includes('opacity=') ||
                    svgText.includes('fill-opacity') ||
                    svgText.includes('rgba(') ||
                    svgText.includes('fill:#00000000');
                resolve(hasTransparency);
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file);
        } else if (file.type !== 'image/png') {
            resolve(false);
        } else {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 255) {
                        resolve(true);
                        return;
                    }
                }
                resolve(false);
            };
            img.onerror = () => resolve(false);
            img.src = URL.createObjectURL(file);
        }
    });
};

// ============================================
// SECTION 7: COMPONENT LOGIC FUNCTIONS
// ============================================

export const getLanguages = () => {
    return [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' }
    ];
};

export const getCurrentLanguage = (currentLangCode) => {
    const languages = getLanguages();
    return languages.find(lang => lang.code === currentLangCode) || languages[0];
};

export const handleImageDrop = (e, onUpload) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
    if (files.length > 0) {
        onUpload(files);
    }
};

export const handleFileSelect = (e, onUpload) => {
    const files = Array.from(e.target.files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
    onUpload(files);
};

export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

export const validateImageFiles = (files) => {
    return Array.from(files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
};

export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
};

export const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
};

/**
 * Clean up all resources when page unloads
 */
export const cleanupAllResources = () => {
    console.log('Cleaning up all resources...');

    // Stop memory monitoring
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }

    // Clean up GPU memory aggressively
    cleanupGPUMemory();

    // Dispose of AI model
    if (aiModel && aiModel.dispose) {
        aiModel.dispose();
        aiModel = null;
    }

    // Reset failure counters
    aiUpscalingDisabled = false;
    textureManagerFailures = 0;

    console.log('All resources cleaned up');
};

// Add cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupAllResources);
    window.addEventListener('pagehide', cleanupAllResources);
}