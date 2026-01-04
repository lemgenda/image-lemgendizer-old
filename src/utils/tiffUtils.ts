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
    FILE_EXTENSIONS
} from '../constants';

import { APP_TEMPLATE_CONFIG, DEFAULT_PLACEHOLDER_DIMENSIONS } from '../configs/templateConfigs';

// Add UTIF to window if not already available
// Note: UTIF is expected to be loaded via CDN or import.
// If using 'utif' package via import, we should use that.
// But the original code imports from 'utif' AND sets window.UTIF.
import UTIF from 'utif';

// Initialize window.UTIF if it doesn't exist (though import usually doesn't set global)
if (typeof window !== 'undefined' && !window.UTIF) {
    (window as any).UTIF = UTIF;
}

/**
 * Creates a regex pattern for TIFF file extensions
 * @returns {RegExp} Regex pattern for TIFF file extensions
 */
const getTIFFExtensionPattern = (): RegExp => {
    const tiffExtensions = FILE_EXTENSIONS.TIFF.map(ext => ext.replace('.', ''));
    return new RegExp(`\\.(${tiffExtensions.join('|')})$`, 'i');
};

/**
 * Loads UTIF library from CDN if not already available
 * @returns {Promise<boolean>} True if UTIF loaded successfully
 */
export const loadUTIFLibrary = (): Promise<boolean> => {
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
export const convertTIFFWithUTIF = (tiffFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (!arrayBuffer) throw new Error(PROCESSING_ERRORS.TIFF_NO_DATA);

                let ifds: any[];
                try {
                    ifds = window.UTIF.decode(arrayBuffer);
                    if (!ifds || ifds.length === 0) {
                        throw new Error(PROCESSING_ERRORS.TIFF_NO_DATA);
                    }
                } catch (decodeError: any) {
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
                } catch {
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

                let rgba: Uint8Array | null = null;
                let rgbaSuccess = false;

                if (decodeSuccess) {
                    try {
                        rgba = window.UTIF.toRGBA8(firstIFD);
                        if (rgba && rgba.length > 0 && rgba.length >= (width * height * 2)) {
                            rgbaSuccess = true;
                        }
                    } catch {
                        // Continue with placeholder
                    }
                }

                if (rgbaSuccess && rgba) {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error("No context");

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
                    if (!ctx) throw new Error("No context");

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
export const convertTIFFSimple = (tiffFile: File): Promise<File> => {
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
                if (!ctx) throw new Error("No context");

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
export const convertTIFFWithBrowser = (tiffFile: File): Promise<File> => {
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
                if (!ctx) throw new Error("No context");

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
export const createTIFFPlaceholderFromInfo = async (tiffFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
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
        if (!ctx) {
            reject(new Error("No context"));
            return;
        }

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
            if (blob) {
                resolve(new File([blob], newName, { type: 'image/png' }));
            } else {
                reject(new Error('Blob failed'));
            }
        }, 'image/png', DEFAULT_PNG_QUALITY);
    });
};

/**
 * Create a placeholder file for TIFF when conversion fails
 * @async
 * @param {File} tiffFile - TIFF file
 * @param {number | null} targetWidth - Target width
 * @param {number | null} targetHeight - Target height
 * @returns {Promise<File>} Placeholder PNG file
 */
export const createTIFFPlaceholderFile = async (
    tiffFile: File,
    targetWidth: number | null = null,
    targetHeight: number | null = null
): Promise<File> => {
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
        if (!ctx) throw new Error("No context");

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
            if (blob) resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

/**
 * Converts TIFF file for processing
 * @param {File} tiffFile - TIFF file to convert
 * @returns {Promise<File>} Converted PNG file
 */
export const convertTIFFForProcessing = async (tiffFile: File): Promise<File> => {
    try {

        try {
            const result = await convertTIFFSimple(tiffFile);

            return result;
        } catch {
            // Continue to UTIF method
        }

        if (window.UTIF && typeof window.UTIF.decode === 'function') {
            try {
                const result = await convertTIFFWithUTIF(tiffFile);
                return result;
            } catch {
                // Continue to placeholder method
            }
        }

        try {
            return await createTIFFPlaceholderFromInfo(tiffFile);
        } catch {
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
export const hasTIFFExtension = (fileName: string): boolean => {
    if (!fileName) return false;
    const fileNameLower = fileName.toLowerCase();
    return FILE_EXTENSIONS.TIFF.some(ext => fileNameLower.endsWith(ext));
};

/**
 * Checks if MIME type is TIFF
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} True if MIME type is TIFF
 */
export const isTIFFMimeType = (mimeType: string): boolean => {
    if (!mimeType) return false;
    const mimeTypeLower = mimeType.toLowerCase();
    return TIFF_FORMATS.includes(mimeTypeLower);
};

/**
 * Creates a scaled preview image from any image file
 * @param {File} imageFile - Image file
 * @param {number} maxSize - Maximum dimension
 * @returns {Promise<string>} Data URL of scaled preview
 */
const createScaledPreview = (imageFile: File, maxSize: number): Promise<string> => {
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
                if (!ctx) throw new Error("No context");

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
 * Generates a preview image for TIFF files using UTIF
 * @param {File} tiffFile - TIFF file
 * @param {number} maxSize - Maximum size for preview (default: 400)
 * @returns {Promise<string>} Data URL of the preview image
 */
export const generateTIFFPreview = async (tiffFile: File, maxSize: number = 400): Promise<string> => {
    if (!window.UTIF) {
        throw new Error('UTIF library not loaded');
    }

    const pngFile = await convertTIFFWithUTIF(tiffFile);
    const preview = await createScaledPreview(pngFile, maxSize);
    return preview;
};

/**
 * Quick TIFF preview that doesn't do full conversion
 * @param {File} tiffFile - TIFF file
 * @param {number} maxSize - Maximum size
 * @returns {Promise<string>} Data URL preview
 */
export const generateQuickTIFFPreview = async (tiffFile: File, maxSize: number = 300): Promise<string> => {
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
                const arrayBuffer = e.target?.result as ArrayBuffer;

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
                } catch { /* ignore */ }

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
                if (!ctx) throw new Error("No context");

                try {
                    const rgba = window.UTIF.toRGBA8(firstIFD);
                    if (rgba && rgba.length > 0) {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        if (tempCtx) {
                            const imageData = tempCtx.createImageData(width, height);
                            imageData.data.set(rgba);
                            tempCtx.putImageData(imageData, 0, 0);

                            ctx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);
                            resolve(canvas.toDataURL('image/png'));
                            return;
                        }
                    }
                } catch { /* ignore */ }

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
export const isUTIFAvailable = (): boolean => {
    return !!(window.UTIF && typeof window.UTIF.decode === 'function');
};

/**
 * Creates a simple placeholder for any file type
 * @param {Object} image - Image object
 * @param {string} image.name - File name
 * @param {boolean} image.isTIFF - Is TIFF file
 * @param {boolean} image.isSVG - Is SVG file
 * @returns {string} Data URL of placeholder
 */
export const createFilePlaceholder = (image: { name: string; isTIFF?: boolean; isSVG?: boolean; type?: string }): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

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
        bgColor = '#e0f7fa';
        textColor = '#006064';
        icon = 'IMG';
        formatText = image.type ? image.type.split('/')[1].toUpperCase() : 'FILE';
    }

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 200, 150);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 100, 75 - 10);

    ctx.font = '14px Arial';
    ctx.fillText(formatText, 100, 75 + 30);

    return canvas.toDataURL('image/png');
};
