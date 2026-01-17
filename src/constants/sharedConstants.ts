/**
 * @file sharedConstants.ts
 * @description Shared UI and processing constants, including quality defaults, crop modes, and error messages.
 */
// ================================
// UI-Specific Constants
// ================================
export const UI_CONSTANTS = {
    BADGE_SIZE: { width: '1.5rem', height: '1.5rem' },
    MODAL_DELAYS: {
        SUCCESS: 1000,
        INFO: 5000,
        ERROR: 5000,
        SUMMARY: 10000
    },
    IMAGE_PREVIEW: {
        MAX_HEIGHT: '24rem', // h-96 equivalent
        TIFF_BADGE: {
            WIDTH: '3rem',
            HEIGHT: '2rem',
            FONT_SIZE: '0.875rem'
        }
    },
    TEXT_TRUNCATE: {
        MAX_WIDTH: '20rem' // max-w-xs equivalent
    },
    BORDER_RADIUS: {
        SM: 'var(--radius-sm)',
        MD: 'var(--radius-md)',
        LG: 'var(--radius-lg)',
        FULL: '9999px'
    }
};

// ================================
// Image Processing Constants
// ================================

export const SUPPORTED_INPUT_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/avif', 'image/tiff', 'image/bmp',
    'image/x-icon', 'image/vnd.microsoft.icon',
    'image/tif', 'application/tif', 'application/tiff',
    'image/apng'
];

export const LEGACY_FORMATS = ['image/tiff', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon'];
export const TIFF_FORMATS = ['image/tiff', 'image/tif', 'application/tif', 'application/tiff'];

// ================================
// Performance Constants
// ================================

export const IMAGE_LOAD_TIMEOUT = 30000;
export const UPSCALING_TIMEOUT = 60000;
export const MEMORY_CLEANUP_INTERVAL = 60000;
export const UPSCALER_IDLE_TIMEOUT = 300000;

export const PROCESSING_DELAYS = {
    MEMORY_CLEANUP: 50,
    BETWEEN_IMAGES: 100,
    BETWEEN_BATCHES: 500,
    AI_MODEL_LOAD: 500,
    SCREENSHOT_CAPTURE: 2000
};

// ================================
// Quality Constants
// ================================

export const DEFAULT_QUALITY = 0.85;
export const DEFAULT_COMPRESSION_QUALITY = 85;
export const DEFAULT_WEBP_QUALITY = 0.85;
export const DEFAULT_PNG_QUALITY = 0.9;
export const DEFAULT_JPG_QUALITY = 0.95;

export const COMPRESSION_QUALITY_RANGE = {
    MIN: 1,
    MAX: 100,
    DEFAULT: 85
};

// ================================
// Format Constants
// ================================


export const OUTPUT_FORMATS = [
    { id: 'webp', name: 'WebP', description: 'Modern format with excellent compression' },
    { id: 'avif', name: 'AVIF', description: 'Next-gen format with superior compression' },
    { id: 'jpg', name: 'JPEG', description: 'Standard format with good compression' },
    { id: 'png', name: 'PNG', description: 'Lossless format with transparency support' },
    { id: 'original', name: 'Original', description: 'Keep original format' }
];

export const OUTPUT_FORMAT_OPTIONS = [
    { id: 'webp', name: 'WebP' },
    { id: 'avif', name: 'AVIF' },
    { id: 'jpg', name: 'JPEG' },
    { id: 'png', name: 'PNG' },
    { id: 'original', name: 'Original' }
];

export const ALL_OUTPUT_FORMATS = ['webp', 'avif', 'jpg', 'png', 'original'];

export const MIME_TYPE_MAP: Record<string, string> = {
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
    'ico': 'image/x-icon',
    'apng': 'image/apng'
};

export const IMAGE_FORMATS = {
    WEBP: 'webp',
    AVIF: 'avif',
    JPG: 'jpg',
    JPEG: 'jpeg',
    PNG: 'png',
    ORIGINAL: 'original',
    TIFF: 'tiff',
    SVG: 'svg'
} as const;

// ================================
// Validation Constants
// ================================

export const MAX_FILENAME_LENGTH = 100;
export const MAX_TARGET_FILESIZE_KB = 100000;
export const MAX_CROP_DIMENSION = 10000;
export const MAX_RESIZE_DIMENSION = 10000;
export const FILE_NAME_MAX_LENGTH = 255;

export const CROP_DIMENSION_RANGE = {
    MIN: 1,
    MAX: MAX_CROP_DIMENSION,
    DEFAULT_WIDTH: 1080,
    DEFAULT_HEIGHT: 1080
};

export const RESIZE_DIMENSION_RANGE = {
    MIN: 1,
    MAX: MAX_RESIZE_DIMENSION,
    DEFAULT: 1080
};

export const CROP_MIN_SIZE = 50;

// eslint-disable-next-line no-control-regex
export const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

// ================================
// UI/Display Constants
// ================================

export const DEFAULT_LANGUAGE = 'en';

export const AVAILABLE_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'hr', name: 'Hrvatski' }
];

// ================================
// Processing Mode Constants
// ================================

export const PROCESSING_MODES = {
    CUSTOM: 'custom',
    TEMPLATES: 'templates',
    BATCH_RENAME: 'batch_rename'
} as const;

export const CROP_MODES = {
    SMART: 'smart',
    STANDARD: 'standard',
    CENTER: 'center'
} as const;

export const CROP_POSITIONS = {
    CENTER: 'center',
    TOP_LEFT: 'top-left',
    TOP: 'top',
    TOP_RIGHT: 'top-right',
    LEFT: 'left',
    RIGHT: 'right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM: 'bottom',
    BOTTOM_RIGHT: 'bottom-right'
} as const;

export const CROP_POSITION_LIST = [
    'center', 'top-left', 'top', 'top-right', 'left',
    'right', 'bottom-left', 'bottom', 'bottom-right'
];

export const WATERMARK_POSITIONS = {
    CENTER: 'center',
    TOP_LEFT: 'top-left',
    TOP: 'top',
    TOP_RIGHT: 'top-right',
    LEFT: 'left',
    RIGHT: 'right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM: 'bottom',
    BOTTOM_RIGHT: 'bottom-right'
} as const;

export const WATERMARK_SIZES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    EXTRA_LARGE: 'extra-large'
} as const;

export const CROP_MARGIN = 10;

// ================================
// App-specific Constants
// ================================

export const DEFAULT_CROP_POSITION = 'center';

export const MODAL_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    SUMMARY: 'summary'
} as const;

export const DEFAULT_PROCESSING_CONFIG = {
    compression: {
        quality: 85,
        fileSize: ''
    },
    output: {
        formats: ['webp'],
        quality: 85,
        rename: false,
        newFileName: ''
    },
    resizeDimension: '',
    cropWidth: '',
    cropHeight: '',
    showResize: true,
    showCrop: false,
    showTemplates: false,
    selectedTemplates: [],
    processingMode: PROCESSING_MODES.CUSTOM,
    templateSelectedImage: null,
    smartCrop: false,
    cropMode: CROP_MODES.SMART,
    cropPosition: DEFAULT_CROP_POSITION,
    faviconSiteName: 'My Website',
    faviconThemeColor: '#ffffff',
    faviconBackgroundColor: '#ffffff',
    faviconMode: 'basic',
    filters: {
        enabled: true,
        selectedFilter: 'none'
    },
    watermark: {
        enabled: false,
        type: 'text' as const,
        text: 'LEMGENDA',
        image: null,
        position: 'bottom-right',
        opacity: 0.5,
        size: 'medium' as const,
        color: '#ffffff',
        fontSize: 24
    }
};

export const EXPORT_SETTINGS = {
    CUSTOM: 'custom',
    TEMPLATES: 'templates',
    DEFAULT_ZIP_NAME_CUSTOM: 'LemGendizedImages',
    DEFAULT_ZIP_NAME_TEMPLATES: 'LemGendizedTemplates',
    DEFAULT_ZIP_NAME_SCREENSHOTS: 'LemGendizedScreenshots'
};

export const URL_CONSTANTS = {
    DEFAULT_PROTOCOL: 'https://',
    MAX_URL_LENGTH: 2048,
    PLACEHOLDER: 'example.com or https://example.com',
    VALID_PATTERN: /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?$/
};

export const NUMBER_INPUT_CONSTANTS = {
    DEFAULT_INCREMENT: 1,
    LARGE_INCREMENT: 10,
    MIN_VALUE: 1,
    MAX_VALUE: 10000
};

// ================================
// Screenshot Constants
// ================================
export const BROWSERLESS_BASE_URL = 'https://production-lon.browserless.io';

export const API_TOKEN = import.meta.env.VITE_BROWSERLESS_API_TOKEN || '';


export const DEFAULT_SCREENSHOT_TIMEOUT = 45000;
export const MAX_CONCURRENT_SCREENSHOTS = 2;
export const MAX_SCREENSHOT_SIZE = 800;

// ================================
// Screenshot Quality & Config
// ================================
export const SCREENSHOT_QUALITY = {
    JPEG_QUALITY: 80,
    TIMEOUT: 15000,
    PAGE_LOAD_TIMEOUT: 10000
};

export const DEVICE_VIEWPORTS = {
    MOBILE: { width: 375, height: 667 },
    TABLET: { width: 768, height: 1024 },
    DESKTOP: { width: 1280, height: 720 },
    DESKTOP_HD: { width: 1920, height: 1080 }
};

// ================================
// Operation Names
// ================================

export const OPERATION_NAMES = {
    RESIZED: 'Resized',
    CROPPED: 'Cropped',
    AI_CROPPED: 'AI Smart Cropped',
    COMPRESSED: 'Compressed',
    RENAMED: 'Renamed',
    AUTO_UPSCALED: 'Auto-upscaled',
    TEMPLATES_APPLIED: 'Templates Applied',
    FAVICONS_GENERATED: 'Favicons Generated',
    SCREENSHOTS_GENERATED: 'Screenshots Generated'
};

// ================================
// Error Messages
// ================================

export const ERROR_MESSAGES = {
    NO_IMAGE_SELECTED: 'No image selected for processing',
    NO_TEMPLATES_SELECTED: 'No templates selected',
    NO_VALID_TEMPLATES: 'No valid templates found after filtering',
    INVALID_IMAGE_FILE: 'Invalid image file provided',
    IMAGE_LOAD_FAILED: 'Failed to load image',
    IMAGE_LOAD_TIMEOUT: 'Image load timeout',
    PROCESSING_ERROR: 'Processing error',
    UPSCALING_FAILED: 'Upscaling failed',
    TIFF_CONVERSION_FAILED: 'TIFF conversion failed',
    SVG_CONVERSION_FAILED: 'SVG conversion failed',
    FAVICON_GENERATION_FAILED: 'Favicon generation failed',
    SCREENSHOT_CAPTURE_FAILED: 'Failed to capture screenshots. The website might be blocking automated access or the URL is invalid.',
    SCREENSHOT_URL_REQUIRED: 'Please enter a website URL for screenshots.',
    SCREENSHOT_URL_INVALID: 'Please enter a valid website URL (e.g., example.com or https://example.com).',
    SCREENSHOT_SERVICE_UNAVAILABLE: 'Screenshot service is temporarily unavailable. Please try again later.',
    MODEL_LOAD_FAILED: 'Failed to load AI model'
};

// ================================
// Default Settings
// ================================

export const DEFAULT_SETTINGS = {
    processing: {
        mode: 'custom',
        quality: 0.85,
        format: 'webp',
        preserveMetadata: true,
        autoUpscale: true,
        smartCrop: true
    },
    export: {
        createFolders: true,
        includeOriginals: true,
        includeProcessed: true
    }
};

// ================================
// Device Presets
// ================================

export const DEVICE_PRESETS = {
    mobile: {
        name: 'Mobile',
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    },
    tablet: {
        name: 'Tablet',
        viewport: { width: 768, height: 1024 },
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    },
    desktop: {
        name: 'Desktop',
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    }
};

// ================================
// Browser Launch Arguments
// ================================

export const BROWSER_LAUNCH_ARGS = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-features=VizDisplayCompositor',
    '--max-old-space-size=512'
];

// ================================
// Animation & Transition Constants
// ================================

export const ANIMATION_DURATIONS = {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
    MODAL_CLOSE_SUCCESS: 1000,
    MODAL_CLOSE_INFO: 3000,
    MODAL_CLOSE_ERROR: 3000,
    MODAL_CLOSE_SUMMARY: 5000
};

// ================================
// Spacing Constants
// ================================

export const SPACING = {
    XS: 'var(--space-xs)',
    SM: 'var(--space-sm)',
    MD: 'var(--space-md)',
    LG: 'var(--space-lg)',
    XL: 'var(--space-xl)',
    XXL: 'var(--space-xxl)'
};

// ================================
// Border Radius Constants
// ================================

export const BORDER_RADIUS = {
    SM: 'var(--radius-sm)',
    MD: 'var(--radius-md)',
    LG: 'var(--radius-lg)'
};

// ================================
// Shadow Constants
// ================================

export const SHADOWS = {
    SM: 'var(--shadow-sm)',
    MD: 'var(--shadow-md)',
    LG: 'var(--shadow-lg)'
};

// ================================
// Transition Constants
// ================================

export const TRANSITIONS = {
    FAST: 'var(--transition-fast)',
    NORMAL: 'var(--transition-normal)',
    SLOW: 'var(--transition-slow)'
};

// ================================
// NEW CONSTANTS: Sampling constants
// ================================

export const SAMPLING_CONSTANTS = {
    MAX_SAMPLE_SIZE: 1000,
    SAMPLING_WIDTH: 100,
    SAMPLING_HEIGHT: 100,
    CHECK_PIXELS_COUNT: 1000000,
    STRIDE_SMALL: 1,
    STRIDE_MEDIUM: 2,
    STRIDE_LARGE: 4
};

// ================================
// NEW CONSTANTS: Temporary file names
// ================================

export const TEMP_FILE_NAMES = {
    RESIZED: 'resized-temp.webp',
    CONVERTED_TIFF: 'converted-tiff.png',
    CONVERTED_SVG: 'svg-converted.png',
    ERROR: 'error.webp'
};

// ================================
// NEW CONSTANTS: File type names
// ================================

export const FILE_TYPE_NAMES = {
    TIFF: 'TIFF',
    BMP: 'BMP',
    ICO: 'ICO',
    SVG: 'SVG',
    WEBP: 'WebP',
    AVIF: 'AVIF',
    PNG: 'PNG',
    JPEG: 'JPEG',
    GIF: 'GIF',
    APNG: 'APNG'
};

// ================================
// NEW CONSTANTS: File extensions
// ================================

export const FILE_EXTENSIONS = {
    TIFF: ['.tiff', '.tif'],
    BMP: ['.bmp'],
    ICO: ['.ico'],
    SVG: ['.svg'],
    WEBP: ['.webp'],
    AVIF: ['.avif'],
    PNG: ['.png'],
    JPEG: ['.jpg', '.jpeg'],
    GIF: ['.gif'],
    APNG: ['.apng']
};

// ================================
// NEW CONSTANTS: SVG XML template
// ================================

export const SVG_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="{width}"
     height="{height}"
     viewBox="0 0 {width} {height}">{content}</svg>`;

// ================================
// NEW CONSTANTS: Processing thresholds
// ================================

export const PROCESSING_THRESHOLDS = {
    LARGE_FILE_SIZE: 1000000, // 1MB
    HUGE_FILE_SIZE: 5000000,  // 5MB
    MAX_FILE_SIZE_PREVIEW: 500000, // 500KB
    EDGE_DETECTION_THRESHOLD: 30,
    TRANSPARENCY_CHECK_PIXELS: 250000,
    DEFAULT_SCALE_FACTOR: 2,
    MIN_PADDING_PERCENT: 0.1, // 10%
    MAX_PADDING_PERCENT: 0.2, // 20%
    FOCAL_POINT_THRESHOLD: 0.3, // 30%
    MAX_PIXELS_FOR_SMART_SHARPENING: 2073600 // 1920x1080
};

// ================================
// NEW CONSTANTS: Color detection
// ================================

export const COLOR_DETECTION = {
    LUMINANCE_RED: 0.299,
    LUMINANCE_GREEN: 0.587,
    LUMINANCE_BLUE: 0.114,
    LIGHT_LUMINANCE_THRESHOLD: 0.5
};

// ================================
// NEW CONSTANTS: Processing errors
// ================================

export const PROCESSING_ERRORS = {
    INVALID_SVG_CONTENT: 'Empty or invalid SVG content',
    BLOB_CREATION_FAILED: 'Failed to create blob',
    INVALID_IMAGE_DIMENSIONS: 'Image has invalid dimensions',
    OBJECT_URL_FAILED: 'Failed to create object URL for image',
    TIFF_NO_DATA: 'No TIFF data found',
    DECODE_FAILED: 'Failed to decode image',
    SVG_PARSE_FAILED: 'Failed to parse SVG',
    CONVERSION_FAILED: 'Format conversion failed',
    PLACEHOLDER_FAILED: 'Failed to create placeholder'
};

// ================================
// Application Configuration (GENERAL ONLY)
// ================================

export const APP_CONFIG = {
    // General application configuration
    TEMPLATES: {
        DEFAULT_TIMESTAMP: Date.now(),
        BASE_NAME_SEPARATOR: '-',
        FORMAT_SEPARATOR: '.'
    },
    ERROR_HANDLING: {
        MAX_ERROR_LENGTH: 1000,
        DEFAULT_ERROR_PREFIX: 'error',
        ERROR_FILE_EXTENSION: '.txt'
    },
    FILE_NAMING: {
        DEFAULT_BASE_NAME: 'image',
        DEFAULT_ERROR_NAME: 'error',
        DEFAULT_TEMPLATE_NAME: 'template',
        NAME_SEPARATOR: '-'
    },
    IMAGE_DEFAULTS: {
        DEFAULT_FORMAT: 'webp',
        DEFAULT_QUALITY: 0.85,
        DEFAULT_WIDTH: 800,
        DEFAULT_HEIGHT: 600,
        DEFAULT_BACKGROUND: '#ffffff',
        DEFAULT_THEME_COLOR: '#ffffff'
    }
};
