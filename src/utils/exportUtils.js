import JSZip from 'jszip'

/**
 * Create export ZIP file with organized folder structure
 * @async
 * @param {Array<Object>} originalImages - Original image objects with file and name properties
 * @param {Array<Object>} processedImages - Processed image objects with file, name, and optional template properties
 * @param {Object} settings - Export settings with include flags
 * @param {string} mode - Processing mode ('custom' or 'templates')
 * @param {Array<string>} formats - Array of selected output formats (for custom mode)
 * @returns {Promise<Blob>} ZIP file blob
 */
export const createExportZip = async (originalImages, processedImages, settings, mode, formats = ['webp']) => {
    const zip = new JSZip()

    // Add original images to OriginalImages folder
    if (settings.includeOriginal && originalImages.length > 0 && originalImages.some(img => img.file)) {
        const originalFolder = zip.folder('OriginalImages')
        for (const image of originalImages) {
            if (image.file) {
                originalFolder.file(image.name, image.file)
            }
        }
    }

    // For custom mode: organize by format
    if (mode === 'custom' && settings.includeOptimized && processedImages.length > 0) {
        // Group processed images by format
        const groupedByFormat = {}
        processedImages.forEach(image => {
            const format = image.format || 'webp'
            if (!groupedByFormat[format]) {
                groupedByFormat[format] = []
            }
            // Only add if file exists and name is valid
            if (image.file && image.name && !image.name.includes('.undefined')) {
                groupedByFormat[format].push(image)
            }
        })

        // Create folder for each format only if it has files
        Object.keys(groupedByFormat).forEach(format => {
            if (groupedByFormat[format].length > 0) {
                const formatFolder = zip.folder(`OptimizedImages/${format.toUpperCase()}`)
                groupedByFormat[format].forEach(image => {
                    // Ensure filename has proper extension
                    let fileName = image.name
                    if (!fileName.includes('.')) {
                        fileName = `${fileName}.${format}`
                    }
                    formatFolder.file(fileName, image.file)
                })
            }
        })
    }

    // Add WebImages folder (for templates mode) - WebP + JPEG/PNG
    if (mode === 'templates' && settings.includeWebImages && processedImages.length > 0) {
        // Filter Web templates
        const webTemplates = processedImages.filter(img =>
            img.template?.category === 'web' && img.file
        )

        if (webTemplates.length > 0) {
            const webFolder = zip.folder('WebImages')

            // Separate by format
            const webpImages = webTemplates.filter(img => img.format === 'webp')
            const pngImages = webTemplates.filter(img => img.format === 'png')
            const jpgImages = webTemplates.filter(img => img.format === 'jpg')

            // Add WebP images
            webpImages.forEach(image => {
                webFolder.file(image.name, image.file)
            })

            // Add PNG images
            pngImages.forEach(image => {
                webFolder.file(image.name, image.file)
            })

            // Add JPG images
            jpgImages.forEach(image => {
                webFolder.file(image.name, image.file)
            })
        }
    }

    // Add LogoImages folder (for templates mode) - JPEG/PNG(if transparent)
    if (mode === 'templates' && settings.includeLogoImages && processedImages.length > 0) {
        // Filter Logo templates
        const logoTemplates = processedImages.filter(img =>
            img.template?.category === 'logo' && img.file
        )

        if (logoTemplates.length > 0) {
            const logoFolder = zip.folder('LogoImages')

            // Add only PNG and JPG versions (no WebP for logos)
            const pngImages = logoTemplates.filter(img => img.format === 'png')
            const jpgImages = logoTemplates.filter(img => img.format === 'jpg')

            pngImages.forEach(image => {
                logoFolder.file(image.name, image.file)
            })

            jpgImages.forEach(image => {
                logoFolder.file(image.name, image.file)
            })
        }
    }

    // Add SocialMediaImages folder with organized subfolders (for templates mode) - JPEG only
    if (mode === 'templates' && settings.includeSocialMedia && processedImages.length > 0) {
        // Filter Social Media templates (excluding Web and Logo)
        const socialTemplates = processedImages.filter(img =>
            img.template?.category !== 'web' &&
            img.template?.category !== 'logo' &&
            img.file
        )

        if (socialTemplates.length > 0) {
            // Group by platform
            const platforms = {
                'Instagram': ['InstagramProfile', 'InstagramSquare', 'InstagramPortrait', 'InstagramLandscape', 'InstagramStoriesReels'],
                'Facebook': ['FacebookProfile', 'FacebookCoverBanner', 'FacebookSharedImage', 'FacebookSquarePost', 'FacebookStories'],
                'Twitter/X': ['XProfile', 'XHeaderBanner', 'XLandscapePost', 'XSquarePost', 'XPortraitPost'],
                'LinkedIn': ['LinkedInProfile', 'LinkedInPersonalCover', 'LinkedInLandscapePost', 'LinkedInSquarePost', 'LinkedInPortraitPost'],
                'YouTube': ['YouTubeChannelIcon', 'YouTubeBanner', 'YouTubeThumbnail'],
                'Pinterest': ['PinterestProfile', 'PinterestStandardPin', 'PinterestSquarePin', 'PinterestStoryPin'],
                'TikTok': ['TikTokProfile', 'TikTokVideoCover']
            }

            // Create platform folders and add JPEG files
            Object.entries(platforms).forEach(([platform, templateNames]) => {
                const platformImages = socialTemplates.filter(img =>
                    templateNames.includes(img.template?.name) && img.format === 'jpg'
                )

                if (platformImages.length > 0) {
                    const platformFolder = zip.folder(`SocialMediaImages/${platform}`)
                    platformImages.forEach(image => {
                        platformFolder.file(image.name, image.file)
                    })
                }
            })
        }
    }

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    return zipBlob
}