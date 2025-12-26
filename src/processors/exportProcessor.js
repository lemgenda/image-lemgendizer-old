import JSZip from 'jszip';
import { PROCESSING_MODES } from '../constants/sharedConstants';
import { generateFaviconSet, generateScreenshots } from '../utils';
import {
    EXPORT_FOLDERS,
    TEMPLATE_CATEGORIES_CONST as TEMPLATE_CATEGORIES,
    PLATFORM_NAMES,
    TEMPLATE_NAMES,
    SCREENSHOT_TEMPLATES
} from '../configs/templateConfigs';

/**
 * Generates export settings based on mode
 * @param {string} mode - Processing mode
 * @param {Object} additionalSettings - Additional settings
 * @returns {Object} Export settings
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
        faviconSiteName: 'My Website',
        faviconThemeColor: '#ffffff',
        faviconBackgroundColor: '#ffffff',
        createFolders: true
    };

    const mergedSettings = { ...baseDefaults };

    for (const key in additionalSettings) {
        if (key === 'includeFavicon' || key === 'includeScreenshots') {
            if (additionalSettings.hasOwnProperty(key)) {
                mergedSettings[key] = additionalSettings[key];
            }
        } else {
            mergedSettings[key] = additionalSettings[key];
        }
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
 * @returns {Array} Folder structure
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
            folders.push(PLATFORM_NAMES.FAVICON || 'FaviconSet');
        }
        if (settings.includeScreenshots && settings.screenshotUrl) {
            folders.push(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');
        }

        return folders;
    }
    return [];
};

/**
 * Organizes images by format
 * @param {Array} processedImages - Processed images
 * @returns {Object} Images grouped by format
 */
export const organizeImagesByFormat = (processedImages) => {
    const groupedByFormat = {};

    processedImages.forEach(image => {
        const format = image.format || 'webp';
        if (!groupedByFormat[format]) {
            groupedByFormat[format] = [];
        }
        if (image.file && image.name && !image.name.includes('.undefined')) {
            groupedByFormat[format].push(image);
        }
    });

    return groupedByFormat;
};

/**
 * Organizes templates by platform
 * @param {Array} socialTemplates - Social media templates
 * @returns {Object} Organized templates by platform
 */
export const organizeTemplatesByPlatform = (socialTemplates) => {
    const organized = {};

    socialTemplates.forEach(img => {
        if (img.template && img.format === 'jpg') {
            const platform = img.template.platform;
            const cleanPlatform = platform.replace(/\s*\/\s*X/g, '').replace(/Twitter\/X/, PLATFORM_NAMES.TWITTER || 'Twitter').trim();

            if (!organized[cleanPlatform]) {
                organized[cleanPlatform] = [];
            }

            const cleanFileName = img.name
                .replace(`${platform}-`, '')
                .replace(/Twitter\/X/g, PLATFORM_NAMES.TWITTER || 'Twitter');
            const cleanImage = {
                ...img,
                name: cleanFileName
            };

            organized[cleanPlatform].push(cleanImage);
        }
    });

    return organized;
};

/**
 * Filters screenshot templates by selected IDs
 * @param {Array} processedImages - Processed images
 * @param {Array} selectedTemplateIds - Selected template IDs
 * @returns {Array} Filtered screenshot templates
 */
const filterScreenshotTemplates = (processedImages, selectedTemplateIds) => {
    if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
        return [];
    }

    const allTemplates = [];

    if (SCREENSHOT_TEMPLATES && typeof SCREENSHOT_TEMPLATES === 'object') {
        Object.values(SCREENSHOT_TEMPLATES).forEach(template => {
            if (selectedTemplateIds.includes(template.id)) {
                allTemplates.push(template);
            }
        });
    }

    return allTemplates;
};

/**
 * Processes favicon set
 * @param {File} sourceImage - Source image
 * @param {Object} settings - Export settings
 * @param {JSZip} zip - ZIP object
 * @returns {Promise<void>}
 */
const processFaviconSet = async (sourceImage, settings, zip = null) => {
    try {
        const faviconZipBlob = await generateFaviconSet(
            sourceImage,
            settings.faviconSiteName || TEMPLATE_NAMES.FAVICON_SITE_NAME || 'My Website',
            settings.faviconThemeColor || '#ffffff',
            settings.faviconBackgroundColor || '#ffffff'
        );

        if (zip) {
            const faviconZip = await JSZip.loadAsync(faviconZipBlob);
            const faviconFolder = zip.folder(`${EXPORT_FOLDERS.WEB_IMAGES}/${PLATFORM_NAMES.FAVICON || 'FaviconSet'}`);

            const files = faviconZip.files;
            for (const [fileName, fileData] of Object.entries(files)) {
                if (!fileData.dir) {
                    const content = await fileData.async('blob');
                    faviconFolder.file(fileName, content);
                }
            }
            return;
        } else {
            return faviconZipBlob;
        }
    } catch {
        if (zip) {
            const faviconFolder = zip.folder(`${EXPORT_FOLDERS.WEB_IMAGES}/${PLATFORM_NAMES.FAVICON || 'FaviconSet'}`);
            faviconFolder.file('error.txt', 'Favicon generation failed');
        }
        throw new Error('Favicon generation failed');
    }
};

/**
 * Creates export ZIP file
 * @param {Array} originalImages - Original images
 * @param {Array} processedImages - Processed images
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @param {Array} formats - Output formats
 * @returns {Promise<Blob>} ZIP blob
 */
export const createExportZip = async (originalImages, processedImages, settings, mode, formats = ['webp']) => {
    const zip = new JSZip();

    const isPreviewFile = (image) => {
        return image.name.includes('favicon-preview') ||
            image.name.includes('screenshot-preview') ||
            image.name.includes('-preview.');
    };

    if (settings.includeOriginal && originalImages.length > 0 && originalImages.some(img => img.file)) {
        const originalFolder = zip.folder(EXPORT_FOLDERS.ORIGINAL_IMAGES);
        for (const image of originalImages) {
            if (image.file) {
                originalFolder.file(image.name, image.file);
            }
        }
    }

    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized && processedImages.length > 0) {
        const groupedByFormat = organizeImagesByFormat(processedImages);

        for (const [format, images] of Object.entries(groupedByFormat)) {
            if (images.length > 0) {
                const formatFolder = zip.folder(`${EXPORT_FOLDERS.OPTIMIZED_IMAGES}/${format.toUpperCase()}`);
                for (const image of images) {
                    let fileName = image.name;
                    if (!fileName.includes('.')) {
                        fileName = `${fileName}.${format}`;
                    }
                    formatFolder.file(fileName, image.file);
                }
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeWebImages && processedImages.length > 0) {
        const webTemplates = processedImages.filter(img =>
            img.template?.category === TEMPLATE_CATEGORIES.WEB &&
            img.file &&
            !isPreviewFile(img)
        );

        if (webTemplates.length > 0) {
            const webFolder = zip.folder(EXPORT_FOLDERS.WEB_IMAGES);
            const webpImages = webTemplates.filter(img => img.format === 'webp');
            const pngImages = webTemplates.filter(img => img.format === 'png');
            const jpgImages = webTemplates.filter(img => img.format === 'jpg');

            for (const image of webpImages) {
                webFolder.file(image.name, image.file);
            }

            for (const image of pngImages) {
                webFolder.file(image.name, image.file);
            }

            for (const image of jpgImages) {
                webFolder.file(image.name, image.file);
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeLogoImages && processedImages.length > 0) {
        const logoTemplates = processedImages.filter(img =>
            img.template?.category === TEMPLATE_CATEGORIES.LOGO &&
            img.file &&
            !isPreviewFile(img)
        );

        if (logoTemplates.length > 0) {
            const logoFolder = zip.folder(EXPORT_FOLDERS.LOGO_IMAGES);
            const pngImages = logoTemplates.filter(img => img.format === 'png');
            const jpgImages = logoTemplates.filter(img => img.format === 'jpg');

            for (const image of pngImages) {
                logoFolder.file(image.name, image.file);
            }

            for (const image of jpgImages) {
                logoFolder.file(image.name, image.file);
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeSocialMedia && processedImages.length > 0) {
        const socialTemplates = processedImages.filter(img =>
            img.template?.category !== TEMPLATE_CATEGORIES.WEB &&
            img.template?.category !== TEMPLATE_CATEGORIES.LOGO &&
            img.template?.category !== 'favicon' &&
            img.template?.category !== 'screenshots' &&
            img.file &&
            !isPreviewFile(img)
        );

        if (socialTemplates.length > 0) {
            const organizedPlatforms = organizeTemplatesByPlatform(socialTemplates);

            for (const [platform, platformImages] of Object.entries(organizedPlatforms)) {
                const platformFolder = zip.folder(`${EXPORT_FOLDERS.SOCIAL_MEDIA_IMAGES}/${platform}`);
                for (const image of platformImages) {
                    platformFolder.file(image.name, image.file);
                }
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeFavicon === true) {
        const faviconPreview = processedImages.find(img =>
            img.name.includes('favicon-preview') &&
            img.template?.category === 'favicon'
        );

        const faviconSource = processedImages.find(img =>
            (img.template?.category === TEMPLATE_CATEGORIES.WEB ||
                img.template?.category === TEMPLATE_CATEGORIES.LOGO) &&
            img.format === 'png'
        );

        if (faviconPreview || faviconSource || originalImages.length > 0) {
            try {
                let sourceImage = null;

                if (faviconPreview && faviconPreview.file) {
                    sourceImage = faviconPreview.file;
                } else if (faviconSource && faviconSource.file) {
                    sourceImage = faviconSource.file;
                } else if (originalImages.length > 0 && originalImages[0].file) {
                    sourceImage = originalImages[0].file;
                }

                if (sourceImage) {
                    await processFaviconSet(sourceImage, settings, zip);
                }
            } catch {
                const faviconFolder = zip.folder(`${EXPORT_FOLDERS.WEB_IMAGES}/${PLATFORM_NAMES.FAVICON || 'FaviconSet'}`);
                faviconFolder.file('error.txt', 'Favicon generation failed');
            }
        }
    }

    if (mode === PROCESSING_MODES.TEMPLATES &&
        settings.includeScreenshots === true &&
        settings.screenshotUrl &&
        settings.screenshotUrl.trim()) {
        try {
            const selectedScreenshotTemplateIds = settings.selectedScreenshotTemplates || [];

            if (selectedScreenshotTemplateIds.length === 0) {
                const screenshotFolder = zip.folder(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');
                screenshotFolder.file('NOTE.txt',
                    'No screenshot templates were selected for generation.'
                );
            } else {
                const selectedScreenshotTemplates = filterScreenshotTemplates(processedImages, selectedScreenshotTemplateIds);

                let cleanUrl = settings.screenshotUrl.trim();
                if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                    cleanUrl = `https://${cleanUrl}`;
                }
                cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

                const screenshotZipBlob = await generateScreenshots(
                    cleanUrl,
                    settings.faviconSiteName || TEMPLATE_NAMES.SCREENSHOT_SITE_NAME || 'Website Screenshots',
                    selectedScreenshotTemplateIds,
                    {
                        selectedScreenshotTemplates: selectedScreenshotTemplateIds,
                        ...settings
                    }
                );

                if (!(screenshotZipBlob instanceof Blob)) {
                    throw new Error('Failed to create screenshot ZIP file');
                }

                const screenshotZip = await JSZip.loadAsync(screenshotZipBlob);
                const screenshotFolder = zip.folder(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');

                const files = screenshotZip.files;
                let hasActualScreenshots = false;

                for (const [fileName, fileData] of Object.entries(files)) {
                    if (!fileData.dir) {
                        const content = await fileData.async('blob');
                        screenshotFolder.file(fileName, content);

                        if (fileName.includes('screenshot-') && !fileName.includes('error')) {
                            hasActualScreenshots = true;
                        }
                    }
                }

                if (!hasActualScreenshots) {
                    screenshotFolder.file('NOTE.txt',
                        `The website ${cleanUrl} uses security headers that prevent automated screenshot capture.`
                    );
                }
            }
        } catch {
            const screenshotFolder = zip.folder(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');
            screenshotFolder.file('error.txt', 'Screenshot generation failed');
        }
    }

    const summary = createExportSummary(originalImages, processedImages, settings, mode);
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
 * @param {File} imageFile - Image file
 * @param {Object} settings - Export settings
 * @returns {Promise<Blob>} Favicon ZIP blob
 */
export const createFaviconZip = async (imageFile, settings = {}) => {
    return await processFaviconSet(imageFile, settings);
};

/**
 * Creates screenshot ZIP file
 * @param {string} url - Website URL
 * @param {Object} settings - Export settings
 * @returns {Promise<Blob>} Screenshot ZIP blob
 */
export const createScreenshotZip = async (url, settings = {}) => {
    const templateIds = settings.selectedScreenshotTemplates || [];
    return await generateScreenshots(
        url,
        settings.faviconSiteName || 'Website Screenshots',
        templateIds,
        settings
    );
};

/**
 * Creates export summary text
 * @param {Array} originalImages - Original images
 * @param {Array} processedImages - Processed images
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @returns {string} Export summary
 */
const createExportSummary = (originalImages, processedImages, settings, mode) => {
    const timestamp = new Date().toISOString();

    const isPreviewFile = (image) => {
        return image.name.includes('favicon-preview') ||
            image.name.includes('screenshot-preview') ||
            image.name.includes('-preview.');
    };

    const actualProcessedImages = processedImages.filter(img => !isPreviewFile(img));

    let summary = `Image Processing Export Summary
================================

Export Date: ${timestamp}
Processing Mode: ${mode}
Export Settings: ${JSON.stringify(settings, null, 2)}

STATISTICS:
===========
Original Images: ${originalImages.length}
Processed Images: ${actualProcessedImages.length}
Total Files in Export: ${calculateTotalFiles(originalImages, processedImages, settings, mode)}

FOLDERS STRUCTURE:
==================
${getExportFolderStructure(mode, settings).map(folder => `- ${folder}`).join('\n')}

INCLUDED CONTENT:
=================
${getIncludedContentSummary(settings, mode)}

NOTES:
======
${getExportNotes(mode)}

GENERATED BY:
=============
Image Processing Tool
${window.location.origin}

Need help? Contact support or check the documentation.`;

    return summary;
};

/**
 * Calculates total files in export
 * @param {Array} originalImages - Original images
 * @param {Array} processedImages - Processed images
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @returns {number} Total file count
 */
const calculateTotalFiles = (originalImages, processedImages, settings, mode) => {
    let total = 0;

    if (settings.includeOriginal) total += originalImages.length;

    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized) {
        total += processedImages.length;
    } else if (mode === PROCESSING_MODES.TEMPLATES) {
        const isPreviewFile = (image) => {
            return image.name.includes('favicon-preview') ||
                image.name.includes('screenshot-preview') ||
                image.name.includes('-preview.');
        };

        const actualImages = processedImages.filter(img => !isPreviewFile(img));

        if (settings.includeWebImages) {
            total += actualImages.filter(img => img.template?.category === 'web').length;
        }
        if (settings.includeLogoImages) {
            total += actualImages.filter(img => img.template?.category === 'logo').length;
        }
        if (settings.includeSocialMedia) {
            total += actualImages.filter(img =>
                img.template?.category !== 'web' &&
                img.template?.category !== 'logo'
            ).length;
        }
        if (settings.includeFavicon === true) total += 15;
        if (settings.includeScreenshots === true && settings.screenshotUrl) {
            const selectedScreenshotCount = processedImages
                .filter(img => img.template?.category === 'screenshots' && !img.name.includes('preview'))
                .length;
            total += selectedScreenshotCount || 3;
        }
    }

    return total;
};

/**
 * Gets included content summary
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @returns {string} Content summary
 */
const getIncludedContentSummary = (settings, mode) => {
    const items = [];

    if (settings.includeOriginal) items.push('Original images');
    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized) {
        items.push('Optimized images (organized by format)');
    }

    if (mode === PROCESSING_MODES.TEMPLATES) {
        if (settings.includeWebImages) items.push('Web-optimized images');
        if (settings.includeLogoImages) items.push('Logo variations');
        if (settings.includeSocialMedia) items.push('Social media templates (organized by platform)');
        if (settings.includeFavicon === true) items.push(`${PLATFORM_NAMES.FAVICON || 'Favicon'} set (with manifest and documentation)`);
        if (settings.includeScreenshots === true && settings.screenshotUrl) {
            items.push(`${PLATFORM_NAMES.SCREENSHOTS || 'Website'} screenshots (from: ${settings.screenshotUrl})`);
        }
    }

    return items.map(item => `✓ ${item}`).join('\n');
};

/**
 * Gets export notes
 * @param {string} mode - Processing mode
 * @returns {string} Export notes
 */
const getExportNotes = (mode) => {
    if (mode === PROCESSING_MODES.CUSTOM) {
        return `- Images are organized by format in subfolders
- Original files are preserved in the OriginalImages folder
- Processed files include any applied optimizations`;
    } else if (mode === PROCESSING_MODES.TEMPLATES) {
        return `- Social media images are organized by platform
- ${PLATFORM_NAMES.FAVICON || 'Favicon'} set includes all required sizes and documentation
- ${PLATFORM_NAMES.SCREENSHOTS || 'Screenshots'} are captured at standard responsive sizes
- Web and logo images are optimized for their specific use cases`;
    }
    return '';
};

/**
 * Downloads ZIP file
 * @param {Blob} zipBlob - ZIP blob
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