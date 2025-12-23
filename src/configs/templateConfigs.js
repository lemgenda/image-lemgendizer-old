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
    { id: 'tiktok', name: 'TikTok', icon: 'fab fa-tiktok' },
    { id: 'favicon', name: 'Favicon', icon: 'fas fa-star' },
    { id: 'screenshots', name: 'Screenshots', icon: 'fas fa-camera' }
];

export const FAVICON_SIZES = [
    { name: 'android-chrome-192x192', width: 192, height: 192 },
    { name: 'android-chrome-512x512', width: 512, height: 512 },
    { name: 'apple-touch-icon', width: 180, height: 180 },
    { name: 'favicon-16x16', width: 16, height: 16 },
    { name: 'favicon-32x32', width: 32, height: 32 },
    { name: 'favicon-48x48', width: 48, height: 48 }
];

export const SCREENSHOT_SIZES = [
    { name: 'screenshot-desktop-wide', width: 1280, height: 720, type: 'desktop' },
    { name: 'screenshot-mobile-narrow', width: 720, height: 1280, type: 'mobile' }
];

export const SOCIAL_MEDIA_TEMPLATES = [
    // Web Images - Using FREE icons
    { id: 'web-hero', name: 'WebHero', width: 1920, height: 1080, platform: 'Web', category: 'web', icon: 'fas fa-desktop' },
    { id: 'web-blog', name: 'WebBlog', width: 1200, height: 630, platform: 'Web', category: 'web', icon: 'fas fa-blog' },
    { id: 'web-content', name: 'WebContent', width: 1200, height: 'auto', platform: 'Web', category: 'web', icon: 'fas fa-image' },
    { id: 'web-thumb', name: 'WebThumb', width: 250, height: 250, platform: 'Web', category: 'web', icon: 'fas fa-square' },

    // Screenshot Templates - Using FREE icons
    {
        id: 'screenshots-mobile',
        name: 'Mobile',
        width: 375,
        height: 667,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-mobile-alt',
        description: 'Mobile viewport screenshot (375x667)'
    },
    {
        id: 'screenshots-tablet',
        name: 'Tablet',
        width: 768,
        height: 1024,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-tablet',
        description: 'Tablet viewport screenshot (768x1024)'
    },
    {
        id: 'screenshots-desktop',
        name: 'Desktop',
        width: 1280,
        height: 720,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop',
        description: 'Desktop viewport screenshot (1280x720)'
    },
    {
        id: 'screenshots-desktop-hd',
        name: 'Desktop HD',
        width: 1920,
        height: 1080,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop-alt',
        description: 'HD desktop viewport screenshot (1920x1080)'
    },
    {
        id: 'screenshots-mobile-full',
        name: 'Mobile(all content)',
        width: 375,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-mobile-alt',
        description: 'Full mobile page screenshot'
    },
    {
        id: 'screenshots-tablet-full',
        name: 'Tablet(all content)',
        width: 768,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-tablet',
        description: 'Full tablet page screenshot'
    },
    {
        id: 'screenshots-desktop-full',
        name: 'Desktop(all content)',
        width: 1280,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop',
        description: 'Full desktop page screenshot'
    },
    {
        id: 'screenshots-desktop-hd-full',
        name: 'Desktop HD(all content)',
        width: 1920,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop-alt',
        description: 'Full HD desktop page screenshot'
    },

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