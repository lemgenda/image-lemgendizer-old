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
 * @param {Object} image - Image object to check
 * @returns {boolean} True if file is preview or error
 */
const isPreviewOrErrorFile = (image) => {
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
 * @param {string} mode - Processing mode
 * @param {Object} additionalSettings - Additional settings to merge
 * @returns {Object} Export settings object
 */
export const generateExportSettings = (mode, additionalSettings = {}) => {
    const baseDefaults = {
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

    if (mode === PROCESSING_MODES.CUSTOM) {
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
 * @param {string} mode - Processing mode
 * @param {Object} settings - Export settings
 * @returns {Array<string>} Array of folder names
 */
export const getExportFolderStructure = (mode, settings = {}) => {
    if (mode === PROCESSING_MODES.CUSTOM) {
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
 * @param {Array<Object>} processedImages - Processed image objects
 * @returns {Object} Images grouped by format
 */
export const organizeImagesByFormat = (processedImages) => {
    const groupedByFormat = {};

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
 * @param {Object} template - Template object
 * @param {Function} t - Translation function
 * @returns {string} Translated template name
 */
export const getTemplateDimensions = (template) => {
    if (!template) return '';
    if (template.height === 'auto') {
        return `${template.width}×auto`;
    }
    return `${template.width}×${template.height}`;
};

/**
 * Gets translated image name
 * @param {Object} image - Image object
 * @param {Function} t - Translation function
 * @returns {string} Translated image name
 */
const getTranslatedImageName = (image, t) => {
    if (!image.template) return image.name;

    const platform = image.template.platform || '';
    const displayPlatform = t(platform);

    const template = image.template.name || '';
    const templateName = t(template);

    const cleanPlatform = displayPlatform
        .replace(/\s*\/\s*X/g, '')
        .replace(/\s+/g, APP_CONFIG.FILE_NAMING.NAME_SEPARATOR)
        .trim();

    const dimensions = getTemplateDimensions(image.template);
    const format = image.format || APP_TEMPLATE_CONFIG.SCREENSHOTS.DEFAULT_FORMAT;

    return `${cleanPlatform} - ${templateName} (${dimensions})${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${format}`;
};

/**
 * Organizes templates by platform with translation support
 * @param {Array<Object>} socialTemplates - Social media templates
 * @param {Function} t - Translation function
 * @returns {Object} Templates organized by platform
 */
export const organizeTemplatesByPlatform = (socialTemplates, t = null) => {
    const organized = {};

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
 * @param {File} sourceImage - Source image file
 * @param {Object} settings - Export settings
 * @param {JSZip} zip - ZIP file object
 * @returns {Promise<number>} Number of favicon files created
 */
const processFaviconSet = async (sourceImage, settings, zip = null) => {
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
            return count; // Return actual count of files added
        } else {
            return faviconZipBlob;
        }
    } catch (error) {
        if (zip) {
            const faviconFolder = zip.folder(APP_TEMPLATE_CONFIG.FAVICON.FOLDER_NAME);
            faviconFolder.file(
                `${APP_CONFIG.ERROR_HANDLING.DEFAULT_ERROR_PREFIX}${APP_CONFIG.ERROR_HANDLING.ERROR_FILE_EXTENSION}`,
                `Favicon generation failed: ${error.message.substring(0, APP_CONFIG.ERROR_HANDLING.MAX_ERROR_LENGTH)}`
            );
        }
        return 0;
    }
};

/**
 * Creates export ZIP file with translation support
 * @async
 * @param {Array<Object>} originalImages - Original image objects
 * @param {Array<Object>} processedImages - Processed image objects
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @param {Array<string>} formats - Output formats
 * @param {Function} t - Translation function
 * @returns {Promise<Blob>} ZIP file blob
 */
export const createExportZip = async (originalImages, processedImages, settings, mode, formats = [APP_CONFIG.IMAGE_DEFAULTS.DEFAULT_FORMAT], t = null) => {
    const zip = new JSZip();

    const validOriginalImages = originalImages.filter(validateImage);
    const validProcessedImages = processedImages.filter(img =>
        validateImage(img) && !isPreviewOrErrorFile(img)
    );

    if (settings.includeOriginal && validOriginalImages.length > 0) {
        const originalFolderName = t ? t('export.folders.original') : EXPORT_FOLDERS.ORIGINAL_IMAGES;
        const originalFolder = zip.folder(originalFolderName);
        for (const image of validOriginalImages) {
            originalFolder.file(image.name, image.file || image.blob);
        }
    }

    let faviconFilesCount = 0;

    if (mode === PROCESSING_MODES.CUSTOM && validProcessedImages.length > 0) {
        // In custom mode, we always include processed images if they exist
        // The filtering happens at the processing stage, not here
        const groupedByFormat = organizeImagesByFormat(validProcessedImages);
        const optimizedFolderName = t ? t('export.folders.optimized') : EXPORT_FOLDERS.OPTIMIZED_IMAGES;
        const optimizedFolder = zip.folder(optimizedFolderName);

        for (const [format, images] of Object.entries(groupedByFormat)) {
            if (images.length > 0) {
                const formatFolderName = format.toUpperCase();
                const formatFolder = optimizedFolder.folder(formatFolderName);
                for (const image of images) {
                    let fileName = image.name;
                    if (!fileName.includes(APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR)) {
                        fileName = `${fileName}${APP_CONFIG.TEMPLATES.FORMAT_SEPARATOR}${format}`;
                    }
                    formatFolder.file(fileName, image.file || image.blob);
                }
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeWebImages && validProcessedImages.length > 0) {
        const webTemplates = validProcessedImages.filter(img =>
            img.template && img.template.category === 'web'
        );

        if (webTemplates.length > 0) {
            const webFolderName = t ? t('export.folders.web') : EXPORT_FOLDERS.WEB_IMAGES;
            const webFolder = zip.folder(webFolderName);

            for (const image of webTemplates) {
                const fileName = getTranslatedImageName(image, t);
                webFolder.file(fileName, image.file || image.blob);
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeLogoImages && validProcessedImages.length > 0) {
        const logoTemplates = validProcessedImages.filter(img =>
            img.template && img.template.category === 'logo'
        );

        if (logoTemplates.length > 0) {
            const logoFolderName = t ? t('export.folders.logo') : EXPORT_FOLDERS.LOGO_IMAGES;
            const logoFolder = zip.folder(logoFolderName);

            for (const image of logoTemplates) {
                const fileName = getTranslatedImageName(image, t);
                logoFolder.file(fileName, image.file || image.blob);
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
            const socialFolderName = t ? t('export.folders.social') : EXPORT_FOLDERS.SOCIAL_MEDIA_IMAGES;
            const socialFolder = zip.folder(socialFolderName);
            const organizedPlatforms = organizeTemplatesByPlatform(socialTemplates, t);

            for (const [platform, platformImages] of Object.entries(organizedPlatforms)) {
                const platformFolderName = platform;
                const platformFolder = socialFolder.folder(platformFolderName);
                for (const image of platformImages) {
                    const fileName = getTranslatedImageName(image, t);
                    platformFolder.file(fileName, image.file || image.blob);
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
            // Force "Screenshots" folder name to ensure consistent structure
            const screenshotFolderName = (APP_TEMPLATE_CONFIG && APP_TEMPLATE_CONFIG.SCREENSHOTS && APP_TEMPLATE_CONFIG.SCREENSHOTS.FOLDER_NAME) ?
                APP_TEMPLATE_CONFIG.SCREENSHOTS.FOLDER_NAME : 'Screenshots';
            const screenshotFolder = zip.folder(screenshotFolderName);
            for (const image of screenshotTemplates) {
                const fileName = getTranslatedImageName(image, t);
                screenshotFolder.file(fileName, image.file || image.blob);
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
            } catch (error) {
                const faviconFolder = zip.folder(APP_TEMPLATE_CONFIG.FAVICON.FOLDER_NAME);
                faviconFolder.file(
                    `${APP_CONFIG.ERROR_HANDLING.DEFAULT_ERROR_PREFIX}${APP_CONFIG.ERROR_HANDLING.ERROR_FILE_EXTENSION}`,
                    `Favicon generation failed: ${error.message.substring(0, APP_CONFIG.ERROR_HANDLING.MAX_ERROR_LENGTH)}`
                );
            }
        }
    }

    const summary = createExportSummary(validOriginalImages, validProcessedImages, settings, mode, faviconFilesCount, t);
    zip.file('export-summary.txt', summary);

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 6
        }
    });

    return zipBlob;
};

/**
 * Creates favicon ZIP file
 * @async
 * @param {File} imageFile - Source image file
 * @param {Object} settings - Favicon settings
 * @returns {Promise<Blob>} Favicon ZIP file
 */
export const createFaviconZip = async (imageFile, settings = {}) => {
    return await processFaviconSet(imageFile, settings);
};

/**
 * Creates screenshot ZIP file
 * @async
 * @param {Array<Object>} screenshotImages - Screenshot images
 * @param {string} url - Website URL
 * @returns {Promise<Blob>} Screenshot ZIP file
 */
export const createScreenshotZip = async (screenshotImages, url) => {
    const zip = new JSZip();

    const validImages = screenshotImages.filter(img =>
        validateImage(img) && !isPreviewOrErrorFile(img)
    );

    if (validImages.length === 0) {
        throw new Error('No valid screenshot images to export');
    }

    const screenshotFolder = zip.folder('Screenshots');

    for (const image of validImages) {
        let fileName = image.name;
        if (!fileName || fileName === '') {
            const timestamp = new Date().toISOString().split('T')[0];
            const templateName = image.template?.name?.replace(/\s+/g, '-').toLowerCase() || 'screenshot';
            fileName = `${templateName}-${timestamp}.${image.format}`;
        }
        screenshotFolder.file(fileName, image.file || image.blob);
    }

    const summary = `Screenshot Export Summary
============================

Export Date: ${new Date().toISOString()}
Website URL: ${url}
Total Screenshots: ${validImages.length}
Template Types: ${[...new Set(validImages.map(img => img.template?.name))].join(', ')}
Dimensions: ${[...new Set(validImages.map(img => `${img.template?.width || '?'}×${img.template?.height || '?'}`))].join(', ')}

Files:
${validImages.map((img, i) => `${i + 1}. ${img.name} (${img.format}, ${img.template?.width || '?'}×${img.template?.height || '?'})`).join('\n')}`;

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
 * @param {Array<Object>} originalImages - Original images
 * @param {Array<Object>} processedImages - Processed images
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @param {number} faviconFilesCount - Number of favicon files
 * @returns {number} Total file count
 */
const calculateTotalFiles = (originalImages, processedImages, settings, mode, faviconFilesCount = 0) => {
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
            // Use provided count or calculate based on mode if count is 0 (fallback)
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
};

/**
 * Gets included content summary
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @param {Array<Object>} processedImages - Processed images
 * @param {number} faviconFilesCount - Number of favicon files
 * @param {Function} t - Translation function
 * @returns {string} Summary text
 */
const getIncludedContentSummary = (settings, mode, processedImages, faviconFilesCount, t) => {
    const items = [];

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
                const platforms = new Set();
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

    return items.map(item => `✓ ${item}`).join('\n');
};

/**
 * Gets export notes
 * @param {string} mode - Processing mode
 * @param {Function} t - Translation function
 * @returns {string} Export notes
 */
const getExportNotes = (mode, t) => {
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
};

/**
 * Creates export summary text
 * @param {Array<Object>} originalImages - Original images
 * @param {Array<Object>} processedImages - Processed images
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @param {number} faviconFilesCount - Number of favicon files
 * @param {Function} t - Translation function
 * @returns {string} Export summary text
 */
const createExportSummary = (originalImages, processedImages, settings, mode, faviconFilesCount = 0, t = null) => {
    const timestamp = new Date().toISOString();

    const validOriginalImages = originalImages.filter(validateImage);
    const validProcessedImages = processedImages.filter(img =>
        validateImage(img) && !isPreviewOrErrorFile(img)
    );

    const formatsUsed = new Set();
    validProcessedImages.forEach(img => {
        if (img.format) formatsUsed.add(img.format.toUpperCase());
    });

    if (settings.includeFavicon) {
        formatsUsed.add('PNG');
        formatsUsed.add('ICO');
    }

    const categoriesUsed = new Set();
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
};

/**
 * Downloads ZIP file
 * @param {Blob} zipBlob - ZIP file blob
 * @param {string} prefix - File name prefix
 */
export const downloadZip = (zipBlob, prefix) => {
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
 * @param {Blob} blob - File blob
 * @param {string} filename - File name
 */
export const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};