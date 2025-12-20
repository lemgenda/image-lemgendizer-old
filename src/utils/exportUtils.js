import JSZip from 'jszip';

/**
 * Creates export settings based on processing mode.
 *
 * @param {string} mode - Processing mode ('custom' or 'templates')
 * @returns {Object} Export settings object
 */
export const generateExportSettings = (mode) => {
    const baseSettings = {
        includeOriginal: false,
        includeOptimized: false,
        includeWebImages: false,
        includeLogoImages: false,
        includeSocialMedia: false,
        createFolders: true
    };

    if (mode === 'custom') {
        return {
            ...baseSettings,
            includeOriginal: true,
            includeOptimized: true
        };
    } else if (mode === 'templates') {
        return {
            ...baseSettings,
            includeWebImages: true,
            includeLogoImages: true,
            includeSocialMedia: true
        };
    }

    return baseSettings;
};

/**
 * Gets folder structure for different export modes.
 *
 * @param {string} mode - Processing mode
 * @returns {Array<string>} Array of folder paths
 */
export const getExportFolderStructure = (mode) => {
    if (mode === 'custom') {
        return ['OriginalImages', 'OptimizedImages'];
    } else if (mode === 'templates') {
        return ['WebImages', 'LogoImages', 'SocialMediaImages'];
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
    const platforms = {
        'Instagram': ['InstagramProfile', 'InstagramSquare', 'InstagramPortrait', 'InstagramLandscape', 'InstagramStoriesReels'],
        'Facebook': ['FacebookProfile', 'FacebookCoverBanner', 'FacebookSharedImage', 'FacebookSquarePost', 'FacebookStories'],
        'Twitter/X': ['XProfile', 'XHeaderBanner', 'XLandscapePost', 'XSquarePost', 'XPortraitPost'],
        'LinkedIn': ['LinkedInProfile', 'LinkedInPersonalCover', 'LinkedInLandscapePost', 'LinkedInSquarePost', 'LinkedInPortraitPost'],
        'YouTube': ['YouTubeChannelIcon', 'YouTubeBanner', 'YouTubeThumbnail'],
        'Pinterest': ['PinterestProfile', 'PinterestStandardPin', 'PinterestSquarePin', 'PinterestStoryPin'],
        'TikTok': ['TikTokProfile', 'TikTokVideoCover']
    };

    const organized = {};

    Object.entries(platforms).forEach(([platform, templateNames]) => {
        const platformImages = socialTemplates.filter(img =>
            templateNames.includes(img.template?.name) && img.format === 'jpg'
        );

        if (platformImages.length > 0) {
            organized[platform] = platformImages;
        }
    });

    return organized;
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

    // Add original images
    if (settings.includeOriginal && originalImages.length > 0 && originalImages.some(img => img.file)) {
        const originalFolder = zip.folder('OriginalImages');
        for (const image of originalImages) {
            if (image.file) {
                originalFolder.file(image.name, image.file);
            }
        }
    }

    // For custom mode: organize by format
    if (mode === 'custom' && settings.includeOptimized && processedImages.length > 0) {
        const groupedByFormat = organizeImagesByFormat(processedImages);

        Object.keys(groupedByFormat).forEach(format => {
            if (groupedByFormat[format].length > 0) {
                const formatFolder = zip.folder(`OptimizedImages/${format.toUpperCase()}`);
                groupedByFormat[format].forEach(image => {
                    let fileName = image.name;
                    if (!fileName.includes('.')) {
                        fileName = `${fileName}.${format}`;
                    }
                    formatFolder.file(fileName, image.file);
                });
            }
        });
    }

    // Add WebImages folder (for templates mode) - WebP + JPEG/PNG
    if (mode === 'templates' && settings.includeWebImages && processedImages.length > 0) {
        const webTemplates = processedImages.filter(img =>
            img.template?.category === 'web' && img.file
        );

        if (webTemplates.length > 0) {
            const webFolder = zip.folder('WebImages');
            const webpImages = webTemplates.filter(img => img.format === 'webp');
            const pngImages = webTemplates.filter(img => img.format === 'png');
            const jpgImages = webTemplates.filter(img => img.format === 'jpg');

            webpImages.forEach(image => webFolder.file(image.name, image.file));
            pngImages.forEach(image => webFolder.file(image.name, image.file));
            jpgImages.forEach(image => webFolder.file(image.name, image.file));
        }
    }

    // Add LogoImages folder (for templates mode) - JPEG/PNG(if transparent)
    if (mode === 'templates' && settings.includeLogoImages && processedImages.length > 0) {
        const logoTemplates = processedImages.filter(img =>
            img.template?.category === 'logo' && img.file
        );

        if (logoTemplates.length > 0) {
            const logoFolder = zip.folder('LogoImages');
            const pngImages = logoTemplates.filter(img => img.format === 'png');
            const jpgImages = logoTemplates.filter(img => img.format === 'jpg');

            pngImages.forEach(image => logoFolder.file(image.name, image.file));
            jpgImages.forEach(image => logoFolder.file(image.name, image.file));
        }
    }

    // Add SocialMediaImages folder with organized subfolders
    if (mode === 'templates' && settings.includeSocialMedia && processedImages.length > 0) {
        const socialTemplates = processedImages.filter(img =>
            img.template?.category !== 'web' &&
            img.template?.category !== 'logo' &&
            img.file
        );

        if (socialTemplates.length > 0) {
            const organizedPlatforms = organizeTemplatesByPlatform(socialTemplates);

            Object.entries(organizedPlatforms).forEach(([platform, platformImages]) => {
                const platformFolder = zip.folder(`SocialMediaImages/${platform}`);
                platformImages.forEach(image => {
                    platformFolder.file(image.name, image.file);
                });
            });
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return zipBlob;
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