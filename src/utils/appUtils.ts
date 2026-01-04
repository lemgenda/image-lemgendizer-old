import {
    PROCESSING_MODES,
    ANIMATION_DURATIONS,
    MODAL_TYPES
} from '../constants';
import { TEMPLATE_CATEGORIES_CONST } from '../configs/templateConfigs';
import { ImageFile, TemplateConfig } from '../types';

/**
 * Handles processing errors with categorization
 * @param {Error} error - Error object
 * @param {Function} t - Translation function
 * @returns {Object} Error information with user message and suggestion
 */
export const handleProcessingError = (error: Error, t: (key: string) => string): {
    userMessage: string;
    suggestion: string;
    shouldRetry: boolean;
    type: string;
} => {
    const errorMessage = error.message.toLowerCase();

    if (/\bai\b/.test(errorMessage) || errorMessage.includes('model') ||
        errorMessage.includes('tensor') || errorMessage.includes('upscaler')) {
        return {
            userMessage: t('message.aiFailed'),
            suggestion: t('suggestion.tryStandardCrop'),
            shouldRetry: false,
            type: 'ai_error'
        };
    }

    if (errorMessage.includes('tiff') || errorMessage.includes('utif')) {
        return {
            userMessage: t('message.tiffConversionFailed'),
            suggestion: t('suggestion.convertTiffFirst'),
            shouldRetry: false,
            type: 'tiff_error'
        };
    }

    if (errorMessage.includes('svg') || errorMessage.includes('vector')) {
        return {
            userMessage: t('message.svgConversionFailed'),
            suggestion: t('suggestion.checkSVG'),
            shouldRetry: false,
            type: 'svg_error'
        };
    }

    if (errorMessage.includes('memory') || errorMessage.includes('gpu') ||
        errorMessage.includes('texture') || errorMessage.includes('buffer')) {
        return {
            userMessage: t('message.memoryError'),
            suggestion: t('suggestion.reduceBatchSize'),
            shouldRetry: true,
            type: 'memory_error'
        };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('timed out') ||
        errorMessage.includes('too long')) {
        return {
            userMessage: t('message.timeoutError'),
            suggestion: t('suggestion.trySmaller'),
            shouldRetry: true,
            type: 'timeout_error'
        };
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch') ||
        errorMessage.includes('http') || errorMessage.includes('request')) {
        return {
            userMessage: t('errors.network'),
            suggestion: t('suggestion.checkConnection'),
            shouldRetry: true,
            type: 'network_error'
        };
    }

    if (errorMessage.includes('file') || errorMessage.includes('blob') ||
        errorMessage.includes('url') || errorMessage.includes('object')) {
        return {
            userMessage: t('errors.fileHandling'),
            suggestion: t('suggestion.uploadAgain'),
            shouldRetry: true,
            type: 'file_error'
        };
    }

    if (errorMessage.includes('canvas') || errorMessage.includes('context') ||
        errorMessage.includes('draw') || errorMessage.includes('image')) {
        return {
            userMessage: t('errors.imageRendering'),
            suggestion: t('suggestion.tryDifferentImages'),
            shouldRetry: true,
            type: 'canvas_error'
        };
    }

    return {
        userMessage: t('message.errorProcessing'),
        suggestion: t('suggestion.tryAgain'),
        shouldRetry: true,
        type: 'generic_error'
    };
};


/**
 * Calculates categories applied based on selected templates
 * @param {Array<string>} selectedTemplates - Selected template IDs
 * @param {Array<TemplateConfig>} templates - All template objects
 * @param {boolean} isFaviconSelected - Whether favicon is selected
 * @param {boolean} isScreenshotSelected - Whether screenshot is selected
 * @returns {number} Number of categories applied
 */
export const calculateCategoriesApplied = (
    selectedTemplates: string[] | undefined | null,
    templates: TemplateConfig[],
    isFaviconSelected: boolean = false,
    isScreenshotSelected: boolean = false
): number => {
    const categories = new Set<string>();

    if (selectedTemplates && selectedTemplates.length > 0) {
        selectedTemplates.forEach(templateId => {
            const template = templates.find(t => t.id === templateId);
            if (template && template.category) {
                const displayCategory = template.category;
                if (displayCategory === TEMPLATE_CATEGORIES_CONST.WEB || displayCategory === TEMPLATE_CATEGORIES_CONST.LOGO ||
                    displayCategory === TEMPLATE_CATEGORIES_CONST.FAVICON || displayCategory === TEMPLATE_CATEGORIES_CONST.SCREENSHOTS) {
                    categories.add(displayCategory);
                } else if (displayCategory === 'twitter') {
                    categories.add('twitter/x');
                } else {
                    categories.add(displayCategory);
                }
            }
        });
    }

    if (isFaviconSelected) {
        categories.add(TEMPLATE_CATEGORIES_CONST.FAVICON);
    }

    if (isScreenshotSelected) {
        categories.add(TEMPLATE_CATEGORIES_CONST.SCREENSHOTS);
    }

    return categories.size;
};

/**
 * Gets selected images for processing based on mode
 * @param {Array<ImageFile>} images - All image objects
 * @param {Array<string>} selectedImages - Selected image IDs
 * @param {string} processingMode - Processing mode
 * @param {string} templateSelectedImage - Template selected image ID
 * @returns {Array<ImageFile>} Selected images for processing
 */
export const getSelectedImagesForProcessing = (
    images: ImageFile[],
    selectedImages: string[],
    processingMode: string,
    templateSelectedImage: string | null
): ImageFile[] => {
    if (processingMode === PROCESSING_MODES.TEMPLATES) {
        return templateSelectedImage
            ? images.filter(img => img.id === templateSelectedImage)
            : [];
    } else {
        return images.filter(img => selectedImages.includes(img.id));
    }
};

/**
 * Sets up auto-close timeout for modal
 * @param {Function} closeModal - Close modal function
 * @param {string} type - Modal type
 * @returns {Object} Timeout reference and cleanup function
 */
export const setupAutoClose = (closeModal: () => void, type: string): { clear: () => void; ref: NodeJS.Timeout | null } => {
    let timeoutRef: NodeJS.Timeout | null = null;
    let timeoutDuration: number;

    switch (type) {
        case MODAL_TYPES.SUCCESS:
            timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_SUCCESS;
            break;
        case MODAL_TYPES.INFO:
            timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_INFO;
            break;
        case MODAL_TYPES.ERROR:
            timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_ERROR;
            break;
        case MODAL_TYPES.SUMMARY:
            timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_SUMMARY;
            break;
        case MODAL_TYPES.WARNING:
            timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_INFO;
            break;
        default:
            timeoutDuration = 3000;
    }

    timeoutRef = setTimeout(() => {
        closeModal();
    }, timeoutDuration);

    return {
        clear: () => {
            if (timeoutRef) {
                clearTimeout(timeoutRef);
                timeoutRef = null;
            }
        },
        ref: timeoutRef
    };
};

/**
 * Gets image dimensions
 * @param {File} file - Image file
 * @param {boolean} isTIFF - Whether file is TIFF
 * @param {boolean} isSVG - Whether file is SVG
 * @returns {Promise<Object>} Image dimensions
 */
export const getImageDimensions = (file: File, isSVG: boolean): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
        if (isSVG) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    const result = e.target?.result as string;
                    const svgDoc = parser.parseFromString(result, 'image/svg+xml');
                    const svgElement = svgDoc.documentElement;

                    const widthAttr = svgElement.getAttribute('width');
                    const heightAttr = svgElement.getAttribute('height');

                    let width = widthAttr ? parseInt(widthAttr) : 100;
                    let height = heightAttr ? parseInt(heightAttr) : 100;

                    if (!widthAttr || !heightAttr) {
                        const viewBox = svgElement.getAttribute('viewBox');
                        if (viewBox) {
                            const parts = viewBox.split(' ').map(Number);
                            if (parts.length >= 4) {
                                width = parts[2] || 100;
                                height = parts[3] || 100;
                            }
                        }
                    }

                    resolve({ width, height });
                } catch {
                    resolve({ width: 100, height: 100 });
                }
            };
            reader.onerror = () => resolve({ width: 100, height: 100 });
            reader.readAsText(file);
        } else {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                resolve({
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                });
                URL.revokeObjectURL(url);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ width: 100, height: 100 });
            };

            // If TIFF and browser doesn't support it, this will fail.
            // Caller might need to handle TIFF separately if this is relied upon.
            // But logic says if NOT SVG, use Image.
            img.src = url;
        }
    });
};
