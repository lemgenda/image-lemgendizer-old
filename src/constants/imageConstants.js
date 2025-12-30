// imageConstants.js - Image processing specific constants
// NO THEME DEPENDENCY - standalone constants only

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