import {
    MAX_TARGET_FILESIZE_KB,
    MAX_CROP_DIMENSION,
    MAX_RESIZE_DIMENSION,
    PROCESSING_MODES,
    CROP_MODES,
    CROP_POSITIONS
} from '../constants/sharedConstants.js';

/**
 * Validates processing options before starting.
 * @param {Object} processingOptions - Processing options to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validateProcessingOptions = (processingOptions) => {
    const errors = [];

    // Validate compression quality
    if (processingOptions.compression?.quality) {
        const quality = parseInt(processingOptions.compression.quality);
        if (isNaN(quality) || quality < 1 || quality > 100) {
            errors.push('Compression quality must be between 1 and 100');
        }
    }

    // Validate file size target if provided
    if (processingOptions.compression?.fileSize && processingOptions.compression.fileSize !== '') {
        const fileSize = parseInt(processingOptions.compression.fileSize);
        if (isNaN(fileSize) || fileSize < 1) {
            errors.push('Target file size must be a positive number in KB');
        } else if (fileSize > MAX_TARGET_FILESIZE_KB) {
            errors.push('Target file size cannot exceed 100,000 KB (100MB)');
        }
    }

    // Validate resize dimension
    if (processingOptions.resizeDimension && processingOptions.resizeDimension !== '') {
        const dimension = parseInt(processingOptions.resizeDimension);
        if (isNaN(dimension) || dimension < 1) {
            errors.push('Resize dimension must be a positive number');
        } else if (dimension > MAX_RESIZE_DIMENSION) {
            errors.push('Resize dimension cannot exceed 10000 pixels');
        }
    }

    // Validate crop dimensions
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

    // Validate that if one crop dimension is provided, both should be provided
    if ((processingOptions.cropWidth && processingOptions.cropWidth !== '') !==
        (processingOptions.cropHeight && processingOptions.cropHeight !== '')) {
        errors.push('Both crop width and height must be provided together, or leave both empty to skip cropping');
    }

    // Validate crop aspect ratio
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

    // Validate output formats
    if (processingOptions.output?.formats) {
        const validFormats = ['webp', 'avif', 'jpg', 'jpeg', 'png', 'original'];
        const invalidFormats = processingOptions.output.formats.filter(f => !validFormats.includes(f));

        if (invalidFormats.length > 0) {
            errors.push(`Invalid output formats: ${invalidFormats.join(', ')}`);
        }

        if (processingOptions.output.formats.length === 0) {
            errors.push('At least one output format must be selected');
        }
    }

    // Validate rename options
    if (processingOptions.output?.rename) {
        const newFileName = processingOptions.output?.newFileName || '';

        if (!newFileName.trim()) {
            errors.push('New file name cannot be empty when rename is enabled');
        } else {
            // Check for invalid characters
            const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
            if (invalidChars.test(newFileName)) {
                errors.push('New file name contains invalid characters');
            }

            // Check length
            if (newFileName.length > 100) {
                errors.push('New file name cannot exceed 100 characters');
            }
        }
    }

    // Validate crop mode if provided
    if (processingOptions.cropMode && !Object.values(CROP_MODES).includes(processingOptions.cropMode)) {
        errors.push('Crop mode must be either "smart" or "standard"');
    }

    // Validate crop position if provided
    if (processingOptions.cropPosition && !CROP_POSITIONS.includes(processingOptions.cropPosition)) {
        errors.push('Invalid crop position');
    }

    // Validate template mode specific options
    if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
        if (!processingOptions.templateSelectedImage) {
            errors.push('No image selected for template processing');
        }

        if (!processingOptions.selectedTemplates || processingOptions.selectedTemplates.length === 0) {
            errors.push('No templates selected for processing');
        }
    }

    // Validate processing mode
    if (processingOptions.processingMode && !Object.values(PROCESSING_MODES).includes(processingOptions.processingMode)) {
        errors.push('Invalid processing mode');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validates a screenshot URL.
 * @param {string} url - URL to validate
 * @returns {Object} Validation result with isValid flag and message
 */
export const validateScreenshotUrl = (url) => {
    if (!url || url.trim() === '') {
        return {
            isValid: false,
            message: 'URL cannot be empty'
        };
    }

    try {
        // Add protocol if missing
        let formattedUrl = url;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = `https://${formattedUrl}`;
        }

        // Basic URL validation
        new URL(formattedUrl);

        // Basic domain validation
        const hostname = new URL(formattedUrl).hostname;
        if (!hostname || hostname === '') {
            return {
                isValid: false,
                message: 'Invalid domain name'
            };
        }

        return {
            isValid: true,
            message: 'Valid URL'
        };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid URL format. Please enter a valid website URL (e.g., example.com or https://example.com)'
        };
    }
};