/**
 * Main image processing module with AI capabilities, upscaling, and memory management.
 */

// ================================
// Constants and State Management
// ================================

const MAX_TEXTURE_SIZE = 16384;
const MAX_SAFE_DIMENSION = 4096;
const MAX_TOTAL_PIXELS = 4000000;

let aiModel = null;
let aiModelLoading = false;
let upscalerInstances = {};
let upscalerUsageCount = {};
let upscalerLastUsed = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval = null;
let aiUpscalingDisabled = false;
let textureManagerFailures = 0;
const MAX_TEXTURE_FAILURES = 3;
let cleanupInProgress = false;

// ================================
// GPU Memory Management
// ================================

/**
 * Initializes GPU memory monitoring system.
 */
const initializeGPUMemoryMonitor = () => {
    if (memoryCleanupInterval) clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = setInterval(monitorGPUMemory, 10000);
};

/**
 * Monitors GPU memory usage and triggers cleanup when necessary.
 */
const monitorGPUMemory = () => {
    if (cleanupInProgress) return;

    if (window.tf && tf.memory()) {
        const memoryInfo = tf.memory();
        currentMemoryUsage = (memoryInfo.numBytesInGPU || 0) / (1024 * 1024);

        const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
        if (currentMemoryUsage > 3000 && !upscalersInUse) {
            safeCleanupGPUMemory();
        }
    }
};

/**
 * Safely cleans up GPU memory without disposing models that are in use.
 */
const safeCleanupGPUMemory = () => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        if (window.tf) {
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
            if (!upscalersInUse) {
                const now = Date.now();
                Object.keys(upscalerInstances).forEach(key => {
                    if (upscalerUsageCount[key] === 0 &&
                        (!upscalerLastUsed[key] || (now - upscalerLastUsed[key] > 30000))) {
                        const upscaler = upscalerInstances[key];
                        if (upscaler && upscaler.dispose) {
                            try { upscaler.dispose(); } catch (e) { }
                        }
                        delete upscalerInstances[key];
                        delete upscalerUsageCount[key];
                        delete upscalerLastUsed[key];
                    }
                });
                window.tf.disposeVariables();
                window.tf.engine().startScope();
                window.tf.engine().endScope();
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
 * Aggressively cleans up all GPU memory resources.
 */
const cleanupGPUMemory = () => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        if (window.tf) {
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
            if (upscalersInUse) {
                console.warn('Cannot perform aggressive cleanup - models are in use');
                cleanupInProgress = false;
                return;
            }

            if (aiModel && aiModel.dispose) {
                aiModel.dispose();
                aiModel = null;
            }

            Object.keys(upscalerInstances).forEach(key => {
                const upscaler = upscalerInstances[key];
                if (upscaler && upscaler.dispose) {
                    try { upscaler.dispose(); } catch (e) { }
                }
            });

            upscalerInstances = {};
            upscalerUsageCount = {};
            upscalerLastUsed = {};

            window.tf.disposeVariables();
            window.tf.engine().startScope();
            window.tf.engine().endScope();

            if (window.tf.ENV) window.tf.ENV.reset();
        }

        currentMemoryUsage = 0;
        aiUpscalingDisabled = false;
        textureManagerFailures = 0;
    } catch (error) {
        console.warn('Error during aggressive GPU cleanup:', error);
    } finally {
        cleanupInProgress = false;
    }
};

// ================================
// Core Image Processing Functions
// ================================

/**
 * Resizes images while maintaining aspect ratio with optional AI upscaling.
 *
 * @async
 * @param {Array<Object>} images - Array of image objects to resize
 * @param {number} dimension - Target dimension (width or height)
 * @param {Object} options - Processing options including quality and format
 * @returns {Promise<Array<Object>>} Array of resized image results
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
                    img.onerror = () => {
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
 * Crops images to specified dimensions with position control.
 *
 * @async
 * @param {Array<Object>} images - Array of image objects to crop
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {string} cropPosition - Crop position (e.g., 'center', 'top-left')
 * @param {Object} options - Processing options including quality and format
 * @returns {Promise<Array<Object>>} Array of cropped image results
 */
export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);
            let croppedFile;

            if (imageFile.type === 'image/svg+xml') {
                croppedFile = await processSVGCrop(imageFile, width, height);
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

// ================================
// AI Processing Functions
// ================================

/**
 * Loads AI model for smart cropping with fallback.
 *
 * @async
 * @returns {Promise<Object>} Loaded AI model
 */
export const loadAIModel = async () => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        if (!window.tf) await loadTensorFlowFromCDN();
        if (!window.tf) throw new Error('TensorFlow.js not available');

        if (!window.cocoSsd) await loadCocoSsdFromCDN();
        if (window.cocoSsd) {
            aiModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        } else {
            throw new Error('COCO-SSD not available');
        }

        aiModelLoading = false;
        return aiModel;
    } catch (error) {
        console.warn('AI model loading failed, using fallback:', error);
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        return aiModel;
    }
};

// Load TensorFlow.js from CDN
const loadTensorFlowFromCDN = () => {
    return new Promise((resolve) => {
        if (window.tf) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

// Load COCO-SSD from CDN
const loadCocoSsdFromCDN = () => {
    return new Promise((resolve) => {
        if (window.cocoSsd) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

// Create simple AI model fallback
const createSimpleAIModel = () => {
    return {
        detect: async (imgElement) => {
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
 * Performs AI smart cropping with subject detection.
 *
 * @async
 * @param {File} imageFile - Image file to process
 * @param {number} targetWidth - Target crop width
 * @param {number} targetHeight - Target crop height
 * @param {Object} options - Processing options
 * @returns {Promise<File>} Smart-cropped image file
 */
export const processSmartCrop = async (imageFile, targetWidth, targetHeight, options = { quality: 0.85, format: 'webp' }) => {
    if (aiUpscalingDisabled) {
        return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const totalPixels = img.naturalWidth * img.naturalHeight;
        if (totalPixels > MAX_TOTAL_PIXELS) {
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
        const model = await loadAIModel();
        const loadedImg = await loadImage(resized.file);
        const predictions = await model.detect(loadedImg.element);
        const mainSubject = findMainSubject(predictions, loadedImg.width, loadedImg.height);

        let croppedFile;
        if (mainSubject) {
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile);
        } else {
            const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
            const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
        }

        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        cleanupInProgress = wasCleanupInProgress;
        return optimizedFile;

    } catch (error) {
        console.error('AI smart crop error:', error);

        if (error.message.includes('texture') || error.message.includes('WebGL') || error.message.includes('in operator')) {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) {
                aiUpscalingDisabled = true;
            }
        }

        cleanupInProgress = wasCleanupInProgress;
        return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }
};

/**
 * Performs simple smart cropping using basic edge detection.
 *
 * @async
 * @param {File} imageFile - Image file to process
 * @param {number} targetWidth - Target crop width
 * @param {number} targetHeight - Target crop height
 * @param {string} cropPosition - Crop position
 * @param {Object} options - Processing options
 * @returns {Promise<File>} Cropped image file
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

// ================================
// Template Processing Functions
// ================================

/**
 * Processes images using social media templates.
 *
 * @async
 * @param {Object} image - Image object to process
 * @param {Array<Object>} selectedTemplates - Array of template objects
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @returns {Promise<Array<Object>>} Array of processed template images
 */
export const processTemplateImages = async (image, selectedTemplates, useSmartCrop = false, aiModelLoaded = false) => {
    const processedImages = [];
    const imageFile = await ensureFileObject(image);
    const isSVG = imageFile.type === 'image/svg+xml';
    const hasTransparency = isSVG ? false : await checkImageTransparency(imageFile);

    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const totalPixels = img.naturalWidth * img.naturalHeight;
    const isLargeImage = totalPixels > 4000000;

    const templatesByDimensions = {};
    selectedTemplates.forEach(template => {
        const key = template.height === 'auto' ?
            `auto_${template.width}` :
            `${template.width}x${template.height}`;
        if (!templatesByDimensions[key]) templatesByDimensions[key] = [];
        templatesByDimensions[key].push(template);
    });

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        for (const [dimKey, templates] of Object.entries(templatesByDimensions)) {
            try {
                let processedFile = imageFile;
                const template = templates[0];

                if (template.width && template.height) {
                    if (template.height === 'auto') {
                        const resizeResults = await processLemGendaryResize(
                            [{ ...image, file: imageFile }],
                            template.width
                        );
                        if (resizeResults.length > 0) {
                            processedFile = resizeResults[0].resized;
                        }
                    } else {
                        if (useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled) {
                            try {
                                processedFile = await processSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height
                                );
                            } catch (error) {
                                processedFile = await processSimpleSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height,
                                    'center'
                                );
                            }
                        } else {
                            try {
                                processedFile = await processSimpleSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height,
                                    'center'
                                );
                            } catch (error) {
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

                for (const template of templates) {
                    const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp');
                    const jpgPngFile = await optimizeForWeb(processedFile, 0.85, hasTransparency ? 'png' : 'jpg');

                    const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`;
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

                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (groupError) {
                console.error(`Error processing dimension group ${dimKey}:`, groupError);
            }
        }
    } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, 100);
    }

    return processedImages;
};

/**
 * Processes custom images with various operations.
 *
 * @async
 * @param {Array<Object>} selectedImages - Array of images to process
 * @param {Object} processingOptions - Processing configuration options
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const processCustomImagesBatch = async (selectedImages, processingOptions, aiModelLoaded = false) => {
    const processedImages = [];
    const formats = processingOptions.output.formats || ['webp'];

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
                safeCleanupGPUMemory();
            }

            if (processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight) {
                const cropWidth = parseInt(processingOptions.cropWidth);
                const cropHeight = parseInt(processingOptions.cropHeight);

                if (cropWidth > MAX_SAFE_DIMENSION || cropHeight > MAX_SAFE_DIMENSION) {
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

            if (error.message.includes('AI') || error.message.includes('memory') || error.message.includes('texture')) {
                try {
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

        if (i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
            safeCleanupGPUMemory();
        }
    }

    safeCleanupGPUMemory();
    return processedImages;
};

// ================================
// SVG Processing Functions
// ================================

/**
 * Processes SVG image resizing.
 *
 * @async
 * @param {File} svgFile - SVG file to resize
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<File>} Resized SVG file
 */
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

/**
 * Converts SVG to raster format.
 *
 * @async
 * @param {File} svgFile - SVG file to convert
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {string} format - Output format ('png', 'jpg', 'webp')
 * @returns {Promise<File>} Converted raster image file
 */
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

/**
 * Optimizes image for web with transparency handling.
 *
 * @async
 * @param {File} imageFile - Image file to optimize
 * @param {number} quality - Compression quality (0-1)
 * @param {string} format - Output format ('webp', 'jpg', 'png')
 * @returns {Promise<File>} Optimized image file
 */
export const optimizeForWeb = async (imageFile, quality = 0.8, format = 'webp') => {
    if (!(imageFile instanceof File) && !(imageFile instanceof Blob)) {
        throw new Error('Invalid image file provided to optimizeForWeb');
    }

    if (imageFile.type === 'image/svg+xml') {
        return convertSVGToRaster(imageFile, 1000, 1000, format);
    }

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

// ================================
// Utility Functions
// ================================

/**
 * Creates image objects from file arrays.
 *
 * @param {Array<File>} files - Array of image files
 * @returns {Array<Object>} Array of image objects
 */
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

/**
 * Cleans up blob URLs from image objects.
 *
 * @param {Array<Object>} imageObjects - Array of image objects with URLs
 */
export const cleanupBlobUrls = (imageObjects) => {
    imageObjects?.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
            } catch (e) {
            }
        }
    });
};

/**
 * Ensures an image object has a valid File object.
 *
 * @async
 * @param {Object} image - Image object
 * @returns {Promise<File>} Valid file object
 */
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
 * Checks if an image has transparency.
 *
 * @async
 * @param {File} file - Image file to check
 * @returns {Promise<boolean>} True if image has transparency
 */
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

/**
 * Calculates total files generated from selected templates.
 *
 * @param {Array<string>} selectedTemplates - Array of selected template IDs
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - All available templates
 * @returns {number} Total number of files to generate
 */
export const calculateTotalTemplateFiles = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES) => {
    if (!selectedTemplates || selectedTemplates.length === 0) return 0;

    let totalFiles = 0;
    const templateIds = selectedTemplates;
    const templates = SOCIAL_MEDIA_TEMPLATES.filter(t => templateIds.includes(t.id));

    templates.forEach(template => {
        if (template.category === 'web') {
            totalFiles += 2;
        } else if (template.category === 'logo') {
            totalFiles += 1;
        } else {
            totalFiles += 1;
        }
    });

    return totalFiles;
};

/**
 * Gets plural suffix for current language.
 *
 * @param {number} count - Count for pluralization
 * @param {string} language - Current language code
 * @returns {string} Plural suffix
 */
export const getPluralSuffix = (count, language) => {
    if (language === 'hr') {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;

        if (lastDigit === 1 && lastTwoDigits !== 11) return 'a';
        if (lastDigit >= 2 && lastDigit <= 4 &&
            (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'e';
        return 'a';
    }

    return count === 1 ? '' : 's';
};

/**
 * Generates processing summary object.
 *
 * @param {Object} summaryData - Summary data
 * @param {Function} t - Translation function
 * @returns {Object} Processing summary
 */
export const generateProcessingSummary = (summaryData, t) => {
    const summary = {
        mode: summaryData.mode,
        imagesProcessed: summaryData.imagesProcessed,
        formatsExported: summaryData.formatsExported,
        operations: [],
        aiUsed: summaryData.aiUsed,
        upscalingUsed: false,
        totalFiles: summaryData.totalFiles
    };

    if (summaryData.resizeDimension) {
        summary.operations.push(t('operations.resized', { dimension: summaryData.resizeDimension }));
        summary.upscalingUsed = true;
    }
    if (summaryData.cropWidth && summaryData.cropHeight) {
        const cropType = summaryData.cropMode === 'smart' ? t('operations.aiCrop') : t('operations.standardCrop');
        summary.operations.push(`${cropType} ${summaryData.cropWidth}x${summaryData.cropHeight}`);
        summary.upscalingUsed = true;
    }
    if (summaryData.compressionQuality < 100) {
        summary.operations.push(t('operations.compressed', { quality: summaryData.compressionQuality }));
    }
    if (summaryData.rename && summaryData.newFileName) {
        summary.operations.push(t('operations.renamed', { pattern: summaryData.newFileName }));
    }

    if (summary.upscalingUsed) {
        summary.operations.push(t('operations.autoUpscaling'));
    }

    if (summaryData.mode === 'templates') {
        summary.templatesApplied = summaryData.templatesApplied;
        summary.categoriesApplied = summaryData.categoriesApplied;
        summary.operations = [
            t('operations.templatesApplied', { count: summary.templatesApplied }),
            t('operations.autoUpscaling'),
            t('operations.aiSmartCropping')
        ];
    }

    return summary;
};

/**
 * Validates image files.
 *
 * @param {Array<File>} files - Array of files to validate
 * @returns {Array<File>} Array of valid image files
 */
export const validateImageFiles = (files) => {
    return Array.from(files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
};

/**
 * Formats file size for display.
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ================================
// Orchestration Functions
// ================================

/**
 * Orchestrates custom image processing workflow.
 *
 * @async
 * @param {Array<Object>} selectedImages - Selected image objects
 * @param {Object} processingOptions - Processing configuration
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Processed images
 */
export const orchestrateCustomProcessing = async (selectedImages, processingOptions, aiModelLoaded = false, onProgress = null) => {
    try {
        if (!selectedImages || selectedImages.length === 0) {
            throw new Error('No images selected for processing');
        }

        if (!processingOptions.output.formats || processingOptions.output.formats.length === 0) {
            throw new Error('No output formats selected');
        }

        if (onProgress) onProgress('preparing', 10);

        const processedImages = await processCustomImagesBatch(
            selectedImages,
            processingOptions,
            aiModelLoaded
        );

        if (onProgress) onProgress('completed', 100);

        return processedImages;

    } catch (error) {
        console.error('Custom processing orchestration failed:', error);
        throw error;
    }
};

/**
 * Orchestrates template image processing workflow.
 *
 * @async
 * @param {Object} selectedImage - Selected image object
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {Array<Object>} templateConfigs - Template configurations
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Processed template images
 */
export const orchestrateTemplateProcessing = async (selectedImage, selectedTemplateIds, templateConfigs, useSmartCrop = false, aiModelLoaded = false, onProgress = null) => {
    try {
        if (!selectedImage) {
            throw new Error('No image selected for template processing');
        }

        if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
            throw new Error('No templates selected');
        }

        if (onProgress) onProgress('preparing', 10);

        const selectedTemplates = templateConfigs.filter(template =>
            selectedTemplateIds.includes(template.id)
        );

        if (onProgress) onProgress('processing', 30);

        const processedImages = await processTemplateImages(
            selectedImage,
            selectedTemplates,
            useSmartCrop,
            aiModelLoaded
        );

        if (onProgress) onProgress('completed', 100);

        return processedImages;

    } catch (error) {
        console.error('Template processing orchestration failed:', error);
        throw error;
    }
};

/**
 * Validates processing options before starting.
 *
 * @param {Object} processingOptions - Processing options to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validateProcessingOptions = (processingOptions) => {
    const errors = [];

    if (processingOptions.compression?.quality) {
        const quality = parseInt(processingOptions.compression.quality);
        if (isNaN(quality) || quality < 1 || quality > 100) {
            errors.push('Compression quality must be between 1 and 100');
        }
    }

    if (processingOptions.resizeDimension) {
        const dimension = parseInt(processingOptions.resizeDimension);
        if (isNaN(dimension) || dimension < 1 || dimension > 10000) {
            errors.push('Resize dimension must be between 1 and 10000');
        }
    }

    if (processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight) {
        const width = parseInt(processingOptions.cropWidth);
        const height = parseInt(processingOptions.cropHeight);

        if (isNaN(width) || width < 1 || width > 10000) {
            errors.push('Crop width must be between 1 and 10000');
        }
        if (isNaN(height) || height < 1 || height > 10000) {
            errors.push('Crop height must be between 1 and 10000');
        }
    }

    if (processingOptions.output?.formats) {
        const validFormats = ['webp', 'jpg', 'png', 'original'];
        const invalidFormats = processingOptions.output.formats.filter(f => !validFormats.includes(f));
        if (invalidFormats.length > 0) {
            errors.push(`Invalid output formats: ${invalidFormats.join(', ')}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Gets processing configuration based on options.
 *
 * @param {Object} processingOptions - User processing options
 * @returns {Object} Formatted processing configuration
 */
export const getProcessingConfiguration = (processingOptions) => {
    const config = {
        compression: {
            quality: parseInt(processingOptions.compression?.quality || 80) / 100,
            targetSize: processingOptions.compression?.fileSize ? parseInt(processingOptions.compression.fileSize) : null
        },
        output: {
            formats: processingOptions.output?.formats || ['webp'],
            rename: processingOptions.output?.rename || false,
            newFileName: processingOptions.output?.newFileName || ''
        },
        resize: processingOptions.showResize && processingOptions.resizeDimension ? {
            enabled: true,
            dimension: parseInt(processingOptions.resizeDimension)
        } : { enabled: false },
        crop: processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight ? {
            enabled: true,
            width: parseInt(processingOptions.cropWidth),
            height: parseInt(processingOptions.cropHeight),
            mode: processingOptions.cropMode || 'standard',
            position: processingOptions.cropPosition || 'center'
        } : { enabled: false },
        templates: {
            selected: processingOptions.selectedTemplates || [],
            mode: processingOptions.processingMode || 'custom'
        }
    };

    return config;
};

/**
 * Gets available output formats.
 *
 * @returns {Array<Object>} Array of format objects with id, name, and description
 */
export const getAvailableFormats = () => {
    return [
        { id: 'webp', name: 'WebP', description: 'Modern format with excellent compression' },
        { id: 'jpg', name: 'JPEG', description: 'Standard format with good compression' },
        { id: 'png', name: 'PNG', description: 'Lossless format with transparency support' },
        { id: 'original', name: 'Original', description: 'Keep original format' }
    ];
};

/**
 * Gets template by ID.
 *
 * @param {string} templateId - Template ID
 * @param {Array<Object>} templateConfigs - Template configurations
 * @returns {Object|null} Template object or null if not found
 */
export const getTemplateById = (templateId, templateConfigs) => {
    return templateConfigs.find(t => t.id === templateId) || null;
};

/**
 * Gets templates by category.
 *
 * @param {string} category - Template category
 * @param {Array<Object>} templateConfigs - Template configurations
 * @returns {Array<Object>} Array of templates in the category
 */
export const getTemplatesByCategory = (category, templateConfigs) => {
    return templateConfigs.filter(t => t.category === category);
};

/**
 * Generates file name based on processing options.
 *
 * @param {string} originalName - Original file name
 * @param {Object} options - Processing options
 * @param {number} index - File index (for batch processing)
 * @returns {string} Generated file name
 */
export const generateFileName = (originalName, options, index = 0) => {
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const originalExtension = originalName.split('.').pop();

    if (options.rename && options.newFileName) {
        const numberedName = `${options.newFileName}-${String(index + 1).padStart(2, '0')}`;

        if (options.format === 'original') {
            return `${numberedName}.${originalExtension}`;
        } else {
            return `${numberedName}.${options.format}`;
        }
    } else {
        const suffixParts = [];

        if (options.resize && options.resize.enabled) {
            suffixParts.push(`resized-${options.resize.dimension}`);
        }

        if (options.crop && options.crop.enabled) {
            const cropType = options.crop.mode === 'smart' ? 'smart-crop' : 'crop';
            suffixParts.push(`${cropType}-${options.crop.width}x${options.crop.height}`);

            if (options.crop.mode === 'standard' && options.crop.position !== 'center') {
                suffixParts.push(options.crop.position);
            }
        }

        if (options.compression && options.compression.quality < 1) {
            const qualityPercent = Math.round(options.compression.quality * 100);
            suffixParts.push(`q${qualityPercent}`);
        }

        const suffix = suffixParts.length > 0 ? `-${suffixParts.join('-')}` : '';

        if (options.format === 'original') {
            return `${baseName}${suffix}.${originalExtension}`;
        } else {
            return `${baseName}${suffix}.${options.format}`;
        }
    }
};

/**
 * Creates processing summary for display.
 *
 * @param {Object} result - Processing result
 * @param {Object} options - Processing options
 * @param {Function} t - Translation function
 * @returns {Object} Processing summary
 */
export const createProcessingSummary = (result, options, t) => {
    const summary = {
        mode: options.templates?.mode || 'custom',
        imagesProcessed: result.imagesProcessed || 0,
        operations: [],
        aiUsed: false,
        upscalingUsed: false,
        totalFiles: result.totalFiles || 0,
        success: result.success || false,
        errors: result.errors || []
    };

    if (options.resize && options.resize.enabled) {
        summary.operations.push(t('operations.resized', { dimension: options.resize.dimension }));
        summary.upscalingUsed = true;
    }

    if (options.crop && options.crop.enabled) {
        const cropType = options.crop.mode === 'smart' ? t('operations.aiCrop') : t('operations.standardCrop');
        summary.operations.push(`${cropType} ${options.crop.width}x${options.crop.height}`);
        summary.upscalingUsed = true;

        if (options.crop.mode === 'smart') {
            summary.aiUsed = true;
        }
    }

    if (options.compression && options.compression.quality < 1) {
        const qualityPercent = Math.round(options.compression.quality * 100);
        summary.operations.push(t('operations.compressed', { quality: qualityPercent }));
    }

    if (options.output && options.output.rename && options.output.newFileName) {
        summary.operations.push(t('operations.renamed', { pattern: options.output.newFileName }));
    }

    if (options.output && options.output.formats) {
        summary.formatsExported = options.output.formats;
    }

    if (options.templates && options.templates.selected.length > 0) {
        summary.templatesApplied = options.templates.selected.length;
        summary.categoriesApplied = new Set(
            options.templates.selected.map(id => {
                const template = getTemplateById(id, []);
                return template?.category;
            }).filter(Boolean)
        ).size;
    }

    if (summary.upscalingUsed) {
        summary.operations.push(t('operations.autoUpscaling'));
    }

    return summary;
};

/**
 * Handles image file selection with validation.
 *
 * @param {Event} e - File input event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Validation options
 */
export const handleFileSelect = (e, onUpload, options = {}) => {
    const files = Array.from(e.target.files).filter(file => {
        const isImage = file.type.startsWith('image/') || file.type === 'image/svg+xml';

        if (options.maxSize && file.size > options.maxSize) {
            console.warn(`File ${file.name} exceeds maximum size: ${file.size} > ${options.maxSize}`);
            return false;
        }

        if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
            console.warn(`File ${file.name} has unsupported type: ${file.type}`);
            return false;
        }

        return isImage;
    });

    if (files.length > 0) {
        onUpload(files);
    } else {
        console.warn('No valid image files selected');
    }
};

/**
 * Handles image drop with validation.
 *
 * @param {Event} e - Drag and drop event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Validation options
 */
export const handleImageDrop = (e, onUpload, options = {}) => {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files).filter(file => {
        const isImage = file.type.startsWith('image/') || file.type === 'image/svg+xml';

        if (options.maxSize && file.size > options.maxSize) {
            console.warn(`File ${file.name} exceeds maximum size: ${file.size} > ${options.maxSize}`);
            return false;
        }

        if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
            console.warn(`File ${file.name} has unsupported type: ${file.type}`);
            return false;
        }

        return isImage;
    });

    if (files.length > 0) {
        onUpload(files);
    } else {
        console.warn('No valid image files dropped');
    }
};

// ================================
// Internal Helper Functions
// ================================

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

const calculateUpscaleFactor = (originalWidth, originalHeight, targetWidth, targetHeight) => {
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;
    const requiredScale = Math.max(widthScale, heightScale);

    const availableScales = [2, 3, 4];

    for (const scale of availableScales) {
        if (scale >= requiredScale) {
            const safeDimensions = calculateSafeDimensions(originalWidth, originalHeight, scale);
            if (!safeDimensions.wasAdjusted) return scale;
        }
    }

    if (requiredScale > 1) return Math.min(requiredScale, 2);
    return 1;
};

const calculateSafeDimensions = (originalWidth, originalHeight, scale) => {
    let targetWidth = Math.round(originalWidth * scale);
    let targetHeight = Math.round(originalHeight * scale);

    if (targetWidth > MAX_TEXTURE_SIZE || targetHeight > MAX_TEXTURE_SIZE) {
        const maxWidthScale = MAX_SAFE_DIMENSION / originalWidth;
        const maxHeightScale = MAX_SAFE_DIMENSION / originalHeight;
        const safeScale = Math.min(maxWidthScale, maxHeightScale, scale);

        targetWidth = Math.round(originalWidth * safeScale);
        targetHeight = Math.round(originalHeight * safeScale);

        return { width: targetWidth, height: targetHeight, scale: safeScale, wasAdjusted: true };
    }

    const totalPixels = targetWidth * targetHeight;
    if (totalPixels > MAX_TOTAL_PIXELS) {
        const safeScale = Math.sqrt(MAX_TOTAL_PIXELS / (originalWidth * originalHeight));
        targetWidth = Math.round(originalWidth * safeScale);
        targetHeight = Math.round(originalHeight * safeScale);

        return { width: targetWidth, height: targetHeight, scale: safeScale, wasAdjusted: true };
    }

    return { width: targetWidth, height: targetHeight, scale: scale, wasAdjusted: false };
};

const upscaleImageWithAI = async (imageFile, scale, originalName) => {
    if (aiUpscalingDisabled) {
        return upscaleImageEnhancedFallback(imageFile, scale, originalName);
    }

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);

        if (safeDimensions.wasAdjusted || safeDimensions.width > MAX_SAFE_DIMENSION || safeDimensions.height > MAX_SAFE_DIMENSION) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        }

        const availableScales = [2, 3, 4];
        if (!availableScales.includes(scale) || scale > 4) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, Math.min(scale, 2), originalName);
        }

        let upscaler;
        try {
            upscaler = await loadUpscalerForScale(scale);
        } catch (loadError) {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        let upscaleResult;
        try {
            upscaleResult = await safeUpscale(upscaler, img, scale);
        } catch (upscaleError) {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

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
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        URL.revokeObjectURL(objectUrl);

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/webp', 0.9);
        });

        if (!blob) throw new Error('Failed to create blob from upscaled canvas');

        const extension = originalName.split('.').pop();
        const newName = originalName.replace(
            /\.[^/.]+$/,
            `-ai-upscaled-${scale}x.${extension}`
        );

        const upscaledFile = new File([blob], newName, { type: 'image/webp' });
        textureManagerFailures = Math.max(0, textureManagerFailures - 1);
        cleanupInProgress = wasCleanupInProgress;
        return upscaledFile;

    } catch (error) {
        textureManagerFailures++;
        if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
        cleanupInProgress = wasCleanupInProgress;

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
            throw error;
        }
    }
};

const loadUpscalerForScale = async (scale) => {
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
        if (!window.Upscaler) await loadUpscalerFromCDN();

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

        if (!window[modelGlobalName]) throw new Error(`Model ${modelGlobalName} not loaded`);

        let upscaler;
        try {
            upscaler = new window.Upscaler({
                model: window[modelGlobalName],
            });
        } catch (createError) {
            throw createError;
        }

        upscalerInstances[scale] = upscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return upscaler;

    } catch (error) {
        const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return fallbackUpscaler;
    }
};

const loadUpscalerFromCDN = () => {
    return new Promise((resolve) => {
        if (window.Upscaler) {
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
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load model: ${src}`));
        document.head.appendChild(script);
    });
};

const releaseUpscalerForScale = (scale) => {
    if (upscalerUsageCount[scale]) {
        upscalerUsageCount[scale]--;
        upscalerLastUsed[scale] = Date.now();

        if (upscalerUsageCount[scale] <= 0 && currentMemoryUsage > 1000) {
            setTimeout(() => {
                if (upscalerUsageCount[scale] <= 0) {
                    const upscaler = upscalerInstances[scale];
                    if (upscaler && upscaler.dispose) {
                        try { upscaler.dispose(); } catch (e) { }
                    }
                    delete upscalerInstances[scale];
                    delete upscalerUsageCount[scale];
                    delete upscalerLastUsed[scale];
                }
            }, 1000);
        }
    }
};

const safeUpscale = async (upscaler, img, scale) => {
    if (upscalerUsageCount[scale]) upscalerUsageCount[scale]++;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            releaseUpscalerForScale(scale);
            reject(new Error('Upscaling timeout'));
        }, 45000);

        try {
            upscaler.upscale(img, {
                patchSize: 32,
                padding: 2
            }).then((result) => {
                clearTimeout(timeoutId);
                upscalerLastUsed[scale] = Date.now();
                releaseUpscalerForScale(scale);
                resolve(result);
            }).catch((error) => {
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

const createEnhancedFallbackUpscaler = (scale) => {
    return {
        scale,
        upscale: async (imageElement) => {
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

            if (safeDimensions.scale >= 2) {
                applySmartSharpening(canvas, ctx, safeDimensions.scale);
            }

            return canvas;
        }
    };
};

const applySmartSharpening = (canvas, ctx, scale) => {
    try {
        const width = canvas.width;
        const height = canvas.height;

        if (width * height > 4000000) return;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const originalData = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                for (let channel = 0; channel < 3; channel++) {
                    const channelIdx = idx + channel;

                    const top = originalData[channelIdx - width * 4];
                    const bottom = originalData[channelIdx + width * 4];
                    const left = originalData[channelIdx - 4];
                    const right = originalData[channelIdx + 4];
                    const center = originalData[channelIdx];

                    const sharpened = Math.min(255, Math.max(0,
                        center * 1.5 - (top + bottom + left + right) * 0.125
                    ));

                    data[channelIdx] = sharpened;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    } catch (error) { }
};

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

    if (targetWidth * targetHeight > 4000000) {
        URL.revokeObjectURL(objectUrl);
        return upscaleImageTiled(img, scale, originalName);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    if (scale >= 2) applySmartSharpening(canvas, ctx, scale);

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

const upscaleImageTiled = async (img, scale, originalName, objectUrl) => {
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    const TILE_SIZE = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const xTiles = Math.ceil(targetWidth / TILE_SIZE);
    const yTiles = Math.ceil(targetHeight / TILE_SIZE);

    for (let y = 0; y < yTiles; y++) {
        for (let x = 0; x < xTiles; x++) {
            const tileX = x * TILE_SIZE;
            const tileY = y * TILE_SIZE;
            const tileWidth = Math.min(TILE_SIZE, targetWidth - tileX);
            const tileHeight = Math.min(TILE_SIZE, targetHeight - tileY);

            const srcX = tileX / scale;
            const srcY = tileY / scale;
            const srcWidth = tileWidth / scale;
            const srcHeight = tileHeight / scale;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileWidth;
            tempCanvas.height = tileHeight;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';

            tempCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, tileWidth, tileHeight);
            applySmartSharpening(tempCanvas, tempCtx, scale);
            ctx.drawImage(tempCanvas, tileX, tileY);
        }
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);

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

const processSVGCrop = async (svgFile, width, height) => {
    const img = new Image();
    const svgUrl = URL.createObjectURL(svgFile);

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

    const { offsetX, offsetY } = calculateCropOffset(scaledWidth, scaledHeight, width, height, 'center');

    cropCtx.drawImage(tempCanvas, offsetX, offsetY, width, height, 0, 0, width, height);

    const croppedBlob = await new Promise(resolve => {
        cropCanvas.toBlob(resolve, 'image/png', 0.85);
    });

    const croppedFile = new File([croppedBlob], svgFile.name.replace(/\.svg$/i, '.png'), {
        type: 'image/png'
    });

    URL.revokeObjectURL(svgUrl);
    return croppedFile;
};

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
    } else if (position && position.bbox) {
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
    } else if (position && position.x !== undefined && position.y !== undefined) {
        offsetX = position.x - targetWidth / 2;
        offsetY = position.y - targetHeight / 2;
    } else {
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

const tensorToCanvas = async (tensor) => {
    return new Promise((resolve) => {
        const [height, width, channels] = tensor.shape;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = tensor.dataSync();

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
        resolve(canvas);

        if (tensor.dispose) tensor.dispose();
    });
};

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
 * Cleans up all resources when page unloads.
 */
export const cleanupAllResources = () => {
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }

    cleanupGPUMemory();

    if (aiModel && aiModel.dispose) {
        aiModel.dispose();
        aiModel = null;
    }

    aiUpscalingDisabled = false;
    textureManagerFailures = 0;
};

// Initialize memory monitoring
if (typeof window !== 'undefined') {
    window.addEventListener('load', initializeGPUMemoryMonitor);
    window.addEventListener('beforeunload', cleanupAllResources);
    window.addEventListener('pagehide', cleanupAllResources);
}

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

export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

export const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
};

export const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
};
