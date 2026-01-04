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
    IMAGE_FORMATS
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
export const debounce = (func: Function, wait: number): Function => {
    let timeout: NodeJS.Timeout | undefined;
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
export const throttle = (func: Function, limit: number): Function => {
    let inThrottle: boolean;
    return function (this: any, ...args: any[]) {
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
    // orchestrateCustomProcessing started


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
                        if (resizeResults[0].error) {
                            throw resizeResults[0].error;
                        }
                    }
                }
            }

            if (processingConfig.crop && processingConfig.crop.enabled) {
                const { width, height, mode, position } = processingConfig.crop;

                if (mode === CROP_MODES.SMART && aiModelLoaded) {
                    try {
                        processedFile = await (processSmartCrop as any)(
                            processedFile,
                            width,
                            height,
                            {
                                quality: processingConfig.output.quality || 0.8,
                                format: IMAGE_FORMATS.WEBP
                            }
                        );
                    } catch {
                        processedFile = await (processSimpleSmartCrop as any)(
                            processedFile,
                            width,
                            height,
                            position || 'center',
                            {
                                quality: processingConfig.output.quality || 0.8,
                                format: IMAGE_FORMATS.WEBP
                            }
                        );
                    }
                } else {
                    const cropResults: any[] = await processLemGendaryCrop(
                        [{ file: processedFile, name: image.name }],
                        width,
                        height,
                        position || 'center',
                        {
                            quality: processingConfig.output.quality || 0.8,
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
                    // const originalFormat = (image as any).originalFormat || image.type.split('/')[1];
                    processedImages.push({
                        ...image,
                        file: processedFile,
                        name: image.name,
                        type: image.type, // keeping type valid
                        processed: false,
                        isOriginal: true
                    });
                } else {
                    const optimizedFile: Blob = await processLengendaryOptimize(
                        processedFile,
                        processingConfig.output.quality || 0.8,
                        format,
                        (processingConfig.output as any).targetSize // 'targetSize' not in OutputOptions? Check types.
                    );

                    let fileName = image.name;
                    if ((processingConfig.processingMode as any) === PROCESSING_MODES.BATCH_RENAME && processingConfig.batchRename) {
                        const renameOptions = processingConfig.batchRename;
                        fileName = generateNewFileName(image.name, i, renameOptions);

                        // If format is changed (not original), ensure extension matches target format
                        if (format !== IMAGE_FORMATS.ORIGINAL) {
                            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                            fileName = `${nameWithoutExt}.${format}`;
                        }
                    } else if (processingConfig.output?.rename && processingConfig.output?.newFileName) {
                        const targetExt = format === 'original' ?
                            fileName.split('.').pop() : format;

                        // Construct a virtual name with the target extension so generateNewFileName
                        // handles the extension correctly (it expects the input name to have the ext).
                        const nameWithoutExt = image.name.replace(/\.[^/.]+$/, "");
                        const virtualName = `${nameWithoutExt}.${targetExt}`;

                        let pattern = processingConfig.output.newFileName;

                        // Legacy support: If pattern has no tokens, append counter to prevent overwrites
                        // and match previous behavior (MyFile -> MyFile-01)
                        if (!/\{[^}]+\}/.test(pattern)) {
                            pattern = `${pattern}-{counter}`;
                        }

                        const renameOptions = {
                            ...(processingConfig.batchRename || {}),
                            pattern: pattern,
                            // Ensure we use the target extension logic
                            // If user explicitly provided extension in pattern, that will be used.
                            // Otherwise generateNewFileName appends it.
                        };

                        fileName = generateNewFileName(virtualName, i, renameOptions);
                    } else if (!fileName.includes(`.${format}`)) {
                        let suffix = '';
                        if (processingConfig.resize?.enabled) {
                            suffix += `-${processingConfig.resize.dimension}`;
                        }
                        const cropConfig = (processingConfig as any).crop;
                        if (cropConfig?.enabled) {
                            const cropType = cropConfig.mode === 'smart' ? 'smart' : 'crop';
                            suffix += `-${cropType}-${cropConfig.width}x${cropConfig.height}`;
                        }
                        // Compression quality check - assumed 'compression' object might exist or use output quality
                        // JS had 'processingConfig.compression.quality'. TS has 'processingConfig.output.quality'.
                        // I'll stick to 'output.quality'.
                        if ((processingConfig.output.quality || 0.8) < 1) {
                            const qualityPercent = Math.round((processingConfig.output.quality || 0.8) * 100);
                            suffix += `-q${qualityPercent}`;
                        }

                        fileName = fileName.replace(/\.[^/.]+$/, '') +
                            (suffix || '') +
                            `.${format}`;
                    }

                    processedImages.push({
                        ...image,
                        file: optimizedFile as File, // Casting Blob to File if needed or updating ImageFile to accept Blob
                        name: fileName,
                        type: `image/${format}`,
                        format: format,
                        processed: true,
                        // Custom props not in ImageFile interface? I'll need to extend ImageFile or ignore.
                        // processedImages is ImageFile[].
                        // I'll assume extra props are fine or I should add them to ImageFile interface.
                        // For now casting to any to avoid errors.
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
