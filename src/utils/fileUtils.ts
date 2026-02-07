/**
 * @file fileUtils.ts
 * @description Comprehensive suite of file manipulation utilities, including format conversion,
 * transparency detection, and processing summary generation.
 */
import {
    MAX_FILENAME_LENGTH,
    INVALID_FILENAME_CHARS,
    MIME_TYPE_MAP,
    FILE_EXTENSIONS,
    SUPPORTED_INPUT_FORMATS,
    SAMPLING_CONSTANTS,
    PROCESSING_THRESHOLDS,
    PROCESSING_MODES,
    CROP_MODES,
    OUTPUT_FORMATS,
    IMAGE_FORMATS,
    IMAGE_FILTERS
} from '../constants';
import { TFunction } from 'i18next';

import { AVAILABLE_UPSCALE_FACTORS, MAX_TEXTURE_SIZE, MAX_SAFE_DIMENSION, MAX_TOTAL_PIXELS } from '../constants/imageConstants';
import { ImageFile, ProcessingOptions } from '../types';

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
export const calculateUpscaleFactor = (originalWidth: number, originalHeight: number, targetWidth: number, targetHeight: number): number => {
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;
    const requiredScale = Math.max(widthScale, heightScale);

    if (requiredScale <= 1) return 1;

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
export const formatFileSize = (bytes: number): string => {
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
export const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Sanitizes filename by removing invalid characters.
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename: string): string => {
    return filename.replace(INVALID_FILENAME_CHARS, '_');
};

/**
 * Gets MIME type from file extension
 * @param {string} extension - File extension
 * @returns {string} MIME type
 */
export const getMimeType = (extension: string): string => {
    return MIME_TYPE_MAP[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Checks if filename is too long
 * @param {string} filename - Filename to check
 * @returns {boolean} True if filename is too long
 */
export const isFilenameTooLong = (filename: string): boolean => {
    return filename.length > MAX_FILENAME_LENGTH;
};

/**
 * Checks if browser supports AVIF encoding
 * @async
 * @returns {Promise<boolean>} True if AVIF is supported
 */
export const checkAVIFSupport = async (): Promise<boolean> => {
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
 * @param {any} image - Image object
 * @returns {Promise<File>} Valid file object
 * @throws {Error} If no valid file data found
 */
export const ensureFileObject = async (image: any): Promise<File> => {
    if (image instanceof File) return image;
    if (image instanceof Blob) return image as File; // Handle Blob directly, casting

    if (image.file instanceof File || image.file instanceof Blob) {
        return image.file;
    }

    if (image.blob instanceof File || image.blob instanceof Blob) {
        return image.blob;
    }

    if (image.url && image.url.startsWith('blob:')) {
        try {
            const response = await fetch(image.url);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            const blob = await response.blob();

            return new File([blob], image.name || 'image', { type: blob.type });
        } catch {

            // Failed to fetch blob URL
            throw new Error(`Invalid image file (blob fetch failed)`);
        }
    }

    if (image.url && image.url.startsWith('data:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error: any) {
            throw new Error(`Invalid image file (data URL failed): ${error.message}`);
        }
    }

    // Try detecting if it's a proxy object or structural clone that lost prototype (rare but possible)
    if (image.file && image.file.size && image.file.type) {
        // It looks like a file but failed instanceof check.
        // Could happen if File object comes from a different window/frame context.
        // We can try to cast it.
        return image.file;
    }

    // No valid file data found for image
    throw new Error('No valid file data found');
};

/**
 * Creates image objects from file list
 * @param {Array<File>} files - File list
 * @returns {Promise<Array<ImageFile>>} Array of image objects
 */
export const createImageObjects = (files: File[]): Promise<ImageFile[]> => {
    return Promise.all(Array.from(files).map(async (file) => {
        const fileObj = file instanceof File ? file : new File([file], (file as any).name || 'image', { type: (file as any).type });

        const fileName = fileObj.name ? fileObj.name.toLowerCase() : '';
        const mimeType = fileObj.type ? fileObj.type.toLowerCase() : '';

        const isTIFF = FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
        const isSVG = mimeType === 'image/svg+xml' || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext));

        let previewUrl: string = '';

        if (!isTIFF && !isSVG && fileObj.size < PROCESSING_THRESHOLDS.MAX_FILE_SIZE_PREVIEW) {
            try {
                previewUrl = await fileToDataURL(fileObj);
            } catch {
                previewUrl = URL.createObjectURL(fileObj);
            }
        } else {
            previewUrl = URL.createObjectURL(fileObj);
        }

        const width = 0; // Placeholder, as we don't load image dims here yet
        const height = 0; // Placeholder

        return {
            id: (Date.now() + Math.random()).toString(),
            file: fileObj,
            name: fileObj.name,
            preview: previewUrl,
            originalWidth: width,
            originalHeight: height,
            url: previewUrl, // compatibility
            size: fileObj.size,
            type: fileObj.type,
            optimized: false,
            isTIFF: isTIFF,
            isSVG: isSVG,
            originalFormat: isTIFF ? IMAGE_FORMATS.TIFF || 'tiff' : (isSVG ? IMAGE_FORMATS.SVG || 'svg' : fileObj.type.split('/')[1]),
            hasPreview: true
        } as unknown as ImageFile; // casting because valid ImageFile needs dimensions which are not sync available here without loading image
    }));
};

/**
 * Converts file to data URL
 * @param {File} file - File
 * @returns {Promise<string>} Data URL
 */
const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Checks image transparency
 * @param {File} file - Image file
 * @returns {Promise<boolean>} True if image has transparency
 */
export const checkImageTransparency = async (file: File): Promise<boolean> => {
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
                    const svgText = e.target?.result as string;

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

                    resolve(!!hasTransparency);
                } catch {
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
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const bytes = new Uint8Array(arrayBuffer);

                    if (bytes.length >= 13) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6)); // intentionally simplistic
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
                } catch {
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
                if (!ctx) {
                    URL.revokeObjectURL(objectUrl);
                    resolve(false);
                    return;
                }
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
            } catch {
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
export const checkImageTransparencyQuick = async (file: File): Promise<boolean> => {
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
                const text = (e.target?.result as string || '').substring(0, 5000);
                const hasTransparency =
                    text.includes('opacity=') ||
                    text.includes('opacity:') ||
                    text.includes('fill-opacity=') ||
                    text.includes('stroke-opacity=') ||
                    text.match(/rgba\([^)]+\)/i) ||
                    text.includes('fill="none"') ||
                    text.includes('fill: none');
                resolve(!!hasTransparency);
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
                    const arrayBuffer = e.target?.result as ArrayBuffer;
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
                } catch {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file.slice(0, 1024));
        });
    }

    return checkImageTransparency(file);
};

export interface TransparencyInfo {
    hasTransparency: boolean;
    type: string;
    alphaChannel: boolean;
    format: string;
}

/**
 * Checks image transparency with detailed information
 * @param {File} file - Image file
 * @returns {Promise<TransparencyInfo>} Transparency information
 */
export const checkImageTransparencyDetailed = async (file: File): Promise<TransparencyInfo> => {
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
            format: mimeType.split('/')[1] || fileName.split('.').pop() || 'unknown'
        };
    }

    if (mimeType === MIME_TYPE_MAP.svg || 'image/svg+xml' === mimeType || FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext))) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const svgText = e.target?.result as string;
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
                        hasTransparency: !!hasTransparency,
                        type: hasTransparency ? 'svg-transparency' : 'opaque',
                        alphaChannel: false,
                        format: 'svg'
                    });
                } catch {
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
export const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, onUpload: (files: File[]) => void, options: { maxSize?: number; allowedTypes?: string[] } = {}) => {
    if (!e.target.files) return;
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

// Simplified DragEvent type for minimal dependency
interface DragEventWithFiles {
    preventDefault: () => void;
    dataTransfer: {
        files: FileList;
    };
}

/**
 * Handles image drop event
 * @param {Event} e - Drag and drop event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Additional options
 */
export const handleImageDrop = (e: DragEventWithFiles | React.DragEvent, onUpload: (files: File[]) => void, options: { maxSize?: number; allowedTypes?: string[] } = {}) => {
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
 * @param {any} image - Image object
 * @returns {Promise<string>} Preview data URL
 */
export const generateSpecialFormatPreview = async (image: any): Promise<string> => {
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
 * Creates processing summary
 * @param {Object} result - Processing result
 * @param {Object} options - Processing options
 * @param {TFunction} t - Translation function
 * @returns {Object} Processing summary
 */
export const createProcessingSummary = (result: any, options: ProcessingOptions & { includeFavicon?: boolean; includeScreenshots?: boolean; screenshotUrl?: string; templates?: any }, t: TFunction) => {
    const summary: any = {
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
        formatsExported: result.formatsExported || ['WEBP', 'PNG', 'JPG'],
        watermarkApplied: options.watermark?.enabled || false,
        watermark: options.watermark ? {
            text: options.watermark.text,
            size: options.watermark.size || 'medium',
            color: options.watermark.color || '#ffffff',
            fontSize: parseInt(String(options.watermark.fontSize || '24')),
            repeat: !!options.watermark.repeat,
            fontFamily: options.watermark.fontFamily
        } : undefined
    };

    const processedImagesList = (result as any).processedImagesList || [];

    // --- ORDERED OPERATIONS LIST ---

    // 1. Resize (with upscale info)
    const upscaledImage = processedImagesList.find((img: any) => img.aiUpscaleScale);
    if (upscaledImage) {
        summary.upscalingUsed = true;
        summary.aiUsed = true;
        summary.upscaleScale = upscaledImage.aiUpscaleScale;

        if (upscaledImage.isSmartCropUpscale || (upscaledImage as any).isSmartCropUpscale) {
            summary.operations.push(t('operations.aiSmartCropUpscale', { scale: upscaledImage.aiUpscaleScale }));
        } else if (upscaledImage.aiUpscaleModel?.includes('UltraZoom')) {
            summary.operations.push(t('operations.aiUltraZoom', { scale: upscaledImage.aiUpscaleScale }));
        } else {
            let modelInfo = `x${upscaledImage.aiUpscaleScale}`;
            if (upscaledImage.aiUpscaleModel) {
                summary.upscaleModel = upscaledImage.aiUpscaleModel;
                modelInfo += ` (${upscaledImage.aiUpscaleModel})`;
            }
            summary.operations.push(t('operations.aiUpscalingWithModel', { model: modelInfo }));
        }
    } else if (options.resize?.enabled && options.resize.dimension) {
        summary.operations.push(t('operations.resized', { dimension: options.resize.dimension }));
    }

    // 2. Crop (dimensions)
    if (options.crop && options.crop.enabled) {
        if (options.crop.mode === CROP_MODES.SMART) {
            summary.aiUsed = true;
            const smartCroppedImage = processedImagesList.find((img: any) => img.aiSmartCrop);
            if (smartCroppedImage) {
                summary.operations.push(t('operations.aiYoloSmartCrop', {
                    width: options.crop.width,
                    height: options.crop.height
                }));
            } else {
                summary.operations.push(t('operations.aiSmartCropping'));
            }
        } else {
            // Standard Crop
            summary.operations.push(`${t('operations.standardCrop')} (${options.crop.width}x${options.crop.height})`);
        }
    }

    // 3. Restoration (list models)
    if (options.restoration?.enabled && options.restoration.modelName) {
        summary.aiUsed = true;
        summary.operations.push(t('operations.restorationApplied', { model: options.restoration.modelName }));
    }

    // 4. Filter / Color Correction
    if (options.filters && options.filters.selectedFilter && options.filters.selectedFilter !== IMAGE_FILTERS.NONE) {
        const filterName = t(`filters.name.${options.filters.selectedFilter}`);
        summary.operations.push(t('operations.filterApplied', { filter: filterName }));
    }
    if (options.colorCorrection?.enabled) {
        summary.operations.push(t('operations.colorCorrectionApplied'));
    }

    // 5. Compression (percentage)
    let compressionQuality = 80; // Default
    if (options.output.quality && options.output.quality <= 1) {
        compressionQuality = Math.round(options.output.quality * 100);
    } else if (options.output.quality > 1) {
        compressionQuality = options.output.quality;
    }
    // Only show if explicitly configured or not default 100/lossless (usually we show it always for clarity)
    summary.operations.push(t('operations.compressed', { quality: compressionQuality }));


    // 6. Watermark
    if (options.watermark?.enabled) {
        summary.operations.push(t('summary.watermarkApplied'));
    }

    // 7. Format Conversion
    if (summary.formatsExported && summary.formatsExported.length > 0) {
        const formats = summary.formatsExported.map((f: string) => f.toUpperCase()).join(', ');
        summary.operations.push(t('operations.formatsExported', { formats }));
    }

    // 8. Rename
    const isBatchRename = options.processingMode === PROCESSING_MODES.BATCH_RENAME;
    const hasRename = options.output?.rename && options.output?.newFileName;

    if (isBatchRename && options.batchRename) {
        // Show pattern logic if complex, or just "Batch Rename Applied"
        const pattern = options.batchRename.pattern || 'Pattern';
        summary.operations.push(t('operations.renamed', { pattern }));
    } else if (hasRename) {
        const pattern = options.output.newFileName;
        summary.operations.push(t('operations.renamed', { pattern }));
    }

    // Templates special case (mixes into operations or stands alone?)
    // User requested order for standard pipeline. Templates usually don't have restoration/resize in the same way.
    if (summary.mode === PROCESSING_MODES.TEMPLATES && summary.templatesApplied > 0) {
        summary.operations.push(t('operations.templatesApplied', { count: summary.templatesApplied }));
    }

    // Generator special cases
    if (options.includeFavicon) {
        summary.operations.push(t('button.generateFavicon'));
    }
    if (options.includeScreenshots && options.screenshotUrl) {
        summary.operations.push(`${t('button.generateScreenshots')} for ${options.screenshotUrl}`);
    }

    return summary;
};

/**
 * Gets available output formats
 * @returns {Array<string>} Available formats
 */
export const getAvailableFormats = (): { id: string; name: string; description: string }[] => {
    return OUTPUT_FORMATS;
};

/**
 * Generates file name based on options
 * @param {string} originalName - Original file name
 * @param {Object} options - Processing options
 * @param {number} index - File index
 * @returns {string} Generated file name
 */
export const generateFileName = (originalName: string, options: ProcessingOptions | any, index: number = 0): string => {
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const originalExtension = originalName.split('.').pop();

    // Normalize options if coming from legacy
    const rename = options.rename || (options.output && options.output.rename);
    const newFileName = options.newFileName || (options.output && options.output.newFileName);
    const format = options.format || (options.output && options.output.formats && options.output.formats[0]) || IMAGE_FORMATS.WEBP;

    if (rename && newFileName) {
        const numberedName = `${newFileName}-${String(index + 1).padStart(2, '0')}`;

        if (format === IMAGE_FORMATS.ORIGINAL) {
            return `${numberedName}.${originalExtension}`;
        } else {
            return `${numberedName}.${format}`;
        }
    } else {
        const suffixParts: string[] = [];

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

        if (format === IMAGE_FORMATS.ORIGINAL) {
            return `${baseName}${suffix}.${originalExtension}`;
        } else {
            return `${baseName}${suffix}.${format}`;
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
export const calculateSafeDimensions = (originalWidth: number, originalHeight: number, scale: number): { width: number; height: number; scale: number; wasAdjusted: boolean } => {
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

/**
 * Converts legacy format image (BMP, ICO, GIF, TIFF) to PNG
 * @param {File} file - Image file
 * @returns {Promise<File>} Converted PNG file
 */
export const convertLegacyFormat = async (file: File): Promise<File> => {
    // Basic implementation using canvas to "convert" supported browser formats
    // For TIFF, it should be handled by tiffUtils, but this serves as a general fallback
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image load timeout for legacy format'));
        }, 15000);

        img.onload = () => {

            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("No context");

                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (!blob) {
                        reject(new Error('Blob creation failed'));
                        return;
                    }

                    const originalName = file.name || 'image';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newFileName = `${baseName}.png`;

                    resolve(new File([blob], newFileName, { type: 'image/png' }));
                }, 'image/png');

            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(error);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load legacy image format'));
        };

        img.src = objectUrl;
    });
};

/**
 * Creates simple legacy conversion (alias/wrapper)
 * @param {File} file - Image file
 * @returns {Promise<File>} Converted file
 */
export const createSimpleLegacyConversion = async (file: File): Promise<File> => {
    return convertLegacyFormat(file);
};
