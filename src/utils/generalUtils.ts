import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    processLengendaryOptimize,
    processTemplateImages
} from '../processors';
import { generateNewFileName } from './renameUtils';
import { safeCleanupGPUMemory } from './memoryUtils';
import {
    URL_CONSTANTS,
    PROCESSING_MODES,
    CROP_MODES,
    IMAGE_FORMATS,
    IMAGE_FILTERS
} from '../constants';

import { SCREENSHOT_TEMPLATES, TemplateConfig } from '../configs/templateConfigs';
import { ImageFile, ProcessingOptions, BatchRenameOptions } from '../types';

/**
 * Calculates percentage value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} value - Current value
 * @returns {number} Percentage value
 */
export const calculatePercentage = (min: number, max: number, value: number): number => {
    return ((value - min) / (max - min)) * 100;
};

/**
 * Generates tick values for range sliders
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<number>} Array of tick values
 */
export const generateTicks = (min: number, max: number): number[] => {
    return [min, 25, 50, 75, max];
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func: (...args: any[]) => void, wait: number): ((...args: any[]) => void) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function executedFunction(...args: any[]) {
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
export const throttle = (func: (...args: any[]) => void, limit: number): ((...args: any[]) => void) => {
    let inThrottle: boolean;
    return function (this: any, ...args: any[]) {
        if (!inThrottle) {
            func.apply(this, args);
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
export const normalizeUrl = (url: string): string => {
    if (!url || url.trim() === '') {
        return '';
    }

    let cleanUrl = url.trim();

    if (cleanUrl.includes('localhost:5173/')) {
        cleanUrl = cleanUrl.replace('localhost:5173/', '');
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        const protocol = (URL_CONSTANTS as any).DEFAULT_PROTOCOL || 'https://';
        cleanUrl = `${protocol}${cleanUrl}`;
    }

    cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');
    return cleanUrl;
};

/**
 * Opens URL in new tab with security attributes
 * @param {string} url - URL to open
 */
export const openUrlInNewTab = (url: string): void => {
    if (url && url.trim()) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

/**
 * Cleans a URL for display or processing
 * @param {string} url - URL to clean
 * @returns {string} Cleaned URL
 */
export const cleanUrl = (url: string): string => {
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
 */
export const orchestrateCustomProcessing = async (
    images: ImageFile[],
    processingConfig: ProcessingOptions & { batchRename?: BatchRenameOptions },
    aiModelLoaded: boolean
): Promise<ImageFile[]> => {
    const processedImages: ImageFile[] = [];

    for (let i = 0; i < images.length; i++) {
        const image = images[i];

        // 0. Bypass for Batch Rename Mode
        if ((processingConfig.processingMode as any) === PROCESSING_MODES.BATCH_RENAME) {
            const renameOptions = processingConfig.batchRename || {};
            const fileName = generateNewFileName(image.name, i, renameOptions);
            processedImages.push({
                ...image,
                name: fileName,
                processed: true,
                isOriginal: true // Preserving original data
            });
            continue;
        }

        const filter = processingConfig.filters?.selectedFilter || IMAGE_FILTERS.NONE;
        let processedFile = image.file;

        try {
            if (processingConfig.resize && processingConfig.resize.enabled) {
                // 1. Resize
                const resizeDimension = processingConfig.resize.dimension;

                if (resizeDimension) {

                    const resizeResults: any[] = await processLemGendaryResize(
                        [image],
                        parseInt(resizeDimension),
                        {
                            quality: processingConfig.output.quality || 0.8,
                            format: 'webp' // Intermediate format
                        }
                    );

                    if (resizeResults.length > 0 && resizeResults[0].resized) {
                        processedFile = resizeResults[0].resized;
                        if (resizeResults[0].upscaleScale) {
                            (image as any).aiUpscaleScale = resizeResults[0].upscaleScale;
                        }
                        if (resizeResults[0].error) {
                            throw resizeResults[0].error;
                        }
                    }
                }
            }

            if (processingConfig.crop && processingConfig.crop.enabled) {
                const { width, height, mode, position } = processingConfig.crop;

                // Pass skipOptimization: true to ensure we don't double-compress or filter yet
                const cropOptions = {
                    quality: processingConfig.output.quality || 0.8,
                    format: IMAGE_FORMATS.WEBP,
                    skipOptimization: true
                };

                if (mode === CROP_MODES.SMART && aiModelLoaded) {
                    try {
                        processedFile = await (processSmartCrop as any)(
                            processedFile,
                            width,
                            height,
                            {
                                ...cropOptions,
                                cropMode: CROP_MODES.SMART,
                                cropPosition: position
                            }
                        );
                    } catch {
                        processedFile = await (processSimpleSmartCrop as any)(
                            processedFile,
                            width,
                            height,
                            position || 'center',
                            cropOptions
                        );
                    }
                } else {
                    const cropResults: any[] = await processLemGendaryCrop(
                        [{ file: processedFile, name: image.name }],
                        width,
                        height,
                        position || 'center',
                        cropOptions
                    );

                    if (cropResults.length > 0 && cropResults[0].cropped) {
                        processedFile = cropResults[0].cropped;
                    }
                }
            }


            const outputFormats = processingConfig.output?.formats || [IMAGE_FORMATS.WEBP];

            // Verify configuration


            for (const format of outputFormats) {
                // Determine if we need to force optimization (for watermark or filter) even on original format
                const needsProcessing = processingConfig.watermark?.enabled ||
                    (filter && filter !== IMAGE_FILTERS.NONE);



                if (format === IMAGE_FORMATS.ORIGINAL && !needsProcessing) {
                    // const originalFormat = (image as any).originalFormat || image.type.split('/')[1];
                    processedImages.push({
                        ...image,
                        file: processedFile,
                        name: image.name,
                        type: image.type,
                        processed: false,
                        isOriginal: true
                    });
                } else {
                    // 3. Filter & Optimize (Compression / Format Conversion)
                    // If format is ORIGINAL but we need processing, use the current file's type as target format
                    const targetFormat = format === IMAGE_FORMATS.ORIGINAL
                        ? (processedFile.type ? processedFile.type.split('/')[1] : 'png')
                        : format;

                    // This creates the final Blob/File
                    // Final optimization and watermark
                    const optimizedFile: Blob = await processLengendaryOptimize(
                        processedFile,
                        processingConfig.output.quality || 0.8,
                        targetFormat,
                        filter,
                        (processingConfig.output as any).targetSize,
                        processingConfig // Pass full config which includes watermark
                    );

                    // 4. Rename Logic (Post-Optimization)
                    let fileName = image.name;
                    if ((processingConfig.processingMode as any) === PROCESSING_MODES.BATCH_RENAME && processingConfig.batchRename) {
                        const renameOptions = processingConfig.batchRename;
                        fileName = generateNewFileName(image.name, i, renameOptions);

                        if (format !== IMAGE_FORMATS.ORIGINAL) {
                            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                            fileName = `${nameWithoutExt}.${format}`;
                        }
                    } else if (processingConfig.output?.rename && processingConfig.output?.newFileName) {
                        const targetExt = format === 'original' ?
                            fileName.split('.').pop() : format;

                        const nameWithoutExt = image.name.replace(/\.[^/.]+$/, "");
                        const virtualName = `${nameWithoutExt}.${targetExt}`;
                        let pattern = processingConfig.output.newFileName;

                        if (!/\{[^}]+\}/.test(pattern)) {
                            pattern = `${pattern}-{counter}`;
                        }

                        const renameOptions = {
                            ...(processingConfig.batchRename || {}),
                            pattern: pattern,
                        };

                        fileName = generateNewFileName(virtualName, i, renameOptions);
                    } else if (!fileName.includes(`.${format}`)) {
                        // Auto-suffix logic if NO strict rename is applied
                        let suffix = '';
                        if (processingConfig.resize?.enabled) {
                            suffix += `-${processingConfig.resize.dimension}`;
                        }
                        const cropConfig = (processingConfig as any).crop;
                        if (cropConfig?.enabled) {
                            const cropType = cropConfig.mode === 'smart' ? 'smart' : 'crop';
                            suffix += `-${cropType}-${cropConfig.width}x${cropConfig.height}`;
                        }
                        if (filter && filter !== IMAGE_FILTERS.NONE) {
                            suffix += `-${filter}`;
                        }
                        // if ((processingConfig.output.quality || 0.8) < 1) {
                        //    const qualityPercent = Math.round((processingConfig.output.quality || 0.8) * 100);
                        //    suffix += `-q${qualityPercent}`;
                        // }

                        fileName = fileName.replace(/\.[^/.]+$/, '') +
                            (suffix || '') +
                            `.${format}`;
                    }

                    processedImages.push({
                        ...image,
                        file: optimizedFile as File,
                        name: fileName,
                        type: `image/${format}`,
                        format: format,
                        processed: true
                    } as any);
                }
            }

            if (i % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                safeCleanupGPUMemory();
            }

        } catch (error: any) {
            // Critical error processing image
            processedImages.push({
                ...image,
                error: error.message,
                processed: false
            });
        } finally {
            // Memory management - cleanup GPU tensors every few images
            if (i % 3 === 0) {
                safeCleanupGPUMemory();
            }
        }
    }

    safeCleanupGPUMemory();
    return processedImages;
};

/**
 * Orchestrates template processing
 */
export const orchestrateTemplateProcessing = async (
    selectedImage: ImageFile,
    selectedTemplateIds: string[],
    templateConfigs: TemplateConfig[],
    useSmartCrop: boolean = false,
    aiModelLoaded: boolean = false,
    onProgress: ((stage: string, percent: number) => void) | null = null,
    processingOptions: any = {}
): Promise<ImageFile[]> => {
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
        .filter(template => template) as TemplateConfig[];

    if (onProgress) onProgress('processing', 30);

    const processedImages: ImageFile[] = [];

    // Handle screenshot templates
    let screenshotTemplates: any[] = [];
    if (includeScreenshots && processingOptions.selectedScreenshotTemplates && processingOptions.selectedScreenshotTemplates.length > 0) {
        screenshotTemplates = processingOptions.selectedScreenshotTemplates
            .map((id: string) => (SCREENSHOT_TEMPLATES as any)[id])
            .filter((t: any) => t);
    }

    const allTemplates = [...regularTemplates, ...screenshotTemplates];

    if (allTemplates.length > 0) {
        if (onProgress) onProgress('processing-templates', 40);

        const templateImages: ImageFile[] = await (processTemplateImages as any)(
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

    return processedImages.filter(img => img && img.name && (img.file || (img as any).blob));
};
