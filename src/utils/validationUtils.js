import {
    MAX_TARGET_FILESIZE_KB,
    MAX_CROP_DIMENSION,
    MAX_RESIZE_DIMENSION,
    PROCESSING_MODES,
    CROP_MODES,
    CROP_POSITIONS,
    CROP_POSITION_LIST,
    URL_CONSTANTS,
    IMAGE_FORMATS,
    SUPPORTED_INPUT_FORMATS
} from '../constants';

import { formatFileSize } from './fileUtils';

/**
 * Validates processing options before starting.
 * @param {Object} processingOptions - Processing options to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validateProcessingOptions = (processingOptions) => {
    const errors = [];

    if (!processingOptions) {
        errors.push('Processing options are required');
        return { isValid: false, errors };
    }

    if (processingOptions.compression?.quality) {
        const quality = parseInt(processingOptions.compression.quality);
        if (isNaN(quality) || quality < 1 || quality > 100) {
            errors.push('Compression quality must be between 1 and 100');
        }
    }

    if (processingOptions.compression?.fileSize && processingOptions.compression.fileSize !== '') {
        const fileSize = parseInt(processingOptions.compression.fileSize);
        if (isNaN(fileSize) || fileSize < 1) {
            errors.push('Target file size must be a positive number in KB');
        } else if (fileSize > MAX_TARGET_FILESIZE_KB) {
            errors.push('Target file size cannot exceed 100,000 KB (100MB)');
        }
    }

    if (processingOptions.resizeDimension && processingOptions.resizeDimension !== '') {
        const dimension = parseInt(processingOptions.resizeDimension);
        if (isNaN(dimension) || dimension < 1) {
            errors.push('Resize dimension must be a positive number');
        } else if (dimension > MAX_RESIZE_DIMENSION) {
            errors.push('Resize dimension cannot exceed 10000 pixels');
        }
    }

    if (processingOptions.cropWidth && processingOptions.cropWidth !== '') {
        const width = parseInt(processingOptions.cropWidth);
        if (isNaN(width) || width < 1) {
            errors.push('Crop width must be a positive number');
        } else if (width > MAX_CROP_DIMENSION) {
            errors.push('Crop width cannot exceed 10000 pixels');
        }
    }

    if (processingOptions.cropHeight && processingOptions.cropHeight !== '') {
        const height = parseInt(processingOptions.cropHeight);
        if (isNaN(height) || height < 1) {
            errors.push('Crop height must be a positive number');
        } else if (height > MAX_CROP_DIMENSION) {
            errors.push('Crop height cannot exceed 10000 pixels');
        }
    }

    if ((processingOptions.cropWidth && processingOptions.cropWidth !== '') !==
        (processingOptions.cropHeight && processingOptions.cropHeight !== '')) {
        errors.push('Both crop width and height must be provided together, or leave both empty to skip cropping');
    }

    if (processingOptions.cropWidth && processingOptions.cropWidth !== '' &&
        processingOptions.cropHeight && processingOptions.cropHeight !== '') {
        const width = parseInt(processingOptions.cropWidth);
        const height = parseInt(processingOptions.cropHeight);

        if (width > 0 && height > 0) {
            const aspectRatio = width / height;
            if (aspectRatio > 100 || aspectRatio < 0.01) {
                errors.push('Crop dimensions have extreme aspect ratio. Please use reasonable values.');
            }
        }
    }

    if (processingOptions.output?.formats) {
        const validFormats = Object.values(IMAGE_FORMATS);
        const invalidFormats = processingOptions.output.formats.filter(f => !validFormats.includes(f));

        if (invalidFormats.length > 0) {
            errors.push(`Invalid output formats: ${invalidFormats.join(', ')}`);
        }

        if (processingOptions.output.formats.length === 0) {
            errors.push('At least one output format must be selected');
        }
    }

    if (processingOptions.output?.rename) {
        const newFileName = processingOptions.output?.newFileName || '';

        if (!newFileName.trim()) {
            errors.push('New file name cannot be empty when rename is enabled');
        } else {
            // Invalid Windows filename characters
            const invalidChars = /[<>:"/\\|?*]/g;
            // eslint-disable-next-line no-control-regex
            const controlChars = /[\u0000-\u001F]/g;
            if (invalidChars.test(newFileName) || controlChars.test(newFileName)) {
                errors.push('New file name contains invalid characters');
            }

            if (newFileName.length > 100) {
                errors.push('New file name cannot exceed 100 characters');
            }
        }
    }

    if (processingOptions.cropMode && !Object.values(CROP_MODES).includes(processingOptions.cropMode)) {
        errors.push(`Crop mode must be one of: ${Object.values(CROP_MODES).join(', ')}`);
    }

    if (processingOptions.cropPosition && !CROP_POSITION_LIST.includes(processingOptions.cropPosition)) {
        errors.push('Invalid crop position');
    }

    if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
        if (!processingOptions.templateSelectedImage) {
            errors.push('No image selected for template processing');
        }

        if (!processingOptions.selectedTemplates || processingOptions.selectedTemplates.length === 0) {
            errors.push('No templates selected for processing');
        }
    }

    if (processingOptions.processingMode && !Object.values(PROCESSING_MODES).includes(processingOptions.processingMode)) {
        errors.push('Invalid processing mode');
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
export function validateScreenshotUrlInput(url) {
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

        new URL(formattedUrl);
        const hostname = new URL(formattedUrl).hostname;
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
 * @param {Array<File>} files - File list
 * @returns {Array<File>} Validated files
 */
export const validateImageFiles = (files) => {
    return Array.from(files).filter(file => {
        const mimeType = file.type.toLowerCase();
        return SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType === format || (format.includes('/') && mimeType.includes(format.split('/')[1]))
        );
    });
};

/**
 * Validates image files before processing
 * @param {Array<Object>} images - Array of image objects
 * @returns {Array<Object>} Array of validation issues
 */
export const validateImageFilesBeforeProcessing = (images) => {
    const issues = [];
    const maxSize = 50 * 1024 * 1024;

    images.forEach((image, index) => {
        if (image.size > maxSize) {
            issues.push({
                image: image.name,
                issue: `File too large (${formatFileSize(image.size)}). Maximum size is 50MB.`,
                index
            });
        }

        if (image.size === 0) {
            issues.push({
                image: image.name,
                issue: 'File appears to be empty (0 bytes).',
                index
            });
        }

        if (image.isTIFF) {
            issues.push({
                image: image.name,
                issue: 'TIFF file - may have conversion issues',
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
export const validateCropParameters = (width, height, position) => {
    const errors = [];

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

    const validPositions = CROP_POSITION_LIST;
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
 * @param {Array<string>} selectedTemplates - Selected template IDs
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @returns {Object} Validation result
 */
export const validateTemplateSelection = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES) => {
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
 * @param {Object} image - Image object to validate
 * @returns {boolean} True if image is valid
 */
export const validateImage = (image) => {
    return image &&
        typeof image === 'object' &&
        image.name &&
        typeof image.name === 'string' &&
        (image.file || image.blob);
};
