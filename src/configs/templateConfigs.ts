import {
    DEVICE_VIEWPORTS,
    SCREENSHOT_QUALITY
} from '../constants';
import type { TemplateConfig, SmartCropConfig } from '../types';
export type { TemplateConfig, SmartCropConfig };

export interface TemplateCategory {
    id: string;
    name: string;
    icon: string;
}

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
// Smart Crop Configuration for Templates
// ================================

export const TEMPLATE_SMART_CROP_CONFIG = {
    // Default crop strategies per template type
    DEFAULT_STRATEGIES: {
        'web': 'ai_priority',
        'logo': 'logo_priority',
        'instagram': 'hybrid',
        'facebook': 'ai_priority',
        'twitter': 'hybrid',
        'linkedin': 'ai_priority',
        'youtube': 'focal_point',
        'pinterest': 'hybrid',
        'tiktok': 'focal_point',
        'favicon': 'center',
        'screenshots': 'center'
    },

    // Priority subjects per template type
    PRIORITY_SUBJECTS: {
        'web': 'person',
        'logo': 'logo',
        'instagram': 'face',
        'facebook': 'person',
        'twitter': 'person',
        'linkedin': 'face',
        'youtube': 'face',
        'pinterest': 'person',
        'tiktok': 'face'
    },

    // Whether to preserve logos per template type
    PRESERVE_LOGOS: {
        'web': true,
        'logo': true,
        'instagram': false,
        'facebook': true,
        'twitter': true,
        'linkedin': true,
        'youtube': false,
        'pinterest': true,
        'tiktok': false
    },

    // Minimum subject size ratio per template
    MIN_SUBJECT_SIZE: {
        'web': 0.15,
        'logo': 0.1,
        'instagram': 0.2,
        'facebook': 0.15,
        'twitter': 0.15,
        'linkedin': 0.2,
        'youtube': 0.25,
        'pinterest': 0.1,
        'tiktok': 0.3
    },

    // Maximum padding ratio per template
    MAX_PADDING: {
        'web': 0.15,
        'logo': 0.2,
        'instagram': 0.1,
        'facebook': 0.15,
        'twitter': 0.1,
        'linkedin': 0.15,
        'youtube': 0.1,
        'pinterest': 0.2,
        'tiktok': 0.05
    },

    // Whether to use tight crop (crop through logos if needed)
    TIGHT_CROP: {
        'web': false,
        'logo': false,
        'instagram': true,
        'facebook': false,
        'twitter': false,
        'linkedin': false,
        'youtube': true,
        'pinterest': false,
        'tiktok': true
    },

    // Default quality per template type
    DEFAULT_QUALITY: {
        'web': 0.9,
        'logo': 1.0,
        'instagram': 0.85,
        'facebook': 0.85,
        'twitter': 0.8,
        'linkedin': 0.9,
        'youtube': 0.8,
        'pinterest': 0.85,
        'tiktok': 0.75,
        'favicon': 1.0,
        'screenshots': 0.8
    },

    // Default format per template type
    DEFAULT_FORMAT: {
        'web': 'webp',
        'logo': 'png',
        'instagram': 'jpg',
        'facebook': 'jpg',
        'twitter': 'jpg',
        'linkedin': 'jpg',
        'youtube': 'jpg',
        'pinterest': 'jpg',
        'tiktok': 'jpg',
        'favicon': 'png',
        'screenshots': 'jpg'
    }
};

// ================================
// Favicon Sizes
// ================================

export const FAVICON_SIZES = [
    // Standard favicons
    { name: 'favicon-16x16', width: 16, height: 16 },
    { name: 'favicon-32x32', width: 32, height: 32 },
    { name: 'favicon-48x48', width: 48, height: 48 },

    // Additional standard sizes
    { name: 'favicon-64x64', width: 64, height: 64 },
    { name: 'favicon-96x96', width: 96, height: 96 },
    { name: 'favicon-128x128', width: 128, height: 128 },
    { name: 'favicon-256x256', width: 256, height: 256 },

    // Apple Touch Icons
    { name: 'apple-touch-icon-76x76', width: 76, height: 76 },
    { name: 'apple-touch-icon-120x120', width: 120, height: 120 },
    { name: 'apple-touch-icon-152x152', width: 152, height: 152 },
    { name: 'apple-touch-icon-180x180', width: 180, height: 180 },

    // Android Chrome Icons
    { name: 'android-chrome-192x192', width: 192, height: 192 },
    { name: 'android-chrome-512x512', width: 512, height: 512 },

    // Windows Metro tiles
    { name: 'mstile-70x70', width: 70, height: 70 },
    { name: 'mstile-144x144', width: 144, height: 144 },
    { name: 'mstile-150x150', width: 150, height: 150 },
    { name: 'mstile-310x150', width: 310, height: 150 },
    { name: 'mstile-310x310', width: 310, height: 310 }
];

export const FAVICON_SIZES_BASIC = [
    { name: 'favicon-16x16', width: 16, height: 16 },
    { name: 'favicon-32x32', width: 32, height: 32 },
    { name: 'android-chrome-192x192', width: 192, height: 192 },
    { name: 'android-chrome-512x512', width: 512, height: 512 },
    { name: 'apple-touch-icon', width: 180, height: 180 }
];

// All sizes as a simple array (including ICO sizes and additional sizes)
export const FAVICON_SIZE_LIST = [16, 32, 48, 64, 70, 76, 96, 120, 128, 144, 150, 152, 180, 192, 256, 310, 512];

// ICO file sizes (embedded in favicon.ico)
export const FAVICON_ICO_SIZES = [16, 32, 48, 64];

// Preview size (largest size for display)
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
        cropMode: 'center', // Screenshots use center crop
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
        cropMode: 'center',
        cropConfig: {
            useSmartCrop: false,
            preserveLogos: false,
            tightCrop: true
        },
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
// All Social Media Templates (Updated with Smart Crop Config)
// ================================

export const SOCIAL_MEDIA_TEMPLATES: TemplateConfig[] = [
    // Web Images
    {
        id: 'web-hero',
        name: 'template.WebHero',
        width: 1920,
        height: 1080,
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-desktop',
        templateName: 'WebHero',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'webp'
        }
    },
    {
        id: 'web-blog',
        name: 'template.WebBlog',
        width: 1200,
        height: 630,
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-blog',
        templateName: 'WebBlog',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'webp'
        }
    },
    {
        id: 'web-content',
        name: 'template.WebContent',
        width: 1200,
        height: 675,
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-image',
        templateName: 'WebContent',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'webp'
        }
    },
    {
        id: 'web-thumb',
        name: 'template.WebThumb',
        width: 300,
        height: 300,
        platform: 'platform.web',
        category: 'web',
        icon: 'fas fa-square',
        templateName: 'WebThumb',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.9,
            format: 'webp'
        }
    },

    // Logo Images
    {
        id: 'logo-rect',
        name: 'template.LogoRectangular',
        width: 600,
        height: 300,
        platform: 'platform.logo',
        category: 'logo',
        icon: 'fas fa-copyright',
        templateName: 'LogoRectangular',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'logo_priority',
            preserveLogos: true,
            prioritySubject: 'logo',
            minSubjectSize: 0.1,
            maxPadding: 0.2,
            tightCrop: false,
            quality: 1.0,
            format: 'png'
        }
    },
    {
        id: 'logo-square',
        name: 'template.LogoSquare',
        width: 1024,
        height: 1024,
        platform: 'platform.logo',
        category: 'logo',
        icon: 'fas fa-square',
        templateName: 'LogoSquare',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'logo_priority',
            preserveLogos: true,
            prioritySubject: 'logo',
            minSubjectSize: 0.1,
            maxPadding: 0.2,
            tightCrop: false,
            quality: 1.0,
            format: 'png'
        }
    },

    // Instagram
    {
        id: 'ig-profile',
        name: 'template.InstagramProfile',
        width: 400,
        height: 400,
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fab fa-instagram',
        templateName: 'InstagramProfile',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'ig-square',
        name: 'template.InstagramSquare',
        width: 1080,
        height: 1080,
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-square',
        templateName: 'InstagramSquare',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'ig-portrait',
        name: 'template.InstagramPortrait',
        width: 1080,
        height: 1350,
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-image',
        templateName: 'InstagramPortrait',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'ig-landscape',
        name: 'template.InstagramLandscape',
        width: 1080,
        height: 608,
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-expand',
        templateName: 'InstagramLandscape',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'ig-stories',
        name: 'template.InstagramStoriesReels',
        width: 1080,
        height: 1920,
        platform: 'platform.instagram',
        category: 'instagram',
        icon: 'fas fa-video',
        templateName: 'InstagramStoriesReels',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.85,
            format: 'jpg'
        }
    },

    // Facebook
    {
        id: 'fb-profile',
        name: 'template.FacebookProfile',
        width: 360,
        height: 360,
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fab fa-facebook',
        templateName: 'FacebookProfile',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'fb-cover',
        name: 'template.FacebookCoverBanner',
        width: 820,
        height: 360,
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-image',
        templateName: 'FacebookCoverBanner',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'fb-shared',
        name: 'template.FacebookSharedImage',
        width: 1200,
        height: 630,
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-share-alt',
        templateName: 'FacebookSharedImage',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'fb-square',
        name: 'template.FacebookSquarePost',
        width: 1200,
        height: 1200,
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-square',
        templateName: 'FacebookSquarePost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'fb-stories',
        name: 'template.FacebookStories',
        width: 1080,
        height: 1920,
        platform: 'platform.facebook',
        category: 'facebook',
        icon: 'fas fa-scroll',
        templateName: 'FacebookStories',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },

    // Twitter / X
    {
        id: 'tw-profile',
        name: 'template.XProfile',
        width: 400,
        height: 400,
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fab fa-twitter',
        templateName: 'XProfile',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.1,
            tightCrop: false,
            quality: 0.8,
            format: 'jpg'
        }
    },
    {
        id: 'tw-header',
        name: 'template.XHeaderBanner',
        width: 1500,
        height: 500,
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-image',
        templateName: 'XHeaderBanner',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.1,
            tightCrop: false,
            quality: 0.8,
            format: 'jpg'
        }
    },
    {
        id: 'tw-landscape',
        name: 'template.XLandscapePost',
        width: 1200,
        height: 675,
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-expand',
        templateName: 'XLandscapePost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.1,
            tightCrop: false,
            quality: 0.8,
            format: 'jpg'
        }
    },
    {
        id: 'tw-square',
        name: 'template.XSquarePost',
        width: 1080,
        height: 1080,
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-square',
        templateName: 'XSquarePost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.1,
            tightCrop: false,
            quality: 0.8,
            format: 'jpg'
        }
    },
    {
        id: 'tw-portrait',
        name: 'template.XPortraitPost',
        width: 1080,
        height: 1350,
        platform: 'platform.twitter',
        category: 'twitter',
        icon: 'fas fa-image',
        templateName: 'XPortraitPost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.15,
            maxPadding: 0.1,
            tightCrop: false,
            quality: 0.8,
            format: 'jpg'
        }
    },

    // LinkedIn
    {
        id: 'li-profile',
        name: 'template.LinkedInProfile',
        width: 400,
        height: 400,
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fab fa-linkedin',
        templateName: 'LinkedInProfile',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'jpg'
        }
    },
    {
        id: 'li-cover',
        name: 'template.LinkedInPersonalCover',
        width: 1584,
        height: 396,
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-image',
        templateName: 'LinkedInPersonalCover',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'jpg'
        }
    },
    {
        id: 'li-landscape',
        name: 'template.LinkedInLandscapePost',
        width: 1200,
        height: 628,
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-expand',
        templateName: 'LinkedInLandscapePost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'jpg'
        }
    },
    {
        id: 'li-square',
        name: 'template.LinkedInSquarePost',
        width: 1200,
        height: 1200,
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-square',
        templateName: 'LinkedInSquarePost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'jpg'
        }
    },
    {
        id: 'li-portrait',
        name: 'template.LinkedInPortraitPost',
        width: 1080,
        height: 1350,
        platform: 'platform.linkedin',
        category: 'linkedin',
        icon: 'fas fa-image',
        templateName: 'LinkedInPortraitPost',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'ai_priority',
            preserveLogos: true,
            prioritySubject: 'face',
            minSubjectSize: 0.2,
            maxPadding: 0.15,
            tightCrop: false,
            quality: 0.9,
            format: 'jpg'
        }
    },

    // YouTube
    {
        id: 'yt-channel',
        name: 'template.YouTubeChannelIcon',
        width: 1024,
        height: 1024,
        platform: 'platform.youtube',
        category: 'youtube',
        icon: 'fab fa-youtube',
        templateName: 'YouTubeChannelIcon',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'focal_point',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.25,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.8,
            format: 'jpg'
        }
    },
    {
        id: 'yt-banner',
        name: 'template.YouTubeBanner',
        width: 2560,
        height: 1440,
        platform: 'platform.youtube',
        category: 'youtube',
        icon: 'fas fa-image',
        templateName: 'YouTubeBanner',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'focal_point',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.25,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.8,
            format: 'jpg'
        }
    },
    {
        id: 'yt-thumb',
        name: 'template.YouTubeThumbnail',
        width: 1280,
        height: 720,
        platform: 'platform.youtube',
        category: 'youtube',
        icon: 'fas fa-video',
        templateName: 'YouTubeThumbnail',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'focal_point',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.25,
            maxPadding: 0.1,
            tightCrop: true,
            quality: 0.8,
            format: 'jpg'
        }
    },

    // Pinterest
    {
        id: 'pin-profile',
        name: 'template.PinterestProfile',
        width: 400,
        height: 400,
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fab fa-pinterest',
        templateName: 'PinterestProfile',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.1,
            maxPadding: 0.2,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'pin-standard',
        name: 'template.PinterestStandardPin',
        width: 1000,
        height: 1500,
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fas fa-thumbtack',
        templateName: 'PinterestStandardPin',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.1,
            maxPadding: 0.2,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'pin-square',
        name: 'template.PinterestSquarePin',
        width: 1000,
        height: 1000,
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fas fa-square',
        templateName: 'PinterestSquarePin',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.1,
            maxPadding: 0.2,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },
    {
        id: 'pin-story',
        name: 'template.PinterestStoryPin',
        width: 1080,
        height: 1920,
        platform: 'platform.pinterest',
        category: 'pinterest',
        icon: 'fas fa-scroll',
        templateName: 'PinterestStoryPin',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'hybrid',
            preserveLogos: true,
            prioritySubject: 'person',
            minSubjectSize: 0.1,
            maxPadding: 0.2,
            tightCrop: false,
            quality: 0.85,
            format: 'jpg'
        }
    },

    // TikTok
    {
        id: 'tt-profile',
        name: 'template.TikTokProfile',
        width: 400,
        height: 400,
        platform: 'platform.tiktok',
        category: 'tiktok',
        icon: 'fab fa-tiktok',
        templateName: 'TikTokProfile',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'focal_point',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.3,
            maxPadding: 0.05,
            tightCrop: true,
            quality: 0.75,
            format: 'jpg'
        }
    },
    {
        id: 'tt-video',
        name: 'template.TikTokVideoCover',
        width: 1080,
        height: 1920,
        platform: 'platform.tiktok',
        category: 'tiktok',
        icon: 'fas fa-video',
        templateName: 'TikTokVideoCover',
        cropMode: 'smart',
        cropConfig: {
            useSmartCrop: true,
            strategy: 'focal_point',
            preserveLogos: false,
            prioritySubject: 'face',
            minSubjectSize: 0.3,
            maxPadding: 0.05,
            tightCrop: true,
            quality: 0.75,
            format: 'jpg'
        }
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
    SCREENSHOTS: 'Screenshots',
    RENAMED_IMAGES: 'RenamedImages'
};

// ================================
// Helper Functions (Enhanced)
// ================================

/**
 * Gets templates by category
 * @param {string} categoryId - Category ID to filter by
 * @returns {Array} Filtered templates
 */
export const getTemplatesByCategory = (categoryId: string) => {
    return SOCIAL_MEDIA_TEMPLATES.filter(template =>
        categoryId === 'all' || template.category === categoryId
    );
};

/**
 * Gets category by ID
 * @param {string} categoryId - Category ID to find
 * @returns {Object|null} Category object or null
 */
export const getCategoryById = (categoryId: string) => {
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
export const getTemplatesByPlatform = (platform: string) => {
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
export const getScreenshotTemplateById = (templateId: string) => {
    return (SCREENSHOT_TEMPLATES as any)[templateId] || null;
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
export const isScreenshotTemplate = (templateId: string) => {
    return templateId in SCREENSHOT_TEMPLATES;
};

/**
 * Checks if template is a favicon template
 * @param {string} templateId - Template ID to check
 * @returns {boolean} True if favicon template
 */
export const isFaviconTemplate = (templateId: string) => {
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

/**
 * Gets smart crop configuration for a template
 * @param {Object} template - Template object
 * @returns {Object} Smart crop configuration
 */
export const getTemplateSmartCropConfig = (template: TemplateConfig) => {
    const category = template.category;
    const defaultConfig = TEMPLATE_SMART_CROP_CONFIG;

    return {
        useSmartCrop: template.cropMode === 'smart',
        strategy: template.cropConfig?.strategy || (defaultConfig.DEFAULT_STRATEGIES as any)[category] || 'ai_priority',
        preserveLogos: template.cropConfig?.preserveLogos !== undefined
            ? template.cropConfig.preserveLogos
            : (defaultConfig.PRESERVE_LOGOS as any)[category] || true,
        prioritySubject: template.cropConfig?.prioritySubject || (defaultConfig.PRIORITY_SUBJECTS as any)[category] || 'person',
        minSubjectSize: template.cropConfig?.minSubjectSize || (defaultConfig.MIN_SUBJECT_SIZE as any)[category] || 0.15,
        maxPadding: template.cropConfig?.maxPadding || (defaultConfig.MAX_PADDING as any)[category] || 0.15,
        tightCrop: template.cropConfig?.tightCrop !== undefined
            ? template.cropConfig.tightCrop
            : (defaultConfig.TIGHT_CROP as any)[category] || false,
        quality: template.cropConfig?.quality || (defaultConfig.DEFAULT_QUALITY as any)[category] || 0.85,
        format: template.cropConfig?.format || (defaultConfig.DEFAULT_FORMAT as any)[category] || 'webp'
    };
};

/**
 * Gets processing options for a template
 * @param {Object} template - Template object
 * @param {Object} userOptions - User-provided options
 * @returns {Object} Complete processing options
 */
export const getTemplateProcessingOptions = (template: TemplateConfig, userOptions: any = {}) => {
    const cropConfig = getTemplateSmartCropConfig(template);

    return {
        ...userOptions,
        cropMode: template.cropMode || 'smart',
        cropPosition: 'center',
        quality: cropConfig.quality,
        format: cropConfig.format,
        templateConfig: {
            useAIDetection: template.cropMode === 'smart',
            useLogoDetection: template.cropMode === 'smart' && cropConfig.preserveLogos,
            ignoreLogos: !cropConfig.preserveLogos || cropConfig.tightCrop,
            prioritySubject: cropConfig.prioritySubject,
            minSubjectSize: cropConfig.minSubjectSize,
            maxPadding: cropConfig.maxPadding,
            tightCrop: cropConfig.tightCrop
        }
    };
};

/**
 * Gets all templates with smart crop enabled
 * @returns {Array} Templates with smart crop
 */
export const getSmartCropTemplates = () => {
    return SOCIAL_MEDIA_TEMPLATES.filter(template => template.cropMode === 'smart');
};

/**
 * Gets template by ID
 * @param {string} templateId - Template ID
 * @returns {Object|null} Template or null
 */
export const getTemplateById = (templateId: string) => {
    // Check social media templates first
    const socialMediaTemplate = SOCIAL_MEDIA_TEMPLATES.find(t => t.id === templateId);
    if (socialMediaTemplate) return socialMediaTemplate;

    // Check screenshot templates
    const screenshotTemplate = (SCREENSHOT_TEMPLATES as any)[templateId];
    if (screenshotTemplate) return screenshotTemplate;

    return null;
};

/**
 * Gets crop mode display name
 * @param {string} cropMode - Crop mode
 * @returns {string} Display name
 */
export const getCropModeDisplayName = (cropMode: string) => {
    const modes: Record<string, string> = {
        'smart': 'Smart Crop',
        'center': 'Center Crop',
        'standard': 'Standard Crop'
    };
    return modes[cropMode] || cropMode;
};

/**
 * Gets strategy display name
 * @param {string} strategy - Crop strategy
 * @returns {string} Display name
 */
export const getStrategyDisplayName = (strategy: string) => {
    const strategies: Record<string, string> = {
        'ai_priority': 'AI Priority',
        'logo_priority': 'Logo Priority',
        'focal_point': 'Focal Point',
        'hybrid': 'Hybrid',
        'center': 'Center'
    };
    return strategies[strategy] || strategy;
};

// EXPORT_SETTINGS moved to sharedConstants.ts