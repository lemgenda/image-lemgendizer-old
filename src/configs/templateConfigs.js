// ================================
// Template Categories
// ================================

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

// ================================
// Template Category Constants
// ================================

export const TEMPLATE_CATEGORIES_CONST = {
    WEB: 'web',
    LOGO: 'logo',
    SOCIAL_MEDIA: 'social_media',
    FAVICON: 'favicon',
    SCREENSHOTS: 'screenshots'
};

// ================================
// Favicon Sizes
// ================================

export const FAVICON_SIZES = [
    { name: 'android-chrome-192x192', width: 192, height: 192 },
    { name: 'android-chrome-512x512', width: 512, height: 512 },
    { name: 'i-pad-icon-1x', width: 76, height: 76 },
    { name: 'i-pad-icon-2x', width: 152, height: 152 },
    { name: 'i-phone-icon', width: 120, height: 120 },
    { name: 'apple-touch-icon', width: 180, height: 180 },
    { name: 'favicon-16x16', width: 16, height: 16 },
    { name: 'favicon-32x32', width: 32, height: 32 },
    { name: 'favicon-48x48', width: 48, height: 48 }
];

export const FAVICON_SIZE_LIST = [16, 32, 48, 64, 128, 256, 512];
export const FAVICON_PREVIEW_SIZE = 512;

// ================================
// Screenshot Sizes
// ================================

export const SCREENSHOT_SIZES = [
    { name: 'screenshot-desktop-wide', width: 1280, height: 720, type: 'desktop' },
    { name: 'screenshot-mobile-narrow', width: 720, height: 1280, type: 'mobile' }
];

// ================================
// Screenshot Templates
// ================================

export const SCREENSHOT_TEMPLATES = {
    'screenshots-mobile': {
        id: 'screenshots-mobile',
        name: 'Mobile Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 375,
        height: 667,
        fullPage: false,
        icon: 'fas fa-mobile-alt'
    },
    'screenshots-tablet': {
        id: 'screenshots-tablet',
        name: 'Tablet Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 768,
        height: 1024,
        fullPage: false,
        icon: 'fas fa-tablet'
    },
    'screenshots-desktop': {
        id: 'screenshots-desktop',
        name: 'Desktop Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1280,
        height: 720,
        fullPage: false,
        icon: 'fas fa-desktop'
    },
    'screenshots-desktop-hd': {
        id: 'screenshots-desktop-hd',
        name: 'Desktop HD Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1920,
        height: 1080,
        fullPage: false,
        icon: 'fas fa-desktop-alt'
    },
    'screenshots-mobile-full': {
        id: 'screenshots-mobile-full',
        name: 'Mobile Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 375,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-mobile-alt'
    },
    'screenshots-tablet-full': {
        id: 'screenshots-tablet-full',
        name: 'Tablet Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 768,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-tablet'
    },
    'screenshots-desktop-full': {
        id: 'screenshots-desktop-full',
        name: 'Desktop Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1280,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-desktop'
    },
    'screenshots-desktop-hd-full': {
        id: 'screenshots-desktop-hd-full',
        name: 'Desktop HD Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1920,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-desktop-alt'
    }
};

// ================================
// All Social Media Templates
// ================================

export const SOCIAL_MEDIA_TEMPLATES = [
    // Web Images
    {
        id: 'web-hero',
        name: 'WebHero',
        width: 1920,
        height: 1080,
        platform: 'Web',
        category: 'web',
        icon: 'fas fa-desktop',
        templateName: 'WebHero'
    },
    {
        id: 'web-blog',
        name: 'WebBlog',
        width: 1200,
        height: 630,
        platform: 'Web',
        category: 'web',
        icon: 'fas fa-blog',
        templateName: 'WebBlog'
    },
    {
        id: 'web-content',
        name: 'WebContent',
        width: 1200,
        height: 'auto',
        platform: 'Web',
        category: 'web',
        icon: 'fas fa-image',
        templateName: 'WebContent'
    },
    {
        id: 'web-thumb',
        name: 'WebThumb',
        width: 250,
        height: 250,
        platform: 'Web',
        category: 'web',
        icon: 'fas fa-square',
        templateName: 'WebThumb'
    },

    // Screenshot Templates
    {
        id: 'screenshots-mobile',
        name: 'Mobile',
        width: 375,
        height: 667,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-mobile-alt',
        description: 'Mobile viewport screenshot (375x667)',
        templateName: 'ScreenshotsMobile'
    },
    {
        id: 'screenshots-tablet',
        name: 'Tablet',
        width: 768,
        height: 1024,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-tablet',
        description: 'Tablet viewport screenshot (768x1024)',
        templateName: 'ScreenshotsTablet'
    },
    {
        id: 'screenshots-desktop',
        name: 'Desktop',
        width: 1280,
        height: 720,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop',
        description: 'Desktop viewport screenshot (1280x720)',
        templateName: 'ScreenshotsDesktop'
    },
    {
        id: 'screenshots-desktop-hd',
        name: 'Desktop HD',
        width: 1920,
        height: 1080,
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop-alt',
        description: 'HD desktop viewport screenshot (1920x1080)',
        templateName: 'ScreenshotsDesktopHD'
    },
    {
        id: 'screenshots-mobile-full',
        name: 'Mobile(all content)',
        width: 375,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-mobile-alt',
        description: 'Full mobile page screenshot',
        templateName: 'ScreenshotsMobileFull'
    },
    {
        id: 'screenshots-tablet-full',
        name: 'Tablet(all content)',
        width: 768,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-tablet',
        description: 'Full tablet page screenshot',
        templateName: 'ScreenshotsTabletFull'
    },
    {
        id: 'screenshots-desktop-full',
        name: 'Desktop(all content)',
        width: 1280,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop',
        description: 'Full desktop page screenshot',
        templateName: 'ScreenshotsDesktopFull'
    },
    {
        id: 'screenshots-desktop-hd-full',
        name: 'Desktop HD(all content)',
        width: 1920,
        height: 'auto',
        platform: 'Web',
        category: 'screenshots',
        icon: 'fas fa-desktop-alt',
        description: 'Full HD desktop page screenshot',
        templateName: 'ScreenshotsDesktopHDFull'
    },

    // Logo Images
    {
        id: 'logo-rect',
        name: 'LogoRectangular',
        width: 300,
        height: 150,
        platform: 'Logo',
        category: 'logo',
        icon: 'fas fa-copyright',
        templateName: 'LogoRectangular'
    },
    {
        id: 'logo-square',
        name: 'LogoSquare',
        width: 500,
        height: 500,
        platform: 'Logo',
        category: 'logo',
        icon: 'fas fa-square',
        templateName: 'LogoSquare'
    },

    // Instagram
    {
        id: 'ig-profile',
        name: 'InstagramProfile',
        width: 320,
        height: 320,
        platform: 'Instagram',
        category: 'instagram',
        icon: 'fab fa-instagram',
        templateName: 'InstagramProfile'
    },
    {
        id: 'ig-square',
        name: 'InstagramSquare',
        width: 1080,
        height: 1080,
        platform: 'Instagram',
        category: 'instagram',
        icon: 'fas fa-square',
        templateName: 'InstagramSquare'
    },
    {
        id: 'ig-portrait',
        name: 'InstagramPortrait',
        width: 1080,
        height: 1350,
        platform: 'Instagram',
        category: 'instagram',
        icon: 'fas fa-image',
        templateName: 'InstagramPortrait'
    },
    {
        id: 'ig-landscape',
        name: 'InstagramLandscape',
        width: 1080,
        height: 566,
        platform: 'Instagram',
        category: 'instagram',
        icon: 'fas fa-expand',
        templateName: 'InstagramLandscape'
    },
    {
        id: 'ig-stories',
        name: 'InstagramStoriesReels',
        width: 1080,
        height: 1920,
        platform: 'Instagram',
        category: 'instagram',
        icon: 'fas fa-video',
        templateName: 'InstagramStoriesReels'
    },

    // Facebook
    {
        id: 'fb-profile',
        name: 'FacebookProfile',
        width: 180,
        height: 180,
        platform: 'Facebook',
        category: 'facebook',
        icon: 'fab fa-facebook',
        templateName: 'FacebookProfile'
    },
    {
        id: 'fb-cover',
        name: 'FacebookCoverBanner',
        width: 851,
        height: 315,
        platform: 'Facebook',
        category: 'facebook',
        icon: 'fas fa-image',
        templateName: 'FacebookCoverBanner'
    },
    {
        id: 'fb-shared',
        name: 'FacebookSharedImage',
        width: 1200,
        height: 630,
        platform: 'Facebook',
        category: 'facebook',
        icon: 'fas fa-share-alt',
        templateName: 'FacebookSharedImage'
    },
    {
        id: 'fb-square',
        name: 'FacebookSquarePost',
        width: 1200,
        height: 1200,
        platform: 'Facebook',
        category: 'facebook',
        icon: 'fas fa-square',
        templateName: 'FacebookSquarePost'
    },
    {
        id: 'fb-stories',
        name: 'FacebookStories',
        width: 1080,
        height: 1920,
        platform: 'Facebook',
        category: 'facebook',
        icon: 'fas fa-scroll',
        templateName: 'FacebookStories'
    },

    // Twitter/X
    {
        id: 'tw-profile',
        name: 'XProfile',
        width: 400,
        height: 400,
        platform: 'Twitter/X',
        category: 'twitter',
        icon: 'fab fa-twitter',
        templateName: 'XProfile'
    },
    {
        id: 'tw-header',
        name: 'XHeaderBanner',
        width: 1500,
        height: 500,
        platform: 'Twitter/X',
        category: 'twitter',
        icon: 'fas fa-image',
        templateName: 'XHeaderBanner'
    },
    {
        id: 'tw-landscape',
        name: 'XLandscapePost',
        width: 1600,
        height: 900,
        platform: 'Twitter/X',
        category: 'twitter',
        icon: 'fas fa-expand',
        templateName: 'XLandscapePost'
    },
    {
        id: 'tw-square',
        name: 'XSquarePost',
        width: 1080,
        height: 1080,
        platform: 'Twitter/X',
        category: 'twitter',
        icon: 'fas fa-square',
        templateName: 'XSquarePost'
    },
    {
        id: 'tw-portrait',
        name: 'XPortraitPost',
        width: 1080,
        height: 1350,
        platform: 'Twitter/X',
        category: 'twitter',
        icon: 'fas fa-image',
        templateName: 'XPortraitPost'
    },

    // LinkedIn
    {
        id: 'li-profile',
        name: 'LinkedInProfile',
        width: 400,
        height: 400,
        platform: 'LinkedIn',
        category: 'linkedin',
        icon: 'fab fa-linkedin',
        templateName: 'LinkedInProfile'
    },
    {
        id: 'li-cover',
        name: 'LinkedInPersonalCover',
        width: 1584,
        height: 396,
        platform: 'LinkedIn',
        category: 'linkedin',
        icon: 'fas fa-image',
        templateName: 'LinkedInPersonalCover'
    },
    {
        id: 'li-landscape',
        name: 'LinkedInLandscapePost',
        width: 1200,
        height: 627,
        platform: 'LinkedIn',
        category: 'linkedin',
        icon: 'fas fa-expand',
        templateName: 'LinkedInLandscapePost'
    },
    {
        id: 'li-square',
        name: 'LinkedInSquarePost',
        width: 1200,
        height: 1200,
        platform: 'LinkedIn',
        category: 'linkedin',
        icon: 'fas fa-square',
        templateName: 'LinkedInSquarePost'
    },
    {
        id: 'li-portrait',
        name: 'LinkedInPortraitPost',
        width: 720,
        height: 900,
        platform: 'LinkedIn',
        category: 'linkedin',
        icon: 'fas fa-image',
        templateName: 'LinkedInPortraitPost'
    },

    // YouTube
    {
        id: 'yt-channel',
        name: 'YouTubeChannelIcon',
        width: 800,
        height: 800,
        platform: 'YouTube',
        category: 'youtube',
        icon: 'fab fa-youtube',
        templateName: 'YouTubeChannelIcon'
    },
    {
        id: 'yt-banner',
        name: 'YouTubeBanner',
        width: 2048,
        height: 1152,
        platform: 'YouTube',
        category: 'youtube',
        icon: 'fas fa-image',
        templateName: 'YouTubeBanner'
    },
    {
        id: 'yt-thumb',
        name: 'YouTubeThumbnail',
        width: 1280,
        height: 720,
        platform: 'YouTube',
        category: 'youtube',
        icon: 'fas fa-video',
        templateName: 'YouTubeThumbnail'
    },

    // Pinterest
    {
        id: 'pin-profile',
        name: 'PinterestProfile',
        width: 165,
        height: 165,
        platform: 'Pinterest',
        category: 'pinterest',
        icon: 'fab fa-pinterest',
        templateName: 'PinterestProfile'
    },
    {
        id: 'pin-standard',
        name: 'PinterestStandardPin',
        width: 1000,
        height: 1500,
        platform: 'Pinterest',
        category: 'pinterest',
        icon: 'fas fa-thumbtack',
        templateName: 'PinterestStandardPin'
    },
    {
        id: 'pin-square',
        name: 'PinterestSquarePin',
        width: 1000,
        height: 1000,
        platform: 'Pinterest',
        category: 'pinterest',
        icon: 'fas fa-square',
        templateName: 'PinterestSquarePin'
    },
    {
        id: 'pin-story',
        name: 'PinterestStoryPin',
        width: 1080,
        height: 1920,
        platform: 'Pinterest',
        category: 'pinterest',
        icon: 'fas fa-scroll',
        templateName: 'PinterestStoryPin'
    },

    // TikTok
    {
        id: 'tt-profile',
        name: 'TikTokProfile',
        width: 200,
        height: 200,
        platform: 'TikTok',
        category: 'tiktok',
        icon: 'fab fa-tiktok',
        templateName: 'TikTokProfile'
    },
    {
        id: 'tt-video',
        name: 'TikTokVideoCover',
        width: 1080,
        height: 1920,
        platform: 'TikTok',
        category: 'tiktok',
        icon: 'fas fa-video',
        templateName: 'TikTokVideoCover'
    }
];

// ================================
// Platform Names
// ================================

export const PLATFORM_NAMES = {
    INSTAGRAM: 'Instagram',
    FACEBOOK: 'Facebook',
    TWITTER_X: 'Twitter/X',
    LINKEDIN: 'LinkedIn',
    YOUTUBE: 'YouTube',
    PINTEREST: 'Pinterest',
    TIKTOK: 'TikTok',
    WEB: 'Web',
    LOGO: 'Logo',
    SCREENSHOTS: 'Screenshots',
    FAVICON: 'Favicon'
};

// ================================
// Template Names by Platform
// ================================

export const TEMPLATE_NAMES = {
    FAVICON_SET: 'FaviconSet',
    SCREENSHOTS_DESKTOP: 'ScreenshotsDesktop',
    SCREENSHOTS_MOBILE: 'ScreenshotsMobile',
    INSTAGRAM: [
        'InstagramProfile',
        'InstagramSquare',
        'InstagramPortrait',
        'InstagramLandscape',
        'InstagramStoriesReels'
    ],
    FACEBOOK: [
        'FacebookProfile',
        'FacebookCoverBanner',
        'FacebookSharedImage',
        'FacebookSquarePost',
        'FacebookStories'
    ],
    TWITTER_X: [
        'XProfile',
        'XHeaderBanner',
        'XLandscapePost',
        'XSquarePost',
        'XPortraitPost'
    ],
    LINKEDIN: [
        'LinkedInProfile',
        'LinkedInPersonalCover',
        'LinkedInLandscapePost',
        'LinkedInSquarePost',
        'LinkedInPortraitPost'
    ],
    YOUTUBE: [
        'YouTubeChannelIcon',
        'YouTubeBanner',
        'YouTubeThumbnail'
    ],
    PINTEREST: [
        'PinterestProfile',
        'PinterestStandardPin',
        'PinterestSquarePin',
        'PinterestStoryPin'
    ],
    TIKTOK: [
        'TikTokProfile',
        'TikTokVideoCover'
    ],
    WEB: [
        'WebHero',
        'WebBlog',
        'WebContent',
        'WebThumb'
    ],
    LOGO: [
        'LogoRectangular',
        'LogoSquare'
    ],
    SCREENSHOTS: [
        'ScreenshotsMobile',
        'ScreenshotsTablet',
        'ScreenshotsDesktop',
        'ScreenshotsDesktopHD',
        'ScreenshotsMobileFull',
        'ScreenshotsTabletFull',
        'ScreenshotsDesktopFull',
        'ScreenshotsDesktopHDFull'
    ]
};

// ================================
// App-specific Template Constants
// ================================

export const FAVICON_TEMPLATE_ID = 'favicon-set';
export const SCREENSHOT_TEMPLATE_ID = 'screenshots-desktop';
export const DEFAULT_FAVICON_SITE_NAME = 'My Website';
export const DEFAULT_FAVICON_THEME_COLOR = '#ffffff';
export const DEFAULT_FAVICON_BACKGROUND_COLOR = '#ffffff';

// ================================
// Export Folders
// ================================

export const EXPORT_FOLDERS = {
    ORIGINAL_IMAGES: 'OriginalImages',
    OPTIMIZED_IMAGES: 'OptimizedImages',
    WEB_IMAGES: 'WebImages',
    LOGO_IMAGES: 'LogoImages',
    SOCIAL_MEDIA_IMAGES: 'SocialMediaImages',
    FAVICON_SET: 'FaviconSet',
    SCREENSHOTS: 'Screenshots'
};

// ================================
// Viewport & User Agent Functions
// ================================

/**
 * Returns viewport dimensions for device type
 * @param {string} device - Device type identifier
 * @returns {object} Viewport dimensions
 */
export const getViewportSize = (device) => {
    const sizes = {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1366, height: 768 },
        'desktop-hd': { width: 1920, height: 1080 },
    };
    return sizes[device] || sizes.desktop;
};

/**
 * Returns user agent string for device type
 * @param {string} device - Device type identifier
 * @returns {string} User agent string
 */
export const getUserAgent = (device) => {
    const agents = {
        mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        tablet: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'desktop-hd': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    return agents[device] || agents.desktop;
};

// ================================
// Helper Functions
// ================================

/**
 * Gets templates by category
 * @param {string} categoryId - Category ID to filter by
 * @returns {Array} Filtered templates
 */
export const getTemplatesByCategory = (categoryId) => {
    return SOCIAL_MEDIA_TEMPLATES.filter(template =>
        categoryId === 'all' || template.category === categoryId
    );
};

/**
 * Gets category by ID
 * @param {string} categoryId - Category ID to find
 * @returns {Object|null} Category object or null
 */
export const getCategoryById = (categoryId) => {
    return TEMPLATE_CATEGORIES.find(cat => cat.id === categoryId);
};

/**
 * Gets all categories except 'all'
 * @returns {Array} Template categories
 */
export const getTemplateCategories = () => {
    return TEMPLATE_CATEGORIES.filter(cat => cat.id !== 'all');
};

/**
 * Gets template by ID
 * @param {string} templateId - Template ID to find
 * @returns {Object|null} Template object or null
 */
export const getTemplateById = (templateId) => {
    return SOCIAL_MEDIA_TEMPLATES.find(template => template.id === templateId) ||
        SCREENSHOT_TEMPLATES[templateId] || null;
};

/**
 * Gets templates by platform
 * @param {string} platform - Platform name
 * @returns {Array} Templates for the platform
 */
export const getTemplatesByPlatform = (platform) => {
    return SOCIAL_MEDIA_TEMPLATES.filter(template => template.platform === platform);
};

/**
 * Gets all template IDs
 * @returns {Array} All template IDs
 */
export const getAllTemplateIds = () => {
    return SOCIAL_MEDIA_TEMPLATES.map(template => template.id);
};

/**
 * Gets screenshot template by ID
 * @param {string} templateId - Screenshot template ID
 * @returns {Object|null} Screenshot template or null
 */
export const getScreenshotTemplateById = (templateId) => {
    return SCREENSHOT_TEMPLATES[templateId] || null;
};

/**
 * Gets all screenshot templates
 * @returns {Array} All screenshot templates
 */
export const getAllScreenshotTemplates = () => {
    return Object.values(SCREENSHOT_TEMPLATES);
};

/**
 * Checks if template is a screenshot template
 * @param {string} templateId - Template ID to check
 * @returns {boolean} True if screenshot template
 */
export const isScreenshotTemplate = (templateId) => {
    return templateId in SCREENSHOT_TEMPLATES;
};

/**
 * Checks if template is a favicon template
 * @param {string} templateId - Template ID to check
 * @returns {boolean} True if favicon template
 */
export const isFaviconTemplate = (templateId) => {
    return templateId === FAVICON_TEMPLATE_ID || templateId.includes('favicon');
};

/**
 * Gets favicon sizes as array of numbers
 * @returns {Array} Favicon sizes
 */
export const getFaviconSizeArray = () => {
    return FAVICON_SIZE_LIST;
};

/**
 * Gets favicon size objects
 * @returns {Array} Favicon size objects
 */
export const getFaviconSizes = () => {
    return FAVICON_SIZES;
};