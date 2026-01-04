import {
    MAX_TARGET_FILESIZE_KB,
    MAX_CROP_DIMENSION,
    MAX_RESIZE_DIMENSION,
    PROCESSING_MODES,
    CROP_MODES,
    CROP_POSITION_LIST,
    URL_CONSTANTS,
    IMAGE_FORMATS,
    SUPPORTED_INPUT_FORMATS
} from '../constants';

import { formatFileSize } from './fileUtils';
import { ProcessingOptions, ImageFile, TemplateConfig } from '../types';
import i18next from 'i18next';

/**
 * Validates processing options before starting.
 * @param {ProcessingOptions} processingOptions - Processing options to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validateProcessingOptions = (processingOptions: ProcessingOptions): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!processingOptions) {
        errors.push(i18next.t('errors.processingOptionsRequired'));
        return { isValid: false, errors };
    }

    // Check compression quality (legacy or new)
    const options: any = processingOptions; // Handle flexible structure if legacy

    if (options.compression?.quality) {
        const quality = parseInt(options.compression.quality);
        if (isNaN(quality) || quality < 1 || quality > 100) {
            errors.push(i18next.t('errors.compressionQualityRange'));
        }
    }

    if (options.compression?.fileSize && options.compression.fileSize !== '') {
        const fileSize = parseInt(options.compression.fileSize);
        if (isNaN(fileSize) || fileSize < 1) {
            errors.push(i18next.t('errors.fileSizePositive'));
        } else if (fileSize > MAX_TARGET_FILESIZE_KB) {
            errors.push(i18next.t('errors.fileSizeExceeded'));
        }
    }

    if (options.resizeDimension && options.resizeDimension !== '') {
        const dimension = parseInt(options.resizeDimension);
        if (isNaN(dimension) || dimension < 1) {
            errors.push('Resize dimension must be a positive number');
        } else if (dimension > MAX_RESIZE_DIMENSION) {
            errors.push('Resize dimension cannot exceed 10000 pixels');
        }
    }

    const cropWidth = options.cropWidth;
    const cropHeight = options.cropHeight;

    if (cropWidth && cropWidth !== '') {
        const width = parseInt(cropWidth);
        if (isNaN(width) || width < 1) {
            errors.push('Crop width must be a positive number');
        } else if (width > MAX_CROP_DIMENSION) {
            errors.push('Crop width cannot exceed 10000 pixels');
        }
    }

    if (cropHeight && cropHeight !== '') {
        const height = parseInt(cropHeight);
        if (isNaN(height) || height < 1) {
            errors.push('Crop height must be a positive number');
        } else if (height > MAX_CROP_DIMENSION) {
            errors.push('Crop height cannot exceed 10000 pixels');
        }
    }

    if ((cropWidth && cropWidth !== '') !==
        (cropHeight && cropHeight !== '')) {
        errors.push(i18next.t('validation.cropBothDimensions'));
    }

    if (cropWidth && cropWidth !== '' &&
        cropHeight && cropHeight !== '') {
        const width = parseInt(cropWidth);
        const height = parseInt(cropHeight);

        if (width > 0 && height > 0) {
            const aspectRatio = width / height;
            if (aspectRatio > 100 || aspectRatio < 0.01) {
                errors.push(i18next.t('validation.extremeAspectRatio'));
            }
        }
    }

    if (processingOptions.output?.formats) {
        const validFormats = Object.values(IMAGE_FORMATS);
        // Cast to string array to allow comparison
        const invalidFormats = processingOptions.output.formats.filter(f => !validFormats.includes(f as any));

        if (invalidFormats.length > 0) {
            errors.push(`Invalid output formats: ${invalidFormats.join(', ')}`);
        }

        if (processingOptions.output.formats.length === 0) {
            errors.push(i18next.t('validation.atLeastOneFormat'));
        }
    }

    if (processingOptions.output?.rename) {
        const newFileName = processingOptions.output?.newFileName || '';

        if (!newFileName.trim()) {
            errors.push(i18next.t('validation.fileNameEmpty'));
        } else {
            // Invalid Windows filename characters
            const invalidChars = /[<>:"/\\|?*]/g;
            // eslint-disable-next-line no-control-regex
            const controlChars = /[\u0000-\u001F]/g;
            if (invalidChars.test(newFileName) || controlChars.test(newFileName)) {
                errors.push(i18next.t('validation.fileNameInvalidChars'));
            }

            if (newFileName.length > 100) {
                errors.push(i18next.t('validation.fileNameTooLong'));
            }
        }
    }

    if (options.cropMode && !Object.values(CROP_MODES).includes(options.cropMode)) {
        errors.push(`Crop mode must be one of: ${Object.values(CROP_MODES).join(', ')}`);
    }

    if (options.cropPosition && !CROP_POSITION_LIST.includes(options.cropPosition)) {
        errors.push(i18next.t('validation.invalidCropPosition'));
    }

    if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
        if (!options.templateSelectedImage) {
            errors.push('No image selected for template processing');
        }

        if (!processingOptions.selectedTemplates || processingOptions.selectedTemplates.length === 0) {
            errors.push('No templates selected for processing');
        }
    }

    if (processingOptions.processingMode && !Object.values(PROCESSING_MODES).includes(processingOptions.processingMode)) {
        errors.push(i18next.t('validation.invalidProcessingMode'));
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validates screenshot URL
 * @param {string} url - URL to validate
 * @returns {Object} Validation result
 */
export function validateScreenshotUrlInput(url: string): { isValid: boolean; message?: string; cleanUrl?: string; errors?: string[] } {
    if (!url || url.trim() === '') {
        return {
            isValid: false,
            message: 'URL cannot be empty'
        };
    }

    try {
        let formattedUrl = url;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = `${URL_CONSTANTS.DEFAULT_PROTOCOL}${formattedUrl}`;
        }

        const urlObj = new URL(formattedUrl);
        const hostname = urlObj.hostname;
        if (!hostname || hostname === '') {
            return {
                isValid: false,
                message: 'Invalid domain name'
            };
        }

        return {
            isValid: true,
            message: 'Valid URL',
            cleanUrl: formattedUrl
        };
    } catch {
        return {
            isValid: false,
            errors: ['Failed to validate crop parameters']
        };
    }
}

/**
 * Validates image files
 * @param {FileList | File[]} files - File list
 * @returns {File[]} Validated files
 */
export const validateImageFiles = (files: FileList | File[]): File[] => {
    return Array.from(files).filter(file => {
        const mimeType = file.type.toLowerCase();
        return SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType === format || (format.includes('/') && mimeType.includes(format.split('/')[1]))
        );
    });
};

/**
 * Validates image files before processing
 * @param {ImageFile[]} images - Array of image objects
 * @returns {Array<Object>} Array of validation issues
 */
export const validateImageFilesBeforeProcessing = (images: ImageFile[]): { image: string; issue: string; index: number; warning?: boolean }[] => {
    const issues: { image: string; issue: string; index: number; warning?: boolean }[] = [];
    const maxSize = 50 * 1024 * 1024;

    images.forEach((image, index) => {
        if (image.size > maxSize) {
            issues.push({
                image: image.name,
                issue: i18next.t('validation.fileTooLarge', { size: formatFileSize(image.size) }),
                index
            });
        }

        if (image.size === 0) {
            issues.push({
                image: image.name,
                issue: i18next.t('validation.fileEmpty'),
                index
            });
        }

        if (image.type === IMAGE_FORMATS.TIFF || (image as any).isTIFF) {
            issues.push({
                image: image.name,
                issue: i18next.t('validation.tiffWarning'),
                index,
                warning: true
            });
        }
    });

    return issues;
};

/**
 * Validates crop parameters
 * @param {number} width - Crop width
 * @param {number} height - Crop height
 * @param {string} position - Crop position
 * @returns {Object} Validation result
 */
export const validateCropParameters = (width: number, height: number, position: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!width || width <= 0) {
        errors.push('Width must be a positive number');
    }

    if (!height || height <= 0) {
        errors.push('Height must be a positive number');
    }

    if (width > 10000) {
        errors.push('Width cannot exceed 10000 pixels');
    }

    if (height > 10000) {
        errors.push('Height cannot exceed 10000 pixels');
    }

    // Cast to string[] to allow includes check generically
    const validPositions: string[] = CROP_POSITION_LIST as unknown as string[];
    if (!validPositions.includes(position)) {
        errors.push(`Invalid crop position. Must be one of: ${validPositions.join(', ')}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validates template selection for processing
 * @param {string[]} selectedTemplates - Selected template IDs
 * @param {TemplateConfig[]} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @returns {Object} Validation result
 */
export const validateTemplateSelection = (selectedTemplates: string[], SOCIAL_MEDIA_TEMPLATES: TemplateConfig[]): { isValid: boolean; error?: string; validCount?: number } => {
    if (!selectedTemplates || selectedTemplates.length === 0) {
        return {
            isValid: false,
            error: 'No templates selected'
        };
    }

    const validTemplates = selectedTemplates.filter(id =>
        SOCIAL_MEDIA_TEMPLATES.some(t => t.id === id)
    );

    if (validTemplates.length !== selectedTemplates.length) {
        return {
            isValid: false,
            error: 'Invalid template IDs detected'
        };
    }

    return {
        isValid: true,
        validCount: validTemplates.length
    };
};

/**
 * Validates if an image object is valid
 * @param {any} image - Image object to validate
 * @returns {boolean} True if image is valid
 */
export const validateImage = (image: any): boolean => {
    return !!(image &&
        typeof image === 'object' &&
        image.name &&
        typeof image.name === 'string' &&
        (image.file || image.blob));
};
