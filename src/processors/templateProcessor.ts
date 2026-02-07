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
 */
export const getTemplateById = (templateId: string, SOCIAL_MEDIA_TEMPLATES: any[]): any | null => {
    return SOCIAL_MEDIA_TEMPLATES.find(template => template.id === templateId) || null;
};

/**
 * Gets templates by category
 */
export const getTemplatesByCategory = (category: string, templateConfigs: any[]): any[] => {
    return templateConfigs.filter(t => t.category === category);
};

/**
 * Calculates total files generated from selected templates
 */
export const calculateTotalTemplateFiles = (
    selectedTemplates: string[],
    _SOCIAL_MEDIA_TEMPLATES: any[],
    isFaviconSelected: boolean,
    isScreenshotSelected: boolean,
    screenshotTemplateCount: number,
    faviconMode: string = 'basic'
): number => {
    let count = (selectedTemplates || []).length;
    if (isFaviconSelected) {
        if (faviconMode === 'basic') {
            count += (FAVICON_SIZES_BASIC.length + 5);
        } else {
            count += (FAVICON_SIZES.length + 5);
        }
    }
    if (isScreenshotSelected) {
        count += (screenshotTemplateCount || 0);
    }
    return count;
};

/**
 * Gets category display name
 */
export const getCategoryDisplayName = (categoryId: string): string => {
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
 * Creates template error files
 */
async function createTemplateErrorFiles(template: any, image: any, error: any): Promise<any[]> {
    return new Promise((resolve) => {
        const errorImages: any[] = [];
        const baseName = image.name ? image.name.replace(/\.[^/.]+$/, '') : APP_CONFIG.FILE_NAMING.DEFAULT_ERROR_NAME;
        const templateName = template.name ? template.name.replace(/\s+/g, APP_CONFIG.FILE_NAMING.NAME_SEPARATOR).toLowerCase() : APP_CONFIG.FILE_NAMING.DEFAULT_TEMPLATE_NAME;

        const errorFileName = `${templateName}${APP_CONFIG.FILE_NAMING.NAME_SEPARATOR}${baseName}${APP_CONFIG.FILE_NAMING.NAME_SEPARATOR}${APP_CONFIG.FILE_NAMING.DEFAULT_ERROR_NAME}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${IMAGE_FORMATS.PNG}`;
        const errorCanvas = document.createElement('canvas');
        const errorCtx = errorCanvas.getContext('2d');
        if (!errorCtx) throw new Error("No context");

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
        const lines: string[] = [];
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
            if (!blob) {
                resolve([]);
                return;
            }
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
}

/**
 * Processes a single template
 */
async function processSingleTemplate(
    template: any,
    image: any,
    imageFile: File,
    useSmartCrop: boolean,
    aiModelLoaded: boolean,
    _isLargeImage: boolean,
    hasTransparency: boolean
): Promise<any[]> {
    const processedImages: any[] = [];

    try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise<void>((resolve, reject) => {
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

        let processedFile: File | any = imageFile;
        let wasUpscaled = false;
        let wasSmartCropped = false;
        const isLogoTemplate = template.category === 'logo';
        let subjectProtected = false;

        if (template.width && template.height) {
            const targetWidth = parseInt(template.width);
            const targetHeight = template.height === 'auto' ? null : parseInt(template.height);

            if (targetHeight) {
                if (useSmartCrop && aiModelLoaded && !aiUpscalingDisabled) {
                    try {
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
                    } catch {
                        processedFile = await processSimpleSmartCrop(
                            processedFile,
                            targetWidth,
                            targetHeight,
                            { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP, isLogo: isLogoTemplate, templateConfig: template.cropConfig }
                        );
                    }
                } else {
                    processedFile = await processSimpleSmartCrop(
                        processedFile,
                        targetWidth,
                        targetHeight,
                        { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
                    );
                }
            } else {
                const resizeResults: any = await processLemGendaryResize(
                    [{ file: processedFile, name: image.name || APP_CONFIG.FILE_NAMING.DEFAULT_BASE_NAME }] as any,
                    targetWidth,
                    { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }
                );
                if (resizeResults.length > 0 && resizeResults[0].resized) {
                    processedFile = resizeResults[0].resized;
                    if (resizeResults[0].upscaleScale) {
                        wasUpscaled = true;
                        (processedFile as any).aiUpscaleScale = resizeResults[0].upscaleScale;
                        (processedFile as any).aiUpscaleModel = resizeResults[0].upscaleModel;
                    } else {
                        wasUpscaled = resizeResults[0].upscaled || false;
                    }
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
                    aiSmartCrop: (processedFile as any).aiSmartCrop || wasSmartCropped,
                    upscaled: wasUpscaled,
                    aiUpscaleScale: (processedFile as any).aiUpscaleScale,
                    aiUpscaleModel: (processedFile as any).aiUpscaleModel,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch { /* ignored */ }

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
                    aiSmartCrop: (processedFile as any).aiSmartCrop || wasSmartCropped,
                    upscaled: wasUpscaled,
                    aiUpscaleScale: (processedFile as any).aiUpscaleScale,
                    aiUpscaleModel: (processedFile as any).aiUpscaleModel,
                    hasTransparency: false,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch { /* ignored */ }

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
                    aiSmartCrop: (processedFile as any).aiSmartCrop || wasSmartCropped,
                    upscaled: wasUpscaled,
                    aiUpscaleScale: (processedFile as any).aiUpscaleScale,
                    aiUpscaleModel: (processedFile as any).aiUpscaleModel,
                    hasTransparency: hasTransparency,
                    isLogo: true,
                    subjectProtected: subjectProtected
                });
            } catch { /* ignored */ }

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
                        aiSmartCrop: (processedFile as any).aiSmartCrop || wasSmartCropped,
                        upscaled: wasUpscaled,
                        aiUpscaleScale: (processedFile as any).aiUpscaleScale,
                        aiUpscaleModel: (processedFile as any).aiUpscaleModel,
                        hasTransparency: false,
                        isLogo: true,
                        subjectProtected: subjectProtected
                    });
                } catch { /* ignored */ }
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
                    aiSmartCrop: (processedFile as any).aiSmartCrop || wasSmartCropped,
                    upscaled: wasUpscaled,
                    aiUpscaleScale: (processedFile as any).aiUpscaleScale,
                    aiUpscaleModel: (processedFile as any).aiUpscaleModel,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch { /* ignored */ }
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
                    aiSmartCrop: (processedFile as any).aiSmartCrop || wasSmartCropped,
                    upscaled: wasUpscaled,
                    aiUpscaleScale: (processedFile as any).aiUpscaleScale,
                    aiUpscaleModel: (processedFile as any).aiUpscaleModel,
                    isLogo: false,
                    subjectProtected: false
                });
            } catch { /* ignored */ }
        }

        return processedImages;

    } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
            return await createTemplateErrorFiles(template, image, error);
        }
        return [];
    }
}

/**
 * Processes images using social media templates
 */
export const processTemplateImages = async (
    image: any,
    selectedTemplates: any[],
    useSmartCrop: boolean = false,
    aiModelLoaded: boolean = false
): Promise<any[]> => {
    const processedImages: any[] = [];

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
    await new Promise<void>((resolve, reject) => {
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

    } catch { /* ignored */ } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, PROCESSING_DELAYS.MEMORY_CLEANUP);
    }

    const validImages = processedImages.filter(img => img && img.name && (img.file || img.blob));

    return validImages;
};

/**
 * Creates favicon preview image
 */
export const createFaviconPreview = async (
    imageFile: File,
    siteName: string,
    themeColor: string = DEFAULT_FAVICON_THEME_COLOR,
    backgroundColor: string = DEFAULT_FAVICON_BACKGROUND_COLOR
): Promise<File> => {
    return new Promise((resolve) => {
        checkImageTransparency(imageFile).then(hasTransparency => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No context");

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
                    if (!blob) throw new Error("Failed to create blob");
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
                    if (!blob) throw new Error("Failed to create blob");
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
export const getTemplateCategories = (SOCIAL_MEDIA_TEMPLATES: any[]): any[] => {
    const categories = new Set<string>();

    if (SOCIAL_MEDIA_TEMPLATES && SOCIAL_MEDIA_TEMPLATES.length > 0) {
        SOCIAL_MEDIA_TEMPLATES.forEach(template => {
            if (template.category) {
                categories.add(template.category);
            }
        });
    }

    const categoryConfigs: any[] = [];

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
 */
export const requiresSmartCrop = (template: any): boolean => {
    if (!template) return false;

    const aspectRatio = template.height === 'auto' ? 1 : template.width / template.height;

    return template.category === 'social_media' ||
        template.category === 'instagram' ||
        template.category === 'pinterest' ||
        (aspectRatio >= 1.5 || aspectRatio <= 0.67);
};

/**
 * Groups templates by category for display
 */
export const groupTemplatesByCategory = (templates: any[]): Record<string, any[]> => {
    const grouped: Record<string, any[]> = {};

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
export const getRecommendedTemplates = (image: any, SOCIAL_MEDIA_TEMPLATES: any[]): Promise<string[]> => {
    if (!image || !SOCIAL_MEDIA_TEMPLATES) return Promise.resolve([]);

    const img = new Image();
    const objectUrl = URL.createObjectURL(image.file || image.blob);

    return new Promise((resolve) => {
        img.onload = () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const recommendations: string[] = [];

            SOCIAL_MEDIA_TEMPLATES.forEach(template => {
                if (!template || !template.id) return;

                const templateAspectRatio = template.height === 'auto' ? 1 : template.width / template.height;

                if (Math.abs(aspectRatio - templateAspectRatio) < 0.2) {
                    recommendations.push(template.id);
                }
            });

            URL.revokeObjectURL(objectUrl);
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
 * Cleanup processor resources
 */
export const cleanupTemplateProcessor = (): void => {
    cleanupInProgress = false;
    aiUpscalingDisabled = false;
    safeCleanupGPUMemory();
};

/**
 * Reset AI upscaling disabled flag
 */
export const resetAIUpscaling = (): void => {
    aiUpscalingDisabled = false;
};
