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
    TEMPLATE_CATEGORIES_CONST as TEMPLATE_CATEGORIES,
    APP_TEMPLATE_CONFIG,
    DEFAULT_FAVICON_THEME_COLOR,
    DEFAULT_FAVICON_BACKGROUND_COLOR,
    DEFAULT_PLACEHOLDER_DIMENSIONS
} from '../configs/templateConfigs';

import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    optimizeForWeb,
    checkImageTransparency,
    checkImageTransparencyDetailed
} from '../processors';

import {
    safeCleanupGPUMemory,
    ensureFileObject
} from '../utils';

let cleanupInProgress = false;
let aiUpscalingDisabled = false;

/**
 * Gets template by ID
 */
export const getTemplateById = (templateId, SOCIAL_MEDIA_TEMPLATES) => {
    return SOCIAL_MEDIA_TEMPLATES.find(template => template.id === templateId) || null;
};

/**
 * Gets templates by category
 */
export const getTemplatesByCategory = (category, templateConfigs) => {
    return templateConfigs.filter(t => t.category === category);
};

/**
 * Calculates total files generated from selected templates
 */
export const calculateTotalTemplateFiles = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES, isFaviconSelected = false, isScreenshotSelected = false, screenshotTemplateCount = 0) => {
    if (!selectedTemplates || selectedTemplates.length === 0) {
        return (isFaviconSelected ? APP_TEMPLATE_CONFIG.FAVICON.FILES_COUNT : 0) + (isScreenshotSelected ? screenshotTemplateCount : 0);
    }

    let totalFiles = 0;
    const templateIds = selectedTemplates;
    const templates = SOCIAL_MEDIA_TEMPLATES.filter(t => templateIds.includes(t.id));

    templates.forEach(template => {
        if (template.category === 'web') {
            totalFiles += 2; // WEBP and JPG only (no PNG)
        } else if (template.category === 'logo') {
            totalFiles += 1; // PNG (and JPG if no transparency, added conditionally)
            // JPG will be added conditionally in processSingleTemplate
        } else if (template.category === 'favicon') {
            totalFiles += APP_TEMPLATE_CONFIG.FAVICON.FILES_COUNT;
        } else if (template.category === 'screenshots') {
            totalFiles += 1;
        } else {
            totalFiles += 1; // Social media templates
        }
    });

    if (isFaviconSelected) totalFiles += APP_TEMPLATE_CONFIG.FAVICON.FILES_COUNT;
    if (isScreenshotSelected) totalFiles += screenshotTemplateCount;

    return totalFiles;
};

/**
 * Filters templates by type
 */
export const filterTemplatesByType = (templates, type = 'social') => {
    if (type === 'screenshot') {
        return templates.filter(t => t.category === 'screenshots');
    } else if (type === 'social') {
        return templates.filter(t =>
            t.category !== 'screenshots' &&
            t.category !== 'favicon' &&
            t.category !== 'web' &&
            t.category !== 'logo'
        );
    } else if (type === 'web') {
        return templates.filter(t => t.category === 'web' || t.category === 'logo');
    }
    return templates;
};

/**
 * Gets category display name
 */
export const getCategoryDisplayName = (categoryId) => {
    switch (categoryId) {
        case 'web': return 'Web Images';
        case 'logo': return 'Logo Variations';
        case 'favicon': return 'Favicon Set';
        case 'facebook': return 'Facebook';
        case 'twitter': return 'Twitter/X';
        case 'instagram': return 'Instagram';
        case 'linkedin': return 'LinkedIn';
        case 'pinterest': return 'Pinterest';
        case 'tiktok': return 'TikTok';
        case 'youtube': return 'YouTube';
        case 'screenshots': return 'Screenshots';
        default: return 'Social Media';
    }
};

/**
 * Gets category constant from ID
 */
const getCategoryConstant = (categoryId) => {
    switch (categoryId) {
        case 'web': return 'web';
        case 'logo': return 'logo';
        case 'favicon': return 'favicon';
        case 'screenshots': return 'screenshots';
        default: return 'social_media';
    }
};

/**
 * Creates template error files
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
 * Processes a single template - FIXED: Web templates only export JPG and WEBP
 */
const processSingleTemplate = async (template, image, imageFile, useSmartCrop, aiModelLoaded, isLargeImage, hasTransparency) => {
    console.log('=== PROCESS SINGLE TEMPLATE ===');
    console.log('Template ID:', template.id);
    console.log('Template name:', template.name);
    console.log('Template category:', template.category);
    console.log('Template platform:', template.platform);

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
                if (useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled) {
                    try {
                        processedFile = await processSmartCrop(
                            processedFile,
                            targetWidth,
                            targetHeight,
                            { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
                        );
                        wasSmartCropped = true;
                    } catch (smartCropError) {
                        processedFile = await processSimpleSmartCrop(
                            processedFile,
                            targetWidth,
                            targetHeight,
                            'center',
                            { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
                        );
                    }
                } else {
                    // Use regular crop when smart crop is not available or appropriate
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
                // Resize only (when height is 'auto')
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

        console.log('Processing category:', templateCategory);
        console.log('Template has transparency:', hasTransparency);

        if (templateCategory === 'web') {
            console.log('Creating WEB template images (JPG and WEBP only)');

            // Create WEBP version for web
            try {
                const webpFile = await optimizeForWeb(processedFile, DEFAULT_WEBP_QUALITY, IMAGE_FORMATS.WEBP);
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
                console.log('Added WEBP web image');
            } catch (webpError) {
                console.warn('WebP conversion failed:', webpError);
            }

            // Create JPG version for web (always, even if has transparency - will be converted to RGB)
            try {
                const jpgFile = await optimizeForWeb(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
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
                    hasTransparency: false, // JPG never has transparency
                    isLogo: false,
                    subjectProtected: false
                });
                console.log('Added JPG web image');
            } catch (jpgError) {
                console.warn('JPG conversion failed:', jpgError);
            }

            // REMOVED: PNG generation for web templates
            console.log('Skipping PNG for web templates (only JPG and WEBP)');

        } else if (templateCategory === 'logo') {
            console.log('Creating LOGO template images');
            // Create PNG version (always for logos)
            try {
                const pngFile = await optimizeForWeb(processedFile, DEFAULT_PNG_QUALITY, IMAGE_FORMATS.PNG);
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
                console.log('Added PNG logo image');
            } catch (pngError) {
                console.warn('PNG conversion failed:', pngError);
            }

            // Create JPG version if no transparency
            if (!hasTransparency) {
                try {
                    const jpgFile = await optimizeForWeb(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
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
                    console.log('Added JPG logo image');
                } catch (jpgError) {
                    console.warn('JPG conversion for logo failed:', jpgError);
                }
            } else {
                console.log('Skipping JPG for logo (has transparency)');
            }
        } else if (templateCategory === 'screenshots') {
            console.log('Creating SCREENSHOT template image');
            try {
                const jpgFile = await optimizeForWeb(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
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
                console.log('Added screenshot image');
            } catch (jpgError) {
                console.warn('JPG conversion for screenshot failed:', jpgError);
            }
        } else {
            // Social media and other templates
            console.log('Creating SOCIAL MEDIA template image');
            try {
                const jpgFile = await optimizeForWeb(processedFile, DEFAULT_JPG_QUALITY, IMAGE_FORMATS.JPG);
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
                console.log('Added social media image');
            } catch (jpgError) {
                console.warn('JPG conversion for social media failed:', jpgError);
            }
        }

        console.log('Total images created:', processedImages.length);
        processedImages.forEach((img, idx) => {
            console.log(`Image ${idx}:`, {
                name: img.name,
                category: img.template?.category,
                format: img.format
            });
        });

        return processedImages;

    } catch (error) {
        console.error('Error in processSingleTemplate:', error);
        if (process.env.NODE_ENV === 'development') {
            return await createTemplateErrorFiles(template, image, error);
        }
        return [];
    }
};

/**
 * Processes images using social media templates
 */
export const processTemplateImages = async (image, selectedTemplates, useSmartCrop = false, aiModelLoaded = false, options = {}) => {
    console.log('=== PROCESS TEMPLATE IMAGES ===');
    console.log('Selected templates count:', selectedTemplates.length);
    console.log('Selected templates:', selectedTemplates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        platform: t.platform
    })));

    const processedImages = [];

    if (!image || !selectedTemplates || selectedTemplates.length === 0) {
        console.log('No image or templates selected');
        return processedImages;
    }

    const imageFile = await ensureFileObject(image);
    if (!imageFile) {
        console.log('Failed to get image file');
        return processedImages;
    }

    const transparencyInfo = await checkImageTransparencyDetailed(imageFile);
    const hasTransparency = transparencyInfo.hasTransparency;
    console.log('Image has transparency:', hasTransparency);

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
    console.log('Image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
    console.log('Is large image:', isLargeImage);

    const regularTemplates = selectedTemplates.filter(t => {
        if (!t || !t.category) return false;
        const category = t.category;
        return category !== 'favicon' && category !== 'screenshots';
    });

    console.log('Regular templates to process:', regularTemplates.length);

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        for (const template of regularTemplates) {
            if (!template) continue;

            console.log(`Processing template: ${template.name} (${template.category})`);
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
            console.log(`Added ${templateResults.length} images from template ${template.name}`);

            await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.MEMORY_CLEANUP));
            safeCleanupGPUMemory();
        }

    } catch (error) {
        console.error('Error in processTemplateImages:', error);
    } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, PROCESSING_DELAYS.MEMORY_CLEANUP);
    }

    const validImages = processedImages.filter(img => img && img.name && (img.file || img.blob));
    console.log('Total valid images processed:', validImages.length);

    // Log summary by category
    const categorySummary = {};
    validImages.forEach(img => {
        const cat = img.template?.category || 'unknown';
        categorySummary[cat] = (categorySummary[cat] || 0) + 1;
    });
    console.log('Category summary:', categorySummary);

    return validImages;
};

/**
 * Creates favicon preview image
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
            case 'web':
                categoryConfigs.push({
                    id: 'web',
                    name: 'Web Images',
                    icon: 'fas fa-globe',
                    description: 'Images optimized for web use'
                });
                break;
            case 'logo':
                categoryConfigs.push({
                    id: 'logo',
                    name: 'Logo Variations',
                    icon: 'fas fa-palette',
                    description: 'Logo formats for different uses'
                });
                break;
            case 'favicon':
                categoryConfigs.push({
                    id: 'favicon',
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
            case 'screenshots':
                categoryConfigs.push({
                    id: 'screenshots',
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
 * Validates template selection for processing
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
 * Groups templates by category for display
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
 */
export const getRecommendedTemplates = (image, SOCIAL_MEDIA_TEMPLATES) => {
    if (!image || !SOCIAL_MEDIA_TEMPLATES) return [];

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