import {
    DEVICE_VIEWPORTS,
    SCREENSHOT_QUALITY
} from '../constants';

// ================================
// Template Categories
// ================================

export const TEMPLATE_CATEGORIES = [
    { id: 'all', name: 'category.all', icon: 'fas fa-th' },
    { id: 'web', name: 'category.web', icon: 'fas fa-globe' },
    { id: 'logo', name: 'category.logo', icon: 'fas fa-copyright' },
    { id: 'instagram', name: 'category.instagram', icon: 'fab fa-instagram' },
    { id: 'facebook', name: 'category.facebook', icon: 'fab fa-facebook' },
    { id: 'twitter', name: 'category.twitter', icon: 'fab fa-twitter' },
    { id: 'linkedin', name: 'category.linkedin', icon: 'fab fa-linkedin' },
    { id: 'youtube', name: 'category.youtube', icon: 'fab fa-youtube' },
    { id: 'pinterest', name: 'category.pinterest', icon: 'fab fa-pinterest' },
    { id: 'tiktok', name: 'category.tiktok', icon: 'fab fa-tiktok' },
    { id: 'favicon', name: 'category.favicon', icon: 'fas fa-star' },
    { id: 'screenshots', name: 'category.screenshots', icon: 'fas fa-camera' }
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

export const FAVICON_SIZE_LIST = [16, 32, 48, 64, 76, 120, 128, 152, 180, 256, 512];
export const FAVICON_PREVIEW_SIZE = 512;

// ================================
// Template-Specific Application Configuration
// ================================

export const APP_TEMPLATE_CONFIG = {
    FAVICON: {
        FILES_COUNT: 9,
        DEFAULT_SCALE: 400,
        DEFAULT_SITE_NAME: 'My Website',
        DEFAULT_THEME_COLOR: '#ffffff',
        DEFAULT_BACKGROUND_COLOR: '#ffffff',
        FOLDER_NAME: 'Favicons'
    },

    SCREENSHOTS: {
        FOLDER_NAME: 'Screenshots',
        DEFAULT_FORMAT: 'jpg',
        DEFAULT_QUALITY: 80
    }
};

export const DEFAULT_PLACEHOLDER_DIMENSIONS = {
    WIDTH: 800,
    HEIGHT: 600,
    MAX_SIZE: 1200
};

// ================================
// Screenshot Templates (Updated with Constants)
// ================================

export const SCREENSHOT_TEMPLATES = {
    'screenshots-mobile': {
        id: 'screenshots-mobile',
        name: 'template.ScreenshotsMobile',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.MOBILE.width,
        height: DEVICE_VIEWPORTS.MOBILE.height,
        fullPage: false,
        icon: 'fas fa-mobile-alt',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: true,
                hasTouch: true,
                width: DEVICE_VIEWPORTS.MOBILE.width,
                height: DEVICE_VIEWPORTS.MOBILE.height,
                isLandscape: false
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: false,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-mobile-full': {
        id: 'screenshots-mobile-full',
        name: 'template.ScreenshotsMobileFull',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.MOBILE.width,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-mobile-alt',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: true,
                hasTouch: true,
                width: DEVICE_VIEWPORTS.MOBILE.width,
                height: DEVICE_VIEWPORTS.MOBILE.height,
                isLandscape: false
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: true,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-tablet': {
        id: 'screenshots-tablet',
        name: 'template.ScreenshotsTablet',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.TABLET.width,
        height: DEVICE_VIEWPORTS.TABLET.height,
        fullPage: false,
        icon: 'fas fa-tablet',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: true,
                hasTouch: true,
                width: DEVICE_VIEWPORTS.TABLET.width,
                height: DEVICE_VIEWPORTS.TABLET.height,
                isLandscape: false
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: false,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-tablet-full': {
        id: 'screenshots-tablet-full',
        name: 'template.ScreenshotsTabletFull',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.TABLET.width,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-tablet',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: true,
                hasTouch: true,
                width: DEVICE_VIEWPORTS.TABLET.width,
                height: DEVICE_VIEWPORTS.TABLET.height,
                isLandscape: false
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: true,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-desktop': {
        id: 'screenshots-desktop',
        name: 'template.ScreenshotsDesktop',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.DESKTOP.width,
        height: DEVICE_VIEWPORTS.DESKTOP.height,
        fullPage: false,
        icon: 'fas fa-desktop',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: false,
                hasTouch: false,
                width: DEVICE_VIEWPORTS.DESKTOP.width,
                height: DEVICE_VIEWPORTS.DESKTOP.height,
                isLandscape: true
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: false,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-desktop-full': {
        id: 'screenshots-desktop-full',
        name: 'template.ScreenshotsDesktopFull',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.DESKTOP.width,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-desktop',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: false,
                hasTouch: false,
                width: DEVICE_VIEWPORTS.DESKTOP.width,
                height: DEVICE_VIEWPORTS.DESKTOP.height,
                isLandscape: true
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: true,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-desktop-hd': {
        id: 'screenshots-desktop-hd',
        name: 'template.ScreenshotsDesktopHd',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.DESKTOP_HD.width,
        height: DEVICE_VIEWPORTS.DESKTOP_HD.height,
        fullPage: false,
        icon: 'fas fa-desktop-alt',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: false,
                hasTouch: false,
                width: DEVICE_VIEWPORTS.DESKTOP_HD.width,
                height: DEVICE_VIEWPORTS.DESKTOP_HD.height,
                isLandscape: true
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: false,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    },
    'screenshots-desktop-hd-full': {
        id: 'screenshots-desktop-hd-full',
        name: 'template.ScreenshotsDesktopHdFull',
        category: 'screenshots',
        platform: 'platform.screenshots',
        width: DEVICE_VIEWPORTS.DESKTOP_HD.width,
        height: 'auto',
        fullPage: true,
        icon: 'fas fa-desktop-alt',
        requestBody: {
            bestAttempt: true,
            blockConsentModals: true,
            setJavaScriptEnabled: true,
            viewport: {
                isMobile: false,
                hasTouch: false,
                width: DEVICE_VIEWPORTS.DESKTOP_HD.width,
                height: DEVICE_VIEWPORTS.DESKTOP_HD.height,
                isLandscape: true
            },
            options: {
                type: 'jpeg',
                optimizeForSpeed: true,
                fullPage: true,
                quality: SCREENSHOT_QUALITY.JPEG_QUALITY
            }
        }
    }
};

// ================================
// All Social Media Templates
// ================================

export const SOCIAL_MEDIA_TEMPLATES = [
    // Web Images
    {
        id: 'web-hero',
        name: 'template.WebHero',
        width: 1920,
        height: 1080, // 16:9
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-desktop',
        templateName: 'WebHero'
    },
    {
        id: 'web-blog',
        name: 'template.WebBlog',
        width: 1200,
        height: 630, // 1.91:1
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-blog',
        templateName: 'WebBlog'
    },
    {
        id: 'web-content',
        name: 'template.WebContent',
        width: 1200,
        height: 675, // 16:9 normalized (replaces auto)
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-image',
        templateName: 'WebContent'
    },
    {
        id: 'web-thumb',
        name: 'template.WebThumb',
        width: 300,
        height: 300, // 1:1
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-square',
        templateName: 'WebThumb'
    },

    // Logo Images
    {
        id: 'logo-rect',
        name: 'template.LogoRectangular',
        width: 600,
        height: 300, // 2:1
        platform: 'platform.logo',
        category: 'logo',
        icon: 'fas fa-copyright',
        templateName: 'LogoRectangular'
    },
    {
        id: 'logo-square',
        name: 'template.LogoSquare',
        width: 1024,
        height: 1024, // 1:1
        platform: 'platform.logo',
        category: 'logo',
        icon: 'fas fa-square',
        templateName: 'LogoSquare'
    },

    // Instagram
    {
        id: 'ig-profile',
        name: 'template.InstagramProfile',
        width: 400,
        height: 400, // 1:1
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fab fa-instagram',
        templateName: 'InstagramProfile'
    },
    {
        id: 'ig-square',
        name: 'template.InstagramSquare',
        width: 1080,
        height: 1080, // 1:1
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-square',
        templateName: 'InstagramSquare'
    },
    {
        id: 'ig-portrait',
        name: 'template.InstagramPortrait',
        width: 1080,
        height: 1350, // 4:5
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-image',
        templateName: 'InstagramPortrait'
    },
    {
        id: 'ig-landscape',
        name: 'template.InstagramLandscape',
        width: 1080,
        height: 608, // 1.91:1
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-expand',
        templateName: 'InstagramLandscape'
    },
    {
        id: 'ig-stories',
        name: 'template.InstagramStoriesReels',
        width: 1080,
        height: 1920, // 9:16
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-video',
        templateName: 'InstagramStoriesReels'
    },

    // Facebook
    {
        id: 'fb-profile',
        name: 'template.FacebookProfile',
        width: 360,
        height: 360, // 1:1
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fab fa-facebook',
        templateName: 'FacebookProfile'
    },
    {
        id: 'fb-cover',
        name: 'template.FacebookCoverBanner',
        width: 820,
        height: 360, // ~2.28:1
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-image',
        templateName: 'FacebookCoverBanner'
    },
    {
        id: 'fb-shared',
        name: 'template.FacebookSharedImage',
        width: 1200,
        height: 630, // 1.91:1
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-share-alt',
        templateName: 'FacebookSharedImage'
    },
    {
        id: 'fb-square',
        name: 'template.FacebookSquarePost',
        width: 1200,
        height: 1200, // 1:1
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-square',
        templateName: 'FacebookSquarePost'
    },
    {
        id: 'fb-stories',
        name: 'template.FacebookStories',
        width: 1080,
        height: 1920, // 9:16
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-scroll',
        templateName: 'FacebookStories'
    },

    // Twitter / X
    {
        id: 'tw-profile',
        name: 'template.XProfile',
        width: 400,
        height: 400, // 1:1
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fab fa-twitter',
        templateName: 'XProfile'
    },
    {
        id: 'tw-header',
        name: 'template.XHeaderBanner',
        width: 1500,
        height: 500, // 3:1
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-image',
        templateName: 'XHeaderBanner'
    },
    {
        id: 'tw-landscape',
        name: 'template.XLandscapePost',
        width: 1200,
        height: 675, // 16:9
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-expand',
        templateName: 'XLandscapePost'
    },
    {
        id: 'tw-square',
        name: 'template.XSquarePost',
        width: 1080,
        height: 1080, // 1:1
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-square',
        templateName: 'XSquarePost'
    },
    {
        id: 'tw-portrait',
        name: 'template.XPortraitPost',
        width: 1080,
        height: 1350, // 4:5
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-image',
        templateName: 'XPortraitPost'
    },

    // LinkedIn
    {
        id: 'li-profile',
        name: 'template.LinkedInProfile',
        width: 400,
        height: 400, // 1:1
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fab fa-linkedin',
        templateName: 'LinkedInProfile'
    },
    {
        id: 'li-cover',
        name: 'template.LinkedInPersonalCover',
        width: 1584,
        height: 396, // 4:1
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-image',
        templateName: 'LinkedInPersonalCover'
    },
    {
        id: 'li-landscape',
        name: 'template.LinkedInLandscapePost',
        width: 1200,
        height: 628, // 1.91:1
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-expand',
        templateName: 'LinkedInLandscapePost'
    },
    {
        id: 'li-square',
        name: 'template.LinkedInSquarePost',
        width: 1200,
        height: 1200, // 1:1
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-square',
        templateName: 'LinkedInSquarePost'
    },
    {
        id: 'li-portrait',
        name: 'template.LinkedInPortraitPost',
        width: 1080,
        height: 1350, // 4:5
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-image',
        templateName: 'LinkedInPortraitPost'
    },

    // YouTube
    {
        id: 'yt-channel',
        name: 'template.YouTubeChannelIcon',
        width: 1024,
        height: 1024, // 1:1
        platform: 'platform.youtube',
        category: 'youtube',
        icon: 'fab fa-youtube',
        templateName: 'YouTubeChannelIcon'
    },
    {
        id: 'yt-banner',
        name: 'template.YouTubeBanner',
        width: 2560,
        height: 1440, // 16:9
        platform: 'platform.youtube',
        category: 'youtube',
        icon: 'fas fa-image',
        templateName: 'YouTubeBanner'
    },
    {
        id: 'yt-thumb',
        name: 'template.YouTubeThumbnail',
        width: 1280,
        height: 720, // 16:9
        platform: 'platform.youtube',
        category: 'youtube',
        icon: 'fas fa-video',
        templateName: 'YouTubeThumbnail'
    },

    // Pinterest
    {
        id: 'pin-profile',
        name: 'template.PinterestProfile',
        width: 400,
        height: 400, // 1:1
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fab fa-pinterest',
        templateName: 'PinterestProfile'
    },
    {
        id: 'pin-standard',
        name: 'template.PinterestStandardPin',
        width: 1000,
        height: 1500, // 2:3
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fas fa-thumbtack',
        templateName: 'PinterestStandardPin'
    },
    {
        id: 'pin-square',
        name: 'template.PinterestSquarePin',
        width: 1000,
        height: 1000, // 1:1
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fas fa-square',
        templateName: 'PinterestSquarePin'
    },
    {
        id: 'pin-story',
        name: 'template.PinterestStoryPin',
        width: 1080,
        height: 1920, // 9:16
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fas fa-scroll',
        templateName: 'PinterestStoryPin'
    },

    // TikTok
    {
        id: 'tt-profile',
        name: 'template.TikTokProfile',
        width: 400,
        height: 400, // 1:1
        platform: 'platform.tiktok',
        category: 'tiktok',
        icon: 'fab fa-tiktok',
        templateName: 'TikTokProfile'
    },
    {
        id: 'tt-video',
        name: 'template.TikTokVideoCover',
        width: 1080,
        height: 1920, // 9:16
        platform: 'platform.tiktok',
        category: 'tiktok',
        icon: 'fas fa-video',
        templateName: 'TikTokVideoCover'
    }
];

// ================================
// Platform Names
// ================================

export const PLATFORM_NAMES = {
    INSTAGRAM: 'platform.instagram',
    FACEBOOK: 'platform.facebook',
    TWITTER_X: 'platform.twitter',
    LINKEDIN: 'platform.linkedin',
    YOUTUBE: 'platform.youtube',
    PINTEREST: 'platform.pinterest',
    TIKTOK: 'platform.tiktok',
    WEB: 'platform.web',
    LOGO: 'platform.logo',
    SCREENSHOTS: 'platform.screenshots',
    FAVICON: 'platform.favicon'
};

// ================================
// Template Names by Platform
// ================================

export const TEMPLATE_NAMES = {
    FAVICON_SET: 'template.FaviconSet',
    SCREENSHOTS_DESKTOP: 'template.ScreenshotsDesktop',
    SCREENSHOTS_MOBILE: 'template.ScreenshotsMobile',
    INSTAGRAM: [
        'template.InstagramProfile',
        'template.InstagramSquare',
        'template.InstagramPortrait',
        'template.InstagramLandscape',
        'template.InstagramStoriesReels'
    ],
    FACEBOOK: [
        'template.FacebookProfile',
        'template.FacebookCoverBanner',
        'template.FacebookSharedImage',
        'template.FacebookSquarePost',
        'template.FacebookStories'
    ],
    TWITTER_X: [
        'template.XProfile',
        'template.XHeaderBanner',
        'template.XLandscapePost',
        'template.XSquarePost',
        'template.XPortraitPost'
    ],
    LINKEDIN: [
        'template.LinkedInProfile',
        'template.LinkedInPersonalCover',
        'template.LinkedInLandscapePost',
        'template.LinkedInSquarePost',
        'template.LinkedInPortraitPost'
    ],
    YOUTUBE: [
        'template.YouTubeChannelIcon',
        'template.YouTubeBanner',
        'template.YouTubeThumbnail'
    ],
    PINTEREST: [
        'template.PinterestProfile',
        'template.PinterestStandardPin',
        'template.PinterestSquarePin',
        'template.PinterestStoryPin'
    ],
    TIKTOK: [
        'template.TikTokProfile',
        'template.TikTokVideoCover'
    ],
    WEB: [
        'template.WebHero',
        'template.WebBlog',
        'template.WebContent',
        'template.WebThumb'
    ],
    LOGO: [
        'template.LogoRectangular',
        'template.LogoSquare'
    ],
    SCREENSHOTS: [
        'template.ScreenshotsMobile',
        'template.ScreenshotsTablet',
        'template.ScreenshotsDesktop',
        'template.ScreenshotsDesktopHd',
        'template.ScreenshotsMobileFull',
        'template.ScreenshotsTabletFull',
        'template.ScreenshotsDesktopFull',
        'template.ScreenshotsDesktopHdFull'
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