import {
    MAX_FILENAME_LENGTH,
    INVALID_FILENAME_CHARS,
    MIME_TYPE_MAP,
    FILE_EXTENSIONS,
    SUPPORTED_INPUT_FORMATS,
    SAMPLING_CONSTANTS,
    PROCESSING_THRESHOLDS,
    DEFAULT_WEBP_QUALITY,
    ERROR_MESSAGES,
    PROCESSING_ERRORS,
    IMAGE_COLORS,
    FONT_CONSTANTS,
    TEMP_FILE_NAMES,
    FILE_TYPE_NAMES,
    PROCESSING_MODES,
    CROP_MODES,
    OPERATION_NAMES,
    OUTPUT_FORMATS,
    IMAGE_FORMATS
} from '../constants';

import { AVAILABLE_UPSCALE_FACTORS, MAX_TEXTURE_SIZE, MAX_SAFE_DIMENSION, MAX_TOTAL_PIXELS } from '../constants/imageConstants';


import { DEFAULT_PLACEHOLDER_DIMENSIONS } from '../configs/templateConfigs';

import { generateSVGPreview } from './svgUtils';
import { generateTIFFPreview } from './tiffUtils';

/**
 * Calculates upscale factor
 * @param {number} originalWidth - Original width
 * @param {number} originalHeight - Original height
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {number} Upscale factor
 */
export const calculateUpscaleFactor = (originalWidth, originalHeight, targetWidth, targetHeight) => {
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;
    const requiredScale = Math.max(widthScale, heightScale);

    const availableScales = AVAILABLE_UPSCALE_FACTORS;

    for (const scale of availableScales) {
        if (scale >= requiredScale) {
            const safeDimensions = calculateSafeDimensions(originalWidth, originalHeight, scale);
            if (!safeDimensions.wasAdjusted) return scale;
        }
    }

    if (requiredScale > 1) return Math.min(requiredScale, 4);
    return 1;
};


/**
 * Formats file size for display.
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

/**
 * Gets file extension from filename.
 * @param {string} filename - Filename
 * @returns {string} File extension
 */
export const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
};

/**
 * Sanitizes filename by removing invalid characters.
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename) => {
    return filename.replace(INVALID_FILENAME_CHARS, '_');
};

/**
 * Gets MIME type from file extension
 * @param {string} extension - File extension
 * @returns {string} MIME type
 */
export const getMimeType = (extension) => {
    return MIME_TYPE_MAP[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Checks if filename is too long
 * @param {string} filename - Filename to check
 * @returns {boolean} True if filename is too long
 */
export const isFilenameTooLong = (filename) => {
    return filename.length > MAX_FILENAME_LENGTH;
};

/**
 * Checks if browser supports AVIF encoding
 * @async
 * @returns {Promise<boolean>} True if AVIF is supported
 */
export const checkAVIFSupport = async () => {
    return new Promise((resolve) => {
        const avif = new Image();
        const timeout = setTimeout(() => {
            resolve(false);
        }, 2000);

        avif.onload = avif.onerror = () => {
            clearTimeout(timeout);
            resolve(avif.height === 2);
        };

        avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    });
};

/**
 * Ensures an image object has a valid File object.
 * @async
 * @param {Object} image - Image object
 * @returns {Promise<File>} Valid file object
 * @throws {Error} If no valid file data found
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
            throw new Error('Invalid image file');
        }
    }

    if (image.url && image.url.startsWith('data:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            throw new Error('Invalid image file');
        }
    }

    throw new Error('No valid file data found');
};

/**
 * Creates image objects from file list
 * @param {Array<File>} files - File list
 * @returns {Promise<Array<Object>>} Array of image objects
 */
export const createImageObjects = (files) => {
    return Promise.all(Array.from(files).map(async (file) => {
        const fileObj = file instanceof File ? file : new File([file], file.name || 'image', { type: file.type });

        const fileName = fileObj.name ? fileObj.name.toLowerCase() : '';
        const mimeType = fileObj.type ? fileObj.type.toLowerCase() : '';

        const isTIFF = FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
        const isSVG = mimeType === 'image/svg+xml' || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext));

        let previewUrl = null;

        if (!isTIFF && !isSVG && fileObj.size < PROCESSING_THRESHOLDS.MAX_FILE_SIZE_PREVIEW) {
            try {
                previewUrl = await fileToDataURL(fileObj);
            } catch (error) {
                previewUrl = URL.createObjectURL(fileObj);
            }
        } else {
            previewUrl = URL.createObjectURL(fileObj);
        }

        return {
            id: Date.now() + Math.random(),
            file: fileObj,
            name: fileObj.name,
            url: previewUrl,
            size: fileObj.size,
            type: fileObj.type,
            optimized: false,
            isTIFF: isTIFF,
            isSVG: isSVG,
            originalFormat: isTIFF ? IMAGE_FORMATS.TIFF || 'tiff' : (isSVG ? IMAGE_FORMATS.SVG || 'svg' : fileObj.type.split('/')[1]),
            hasPreview: true
        };
    }));
};

/**
 * Converts file to data URL
 * @param {File} file - File
 * @returns {Promise<string>} Data URL
 */
const fileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Checks image transparency
 * @param {File} file - Image file
 * @returns {Promise<boolean>} True if image has transparency
 */
export const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
        if (!file || typeof file !== 'object') {
            resolve(false);
            return;
        }

        const fileName = file.name ? file.name.toLowerCase() : '';
        const mimeType = file.type ? file.type.toLowerCase() : '';

        const nonTransparentFormats = [
            MIME_TYPE_MAP.jpeg, MIME_TYPE_MAP.jpg, 'image/bmp',
            MIME_TYPE_MAP.tiff, MIME_TYPE_MAP.tif, 'image/x-icon',
            'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
        ];

        if (FILE_EXTENSIONS.JPEG.some(ext => fileName.endsWith(ext)) ||
            FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext)) ||
            FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext)) ||
            FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext)) ||
            fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
            resolve(false);
            return;
        }

        if (mimeType && nonTransparentFormats.includes(mimeType)) {
            resolve(false);
            return;
        }

        if (mimeType === MIME_TYPE_MAP.svg || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext))) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const svgText = e.target.result;

                    const hasTransparency =
                        svgText.includes('opacity=') ||
                        svgText.includes('opacity:') ||
                        svgText.includes('fill-opacity=') ||
                        svgText.includes('stroke-opacity=') ||
                        svgText.match(/rgba\([^)]+\)/i) ||
                        svgText.match(/hsla\([^)]+\)/i) ||
                        svgText.includes('fill="none"') ||
                        svgText.includes('stroke="none"') ||
                        svgText.includes('fill: none') ||
                        svgText.includes('stroke: none');

                    resolve(hasTransparency);
                } catch (error) {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file);
            return;
        }

        if (mimeType === MIME_TYPE_MAP.gif || 'image/gif' === mimeType || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext))) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);

                    if (bytes.length >= 13) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
                            const packedFields = bytes[10];
                            const hasColorTable = (packedFields & 0x80) !== 0;
                            const colorTableSize = packedFields & 0x07;

                            if (hasColorTable && bytes.length >= 14 + (3 * (1 << (colorTableSize + 1)))) {
                                for (let i = 13; i < bytes.length - 1; i++) {
                                    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
                                        if (i + 4 < bytes.length) {
                                            const transparencyFlag = (bytes[i + 4] & 0x01) !== 0;
                                            resolve(transparencyFlag);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    resolve(false);
                } catch (error) {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file);
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            resolve(false);
        }, 10000);

        img.onload = () => {
            clearTimeout(timeout);

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                let stride = SAMPLING_CONSTANTS.STRIDE_SMALL;
                const totalPixels = canvas.width * canvas.height;

                if (totalPixels > PROCESSING_THRESHOLDS.TRANSPARENCY_CHECK_PIXELS) stride = SAMPLING_CONSTANTS.STRIDE_LARGE;
                else if (totalPixels > 100000) stride = SAMPLING_CONSTANTS.STRIDE_MEDIUM;

                for (let i = 3; i < data.length; i += 4 * stride) {
                    if (data[i] < 255) {
                        URL.revokeObjectURL(objectUrl);
                        resolve(true);
                        return;
                    }
                }

                URL.revokeObjectURL(objectUrl);
                resolve(false);
            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                resolve(false);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            resolve(false);
        };

        img.src = objectUrl;
    });
};

/**
 * Quickly checks image transparency
 * @param {File} file - Image file
 * @returns {Promise<boolean>} True if image has transparency
 */
export const checkImageTransparencyQuick = async (file) => {
    const nonTransparentFormats = [
        MIME_TYPE_MAP.jpeg, MIME_TYPE_MAP.jpg, 'image/bmp',
        MIME_TYPE_MAP.tiff, MIME_TYPE_MAP.tif, 'image/x-icon',
        'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
    ];

    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    if (FILE_EXTENSIONS.JPEG.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext)) ||
        fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        return false;
    }

    if (nonTransparentFormats.includes(mimeType)) {
        return false;
    }

    if (mimeType === MIME_TYPE_MAP.svg || 'image/svg+xml' === mimeType || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext))) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result.substring(0, 5000);
                const hasTransparency =
                    text.includes('opacity=') ||
                    text.includes('opacity:') ||
                    text.includes('fill-opacity=') ||
                    text.includes('stroke-opacity=') ||
                    text.match(/rgba\([^)]+\)/i) ||
                    text.includes('fill="none"') ||
                    text.includes('fill: none');
                resolve(hasTransparency);
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file.slice(0, 5000));
        });
    }

    if (mimeType === MIME_TYPE_MAP.gif || 'image/gif' === mimeType || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext))) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);

                    if (bytes.length >= 14) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
                            for (let i = 13; i < Math.min(1000, bytes.length - 1); i++) {
                                if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
                                    if (i + 4 < bytes.length) {
                                        const hasTransparency = (bytes[i + 4] & 0x01) !== 0;
                                        resolve(hasTransparency);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                    resolve(false);
                } catch (error) {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file.slice(0, 1024));
        });
    }

    return checkImageTransparency(file);
};

/**
 * Checks image transparency with detailed information
 * @param {File} file - Image file
 * @returns {Promise<Object>} Transparency information
 */
export const checkImageTransparencyDetailed = async (file) => {
    const nonTransparentFormats = [
        MIME_TYPE_MAP.jpeg, MIME_TYPE_MAP.jpg, 'image/bmp',
        MIME_TYPE_MAP.tiff, MIME_TYPE_MAP.tif, 'image/x-icon',
        'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
    ];

    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    if (nonTransparentFormats.includes(mimeType) ||
        FILE_EXTENSIONS.JPEG.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext)) ||
        FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext)) ||
        fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        return {
            hasTransparency: false,
            type: 'opaque',
            alphaChannel: false,
            format: mimeType.split('/')[1] || fileName.split('.').pop()
        };
    }

    if (mimeType === MIME_TYPE_MAP.svg || 'image/svg+xml' === mimeType || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext))) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const svgText = e.target.result;
                    const hasTransparency =
                        svgText.includes('opacity=') ||
                        svgText.includes('opacity:') ||
                        svgText.includes('fill-opacity=') ||
                        svgText.includes('stroke-opacity=') ||
                        svgText.match(/rgba\([^)]+\)/i) ||
                        svgText.match(/hsla\([^)]+\)/i) ||
                        svgText.includes('fill="none"') ||
                        svgText.includes('stroke="none"') ||
                        svgText.includes('fill: none') ||
                        svgText.includes('stroke: none');

                    resolve({
                        hasTransparency,
                        type: hasTransparency ? 'svg-transparency' : 'opaque',
                        alphaChannel: false,
                        format: 'svg'
                    });
                } catch (error) {
                    resolve({
                        hasTransparency: false,
                        type: 'unknown',
                        alphaChannel: false,
                        format: 'svg'
                    });
                }
            };
            reader.onerror = () => resolve({
                hasTransparency: false,
                type: 'unknown',
                alphaChannel: false,
                format: 'svg'
            });
            reader.readAsText(file);
        });
    }

    const hasTransparency = await checkImageTransparency(file);

    let format = 'unknown';
    if (mimeType.includes(IMAGE_FORMATS.PNG)) format = IMAGE_FORMATS.PNG;
    else if (mimeType.includes(IMAGE_FORMATS.WEBP)) format = IMAGE_FORMATS.WEBP;
    else if (mimeType.includes(IMAGE_FORMATS.AVIF)) format = IMAGE_FORMATS.AVIF;
    else if (mimeType.includes('apng')) format = 'apng';
    else if (FILE_EXTENSIONS.PNG.some(ext => fileName.endsWith(ext))) format = IMAGE_FORMATS.PNG;
    else if (FILE_EXTENSIONS.WEBP.some(ext => fileName.endsWith(ext))) format = IMAGE_FORMATS.WEBP;
    else if (FILE_EXTENSIONS.AVIF.some(ext => fileName.endsWith(ext))) format = IMAGE_FORMATS.AVIF;
    else if (FILE_EXTENSIONS.APNG.some(ext => fileName.endsWith(ext))) format = 'apng';

    let type = 'opaque';
    let alphaChannel = false;

    if (hasTransparency) {
        if (format === 'gif') {
            type = 'gif-transparency';
            alphaChannel = false;
        } else if ([IMAGE_FORMATS.PNG, IMAGE_FORMATS.WEBP, IMAGE_FORMATS.AVIF, 'apng'].includes(format)) {
            type = 'alpha-channel';
            alphaChannel = true;
        } else {
            type = 'unknown-transparency';
            alphaChannel = false;
        }
    }

    return {
        hasTransparency,
        type,
        alphaChannel,
        format
    };
};

/**
 * Handles file selection event
 * @param {Event} e - File input event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Additional options
 */
export const handleFileSelect = (e, onUpload, options = {}) => {
    const files = Array.from(e.target.files).filter(file => {
        const mimeType = file.type.toLowerCase();
        const isImage = SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType.includes(format.replace('image/', '')) || mimeType === format
        );
        if (options.maxSize && file.size > options.maxSize) {
            return false;
        }
        if (options.allowedTypes && !options.allowedTypes.some(type =>
            mimeType.includes(type.replace('image/', '')) || mimeType === type
        )) {
            return false;
        }
        return isImage;
    });
    if (files.length > 0) onUpload(files);
};

/**
 * Handles image drop event
 * @param {Event} e - Drag and drop event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Additional options
 */
export const handleImageDrop = (e, onUpload, options = {}) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => {
        const mimeType = file.type.toLowerCase();
        const isImage = SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType.includes(format.replace('image/', '')) || mimeType === format
        );
        if (options.maxSize && file.size > options.maxSize) {
            return false;
        }
        if (options.allowedTypes && !options.allowedTypes.some(type =>
            mimeType.includes(type.replace('image/', '')) || mimeType === type
        )) {
            return false;
        }
        return isImage;
    });
    if (files.length > 0) onUpload(files);
};

/**
 * Generates special format preview (TIFF/SVG)
 * @param {Object} image - Image object
 * @returns {Promise<string>} Preview data URL
 */
export const generateSpecialFormatPreview = async (image) => {
    return new Promise((resolve, reject) => {
        if (image.isTIFF) {
            generateTIFFPreview(image.file)
                .then(resolve)
                .catch(reject);
        } else if (image.isSVG) {
            generateSVGPreview(image.file)
                .then(resolve)
                .catch(reject);
        } else {
            resolve(URL.createObjectURL(image.file));
        }
    });
};

/**
 * Generates processing summary
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
        summary.operations.push(`${OPERATION_NAMES.RESIZED} to ${summaryData.resizeDimension}`);
        summary.upscalingUsed = true;
    }
    if (summaryData.cropWidth && summaryData.cropHeight) {
        const cropType = summaryData.cropMode === CROP_MODES.SMART ? OPERATION_NAMES.AI_CROPPED : OPERATION_NAMES.CROPPED;
        summary.operations.push(`${cropType} ${summaryData.cropWidth}x${summaryData.cropHeight}`);
        summary.upscalingUsed = true;
    }
    if (summaryData.compressionQuality < 100) {
        summary.operations.push(`${OPERATION_NAMES.COMPRESSED} (${summaryData.compressionQuality}%)`);
    }
    if (summaryData.rename && summaryData.newFileName) {
        summary.operations.push(`${OPERATION_NAMES.RENAMED}: ${summaryData.newFileName}`);
    }

    if (summary.upscalingUsed) {
        summary.operations.push(OPERATION_NAMES.AUTO_UPSCALED);
    }

    if (summaryData.mode === PROCESSING_MODES.TEMPLATES) {
        summary.templatesApplied = summaryData.templatesApplied;
        summary.categoriesApplied = summaryData.categoriesApplied;
        summary.operations = [
            `${OPERATION_NAMES.TEMPLATES_APPLIED} (${summary.templatesApplied})`,
            OPERATION_NAMES.AUTO_UPSCALED,
            OPERATION_NAMES.AI_CROPPED
        ];
    }

    return summary;
};

/**
 * Creates processing summary
 * @param {Object} result - Processing result
 * @param {Object} options - Processing options
 * @param {Function} t - Translation function
 * @returns {Object} Processing summary
 */
export const createProcessingSummary = (result, options, t) => {
    const summary = {
        mode: options.templates?.mode || PROCESSING_MODES.CUSTOM,
        imagesProcessed: result.imagesProcessed || 0,
        operations: [],
        aiUsed: false,
        upscalingUsed: false,
        totalFiles: result.totalFiles || 0,
        success: result.success || false,
        errors: result.errors || [],
        templatesApplied: result.templatesApplied || 0,
        categoriesApplied: result.categoriesApplied || 0,
        formatsExported: result.formatsExported || ['WEBP', 'PNG', 'JPG']
    };

    if (options.compression && options.compression.quality < 1) {
        const qualityPercent = Math.round(options.compression.quality * 100);
        summary.operations.push(`${OPERATION_NAMES.COMPRESSED} (${qualityPercent}%)`);
    }

    if (options.crop && options.crop.enabled && options.crop.mode === CROP_MODES.SMART) {
        summary.operations.push(OPERATION_NAMES.AI_CROPPED);
        summary.aiUsed = true;
    }

    if (summary.upscalingUsed) {
        summary.operations.push(OPERATION_NAMES.AUTO_UPSCALED);
        summary.aiUsed = true;
    }

    if (options.includeFavicon) {
        summary.operations.push(OPERATION_NAMES.FAVICONS_GENERATED);
    }

    if (options.includeScreenshots && options.screenshotUrl) {
        summary.operations.push(`${OPERATION_NAMES.SCREENSHOTS_GENERATED} for ${options.screenshotUrl}`);
    }

    if (summary.mode === PROCESSING_MODES.TEMPLATES) {
        if (summary.templatesApplied > 0) {
            summary.operations.push(`${OPERATION_NAMES.TEMPLATES_APPLIED} (${summary.templatesApplied})`);
        }
    }

    return summary;
};

/**
 * Gets available output formats
 * @returns {Array<string>} Available formats
 */
export const getAvailableFormats = () => {
    return OUTPUT_FORMATS;
};

/**
 * Generates file name based on options
 * @param {string} originalName - Original file name
 * @param {Object} options - Processing options
 * @param {number} index - File index
 * @returns {string} Generated file name
 */
export const generateFileName = (originalName, options, index = 0) => {
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const originalExtension = originalName.split('.').pop();

    if (options.rename && options.newFileName) {
        const numberedName = `${options.newFileName}-${String(index + 1).padStart(2, '0')}`;

        if (options.format === IMAGE_FORMATS.ORIGINAL) {
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
            const cropType = options.crop.mode === CROP_MODES.SMART ? 'smart-crop' : 'crop';
            suffixParts.push(`${cropType}-${options.crop.width}x${options.crop.height}`);

            if (options.crop.mode === CROP_MODES.STANDARD && options.crop.position !== 'center') {
                suffixParts.push(options.crop.position);
            }
        }

        if (options.compression && options.compression.quality < 1) {
            const qualityPercent = Math.round(options.compression.quality * 100);
            suffixParts.push(`q${qualityPercent}`);
        }

        const suffix = suffixParts.length > 0 ? `-${suffixParts.join('-')}` : '';

        if (options.format === IMAGE_FORMATS.ORIGINAL) {
            return `${baseName}${suffix}.${originalExtension}`;
        } else {
            return `${baseName}${suffix}.${options.format}`;
        }
    }
};



/**
 * Calculates safe dimensions for upscaling
 * @param {number} originalWidth - Original width
 * @param {number} originalHeight - Original height
 * @param {number} scale - Scale factor
 * @returns {Object} Safe dimensions
 */
export const calculateSafeDimensions = (originalWidth, originalHeight, scale) => {
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