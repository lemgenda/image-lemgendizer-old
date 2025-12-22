import {
    CROP_MODES,
    MAX_SAFE_DIMENSION,
    DEFAULT_QUALITY,
    LARGE_IMAGE_THRESHOLD,
    PROCESSING_DELAYS
} from '../constants/sharedConstants.js';

// Import core image processor for basic operations
import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    optimizeForWeb,
    checkImageTransparency
} from '../processors';

// Import utilities
import {
    safeCleanupGPUMemory,
    ensureFileObject,
    createTIFFPlaceholderFile,
    checkAVIFSupport,
    getTemplateById,
    getTemplatesByCategory
} from '../utils';

// Global variables (these should likely be managed elsewhere)
let cleanupInProgress = false;
let aiUpscalingDisabled = false;

// ================================
// Template Processing Functions
// ================================

/**
 * Processes images using social media templates.
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
    const isLargeImage = totalPixels > LARGE_IMAGE_THRESHOLD;  // Using constant

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

                    // Check if template is web or logo category using utility function
                    const isWebTemplate = getTemplatesByCategory('web', [template]).length > 0;
                    const isLogoTemplate = getTemplatesByCategory('logo', [template]).length > 0;
                    const isWebOrLogo = isWebTemplate || isLogoTemplate;

                    processedImages.push({
                        ...image,
                        file: webpFile,
                        name: webpName,
                        template: template,
                        format: 'webp',
                        processed: true,
                        aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                    });

                    if (isWebOrLogo) {
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

                await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.MEMORY_CLEANUP));  // Using constant
            } catch (groupError) {
                // Error handling
            }
        }
    } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, PROCESSING_DELAYS.MEMORY_CLEANUP);  // Using constant
    }

    return processedImages;
};

/**
 * Processes custom images with various operations.
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
            // Get the original file from the image object
            let baseProcessedFile = await ensureFileObject(image);

            let resizeResult = null;
            let cropResult = null;

            // Only resize if resize is enabled AND dimension is provided
            if (processingOptions.resize?.enabled && processingOptions.resize.dimension) {
                const resizeDimension = parseInt(processingOptions.resize.dimension);
                const safeDimension = Math.min(resizeDimension, MAX_SAFE_DIMENSION);

                const resizeResults = await processLemGendaryResize(
                    [{ ...image, file: baseProcessedFile }],
                    safeDimension
                );
                if (resizeResults.length > 0 && resizeResults[0].resized) {
                    resizeResult = resizeResults[0].resized;
                    baseProcessedFile = resizeResult;
                }
                safeCleanupGPUMemory();
            }

            // Only crop if crop is enabled AND both dimensions are provided
            if (processingOptions.crop?.enabled && processingOptions.crop.width && processingOptions.crop.height) {
                const cropWidth = parseInt(processingOptions.crop.width);
                const cropHeight = parseInt(processingOptions.crop.height);

                const safeWidth = Math.min(cropWidth, MAX_SAFE_DIMENSION);
                const safeHeight = Math.min(cropHeight, MAX_SAFE_DIMENSION);

                if (processingOptions.crop.mode === CROP_MODES.SMART && aiModelLoaded && !aiUpscalingDisabled) {
                    try {
                        const smartCropFile = await processSmartCrop(
                            baseProcessedFile,
                            safeWidth,
                            safeHeight,
                            { quality: processingOptions.compression?.quality || DEFAULT_QUALITY, format: 'webp' }
                        );
                        cropResult = smartCropFile;
                        baseProcessedFile = smartCropFile;
                    } catch (aiError) {
                        const cropResults = await processLemGendaryCrop(
                            [{ ...image, file: baseProcessedFile }],
                            safeWidth,
                            safeHeight,
                            processingOptions.crop.position || 'center',
                            { quality: processingOptions.compression?.quality || DEFAULT_QUALITY, format: 'webp' }
                        );
                        if (cropResults.length > 0 && cropResults[0].cropped) {
                            cropResult = cropResults[0].cropped;
                            baseProcessedFile = cropResult;
                        }
                    }
                } else {
                    const cropResults = await processLemGendaryCrop(
                        [{ ...image, file: baseProcessedFile }],
                        safeWidth,
                        safeHeight,
                        processingOptions.crop.position || 'center',
                        { quality: processingOptions.compression?.quality || DEFAULT_QUALITY, format: 'webp' }
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

                if (processingOptions.output.rename && processingOptions.output.newFileName) {
                    // Use new filename pattern with numbering
                    const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;

                    if (format === 'original') {
                        finalName = `${numberedName}.${image.name.split('.').pop()}`;
                        processedFile = new File([await ensureFileObject(image)], finalName, {
                            type: image.type || processedFile.type
                        });
                    } else {
                        finalName = `${numberedName}.${format}`;
                    }
                } else {
                    // Keep original naming - NO operation suffixes
                    if (format === 'original') {
                        // For original format, keep exact original filename
                        finalName = image.name;
                        processedFile = new File([await ensureFileObject(image)], finalName, {
                            type: image.type || processedFile.type
                        });
                    } else {
                        // For converted formats: baseName.extension
                        finalName = `${baseName}.${format}`;
                    }
                }

                if (format !== 'original') {
                    // Check transparency
                    const hasTransparency = await checkImageTransparency(processedFile);
                    let targetFormat = format;

                    // Handle JPG format with transparency
                    if ((targetFormat === 'jpg' || targetFormat === 'jpeg') && hasTransparency) {
                        // Keep as JPG but add white background in optimizeForWeb
                        // Don't switch to PNG
                        targetFormat = 'jpg';
                    }

                    // Check AVIF support if needed
                    if (targetFormat === 'avif') {
                        const supportsAVIF = await checkAVIFSupport();
                        if (!supportsAVIF) {
                            targetFormat = 'webp';
                        }
                    }

                    try {
                        processedFile = await optimizeForWeb(
                            processedFile,
                            processingOptions.compression?.quality || DEFAULT_QUALITY,
                            targetFormat
                        );
                    } catch (error) {
                        // For TIFF files, try to create a simple conversion
                        const isTIFF = image.isTIFF ||
                            image.type === 'image/tiff' ||
                            image.type === 'image/tif' ||
                            image.name.toLowerCase().endsWith('.tiff') ||
                            image.name.toLowerCase().endsWith('.tif');

                        if (isTIFF) {
                            try {
                                processedFile = await createTIFFPlaceholderFile(image.file);
                            } catch (fallbackError) {
                                // Skip this format
                                continue;
                            }
                        } else {
                            // Skip this format for non-TIFF files
                            continue;
                        }
                    }

                    // Update filename extension if format changed
                    if (targetFormat !== format) {
                        if (processingOptions.output.rename && processingOptions.output.newFileName) {
                            // For renamed files, replace the extension
                            const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;
                            finalName = `${numberedName}.${targetFormat}`;
                        } else {
                            // For original filenames, update with correct extension
                            finalName = `${baseName}.${targetFormat}`;
                        }
                    }
                }

                // Ensure file has correct name
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
                        : format,
                    operations: {
                        resized: !!resizeResult,
                        cropped: !!cropResult,
                        aiUsed: processingOptions.crop?.mode === CROP_MODES.SMART && aiModelLoaded && !aiUpscalingDisabled && !!cropResult
                    }
                });
            }

        } catch (error) {
            // Create error entries for each format
            for (const format of formats) {
                const baseName = image.name.replace(/\.[^/.]+$/, '');
                let finalName;

                if (processingOptions.output.rename && processingOptions.output.newFileName) {
                    const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;
                    const extension = format === 'original' ? image.name.split('.').pop() : format;
                    finalName = `${numberedName}.${extension}`;
                } else {
                    if (format === 'original') {
                        finalName = image.name;
                    } else {
                        finalName = `${baseName}.${format}`;
                    }
                }

                processedImages.push({
                    ...image,
                    file: null,
                    name: finalName,
                    processed: false,
                    format: format === 'original' ? image.type?.split('/')[1] : format,
                    error: error.message
                });
            }
        }

        // Add small delay between images for better UI responsiveness
        if (i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.BETWEEN_IMAGES));  // Using constant
            safeCleanupGPUMemory();
        }
    }

    safeCleanupGPUMemory();
    return processedImages;
};

// ================================
// Orchestration Functions
// ================================

/**
 * Orchestrates custom image processing workflow.
 * @async
 * @param {Array<Object>} selectedImages - Selected image objects
 * @param {Object} processingOptions - Processing configuration
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Processed images
 * @throws {Error} If no images selected or no output formats
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
        throw error;
    }
};

/**
 * Orchestrates template image processing workflow.
 * @async
 * @param {Object} selectedImage - Selected image object
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {Array<Object>} templateConfigs - Template configurations
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Processed template images
 * @throws {Error} If no image or templates selected
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

        // Use getTemplateById utility function to get templates
        const selectedTemplates = selectedTemplateIds
            .map(templateId => getTemplateById(templateId, templateConfigs))
            .filter(template => template !== null);

        if (selectedTemplates.length === 0) {
            throw new Error('No valid templates found');
        }

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
        throw error;
    }
};