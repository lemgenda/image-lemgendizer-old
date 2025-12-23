// ================================
// Image Processing Constants
// ================================

/**
 * Maximum texture size supported by GPU in pixels
 * @constant {number}
 * @default 16384
 */
export const MAX_TEXTURE_SIZE = 16384;

/**
 * Maximum safe dimension for processing in pixels
 * Used to prevent memory overflow during image operations
 * @constant {number}
 * @default 4096
 */
export const MAX_SAFE_DIMENSION = 4096;

/**
 * Maximum total pixels for safe processing
 * Prevents processing images that would consume too much memory
 * @constant {number}
 * @default 16000000
 */
export const MAX_TOTAL_PIXELS = 16000000;

/**
 * Maximum total pixels for AI processing (8 megapixels)
 * Limits AI operations to maintain performance
 * @constant {number}
 * @default 8000000
 */
export const MAX_TOTAL_PIXELS_FOR_AI = 8000000;

/**
 * Maximum scale factor for upscaling operations
 * Prevents excessive upscaling that could cause quality issues
 * @constant {number}
 * @default 4
 */
export const MAX_SCALE_FACTOR = 4;

/**
 * Maximum pixels for smart sharpening operations
 * Prevents performance issues with large images
 * @constant {number}
 * @default 4000000
 */
export const MAX_PIXELS_FOR_SMART_SHARPENING = 4000000;

/**
 * Maximum dimension for AI processing in pixels
 * Increased from 2000 to 3000 for better AI performance
 * @constant {number}
 * @default 3000
 */
export const MAX_DIMENSION_FOR_AI = 3000;

/**
 * Large image threshold for template processing
 * Images larger than this will use simpler processing
 * @constant {number}
 * @default 4000000
 */
export const LARGE_IMAGE_THRESHOLD = 4000000;

/**
 * Supported input image MIME types and formats
 * @constant {string[]}
 */
export const SUPPORTED_INPUT_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/avif', 'image/tiff', 'image/bmp',
    'image/x-icon', 'image/vnd.microsoft.icon',
    'image/tif', 'application/tif', 'application/tiff'
];

/**
 * Legacy image formats that require conversion to modern formats
 * Includes TIFF, BMP, and ICO formats
 * @constant {string[]}
 */
export const LEGACY_FORMATS = ['image/tiff', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon'];

/**
 * TIFF format identifiers for detection
 * @constant {string[]}
 */
export const TIFF_FORMATS = ['image/tiff', 'image/tif', 'application/tif', 'application/tiff'];

/**
 * Maximum texture failures before disabling AI upscaling
 * Prevents repeated failures from degrading user experience
 * @constant {number}
 * @default 3
 */
export const MAX_TEXTURE_FAILURES = 3;

// ================================
// AI/GPU Constants
// ================================

/**
 * Available upscale factors for AI upscaling
 * Supported scales: 2x, 3x, 4x
 * @constant {number[]}
 */
export const AVAILABLE_UPSCALE_FACTORS = [2, 3, 4];

/**
 * Tile size in pixels for processing large images
 * Used to prevent memory overflow when processing very large images
 * @constant {number}
 * @default 2048
 */
export const TILE_SIZE = 2048;

/**
 * AI model settings
 * @constant {Object}
 */
export const AI_SETTINGS = {
    MIN_CONFIDENCE: 0.3,
    FACE_DETECTION_ENABLED: true,
    OBJECT_DETECTION_ENABLED: true,
    DEFAULT_CROP_STRATEGY: 'balanced'
};

// ================================
// Performance Constants
// ================================

/**
 * Image loading timeout in milliseconds
 * Prevents hanging on corrupted or extremely large images
 * @constant {number}
 * @default 30000
 */
export const IMAGE_LOAD_TIMEOUT = 30000;

/**
 * AI upscaling timeout in milliseconds
 * Longer timeout for complex AI operations
 * @constant {number}
 * @default 45000
 */
export const UPSCALING_TIMEOUT = 45000;

/**
 * Memory cleanup interval in milliseconds
 * How often to check and clean up GPU memory
 * @constant {number}
 * @default 10000
 */
export const MEMORY_CLEANUP_INTERVAL = 10000;

/**
 * Upscaler idle timeout in milliseconds before cleanup
 * Removes unused upscaler models from memory
 * @constant {number}
 * @default 30000
 */
export const UPSCALER_IDLE_TIMEOUT = 30000;

/**
 * Processing delays for better UI responsiveness
 * @constant {Object}
 */
export const PROCESSING_DELAYS = {
    BETWEEN_IMAGES: 100,
    BETWEEN_BATCHES: 500,
    MEMORY_CLEANUP: 50
};

// ================================
// Quality Constants
// ================================

/**
 * Default compression quality (0-1 scale)
 * Used when no specific quality is provided
 * @constant {number}
 * @default 0.85
 */
export const DEFAULT_QUALITY = 0.85;

/**
 * Default compression quality percentage (1-100 scale)
 * Used in UI components
 * @constant {number}
 * @default 85
 */
export const DEFAULT_COMPRESSION_QUALITY = 85;

/**
 * Compression quality range
 * @constant {Object}
 */
export const COMPRESSION_QUALITY_RANGE = {
    MIN: 1,
    MAX: 100,
    DEFAULT: 85
};

/**
 * Default WebP compression quality (0-1 scale)
 * Optimized for good quality/size ratio
 * @constant {number}
 * @default 0.85
 */
export const DEFAULT_WEBP_QUALITY = 0.85;

/**
 * Default PNG compression quality (0-1 scale)
 * Higher quality for lossless format
 * @constant {number}
 * @default 0.9
 */
export const DEFAULT_PNG_QUALITY = 0.9;

// ================================
// Format Constants
// ================================

/**
 * Default output formats
 * @constant {string[]}
 */
export const DEFAULT_OUTPUT_FORMATS = ['webp'];

/**
 * Available output formats with descriptions for UI display
 * @constant {Array<{id: string, name: string, description: string}>}
 */
export const OUTPUT_FORMATS = [
    { id: 'webp', name: 'WebP', description: 'Modern format with excellent compression' },
    { id: 'avif', name: 'AVIF', description: 'Next-gen format with superior compression' },
    { id: 'jpg', name: 'JPEG', description: 'Standard format with good compression' },
    { id: 'png', name: 'PNG', description: 'Lossless format with transparency support' },
    { id: 'original', name: 'Original', description: 'Keep original format' }
];

/**
 * Output format options for UI selection
 * @constant {Array<{id: string, name: string}>}
 */
export const OUTPUT_FORMAT_OPTIONS = [
    { id: 'webp', name: 'WebP' },
    { id: 'avif', name: 'AVIF' },
    { id: 'jpg', name: 'JPEG' },
    { id: 'png', name: 'PNG' },
    { id: 'original', name: 'Original' }
];

/**
 * MIME type mappings for file extensions
 * Used for proper content-type headers and format detection
 * @constant {Object.<string, string>}
 */
export const MIME_TYPE_MAP = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon'
};

// ================================
// Validation Constants
// ================================

/**
 * Maximum filename length in characters
 * Prevents excessively long filenames
 * @constant {number}
 * @default 100
 */
export const MAX_FILENAME_LENGTH = 100;

/**
 * Maximum target file size in kilobytes (100MB)
 * Safety limit for file size operations
 * @constant {number}
 * @default 100000
 */
export const MAX_TARGET_FILESIZE_KB = 100000;

/**
 * Maximum crop dimension in pixels
 * Prevents unrealistic crop sizes
 * @constant {number}
 * @default 10000
 */
export const MAX_CROP_DIMENSION = 10000;

/**
 * Crop dimension range
 * @constant {Object}
 */
export const CROP_DIMENSION_RANGE = {
    MIN: 1,
    MAX: MAX_CROP_DIMENSION,
    DEFAULT_WIDTH: 1080,
    DEFAULT_HEIGHT: 1080
};

/**
 * Maximum resize dimension in pixels
 * Prevents unrealistic resize operations
 * @constant {number}
 * @default 10000
 */
export const MAX_RESIZE_DIMENSION = 10000;

/**
 * Resize dimension range
 * @constant {Object}
 */
export const RESIZE_DIMENSION_RANGE = {
    MIN: 1,
    MAX: MAX_RESIZE_DIMENSION,
    DEFAULT: 1080
};

/**
 * Regex pattern for invalid filename characters
 * Matches characters not allowed in filenames
 * @constant {RegExp}
 */
export const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

// ================================
// UI/Display Constants
// ================================

/**
 * Default language code for the application
 * @constant {string}
 * @default 'en'
 */
export const DEFAULT_LANGUAGE = 'en';

/**
 * Available languages for the application UI
 * @constant {Array<{code: string, name: string, flag: string}>}
 */
export const AVAILABLE_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' }
];

// ================================
// Processing Mode Constants
// ================================

/**
 * Processing mode enumeration
 * @constant {Object}
 * @property {string} CUSTOM - Custom image processing
 * @property {string} TEMPLATES - Template-based processing
 */
export const PROCESSING_MODES = {
    CUSTOM: 'custom',
    TEMPLATES: 'templates'
};

/**
 * Crop mode enumeration
 * @constant {Object}
 * @property {string} SMART - AI-powered smart cropping
 * @property {string} STANDARD - Standard rule-based cropping
 */
export const CROP_MODES = {
    SMART: 'smart',
    STANDARD: 'standard'
};

/**
 * Available crop positions for manual cropping
 * @constant {string[]}
 */
export const CROP_POSITIONS = [
    'center', 'top-left', 'top', 'top-right', 'left',
    'right', 'bottom-left', 'bottom', 'bottom-right'
];

/**
 * Default margin for crop operations in pixels
 * Prevents cropping too close to image edges
 * @constant {number}
 * @default 10
 */
export const CROP_MARGIN = 10;

// ================================
// Export Constants
// ================================

/**
 * Export folder names for organized file structure
 * @constant {Object}
 */
export const EXPORT_FOLDERS = {
    ORIGINAL_IMAGES: 'OriginalImages',
    OPTIMIZED_IMAGES: 'OptimizedImages',
    WEB_IMAGES: 'WebImages',
    LOGO_IMAGES: 'LogoImages',
    SOCIAL_MEDIA_IMAGES: 'SocialMediaImages'
};

/**
 * Social media platform names for organized export
 * @constant {Object}
 */
export const PLATFORM_NAMES = {
    INSTAGRAM: 'Instagram',
    FACEBOOK: 'Facebook',
    TWITTER_X: 'Twitter/X',
    LINKEDIN: 'LinkedIn',
    YOUTUBE: 'YouTube',
    PINTEREST: 'Pinterest',
    TIKTOK: 'TikTok'
};

/**
 * Template names for different social media platforms
 * @constant {Object}
 */
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
    ]
};

/**
 * Template categories for organization
 * @constant {Object}
 */
export const TEMPLATE_CATEGORIES = {
    WEB: 'web',
    LOGO: 'logo',
    SOCIAL_MEDIA: 'social_media',
    FAVICON: 'favicon',
    SCREENSHOTS: 'screenshots'
};