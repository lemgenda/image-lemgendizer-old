import UTIF from 'utif';
import {
    MIME_TYPE_MAP,
    LEGACY_FORMATS,
    TIFF_FORMATS,
    ERROR_MESSAGES,
    FILE_EXTENSIONS,
    PROCESSING_ERRORS,
    DEFAULT_QUALITY,
    DEFAULT_JPG_QUALITY,
    PROCESSING_MODES,
    CROP_MODES,
    IMAGE_FORMATS
} from '../constants';

import { DEFAULT_PLACEHOLDER_DIMENSIONS, APP_TEMPLATE_CONFIG } from '../configs/templateConfigs';

import {
    convertLegacyFormat as legacyConverter,
    convertTIFFForProcessing,
    createTIFFPlaceholderFile,
    ensureFileObject,
    checkAVIFSupport,
    checkImageTransparency,
    isSVGFile,
    convertSVGToRaster,
    resizeSVG,
    getSVGDimensions,
    createSVGErrorPlaceholder,
    createErrorPlaceholder,
    createSVGPlaceholderWithAspectRatio,
    createSimpleLegacyConversion,
} from '../utils';

import {
    resizeImageWithAI,
} from './resizeProcessor';

import {
    processSmartCrop,
    processTemplateSmartCrop,
    processStandardCrop,
    processSVGCrop
} from './cropProcessor';

if (!window.UTIF) {
    window.UTIF = UTIF;
}

/**
 * Processes LemGendary resize operation
 * @param {Array<Object>} images - Array of image objects
 * @param {number} dimension - Target dimension
 * @param {Object} options - Processing options
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const processLemGendaryResize = async (images, dimension, options = { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }) => {
    const results = [];

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

            let processedFile;

            if (isSVG) {
                // Handle SVG resize
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
                        originalAspectRatio: dimensions.aspectRatio
                    });

                } catch (svgError) {
                    // SVG error handling
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
                // Handle regular or legacy image resize
                try {
                    let processableFile = imageFile;
                    let conversionError = null;

                    if (isTIFF || isBMP || isGIF || isICO) {
                        try {
                            processableFile = await legacyConverter(imageFile);
                        } catch (error) {
                            conversionError = error.message;
                            if (isTIFF) {
                                processableFile = await createTIFFPlaceholderFile(imageFile, dimension, dimension);
                            }
                        }
                    }

                    processedFile = await resizeImageWithAI(processableFile, dimension, options);

                    results.push({
                        original: { ...image, file: imageFile },
                        resized: processedFile,
                        dimensions: { width: dimension, height: dimension },
                        isSVG: false,
                        isTIFF: isTIFF,
                        isLegacy: isBMP || isGIF || isICO,
                        optimized: true,
                        aspectRatioPreserved: true,
                        error: conversionError
                    });

                } catch (error) {
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

        } catch (error) {
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
 * @param {Array<Object>} images - Array of image objects
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {string} cropPosition - Crop position
 * @param {Object} options - Processing options
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);

            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isTIFF = TIFF_FORMATS.includes(mimeType) ||
                FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
            const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
            const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
            const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));
            const isSVG = mimeType === 'image/svg+xml' || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext));

            let croppedFile;

            if (isSVG) {
                croppedFile = await processSVGCrop(imageFile, width, height);
            } else {
                let processableFile = imageFile;
                let conversionError = null;

                if (isTIFF || isBMP || isGIF || isICO) {
                    try {
                        processableFile = await legacyConverter(imageFile);
                    } catch (error) {
                        conversionError = error.message;
                        if (isTIFF) {
                            processableFile = await createTIFFPlaceholderFile(imageFile, width, height);
                        }
                    }
                }

                if (options.cropMode === CROP_MODES.SMART) {
                    croppedFile = await processSmartCrop(processableFile, width, height, {
                        ...options,
                        cropMode: CROP_MODES.SMART,
                        cropPosition
                    });
                } else {
                    croppedFile = await processStandardCrop(processableFile, width, height, cropPosition, options);
                }
            }

            const optimizedFile = await processLengendaryOptimize(croppedFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedFile,
                dimensions: { width, height },
                isSVG: isSVG,
                isTIFF: isTIFF,
                optimized: true,
                cropMode: options.cropMode || CROP_MODES.STANDARD,
                cropPosition: cropPosition
            });

        } catch (error) {
            if (image.file?.type === 'image/svg+xml') {
                try {
                    const rasterFile = await convertSVGToRaster(image.file, width, height, IMAGE_FORMATS.PNG);
                    const croppedFile = await processStandardCrop(rasterFile, width, height, cropPosition, options);
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
                } catch (fallbackError) {
                }
            }

            const errorFile = await createErrorPlaceholder(imageFile, width, height, 'Crop Error', error.message);
            const optimizedErrorFile = await processLengendaryOptimize(errorFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedErrorFile,
                dimensions: { width, height },
                isSVG: image.file?.type === 'image/svg+xml',
                isTIFF: image.isTIFF || false,
                optimized: false,
                error: error.message
            });
        }
    }

    return results;
};

/**
 * Processes images for template requirements
 * @param {Array<Object>} images - Array of image objects
 * @param {Array<Object>} templates - Array of template configurations
 * @param {Object} options - Processing options
 * @returns {Promise<Array<Object>>} Processed images
 */
export const processImagesForTemplates = async (images, templates, options = {}) => {
    const results = [];

    for (const image of images) {
        const imageResults = [];

        for (const template of templates) {

            try {
                const croppedFile = await processTemplateSmartCrop(
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
                    aspectRatio: template.aspectRatio,
                    cropMode: template.cropMode,
                    success: true
                });

            } catch (error) {

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
 * @param {File} imageFile - Image file
 * @param {number} quality - Quality level
 * @param {string} format - Output format
 * @returns {Promise<File>} Optimized image file
 */
export const processLengendaryOptimize = async (imageFile, quality = DEFAULT_QUALITY, format = IMAGE_FORMATS.WEBP, targetSize = null) => {
    if (!imageFile || typeof imageFile !== 'object') {
        throw new Error(ERROR_MESSAGES.INVALID_IMAGE_FILE);
    }

    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isTIFF = TIFF_FORMATS.includes(mimeType) ||
        FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));

    if (mimeType === 'image/svg+xml' || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext))) {
        try {
            return await convertSVGToRaster(imageFile,
                DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE,
                DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE,
                format);
        } catch (svgError) {
            return await createSVGPlaceholderWithAspectRatio(imageFile,
                DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE,
                DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE,
                format);
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
        } catch (error) {
            if (isTIFF) {
                processedFile = await createTIFFPlaceholderFile(imageFile);
            } else {
                processedFile = await createSimpleLegacyConversion(imageFile);
            }
        }
    }

    if (format === IMAGE_FORMATS.ORIGINAL) {
        if (isLegacyFormat) {
            return processedFile;
        }
        return imageFile;
    }

    const supportsAVIF = await checkAVIFSupport();
    const hasTransparency = await checkImageTransparency(processedFile);

    const needsWhiteBackground = (format === IMAGE_FORMATS.JPG || format === IMAGE_FORMATS.JPEG) && hasTransparency;

    return new Promise((resolve, reject) => {
        const img = new Image();
        let objectUrl;

        try {
            objectUrl = URL.createObjectURL(processedFile);
        } catch (error) {
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
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                if (needsWhiteBackground) {
                    ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);

                let mimeType, extension;
                let currentQuality = quality;

                switch (format.toLowerCase()) {
                    case IMAGE_FORMATS.JPG:
                    case IMAGE_FORMATS.JPEG:
                        mimeType = MIME_TYPE_MAP.jpg;
                        extension = 'jpg';
                        currentQuality = quality === 1 ? quality : Math.min(quality, DEFAULT_JPG_QUALITY);
                        break;
                    case IMAGE_FORMATS.PNG:
                        mimeType = MIME_TYPE_MAP.png;
                        extension = 'png';
                        currentQuality = undefined;
                        break;
                    case IMAGE_FORMATS.WEBP:
                        mimeType = MIME_TYPE_MAP.webp;
                        extension = 'webp';
                        break;
                    case IMAGE_FORMATS.AVIF:
                        if (!supportsAVIF) {
                            mimeType = MIME_TYPE_MAP.webp;
                            extension = 'webp';
                        } else {
                            mimeType = MIME_TYPE_MAP.avif;
                            extension = 'avif';
                        }
                        break;
                    default:
                        mimeType = MIME_TYPE_MAP.webp;
                        extension = 'webp';
                }

                const tryCompress = (q) => {
                    return new Promise((res) => {
                        canvas.toBlob((blob) => res(blob), mimeType, q);
                    });
                };

                let bestBlob = await tryCompress(currentQuality);

                // Iterative quality reduction if targetSize is specified and format supports quality
                if (targetSize && currentQuality !== undefined && bestBlob && (bestBlob.size / 1024) > targetSize) {
                    const minQuality = 0.1;
                    const steps = 8;
                    let lastQuality = currentQuality;

                    for (let i = 1; i <= steps; i++) {
                        const nextQuality = currentQuality - (i * (currentQuality - minQuality) / steps);
                        if (nextQuality <= 0) break;

                        const newBlob = await tryCompress(nextQuality);
                        if (!newBlob) break;

                        bestBlob = newBlob;
                        lastQuality = nextQuality;

                        if ((newBlob.size / 1024) <= targetSize) {
                            break;
                        }
                    }
                }

                URL.revokeObjectURL(objectUrl);
                if (!bestBlob) {
                    reject(new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED));
                    return;
                }
                const originalName = imageFile.name || 'image';
                const baseName = originalName.replace(/\.[^/.]+$/, '');
                const newName = `${baseName}.${extension}`;
                resolve(new File([bestBlob], newName, { type: mimeType }));

            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Error processing image: ${error.message}`));
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);

            if (isTIFF) {
                createTIFFPlaceholderFile(imageFile)
                    .then((placeholderFile) => {
                        processLengendaryOptimize(placeholderFile, quality, format, targetSize)
                            .then(resolve)
                            .catch(() => {
                                resolve(placeholderFile);
                            });
                    })
                    .catch(() => {
                        reject(new Error(ERROR_MESSAGES.TIFF_CONVERSION_FAILED));
                    });
            } else {
                reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
            }
        };

        img.src = objectUrl;
    });
};

/**
 * Gets processing configuration from options
 * @param {Object} processingOptions - Processing options
 * @returns {Object} Processing configuration
 */
export const getProcessingConfiguration = (processingOptions) => {
    const config = {
        compression: {
            quality: parseInt(processingOptions.compression?.quality || 80) / 100,
            targetSize: processingOptions.compression?.fileSize ? parseInt(processingOptions.compression.fileSize) : null
        },
        output: {
            formats: processingOptions.output?.formats || [IMAGE_FORMATS.WEBP],
            rename: processingOptions.output?.rename || false,
            newFileName: processingOptions.output?.newFileName || ''
        },
        resize: (processingOptions.showResize && processingOptions.resizeDimension &&
            processingOptions.resizeDimension.trim() !== '') ? {
            enabled: true,
            dimension: parseInt(processingOptions.resizeDimension)
        } : { enabled: false },
        crop: (processingOptions.showCrop && processingOptions.cropWidth &&
            processingOptions.cropWidth.trim() !== '' && processingOptions.cropHeight &&
            processingOptions.cropHeight.trim() !== '') ? {
            enabled: true,
            width: parseInt(processingOptions.cropWidth),
            height: parseInt(processingOptions.cropHeight),
            mode: processingOptions.cropMode || CROP_MODES.STANDARD,
            position: processingOptions.cropPosition || 'center'
        } : { enabled: false },
        templates: {
            selected: processingOptions.selectedTemplates || [],
            mode: processingOptions.processingMode || PROCESSING_MODES.CUSTOM
        }
    };

    return config;
};
