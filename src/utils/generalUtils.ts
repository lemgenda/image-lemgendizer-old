import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    processLengendaryOptimize,
    processTemplateImages,
    processLemGendaryRestoration
} from '../processors';
import { generateNewFileName } from './renameUtils';
import { safeCleanupGPUMemory } from './memoryUtils';
import { detectObjectsInWorker } from './aiWorkerUtils';
import { getImageDimensions } from './appUtils';
import { isSVGFile } from './svgUtils';
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
    t: (key: string, params?: any) => string,
    onProgress?: (progress: any) => void
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
        let processedFile: File | Blob = image.file;
        let restorationError = null;

        // Base weights for stages (Relative complexity)
        // Round 62: Dynamic Weighting to fix "90% at 25%" stall.
        // We now calculate total weight based on ENABLED features only.
        const RAW_WEIGHTS = {
            PREPARING: 2,
            RESTORATION: 80, // Heavy (MPRNet/NAFNet)
            COLOR_PRE: 5,    // Fast (LUT/Gamma)
            CROP: 10,        // Fast (or Smart Crop = Medium)
            ULTRAZOOM: 40,   // Heavy (Real-ESRGAN/SwinIR)
            POLISH: 5        // Fast (Encoding)
        };

        // Calculate active weights based on config
        const ACTIVE_WEIGHTS = {
            PREPARING: RAW_WEIGHTS.PREPARING,
            RESTORATION: (processingConfig.restoration?.enabled) ? RAW_WEIGHTS.RESTORATION : 0,
            COLOR_PRE: (processingConfig.colorCorrection?.enabled) ? RAW_WEIGHTS.COLOR_PRE : 0,
            CROP: (processingConfig.crop?.enabled) ? RAW_WEIGHTS.CROP : 0,
            ULTRAZOOM: 0, // Calculated dynamically below
            POLISH: RAW_WEIGHTS.POLISH
        };

        // Check UltraZoom trigger (same logic as below)
        const targetWidth = Number(processingConfig.crop?.enabled ? processingConfig.crop.width : (processingConfig.resize?.enabled ? processingConfig.resize.dimension : 0));
        const targetHeight = Number(processingConfig.crop?.enabled ? processingConfig.crop.height : (processingConfig.resize?.enabled ? processingConfig.resize.dimension : 0));
        if (targetWidth > 0 || targetHeight > 0) {
            // We assume upscale might happen if resize is on.
            // Exact check requires async image load, but for progress bar, assuming YES is safer (avoids stall).
            ACTIVE_WEIGHTS.ULTRAZOOM = RAW_WEIGHTS.ULTRAZOOM;
        }

        const TOTAL_WEIGHT = Object.values(ACTIVE_WEIGHTS).reduce((a, b) => a + b, 0);

        let currentBaseProgress = 0;

        // Helper to report progress normalized to Total Weight
        const reportProgress = (stageKey: keyof typeof RAW_WEIGHTS, stageLabel: string, granular: number = 0, tileData?: any) => {
            if (onProgress) {
                const stageWeight = ACTIVE_WEIGHTS[stageKey] || 0;
                // standard: (granular% * stageWeight)
                const stageProgressRaw = (granular / 100) * stageWeight;

                // standard: (currentBase + stageProgress) / TOTAL_WEIGHT * 100
                // This converts the sum of relative weights into a 0-100% scale.
                const totalProgress = ((currentBaseProgress + stageProgressRaw) / TOTAL_WEIGHT) * 100;

                let displayOperation = stageLabel;
                if (tileData && tileData.current && tileData.total && !stageLabel.toLowerCase().includes('warm') && !stageLabel.toLowerCase().includes('przygot')) {
                    displayOperation = `${stageLabel} (${t('processing.tile', { current: tileData.current, total: tileData.total })})`;
                } else if (tileData && tileData.currentOperation) {
                    displayOperation = tileData.currentOperation;
                }

                onProgress({
                    processedCount: i,
                    totalCount: images.length,
                    currentFile: image.name,
                    currentOperation: displayOperation,
                    granularProgress: totalProgress, // This is now the REAL % for the file
                    tileProgress: tileData
                });
            }
        };

        // Helper to advance base progress when stage completes
        const finishStage = (stageKey: keyof typeof RAW_WEIGHTS) => {
            currentBaseProgress += ACTIVE_WEIGHTS[stageKey];
        };

        reportProgress('PREPARING', t('processing.preparing'), 100);
        finishStage('PREPARING');

        try {
            // --- STAGE 0: ANALYSIS & DETECTION (YOLO v8) ---
            let externalDetections: any[] | undefined;
            let originalDimensions = { width: 0, height: 0 };

            if (processingConfig.crop?.enabled || processingConfig.resize?.enabled) {
                const dims = await getImageDimensions(processedFile as File, isSVGFile(processedFile as File));
                originalDimensions = dims;
            }

            if (processingConfig.crop?.enabled && processingConfig.crop.mode === CROP_MODES.SMART) {
                reportProgress('PREPARING', t('processing.analyzing'), 50);
                try {
                    // detectObjectsInWorker handles its own image loading/conversion
                    externalDetections = await detectObjectsInWorker(processedFile);
                } catch (e) {
                    console.warn('[Orchestrator] YOLO Detection failed, falling back to internal detection:', e);
                }
            }

            // --- STAGE 1: RESTORATION (Signal Cleanup) ---
            if (processingConfig.restoration && processingConfig.restoration.enabled) {
                const selectedModels = processingConfig.restoration.selectedModels ||
                    (processingConfig.restoration.modelName ? [processingConfig.restoration.modelName] : []);

                // Round 30: Pipeline Ordering (Safety Gate)
                // Enforce Denoise -> Deblur ordering to prevent artifact explosion.
                // Denoising models stabilize the image before deconvolution.
                const ORDER_PRIORITY: Record<string, number> = {
                    'denoising': 0,
                    'lowlight': 1,
                    'deraining': 2,
                    'dehazing': 3,
                    'restoration': 4,
                    'deblurring': 5, // Deblur must be LAST
                    'deblurgan': 5
                };

                const getPriority = (name: string) => {
                    const n = name.toLowerCase();
                    for (const [key, p] of Object.entries(ORDER_PRIORITY)) {
                        if (n.includes(key)) return p;
                    }
                    return 2.5; // Default middle property
                };

                // Sort in-place (or create copy)
                selectedModels.sort((a, b) => getPriority(a) - getPriority(b));


                for (let mIdx = 0; mIdx < selectedModels.length; mIdx++) {
                    const modelId = selectedModels[mIdx];
                    try {
                        const totalModels = selectedModels.length;
                        const modelPrefix = totalModels > 1 ? `[${mIdx + 1}/${totalModels}] ` : '';

                        const modelLabelMap: Record<string, string> = {
                            'MPRNet-Deraining': 'restoration.model.deraining',
                            'FFANet-Dehazing(Indoor)': 'restoration.model.dehazing_indoor',
                            'FFANet-Dehazing(Outdoor)': 'restoration.model.dehazing_outdoor',
                            'MIRNet(v2)-LowLight': 'restoration.model.lowlight',
                            'NAFNet-Debluring(REDS)': 'restoration.model.image-deblurring',
                            'NAFNet-Denoising': 'restoration.model.denoising',
                        };
                        const modelName = t(modelLabelMap[modelId] || modelId);

                        reportProgress('RESTORATION', `${modelPrefix}${modelName}`, 0);
                        processedFile = await processLemGendaryRestoration(
                            processedFile as File,
                            modelId,
                            (p) => {
                                const percent = (p.current / p.total) * 100;
                                if (onProgress) {
                                    const restorationGranular = (mIdx * (100 / totalModels)) + (percent / totalModels);
                                    reportProgress('RESTORATION', `${modelPrefix}${modelName}`, restorationGranular, p);
                                }
                            }
                        );
                    } catch (err: any) {
                        restorationError = err.message || 'Restoration failed';
                        throw new Error(`Restoration failed: ${restorationError}`);
                    }
                }
                // Propagate metadata after restoration
                if ((processedFile as any).restorationApplied) {
                    (image as any).restorationApplied = (processedFile as any).restorationApplied;
                }
            }
            safeCleanupGPUMemory();
            finishStage('RESTORATION');

            // --- STAGE 2: COLOR PRE-CORRECTION (Pre-SR) ---
            if (processingConfig.colorCorrection && processingConfig.colorCorrection.enabled) {
                reportProgress('COLOR_PRE', t('color.correction'), 50);
                // We'll apply just the color correction part here
                processedFile = await processLengendaryOptimize(
                    processedFile as File,
                    1.0, // Lossless intermediate
                    IMAGE_FORMATS.ORIGINAL,
                    IMAGE_FILTERS.NONE,
                    null,
                    { colorCorrection: processingConfig.colorCorrection } // NO artistic filters or watermarks here
                );
            }
            finishStage('COLOR_PRE');

            // --- STAGE 3: CROP / SMART CROP ---
            if (processingConfig.crop && processingConfig.crop.enabled) {
                const { width, height, mode, position } = processingConfig.crop;

                const cropOptions = {
                    quality: 1.0, // Lossless intermediate
                    format: IMAGE_FORMATS.WEBP,
                    skipOptimization: true,
                    cropMode: mode,
                    originalDimensions,
                    // Round 22: Always skip internal resizing in crop stage.
                    // We extract the ROI at native resolution and let UltraZoom (AI SR) handle target dimensions.
                    skipUpscale: true
                };

                if (mode === CROP_MODES.SMART) {
                    reportProgress('CROP', t('crop.smart'), 50);
                    try {
                        processedFile = await (processSmartCrop as any)(
                            processedFile,
                            width,
                            height,
                            cropOptions,
                            externalDetections
                        );
                    } catch {
                        processedFile = await (processSimpleSmartCrop as any)(
                            processedFile,
                            width,
                            height,
                            position || 'center',
                            cropOptions
                        );
                        (image as any).isSmartCropFallback = true;
                    }
                } else {
                    reportProgress('CROP', t('crop.standard'), 50);
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
                // Propagate crop metadata
                if ((processedFile as any).aiSmartCrop) (image as any).aiSmartCrop = true;
                if ((processedFile as any).isSmartCropFallback) (image as any).isSmartCropFallback = true;

                reportProgress('CROP', mode === CROP_MODES.SMART ? t('crop.smart') : t('crop.standard'), 100);
            }
            safeCleanupGPUMemory();
            finishStage('CROP');

            // --- STAGE 4: ULTRAZOOM (ROI-Aware Upscaling) ---
            const targetWidth = Number(processingConfig.crop?.enabled ? processingConfig.crop.width : (processingConfig.resize?.enabled ? processingConfig.resize.dimension : 0));
            const targetHeight = Number(processingConfig.crop?.enabled ? processingConfig.crop.height : (processingConfig.resize?.enabled ? processingConfig.resize.dimension : 0));

            let needsUpscale = false;
            if (targetWidth > 0 || targetHeight > 0) {
                const currentDims = await getImageDimensions(processedFile as File, isSVGFile(processedFile as File));
                // Round 22: Always trigger UltraZoom if Resize is enabled OR if crop created a smaller image
                if ((processingConfig.resize && processingConfig.resize.enabled) ||
                    currentDims.width < targetWidth ||
                    currentDims.height < targetHeight) {
                    needsUpscale = true;
                    console.log(`[Orchestrator] UltraZoom triggered: current ${currentDims.width}x${currentDims.height}, target ${targetWidth}x${targetHeight}`);
                }
            }

            if (needsUpscale) {
                const resizeDimension = Math.max(targetWidth, targetHeight) || Number(processingConfig.resize?.dimension);
                if (resizeDimension) {
                    reportProgress('ULTRAZOOM', t('resize.title'), 0);
                    const upscaleResults: any[] = await processLemGendaryResize(
                        [{ file: processedFile, name: image.name }],
                        resizeDimension,
                        {
                            quality: 1.0, // Lossless intermediate
                            format: IMAGE_FORMATS.WEBP
                        },
                        (p) => {
                            const percent = (p.current / p.total) * 100;
                            reportProgress('ULTRAZOOM', t('resize.title'), percent, p);
                        }
                    );

                    if (upscaleResults.length > 0 && upscaleResults[0].resized) {
                        processedFile = upscaleResults[0].resized;
                        if (upscaleResults[0].aiUpscaleScale) {
                            (image as any).aiUpscaleScale = upscaleResults[0].aiUpscaleScale;
                            (image as any).aiUpscaleModel = upscaleResults[0].aiUpscaleModel;
                        } else if (upscaleResults[0].upscaleScale) {
                            // Fallback for key name variation
                            (image as any).aiUpscaleScale = upscaleResults[0].upscaleScale;
                            (image as any).aiUpscaleModel = upscaleResults[0].upscaleModel;
                        }
                    }
                }
            }
            safeCleanupGPUMemory();
            finishStage('ULTRAZOOM');

            const outputFormats = processingConfig.output?.formats || [IMAGE_FORMATS.WEBP];

            for (let fIdx = 0; fIdx < outputFormats.length; fIdx++) {
                const format = outputFormats[fIdx];

                const needsProcessing = processingConfig.watermark?.enabled ||
                    (filter && filter !== IMAGE_FILTERS.NONE) ||
                    processingConfig.colorCorrection?.enabled;

                if (format === IMAGE_FORMATS.ORIGINAL && !needsProcessing) {
                    processedImages.push({
                        ...image,
                        file: processedFile as File,
                        name: image.name,
                        type: (processedFile as File).type || image.type,
                        processed: false,
                        isOriginal: true
                    });
                    reportProgress('POLISH', t('processing.complete'), ((fIdx + 1) / outputFormats.length) * 100);
                } else {
                    const stageLabel = (filter && filter !== IMAGE_FILTERS.NONE) ? 'Filtering & Optimizing' : 'Optimizing';
                    reportProgress('POLISH', stageLabel, (fIdx / outputFormats.length) * 100);

                    const targetFormat = format === IMAGE_FORMATS.ORIGINAL
                        ? (processedFile.type ? processedFile.type.split('/')[1] : 'png')
                        : format;

                    const optimizedFile: Blob = await processLengendaryOptimize(
                        processedFile as File,
                        processingConfig.output?.quality || 0.8,
                        targetFormat,
                        filter,
                        (processingConfig.output as any)?.targetSize,
                        { ...processingConfig, colorCorrection: undefined }
                    );

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
        } catch (error: any) {
            processedImages.push({
                ...image,
                error: error.message,
                processed: false
            });
        } finally {
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
    // aiModelLoaded: boolean = false, // Removed
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
            selectedImage, // Use original image for templates
            allTemplates,
            useSmartCrop
        );

        // Apply restoration AFTER cropping per user request V88
        if (processingOptions.restoration && processingOptions.restoration.enabled) {
            const selectedModels = processingOptions.restoration.selectedModels ||
                (processingOptions.restoration.modelName ? [processingOptions.restoration.modelName] : []);

            if (onProgress) onProgress('restoring', 60);

            for (let i = 0; i < templateImages.length; i++) {
                for (let mIdx = 0; mIdx < selectedModels.length; mIdx++) {
                    const modelId = selectedModels[mIdx];
                    try {
                        const totalModels = selectedModels.length;
                        const restoredFile = await processLemGendaryRestoration(
                            templateImages[i].file,
                            modelId,
                            (p) => {
                                if (onProgress) {
                                    const basePercent = 60;
                                    const totalRestorationPercent = 30; // 60 -> 90
                                    const fileWeight = 1 / templateImages.length;
                                    const modelWeight = 1 / totalModels;

                                    const granular = basePercent +
                                        (i * fileWeight * totalRestorationPercent) +
                                        (mIdx * fileWeight * modelWeight * totalRestorationPercent) +
                                        (p.current / p.total * fileWeight * modelWeight * totalRestorationPercent);

                                    onProgress(`restoring ${mIdx + 1}/${totalModels}`, Math.round(granular));
                                }
                            }
                        );
                        templateImages[i].file = restoredFile;
                    } catch (error) {
                        console.error(`Restoration (${modelId}) failed for template result:`, error);
                        // Continue with next model or next image
                    }
                }
            }
        }

        processedImages.push(...templateImages);
    }

    if (onProgress) onProgress('finalizing', 90);

    await new Promise(resolve => setTimeout(resolve, 100));
    safeCleanupGPUMemory();

    if (onProgress) onProgress('completed', 100);

    return processedImages.filter(img => img && img.name && (img.file || (img as any).blob));
};
