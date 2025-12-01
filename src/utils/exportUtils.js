import JSZip from 'jszip'

export const createExportZip = async (originalImages, processedImages, settings, mode) => {
    const zip = new JSZip()

    // Add original images to OriginalImages folder
    if (settings.includeOriginal && originalImages.length > 0) {
        const originalFolder = zip.folder('OriginalImages')
        for (const image of originalImages) {
            originalFolder.file(image.name, image.file)
        }
    }

    // Add processed images to OptimizedImages folder (for custom mode)
    if (mode === 'custom' && settings.includeOptimized && processedImages.length > 0) {
        const optimizedFolder = zip.folder('OptimizedImages')
        for (const image of processedImages) {
            optimizedFolder.file(image.name, image.file)
        }
    }

    // Add WebImages folder (for templates mode) - WebP + JPEG/PNG
    if (mode === 'templates' && settings.includeWebImages && processedImages.length > 0) {
        const webFolder = zip.folder('WebImages')

        // Filter Web templates
        const webTemplates = processedImages.filter(img =>
            img.template?.category === 'web'
        )

        if (webTemplates.length > 0) {
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
        const logoFolder = zip.folder('LogoImages')

        // Filter Logo templates
        const logoTemplates = processedImages.filter(img =>
            img.template?.category === 'logo'
        )

        if (logoTemplates.length > 0) {
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
        const socialFolder = zip.folder('SocialMediaImages')

        // Filter Social Media templates (excluding Web and Logo)
        const socialTemplates = processedImages.filter(img =>
            img.template?.category !== 'web' &&
            img.template?.category !== 'logo'
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
                    const platformFolder = socialFolder.folder(platform)
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