import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    optimizeForWeb,
    processTemplateImages
} from '../processors';
import { safeCleanupGPUMemory } from '../utils';

/**
 * Calculates percentage value
 */
export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

/**
 * Generates tick values for range sliders
 */
export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

/**
 * Debounce function
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
 * Orchestrates custom image processing workflow.
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
                // Step 1: Resize if needed
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

                // Step 2: Crop if needed (with AI support)
                if (processingConfig.crop && processingConfig.crop.enabled) {
                    const { width, height, mode, position } = processingConfig.crop;

                    if (mode === 'smart' && aiModelLoaded) {
                        try {
                            processedFile = await processSmartCrop(
                                processedFile,
                                width,
                                height,
                                {
                                    quality: processingConfig.compression?.quality || 0.8,
                                    format: 'webp'
                                }
                            );
                        } catch (aiError) {
                            // Fallback to simple smart crop if AI fails
                            console.warn('AI crop failed, falling back to simple smart crop:', aiError.message);
                            processedFile = await processSimpleSmartCrop(
                                processedFile,
                                width,
                                height,
                                position || 'center',
                                {
                                    quality: processingConfig.compression?.quality || 0.8,
                                    format: 'webp'
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
                                format: 'webp'
                            }
                        );

                        if (cropResults.length > 0 && cropResults[0].cropped) {
                            processedFile = cropResults[0].cropped;
                        }
                    }
                }

                // Step 3: Process output formats
                const outputFormats = processingConfig.output?.formats || ['webp'];

                for (const format of outputFormats) {
                    if (format === 'original') {
                        processedImages.push({
                            ...image,
                            file: image.file || image.blob,
                            name: image.name,
                            format: image.originalFormat || image.type.split('/')[1],
                            processed: false,
                            isOriginal: true
                        });
                    } else {
                        const optimizedFile = await optimizeForWeb(
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
                            // Add suffix indicating processing
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

                // Cleanup GPU memory periodically
                if (i % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    safeCleanupGPUMemory();
                }

            } catch (error) {
                console.error(`Error processing image ${image.name}:`, error);
                processedImages.push({
                    ...image,
                    error: error.message,
                    processed: false
                });
            }
        }

        // Final cleanup
        safeCleanupGPUMemory();
        return processedImages.filter(img => !img.error);

    } catch (error) {
        console.error('Error in orchestrateCustomProcessing:', error);
        throw error;
    }
};

/**
 * Orchestrates template processing
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

        if (regularTemplates.length > 0) {
            if (onProgress) onProgress('processing-regular-templates', 40);

            const templateImages = await processTemplateImages(
                selectedImage,
                regularTemplates,
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