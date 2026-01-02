import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    processLengendaryOptimize,
    processTemplateImages
} from '../processors';
import { safeCleanupGPUMemory } from './memoryUtils';
import {
    URL_CONSTANTS,
    PROCESSING_MODES,
    CROP_MODES,
    IMAGE_FORMATS
} from '../constants';

import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';

/**
 * Calculates percentage value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} value - Current value
 * @returns {number} Percentage value
 */
export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

/**
 * Generates tick values for range sliders
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<number>} Array of tick values
 */
export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Normalizes a URL by ensuring it has a protocol
 * @param {string} url - Raw URL input
 * @returns {string} Normalized URL with protocol
 */
export const normalizeUrl = (url) => {
    if (!url || url.trim() === '') {
        return '';
    }

    let cleanUrl = url.trim();

    if (cleanUrl.includes('localhost:5173/')) {
        cleanUrl = cleanUrl.replace('localhost:5173/', '');
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `${URL_CONSTANTS.DEFAULT_PROTOCOL}${cleanUrl}`;
    }

    cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');
    return cleanUrl;
};

/**
 * Opens URL in new tab with security attributes
 * @param {string} url - URL to open
 */
export const openUrlInNewTab = (url) => {
    if (url && url.trim()) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

/**
 * Cleans a URL for display or processing
 * @param {string} url - URL to clean
 * @returns {string} Cleaned URL
 */
export const cleanUrl = (url) => {
    if (!url || url.trim() === '') {
        return '';
    }

    let cleanUrl = url.trim();

    if (cleanUrl.includes('localhost:5173/')) {
        cleanUrl = cleanUrl.replace('localhost:5173/', '');
    }

    cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');
    return cleanUrl;
};

/**
 * Orchestrates custom image processing workflow
 * @async
 * @param {Array<Object>} images - Array of image objects to process
 * @param {Object} processingConfig - Processing configuration
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const orchestrateCustomProcessing = async (images, processingConfig, aiModelLoaded) => {
    try {
        const processedImages = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            let processedFile = image.file || image.blob;

            try {
                if (processingConfig.resize && processingConfig.resize.enabled) {
                    const resizeDimension = processingConfig.resize.dimension;
                    const resizeResults = await processLemGendaryResize(
                        [{ file: processedFile, name: image.name }],
                        resizeDimension,
                        {
                            quality: processingConfig.compression?.quality || 0.8,
                            format: 'webp'
                        }
                    );

                    if (resizeResults.length > 0 && resizeResults[0].resized) {
                        processedFile = resizeResults[0].resized;
                    }
                }

                if (processingConfig.crop && processingConfig.crop.enabled) {
                    const { width, height, mode, position } = processingConfig.crop;

                    if (mode === CROP_MODES.SMART && aiModelLoaded) {
                        try {
                            processedFile = await processSmartCrop(
                                processedFile,
                                width,
                                height,
                                {
                                    quality: processingConfig.compression?.quality || 0.8,
                                    format: IMAGE_FORMATS.WEBP
                                }
                            );
                        } catch (aiError) {
                            processedFile = await processSimpleSmartCrop(
                                processedFile,
                                width,
                                height,
                                position || 'center',
                                {
                                    quality: processingConfig.compression?.quality || 0.8,
                                    format: IMAGE_FORMATS.WEBP
                                }
                            );
                        }
                    } else {
                        const cropResults = await processLemGendaryCrop(
                            [{ file: processedFile, name: image.name }],
                            width,
                            height,
                            position || 'center',
                            {
                                quality: processingConfig.compression?.quality || 0.8,
                                format: IMAGE_FORMATS.WEBP
                            }
                        );

                        if (cropResults.length > 0 && cropResults[0].cropped) {
                            processedFile = cropResults[0].cropped;
                        }
                    }
                }

                const outputFormats = processingConfig.output?.formats || [IMAGE_FORMATS.WEBP];

                for (const format of outputFormats) {
                    if (format === IMAGE_FORMATS.ORIGINAL) {
                        processedImages.push({
                            ...image,
                            file: image.file || image.blob,
                            name: image.name,
                            format: image.originalFormat || image.type.split('/')[1],
                            processed: false,
                            isOriginal: true
                        });
                    } else {
                        const optimizedFile = await processLengendaryOptimize(
                            processedFile,
                            processingConfig.compression?.quality || 0.8,
                            format
                        );

                        let fileName = image.name;
                        if (processingConfig.output?.rename && processingConfig.output?.newFileName) {
                            const ext = format === 'original' ?
                                fileName.split('.').pop() : format;
                            fileName = `${processingConfig.output.newFileName}-${String(i + 1).padStart(2, '0')}.${ext}`;
                        } else if (!fileName.includes(`.${format}`)) {
                            let suffix = '';
                            if (processingConfig.resize?.enabled) {
                                suffix += `-${processingConfig.resize.dimension}`;
                            }
                            if (processingConfig.crop?.enabled) {
                                const cropType = processingConfig.crop.mode === 'smart' ? 'smart' : 'crop';
                                suffix += `-${cropType}-${processingConfig.crop.width}x${processingConfig.crop.height}`;
                            }
                            if (processingConfig.compression?.quality < 1) {
                                const qualityPercent = Math.round((processingConfig.compression.quality || 0.8) * 100);
                                suffix += `-q${qualityPercent}`;
                            }

                            fileName = fileName.replace(/\.[^/.]+$/, '') +
                                (suffix || '') +
                                `.${format}`;
                        }

                        processedImages.push({
                            ...image,
                            file: optimizedFile,
                            name: fileName,
                            format: format,
                            processed: true,
                            resizeApplied: processingConfig.resize?.enabled || false,
                            cropApplied: processingConfig.crop?.enabled || false,
                            cropMode: processingConfig.crop?.mode || 'standard',
                            quality: processingConfig.compression?.quality || 0.8
                        });
                    }
                }

                if (i % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    safeCleanupGPUMemory();
                }

            } catch (error) {
                processedImages.push({
                    ...image,
                    error: error.message,
                    processed: false
                });
            }
        }

        safeCleanupGPUMemory();
        return processedImages;

    } catch (error) {
        throw error;
    }
};

/**
 * Orchestrates template processing
 * @async
 * @param {Object} selectedImage - Selected image object
 * @param {Array<string>} selectedTemplateIds - Array of template IDs
 * @param {Array<Object>} templateConfigs - Template configurations
 * @param {boolean} useSmartCrop - Whether to use smart crop
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback function
 * @param {Object} processingOptions - Processing options
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const orchestrateTemplateProcessing = async (
    selectedImage,
    selectedTemplateIds,
    templateConfigs,
    useSmartCrop = false,
    aiModelLoaded = false,
    onProgress = null,
    processingOptions = {}
) => {
    try {
        if (!selectedImage) {
            throw new Error('No image selected');
        }

        const includeFavicon = processingOptions.includeFavicon || false;
        const includeScreenshots = processingOptions.includeScreenshots || false;

        if ((!selectedTemplateIds || selectedTemplateIds.length === 0) && !includeFavicon && !includeScreenshots) {
            throw new Error('No templates selected');
        }

        if (onProgress) onProgress('preparing', 10);

        const regularTemplates = selectedTemplateIds
            .filter(id => !id.startsWith('screenshots-'))
            .map(templateId => templateConfigs.find(t => t.id === templateId))
            .filter(template => template);

        if (onProgress) onProgress('processing', 30);

        const processedImages = [];

        // Handle screenshot templates
        let screenshotTemplates = [];
        if (includeScreenshots && processingOptions.selectedScreenshotTemplates && processingOptions.selectedScreenshotTemplates.length > 0) {
            screenshotTemplates = processingOptions.selectedScreenshotTemplates
                .map(id => SCREENSHOT_TEMPLATES[id])
                .filter(t => t);
        }

        const allTemplates = [...regularTemplates, ...screenshotTemplates];

        if (allTemplates.length > 0) {
            if (onProgress) onProgress('processing-templates', 40);

            const templateImages = await processTemplateImages(
                selectedImage,
                allTemplates,
                useSmartCrop,
                aiModelLoaded,
                processingOptions
            );

            processedImages.push(...templateImages);
        }

        if (onProgress) onProgress('finalizing', 90);

        await new Promise(resolve => setTimeout(resolve, 100));
        safeCleanupGPUMemory();

        if (onProgress) onProgress('completed', 100);

        return processedImages.filter(img => img && img.name && (img.file || img.blob));

    } catch (error) {
        throw error;
    }
};
