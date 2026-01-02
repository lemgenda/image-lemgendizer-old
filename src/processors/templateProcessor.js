import {
    DEFAULT_QUALITY,
    LARGE_IMAGE_THRESHOLD,
    PROCESSING_DELAYS,
    ERROR_MESSAGES,
    DEFAULT_JPG_QUALITY,
    DEFAULT_PNG_QUALITY,
    DEFAULT_WEBP_QUALITY,
    IMAGE_FORMATS,
    MIME_TYPE_MAP,
    APP_CONFIG,
    IMAGE_COLORS
} from '../constants';

import {
    FAVICON_PREVIEW_SIZE,
    APP_TEMPLATE_CONFIG,
    DEFAULT_FAVICON_THEME_COLOR,
    DEFAULT_FAVICON_BACKGROUND_COLOR,
    DEFAULT_PLACEHOLDER_DIMENSIONS,
    TEMPLATE_CATEGORIES_CONST,
    FAVICON_SIZES,
    FAVICON_SIZES_BASIC
} from '../configs/templateConfigs';

import {
    processLemGendaryResize,
    processLengendaryOptimize
} from './imageProcessor';

import {
    processSmartCrop,
    processSimpleSmartCrop,
    processStandardCrop,
    processSmartCropForLogo
} from './cropProcessor';

import {
    safeCleanupGPUMemory,
    ensureFileObject,
    checkImageTransparency,
    checkImageTransparencyDetailed
} from '../utils';

let cleanupInProgress = false;
let aiUpscalingDisabled = false;

/**
 * Gets template by ID
 * @param {string} templateId - Template ID
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @returns {Object|null} Template object or null
 */
export const getTemplateById = (templateId, SOCIAL_MEDIA_TEMPLATES) => {
    return SOCIAL_MEDIA_TEMPLATES.find(template => template.id === templateId) || null;
};

/**
 * Gets templates by category
 * @param {string} category - Category name
 * @param {Array<Object>} templateConfigs - Array of template configurations
 * @returns {Array<Object>} Filtered templates
 */
export const getTemplatesByCategory = (category, templateConfigs) => {
    return templateConfigs.filter(t => t.category === category);
};

/**
 * Calculates total files generated from selected templates
 * @param {Array<string>} selectedTemplates - Selected template IDs
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @param {boolean} isFaviconSelected - Whether favicon is selected
 * @param {boolean} isScreenshotSelected - Whether screenshot is selected
 * @param {number} screenshotTemplateCount - Number of screenshot templates
 * @returns {number} Total file count
 */
export const calculateTotalTemplateFiles = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES, isFaviconSelected, isScreenshotSelected, screenshotTemplateCount, faviconMode = 'basic') => {
    let count = (selectedTemplates || []).length;
    if (isFaviconSelected) {
        if (faviconMode === 'basic') {
            count += (FAVICON_SIZES_BASIC.length + 5); // +5 for manifest, html, browserconfig, readme, ico
        } else {
            count += (FAVICON_SIZES.length + 5); // +5 for same reason
        }
    }
    if (isScreenshotSelected) {
        count += (screenshotTemplateCount || 0);
    }
    return count;
};

/**
 * Gets category display name
 * @param {string} categoryId - Category ID
 * @returns {string} Display name
 */
export const getCategoryDisplayName = (categoryId) => {
    switch (categoryId) {
        case TEMPLATE_CATEGORIES_CONST.WEB: return 'Web Images';
        case TEMPLATE_CATEGORIES_CONST.LOGO: return 'Logo Variations';
        case TEMPLATE_CATEGORIES_CONST.FAVICON: return 'Favicon Set';
        case 'facebook': return 'Facebook';
        case 'twitter': return 'Twitter/X';
        case 'instagram': return 'Instagram';
        case 'linkedin': return 'LinkedIn';
        case 'pinterest': return 'Pinterest';
        case 'tiktok': return 'TikTok';
        case 'youtube': return 'YouTube';
        case TEMPLATE_CATEGORIES_CONST.SCREENSHOTS: return 'Screenshots';
        default: return 'Social Media';
    }
};

/**
 * Gets category constant from ID
 * @param {string} categoryId - Category ID
 * @returns {string} Category constant
 */
const getCategoryConstant = (categoryId) => {
    switch (categoryId) {
        case TEMPLATE_CATEGORIES_CONST.WEB: return TEMPLATE_CATEGORIES_CONST.WEB;
        case TEMPLATE_CATEGORIES_CONST.LOGO: return TEMPLATE_CATEGORIES_CONST.LOGO;
        case TEMPLATE_CATEGORIES_CONST.FAVICON: return TEMPLATE_CATEGORIES_CONST.FAVICON;
        case TEMPLATE_CATEGORIES_CONST.SCREENSHOTS: return TEMPLATE_CATEGORIES_CONST.SCREENSHOTS;
        default: return TEMPLATE_CATEGORIES_CONST.SOCIAL || 'social_media';
    }
};

/**
 * Creates template error files
 * @param {Object} template - Template object
 * @param {Object} image - Image object
 * @param {Error} error - Error object
 * @returns {Promise<Array<Object>>} Array of error images
 */
const createTemplateErrorFiles = async (template, image, error) => {
    return new Promise((resolve) => {
        const errorImages = [];
        const baseName = image.name ? image.name.replace(/\.[^/.]+$/, '') : APP_CONFIG.FILE_NAMING.DEFAULT_ERROR_NAME;
        const templateName = template.name ? template.name.replace(/\s+/g, APP_CONFIG.FILE_NAMING.NAME_SEPARATOR).toLowerCase() : APP_CONFIG.FILE_NAMING.DEFAULT_TEMPLATE_NAME;

        const errorFileName = `${templateName}${APP_CONFIG.FILE_NAMING.NAME_SEPARATOR}${baseName}${APP_CONFIG.FILE_NAMING.NAME_SEPARATOR}${APP_CONFIG.FILE_NAMING.DEFAULT_ERROR_NAME}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.PNG}`;
        const errorCanvas = document.createElement('canvas');
        const errorCtx = errorCanvas.getContext('2d');

        errorCanvas.width = template.width || DEFAULT_PLACEHOLDER_DIMENSIONS.WIDTH;
        errorCanvas.height = template.height === 'auto' ? DEFAULT_PLACEHOLDER_DIMENSIONS.HEIGHT : template.height || DEFAULT_PLACEHOLDER_DIMENSIONS.HEIGHT;

        errorCtx.fillStyle = IMAGE_COLORS.ERROR_BACKGROUND;
        errorCtx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);

        errorCtx.strokeStyle = IMAGE_COLORS.ERROR_BORDER;
        errorCtx.lineWidth = 3;
        errorCtx.strokeRect(10, 10, errorCanvas.width - 20, errorCanvas.height - 20);

        errorCtx.fillStyle = IMAGE_COLORS.ERROR_TEXT;
        errorCtx.font = `bold ${Math.min(24 * 2, errorCanvas.height / 10)}px Arial, sans-serif`;
        errorCtx.textAlign = 'center';
        errorCtx.textBaseline = 'middle';
        errorCtx.fillText(ERROR_MESSAGES.PROCESSING_ERROR, errorCanvas.width / 2, errorCanvas.height / 2 - 40);

        errorCtx.font = `bold ${Math.min(24, errorCanvas.height / 15)}px Arial, sans-serif`;
        errorCtx.fillText('Processing Error', errorCanvas.width / 2, errorCanvas.height / 2);

        errorCtx.fillStyle = IMAGE_COLORS.WARNING_TEXT;
        errorCtx.font = `${Math.min(16, errorCanvas.height / 20)}px Arial, sans-serif`;

        const errorMessage = error.message || ERROR_MESSAGES.PROCESSING_ERROR;
        const maxWidth = errorCanvas.width - 40;
        const words = errorMessage.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = errorCtx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        lines.forEach((line, index) => {
            errorCtx.fillText(
                line,
                errorCanvas.width / 2,
                errorCanvas.height / 2 + 40 + (index * 30)
            );
        });

        errorCanvas.toBlob((blob) => {
            const errorFile = new File([blob], errorFileName, {
                type: MIME_TYPE_MAP[IMAGE_FORMATS.PNG]
            });

            errorImages.push({
                ...image,
                file: errorFile,
                name: errorFileName,
                template: template,
                format: IMAGE_FORMATS.PNG,
                processed: false,
                error: error.message,
                aiCropped: false,
                isError: true
            });

            resolve(errorImages);
        }, MIME_TYPE_MAP[IMAGE_FORMATS.PNG], DEFAULT_QUALITY);
    });
};

/**
 * Processes a single template
 * @param {Object} template - Template object
 * @param {Object} image - Image object
 * @param {File} imageFile - Image file
 * @param {boolean} useSmartCrop - Whether to use smart crop
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {boolean} isLargeImage - Whether image is large
 * @param {boolean} hasTransparency - Whether image has transparency
 * @returns {Promise<Array<Object>>} Array of processed images
 */
const processSingleTemplate = async (template, image, imageFile, useSmartCrop, aiModelLoaded, isLargeImage, hasTransparency) => {
    const processedImages = [];

    try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve();
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image'));
            };
            img.src = objectUrl;
        });

        let processedFile = imageFile;
        let wasUpscaled = false;
        let wasSmartCropped = false;
        let isLogoTemplate = template.category === 'logo';
        let subjectProtected = false;

        if (template.width && template.height) {
            const targetWidth = parseInt(template.width);
            const targetHeight = template.height === 'auto' ? null : parseInt(template.height);

            if (targetHeight) {
                if (useSmartCrop && aiModelLoaded && !aiUpscalingDisabled) {
                    try {
                        // Use dedicated logo crop for logo templates to prevent cutoff
                        if (isLogoTemplate) {
                            processedFile = await processSmartCropForLogo(
                                processedFile,
                                targetWidth,
                                targetHeight,
                                { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP, isLogo: true, templateConfig: template.cropConfig }
                            );
                            wasSmartCropped = true;
                            subjectProtected = true;
                        } else {
                            processedFile = await processSmartCrop(
                                processedFile,
                                targetWidth,
                                targetHeight,
                                { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP, isLogo: false, templateConfig: template.cropConfig }
                            );
                            wasSmartCropped = true;
                        }
                    } catch (smartCropError) {
                        processedFile = await processSimpleSmartCrop(
                            processedFile,
                            targetWidth,
                            targetHeight,
                            'center',
                            { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP, isLogo: isLogoTemplate, templateConfig: template.cropConfig }
                        );
                    }
                } else {
                    const cropResults = await processLemGendaryCrop(
                        [{ file: processedFile, name: image.name || APP_CONFIG.FILE_NAMING.DEFAULT_BASE_NAME }],
                        targetWidth,
                        targetHeight,
                        'center',
                        { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
                    );
                    if (cropResults.length > 0 && cropResults[0].cropped) {
                        processedFile = cropResults[0].cropped;
                    }
                }
            } else {
                const resizeResults = await processLemGendaryResize(
                    [{ file: processedFile, name: image.name || APP_CONFIG.FILE_NAMING.DEFAULT_BASE_NAME }],
                    targetWidth,
                    { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
                );
                if (resizeResults.length > 0 && resizeResults[0].resized) {
                    processedFile = resizeResults[0].resized;
                    wasUpscaled = resizeResults[0].upscaled || false;
                }
            }
        }

        const templateCategory = template.category;
        const timestamp = APP_CONFIG.TEMPLATES.DEFAULT_TIMESTAMP;
        const baseName = `${template.platform}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${template.name}`;

        if (templateCategory === 'web') {
            try {
                const webpFile = await processLengendaryOptimize(processedFile, DEFAULT_WEBP_QUALITY, IMAGE_FORMATS.WEBP);
                const webpName = `${baseName}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${timestamp}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.WEBP}`;

                processedImages.push({
                    ...image,
                    file: webpFile,
                    name: webpName,
                    template: {
                        ...template,
                        category: 'web',
                        platform: template.platform || 'web'
                    },
                    format: IMAGE_FORMATS.WEBP,
                    processed: true,
                    aiCropped: wasSmartCropped,
                    upscaled: wasUpscaled,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch (webpError) { }

            try {
                const jpgFile = await processLengendaryOptimize(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
                const jpgName = `${baseName}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${timestamp}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.JPG}`;

                processedImages.push({
                    ...image,
                    file: jpgFile,
                    name: jpgName,
                    template: {
                        ...template,
                        category: 'web',
                        platform: template.platform || 'web'
                    },
                    format: IMAGE_FORMATS.JPG,
                    processed: true,
                    aiCropped: wasSmartCropped,
                    upscaled: wasUpscaled,
                    hasTransparency: false,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch (jpgError) { }

        } else if (templateCategory === 'logo') {
            try {
                const pngFile = await processLengendaryOptimize(processedFile, DEFAULT_PNG_QUALITY, IMAGE_FORMATS.PNG);
                const pngName = `${baseName}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${timestamp}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.PNG}`;

                processedImages.push({
                    ...image,
                    file: pngFile,
                    name: pngName,
                    template: {
                        ...template,
                        category: 'logo',
                        platform: template.platform || 'logo'
                    },
                    format: IMAGE_FORMATS.PNG,
                    processed: true,
                    aiCropped: wasSmartCropped,
                    upscaled: wasUpscaled,
                    hasTransparency: hasTransparency,
                    isLogo: true,
                    subjectProtected: subjectProtected
                });
            } catch (pngError) { }

            if (!hasTransparency) {
                try {
                    const jpgFile = await processLengendaryOptimize(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
                    const jpgName = `${baseName}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${timestamp}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.JPG}`;

                    processedImages.push({
                        ...image,
                        file: jpgFile,
                        name: jpgName,
                        template: {
                            ...template,
                            category: 'logo',
                            platform: template.platform || 'logo'
                        },
                        format: IMAGE_FORMATS.JPG,
                        processed: true,
                        aiCropped: wasSmartCropped,
                        upscaled: wasUpscaled,
                        hasTransparency: false,
                        isLogo: true,
                        subjectProtected: subjectProtected
                    });
                } catch (jpgError) { }
            }
        } else if (templateCategory === 'screenshots') {
            try {
                const jpgFile = await processLengendaryOptimize(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
                const jpgName = `${baseName}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${timestamp}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.JPG}`;

                processedImages.push({
                    ...image,
                    file: jpgFile,
                    name: jpgName,
                    template: {
                        ...template,
                        category: 'screenshots',
                        platform: template.platform || 'screenshots'
                    },
                    format: IMAGE_FORMATS.JPG,
                    processed: true,
                    aiCropped: wasSmartCropped,
                    upscaled: wasUpscaled,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch (jpgError) { }
        } else {
            try {
                const jpgFile = await processLengendaryOptimize(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
                const jpgName = `${baseName}${APP_CONFIG.TEMPLATES.BASE_NAME_SEPARATOR}${timestamp}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.JPG}`;

                processedImages.push({
                    ...image,
                    file: jpgFile,
                    name: jpgName,
                    template: {
                        ...template,
                        category: template.category || 'social_media',
                        platform: template.platform || 'social'
                    },
                    format: IMAGE_FORMATS.JPG,
                    processed: true,
                    aiCropped: wasSmartCropped,
                    upscaled: wasUpscaled,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch (jpgError) { }
        }

        return processedImages;

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            return await createTemplateErrorFiles(template, image, error);
        }
        return [];
    }
};

/**
 * Processes images using social media templates
 * @async
 * @param {Object} image - Image object
 * @param {Array<Object>} selectedTemplates - Selected template objects
 * @param {boolean} useSmartCrop - Whether to use smart crop
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Object} options - Processing options
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const processTemplateImages = async (image, selectedTemplates, useSmartCrop = false, aiModelLoaded = false, options = {}) => {
    const processedImages = [];

    if (!image || !selectedTemplates || selectedTemplates.length === 0) {
        return processedImages;
    }

    const imageFile = await ensureFileObject(image);
    if (!imageFile) {
        return processedImages;
    }

    const transparencyInfo = await checkImageTransparencyDetailed(imageFile);
    const hasTransparency = transparencyInfo.hasTransparency;

    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    await new Promise((resolve, reject) => {
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
        };
        img.src = objectUrl;
    });

    const totalPixels = img.naturalWidth * img.naturalHeight;
    const isLargeImage = totalPixels > LARGE_IMAGE_THRESHOLD;

    const regularTemplates = selectedTemplates.filter(t => {
        if (!t || !t.category) return false;
        const category = t.category;
        return category !== 'favicon' && category !== 'screenshots';
    });

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        for (const template of regularTemplates) {
            if (!template) continue;

            const templateResults = await processSingleTemplate(
                template,
                image,
                imageFile,
                useSmartCrop,
                aiModelLoaded,
                isLargeImage,
                hasTransparency
            );

            processedImages.push(...templateResults);

            await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.MEMORY_CLEANUP));
            safeCleanupGPUMemory();
        }

    } catch (error) {
    } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, PROCESSING_DELAYS.MEMORY_CLEANUP);
    }

    const validImages = processedImages.filter(img => img && img.name && (img.file || img.blob));

    return validImages;
};

/**
 * Creates favicon preview image
 * @async
 * @param {File} imageFile - Source image file
 * @param {string} siteName - Website name
 * @param {string} themeColor - Theme color
 * @param {string} backgroundColor - Background color
 * @returns {Promise<File>} Favicon preview image file
 */
export const createFaviconPreview = async (imageFile, siteName, themeColor = DEFAULT_FAVICON_THEME_COLOR, backgroundColor = DEFAULT_FAVICON_BACKGROUND_COLOR) => {
    return new Promise((resolve) => {
        checkImageTransparency(imageFile).then(hasTransparency => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = FAVICON_PREVIEW_SIZE;
            canvas.height = FAVICON_PREVIEW_SIZE;

            if (hasTransparency) {
                ctx.clearRect(0, 0, FAVICON_PREVIEW_SIZE, FAVICON_PREVIEW_SIZE);
            } else {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, FAVICON_PREVIEW_SIZE, FAVICON_PREVIEW_SIZE);
            }

            const img = new Image();
            const objectUrl = URL.createObjectURL(imageFile);

            img.onload = () => {
                const scale = Math.min(APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_SCALE / img.width, APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_SCALE / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (FAVICON_PREVIEW_SIZE - scaledWidth) / 2;
                const y = (FAVICON_PREVIEW_SIZE - scaledHeight) / 2;

                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

                ctx.fillStyle = themeColor;
                ctx.font = `bold 24px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(siteName, FAVICON_PREVIEW_SIZE / 2, FAVICON_PREVIEW_SIZE - 20);

                URL.revokeObjectURL(objectUrl);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'favicon-preview.png', { type: MIME_TYPE_MAP[IMAGE_FORMATS.PNG] }));
                }, MIME_TYPE_MAP[IMAGE_FORMATS.PNG], DEFAULT_QUALITY);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);

                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, FAVICON_PREVIEW_SIZE, FAVICON_PREVIEW_SIZE);

                ctx.fillStyle = themeColor;
                ctx.beginPath();
                ctx.arc(FAVICON_PREVIEW_SIZE / 2, FAVICON_PREVIEW_SIZE / 2, 150, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = backgroundColor;
                ctx.font = `bold 120px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('F', FAVICON_PREVIEW_SIZE / 2, FAVICON_PREVIEW_SIZE / 2);

                ctx.font = `bold 24px Arial, sans-serif`;
                ctx.fillText(siteName, FAVICON_PREVIEW_SIZE / 2, FAVICON_PREVIEW_SIZE - 20);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'favicon-preview.png', { type: MIME_TYPE_MAP[IMAGE_FORMATS.PNG] }));
                }, MIME_TYPE_MAP[IMAGE_FORMATS.PNG], DEFAULT_QUALITY);
            };

            img.src = objectUrl;
        });
    });
};

/**
 * Gets template categories with display information
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @returns {Array<Object>} Array of category configurations
 */
export const getTemplateCategories = (SOCIAL_MEDIA_TEMPLATES) => {
    const categories = new Set();

    if (SOCIAL_MEDIA_TEMPLATES && SOCIAL_MEDIA_TEMPLATES.length > 0) {
        SOCIAL_MEDIA_TEMPLATES.forEach(template => {
            if (template.category) {
                categories.add(template.category);
            }
        });
    }

    const categoryConfigs = [];

    categories.forEach(category => {
        switch (category) {
            case TEMPLATE_CATEGORIES_CONST.WEB:
                categoryConfigs.push({
                    id: TEMPLATE_CATEGORIES_CONST.WEB,
                    name: 'Web Images',
                    icon: 'fas fa-globe',
                    description: 'Images optimized for web use'
                });
                break;
            case TEMPLATE_CATEGORIES_CONST.LOGO:
                categoryConfigs.push({
                    id: TEMPLATE_CATEGORIES_CONST.LOGO,
                    name: 'Logo Variations',
                    icon: 'fas fa-palette',
                    description: 'Logo formats for different uses'
                });
                break;
            case TEMPLATE_CATEGORIES_CONST.FAVICON:
                categoryConfigs.push({
                    id: TEMPLATE_CATEGORIES_CONST.FAVICON,
                    name: 'Favicon Set',
                    icon: 'fas fa-star',
                    description: 'Complete favicon package'
                });
                break;
            case 'facebook':
                categoryConfigs.push({
                    id: 'facebook',
                    name: 'Facebook',
                    icon: 'fab fa-facebook',
                    description: 'Facebook-specific formats'
                });
                break;
            case 'twitter':
                categoryConfigs.push({
                    id: 'twitter',
                    name: 'Twitter/X',
                    icon: 'fab fa-twitter',
                    description: 'Twitter/X formats'
                });
                break;
            case 'instagram':
                categoryConfigs.push({
                    id: 'instagram',
                    name: 'Instagram',
                    icon: 'fab fa-instagram',
                    description: 'Instagram formats'
                });
                break;
            case 'linkedin':
                categoryConfigs.push({
                    id: 'linkedin',
                    name: 'LinkedIn',
                    icon: 'fab fa-linkedin',
                    description: 'LinkedIn formats'
                });
                break;
            case 'pinterest':
                categoryConfigs.push({
                    id: 'pinterest',
                    name: 'Pinterest',
                    icon: 'fab fa-pinterest',
                    description: 'Pinterest formats'
                });
                break;
            case 'tiktok':
                categoryConfigs.push({
                    id: 'tiktok',
                    name: 'TikTok',
                    icon: 'fab fa-tiktok',
                    description: 'TikTok formats'
                });
                break;
            case 'youtube':
                categoryConfigs.push({
                    id: 'youtube',
                    name: 'YouTube',
                    icon: 'fab fa-youtube',
                    description: 'YouTube formats'
                });
                break;
            case TEMPLATE_CATEGORIES_CONST.SCREENSHOTS:
                categoryConfigs.push({
                    id: TEMPLATE_CATEGORIES_CONST.SCREENSHOTS,
                    name: 'Website Screenshots',
                    icon: 'fas fa-camera',
                    description: 'Responsive website screenshots'
                });
                break;
            default:
                categoryConfigs.push({
                    id: category,
                    name: getCategoryDisplayName(category),
                    icon: 'fas fa-share-alt',
                    description: 'Social media formats'
                });
        }
    });

    return categoryConfigs;
};

/**
 * Checks if template requires smart crop
 * @param {Object} template - Template object
 * @returns {boolean} True if smart crop is required
 */
export const requiresSmartCrop = (template) => {
    if (!template) return false;

    const aspectRatio = template.height === 'auto' ? 1 : template.width / template.height;

    return template.category === 'social_media' ||
        template.category === 'instagram' ||
        template.category === 'pinterest' ||
        (aspectRatio >= 1.5 || aspectRatio <= 0.67);
};

/**
 * Groups templates by category for display
 * @param {Array<Object>} templates - Array of template objects
 * @returns {Object} Templates grouped by category
 */
export const groupTemplatesByCategory = (templates) => {
    const grouped = {};

    templates.forEach(template => {
        const category = template.category || 'other';

        if (!grouped[category]) {
            grouped[category] = [];
        }

        grouped[category].push(template);
    });

    return grouped;
};

/**
 * Gets recommended templates for image
 * @async
 * @param {Object} image - Image object
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @returns {Promise<Array<string>>} Array of recommended template IDs
 */
export const getRecommendedTemplates = (image, SOCIAL_MEDIA_TEMPLATES) => {
    if (!image || !SOCIAL_MEDIA_TEMPLATES) return Promise.resolve([]);

    const img = new Image();
    const objectUrl = URL.createObjectURL(image.file || image.blob);

    return new Promise((resolve) => {
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const recommendations = [];

            SOCIAL_MEDIA_TEMPLATES.forEach(template => {
                const templateAspectRatio = template.height === 'auto' ?
                    aspectRatio : template.width / template.height;

                const aspectRatioDiff = Math.abs(aspectRatio - templateAspectRatio);

                if (aspectRatioDiff < 0.3) {
                    recommendations.push(template.id);
                }
            });

            resolve(recommendations);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve([]);
        };

        img.src = objectUrl;
    });
};

/**
 * Creates processing summary for templates
 * @param {Array<Object>} processedImages - Processed images
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - Array of template objects
 * @returns {Object} Processing summary
 */
export const createTemplateProcessingSummary = (processedImages, selectedTemplateIds, SOCIAL_MEDIA_TEMPLATES) => {
    const successfulImages = processedImages.filter(img => img.processed && !img.error && !img.isError);
    const failedImages = processedImages.filter(img => img.error || img.isError);

    const categoriesUsed = new Set();
    selectedTemplateIds.forEach(id => {
        const template = SOCIAL_MEDIA_TEMPLATES.find(t => t.id === id);
        if (template && template.category) {
            let displayCategory = template.category;
            if (displayCategory === 'twitter') displayCategory = 'twitter/x';
            categoriesUsed.add(displayCategory);
        }
    });

    const formatsUsed = new Set();
    successfulImages.forEach(img => {
        if (img.format) {
            formatsUsed.add(img.format.toUpperCase());
        }
    });

    return {
        totalTemplates: selectedTemplateIds.length,
        successful: successfulImages.length,
        failed: failedImages.length,
        categories: Array.from(categoriesUsed),
        formats: Array.from(formatsUsed),
        hasAI: processedImages.some(img => img.aiCropped),
        hasUpscaling: processedImages.some(img => img.upscaled)
    };
};