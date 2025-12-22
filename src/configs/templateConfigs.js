export const TEMPLATE_CATEGORIES = [
    { id: 'all', name: 'All Templates', icon: 'fas fa-th' },
    { id: 'web', name: 'Web', icon: 'fas fa-globe' },
    { id: 'logo', name: 'Logo', icon: 'fas fa-copyright' },
    { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram' },
    { id: 'facebook', name: 'Facebook', icon: 'fab fa-facebook' },
    { id: 'twitter', name: 'Twitter/X', icon: 'fab fa-twitter' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'fab fa-linkedin' },
    { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube' },
    { id: 'pinterest', name: 'Pinterest', icon: 'fab fa-pinterest' },
    { id: 'tiktok', name: 'TikTok', icon: 'fab fa-tiktok' }
]

export const SOCIAL_MEDIA_TEMPLATES = [
    // Web Images - Using FREE icons
    { id: 'web-hero', name: 'WebHero', width: 1920, height: 1080, platform: 'Web', category: 'web', icon: 'fas fa-desktop' },
    { id: 'web-blog', name: 'WebBlog', width: 1200, height: 630, platform: 'Web', category: 'web', icon: 'fas fa-blog' },
    { id: 'web-content', name: 'WebContent', width: 1200, height: 'auto', platform: 'Web', category: 'web', icon: 'fas fa-image' },
    { id: 'web-thumb', name: 'WebThumb', width: 250, height: 250, platform: 'Web', category: 'web', icon: 'fas fa-square' },

    // Logo Images - Using FREE icons
    { id: 'logo-rect', name: 'LogoRectangular', width: 300, height: 150, platform: 'Logo', category: 'logo', icon: 'fas fa-copyright' },
    { id: 'logo-square', name: 'LogoSquare', width: 500, height: 500, platform: 'Logo', category: 'logo', icon: 'fas fa-square' },

    // Instagram - Using FREE brand icons
    { id: 'ig-profile', name: 'InstagramProfile', width: 320, height: 320, platform: 'Instagram', category: 'instagram', icon: 'fab fa-instagram' },
    { id: 'ig-square', name: 'InstagramSquare', width: 1080, height: 1080, platform: 'Instagram', category: 'instagram', icon: 'fas fa-square' },
    { id: 'ig-portrait', name: 'InstagramPortrait', width: 1080, height: 1350, platform: 'Instagram', category: 'instagram', icon: 'fas fa-image' }, // Changed from fa-portrait
    { id: 'ig-landscape', name: 'InstagramLandscape', width: 1080, height: 566, platform: 'Instagram', category: 'instagram', icon: 'fas fa-expand' }, // Changed from fa-id-card
    { id: 'ig-stories', name: 'InstagramStoriesReels', width: 1080, height: 1920, platform: 'Instagram', category: 'instagram', icon: 'fas fa-video' }, // Changed from fa-film

    // Facebook - Using FREE brand icons
    { id: 'fb-profile', name: 'FacebookProfile', width: 180, height: 180, platform: 'Facebook', category: 'facebook', icon: 'fab fa-facebook' },
    { id: 'fb-cover', name: 'FacebookCoverBanner', width: 851, height: 315, platform: 'Facebook', category: 'facebook', icon: 'fas fa-image' }, // Changed from fa-panorama
    { id: 'fb-shared', name: 'FacebookSharedImage', width: 1200, height: 630, platform: 'Facebook', category: 'facebook', icon: 'fas fa-share-alt' },
    { id: 'fb-square', name: 'FacebookSquarePost', width: 1200, height: 1200, platform: 'Facebook', category: 'facebook', icon: 'fas fa-square' },
    { id: 'fb-stories', name: 'FacebookStories', width: 1080, height: 1920, platform: 'Facebook', category: 'facebook', icon: 'fas fa-scroll' },

    // Twitter/X - Using FREE brand icons
    { id: 'tw-profile', name: 'XProfile', width: 400, height: 400, platform: 'Twitter/X', category: 'twitter', icon: 'fab fa-twitter' },
    { id: 'tw-header', name: 'XHeaderBanner', width: 1500, height: 500, platform: 'Twitter/X', category: 'twitter', icon: 'fas fa-image' }, // Changed from fa-panorama
    { id: 'tw-landscape', name: 'XLandscapePost', width: 1600, height: 900, platform: 'Twitter/X', category: 'twitter', icon: 'fas fa-expand' }, // Changed from fa-id-card
    { id: 'tw-square', name: 'XSquarePost', width: 1080, height: 1080, platform: 'Twitter/X', category: 'twitter', icon: 'fas fa-square' },
    { id: 'tw-portrait', name: 'XPortraitPost', width: 1080, height: 1350, platform: 'Twitter/X', category: 'twitter', icon: 'fas fa-image' }, // Changed from fa-portrait

    // LinkedIn - Using FREE brand icons
    { id: 'li-profile', name: 'LinkedInProfile', width: 400, height: 400, platform: 'LinkedIn', category: 'linkedin', icon: 'fab fa-linkedin' },
    { id: 'li-cover', name: 'LinkedInPersonalCover', width: 1584, height: 396, platform: 'LinkedIn', category: 'linkedin', icon: 'fas fa-image' }, // Changed from fa-panorama
    { id: 'li-landscape', name: 'LinkedInLandscapePost', width: 1200, height: 627, platform: 'LinkedIn', category: 'linkedin', icon: 'fas fa-expand' }, // Changed from fa-id-card
    { id: 'li-square', name: 'LinkedInSquarePost', width: 1200, height: 1200, platform: 'LinkedIn', category: 'linkedin', icon: 'fas fa-square' },
    { id: 'li-portrait', name: 'LinkedInPortraitPost', width: 720, height: 900, platform: 'LinkedIn', category: 'linkedin', icon: 'fas fa-image' }, // Changed from fa-portrait

    // YouTube - Using FREE brand icons
    { id: 'yt-channel', name: 'YouTubeChannelIcon', width: 800, height: 800, platform: 'YouTube', category: 'youtube', icon: 'fab fa-youtube' },
    { id: 'yt-banner', name: 'YouTubeBanner', width: 2048, height: 1152, platform: 'YouTube', category: 'youtube', icon: 'fas fa-image' }, // Changed from fa-panorama
    { id: 'yt-thumb', name: 'YouTubeThumbnail', width: 1280, height: 720, platform: 'YouTube', category: 'youtube', icon: 'fas fa-video' },

    // Pinterest - Using FREE brand icons
    { id: 'pin-profile', name: 'PinterestProfile', width: 165, height: 165, platform: 'Pinterest', category: 'pinterest', icon: 'fab fa-pinterest' },
    { id: 'pin-standard', name: 'PinterestStandardPin', width: 1000, height: 1500, platform: 'Pinterest', category: 'pinterest', icon: 'fas fa-thumbtack' },
    { id: 'pin-square', name: 'PinterestSquarePin', width: 1000, height: 1000, platform: 'Pinterest', category: 'pinterest', icon: 'fas fa-square' },
    { id: 'pin-story', name: 'PinterestStoryPin', width: 1080, height: 1920, platform: 'Pinterest', category: 'pinterest', icon: 'fas fa-scroll' },

    // TikTok - Using FREE brand icons
    { id: 'tt-profile', name: 'TikTokProfile', width: 200, height: 200, platform: 'TikTok', category: 'tiktok', icon: 'fab fa-tiktok' },
    { id: 'tt-video', name: 'TikTokVideoCover', width: 1080, height: 1920, platform: 'TikTok', category: 'tiktok', icon: 'fas fa-video' }
]

// Helper function to get templates by category
export const getTemplatesByCategory = (categoryId) => {
    return SOCIAL_MEDIA_TEMPLATES.filter(template =>
        categoryId === 'all' || template.category === categoryId
    )
}

// Helper function to get category by ID
export const getCategoryById = (categoryId) => {
    return TEMPLATE_CATEGORIES.find(cat => cat.id === categoryId)
}

// Get all categories except 'all'
export const getTemplateCategories = () => {
    return TEMPLATE_CATEGORIES.filter(cat => cat.id !== 'all')
}