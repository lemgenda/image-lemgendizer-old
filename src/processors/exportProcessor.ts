/**
 * @file exportProcessor.ts
 * @description Handles file export, zip generation, and file organization for various processing modes.
 */
import JSZip from 'jszip';
import { PROCESSING_MODES, IMAGE_FORMATS, APP_CONFIG } from '../constants';
import { generateFaviconSet, validateImage } from '../utils';
import {
    EXPORT_FOLDERS,
    TEMPLATE_NAMES,
    APP_TEMPLATE_CONFIG,
    FAVICON_SIZES_BASIC
} from '../configs/templateConfigs';

/**
 * Checks if file is a preview or error file
 */
export const isPreviewOrErrorFile = (image: any): boolean => {
    try {
        if (!validateImage(image)) {
            return false;
        }

        const name = image.name.toLowerCase();
        const isErrorFile = name.includes('error') ||
            name.includes('failed') ||
            (image.error && image.processed === false) ||
            !image.processed;

        return name.includes('favicon-preview') ||
            name.includes('screenshot-preview') ||
            name.includes('-preview.') ||
            isErrorFile;
    } catch {
        return false;
    }
};

/**
 * Generates export settings based on mode
 */
export const generateExportSettings = (mode: string, additionalSettings: any = {}): any => {
    const baseDefaults: any = {
        includeOriginal: false,
        includeOptimized: false,
        includeWebImages: false,
        includeLogoImages: false,
        includeSocialMedia: false,
        includeFavicon: false,
        includeScreenshots: false,
        screenshotUrl: '',
        faviconSiteName: TEMPLATE_NAMES.FAVICON_SET || APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_SITE_NAME,
        faviconThemeColor: APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_THEME_COLOR,
        faviconBackgroundColor: APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR,
        createFolders: true
    };

    const mergedSettings = { ...baseDefaults };

    for (const key in additionalSettings) {
        mergedSettings[key] = additionalSettings[key];
    }

    if (mode === PROCESSING_MODES.CUSTOM || mode === PROCESSING_MODES.BATCH_RENAME) {
        return {
            ...mergedSettings,
            includeOriginal: true,
            includeOptimized: true
        };
    } else if (mode === PROCESSING_MODES.TEMPLATES) {
        return {
            ...mergedSettings,
            includeWebImages: true,
            includeLogoImages: true,
            includeSocialMedia: true,
        };
    }

    return mergedSettings;
};

/**
 * Gets export folder structure based on mode
 */
export const getExportFolderStructure = (mode: string, settings: any = {}): string[] => {
    if (mode === PROCESSING_MODES.CUSTOM || mode === PROCESSING_MODES.BATCH_RENAME) {
        return [EXPORT_FOLDERS.ORIGINAL_IMAGES, EXPORT_FOLDERS.OPTIMIZED_IMAGES];
    } else if (mode === PROCESSING_MODES.TEMPLATES) {
        const folders = [
            EXPORT_FOLDERS.WEB_IMAGES,
            EXPORT_FOLDERS.LOGO_IMAGES,
            EXPORT_FOLDERS.SOCIAL_MEDIA_IMAGES
        ];

        if (settings.includeFavicon) {
            folders.push(APP_TEMPLATE_CONFIG.FAVICON.FOLDER_NAME);
        }
        if (settings.includeScreenshots && settings.screenshotUrl) {
            folders.push(APP_TEMPLATE_CONFIG.SCREENSHOTS.FOLDER_NAME);
        }

        return folders;
    }
    return [];
};

/**
 * Organizes images by format
 */
export const organizeImagesByFormat = (processedImages: any[]): Record<string, any[]> => {
    const groupedByFormat: Record<string, any[]> = {};

    const validImages = processedImages.filter(validateImage);

    validImages.forEach(image => {
        const format = image.format || APP_CONFIG.IMAGE_DEFAULTS.DEFAULT_FORMAT;
        if (!groupedByFormat[format]) {
            groupedByFormat[format] = [];
        }
        if (!image.name.includes('.undefined')) {
            groupedByFormat[format].push(image);
        }
    });


    return groupedByFormat;
};

/**
 * Formats template name for display
 */
export const getTemplateDimensions = (template: any): string => {
    if (!template) return '';
    if (template.height === 'auto') {
        return `${template.width}×auto`;
    }
    return `${template.width}×${template.height}`;
};

/**
 * Gets translated platform name
 */
function getTranslatedPlatformName(platform: string, t: any): string {
    if (!platform) return '';
    if (!t) return platform;

    const translated = t(platform, { defaultValue: '' });
    if (translated) return translated;

    const categoryKey = `category.${platform.replace('platform.', '')}`;
    return t(categoryKey, { defaultValue: platform });
}

/**
 * Gets translated image name
 */
function getTranslatedImageName(image: any, t: any): string {
    if (!image.template) return image.name;

    const platform = image.template.platform || '';
    const displayPlatform = getTranslatedPlatformName(platform, t);

    const template = image.template.name || '';
    const templateName = t ? t(template, { defaultValue: template }) : template;

    const cleanPlatform = displayPlatform
        .replace(/\s*\/\s*X/g, '')
        .replace(/\s+/g, APP_CONFIG.FILE_NAMING.NAME_SEPARATOR)
        .trim();

    const dimensions = getTemplateDimensions(image.template);
    const format = image.format || APP_TEMPLATE_CONFIG.SCREENSHOTS.DEFAULT_FORMAT;

    return `${cleanPlatform} - ${templateName} (${dimensions})${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${format}`;
}

/**
 * Organizes templates by platform with translation support
 */
export const organizeTemplatesByPlatform = (socialTemplates: any[], t: any = null): Record<string, any[]> => {
    const organized: Record<string, any[]> = {};

    const validTemplates = socialTemplates.filter(img =>
        validateImage(img) &&
        img.template &&
        (img.format === IMAGE_FORMATS.JPG ||
            img.format === IMAGE_FORMATS.JPEG ||
            img.format === IMAGE_FORMATS.WEBP ||
            img.format === IMAGE_FORMATS.PNG)
    );

    validTemplates.forEach(img => {
        let platform = img.template.platform || '';
        const displayPlatform = getTranslatedPlatformName(platform, t);
        const cleanPlatform = displayPlatform.replace(/\s*\/\s*X/g, '').trim();

        if (!organized[cleanPlatform]) {
            organized[cleanPlatform] = [];
        }

        const cleanImage = {
            ...img,
            name: getTranslatedImageName(img, t)
        };

        organized[cleanPlatform].push(cleanImage);
    });

    return organized;
};

/**
 * Processes favicon set
 */
async function processFaviconSet(sourceImage: any, settings: any, zip: any = null): Promise<any> {
    try {
        const faviconZipBlob = await generateFaviconSet(
            sourceImage,
            settings.faviconSiteName || TEMPLATE_NAMES.FAVICON_SET || APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_SITE_NAME,
            settings.faviconThemeColor,
            settings.faviconBackgroundColor,
            settings.faviconMode
        );

        if (zip) {
            const faviconZip = await JSZip.loadAsync(faviconZipBlob);
            const faviconFolder = zip.folder(APP_TEMPLATE_CONFIG.FAVICON.FOLDER_NAME);

            const files = faviconZip.files;
            let count = 0;
            for (const [fileName, fileData] of Object.entries(files)) {
                if (!fileData.dir) {
                    const content = await fileData.async('blob');
                    faviconFolder.file(fileName, content);
                    count++;
                }
            }
            return count;
        } else {
            return faviconZipBlob;
        }
    } catch (error: any) {
        if (zip) {
            const faviconFolder = zip.folder(APP_TEMPLATE_CONFIG.FAVICON.FOLDER_NAME);
            faviconFolder.file(
                `${APP_CONFIG.ERROR_HANDLING.DEFAULT_ERROR_PREFIX}${APP_CONFIG.ERROR_HANDLING.ERROR_FILE_EXTENSION}`,
                `Favicon generation failed: ${error.message.substring(0, APP_CONFIG.ERROR_HANDLING.MAX_ERROR_LENGTH)}`
            );
        }
        return 0;
    }
}

/**
 * Creates export ZIP file with translation support
 */
export const createExportZip = async (
    originalImages: any[],
    processedImages: any[],
    settings: any,
    mode: string = APP_CONFIG.IMAGE_DEFAULTS.DEFAULT_FORMAT,
    t: any = null
): Promise<Blob> => {

    const zip = new JSZip();

    const validOriginalImages = originalImages.filter(validateImage);
    const validProcessedImages = processedImages.filter(img =>
        validateImage(img) && !isPreviewOrErrorFile(img)
    );




    if (settings.includeOriginal && validOriginalImages.length > 0) {
        const originalFolderName = (t && t('export.folders.original')) || EXPORT_FOLDERS.ORIGINAL_IMAGES;
        const originalFolder = zip.folder(originalFolderName)!;
        for (const image of validOriginalImages) {
            try {
                originalFolder?.file(image.name, image.file || image.blob);
            } catch {
                // Ignore error adding original image
            }
        }
    }

    let faviconFilesCount = 0;

    if (mode === PROCESSING_MODES.BATCH_RENAME && validProcessedImages.length > 0) {
        const renamedFolderName = (t && t('export.folders.renamed')) || EXPORT_FOLDERS.RENAMED_IMAGES;
        const renamedFolder = zip.folder(renamedFolderName)!;

        for (const image of validProcessedImages) {
            try {
                renamedFolder?.file(image.name, image.file || image.blob);
            } catch {
                // Ignore error
            }
        }
    } else if (mode === PROCESSING_MODES.CUSTOM && validProcessedImages.length > 0) {
        const groupedByFormat = organizeImagesByFormat(validProcessedImages);
        const optimizedFolderName = (t && t('export.folders.optimized')) || EXPORT_FOLDERS.OPTIMIZED_IMAGES;
        const optimizedFolder = zip.folder(optimizedFolderName)!;

        for (const [format, images] of Object.entries(groupedByFormat)) {
            if (images.length > 0) {
                const formatFolderName = format.toUpperCase();
                const formatFolder = optimizedFolder?.folder(formatFolderName)!;
                for (const image of images) {
                    try {
                        let fileName = image.name;
                        if (!fileName.includes(APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR)) {
                            fileName = `${fileName}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${format}`;
                        }
                        formatFolder?.file(fileName, image.file || image.blob);
                    } catch {
                        // Ignore error adding optimized image
                    }
                }
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeWebImages && validProcessedImages.length > 0) {
        const webTemplates = validProcessedImages.filter(img =>
            img.template && img.template.category === 'web'
        );

        if (webTemplates.length > 0) {
            const webFolderName = (t && t('export.folders.web')) || EXPORT_FOLDERS.WEB_IMAGES;
            const webFolder = zip.folder(webFolderName)!;

            for (const image of webTemplates) {
                try {
                    const fileName = getTranslatedImageName(image, t);
                    webFolder?.file(fileName, image.file || image.blob);
                } catch {
                    // Ignore error adding web template
                }
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeLogoImages && validProcessedImages.length > 0) {
        const logoTemplates = validProcessedImages.filter(img =>
            img.template && img.template.category === 'logo'
        );

        if (logoTemplates.length > 0) {
            const logoFolderName = (t && t('export.folders.logo')) || EXPORT_FOLDERS.LOGO_IMAGES;
            const logoFolder = zip.folder(logoFolderName)!;

            for (const image of logoTemplates) {
                const fileName = getTranslatedImageName(image, t);
                logoFolder?.file(fileName, image.file || image.blob);
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeSocialMedia && validProcessedImages.length > 0) {
        const socialTemplates = validProcessedImages.filter(img =>
            img.template &&
            img.template.category !== 'web' &&
            img.template.category !== 'logo' &&
            img.template.category !== 'favicon' &&
            img.template.category !== 'screenshots'
        );

        if (socialTemplates.length > 0) {
            const socialFolderName = (t && t('export.folders.social')) || EXPORT_FOLDERS.SOCIAL_MEDIA_IMAGES;
            const socialFolder = zip.folder(socialFolderName)!;
            const organizedPlatforms = organizeTemplatesByPlatform(socialTemplates, t);

            for (const [platform, platformImages] of Object.entries(organizedPlatforms)) {
                const platformFolderName = platform;
                const platformFolder = socialFolder?.folder(platformFolderName)!;
                for (const image of platformImages) {
                    const fileName = getTranslatedImageName(image, t);
                    platformFolder?.file(fileName, image.file || image.blob);
                }
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeScreenshots && settings.screenshotUrl && validProcessedImages.length > 0) {
        const screenshotTemplates = validProcessedImages.filter(img =>
            validateImage(img) &&
            img.template &&
            img.template.category === 'screenshots'
        );

        if (screenshotTemplates.length > 0) {
            const screenshotFolderName = (APP_TEMPLATE_CONFIG && APP_TEMPLATE_CONFIG.SCREENSHOTS && APP_TEMPLATE_CONFIG.SCREENSHOTS.FOLDER_NAME) ?
                APP_TEMPLATE_CONFIG.SCREENSHOTS.FOLDER_NAME : 'Screenshots';
            const screenshotFolder = zip.folder(screenshotFolderName)!;
            for (const image of screenshotTemplates) {
                const fileName = getTranslatedImageName(image, t);
                screenshotFolder?.file(fileName, image.file || image.blob);
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeFavicon === true) {
        const faviconSource = validProcessedImages.find(img =>
            img.template &&
            (img.template.category === 'web' ||
                img.template.category === 'logo') &&
            img.format === IMAGE_FORMATS.PNG
        ) || validOriginalImages[0];

        if (faviconSource) {
            try {
                let sourceImage = null;

                if (faviconSource.file || faviconSource.blob) {
                    sourceImage = faviconSource.file || faviconSource.blob;
                }

                if (sourceImage) {
                    faviconFilesCount = await processFaviconSet(sourceImage, settings, zip);
                }
            } catch (error: any) {
                const faviconFolder = zip.folder(APP_TEMPLATE_CONFIG.FAVICON.FOLDER_NAME)!;
                faviconFolder?.file(
                    `${APP_CONFIG.ERROR_HANDLING.DEFAULT_ERROR_PREFIX}${APP_CONFIG.ERROR_HANDLING.ERROR_FILE_EXTENSION}`,
                    `Favicon generation failed: ${error.message.substring(0, APP_CONFIG.ERROR_HANDLING.MAX_ERROR_LENGTH)}`
                );
            }
        }
    }

    const summary = createExportSummary(validOriginalImages, validProcessedImages, settings, mode, faviconFilesCount, t);
    zip.file('export-summary.txt', summary);

    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 6
        }
    });
};

/**
 * Creates favicon ZIP file
 */
export const createFaviconZip = async (imageFile: File, settings: any = {}): Promise<any> => {
    return await processFaviconSet(imageFile, settings);
};

/**
 * Creates screenshot ZIP file
 */
export const createScreenshotZip = async (screenshotImages: any[], url: string, t: any = null): Promise<Blob> => {
    const zip = new JSZip();

    const validImages = screenshotImages.filter(img =>
        validateImage(img) && !isPreviewOrErrorFile(img)
    );

    if (validImages.length === 0) {
        throw new Error('No valid screenshot images to export');
    }

    const screenshotFolder = zip.folder('Screenshots')!;

    for (const image of validImages) {
        let fileName = image.name;

        if (t) {
            fileName = getTranslatedImageName(image, t);
        } else if (!fileName || fileName === '') {
            const timestamp = new Date().toISOString().split('T')[0];
            const templateName = image.template?.name?.replace(/\s+/g, '-').toLowerCase() || 'screenshot';
            fileName = `${templateName}-${timestamp}.${image.format}`;
        }

        screenshotFolder?.file(fileName, image.file || image.blob);
    }

    const summary = `Screenshot Export Summary
============================

Export Date: ${new Date().toISOString()}
Website URL: ${url}
Total Screenshots: ${validImages.length}
Template Types: ${[...new Set(validImages.map((img: any) => img.template?.name))].join(', ')}
Dimensions: ${[...new Set(validImages.map((img: any) => `${img.template?.width || '?'}×${img.template?.height || '?'}`))].join(', ')}

Files:
${validImages.map((img: any, i: number) => `${i + 1}. ${img.name} (${img.format}, ${img.template?.width || '?'}×${img.template?.height || '?'})`).join('\n')}`;

    zip.file('screenshot-summary.txt', summary);

    return await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 6
        }
    });
};

/**
 * Calculates total files in export
 */
function calculateTotalFiles(
    originalImages: any[],
    processedImages: any[],
    settings: any,
    mode: string,
    faviconFilesCount: number = 0
): number {
    let total = 0;

    if (settings.includeOriginal) {
        total += originalImages.filter(validateImage).length;
    }

    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized) {
        total += processedImages.filter(img => validateImage(img) && !isPreviewOrErrorFile(img)).length;
    } else if (mode === PROCESSING_MODES.TEMPLATES) {
        const actualImages = processedImages.filter(img =>
            validateImage(img) && !isPreviewOrErrorFile(img)
        );

        if (settings.includeWebImages) {
            const webImages = actualImages.filter(img =>
                img.template && img.template.category === 'web'
            );
            total += webImages.length;
        }

        if (settings.includeLogoImages) {
            const logoImages = actualImages.filter(img =>
                img.template && img.template.category === 'logo'
            );
            total += logoImages.length;
        }

        if (settings.includeSocialMedia) {
            const socialImages = actualImages.filter(img =>
                img.template &&
                img.template.category !== 'web' &&
                img.template.category !== 'logo' &&
                img.template.category !== 'favicon' &&
                img.template.category !== 'screenshots'
            );
            total += socialImages.length;
        }

        if (settings.includeFavicon === true) {
            if (faviconFilesCount > 0) {
                total += faviconFilesCount;
            } else {
                if (settings.faviconMode === 'basic') {
                    total += (FAVICON_SIZES_BASIC.length + 4);
                } else {
                    total += APP_TEMPLATE_CONFIG.FAVICON.FILES_COUNT;
                }
            }
        }

        if (settings.includeScreenshots === true && settings.screenshotUrl) {
            const screenshotImages = actualImages.filter(img =>
                img.template && img.template.category === 'screenshots'
            );
            total += screenshotImages.length;
        }
    }

    total += 1;
    return total;
}

/**
 * Gets included content summary
 */
function getIncludedContentSummary(
    settings: any,
    mode: string,
    processedImages: any[],
    faviconFilesCount: number,
    t: any
): string {
    const items: string[] = [];

    if (settings.includeOriginal) items.push(t ? t('export.summary.originalImages') : 'Original images');
    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized) {
        items.push(t ? t('export.summary.optimizedImages') : 'Optimized images (organized by format)');
    }

    if (mode === PROCESSING_MODES.TEMPLATES) {
        const actualImages = processedImages.filter(img =>
            validateImage(img) && !isPreviewOrErrorFile(img)
        );

        if (settings.includeWebImages) {
            const webImages = actualImages.filter(img =>
                img.template && img.template.category === 'web'
            );
            if (webImages.length > 0) {
                items.push(t ? t('export.summary.webImages', { count: webImages.length }) :
                    `Web images (${webImages.length} files)`);
            }
        }

        if (settings.includeLogoImages) {
            const logoImages = actualImages.filter(img =>
                img.template && img.template.category === 'logo'
            );
            if (logoImages.length > 0) {
                items.push(t ? t('export.summary.logoVariations', { count: logoImages.length }) :
                    `Logo variations (${logoImages.length} files)`);
            }
        }

        if (settings.includeSocialMedia) {
            const socialImages = actualImages.filter(img =>
                img.template &&
                img.template.category !== 'web' &&
                img.template.category !== 'logo' &&
                img.template.category !== 'favicon' &&
                img.template.category !== 'screenshots'
            );
            if (socialImages.length > 0) {
                const platforms = new Set<string>();
                socialImages.forEach(img => {
                    if (img.template && img.template.platform) {
                        platforms.add(img.template.platform);
                    }
                });
                items.push(t ? t('export.summary.socialMediaTemplates', {
                    count: socialImages.length,
                    platforms: Array.from(platforms).join(', ')
                }) : `Social media templates (${socialImages.length} files across ${platforms.size} platforms)`);
            }
        }

        if (settings.includeFavicon === true && faviconFilesCount > 0) {
            items.push(t ? t('export.summary.faviconSet', { count: faviconFilesCount }) :
                `Favicon set (${faviconFilesCount} files with manifest and documentation)`);
        }

        if (settings.includeScreenshots === true && settings.screenshotUrl) {
            const screenshotImages = actualImages.filter(img =>
                validateImage(img) &&
                img.template &&
                img.template.category === 'screenshots'
            );
            if (screenshotImages.length > 0) {
                items.push(t ? t('export.summary.screenshots', {
                    count: screenshotImages.length,
                    url: settings.screenshotUrl
                }) : `Website screenshots (${screenshotImages.length} images from: ${settings.screenshotUrl})`);
            }
        }
    }

    return items.map(item => `* ${item}`).join('\n');
}

/**
 * Gets export notes
 */
function getExportNotes(mode: string, t: any): string {
    if (mode === PROCESSING_MODES.CUSTOM) {
        return t ? t('export.notes.custom') : `- Images are organized by format in subfolders
- Original files are preserved in the OriginalImages folder
- Processed files include any applied optimizations`;
    } else if (mode === PROCESSING_MODES.TEMPLATES) {
        return t ? t('export.notes.templates') : `- Social media images are organized by platform
- Favicon set includes all required sizes and documentation
- Screenshots are captured at standard responsive sizes
- Web and logo images are optimized for their specific use cases`;
    }
    return '';
}

/**
 * Creates export summary text
 */
function createExportSummary(
    originalImages: any[],
    processedImages: any[],
    settings: any,
    mode: string,
    faviconFilesCount: number = 0,
    t: any = null
): string {
    const timestamp = new Date().toISOString();

    const validOriginalImages = originalImages.filter(validateImage);
    const validProcessedImages = processedImages.filter(img =>
        validateImage(img) && !isPreviewOrErrorFile(img)
    );

    const formatsUsed = new Set<string>();
    validProcessedImages.forEach(img => {
        if (img.format) formatsUsed.add(img.format.toUpperCase());
    });

    if (settings.includeFavicon) {
        formatsUsed.add('PNG');
        formatsUsed.add('ICO');
    }

    const categoriesUsed = new Set<string>();
    validProcessedImages.forEach(img => {
        if (img.template && img.template.category) {
            categoriesUsed.add(img.template.category);
        }
    });

    let templateCount = 0;
    if (mode === PROCESSING_MODES.TEMPLATES) {
        templateCount = validProcessedImages.filter(img => img.template).length;
    }

    let summary = `${t ? t('export.summary.title') : 'Image Processing Export Summary'}
${'='.repeat(t ? t('export.summary.title').length : 30)}

${t ? t('export.summary.exportDate') : 'Export Date'}: ${timestamp}
${t ? t('export.summary.processingMode') : 'Processing Mode'}: ${mode}
${t ? t('export.summary.exportSettings') : 'Export Settings'}: ${JSON.stringify(settings, null, 2)}

${t ? t('export.summary.statistics') : 'STATISTICS'}:${'='.repeat(t ? t('export.summary.statistics').length : 11)}
${t ? t('export.summary.originalImages') : 'Original Images'}: ${validOriginalImages.length}
${t ? t('export.summary.processedImages') : 'Processed Images'}: ${validProcessedImages.length}
${t ? t('export.summary.templatesApplied') : 'Templates Applied'}: ${templateCount}
${t ? t('export.summary.categoriesApplied') : 'Categories Applied'}: ${categoriesUsed.size}
${t ? t('export.summary.formatsExported') : 'Formats Exported'}: ${Array.from(formatsUsed).join(', ')}
${t ? t('export.summary.totalFiles') : 'Total Files in Export'}: ${calculateTotalFiles(validOriginalImages, processedImages, settings, mode, faviconFilesCount)}

${t ? t('export.summary.foldersStructure') : 'FOLDERS STRUCTURE'}:${'='.repeat(t ? t('export.summary.foldersStructure').length : 18)}
${getExportFolderStructure(mode, settings).map(folder => `- ${folder}`).join('\n')}

${t ? t('export.summary.includedContent') : 'INCLUDED CONTENT'}:${'='.repeat(t ? t('export.summary.includedContent').length : 17)}
${getIncludedContentSummary(settings, mode, processedImages, faviconFilesCount, t)}

${t ? t('export.summary.notes') : 'NOTES'}:${'='.repeat(t ? t('export.summary.notes').length : 6)}
${getExportNotes(mode, t)}

${t ? t('export.summary.generatedBy') : 'GENERATED BY'}:${'='.repeat(t ? t('export.summary.generatedBy').length : 13)}
${t ? t('export.summary.appName') : 'Image Processing Tool'}
${window.location.origin}

${t ? t('export.summary.supportNote') : 'Need help? Contact support or check the documentation.'}`;

    return summary;
}

/**
 * Downloads ZIP file
 */
export const downloadZip = (zipBlob: Blob, prefix: string): void => {
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Downloads file
 */
export const downloadFile = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
