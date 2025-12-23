// src/processors/templateProcessor.js
import {
    CROP_MODES,
    MAX_SAFE_DIMENSION,
    DEFAULT_QUALITY,
    LARGE_IMAGE_THRESHOLD,
    PROCESSING_DELAYS,
    TEMPLATE_CATEGORIES
} from '../constants/sharedConstants.js';

import {
    processLemGendaryResize,
    processLemGendaryCrop,
    processSmartCrop,
    processSimpleSmartCrop,
    optimizeForWeb,
    checkImageTransparency,
    checkImageTransparencyDetailed
} from '../processors/index.js';

import {
    safeCleanupGPUMemory,
    ensureFileObject,
    checkAVIFSupport
} from '../utils/index.js';

let cleanupInProgress = false;
let aiUpscalingDisabled = false;

/**
 * Creates favicon preview image with theme colors.
 * @async
 * @param {File} imageFile - Source image file
 * @param {string} siteName - Website name
 * @param {string} themeColor - Theme color (e.g., #ffffff)
 * @param {string} backgroundColor - Background color (e.g., #ffffff)
 * @returns {Promise<File>} Favicon preview file
 */
const createFaviconPreview = async (imageFile, siteName, themeColor = '#ffffff', backgroundColor = '#ffffff') => {
    return new Promise((resolve) => {
        checkImageTransparency(imageFile).then(hasTransparency => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = 512;
            canvas.height = 512;

            if (hasTransparency) {
                ctx.clearRect(0, 0, 512, 512);
            } else {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, 512, 512);
            }

            const img = new Image();
            const objectUrl = URL.createObjectURL(imageFile);

            img.onload = () => {
                const scale = Math.min(400 / img.width, 400 / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (512 - scaledWidth) / 2;
                const y = (512 - scaledHeight) / 2;

                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

                ctx.fillStyle = themeColor;
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(siteName, 256, 500);

                ctx.fillStyle = '#4a90e2';
                ctx.font = 'bold 18px Arial';
                ctx.fillText('Favicon Set', 256, 470);

                URL.revokeObjectURL(objectUrl);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'favicon-preview.png', { type: 'image/png' }));
                }, 'image/png', 0.9);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);

                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, 512, 512);

                ctx.fillStyle = themeColor;
                ctx.beginPath();
                ctx.arc(256, 256, 150, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = backgroundColor;
                ctx.font = 'bold 120px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('F', 256, 256);

                ctx.font = 'bold 24px Arial';
                ctx.fillText(siteName, 256, 420);

                ctx.font = 'bold 18px Arial';
                ctx.fillText('Favicon Set Preview', 256, 450);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'favicon-preview.png', { type: 'image/png' }));
                }, 'image/png', 0.9);
            };

            img.src = objectUrl;
        });
    });
};

/**
 * Creates screenshot preview image.
 * @async
 * @param {File} imageFile - Source image file
 * @param {string} url - Website URL
 * @returns {Promise<File>} Screenshot preview file
 */
const createScreenshotPreview = async (imageFile, url) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 800;
        canvas.height = 450;

        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 800, 450);

        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(50, 30, 700, 40);

        ctx.fillStyle = '#ff5f57';
        ctx.beginPath();
        ctx.arc(75, 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffbd2e';
        ctx.beginPath();
        ctx.arc(100, 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#28ca42';
        ctx.beginPath();
        ctx.arc(125, 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(150, 38, 550, 24);
        ctx.strokeStyle = '#d0d0d0';
        ctx.strokeRect(150, 38, 550, 24);

        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
        ctx.fillText(displayUrl, 155, 55);

        const contentY = 90;
        const contentHeight = 450 - contentY - 30;

        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        img.onload = () => {
            const scale = Math.min(650 / img.width, contentHeight / img.height) * 0.7;
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = 75 + ((700 - 50) - scaledWidth) / 2;
            const y = contentY + (contentHeight - scaledHeight) / 2;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(75, contentY, 650, contentHeight);

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

            ctx.fillStyle = '#4a90e2';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Screenshot Preview', 400, contentY + 40);

            ctx.fillStyle = '#666666';
            ctx.font = '16px Arial';
            ctx.fillText('Actual screenshot will be captured from:', 400, contentY + 80);

            ctx.fillStyle = '#333333';
            ctx.font = '14px Arial';
            ctx.fillText(displayUrl, 400, contentY + 110);

            URL.revokeObjectURL(objectUrl);

            canvas.toBlob((blob) => {
                resolve(new File([blob], 'screenshot-preview.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', DEFAULT_QUALITY);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(75, contentY, 650, contentHeight);

            ctx.fillStyle = '#4a90e2';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Website Screenshot', 400, 250);

            ctx.fillStyle = '#666666';
            ctx.font = '16px Arial';
            ctx.fillText('Will capture from:', 400, 290);
            ctx.fillText(displayUrl, 400, 320);

            canvas.toBlob((blob) => {
                resolve(new File([blob], 'screenshot-preview.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', DEFAULT_QUALITY);
        };

        img.src = objectUrl;
    });
};

/**
 * Creates error placeholder files for failed templates.
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

        errorCtx.fillStyle = '#f8d7da';
        errorCtx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);

        errorCtx.strokeStyle = '#f5c6cb';
        errorCtx.lineWidth = 3;
        errorCtx.strokeRect(10, 10, errorCanvas.width - 20, errorCanvas.height - 20);

        errorCtx.fillStyle = '#721c24';
        errorCtx.font = `bold ${Math.min(48, errorCanvas.height / 10)}px Arial`;
        errorCtx.textAlign = 'center';
        errorCtx.textBaseline = 'middle';
        errorCtx.fillText('Error', errorCanvas.width / 2, errorCanvas.height / 2 - 40);

        errorCtx.font = `bold ${Math.min(24, errorCanvas.height / 15)}px Arial`;
        errorCtx.fillText('Processing Error', errorCanvas.width / 2, errorCanvas.height / 2);

        errorCtx.fillStyle = '#856404';
        errorCtx.font = `${Math.min(16, errorCanvas.height / 20)}px Arial`;

        const errorMessage = error.message || 'Unknown error';
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
        }, 'image/png', 0.8);
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

        const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp');
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

        if (template.category === TEMPLATE_CATEGORIES.LOGO) {
            const pngFile = await optimizeForWeb(processedFile, 0.9, 'png');
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

            const jpgFile = await optimizeForWeb(processedFile, 0.95, 'jpg');
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
        } else if (template.category === TEMPLATE_CATEGORIES.WEB) {
            const fallbackFormat = hasTransparency ? 'png' : 'jpg';
            const fallbackFile = await optimizeForWeb(processedFile, 0.85, fallbackFormat);
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
            const jpgFile = await optimizeForWeb(processedFile, 0.85, 'jpg');
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

    const regularTemplates = selectedTemplates.filter(t =>
        t.category !== 'favicon' && t.category !== 'screenshots'
    );

    const faviconTemplate = selectedTemplates.find(t => t.category === 'favicon');
    const screenshotTemplates = selectedTemplates.filter(t => t.category === 'screenshots');

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
                    options.faviconSiteName || 'My Website',
                    options.faviconThemeColor || '#ffffff',
                    options.faviconBackgroundColor || '#ffffff'
                );

                processedImages.push({
                    ...image,
                    file: faviconPlaceholder,
                    name: `favicon-preview.png`,
                    template: faviconTemplate,
                    format: 'png',
                    processed: true,
                    isFaviconSource: true,
                    metadata: {
                        siteName: options.faviconSiteName || 'My Website',
                        themeColor: options.faviconThemeColor || '#ffffff',
                        backgroundColor: options.faviconBackgroundColor || '#ffffff'
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
                const screenshotPlaceholder = await createScreenshotPreview(
                    imageFile,
                    options.screenshotUrl
                );

                processedImages.push({
                    ...image,
                    file: screenshotPlaceholder,
                    name: `screenshot-preview.jpg`,
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
            throw new Error('No image selected for template processing');
        }

        if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
            throw new Error('No templates selected');
        }

        if (onProgress) onProgress('preparing', 10);

        const filteredTemplateIds = selectedTemplateIds.filter(id => {
            const template = templateConfigs.find(t => t.id === id);
            if (!template) return false;

            if (template.category === 'favicon' && !processingOptions.includeFavicon) return false;
            if (template.category === 'screenshots' && !processingOptions.includeScreenshots) return false;

            return true;
        });

        if (filteredTemplateIds.length === 0) {
            throw new Error('No valid templates found after filtering');
        }

        const selectedTemplates = filteredTemplateIds
            .map(templateId => templateConfigs.find(t => t.id === templateId))
            .filter(template => template !== null);

        if (selectedTemplates.length === 0) {
            throw new Error('No valid templates found');
        }

        if (onProgress) onProgress('processing', 30);

        const processedImages = [];

        const screenshotTemplates = selectedTemplates.filter(t => t.category === 'screenshots');
        const otherTemplates = selectedTemplates.filter(t => t.category !== 'screenshots');

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

            const screenshotResults = await processScreenshotTemplates(
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