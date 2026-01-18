/**
 * @file imageProcessor.ts
 * @description Core image processing orchestrator. Handles resizing, cropping, and optimization
 * workflow using various sub-processors (filter, crop, resize).
 */
import UTIF from 'utif';
import {
    MIME_TYPE_MAP,
    LEGACY_FORMATS,
    TIFF_FORMATS,
    ERROR_MESSAGES,
    FILE_EXTENSIONS,
    PROCESSING_ERRORS,
    DEFAULT_QUALITY,
    PROCESSING_MODES,
    CROP_MODES,
    IMAGE_FORMATS,
    IMAGE_FILTERS
} from '../constants';

import { applyImageFilter } from './filterProcessor';
import { applyWatermark } from './watermarkProcessor';


import { DEFAULT_PLACEHOLDER_DIMENSIONS, APP_TEMPLATE_CONFIG } from '../configs/templateConfigs';
import { TemplateConfig, ProcessingOptions } from '../types';

import {
    createTIFFPlaceholderFile,
    ensureFileObject,
    checkImageTransparency,
    isSVGFile,
    convertSVGToRaster,
    resizeSVG,
    getSVGDimensions,
    createSVGErrorPlaceholder,
    createErrorPlaceholder,
    createSVGPlaceholderWithAspectRatio,
    createSimpleLegacyConversion,
    convertTIFFForProcessing
} from '../utils';
// Note: legacyConverter was aliased from convertLegacyFormat
import { convertLegacyFormat as legacyConverter } from '../utils';

import {
    resizeImageWithAI,
} from './resizeProcessor';

import {
    processSmartCrop,
    processTemplateSmartCrop,
    processStandardCrop,
    processSVGCrop
} from './cropProcessor';


// Set UTIF globally for library compatibility
if (typeof window !== 'undefined' && !(window as any).UTIF) {
    (window as any).UTIF = UTIF;
}

/**
 * Processes LemGendary resize operation
 */
export const processLemGendaryResize = async (images: any[], dimension: number, options: { quality?: number; format?: string } = { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }): Promise<any[]> => {

    const results: any[] = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);
            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isSVG = isSVGFile(imageFile);
            const isTIFF = TIFF_FORMATS.includes(mimeType) || FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));

            const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
            const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
            const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

            let processedFile: File | undefined;
            const conversionError: string | null = null;

            if (isSVG) {
                try {
                    const dimensions = await getSVGDimensions(imageFile);
                    let newWidth, newHeight;

                    if (dimensions.width >= dimensions.height) {
                        newWidth = dimension;
                        newHeight = Math.round(dimension / dimensions.aspectRatio);
                    } else {
                        newHeight = dimension;
                        newWidth = Math.round(dimension * dimensions.aspectRatio);
                    }

                    const resizedSVG = await resizeSVG(imageFile, newWidth, newHeight);
                    processedFile = await convertSVGToRaster(resizedSVG, newWidth, newHeight, options.format || IMAGE_FORMATS.WEBP);

                    results.push({
                        original: { ...image, file: imageFile, originalDimensions: dimensions },
                        resized: processedFile,
                        dimensions: { width: newWidth, height: newHeight },
                        isSVG: true,
                        optimized: true,
                        aspectRatioPreserved: true,
                        originalAspectRatio: dimensions.aspectRatio,
                        format: options.format || IMAGE_FORMATS.WEBP
                    });

                } catch (svgError: any) {
                    const errorFile = await createSVGErrorPlaceholder(image, dimension, svgError.message);
                    results.push({
                        original: image,
                        resized: errorFile,
                        dimensions: { width: dimension, height: dimension },
                        isSVG: true,
                        optimized: false,
                        error: svgError.message,
                        aspectRatioPreserved: false
                    });
                }
            } else {
                try {
                    let processableFile = imageFile;
                    if (isTIFF) {
                        try {
                            processableFile = await convertTIFFForProcessing(imageFile);
                        } catch (_err: any) {
                            if (isTIFF) {
                                processableFile = await createTIFFPlaceholderFile(imageFile, dimension, dimension);
                            }
                        }
                    } else if (isBMP || isGIF || isICO) {
                        try {
                            processableFile = await legacyConverter(imageFile);
                        } catch { /* ignored */ }
                    }

                    const resizeResult = await (resizeImageWithAI as any)(processableFile, dimension, options);
                    processedFile = resizeResult.file;

                    results.push({
                        original: { ...image, file: imageFile },
                        resized: processedFile,
                        dimensions: { width: dimension, height: dimension },
                        isSVG: false,
                        isTIFF: isTIFF,
                        isLegacy: isBMP || isGIF || isICO,
                        optimized: true,
                        processLemGendaryResize: true,
                        upscaleScale: resizeResult.scale,
                        upscaleModel: resizeResult.model,
                        aspectRatioPreserved: true,
                        error: conversionError,
                        format: options.format || IMAGE_FORMATS.WEBP
                    });

                } catch (error: any) {
                    const errorFile = await createErrorPlaceholder(image, dimension, error.message);
                    results.push({
                        original: image,
                        resized: errorFile,
                        dimensions: { width: dimension, height: dimension },
                        isSVG: false,
                        isTIFF: isTIFF,
                        optimized: false,
                        error: error.message
                    });
                }
            }
        } catch (error: any) {
            const errorFile = await createErrorPlaceholder(image, dimension, error.message);
            results.push({
                original: image,
                resized: errorFile,
                dimensions: { width: dimension, height: dimension },
                isSVG: false,
                optimized: false,
                error: error.message
            });
        }
    }
    return results;
};

/**
 * Processes image crop operation
 */
export const processLemGendaryCrop = async (
    images: any[],
    width: number,
    height: number,
    cropPosition: string = 'center',
    options: { quality?: number; format?: string; cropMode?: string; skipOptimization?: boolean } = { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
): Promise<any[]> => {
    const results: any[] = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);
            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isTIFF = TIFF_FORMATS.includes(mimeType) || FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
            const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
            const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
            const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));
            const isSVG = mimeType === 'image/svg+xml' || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext));

            let croppedFile: File;

            if (isSVG) {
                croppedFile = await (processSVGCrop as any)(imageFile, width, height);
            } else {
                let processableFile = imageFile;
                if (isTIFF) {
                    try {
                        processableFile = await convertTIFFForProcessing(imageFile);
                    } catch {
                        if (isTIFF) {
                            processableFile = await createTIFFPlaceholderFile(imageFile, width, height);
                        }
                    }
                } else if (isBMP || isGIF || isICO) {
                    try {
                        processableFile = await legacyConverter(imageFile);
                    } catch { /* ignored */ }
                }

                if (options.cropMode === CROP_MODES.SMART) {
                    croppedFile = await (processSmartCrop as any)(processableFile, width, height, {
                        ...options,
                        cropMode: CROP_MODES.SMART,
                        cropPosition
                    });
                } else {
                    croppedFile = await (processStandardCrop as any)(processableFile, width, height, cropPosition, options);
                }
            }

            let optimizedFile: File;
            if (options.skipOptimization) {
                optimizedFile = croppedFile;
            } else {
                optimizedFile = await processLengendaryOptimize(croppedFile, options.quality, options.format);
            }

            results.push({
                original: image,
                cropped: optimizedFile,
                dimensions: { width, height },
                isSVG: isSVG,
                isTIFF: isTIFF,
                optimized: true,
                cropMode: options.cropMode || CROP_MODES.STANDARD,
                cropPosition: cropPosition,
                format: options.format || IMAGE_FORMATS.WEBP
            });

        } catch (error: any) {
            if (image.file?.type === 'image/svg+xml') {
                try {
                    const rasterFile = await convertSVGToRaster(image.file, width, height, IMAGE_FORMATS.PNG);
                    const croppedFile = await (processStandardCrop as any)(rasterFile, width, height, cropPosition, options);
                    const optimizedFile = await processLengendaryOptimize(croppedFile, options.quality, options.format);

                    results.push({
                        original: image,
                        cropped: optimizedFile,
                        dimensions: { width, height },
                        isSVG: true,
                        isTIFF: false,
                        optimized: true,
                        cropMode: options.cropMode || CROP_MODES.STANDARD,
                        cropPosition: cropPosition
                    });
                    continue;
                } catch { /* ignored */ }
            }

            const errorFile = await createErrorPlaceholder(image, width, height, 'Crop Error', error.message);
            const optimizedErrorFile = await processLengendaryOptimize(errorFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedErrorFile,
                dimensions: { width, height },
                isSVG: image.file?.type === 'image/svg+xml',
                isTIFF: (image as any).isTIFF || false,
                optimized: false,
                error: error.message
            });
        }
    }
    return results;
};

/**
 * Processes images for template requirements
 */
export const processImagesForTemplates = async (images: any[], templates: TemplateConfig[], options: any = {}): Promise<any[]> => {
    const results: any[] = [];

    for (const image of images) {
        const imageResults: any[] = [];

        for (const template of templates) {
            try {
                const croppedFile = await (processTemplateSmartCrop as any)(
                    image.file,
                    template,
                    options
                );

                const optimizedFile = await processLengendaryOptimize(
                    croppedFile,
                    template.quality || options.quality || DEFAULT_QUALITY,
                    template.format || options.format || IMAGE_FORMATS.WEBP
                );

                imageResults.push({
                    template: template.name,
                    description: template.description,
                    file: optimizedFile,
                    dimensions: { width: template.width, height: template.height },
                    aspectRatio: template.aspectRatio ||
                        (typeof template.width === 'number' && typeof template.height === 'number'
                            ? template.width / template.height
                            : 1),
                    cropMode: template.cropMode,
                    success: true
                });

            } catch (error: any) {
                imageResults.push({
                    template: template.name,
                    description: template.description,
                    error: error.message,
                    success: false
                });
            }
        }

        results.push({
            original: image,
            templateResults: imageResults
        });
    }
    return results;
};

/**
 * Optimizes image for web delivery
 */
export const processLengendaryOptimize = async (
    imageFile: File,
    quality: number = DEFAULT_QUALITY,
    format: string = IMAGE_FORMATS.WEBP,
    filter: string = IMAGE_FILTERS.NONE,
    _targetSize: number | null = null,
    processingOptions: Partial<ProcessingOptions> = {}
): Promise<File> => {
    if (!imageFile || typeof imageFile !== 'object') {
        throw new Error(ERROR_MESSAGES.INVALID_IMAGE_FILE);
    }

    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    if (mimeType === 'image/svg+xml' || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext))) {
        try {
            return await convertSVGToRaster(imageFile, DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE, DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE, format);
        } catch {
            return await createSVGPlaceholderWithAspectRatio(imageFile, DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE, DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE, format);
        }
    }

    const isLegacyFormat = LEGACY_FORMATS.includes(mimeType) ||
        FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

    let processedFile = imageFile;

    if (isLegacyFormat) {
        try {
            processedFile = await legacyConverter(imageFile);
        } catch {
            if (TIFF_FORMATS.includes(mimeType)) {
                processedFile = await createTIFFPlaceholderFile(imageFile);
            } else {
                processedFile = await createSimpleLegacyConversion(imageFile);
            }
        }
    }

    if (format === IMAGE_FORMATS.ORIGINAL) {
        return isLegacyFormat ? processedFile : imageFile;
    }

    const hasTransparency = await checkImageTransparency(processedFile);
    const needsWhiteBackground = (format === IMAGE_FORMATS.JPG || format === IMAGE_FORMATS.JPEG) && hasTransparency;

    return new Promise((resolve, reject) => {
        const img = new Image();
        let objectUrl: string;

        try {
            objectUrl = URL.createObjectURL(processedFile);
        } catch {
            reject(new Error(PROCESSING_ERRORS.OBJECT_URL_FAILED));
            return;
        }

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
        }, 10000);

        img.onload = async () => {
            clearTimeout(timeout);
            try {
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error(PROCESSING_ERRORS.INVALID_IMAGE_DIMENSIONS));
                    return;
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error("Canvas context failed"));
                    return;
                }

                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                if (needsWhiteBackground) {
                    ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);

                // 4. Apply filter or color correction if selected (before watermark)
                const needsFilter = filter && filter !== IMAGE_FILTERS.NONE;
                const needsColorCorrection = processingOptions.colorCorrection?.enabled;

                if (needsFilter || needsColorCorrection) {
                    try {
                        const filteredCanvas = await applyImageFilter(
                            canvas,
                            filter || IMAGE_FILTERS.NONE,
                            processingOptions.colorCorrection
                        );
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(filteredCanvas, 0, 0);
                    } catch {
                        // Do not rethrow, so the image is at least saved without filter
                    }
                }

                // 5. Apply watermark if enabled (after filter)
                if (processingOptions?.watermark?.enabled) {
                    await applyWatermark(canvas, processingOptions.watermark as any);
                }

                const mimeStr = MIME_TYPE_MAP[format as keyof typeof MIME_TYPE_MAP] || MIME_TYPE_MAP.webp;
                const extension = format === IMAGE_FORMATS.ORIGINAL ? 'webp' : format.toLowerCase();

                canvas.toBlob(blob => {
                    URL.revokeObjectURL(objectUrl);
                    if (blob) {
                        const originalName = imageFile.name || 'image';
                        const baseName = originalName.replace(/\.[^/.]+$/, '');
                        const newName = `${baseName}.${extension}`;
                        resolve(new File([blob], newName, { type: mimeStr }));
                    } else {
                        reject(new Error('Image encoding failed'));
                    }
                }, mimeStr, quality);

            } catch (error: any) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Error processing image: ${error.message}`));
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
        };

        img.src = objectUrl;
    });
};

/**
 * Gets processing configuration from options
 */
export const getProcessingConfiguration = (processingOptions: any): any => {
    return {
        compression: {
            quality: (processingOptions.compression?.quality || 80) / 100,
            targetSize: processingOptions.compression?.fileSize ? parseInt(processingOptions.compression.fileSize) : null
        },
        output: {
            formats: processingOptions.output?.formats || [IMAGE_FORMATS.WEBP],
            rename: processingOptions.output?.rename || false,
            newFileName: processingOptions.output?.newFileName || ''
        },
        resize: {
            enabled: processingOptions.showResize || false,
            dimension: processingOptions.resizeDimension ? parseInt(processingOptions.resizeDimension) : 1200
        },
        crop: {
            enabled: !!processingOptions.showCrop,
            width: parseInt(processingOptions.cropWidth || '1080'),
            height: parseInt(processingOptions.cropHeight || '1080'),
            mode: processingOptions.cropMode || CROP_MODES.STANDARD,
            position: processingOptions.cropPosition || 'center'
        },
        templates: {
            selected: processingOptions.selectedTemplates || [],
            mode: processingOptions.processingMode || PROCESSING_MODES.CUSTOM
        },
        batchRename: processingOptions.batchRename || null,
        filters: {
            enabled: processingOptions.filters?.enabled || false,
            selectedFilter: processingOptions.filters?.selectedFilter || IMAGE_FILTERS.NONE
        },
        watermark: {
            enabled: processingOptions.watermark?.enabled || false,
            type: processingOptions.watermark?.type || 'text',
            text: processingOptions.watermark?.text || 'LEMGENDA',
            image: processingOptions.watermark?.image || null,
            position: processingOptions.watermark?.position || 'bottom-right',
            opacity: parseFloat(processingOptions.watermark?.opacity || '0.5'),
            size: processingOptions.watermark?.size || 'medium',
            color: processingOptions.watermark?.color || '#ffffff',
            fontSize: parseInt(processingOptions.watermark?.fontSize || '24'),
            repeat: !!processingOptions.watermark?.repeat
        },
        colorCorrection: processingOptions.colorCorrection ? {
            enabled: processingOptions.colorCorrection.enabled || false,
            brightness: parseFloat(processingOptions.colorCorrection.brightness || 0),
            contrast: parseFloat(processingOptions.colorCorrection.contrast || 0),
            saturation: parseFloat(processingOptions.colorCorrection.saturation || 0),
            vibrance: parseFloat(processingOptions.colorCorrection.vibrance || 0),
            exposure: parseFloat(processingOptions.colorCorrection.exposure || 0),
            hue: parseFloat(processingOptions.colorCorrection.hue || 0),
            sepia: parseFloat(processingOptions.colorCorrection.sepia || 0),
            gamma: parseFloat(processingOptions.colorCorrection.gamma || 1),
            noise: parseFloat(processingOptions.colorCorrection.noise || 0),
            clip: parseFloat(processingOptions.colorCorrection.clip || 0),
            sharpen: parseFloat(processingOptions.colorCorrection.sharpen || 0),
            stackBlur: parseFloat(processingOptions.colorCorrection.stackBlur || 0)
        } : undefined,
        processingMode: processingOptions.processingMode
    };
};
