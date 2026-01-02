// imageConstants.js - Image processing specific constants
// NO THEME DEPENDENCY - standalone constants only

// ================================
// Dimension & Size Limits
// ================================
export const IMAGE_SIZE_CONSTANTS = {
    MAX_TEXTURE_SIZE: 16384,
    MAX_SAFE_DIMENSION: 4096,
    MAX_TOTAL_PIXELS: 16777216,
    MAX_TOTAL_PIXELS_FOR_AI: 8000000,
    MAX_SCALE_FACTOR: 4,
    MAX_PIXELS_FOR_SMART_SHARPENING: 4194304,
    MAX_DIMENSION_FOR_AI: 3000,
    LARGE_IMAGE_THRESHOLD: 4000000,
    MIN_IMAGE_SIZE: 1,
    MAX_IMAGE_SIZE: 10000000,
    MAX_TEXTURE_FAILURES: 3,
    TILE_SIZE: 2048,
    AVAILABLE_UPSCALE_FACTORS: [2, 3, 4]
};

// Individual exports for convenience
export const MAX_TEXTURE_SIZE = IMAGE_SIZE_CONSTANTS.MAX_TEXTURE_SIZE;
export const MAX_SAFE_DIMENSION = IMAGE_SIZE_CONSTANTS.MAX_SAFE_DIMENSION;
export const MAX_TOTAL_PIXELS = IMAGE_SIZE_CONSTANTS.MAX_TOTAL_PIXELS;
export const MAX_TOTAL_PIXELS_FOR_AI = IMAGE_SIZE_CONSTANTS.MAX_TOTAL_PIXELS_FOR_AI;
export const MAX_SCALE_FACTOR = IMAGE_SIZE_CONSTANTS.MAX_SCALE_FACTOR;
export const MAX_PIXELS_FOR_SMART_SHARPENING = IMAGE_SIZE_CONSTANTS.MAX_PIXELS_FOR_SMART_SHARPENING;
export const MAX_DIMENSION_FOR_AI = IMAGE_SIZE_CONSTANTS.MAX_DIMENSION_FOR_AI;
export const LARGE_IMAGE_THRESHOLD = IMAGE_SIZE_CONSTANTS.LARGE_IMAGE_THRESHOLD;
export const MIN_IMAGE_SIZE = IMAGE_SIZE_CONSTANTS.MIN_IMAGE_SIZE;
export const MAX_IMAGE_SIZE = IMAGE_SIZE_CONSTANTS.MAX_IMAGE_SIZE;
export const MAX_TEXTURE_FAILURES = IMAGE_SIZE_CONSTANTS.MAX_TEXTURE_FAILURES; // SINGLE SOURCE OF TRUTH
export const TILE_SIZE = IMAGE_SIZE_CONSTANTS.TILE_SIZE;
export const AVAILABLE_UPSCALE_FACTORS = IMAGE_SIZE_CONSTANTS.AVAILABLE_UPSCALE_FACTORS;

// ================================
// SVG Constants
// ================================
export const SVG_CONSTANTS = {
    DEFAULT_WIDTH: 100,
    DEFAULT_HEIGHT: 100,
    MIN_SIZE: 1,
    MAX_SIZE: 4096
};

// ================================
// Font Constants (consolidated here)
// ================================
export const FONT_CONSTANTS = {
    HEADLINE_FONT_SIZE: 24,
    BODY_FONT_SIZE: 16,
    CAPTION_FONT_SIZE: 12,
    DEFAULT_FONT_FAMILY: 'Arial, sans-serif'
};

// ================================
// Image Processing Color Constants
// ================================

// Image-specific colors (standalone, not theme-dependent)
export const IMAGE_COLORS = {
    // Error/Warning colors
    ERROR_BACKGROUND: '#7f1d1d',
    ERROR_BORDER: '#991b1b',
    ERROR_TEXT: '#fecaca',
    WARNING_TEXT: '#fde68a',

    // Status colors
    SUCCESS: '#10b981',
    INFO: '#0ea5e9',
    ERROR: '#ef4444',
    WARNING: '#f59e0b',

    // Background colors
    DEFAULT_BACKGROUND: '#ffffff',

    // Placeholder colors
    PLACEHOLDER_BACKGROUND: '#f8f9fa',
    PLACEHOLDER_BORDER: '#dee2e6',
    PLACEHOLDER_TEXT: '#495057'
};

// ================================
// Image Processing Defaults
// ================================
export const IMAGE_PROCESSING_DEFAULTS = {
    MAX_RETRIES: 3,
    TIMEOUT: 30000,
    CHUNK_SIZE: 1024 * 1024, // 1MB
    MAX_CONCURRENT: 2
};

// ================================
// Format Support
// ================================
export const FORMAT_SUPPORT = {
    WEBP: true,
    AVIF: false, // Will be detected at runtime
    PNG: true,
    JPEG: true,
    GIF: true,
    SVG: true,
    TIFF: false // Needs conversion
};

// ================================
// Helper Functions (standalone, no theme dependency)
// ================================

/**
 * Checks if a color is light or dark
 * @param {string} color - Hex color
 * @returns {boolean} True if light, false if dark
 */
export const isLightColor = (color) => {
    if (!color) return false;

    // Remove # if present
    const hex = color.replace('#', '');

    // Parse RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5;
};

/**
 * Gets contrasting text color for a background
 * @param {string} backgroundColor - Background color
 * @returns {string} Contrasting text color
 */
export const getContrastColor = (backgroundColor) => {
    return isLightColor(backgroundColor) ? '#000000' : '#ffffff';
};

/**
 * Gets all image processing colors
 * @returns {Object} All image processing colors
 */
export const getImageColors = () => {
    return { ...IMAGE_COLORS };
};