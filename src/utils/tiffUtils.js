import UTIF from 'utif';
import {
    IMAGE_COLORS,
    FONT_CONSTANTS,
    DEFAULT_PNG_QUALITY,
    ERROR_MESSAGES,
    TEMP_FILE_NAMES,
    FILE_TYPE_NAMES,
    PROCESSING_ERRORS,
    MAX_SCREENSHOT_SIZE,
    TIFF_FORMATS,
    FILE_EXTENSIONS,
    IMAGE_FORMATS,
    CROP_MARGIN
} from '../constants';

import { APP_TEMPLATE_CONFIG, DEFAULT_PLACEHOLDER_DIMENSIONS } from '../configs/templateConfigs';

// Add UTIF to window if not already available
if (!window.UTIF) {
    window.UTIF = UTIF;
}

/**
 * Creates a regex pattern for TIFF file extensions
 * @returns {RegExp} Regex pattern for TIFF file extensions
 */
const getTIFFExtensionPattern = () => {
    const tiffExtensions = FILE_EXTENSIONS.TIFF.map(ext => ext.replace('.', ''));
    return new RegExp(`\\.(${tiffExtensions.join('|')})$`, 'i');
};

/**
 * Creates a regex pattern for TIFF file names
 * @returns {RegExp} Regex pattern for TIFF file names
 */
const getTIFFFileNamePattern = () => {
    const tiffExtensions = FILE_EXTENSIONS.TIFF.map(ext => ext.replace('.', ''));
    return new RegExp(`(${tiffExtensions.join('|')})$`, 'i');
};

/**
 * Checks if a file is a TIFF file
 * @param {File} file - File to check
 * @returns {boolean} True if file is TIFF
 */
const isTIFFFile = (file) => {
    if (!file || !file.name) return false;

    const fileName = file.name.toLowerCase();
    const mimeType = file.type?.toLowerCase() || '';

    // Check by MIME type
    if (mimeType && TIFF_FORMATS.includes(mimeType)) {
        return true;
    }

    // Check by file extension
    return FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
};

/**
 * Loads UTIF library from CDN if not already available
 * @returns {Promise<boolean>} True if UTIF loaded successfully
 */
export const loadUTIFLibrary = () => {
    return new Promise((resolve) => {
        if (window.UTIF) {
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/utif@3.0.0/UTIF.min.js';
        script.onload = () => {
            if (window.UTIF && typeof window.UTIF.decode === 'function') {
                resolve(true);
            } else {
                resolve(false);
            }
        };
        script.onerror = () => {
            resolve(false);
        };
        document.head.appendChild(script);
    });
};

/**
 * Converts TIFF using UTIF with robust error handling
 * @param {File} tiffFile - TIFF file to convert
 * @returns {Promise<File>} Converted PNG file
 */
export const convertTIFFWithUTIF = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;

                let ifds;
                try {
                    ifds = window.UTIF.decode(arrayBuffer);
                    if (!ifds || ifds.length === 0) {
                        throw new Error(PROCESSING_ERRORS.TIFF_NO_DATA);
                    }
                } catch (decodeError) {
                    reject(new Error(`${ERROR_MESSAGES.TIFF_CONVERSION_FAILED}: ${decodeError.message}`));
                    return;
                }

                const firstIFD = ifds[0];

                let decodeSuccess = false;
                try {
                    if (window.UTIF.decodeImage) {
                        window.UTIF.decodeImage(arrayBuffer, firstIFD);
                        decodeSuccess = true;
                    } else if (window.UTIF.decodeImages) {
                        window.UTIF.decodeImages(arrayBuffer, ifds);
                        decodeSuccess = true;
                    }
                } catch (imageDecodeError) {
                    // Continue with placeholder
                }

                let width = DEFAULT_PLACEHOLDER_DIMENSIONS.WIDTH;
                let height = DEFAULT_PLACEHOLDER_DIMENSIONS.HEIGHT;

                const widthSources = [
                    firstIFD.width,
                    firstIFD['ImageWidth'],
                    firstIFD['t256'],
                    firstIFD[256],
                    firstIFD['ImageWidth']?.value,
                    firstIFD['t256']?.value,
                    firstIFD[256]?.value
                ];

                const heightSources = [
                    firstIFD.height,
                    firstIFD['ImageLength'],
                    firstIFD['t257'],
                    firstIFD[257],
                    firstIFD['ImageLength']?.value,
                    firstIFD['t257']?.value,
                    firstIFD[257]?.value
                ];

                for (const source of widthSources) {
                    if (source && typeof source === 'number' && source > 0 && source < 100000) {
                        width = Math.round(source);
                        break;
                    }
                }

                for (const source of heightSources) {
                    if (source && typeof source === 'number' && source > 0 && source < 100000) {
                        height = Math.round(source);
                        break;
                    }
                }

                let rgba;
                let rgbaSuccess = false;

                if (decodeSuccess) {
                    try {
                        rgba = window.UTIF.toRGBA8(firstIFD);
                        if (rgba && rgba.length > 0 && rgba.length >= (width * height * 2)) {
                            rgbaSuccess = true;
                        }
                    } catch (rgbaError) {
                        // Continue with placeholder
                    }
                }

                if (rgbaSuccess) {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    const imageData = ctx.createImageData(width, height);

                    const expectedLength = width * height * 4;
                    if (rgba.length === expectedLength) {
                        imageData.data.set(rgba);
                    } else {
                        const copyLength = Math.min(rgba.length, expectedLength);
                        imageData.data.set(rgba.subarray(0, copyLength));

                        for (let i = copyLength; i < expectedLength; i += 4) {
                            imageData.data[i] = 255;
                            imageData.data[i + 1] = 255;
                            imageData.data[i + 2] = 255;
                            imageData.data[i + 3] = 255;
                        }
                    }

                    ctx.putImageData(imageData, 0, 0);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED));
                            return;
                        }

                        const originalName = tiffFile.name || TEMP_FILE_NAMES.CONVERTED_TIFF;
                        const baseName = originalName.replace(getTIFFExtensionPattern(), '');
                        const newFileName = `${baseName}.png`;

                        resolve(new File([blob], newFileName, { type: 'image/png' }));

                    }, 'image/png', DEFAULT_PNG_QUALITY);
                } else {
                    const canvas = document.createElement('canvas');

                    const maxSize = DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE;
                    if (width > maxSize || height > maxSize) {
                        const scale = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
                    ctx.fillRect(0, 0, width, height);

                    const gradient = ctx.createLinearGradient(0, 0, width, height);
                    gradient.addColorStop(0, IMAGE_COLORS.INFO);
                    gradient.addColorStop(0.5, IMAGE_COLORS.SUCCESS);
                    gradient.addColorStop(1, '#f0ad4e');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(2, 2, width - 4, height - 4);

                    const centerX = width / 2;
                    const centerY = height / 2;

                    ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
                    const iconSize = Math.min(60, width / 8);
                    ctx.font = `bold ${iconSize}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(FILE_TYPE_NAMES.TIFF, centerX, centerY - 50);

                    ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
                    const titleSize = Math.min(28, width / 15);
                    ctx.font = `bold ${titleSize}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
                    ctx.fillText('TIFF Image', centerX, centerY);

                    const infoSize = Math.min(18, width / 25);
                    ctx.font = `${infoSize}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
                    ctx.fillText(`${width} × ${height}`, centerX, centerY + 40);

                    ctx.fillStyle = IMAGE_COLORS.ERROR_TEXT;
                    ctx.font = `${Math.min(14, width / 30)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
                    ctx.fillText('Preview Not Available', centerX, centerY + 80);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error(PROCESSING_ERRORS.PLACEHOLDER_FAILED));
                            return;
                        }

                        const originalName = tiffFile.name || TEMP_FILE_NAMES.CONVERTED_TIFF;
                        const baseName = originalName.replace(getTIFFExtensionPattern(), '');
                        const newFileName = `${baseName}.png`;
                        resolve(new File([blob], newFileName, { type: 'image/png' }));
                    }, 'image/png', DEFAULT_PNG_QUALITY);
                }

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(tiffFile);
    });
};

/**
 * Converts TIFF using simple browser method
 * @param {File} tiffFile - TIFF file to convert
 * @returns {Promise<File>} Converted PNG file
 */
export const convertTIFFSimple = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(tiffFile);
        const img = new Image();

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
        }, 15000);

        img.onload = () => {
            clearTimeout(timeout);

            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(objectUrl);

                    if (!blob) {
                        reject(new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED));
                        return;
                    }

                    const originalName = tiffFile.name || TEMP_FILE_NAMES.CONVERTED_TIFF;
                    const baseName = originalName.replace(getTIFFExtensionPattern(), '');
                    const newFileName = `${baseName}.png`;

                    resolve(new File([blob], newFileName, { type: 'image/png' }));

                }, 'image/png', DEFAULT_PNG_QUALITY);

            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(error);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Browser cannot load TIFF'));
        };

        img.src = objectUrl;
    });
};

/**
 * Converts TIFF using browser capabilities
 * @param {File} tiffFile - TIFF file to convert
 * @returns {Promise<File>} Converted PNG file
 */
export const convertTIFFWithBrowser = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(tiffFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
        }, 10000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (!blob) {
                        reject(new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED));
                        return;
                    }

                    const originalName = tiffFile.name || TEMP_FILE_NAMES.CONVERTED_TIFF;
                    const baseName = originalName.replace(getTIFFExtensionPattern(), '');
                    const newFileName = `${baseName}.png`;

                    resolve(new File([blob], newFileName, { type: 'image/png' }));

                }, 'image/png', DEFAULT_PNG_QUALITY);

            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(error);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Browser cannot decode TIFF'));
        };

        img.src = objectUrl;
    });
};

/**
 * Creates TIFF placeholder from file info
 * @param {File} tiffFile - TIFF file
 * @returns {Promise<File>} Placeholder PNG file
 */
export const createTIFFPlaceholderFromInfo = async (tiffFile) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');

        const fileName = tiffFile.name || '';
        let width = DEFAULT_PLACEHOLDER_DIMENSIONS.WIDTH;
        let height = DEFAULT_PLACEHOLDER_DIMENSIONS.HEIGHT;

        const dimensionMatch = fileName.match(/(\d+)[x×](\d+)/i);
        if (dimensionMatch) {
            width = parseInt(dimensionMatch[1]);
            height = parseInt(dimensionMatch[2]);
        }

        const maxSize = DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE;
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
        ctx.fillRect(0, 0, width, height);

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, IMAGE_COLORS.INFO);
        gradient.addColorStop(0.5, IMAGE_COLORS.SUCCESS);
        gradient.addColorStop(1, '#f0ad4e');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
        ctx.font = `bold ${Math.min(60, width / 10)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(FILE_TYPE_NAMES.TIFF, width / 2, height / 2 - 40);

        ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
        ctx.font = `bold ${Math.min(24, width / 20)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText('TIFF Image', width / 2, height / 2 + 20);

        ctx.font = `${Math.min(16, width / 30)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText(`${width} × ${height}`, width / 2, height / 2 + 60);

        canvas.toBlob((blob) => {
            const newName = fileName ?
                fileName.replace(getTIFFExtensionPattern(), '.png') :
                TEMP_FILE_NAMES.CONVERTED_TIFF;
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', DEFAULT_PNG_QUALITY);
    });
};

/**
 * Create a placeholder file for TIFF when conversion fails
 * @async
 * @param {File} tiffFile - TIFF file
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Promise<File>} Placeholder PNG file
 */
export const createTIFFPlaceholderFile = async (tiffFile, targetWidth = null, targetHeight = null) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        let originalWidth = 800;
        let originalHeight = 600;

        if (targetWidth && targetHeight) {
            originalWidth = targetWidth;
            originalHeight = targetHeight;
        } else {
            const fileName = tiffFile.name || '';
            const dimensionMatch = fileName.match(/(\d+)x(\d+)/);
            if (dimensionMatch) {
                originalWidth = parseInt(dimensionMatch[1]);
                originalHeight = parseInt(dimensionMatch[2]);
            }
        }

        let canvasWidth, canvasHeight;
        if (originalWidth > originalHeight) {
            canvasWidth = Math.min(MAX_SCREENSHOT_SIZE, originalWidth);
            canvasHeight = Math.round((originalHeight / originalWidth) * canvasWidth);
        } else {
            canvasHeight = Math.min(MAX_SCREENSHOT_SIZE, originalHeight);
            canvasWidth = Math.round((originalWidth / originalHeight) * canvasHeight);
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvasWidth - 20, canvasHeight - 20);
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        ctx.fillStyle = '#6c757d';
        ctx.font = `bold ${Math.min(48, canvasHeight / 8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Image', centerX, centerY - (canvasHeight / 10));
        ctx.fillStyle = '#343a40';
        ctx.font = `bold ${Math.min(24, canvasHeight / 12)}px Arial`;
        ctx.fillText('TIFF Image', centerX, centerY);
        ctx.fillStyle = '#6c757d';
        ctx.font = `${Math.min(14, canvasHeight / 20)}px Arial`;
        const fileName = tiffFile.name || 'TIFF File';
        const displayName = fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName;
        ctx.fillText(displayName, centerX, centerY + (canvasHeight / 10));
        ctx.fillStyle = '#28a745';
        ctx.font = `${Math.min(12, canvasHeight / 25)}px Arial`;
        ctx.fillText(`Original: ${originalWidth}×${originalHeight}`, centerX, centerY + (canvasHeight / 5));
        canvas.toBlob((blob) => {
            const newName = tiffFile.name ?
                tiffFile.name.replace(getTIFFExtensionPattern(), '.png') :
                'converted-tiff.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

/**
 * Converts TIFF file for processing
 * @param {File} tiffFile - TIFF file to convert
 * @returns {Promise<File>} Converted PNG file
 */
export const convertTIFFForProcessing = async (tiffFile) => {
    try {
        try {
            const result = await convertTIFFSimple(tiffFile);
            return result;
        } catch (simpleError) {
            // Continue to UTIF method
        }

        if (window.UTIF && typeof window.UTIF.decode === 'function') {
            try {
                const result = await convertTIFFWithUTIF(tiffFile);
                return result;
            } catch (utifError) {
                // Continue to placeholder method
            }
        }

        try {
            return await createTIFFPlaceholderFromInfo(tiffFile);
        } catch (placeholderError) {
            // Use final fallback
        }

        return await createTIFFPlaceholderFile(tiffFile);

    } catch (error) {
        return await createTIFFPlaceholderFile(tiffFile);
    }
};

/**
 * Checks if a file has TIFF extension
 * @param {string} fileName - File name to check
 * @returns {boolean} True if file has TIFF extension
 */
export const hasTIFFExtension = (fileName) => {
    if (!fileName) return false;
    const fileNameLower = fileName.toLowerCase();
    return FILE_EXTENSIONS.TIFF.some(ext => fileNameLower.endsWith(ext));
};

/**
 * Checks if MIME type is TIFF
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} True if MIME type is TIFF
 */
export const isTIFFMimeType = (mimeType) => {
    if (!mimeType) return false;
    const mimeTypeLower = mimeType.toLowerCase();
    return TIFF_FORMATS.includes(mimeTypeLower);
};

/**
 * Generates a preview image for TIFF files using UTIF
 * @param {File} tiffFile - TIFF file
 * @param {number} maxSize - Maximum size for preview (default: 400)
 * @returns {Promise<string>} Data URL of the preview image
 */
export const generateTIFFPreview = async (tiffFile, maxSize = 400) => {
    try {
        if (!window.UTIF) {
            throw new Error('UTIF library not loaded');
        }

        const pngFile = await convertTIFFWithUTIF(tiffFile);
        const preview = await createScaledPreview(pngFile, maxSize);
        return preview;

    } catch (error) {
        throw error;
    }
};


/**
 * Creates a scaled preview image from any image file
 * @param {File} imageFile - Image file
 * @param {number} maxSize - Maximum dimension
 * @returns {Promise<string>} Data URL of scaled preview
 */
const createScaledPreview = (imageFile, maxSize) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load timeout'));
        }, 10000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (!width || !height || width <= 0 || height <= 0) {
                    width = 200;
                    height = 150;
                }

                if (width > maxSize || height > maxSize) {
                    const scale = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (imageFile.type === 'image/png') {
                    ctx.clearRect(0, 0, width, height);
                }

                ctx.drawImage(img, 0, 0, width, height);

                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            } catch (canvasError) {
                URL.revokeObjectURL(url);
                reject(canvasError);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load converted image'));
        };

        img.src = url;
    });
};

/**
 * Quick TIFF preview that doesn't do full conversion
 * @param {File} tiffFile - TIFF file
 * @param {number} maxSize - Maximum size
 * @returns {Promise<string>} Data URL preview
 */
export const generateQuickTIFFPreview = async (tiffFile, maxSize = 300) => {
    return new Promise((resolve, reject) => {
        if (!tiffFile) {
            reject(new Error('No TIFF file provided'));
            return;
        }

        const reader = new FileReader();

        const timeout = setTimeout(() => {
            reject(new Error('TIFF read timeout'));
        }, 10000);

        reader.onload = (e) => {
            clearTimeout(timeout);
            try {
                const arrayBuffer = e.target.result;

                if (!window.UTIF) {
                    reject(new Error('UTIF library not loaded'));
                    return;
                }

                const ifds = window.UTIF.decode(arrayBuffer);
                if (!ifds || ifds.length === 0) {
                    reject(new Error('No TIFF data found'));
                    return;
                }

                const firstIFD = ifds[0];

                try {
                    if (window.UTIF.decodeImage) {
                        window.UTIF.decodeImage(arrayBuffer, firstIFD);
                    } else if (window.UTIF.decodeImages) {
                        window.UTIF.decodeImages(arrayBuffer, ifds);
                    }
                } catch (decodeError) { }

                let width = firstIFD.width || firstIFD['ImageWidth'] || firstIFD['t256'] || 200;
                let height = firstIFD.height || firstIFD['ImageLength'] || firstIFD['t257'] || 150;

                if (width && width.value) width = width.value;
                if (height && height.value) height = height.value;

                width = Math.max(1, Math.min(width, 10000));
                height = Math.max(1, Math.min(height, 10000));

                const canvas = document.createElement('canvas');
                let previewWidth, previewHeight;

                if (width > maxSize || height > maxSize) {
                    const scale = Math.min(maxSize / width, maxSize / height);
                    previewWidth = Math.round(width * scale);
                    previewHeight = Math.round(height * scale);
                } else {
                    previewWidth = width;
                    previewHeight = height;
                }

                canvas.width = previewWidth;
                canvas.height = previewHeight;
                const ctx = canvas.getContext('2d');

                try {
                    const rgba = window.UTIF.toRGBA8(firstIFD);
                    if (rgba && rgba.length > 0) {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        const imageData = tempCtx.createImageData(width, height);
                        imageData.data.set(rgba);
                        tempCtx.putImageData(imageData, 0, 0);

                        ctx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);
                        resolve(canvas.toDataURL('image/png'));
                        return;
                    }
                } catch (rgbaError) { }

                ctx.fillStyle = '#e3f2fd';
                ctx.fillRect(0, 0, previewWidth, previewHeight);

                ctx.strokeStyle = '#1976d2';
                ctx.lineWidth = 2;
                ctx.strokeRect(5, 5, previewWidth - 10, previewHeight - 10);

                ctx.fillStyle = '#1976d2';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('TIFF', previewWidth / 2, previewHeight / 2 - 10);

                ctx.fillStyle = '#666';
                ctx.font = '12px Arial';
                ctx.fillText(`${width}×${height}`, previewWidth / 2, previewHeight / 2 + 15);

                resolve(canvas.toDataURL('image/png'));

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to read TIFF file'));
        };

        reader.readAsArrayBuffer(tiffFile);
    });
};

/**
 * Checks if UTIF is available
 * @returns {boolean} True if UTIF is loaded
 */
export const isUTIFAvailable = () => {
    return window.UTIF && typeof window.UTIF.decode === 'function';
};

/**
 * Creates a simple placeholder for any file type
 * @param {Object} image - Image object
 * @param {string} image.name - File name
 * @param {boolean} image.isTIFF - Is TIFF file
 * @param {boolean} image.isSVG - Is SVG file
 * @returns {string} Data URL of placeholder
 */
export const createFilePlaceholder = (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');

    let bgColor, textColor, icon, formatText;
    if (image.isTIFF) {
        bgColor = '#e3f2fd';
        textColor = '#1976d2';
        icon = 'TIF';
        formatText = 'TIFF';
    } else if (image.isSVG) {
        bgColor = '#f3e5f5';
        textColor = '#7b1fa2';
        icon = 'SVG';
        formatText = 'SVG';
    } else {
        bgColor = '#f5f5f5';
        textColor = '#616161';
        icon = 'IMG';
        formatText = 'IMAGE';
    }

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, bgColor);
    gradient.addColorStop(1, lightenColor(bgColor, 20));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, canvas.width / 2, canvas.height / 2 - 20);

    ctx.font = 'bold 14px Arial';
    ctx.fillText(formatText, canvas.width / 2, canvas.height / 2 + 25);

    return canvas.toDataURL('image/png');
};

/**
 * Lightens a color by a percentage
 * @param {string} color - Hex color
 * @param {number} percent - Percentage to lighten
 * @returns {string} Lightened hex color
 */
const lightenColor = (color, percent) => {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    const clampedR = R < 255 ? (R < 1 ? 0 : R) : 255;
    const clampedG = G < 255 ? (G < 1 ? 0 : G) : 255;
    const clampedB = B < 255 ? (B < 1 ? 0 : B) : 255;

    return "#" + (0x1000000 + clampedR * 0x10000 + clampedG * 0x100 + clampedB)
        .toString(16).slice(1);
};

/**
 * Converts legacy image formats to PNG
 * @param {File} imageFile - Image file
 * @returns {Promise<File>} Converted PNG file
 */
export const convertLegacyFormat = async (imageFile) => {
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isTIFF = TIFF_FORMATS.includes(mimeType) ||
        FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
    const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
    const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

    if (!isTIFF && !isBMP && !isICO) {
        return imageFile;
    }

    if (isTIFF) {
        try {
            return await convertTIFFForProcessing(imageFile);
        } catch (error) {
            return await createTIFFPlaceholderFile(imageFile);
        }
    }

    const convertToPNG = (imgElement, resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error(PROCESSING_ERRORS.CONVERSION_FAILED));
                    return;
                }

                const originalName = imageFile.name || 'converted-image';
                const baseName = originalName.replace(/\.[^/.]+$/, '');
                const newFileName = `${baseName}.png`;

                const convertedFile = new File([blob], newFileName, { type: 'image/png' });
                resolve(convertedFile);
            }, 'image/png', DEFAULT_PNG_QUALITY);
        } catch (error) {
            reject(error);
        }
    };

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
        }, 15000);

        img.onload = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            convertToPNG(img, resolve, reject);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);

            // Fallback to FileReader for potential browser compatibility issues
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgFallback = new Image();
                imgFallback.onload = () => {
                    convertToPNG(imgFallback, resolve, reject);
                };
                imgFallback.onerror = () => {
                    if (isBMP || isICO) {
                        createSimpleLegacyConversion(imageFile)
                            .then(resolve)
                            .catch(() => reject(new Error(`Failed to load ${fileName} image`)));
                    } else {
                        reject(new Error(`Failed to load ${fileName} image`));
                    }
                };
                imgFallback.src = e.target.result;
            };
            reader.onerror = () => {
                if (isBMP || isICO) {
                    createSimpleLegacyConversion(imageFile).then(resolve).catch(reject);
                } else {
                    reject(new Error(`Failed to read ${fileName}`));
                }
            };
            reader.readAsDataURL(imageFile);
        };

        img.src = objectUrl;
    });
};

/**
 * Creates simple legacy format conversion placeholder
 * @param {File} imageFile - Image file
 * @returns {Promise<File>} Placeholder image file
 */
export const createSimpleLegacyConversion = async (imageFile) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const fileName = imageFile.name.toLowerCase();

        let width = DEFAULT_PLACEHOLDER_DIMENSIONS.WIDTH;
        let height = DEFAULT_PLACEHOLDER_DIMENSIONS.HEIGHT;

        const dimensionMatch = fileName.match(/(\d+)x(\d+)/);
        if (dimensionMatch) {
            width = parseInt(dimensionMatch[1]);
            height = parseInt(dimensionMatch[2]);
        }

        const maxSize = DEFAULT_PLACEHOLDER_DIMENSIONS.MAX_SIZE;
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = IMAGE_COLORS.PLACEHOLDER_BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(CROP_MARGIN, CROP_MARGIN, width - CROP_MARGIN * 2, height - CROP_MARGIN * 2);

        let fileType = FILE_TYPE_NAMES.TIFF;
        if (FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext))) fileType = FILE_TYPE_NAMES.TIFF;
        else if (FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext))) fileType = FILE_TYPE_NAMES.BMP;
        else if (FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext))) fileType = FILE_TYPE_NAMES.ICO;

        const centerX = width / 2;
        const centerY = height / 2;

        ctx.fillStyle = IMAGE_COLORS.PLACEHOLDER_TEXT;
        ctx.font = `bold ${Math.min(48, height / 8)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fileType, centerX, centerY - 50);

        ctx.fillStyle = IMAGE_COLORS.PLACEHOLDER_TEXT;
        ctx.font = `bold ${Math.min(24, height / 12)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText('Legacy Format', centerX, centerY);

        ctx.fillStyle = IMAGE_COLORS.SUCCESS;
        ctx.font = `${Math.min(16, height / 16)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText(`${width} × ${height}`, centerX, centerY + 40);

        ctx.fillStyle = IMAGE_COLORS.PLACEHOLDER_TEXT;
        ctx.font = `${Math.min(14, height / 20)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        const displayName = imageFile.name.length > 30 ?
            imageFile.name.substring(0, 27) + '...' : imageFile.name;
        ctx.fillText(displayName, centerX, centerY + 80);

        canvas.toBlob((blob) => {
            const newName = imageFile.name ?
                imageFile.name.replace(/\.[^/.]+$/, '.png') : 'converted.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', DEFAULT_PNG_QUALITY);
    });
};
