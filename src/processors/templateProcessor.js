// src/processors/templateProcessor.js
import {
    DEFAULT_QUALITY,
    LARGE_IMAGE_THRESHOLD,
    PROCESSING_DELAYS,
    ERROR_BACKGROUND_COLOR,
    ERROR_BORDER_COLOR,
    ERROR_TEXT_COLOR,
    WARNING_TEXT_COLOR,
    DEFAULT_FONT_FAMILY,
    HEADLINE_FONT_SIZE,
    BODY_FONT_SIZE,
    CAPTION_FONT_SIZE,
    ERROR_MESSAGES,
    INFO_COLOR,
    DEFAULT_JPG_QUALITY,
    DEFAULT_PNG_QUALITY
} from '../constants/sharedConstants';

// Import template-related constants from templateConfigs.js
import {
    FAVICON_PREVIEW_SIZE,
    DEFAULT_FAVICON_SITE_NAME,
    DEFAULT_FAVICON_THEME_COLOR,
    DEFAULT_FAVICON_BACKGROUND_COLOR,
    SCREENSHOT_TEMPLATES
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
    ensureFileObject,
    UnifiedScreenshotService
} from '../utils';

let cleanupInProgress = false;
let aiUpscalingDisabled = false;

// Helper function to get category constant
const getCategoryConstant = (categoryId) => {
    switch (categoryId) {
        case 'web': return 'web';
        case 'logo': return 'logo';
        case 'favicon': return 'favicon';
        case 'screenshots': return 'screenshots';
        default: return 'social_media'; // All other social media platforms
    }
};

/**
 * Creates favicon preview image with theme colors.
 * @async
 * @param {File} imageFile - Source image file
 * @param {string} siteName - Website name
 * @param {string} themeColor - Theme color
 * @param {string} backgroundColor - Background color
 * @returns {Promise<File>} Favicon preview file
 */
const createFaviconPreview = async (imageFile, siteName, themeColor = DEFAULT_FAVICON_THEME_COLOR, backgroundColor = DEFAULT_FAVICON_BACKGROUND_COLOR) => {
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
                const scale = Math.min(400 / img.width, 400 / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (FAVICON_PREVIEW_SIZE - scaledWidth) / 2;
                const y = (FAVICON_PREVIEW_SIZE - scaledHeight) / 2;

                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

                ctx.fillStyle = themeColor;
                ctx.font = `bold ${HEADLINE_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(siteName, 256, 500);

                ctx.fillStyle = INFO_COLOR;
                ctx.font = `bold ${CAPTION_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
                ctx.fillText('Favicon Set', 256, 470);

                URL.revokeObjectURL(objectUrl);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'favicon-preview.png', { type: 'image/png' }));
                }, 'image/png', DEFAULT_QUALITY);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);

                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, FAVICON_PREVIEW_SIZE, FAVICON_PREVIEW_SIZE);

                ctx.fillStyle = themeColor;
                ctx.beginPath();
                ctx.arc(256, 256, 150, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = backgroundColor;
                ctx.font = `bold 120px ${DEFAULT_FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('F', 256, 256);

                ctx.font = `bold ${HEADLINE_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
                ctx.fillText(siteName, 256, 420);

                ctx.font = `bold ${CAPTION_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
                ctx.fillText('Favicon Set Preview', 256, 450);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'favicon-preview.png', { type: 'image/png' }));
                }, 'image/png', DEFAULT_QUALITY);
            };

            img.src = objectUrl;
        });
    });
};

/**
 * Creates template error files for failed templates.
 * @async
 * @param {Object} template - Template object
 * @param {Object} image - Original image object
 * @param {Error} error - Error object
 * @returns {Promise<Array<Object>>} Array of error placeholder image objects
 */
const createTemplateErrorFiles = async (template, image, error) => {
    return new Promise((resolve) => {
        const errorImages = [];
        const baseName = image.name.replace(/\.[^/.]+$/, '');
        const templateName = template.name.replace(/\s+/g, '-').toLowerCase();

        const errorFileName = `${templateName}-${baseName}-error.png`;
        const errorCanvas = document.createElement('canvas');
        const errorCtx = errorCanvas.getContext('2d');

        errorCanvas.width = template.width || 800;
        errorCanvas.height = template.height === 'auto' ? 600 : template.height || 600;

        errorCtx.fillStyle = ERROR_BACKGROUND_COLOR;
        errorCtx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);

        errorCtx.strokeStyle = ERROR_BORDER_COLOR;
        errorCtx.lineWidth = 3;
        errorCtx.strokeRect(10, 10, errorCanvas.width - 20, errorCanvas.height - 20);

        errorCtx.fillStyle = ERROR_TEXT_COLOR;
        errorCtx.font = `bold ${Math.min(HEADLINE_FONT_SIZE * 2, errorCanvas.height / 10)}px ${DEFAULT_FONT_FAMILY}`;
        errorCtx.textAlign = 'center';
        errorCtx.textBaseline = 'middle';
        errorCtx.fillText(ERROR_MESSAGES.PROCESSING_ERROR, errorCanvas.width / 2, errorCanvas.height / 2 - 40);

        errorCtx.font = `bold ${Math.min(HEADLINE_FONT_SIZE, errorCanvas.height / 15)}px ${DEFAULT_FONT_FAMILY}`;
        errorCtx.fillText('Processing Error', errorCanvas.width / 2, errorCanvas.height / 2);

        errorCtx.fillStyle = WARNING_TEXT_COLOR;
        errorCtx.font = `${Math.min(BODY_FONT_SIZE, errorCanvas.height / 20)}px ${DEFAULT_FONT_FAMILY}`;

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
                type: 'image/png'
            });

            errorImages.push({
                ...image,
                file: errorFile,
                name: errorFileName,
                template: template,
                format: 'png',
                processed: false,
                error: error.message,
                aiCropped: false
            });

            resolve(errorImages);
        }, 'image/png', DEFAULT_QUALITY);
    });
};

/**
 * Creates screenshot preview for the template system
 * @async
 * @param {File} imageFile - Source image file
 * @param {string} screenshotUrl - Website URL for screenshots
 * @returns {Promise<File>} Screenshot preview file
 */
const createScreenshotPreview = async (imageFile, screenshotUrl) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 1024;
        canvas.height = 768;

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#f0f9ff');
        gradient.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        img.onload = () => {
            const scale = Math.min(200 / img.width, 200 / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (canvas.width - scaledWidth) / 2;
            const y = (canvas.height - scaledHeight) / 2;

            ctx.drawImage(img, x, y - 50, scaledWidth, scaledHeight);

            ctx.fillStyle = '#1e40af';
            ctx.font = `bold 32px ${DEFAULT_FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Website Screenshots', canvas.width / 2, 100);

            ctx.fillStyle = '#374151';
            ctx.font = `18px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText(`URL: ${screenshotUrl}`, canvas.width / 2, 140);

            ctx.fillStyle = '#6b7280';
            ctx.font = `16px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText('Screenshots will be captured using Vercel API', canvas.width / 2, canvas.height - 60);

            URL.revokeObjectURL(objectUrl);

            canvas.toBlob((blob) => {
                resolve(new File([blob], 'screenshot-preview.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);

            ctx.fillStyle = '#1e40af';
            ctx.font = `bold 32px ${DEFAULT_FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Website Screenshots', canvas.width / 2, 200);

            ctx.fillStyle = '#374151';
            ctx.font = `18px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText(`URL: ${screenshotUrl}`, canvas.width / 2, 250);

            ctx.fillStyle = '#6b7280';
            ctx.font = `16px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText('Screenshots will be captured using Vercel API', canvas.width / 2, 300);

            ctx.fillStyle = '#fbbf24';
            ctx.font = `14px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText('Note: Configure Vercel API for actual screenshots', canvas.width / 2, 350);

            canvas.toBlob((blob) => {
                resolve(new File([blob], 'screenshot-preview.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        };

        img.src = objectUrl;
    });
};

/**
 * Processes a single template.
 * @async
 * @param {Object} template - Template object
 * @param {Object} image - Original image object
 * @param {File} imageFile - Source image file
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {boolean} isLargeImage - Whether the image is large
 * @param {boolean} hasTransparency - Whether the image has transparency
 * @returns {Promise<Array<Object>>} Array of processed images for this template
 */
const processSingleTemplate = async (template, image, imageFile, useSmartCrop, aiModelLoaded, isLargeImage, hasTransparency) => {
    const processedImages = [];

    try {
        let processedFile = imageFile;
        let wasUpscaled = false;
        let wasSmartCropped = false;

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
                            { quality: DEFAULT_QUALITY, format: 'webp' }
                        );
                        wasSmartCropped = true;
                    } catch (smartCropError) {
                        processedFile = await processSimpleSmartCrop(
                            processedFile,
                            targetWidth,
                            targetHeight,
                            'center',
                            { quality: DEFAULT_QUALITY, format: 'webp' }
                        );
                    }
                } else {
                    const cropResults = await processLemGendaryCrop(
                        [{ file: processedFile, name: image.name }],
                        targetWidth,
                        targetHeight,
                        'center',
                        { quality: DEFAULT_QUALITY, format: 'webp' }
                    );
                    if (cropResults.length > 0 && cropResults[0].cropped) {
                        processedFile = cropResults[0].cropped;
                    }
                }
            } else {
                const resizeResults = await processLemGendaryResize(
                    [{ file: processedFile, name: image.name }],
                    targetWidth,
                    { quality: DEFAULT_QUALITY, format: 'webp' }
                );
                if (resizeResults.length > 0 && resizeResults[0].resized) {
                    processedFile = resizeResults[0].resized;
                    wasUpscaled = resizeResults[0].upscaled || false;
                }
            }
        }

        const webpFile = await optimizeForWeb(processedFile, DEFAULT_QUALITY, 'webp');
        const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`;
        const webpName = `${baseName}.webp`;

        processedImages.push({
            ...image,
            file: webpFile,
            name: webpName,
            template: template,
            format: 'webp',
            processed: true,
            aiCropped: wasSmartCropped,
            upscaled: wasUpscaled
        });

        // Check template category using our helper
        const templateCategory = getCategoryConstant(template.category);

        if (templateCategory === 'logo') {
            const pngFile = await optimizeForWeb(processedFile, DEFAULT_PNG_QUALITY, 'png');
            const pngName = `${baseName}.png`;

            processedImages.push({
                ...image,
                file: pngFile,
                name: pngName,
                template: template,
                format: 'png',
                processed: true,
                aiCropped: wasSmartCropped,
                upscaled: wasUpscaled,
                hasTransparency: true
            });

            const jpgFile = await optimizeForWeb(processedFile, DEFAULT_JPG_QUALITY, 'jpg');
            const jpgName = `${baseName}.jpg`;

            processedImages.push({
                ...image,
                file: jpgFile,
                name: jpgName,
                template: template,
                format: 'jpg',
                processed: true,
                aiCropped: wasSmartCropped,
                upscaled: wasUpscaled,
                hasTransparency: false
            });
        } else if (templateCategory === 'web') {
            const fallbackFormat = hasTransparency ? 'png' : 'jpg';
            const fallbackQuality = fallbackFormat === 'png' ? DEFAULT_PNG_QUALITY : DEFAULT_JPG_QUALITY;
            const fallbackFile = await optimizeForWeb(processedFile, fallbackQuality, fallbackFormat);
            const fallbackName = `${baseName}.${fallbackFormat}`;

            processedImages.push({
                ...image,
                file: fallbackFile,
                name: fallbackName,
                template: template,
                format: fallbackFormat,
                processed: true,
                aiCropped: wasSmartCropped,
                upscaled: wasUpscaled,
                hasTransparency: hasTransparency
            });
        } else {
            const jpgFile = await optimizeForWeb(processedFile, DEFAULT_JPG_QUALITY, 'jpg');
            const jpgName = `${baseName}.jpg`;

            processedImages.push({
                ...image,
                file: jpgFile,
                name: jpgName,
                template: template,
                format: 'jpg',
                processed: true,
                aiCropped: wasSmartCropped,
                upscaled: wasUpscaled
            });
        }

        return processedImages;
    } catch (error) {
        return await createTemplateErrorFiles(template, image, error);
    }
};

/**
 * Processes images using social media templates.
 * @async
 * @param {Object} image - Image object to process
 * @param {Array<Object>} selectedTemplates - Array of template objects
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Object} options - Additional options for favicon/screenshot generation
 * @returns {Promise<Array<Object>>} Array of processed template images
 */
export const processTemplateImages = async (image, selectedTemplates, useSmartCrop = false, aiModelLoaded = false, options = {}) => {
    const processedImages = [];
    const imageFile = await ensureFileObject(image);
    const isSVG = imageFile.type === 'image/svg+xml';

    const transparencyInfo = await checkImageTransparencyDetailed(imageFile);
    const hasTransparency = transparencyInfo.hasTransparency;

    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const totalPixels = img.naturalWidth * img.naturalHeight;
    const isLargeImage = totalPixels > LARGE_IMAGE_THRESHOLD;

    // Use our helper function to filter templates
    const regularTemplates = selectedTemplates.filter(t => {
        const category = getCategoryConstant(t.category);
        return category !== 'favicon' && category !== 'screenshots';
    });

    const faviconTemplate = selectedTemplates.find(t => getCategoryConstant(t.category) === 'favicon');
    const screenshotTemplates = selectedTemplates.filter(t => getCategoryConstant(t.category) === 'screenshots');

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        for (const template of regularTemplates) {
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

        if (options.includeFavicon === true && faviconTemplate) {
            try {
                const faviconPlaceholder = await createFaviconPreview(
                    imageFile,
                    options.faviconSiteName || DEFAULT_FAVICON_SITE_NAME,
                    options.faviconThemeColor || DEFAULT_FAVICON_THEME_COLOR,
                    options.faviconBackgroundColor || DEFAULT_FAVICON_BACKGROUND_COLOR
                );

                processedImages.push({
                    ...image,
                    file: faviconPlaceholder,
                    name: 'favicon-preview.png',
                    template: faviconTemplate,
                    format: 'png',
                    processed: true,
                    isFaviconSource: true,
                    metadata: {
                        siteName: options.faviconSiteName || DEFAULT_FAVICON_SITE_NAME,
                        themeColor: options.faviconThemeColor || DEFAULT_FAVICON_THEME_COLOR,
                        backgroundColor: options.faviconBackgroundColor || DEFAULT_FAVICON_BACKGROUND_COLOR
                    }
                });

                await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.MEMORY_CLEANUP));
                safeCleanupGPUMemory();

            } catch (faviconError) {
                const errorFiles = await createTemplateErrorFiles(faviconTemplate, image, faviconError);
                processedImages.push(...errorFiles);
            }
        }

        if (options.includeScreenshots === true && screenshotTemplates.length > 0 && options.screenshotUrl) {
            try {
                const screenshotService = new UnifiedScreenshotService({
                    useServerCapture: true,
                    enableCaching: true,
                    enableCompression: true,
                    timeout: PROCESSING_DELAYS.SCREENSHOT_CAPTURE
                });

                const screenshotResults = await screenshotService.processScreenshotsForTemplates(
                    options.screenshotUrl,
                    screenshotTemplates,
                    options
                );

                processedImages.push(...screenshotResults);

                const screenshotPlaceholder = await createScreenshotPreview(
                    imageFile,
                    options.screenshotUrl
                );

                processedImages.push({
                    ...image,
                    file: screenshotPlaceholder,
                    name: 'screenshot-preview.jpg',
                    template: screenshotTemplates[0],
                    format: 'jpg',
                    processed: true,
                    isScreenshotSource: true,
                    metadata: {
                        url: options.screenshotUrl
                    }
                });

                await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.MEMORY_CLEANUP));
                safeCleanupGPUMemory();

            } catch (screenshotError) {
                const errorFiles = await createTemplateErrorFiles(screenshotTemplates[0], image, screenshotError);
                processedImages.push(...errorFiles);
            }
        }

    } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, PROCESSING_DELAYS.MEMORY_CLEANUP);
    }

    return processedImages;
};

/**
 * Orchestrates template image processing workflow.
 * @async
 * @param {Object} selectedImage - Selected image object
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {Array<Object>} templateConfigs - Template configurations
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @param {Object} processingOptions - Additional processing options for favicon/screenshot
 * @returns {Promise<Array<Object>>} Processed template images
 * @throws {Error} If no image or templates selected
 */
export const orchestrateTemplateProcessing = async (selectedImage, selectedTemplateIds, templateConfigs, useSmartCrop = false, aiModelLoaded = false, onProgress = null, processingOptions = {}) => {
    try {
        if (!selectedImage) {
            throw new Error(ERROR_MESSAGES.NO_IMAGE_SELECTED);
        }

        if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
            throw new Error(ERROR_MESSAGES.NO_TEMPLATES_SELECTED);
        }

        if (onProgress) onProgress('preparing', 10);

        const filteredTemplateIds = selectedTemplateIds.filter(id => {
            const template = templateConfigs.find(t => t.id === id);
            if (!template) return false;

            const category = getCategoryConstant(template.category);
            if (category === 'favicon' && !processingOptions.includeFavicon) return false;
            if (category === 'screenshots' && !processingOptions.includeScreenshots) return false;

            return true;
        });

        if (filteredTemplateIds.length === 0) {
            throw new Error(ERROR_MESSAGES.NO_VALID_TEMPLATES);
        }

        if (onProgress) onProgress('processing', 30);

        const selectedTemplates = filteredTemplateIds
            .map(templateId => templateConfigs.find(t => t.id === templateId))
            .filter(template => template !== null);

        if (selectedTemplates.length === 0) {
            throw new Error(ERROR_MESSAGES.NO_VALID_TEMPLATES);
        }

        if (onProgress) onProgress('processing', 30);

        const processedImages = [];

        // Filter templates using our helper
        const screenshotTemplates = selectedTemplates.filter(t => getCategoryConstant(t.category) === 'screenshots');
        const otherTemplates = selectedTemplates.filter(t => getCategoryConstant(t.category) !== 'screenshots');

        if (otherTemplates.length > 0) {
            if (onProgress) onProgress('processing-regular-templates', 40);

            const regularTemplateImages = await processTemplateImages(
                selectedImage,
                otherTemplates,
                useSmartCrop,
                aiModelLoaded,
                processingOptions
            );

            processedImages.push(...regularTemplateImages);
        }

        if (screenshotTemplates.length > 0 && processingOptions.includeScreenshots && processingOptions.screenshotUrl) {
            if (onProgress) onProgress('capturing-screenshots', 70);

            const screenshotService = new UnifiedScreenshotService({
                useServerCapture: true,
                enableCaching: true,
                enableCompression: true,
                timeout: PROCESSING_DELAYS.SCREENSHOT_CAPTURE
            });

            const screenshotResults = await screenshotService.processScreenshotsForTemplates(
                processingOptions.screenshotUrl,
                screenshotTemplates,
                {
                    fullPage: processingOptions.fullPageScreenshots || false,
                    siteName: processingOptions.faviconSiteName || 'Website'
                }
            );

            processedImages.push(...screenshotResults);
        }

        if (onProgress) onProgress('finalizing', 90);

        await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAYS.MEMORY_CLEANUP));
        safeCleanupGPUMemory();

        if (onProgress) onProgress('completed', 100);

        return processedImages;

    } catch (error) {
        throw error;
    }
};