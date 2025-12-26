import JSZip from 'jszip';
import {
    PROCESSING_MODES,
    EXPORT_FOLDERS,
    TEMPLATE_CATEGORIES,
    PLATFORM_NAMES,
    TEMPLATE_NAMES
} from '../constants/sharedConstants';

// Import favicon and screenshot generators
import { generateFaviconSet, generateScreenshots } from '../utils';

/**
 * Creates export settings based on processing mode.
 *
 * @param {string} mode - Processing mode ('custom' or 'templates')
 * @param {Object} additionalSettings - Additional settings for templates
 * @returns {Object} Export settings object
 */
export const generateExportSettings = (mode, additionalSettings = {}) => {
    // Create base settings with defaults
    const baseDefaults = {
        includeOriginal: false,
        includeOptimized: false,
        includeWebImages: false,
        includeLogoImages: false,
        includeSocialMedia: false,
        includeFavicon: false, // Default to false
        includeScreenshots: false, // Default to false
        screenshotUrl: '',
        faviconSiteName: 'My Website',
        faviconThemeColor: '#ffffff',
        faviconBackgroundColor: '#ffffff',
        createFolders: true
    };

    // Merge additional settings, but preserve false values for includeFavicon/includeScreenshots
    const mergedSettings = { ...baseDefaults };

    // Only override includeFavicon/includeScreenshots if they're explicitly provided
    for (const key in additionalSettings) {
        if (key === 'includeFavicon' || key === 'includeScreenshots') {
            // Only set if explicitly provided (even if false)
            if (additionalSettings.hasOwnProperty(key)) {
                mergedSettings[key] = additionalSettings[key];
            }
        } else {
            // For other settings, always override
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
            // includeFavicon and includeScreenshots come from mergedSettings
        };
    }

    return mergedSettings;
};

/**
 * Gets folder structure for different export modes.
 *
 * @param {string} mode - Processing mode
 * @param {Object} settings - Export settings (optional)
 * @returns {Array<string>} Array of folder paths
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

        // Only add these folders if they're actually needed
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
 * Organizes processed images by format for custom mode export.
 *
 * @param {Array<Object>} processedImages - Array of processed image objects
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
 * Organizes social media templates by platform.
 *
 * @param {Array<Object>} socialTemplates - Array of social media template images
 * @returns {Object} Templates grouped by platform
 */
export const organizeTemplatesByPlatform = (socialTemplates) => {
    const organized = {};

    socialTemplates.forEach(img => {
        if (img.template && img.format === 'jpg') {
            const platform = img.template.platform;
            // Clean up platform names for folder structure using PLATFORM_NAMES constants
            const cleanPlatform = platform.replace(/\s*\/\s*X/g, '').replace(/Twitter\/X/, PLATFORM_NAMES.TWITTER || 'Twitter').trim();

            if (!organized[cleanPlatform]) {
                organized[cleanPlatform] = [];
            }

            // Clean up file names to remove platform duplication using TEMPLATE_NAMES constants
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
 * Filters screenshot templates to only include selected ones
 * @param {Array<Object>} processedImages - Processed images (unused in this version)
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @returns {Array<Object>} Filtered screenshot templates
 */
const filterScreenshotTemplates = (processedImages, selectedTemplateIds) => {
    // Import SCREENSHOT_TEMPLATES here to avoid circular dependencies
    const { SCREENSHOT_TEMPLATES } = require('../configs/templateConfigs');

    // First, get all screenshot templates from SCREENSHOT_TEMPLATES
    const allScreenshotTemplates = Object.values(SCREENSHOT_TEMPLATES || {});

    // Filter to only include selected templates
    return allScreenshotTemplates.filter(template =>
        selectedTemplateIds.includes(template.id)
    );
};

/**
 * Processes favicon set generation
 * @async
 * @param {File} sourceImage - Source image for favicon
 * @param {Object} settings - Export settings with favicon options
 * @param {JSZip} zip - JSZip instance (optional)
 * @returns {Promise<Blob|void>} Favicon ZIP blob or adds to existing zip
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
            // Extract and add to existing ZIP
            const faviconZip = await JSZip.loadAsync(faviconZipBlob);
            const faviconFolder = zip.folder(`${EXPORT_FOLDERS.WEB_IMAGES}/${PLATFORM_NAMES.FAVICON || 'FaviconSet'}`);

            const files = faviconZip.files;
            for (const [fileName, fileData] of Object.entries(files)) {
                if (!fileData.dir) {
                    try {
                        const content = await fileData.async('blob');
                        faviconFolder.file(fileName, content);
                    } catch (fileError) {
                        console.warn(`Failed to add favicon file ${fileName}:`, fileError);
                        // Skip this file but continue with others
                    }
                }
            }
            return null;
        } else {
            // Return standalone ZIP
            return faviconZipBlob;
        }
    } catch (error) {
        console.error('Failed to generate favicon set:', error);

        if (zip) {
            // Add error placeholder
            const faviconFolder = zip.folder(`${EXPORT_FOLDERS.WEB_IMAGES}/${PLATFORM_NAMES.FAVICON || 'FaviconSet'}`);
            const errorText = `Favicon generation failed: ${error.message}\n\nPlease try again with a different image.`;
            faviconFolder.file('error.txt', errorText);
        }
        throw error;
    }
};

/**
 * Creates an export ZIP file with organized folder structure.
 *
 * @async
 * @param {Array<Object>} originalImages - Original image objects with file and name properties
 * @param {Array<Object>} processedImages - Processed image objects with file, name, and optional template properties
 * @param {Object} settings - Export settings with include flags
 * @param {string} mode - Processing mode ('custom' or 'templates')
 * @param {Array<string>} formats - Array of selected output formats (for custom mode)
 * @returns {Promise<Blob>} ZIP file blob
 */
export const createExportZip = async (originalImages, processedImages, settings, mode, formats = ['webp']) => {
    const zip = new JSZip();

    // Helper function to identify preview files
    const isPreviewFile = (image) => {
        return image.name.includes('favicon-preview') ||
            image.name.includes('screenshot-preview') ||
            image.name.includes('-preview.');
    };

    // Add original images
    if (settings.includeOriginal && originalImages.length > 0 && originalImages.some(img => img.file)) {
        const originalFolder = zip.folder(EXPORT_FOLDERS.ORIGINAL_IMAGES);
        for (const image of originalImages) {
            if (image.file) {
                try {
                    originalFolder.file(image.name, image.file);
                } catch (error) {
                    console.warn(`Failed to add original image ${image.name}:`, error);
                }
            }
        }
    }

    // For custom mode: organize by format
    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized && processedImages.length > 0) {
        const groupedByFormat = organizeImagesByFormat(processedImages);

        for (const [format, images] of Object.entries(groupedByFormat)) {
            if (images.length > 0) {
                const formatFolder = zip.folder(`${EXPORT_FOLDERS.OPTIMIZED_IMAGES}/${format.toUpperCase()}`);
                for (const image of images) {
                    try {
                        let fileName = image.name;
                        if (!fileName.includes('.')) {
                            fileName = `${fileName}.${format}`;
                        }
                        formatFolder.file(fileName, image.file);
                    } catch (error) {
                        console.warn(`Failed to add optimized image ${image.name} (${format}):`, error);
                    }
                }
            }
        }
    }

    // Add WebImages folder (for templates mode) - WebP + JPEG/PNG
    // Filter out all preview files
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
                try {
                    webFolder.file(image.name, image.file);
                } catch (error) {
                    console.warn(`Failed to add web image ${image.name}:`, error);
                }
            }

            for (const image of pngImages) {
                try {
                    webFolder.file(image.name, image.file);
                } catch (error) {
                    console.warn(`Failed to add web image ${image.name}:`, error);
                }
            }

            for (const image of jpgImages) {
                try {
                    webFolder.file(image.name, image.file);
                } catch (error) {
                    console.warn(`Failed to add web image ${image.name}:`, error);
                }
            }
        }
    }

    // Add LogoImages folder (for templates mode) - JPEG/PNG(if transparent)
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
                try {
                    logoFolder.file(image.name, image.file);
                } catch (error) {
                    console.warn(`Failed to add logo image ${image.name}:`, error);
                }
            }

            for (const image of jpgImages) {
                try {
                    logoFolder.file(image.name, image.file);
                } catch (error) {
                    console.warn(`Failed to add logo image ${image.name}:`, error);
                }
            }
        }
    }

    // Add SocialMediaImages folder with organized subfolders
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
                    try {
                        platformFolder.file(image.name, image.file);
                    } catch (error) {
                        console.warn(`Failed to add social media image ${image.name} (${platform}):`, error);
                    }
                }
            }
        }
    }

    // Add Favicon set only if explicitly included in settings
    if (mode === PROCESSING_MODES.TEMPLATES && settings.includeFavicon === true) {
        // First check if we have a favicon template preview
        const faviconPreview = processedImages.find(img =>
            img.name.includes('favicon-preview') &&
            img.template?.category === 'favicon'
        );

        // Also check for any image that could serve as favicon source
        const faviconSource = processedImages.find(img =>
            (img.template?.category === TEMPLATE_CATEGORIES.WEB ||
                img.template?.category === TEMPLATE_CATEGORIES.LOGO) &&
            img.format === 'png'
        );

        if (faviconPreview || faviconSource || originalImages.length > 0) {
            try {
                let sourceImage = null;

                // Priority order for favicon source:
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
            } catch (error) {
                console.warn('Favicon set generation failed, continuing without it:', error);

                // Add error placeholder
                const faviconFolder = zip.folder(`${EXPORT_FOLDERS.WEB_IMAGES}/${PLATFORM_NAMES.FAVICON || 'FaviconSet'}`);
                const errorText = `Favicon generation failed: ${error.message}\n\nPlease try again with a different image.`;
                faviconFolder.file('error.txt', errorText);
            }
        }
    }

    // Add Screenshots only if explicitly included and URL is provided
    if (mode === PROCESSING_MODES.TEMPLATES &&
        settings.includeScreenshots === true &&
        settings.screenshotUrl &&
        settings.screenshotUrl.trim()) {
        try {
            console.log('Generating screenshots for URL:', settings.screenshotUrl);

            // Get selected screenshot template IDs from settings
            const selectedScreenshotTemplateIds = settings.selectedScreenshotTemplates || [];

            if (selectedScreenshotTemplateIds.length === 0) {
                console.log('No screenshot templates selected, skipping screenshot generation');
                // Add a note file instead
                const screenshotFolder = zip.folder(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');
                screenshotFolder.file('NOTE.txt',
                    'No screenshot templates were selected for generation.\n' +
                    'Select screenshot templates in the template selection interface.'
                );
            } else {
                // Get the actual template objects using the helper function
                const selectedScreenshotTemplates = filterScreenshotTemplates(processedImages, selectedScreenshotTemplateIds);

                console.log('Selected screenshot templates:', selectedScreenshotTemplates.map(t => t.id));

                // Clean the URL
                let cleanUrl = settings.screenshotUrl.trim();
                if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                    cleanUrl = `https://${cleanUrl}`;
                }
                // Fix double slashes
                cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

                const screenshotZipBlob = await generateScreenshots(
                    cleanUrl,
                    settings.faviconSiteName || TEMPLATE_NAMES.SCREENSHOTS_SITE_NAME || 'Website Screenshots',
                    selectedScreenshotTemplateIds,  // Pass selected IDs
                    {
                        selectedScreenshotTemplates: selectedScreenshotTemplateIds,
                        ...settings
                    }
                );

                // Validate the screenshot ZIP blob
                if (!(screenshotZipBlob instanceof Blob)) {
                    console.error('Screenshot ZIP is not a valid Blob:', screenshotZipBlob);
                    throw new Error('Failed to create screenshot ZIP file');
                }

                const screenshotZip = await JSZip.loadAsync(screenshotZipBlob);
                const screenshotFolder = zip.folder(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');

                // Check what files were generated
                const files = screenshotZip.files;
                let hasActualScreenshots = false;
                let filesAdded = 0;

                for (const [fileName, fileData] of Object.entries(files)) {
                    if (!fileData.dir) {
                        try {
                            // Use the proper JSZip file API to get content
                            const content = await fileData.async('blob');
                            screenshotFolder.file(fileName, content);
                            filesAdded++;

                            // Check if this is an actual screenshot or placeholder
                            if (fileName.includes('screenshot-') && !fileName.includes('error')) {
                                hasActualScreenshots = true;
                            }
                        } catch (fileError) {
                            console.warn(`Failed to process screenshot file ${fileName}:`, fileError);
                            // Skip this file but continue with others
                            continue;
                        }
                    }
                }

                console.log(`Added ${filesAdded} screenshot files to ZIP`);

                if (hasActualScreenshots) {
                    console.log('Actual screenshots added to ZIP');
                } else {
                    console.log('Placeholder screenshots added (website blocks capture)');
                    // Add a note file
                    screenshotFolder.file('NOTE.txt',
                        `The website ${cleanUrl} uses security headers that prevent automated screenshot capture.\n` +
                        `The included images are informative placeholders.\n` +
                        `To get actual screenshots:\n` +
                        `1. Use browser developer tools (F12)\n` +
                        `2. Use a screenshot extension\n` +
                        `3. Contact the website owner about X-Frame-Options headers`
                    );
                }
            }

        } catch (error) {
            console.error('Screenshot generation failed:', error);
            const screenshotFolder = zip.folder(PLATFORM_NAMES.SCREENSHOTS || 'Screenshots');
            const errorText = `Screenshot generation failed: ${error.message}\n\nURL: ${settings.screenshotUrl}`;
            screenshotFolder.file('error.txt', errorText);
        }
    }

    // Create a summary file
    const summary = createExportSummary(originalImages, processedImages, settings, mode);
    zip.file('export-summary.txt', summary);

    // Generate the final ZIP
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
 * Creates a standalone favicon set ZIP file
 * @async
 * @param {File} imageFile - Source image file
 * @param {Object} settings - Favicon settings
 * @returns {Promise<Blob>} Favicon ZIP blob
 */
export const createFaviconZip = async (imageFile, settings = {}) => {
    return await processFaviconSet(imageFile, settings);
};

/**
 * Creates a standalone screenshot ZIP file
 * @async
 * @param {string} url - Website URL
 * @param {Object} settings - Screenshot settings
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
 * @param {Array<Object>} originalImages - Original images
 * @param {Array<Object>} processedImages - Processed images
 * @param {Object} settings - Export settings
 * @param {string} mode - Processing mode
 * @returns {string} Summary text
 */
const createExportSummary = (originalImages, processedImages, settings, mode) => {
    const timestamp = new Date().toISOString();

    // Count actual files (excluding previews)
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
 * @param {Array<Object>} originalImages - Original images
 * @param {Array<Object>} processedImages - Processed images
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
        // Helper to filter out previews
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
        if (settings.includeFavicon === true) total += 15; // Approximate favicon files
        if (settings.includeScreenshots === true && settings.screenshotUrl) {
            // Count only selected screenshot templates
            const selectedScreenshotCount = processedImages
                .filter(img => img.template?.category === 'screenshots' && !img.name.includes('preview'))
                .length;
            total += selectedScreenshotCount || 3; // Use actual count or default
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

    if (settings.includeOriginal) items.push('✓ Original images');
    if (mode === PROCESSING_MODES.CUSTOM && settings.includeOptimized) {
        items.push('✓ Optimized images (organized by format)');
    }

    if (mode === PROCESSING_MODES.TEMPLATES) {
        if (settings.includeWebImages) items.push('✓ Web-optimized images');
        if (settings.includeLogoImages) items.push('✓ Logo variations');
        if (settings.includeSocialMedia) items.push('✓ Social media templates (organized by platform)');
        if (settings.includeFavicon === true) items.push(`✓ ${PLATFORM_NAMES.FAVICON || 'Favicon'} set (with manifest and documentation)`);
        if (settings.includeScreenshots === true && settings.screenshotUrl) {
            items.push(`✓ ${PLATFORM_NAMES.SCREENSHOTS || 'Website'} screenshots (from: ${settings.screenshotUrl})`);
        }
    }

    return items.join('\n');
};

/**
 * Gets export notes based on mode
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
 * Downloads a ZIP file to the user's device.
 *
 * @param {Blob} zipBlob - The ZIP file blob to download
 * @param {string} prefix - File name prefix for the downloaded file
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
 * Downloads individual files (for standalone exports)
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