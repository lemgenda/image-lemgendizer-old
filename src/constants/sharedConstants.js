// ================================
// Image Processing Constants
// ================================

export const MAX_TEXTURE_SIZE = 16384;
export const MAX_SAFE_DIMENSION = 4096;
export const MAX_TOTAL_PIXELS = 16777216;
export const MAX_TOTAL_PIXELS_FOR_AI = 8000000;
export const MAX_SCALE_FACTOR = 4;
export const MAX_PIXELS_FOR_SMART_SHARPENING = 4194304;
export const MAX_DIMENSION_FOR_AI = 3000;
export const LARGE_IMAGE_THRESHOLD = 4000000;
export const MIN_IMAGE_SIZE = 1;
export const MAX_IMAGE_SIZE = 10000000;

export const SUPPORTED_INPUT_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/avif', 'image/tiff', 'image/bmp',
    'image/x-icon', 'image/vnd.microsoft.icon',
    'image/tif', 'application/tif', 'application/tiff',
    'image/apng'
];

export const LEGACY_FORMATS = ['image/tiff', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon'];
export const TIFF_FORMATS = ['image/tiff', 'image/tif', 'application/tif', 'application/tiff'];

export const MAX_TEXTURE_FAILURES = 3;

// ================================
// AI/GPU Constants
// ================================

export const AVAILABLE_UPSCALE_FACTORS = [2, 3, 4, 8];
export const TILE_SIZE = 2048;

export const AI_SETTINGS = {
    MIN_CONFIDENCE: 0.3,
    FACE_DETECTION_ENABLED: true,
    OBJECT_DETECTION_ENABLED: true,
    DEFAULT_CROP_STRATEGY: 'balanced',
    MAX_OBJECTS: 10,
    MODEL_TYPE: 'lite_mobilenet_v2',
    TENSORFLOW_VERSION: '4.10.0',
    COCO_SSD_VERSION: '2.2.3'
};

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

export const DEFAULT_OUTPUT_FORMATS = ['webp'];

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
    TIFF: 'tiff'
};

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

export const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

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
    TEMPLATES: 'templates'
};

export const CROP_MODES = {
    SMART: 'smart',
    STANDARD: 'standard'
};

export const CROP_POSITIONS = [
    'center', 'top-left', 'top', 'top-right', 'left',
    'right', 'bottom-left', 'bottom', 'bottom-right'
];

export const CROP_MARGIN = 10;

// ================================
// App-specific Constants
// ================================

export const DEFAULT_CROP_POSITION = 'center';

export const MODAL_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error',
    SUMMARY: 'summary'
};

export const DEFAULT_PROCESSING_CONFIG = {
    compression: {
        quality: 85,
        fileSize: ''
    },
    output: {
        formats: ['webp'],
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
    processingMode: 'custom',
    templateSelectedImage: null,
    smartCrop: false,
    cropMode: 'smart',
    cropPosition: 'center',
    faviconSiteName: 'My Website',
    faviconThemeColor: '#ffffff',
    faviconBackgroundColor: '#ffffff'
};

export const EXPORT_SETTINGS = {
    CUSTOM: 'custom',
    TEMPLATES: 'templates',
    DEFAULT_ZIP_NAME_CUSTOM: 'LemGendizedImages',
    DEFAULT_ZIP_NAME_TEMPLATES: 'LemGendizedTemplates'
};

export const URL_CONSTANTS = {
    DEFAULT_PROTOCOL: 'https://',
    MAX_URL_LENGTH: 2048
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

export const VERCEL_ENDPOINTS = [
    {
        url: 'https://image-lemgendizer-old-x2qz.vercel.app/api/screenshot',
        priority: 1,
        lastUsed: 0,
        healthUrls: [
            'https://image-lemgendizer-old-x2qz.vercel.app/api/health'
        ]
    },
    {
        url: 'http://localhost:3000/api/screenshot',
        priority: 2,
        lastUsed: 0,
        healthUrls: [
            'http://localhost:3000/api/health'
        ]
    }
];

export const CACHE_CONFIG = {
    LOCALSTORAGE_TTL: 7 * 24 * 60 * 60 * 1000,
    MEMORY_TTL: 30 * 60 * 1000,
    MAX_MEMORY_ENTRIES: 50
};

export const DEFAULT_SCREENSHOT_TIMEOUT = 45000;
export const MAX_CONCURRENT_SCREENSHOTS = 2;
export const MAX_SCREENSHOT_SIZE = 800;

// ================================
// Color Constants
// ================================

export const DEFAULT_THEME_COLOR = '#ffffff';
export const DEFAULT_BACKGROUND_COLOR = '#ffffff';
export const ERROR_BACKGROUND_COLOR = '#f8d7da';
export const ERROR_BORDER_COLOR = '#f5c6cb';
export const ERROR_TEXT_COLOR = '#721c24';
export const WARNING_TEXT_COLOR = '#856404';
export const PLACEHOLDER_BACKGROUND = '#f8f9fa';
export const PLACEHOLDER_BORDER = '#dee2e6';
export const PLACEHOLDER_TEXT = '#495057';
export const SUCCESS_COLOR = '#28a745';
export const INFO_COLOR = '#4a90e2';

// ================================
// Font Constants
// ================================

export const DEFAULT_FONT_FAMILY = 'Arial, sans-serif';
export const HEADLINE_FONT_SIZE = 24;
export const BODY_FONT_SIZE = 16;
export const CAPTION_FONT_SIZE = 12;

// ================================
// SVG Constants
// ================================

export const SVG_DEFAULT_WIDTH = 100;
export const SVG_DEFAULT_HEIGHT = 100;
export const SVG_MIN_SIZE = 1;
export const SVG_MAX_SIZE = 4096;

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
    SCREENSHOT_CAPTURE_FAILED: 'Screenshot capture failed',
    FAVICON_GENERATION_FAILED: 'Favicon generation failed'
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
// Screenshot Quality Settings
// ================================

export const SCREENSHOT_QUALITY = {
    JPEG_QUALITY: 80,
    TIMEOUT: 15000,
    PAGE_LOAD_TIMEOUT: 10000
};