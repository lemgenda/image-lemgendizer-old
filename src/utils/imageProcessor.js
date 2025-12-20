import UTIF from 'utif';
// Make it globally available if needed
if (!window.UTIF) {
    window.UTIF = UTIF;
}

/**
 * Main image processing module with AI capabilities, upscaling, memory management, and TIFF support.
 * Supports various image formats including JPEG, PNG, GIF, WebP, SVG, AVIF, TIFF, BMP, and ICO.
 * @module imageProcessor
 */

// ================================
// Constants and State Management
// ================================

/** Maximum texture size supported by GPU */
const MAX_TEXTURE_SIZE = 16384;

/** Maximum safe dimension for processing */
const MAX_SAFE_DIMENSION = 4096;

/** Maximum total pixels for safe processing */
const MAX_TOTAL_PIXELS = 16000000;
const MAX_TOTAL_PIXELS_FOR_AI = 8000000; // 8MP for AI processing
const MAX_DIMENSION_FOR_AI = 3000; // Increased from 2000 to 3000


/** Supported input image formats */
const SUPPORTED_INPUT_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/avif', 'image/tiff', 'image/bmp',
    'image/x-icon', 'image/vnd.microsoft.icon',
    'image/tif', 'application/tif', 'application/tiff'
];

/** Legacy formats that need conversion */
const LEGACY_FORMATS = ['image/tiff', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon'];

/** TIFF format identifiers */
const TIFF_FORMATS = ['image/tiff', 'image/tif', 'application/tif', 'application/tiff'];

/** Maximum texture failures before disabling AI upscaling */
const MAX_TEXTURE_FAILURES = 3;

/** AI model instance */
let aiModel = null;

/** AI model loading state */
let aiModelLoading = false;

/** Upscaler instances by scale */
let upscalerInstances = {};

/** Upscaler usage count by scale */
let upscalerUsageCount = {};

/** Last used timestamps for upscalers */
let upscalerLastUsed = {};

/** Current GPU memory usage in MB */
let currentMemoryUsage = 0;

/** Memory cleanup interval reference */
let memoryCleanupInterval = null;

/** Whether AI upscaling is disabled */
let aiUpscalingDisabled = false;

/** Texture manager failure count */
let textureManagerFailures = 0;

/** Whether cleanup is in progress */
let cleanupInProgress = false;

// ================================
// GPU Memory Management
// ================================

/**
 * Initializes GPU memory monitoring system.
 * @returns {void}
 */
const initializeGPUMemoryMonitor = () => {
    if (memoryCleanupInterval) clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = setInterval(monitorGPUMemory, 10000);
};

/**
 * Monitors GPU memory usage and triggers cleanup when necessary.
 * @returns {void}
 */
const monitorGPUMemory = () => {
    if (cleanupInProgress) return;

    if (window.tf && tf.memory()) {
        const memoryInfo = tf.memory();
        currentMemoryUsage = (memoryInfo.numBytesInGPU || 0) / (1024 * 1024);

        const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
        if (currentMemoryUsage > 3000 && !upscalersInUse) {
            safeCleanupGPUMemory();
        }
    }
};

/**
 * Safely cleans up GPU memory without disposing models that are in use.
 * @returns {void}
 */
const safeCleanupGPUMemory = () => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        if (window.tf) {
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
            if (!upscalersInUse) {
                const now = Date.now();
                Object.keys(upscalerInstances).forEach(key => {
                    if (upscalerUsageCount[key] === 0 &&
                        (!upscalerLastUsed[key] || (now - upscalerLastUsed[key] > 30000))) {
                        const upscaler = upscalerInstances[key];
                        if (upscaler && upscaler.dispose) {
                            try { upscaler.dispose(); } catch (e) { }
                        }
                        delete upscalerInstances[key];
                        delete upscalerUsageCount[key];
                        delete upscalerLastUsed[key];
                    }
                });
                window.tf.disposeVariables();
                window.tf.engine().startScope();
                window.tf.engine().endScope();
            }
        }
        currentMemoryUsage = 0;
    } catch (error) {
    } finally {
        cleanupInProgress = false;
    }
};

/**
 * Aggressively cleans up all GPU memory resources.
 * @returns {void}
 */
const cleanupGPUMemory = () => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        if (window.tf) {
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
            if (upscalersInUse) {
                cleanupInProgress = false;
                return;
            }

            if (aiModel && aiModel.dispose) {
                aiModel.dispose();
                aiModel = null;
            }

            Object.keys(upscalerInstances).forEach(key => {
                const upscaler = upscalerInstances[key];
                if (upscaler && upscaler.dispose) {
                    try { upscaler.dispose(); } catch (e) { }
                }
            });

            upscalerInstances = {};
            upscalerUsageCount = {};
            upscalerLastUsed = {};

            window.tf.disposeVariables();
            window.tf.engine().startScope();
            window.tf.engine().endScope();

            if (window.tf.ENV) window.tf.ENV.reset();
        }

        currentMemoryUsage = 0;
        aiUpscalingDisabled = false;
        textureManagerFailures = 0;
    } catch (error) {
    } finally {
        cleanupInProgress = false;
    }
};

// ================================
// TIFF Processing Functions
// ================================
/**
 * Load UTIF.js library for TIFF decoding
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
 * Enhanced TIFF conversion with fallback methods
 */
const convertTIFFWithUTIF = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target.result;

                // Decode TIFF
                const ifds = window.UTIF.decode(arrayBuffer);

                if (!ifds || ifds.length === 0) {
                    reject(new Error('No TIFF data found'));
                    return;
                }

                // Get first image
                const firstIFD = ifds[0];

                // Decode the image
                try {
                    if (window.UTIF.decodeImage) {
                        window.UTIF.decodeImage(arrayBuffer, firstIFD);
                    } else if (window.UTIF.decodeImages) {
                        window.UTIF.decodeImages(arrayBuffer, ifds);
                    }
                } catch (decodeError) {
                    reject(new Error('Failed to decode TIFF image'));
                    return;
                }

                // Check if dimensions are available
                if (!firstIFD.width || !firstIFD.height ||
                    typeof firstIFD.width !== 'number' || typeof firstIFD.height !== 'number' ||
                    firstIFD.width <= 0 || firstIFD.height <= 0) {


                    // Try to get dimensions from other properties
                    const imageWidth = firstIFD['ImageWidth'] || firstIFD['t256'] || firstIFD[256];
                    const imageLength = firstIFD['ImageLength'] || firstIFD['t257'] || firstIFD[257];

                    if (imageWidth && imageLength) {
                        firstIFD.width = imageWidth.value || imageWidth;
                        firstIFD.height = imageLength.value || imageLength;
                    } else {
                        // Default to reasonable dimensions
                        firstIFD.width = 800;
                        firstIFD.height = 600;
                    }
                }

                // Try to convert to RGBA with error handling
                let rgba;
                try {
                    rgba = window.UTIF.toRGBA8(firstIFD);

                    // Validate RGBA data
                    if (!rgba || !rgba.length) {
                        throw new Error('Empty RGBA data');
                    }

                    // Check if data length matches expected size
                    const expectedLength = firstIFD.width * firstIFD.height * 4;
                    if (rgba.length !== expectedLength) {

                        // Try to fix by creating new array with correct size
                        const fixedRgba = new Uint8ClampedArray(expectedLength);
                        const copyLength = Math.min(rgba.length, expectedLength);
                        fixedRgba.set(rgba.subarray(0, copyLength));

                        // Fill remaining with transparent black
                        for (let i = copyLength; i < expectedLength; i += 4) {
                            fixedRgba[i] = 0;     // R
                            fixedRgba[i + 1] = 0; // G
                            fixedRgba[i + 2] = 0; // B
                            fixedRgba[i + 3] = 0; // A (transparent)
                        }
                        rgba = fixedRgba;
                    }
                } catch (rgbaError) {
                    // Create a placeholder instead
                    const canvas = document.createElement('canvas');
                    canvas.width = firstIFD.width;
                    canvas.height = firstIFD.height;
                    const ctx = canvas.getContext('2d');

                    // Draw placeholder
                    ctx.fillStyle = '#f8f9fa';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = '#6c757d';
                    ctx.font = 'bold 24px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('TIFF', canvas.width / 2, canvas.height / 2);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create PNG placeholder'));
                            return;
                        }

                        const originalName = tiffFile.name || 'converted-tiff';
                        const baseName = originalName.replace(/\.[^/.]+$/, '');
                        const newFileName = `${baseName}.png`;
                        resolve(new File([blob], newFileName, { type: 'image/png' }));
                    }, 'image/png', 0.9);

                    return;
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = firstIFD.width;
                canvas.height = firstIFD.height;
                const ctx = canvas.getContext('2d');

                // Create image data
                const imageData = ctx.createImageData(firstIFD.width, firstIFD.height);
                imageData.data.set(rgba);
                ctx.putImageData(imageData, 0, 0);

                // Convert to PNG
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create PNG'));
                        return;
                    }

                    const originalName = tiffFile.name || 'converted-tiff';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newFileName = `${baseName}.png`;

                    resolve(new File([blob], newFileName, { type: 'image/png' }));

                }, 'image/png', 1.0);

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(tiffFile);
    });
};

// ================================
// Core Image Processing Functions
// ================================
/**
 * Resizes images while maintaining aspect ratio with optional AI upscaling.
 * @async
 * @param {Array<Object>} images - Array of image objects to resize
 * @param {number} dimension - Target dimension (width or height)
 * @param {Object} options - Processing options including quality and format
 * @param {number} [options.quality=0.85] - Image quality (0-1)
 * @param {string} [options.format='webp'] - Output format
 * @returns {Promise<Array<Object>>} Array of resized image results
 */
export const processLemGendaryResize = async (images, dimension, options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);

            // Check file types
            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');
            const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
                fileName.endsWith('.tiff') || fileName.endsWith('.tif');

            if (isSVG) {
                // Process SVG resize with aspect ratio preservation
                try {
                    // First get original SVG dimensions to preserve aspect ratio
                    const svgText = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsText(imageFile);
                    });

                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                    const svgElement = svgDoc.documentElement;

                    // Get original dimensions
                    let originalWidth = 100;
                    let originalHeight = 100;

                    const widthAttr = svgElement.getAttribute('width');
                    const heightAttr = svgElement.getAttribute('height');

                    if (widthAttr && !isNaN(parseFloat(widthAttr))) {
                        originalWidth = parseFloat(widthAttr);
                    }
                    if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                        originalHeight = parseFloat(heightAttr);
                    }

                    // If no explicit dimensions, check viewBox
                    if ((!widthAttr || !heightAttr) && svgElement.hasAttribute('viewBox')) {
                        const viewBox = svgElement.getAttribute('viewBox');
                        const parts = viewBox.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                        if (parts.length >= 4) {
                            originalWidth = parts[2];
                            originalHeight = parts[3];
                        }
                    }

                    // Calculate new dimensions maintaining aspect ratio
                    let newWidth, newHeight;
                    const aspectRatio = originalWidth / originalHeight;

                    if (originalWidth >= originalHeight) {
                        // Landscape or square - width is the larger dimension
                        newWidth = dimension;
                        newHeight = Math.round(dimension / aspectRatio);
                    } else {
                        // Portrait - height is the larger dimension
                        newHeight = dimension;
                        newWidth = Math.round(dimension * aspectRatio);
                    }

                    // Ensure minimum dimensions
                    newWidth = Math.max(1, newWidth);
                    newHeight = Math.max(1, newHeight);

                    // Process SVG resize
                    const resizedSVG = await processSVGResize(imageFile, newWidth, newHeight);

                    // Convert SVG to raster format with aspect ratio preservation
                    let rasterFile;
                    try {
                        rasterFile = await convertSVGToRaster(resizedSVG, newWidth, newHeight, options.format || 'webp');
                    } catch (svgConversionError) {
                        // Create placeholder with correct aspect ratio
                        const canvas = document.createElement('canvas');
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                        const ctx = canvas.getContext('2d');

                        // Draw background matching aspect ratio
                        const bgColor = '#f8f9fa';
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(0, 0, newWidth, newHeight);

                        // Draw border
                        ctx.strokeStyle = '#dee2e6';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(10, 10, newWidth - 20, newHeight - 20);

                        // Calculate center
                        const centerX = newWidth / 2;
                        const centerY = newHeight / 2;

                        // Draw icon
                        ctx.fillStyle = '#4a90e2';
                        const iconSize = Math.min(32, newHeight / 8);
                        ctx.font = `bold ${iconSize}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('🖋️', centerX, centerY - iconSize);

                        // Draw SVG text
                        ctx.fillStyle = '#495057';
                        const titleSize = Math.min(18, newHeight / 12);
                        ctx.font = `bold ${titleSize}px Arial`;
                        ctx.fillText('SVG', centerX, centerY);

                        // Draw dimensions
                        ctx.fillStyle = '#6c757d';
                        const infoSize = Math.min(14, newHeight / 16);
                        ctx.font = `${infoSize}px Arial`;
                        ctx.fillText(`${newWidth}×${newHeight}`, centerX, centerY + iconSize);

                        // Draw aspect ratio
                        ctx.fillStyle = '#28a745';
                        const ratio = Math.round((originalWidth / originalHeight) * 100) / 100;
                        ctx.fillText(`${ratio}:1`, centerX, centerY + iconSize * 2);

                        // Convert to blob
                        const blob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/webp', 0.85);
                        });

                        const baseName = image.name.replace(/\.svg$/i, '');
                        rasterFile = new File([blob], `${baseName}-${newWidth}x${newHeight}.webp`, {
                            type: 'image/webp'
                        });
                    }

                    const optimizedFile = await optimizeForWeb(rasterFile, options.quality, options.format);

                    results.push({
                        original: {
                            ...image,
                            file: imageFile,
                            originalDimensions: { width: originalWidth, height: originalHeight }
                        },
                        resized: optimizedFile,
                        dimensions: { width: newWidth, height: newHeight },
                        isSVG: true,
                        optimized: true,
                        aspectRatioPreserved: true,
                        originalAspectRatio: originalWidth / originalHeight
                    });
                } catch (svgError) {
                    // Create error placeholder with target dimension (square fallback)
                    const canvas = document.createElement('canvas');
                    canvas.width = dimension;
                    canvas.height = dimension;
                    const ctx = canvas.getContext('2d');

                    // Error background
                    ctx.fillStyle = '#f8d7da';
                    ctx.fillRect(0, 0, dimension, dimension);

                    // Error border
                    ctx.strokeStyle = '#f5c6cb';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(10, 10, dimension - 20, dimension - 20);

                    // Error text
                    ctx.fillStyle = '#721c24';
                    const fontSize = Math.min(16, dimension / 10);
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const centerX = dimension / 2;
                    const centerY = dimension / 2;

                    ctx.fillText('SVG Error', centerX, centerY - fontSize);

                    const displayName = image.name.length > 20 ? image.name.substring(0, 17) + '...' : image.name;
                    ctx.fillText(displayName, centerX, centerY);

                    ctx.fillStyle = '#856404';
                    ctx.font = `${Math.min(12, dimension / 15)}px Arial`;
                    ctx.fillText(svgError.message.substring(0, 30) + '...', centerX, centerY + fontSize);

                    // Convert to blob
                    const blob = await new Promise(resolve => {
                        canvas.toBlob(resolve, 'image/webp', 0.8);
                    });

                    const errorFile = new File([blob], image.name.replace(/\.svg$/i, '-error.webp'), {
                        type: 'image/webp'
                    });

                    results.push({
                        original: image,
                        resized: errorFile,
                        dimensions: { width: dimension, height: dimension },
                        isSVG: true,
                        optimized: false,
                        error: svgError.message,
                        aspectRatioPreserved: false
                    });
                }

            } else if (isTIFF) {
                // For TIFF files
                try {
                    // First try to convert TIFF
                    let convertedFile;
                    try {
                        convertedFile = await convertLegacyFormat(imageFile);
                    } catch (convertError) {
                        // Create a placeholder with the target dimensions
                        convertedFile = await createTIFFPlaceholderFile(imageFile, dimension, dimension);
                    }

                    // Now resize the converted file
                    const img = new Image();
                    const objectUrl = URL.createObjectURL(convertedFile);

                    await new Promise((resolve, reject) => {
                        img.onload = () => {
                            URL.revokeObjectURL(objectUrl);
                            resolve();
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(objectUrl);
                            reject(new Error(`Failed to load converted TIFF image: ${image.name}`));
                        };
                        img.src = objectUrl;
                    });

                    let newWidth, newHeight;
                    if (img.naturalWidth >= img.naturalHeight) {
                        newWidth = dimension;
                        newHeight = Math.round((img.naturalHeight / img.naturalWidth) * dimension);
                    } else {
                        newHeight = dimension;
                        newWidth = Math.round((img.naturalWidth / img.naturalHeight) * dimension);
                    }

                    const needsUpscaling = newWidth > img.naturalWidth || newHeight > img.naturalHeight;
                    let sourceFile = convertedFile;

                    if (needsUpscaling) {
                        const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, newWidth, newHeight);
                        sourceFile = await upscaleImageWithAI(sourceFile, upscaleFactor, image.name);
                    }

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const finalImg = new Image();
                    const finalObjectUrl = URL.createObjectURL(sourceFile);

                    await new Promise((resolve, reject) => {
                        finalImg.onload = resolve;
                        finalImg.onerror = () => {
                            URL.revokeObjectURL(finalObjectUrl);
                            reject(new Error(`Failed to load final image: ${image.name}`));
                        };
                        finalImg.src = finalObjectUrl;
                    });

                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    ctx.drawImage(finalImg, 0, 0, newWidth, newHeight);

                    const resizedBlob = await new Promise(resolve => {
                        canvas.toBlob(resolve, 'image/webp', 0.85);
                    });

                    URL.revokeObjectURL(finalObjectUrl);
                    const processedFile = new File([resizedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), {
                        type: 'image/webp'
                    });

                    const optimizedFile = await optimizeForWeb(processedFile, options.quality, options.format);

                    results.push({
                        original: { ...image, file: imageFile },
                        resized: optimizedFile,
                        dimensions: { width: newWidth, height: newHeight },
                        isSVG: false,
                        isTIFF: true,
                        optimized: true,
                        aspectRatioPreserved: true
                    });

                } catch (tiffError) {
                    // Create error placeholder for TIFF
                    const placeholder = await createTIFFPlaceholderFile(imageFile, dimension, dimension);
                    const optimizedFile = await optimizeForWeb(placeholder, options.quality, options.format);

                    results.push({
                        original: { ...image, file: imageFile },
                        resized: optimizedFile,
                        dimensions: { width: dimension, height: dimension },
                        isSVG: false,
                        isTIFF: true,
                        optimized: false,
                        error: tiffError.message
                    });
                }

            } else {
                // Regular image processing
                const img = new Image();
                const objectUrl = URL.createObjectURL(imageFile);

                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve();
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error(`Failed to load image: ${image.name}`));
                    };
                    img.src = objectUrl;
                });

                let newWidth, newHeight;
                if (img.naturalWidth >= img.naturalHeight) {
                    newWidth = dimension;
                    newHeight = Math.round((img.naturalHeight / img.naturalWidth) * dimension);
                } else {
                    newHeight = dimension;
                    newWidth = Math.round((img.naturalWidth / img.naturalHeight) * dimension);
                }

                const needsUpscaling = newWidth > img.naturalWidth || newHeight > img.naturalHeight;
                let sourceFile = imageFile;

                if (needsUpscaling) {
                    const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, newWidth, newHeight);
                    sourceFile = await upscaleImageWithAI(sourceFile, upscaleFactor, image.name);
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const finalImg = new Image();
                const finalObjectUrl = URL.createObjectURL(sourceFile);

                await new Promise((resolve, reject) => {
                    finalImg.onload = resolve;
                    finalImg.onerror = () => {
                        URL.revokeObjectURL(finalObjectUrl);
                        reject(new Error(`Failed to load final image: ${image.name}`));
                    };
                    finalImg.src = finalObjectUrl;
                });

                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.drawImage(finalImg, 0, 0, newWidth, newHeight);

                const resizedBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/webp', 0.85);
                });

                URL.revokeObjectURL(finalObjectUrl);
                const processedFile = new File([resizedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), {
                    type: 'image/webp'
                });

                const optimizedFile = await optimizeForWeb(processedFile, options.quality, options.format);

                results.push({
                    original: { ...image, file: imageFile },
                    resized: optimizedFile,
                    dimensions: { width: newWidth, height: newHeight },
                    isSVG: false,
                    optimized: true,
                    aspectRatioPreserved: true
                });
            }

        } catch (error) {
            // Create a generic error placeholder
            const canvas = document.createElement('canvas');
            canvas.width = dimension;
            canvas.height = dimension;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#f8d7da';
            ctx.fillRect(0, 0, dimension, dimension);

            ctx.fillStyle = '#721c24';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const centerX = dimension / 2;
            const centerY = dimension / 2;

            const displayName = image.name.length > 20 ? image.name.substring(0, 17) + '...' : image.name;
            ctx.fillText('Error', centerX, centerY - 20);
            ctx.fillText(displayName, centerX, centerY);

            ctx.fillStyle = '#856404';
            ctx.font = '12px Arial';
            const errorMsg = error.message.length > 30 ? error.message.substring(0, 27) + '...' : error.message;
            ctx.fillText(errorMsg, centerX, centerY + 25);

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/webp', 0.8);
            });

            const errorFile = new File([blob], `${image.name}-error.webp`, {
                type: 'image/webp'
            });

            results.push({
                original: image,
                resized: errorFile,
                dimensions: { width: dimension, height: dimension },
                isSVG: image.file?.type === 'image/svg+xml',
                optimized: false,
                error: error.message
            });
        }
    }

    return results;
};

/**
 * Crops images to specified dimensions with position control.
 * @async
 * @param {Array<Object>} images - Array of image objects to crop
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {string} cropPosition - Crop position (e.g., 'center', 'top-left')
 * @param {Object} options - Processing options including quality and format
 * @param {number} [options.quality=0.85] - Image quality (0-1)
 * @param {string} [options.format='webp'] - Output format
 * @returns {Promise<Array<Object>>} Array of cropped image results
 */
export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);

            // Check file type
            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
                fileName.endsWith('.tiff') || fileName.endsWith('.tif');
            const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

            let croppedFile;

            if (isSVG) {
                croppedFile = await processSVGCrop(imageFile, width, height);
            } else {
                // For TIFF files, convert first
                let processableFile = imageFile;
                if (isTIFF) {
                    try {
                        processableFile = await convertLegacyFormat(imageFile);
                    } catch (convertError) {
                        // Create a placeholder instead
                        const placeholder = await createTIFFPlaceholderFile(imageFile, width, height);
                        const optimizedFile = await optimizeForWeb(placeholder, options.quality, options.format);

                        results.push({
                            original: image,
                            cropped: optimizedFile,
                            dimensions: { width, height },
                            isSVG: false,
                            isTIFF: true,
                            optimized: false,
                            error: 'TIFF conversion failed'
                        });
                        continue; // Skip to next image
                    }
                }

                const img = new Image();
                const objectUrl = URL.createObjectURL(processableFile);

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Image load timeout'));
                    }, 30000);

                    img.onload = () => {
                        clearTimeout(timeout);
                        URL.revokeObjectURL(objectUrl);
                        resolve();
                    };
                    img.onerror = () => {
                        clearTimeout(timeout);
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Failed to load image'));
                    };
                    img.src = objectUrl;
                });

                const needsUpscaling = width > img.naturalWidth || height > img.naturalHeight;
                let sourceFile = processableFile;

                if (needsUpscaling) {
                    const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, width, height);
                    try {
                        sourceFile = await upscaleImageWithAI(processableFile, upscaleFactor, image.name);
                    } catch (upscaleError) {
                        // Continue with original file
                    }
                }

                const resized = await resizeImageForCrop(sourceFile, width, height);
                croppedFile = await cropFromResized(resized, width, height, cropPosition, imageFile);
            }

            const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedFile,
                dimensions: { width, height },
                isSVG: isSVG,
                isTIFF: isTIFF,
                optimized: true
            });

        } catch (error) {
            // Create error placeholder
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#f8d7da';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#721c24';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const centerX = width / 2;
            const centerY = height / 2;

            const displayName = image.name.length > 20 ? image.name.substring(0, 17) + '...' : image.name;
            ctx.fillText('Crop Error', centerX, centerY - 20);
            ctx.fillText(displayName, centerX, centerY);

            ctx.fillStyle = '#856404';
            ctx.font = '12px Arial';
            const errorMsg = error.message.length > 30 ? error.message.substring(0, 27) + '...' : error.message;
            ctx.fillText(errorMsg, centerX, centerY + 25);

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/webp', 0.8);
            });

            const errorFile = new File([blob], `${image.name}-crop-error.webp`, {
                type: 'image/webp'
            });

            results.push({
                original: image,
                cropped: errorFile,
                dimensions: { width, height },
                isSVG: image.file?.type === 'image/svg+xml',
                isTIFF: image.isTIFF || false,
                optimized: false,
                error: error.message
            });
        }
    }

    return results;
};

// ================================
// AI Processing Functions
// ================================

/**
 * Loads AI model for smart cropping with fallback.
 * @async
 * @returns {Promise<Object>} Loaded AI model
 * @throws {Error} If TensorFlow.js or COCO-SSD not available
 */
export const loadAIModel = async () => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        if (!window.tf) await loadTensorFlowFromCDN();
        if (!window.tf) throw new Error('TensorFlow.js not available');

        if (!window.cocoSsd) await loadCocoSsdFromCDN();
        if (window.cocoSsd) {
            aiModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        } else {
            throw new Error('COCO-SSD not available');
        }

        aiModelLoading = false;
        return aiModel;
    } catch (error) {
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        return aiModel;
    }
};

/**
 * Loads TensorFlow.js from CDN.
 * @async
 * @returns {Promise<void>}
 */
const loadTensorFlowFromCDN = () => {
    return new Promise((resolve) => {
        if (window.tf) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Loads COCO-SSD from CDN.
 * @async
 * @returns {Promise<void>}
 */
const loadCocoSsdFromCDN = () => {
    return new Promise((resolve) => {
        if (window.cocoSsd) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Creates simple AI model fallback.
 * @returns {Object} Simple AI model with detect method
 */
const createSimpleAIModel = () => {
    return {
        detect: async (imgElement) => {
            const width = imgElement.naturalWidth || imgElement.width;
            const height = imgElement.naturalHeight || imgElement.height;

            return [{
                bbox: [width * 0.25, height * 0.25, width * 0.5, height * 0.5],
                class: 'person',
                score: 0.8
            }];
        }
    };
};

export const processSmartCrop = async (imageFile, targetWidth, targetHeight, options = { quality: 0.85, format: 'webp' }) => {
    // Check file type first
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

    // Handle SVG files specially - convert to raster first, then crop
    if (isSVG) {
        try {
            return await convertSVGToRasterAndCrop(imageFile, targetWidth, targetHeight, options.format || 'webp', 'center');
        } catch (svgError) {
            // Fallback to simple crop
            return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
        }
    }

    // Check if it's a TIFF file
    const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    try {
        let processableFile = imageFile;

        // Handle TIFF files
        if (isTIFF) {
            try {
                processableFile = await convertTIFFForProcessing(imageFile);
            } catch (convertError) {
                // Fallback to simple crop
                return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
            }
        }

        // Load the image with optimized performance
        const img = new Image();
        const objectUrl = URL.createObjectURL(processableFile);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image load timeout'));
            }, 30000);

            img.onload = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);

                // Use setTimeout to avoid blocking
                setTimeout(resolve, 0);
            };
            img.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image'));
            };
            img.src = objectUrl;

            // Use decode() for large images
            if (processableFile.size > 1000000 && img.decode) {
                img.decode().then(() => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(objectUrl);
                    setTimeout(resolve, 0);
                }).catch(() => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Failed to decode image'));
                });
            }
        });

        // Check image size constraints - adjust limits based on available memory
        const totalPixels = img.naturalWidth * img.naturalHeight;
        const MAX_PIXELS_FOR_AI = 2000000; // Reduced from 4M to 2M for better performance
        const MAX_DIMENSION = 2000; // Max dimension for AI processing

        if (totalPixels > MAX_PIXELS_FOR_AI ||
            img.naturalWidth > MAX_DIMENSION ||
            img.naturalHeight > MAX_DIMENSION) {
            return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
        }

        // Check if upscaling is needed
        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = processableFile;

        if (needsUpscaling && !aiUpscalingDisabled) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            if (upscaleFactor > 1 && upscaleFactor <= 4) { // Limit upscale factor
                try {
                    sourceFile = await upscaleImageWithAI(processableFile, upscaleFactor, imageFile.name);
                } catch (upscaleError) {
                    // Continue with original file
                }
            }
        }

        // Resize image for cropping (smaller step size for performance)
        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);

        // Load AI model only if not already loaded and AI is not disabled
        let model;
        if (!aiUpscalingDisabled) {
            try {
                model = await loadAIModel();
            } catch (modelError) {
                model = null;
            }
        }

        const loadedImg = await loadImageWithPerformance(resized.file);

        let croppedFile;
        if (model && !aiUpscalingDisabled) {
            try {
                const predictions = await model.detect(loadedImg.element);
                const mainSubject = findMainSubject(predictions, loadedImg.width, loadedImg.height);

                if (mainSubject) {
                    // Crop based on detected subject
                    croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile);
                } else {
                    // No subject detected, use focal point detection
                    const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
                    const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
                    croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
                }
            } catch (aiError) {
                // Fallback to focal point detection
                const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
                const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
                croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
            }
        } else {
            // AI disabled or failed, use simple focal point detection
            const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
            const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
        }

        // Optimize the final cropped image
        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
        // Fallback to simple smart crop
        return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }
};

/**
 * Performs simple smart cropping using basic edge detection.
 * @async
 * @param {File} imageFile - Image file to process
 * @param {number} targetWidth - Target crop width
 * @param {number} targetHeight - Target crop height
 * @param {string} cropPosition - Crop position
 * @param {Object} options - Processing options
 * @param {number} [options.quality=0.85] - Image quality (0-1)
 * @param {string} [options.format='webp'] - Output format
 * @returns {Promise<File>} Cropped image file
 */
export const processSimpleSmartCrop = async (imageFile, targetWidth, targetHeight, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    // Check file type first
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

    // Handle SVG files specially - convert to raster first, then crop
    if (isSVG) {
        try {
            return await convertSVGToRasterAndCrop(imageFile, targetWidth, targetHeight, options.format || 'webp', cropPosition);
        } catch (svgError) {
            // Fallback to regular crop
            const cropResults = await processLemGendaryCrop(
                [{ file: imageFile, name: imageFile.name }],
                targetWidth,
                targetHeight,
                cropPosition,
                options
            );
            return cropResults[0]?.cropped || imageFile;
        }
    }

    // Check if it's a TIFF file
    const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    try {
        let processableFile = imageFile;

        // Handle TIFF files
        if (isTIFF) {
            try {
                processableFile = await convertLegacyFormat(imageFile);
            } catch (convertError) {
                // Fallback to regular crop
                const cropResults = await processLemGendaryCrop(
                    [{ file: imageFile, name: imageFile.name }],
                    targetWidth,
                    targetHeight,
                    cropPosition,
                    options
                );
                return cropResults[0]?.cropped || imageFile;
            }
        }

        // Load the image with timeout protection
        const img = new Image();
        const objectUrl = URL.createObjectURL(processableFile);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image load timeout'));
            }, 30000);

            img.onload = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                resolve();
            };
            img.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image'));
            };
            img.src = objectUrl;
        });

        // Check if upscaling is needed
        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = processableFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            if (upscaleFactor > 1) {
                try {
                    // Try AI upscaling if not disabled
                    if (!aiUpscalingDisabled) {
                        sourceFile = await upscaleImageWithAI(processableFile, upscaleFactor, imageFile.name);
                    } else {
                        // Use enhanced fallback upscaling
                        sourceFile = await upscaleImageEnhancedFallback(processableFile, upscaleFactor, imageFile.name);
                    }
                } catch (upscaleError) {
                    // Continue with original file
                }
            }
        }

        // Resize image for cropping
        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);

        // Load image and detect focal point
        const loadedImg = await loadImage(resized.file);
        const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);

        // Adjust crop position based on focal point
        const adjustedPosition = adjustCropPositionForFocalPoint(cropPosition, focalPoint, loadedImg.width, loadedImg.height);

        // Perform the crop
        const croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);

        // Optimize the final cropped image
        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
        // Fallback to regular crop
        try {
            const cropResults = await processLemGendaryCrop(
                [{ file: imageFile, name: imageFile.name }],
                targetWidth,
                targetHeight,
                cropPosition,
                options
            );
            return cropResults[0]?.cropped || imageFile;
        } catch (cropError) {
            // Last resort: create an error placeholder
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            // Draw error placeholder
            ctx.fillStyle = '#f8d7da';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            ctx.fillStyle = '#721c24';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const centerX = targetWidth / 2;
            const centerY = targetHeight / 2;

            const displayName = imageFile.name.length > 20 ?
                imageFile.name.substring(0, 17) + '...' : imageFile.name;
            ctx.fillText('Crop Error', centerX, centerY - 20);
            ctx.fillText(displayName, centerX, centerY);

            ctx.fillStyle = '#856404';
            ctx.font = '12px Arial';
            const errorMsg = error.message.length > 30 ?
                error.message.substring(0, 27) + '...' : error.message;
            ctx.fillText(errorMsg, centerX, centerY + 25);

            // Convert to blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/webp', 0.8);
            });

            return new File([blob], `${imageFile.name}-crop-error.webp`, {
                type: 'image/webp'
            });
        }
    }
};

// ================================
// Template Processing Functions
// ================================

/**
 * Processes images using social media templates.
 * @async
 * @param {Object} image - Image object to process
 * @param {Array<Object>} selectedTemplates - Array of template objects
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @returns {Promise<Array<Object>>} Array of processed template images
 */
export const processTemplateImages = async (image, selectedTemplates, useSmartCrop = false, aiModelLoaded = false) => {
    const processedImages = [];
    const imageFile = await ensureFileObject(image);
    const isSVG = imageFile.type === 'image/svg+xml';
    const hasTransparency = isSVG ? false : await checkImageTransparency(imageFile);

    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const totalPixels = img.naturalWidth * img.naturalHeight;
    const isLargeImage = totalPixels > 4000000;

    const templatesByDimensions = {};
    selectedTemplates.forEach(template => {
        const key = template.height === 'auto' ?
            `auto_${template.width}` :
            `${template.width}x${template.height}`;
        if (!templatesByDimensions[key]) templatesByDimensions[key] = [];
        templatesByDimensions[key].push(template);
    });

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        for (const [dimKey, templates] of Object.entries(templatesByDimensions)) {
            try {
                let processedFile = imageFile;
                const template = templates[0];

                if (template.width && template.height) {
                    if (template.height === 'auto') {
                        const resizeResults = await processLemGendaryResize(
                            [{ ...image, file: imageFile }],
                            template.width
                        );
                        if (resizeResults.length > 0) {
                            processedFile = resizeResults[0].resized;
                        }
                    } else {
                        if (useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled) {
                            try {
                                processedFile = await processSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height
                                );
                            } catch (error) {
                                processedFile = await processSimpleSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height,
                                    'center'
                                );
                            }
                        } else {
                            try {
                                processedFile = await processSimpleSmartCrop(
                                    imageFile,
                                    template.width,
                                    template.height,
                                    'center'
                                );
                            } catch (error) {
                                const cropResults = await processLemGendaryCrop(
                                    [{ ...image, file: imageFile }],
                                    template.width,
                                    template.height,
                                    'center'
                                );
                                if (cropResults.length > 0) {
                                    processedFile = cropResults[0].cropped;
                                }
                            }
                        }
                    }
                }

                for (const template of templates) {
                    const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp');
                    const jpgPngFile = await optimizeForWeb(processedFile, 0.85, hasTransparency ? 'png' : 'jpg');

                    const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`;
                    const webpName = `${baseName}.webp`;
                    processedImages.push({
                        ...image,
                        file: webpFile,
                        name: webpName,
                        template: template,
                        format: 'webp',
                        processed: true,
                        aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                    });

                    if (template.category === 'web' || template.category === 'logo') {
                        const pngName = `${baseName}.${hasTransparency ? 'png' : 'jpg'}`;
                        processedImages.push({
                            ...image,
                            file: jpgPngFile,
                            name: pngName,
                            template: template,
                            format: hasTransparency ? 'png' : 'jpg',
                            processed: true,
                            aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                        });
                    } else {
                        const jpgName = `${baseName}.jpg`;
                        const socialJpgFile = await optimizeForWeb(processedFile, 0.85, 'jpg');
                        processedImages.push({
                            ...image,
                            file: socialJpgFile,
                            name: jpgName,
                            template: template,
                            format: 'jpg',
                            processed: true,
                            aiCropped: useSmartCrop && aiModelLoaded && !isLargeImage && !aiUpscalingDisabled
                        });
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (groupError) {
            }
        }
    } finally {
        cleanupInProgress = wasCleanupInProgress;
        setTimeout(safeCleanupGPUMemory, 100);
    }

    return processedImages;
};

/**
 * Processes custom images with various operations.
 * @async
 * @param {Array<Object>} selectedImages - Array of images to process
 * @param {Object} processingOptions - Processing configuration options
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @returns {Promise<Array<Object>>} Array of processed images
 */
export const processCustomImagesBatch = async (selectedImages, processingOptions, aiModelLoaded = false) => {
    const processedImages = [];
    const formats = processingOptions.output.formats || ['webp'];

    safeCleanupGPUMemory();

    for (let i = 0; i < selectedImages.length; i++) {
        const image = selectedImages[i];

        try {
            // Get the original file from the image object
            let baseProcessedFile = await ensureFileObject(image);

            let resizeResult = null;
            let cropResult = null;

            // Only resize if resize is enabled AND dimension is provided
            if (processingOptions.resize?.enabled && processingOptions.resize.dimension) {
                const resizeDimension = parseInt(processingOptions.resize.dimension);
                const safeDimension = Math.min(resizeDimension, MAX_SAFE_DIMENSION);

                const resizeResults = await processLemGendaryResize(
                    [{ ...image, file: baseProcessedFile }],
                    safeDimension
                );
                if (resizeResults.length > 0 && resizeResults[0].resized) {
                    resizeResult = resizeResults[0].resized;
                    baseProcessedFile = resizeResult;
                }
                safeCleanupGPUMemory();
            }

            // Only crop if crop is enabled AND both dimensions are provided
            if (processingOptions.crop?.enabled && processingOptions.crop.width && processingOptions.crop.height) {
                const cropWidth = parseInt(processingOptions.crop.width);
                const cropHeight = parseInt(processingOptions.crop.height);

                const safeWidth = Math.min(cropWidth, MAX_SAFE_DIMENSION);
                const safeHeight = Math.min(cropHeight, MAX_SAFE_DIMENSION);

                if (processingOptions.crop.mode === 'smart' && aiModelLoaded && !aiUpscalingDisabled) {
                    try {
                        const smartCropFile = await processSmartCrop(
                            baseProcessedFile,
                            safeWidth,
                            safeHeight,
                            { quality: processingOptions.compression?.quality || 0.85, format: 'webp' }
                        );
                        cropResult = smartCropFile;
                        baseProcessedFile = smartCropFile;
                    } catch (aiError) {
                        const cropResults = await processLemGendaryCrop(
                            [{ ...image, file: baseProcessedFile }],
                            safeWidth,
                            safeHeight,
                            processingOptions.crop.position || 'center',
                            { quality: processingOptions.compression?.quality || 0.85, format: 'webp' }
                        );
                        if (cropResults.length > 0 && cropResults[0].cropped) {
                            cropResult = cropResults[0].cropped;
                            baseProcessedFile = cropResult;
                        }
                    }
                } else {
                    const cropResults = await processLemGendaryCrop(
                        [{ ...image, file: baseProcessedFile }],
                        safeWidth,
                        safeHeight,
                        processingOptions.crop.position || 'center',
                        { quality: processingOptions.compression?.quality || 0.85, format: 'webp' }
                    );
                    if (cropResults.length > 0 && cropResults[0].cropped) {
                        cropResult = cropResults[0].cropped;
                        baseProcessedFile = cropResult;
                    }
                }
                safeCleanupGPUMemory();
            }

            for (const format of formats) {
                let processedFile = baseProcessedFile;
                let finalName = image.name;
                const baseName = image.name.replace(/\.[^/.]+$/, '');

                if (processingOptions.output.rename && processingOptions.output.newFileName) {
                    // Use new filename pattern with numbering
                    const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;

                    if (format === 'original') {
                        finalName = `${numberedName}.${image.name.split('.').pop()}`;
                        processedFile = new File([await ensureFileObject(image)], finalName, {
                            type: image.type || processedFile.type
                        });
                    } else {
                        finalName = `${numberedName}.${format}`;
                    }
                } else {
                    // Keep original naming - NO operation suffixes
                    if (format === 'original') {
                        // For original format, keep exact original filename
                        finalName = image.name;
                        processedFile = new File([await ensureFileObject(image)], finalName, {
                            type: image.type || processedFile.type
                        });
                    } else {
                        // For converted formats: baseName.extension
                        finalName = `${baseName}.${format}`;
                    }
                }

                if (format !== 'original') {
                    // Check transparency
                    const hasTransparency = await checkImageTransparency(processedFile);
                    let targetFormat = format;

                    // Handle JPG format with transparency
                    if ((targetFormat === 'jpg' || targetFormat === 'jpeg') && hasTransparency) {
                        // Keep as JPG but add white background in optimizeForWeb
                        // Don't switch to PNG
                        targetFormat = 'jpg';
                    }

                    // Check AVIF support if needed
                    if (targetFormat === 'avif') {
                        const supportsAVIF = await checkAVIFSupport();
                        if (!supportsAVIF) {
                            targetFormat = 'webp';
                        }
                    }

                    try {
                        processedFile = await optimizeForWeb(
                            processedFile,
                            processingOptions.compression?.quality || 0.85,
                            targetFormat
                        );
                    } catch (error) {

                        // For TIFF files, try to create a simple conversion
                        const isTIFF = image.isTIFF ||
                            image.type === 'image/tiff' ||
                            image.type === 'image/tif' ||
                            image.name.toLowerCase().endsWith('.tiff') ||
                            image.name.toLowerCase().endsWith('.tif');

                        if (isTIFF) {
                            try {
                                processedFile = await createTIFFPlaceholderFile(image.file);
                            } catch (fallbackError) {
                                // Skip this format
                                continue;
                            }
                        } else {
                            // Skip this format for non-TIFF files
                            continue;
                        }
                    }

                    // Update filename extension if format changed
                    if (targetFormat !== format) {
                        if (processingOptions.output.rename && processingOptions.output.newFileName) {
                            // For renamed files, replace the extension
                            const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;
                            finalName = `${numberedName}.${targetFormat}`;
                        } else {
                            // For original filenames, update with correct extension
                            finalName = `${baseName}.${targetFormat}`;
                        }
                    }
                }

                // Ensure file has correct name
                if (processedFile.name !== finalName) {
                    processedFile = new File([processedFile], finalName, {
                        type: processedFile.type
                    });
                }

                processedImages.push({
                    ...image,
                    file: processedFile,
                    name: finalName,
                    url: URL.createObjectURL(processedFile),
                    processed: true,
                    format: format === 'original'
                        ? image.type?.split('/')[1] || 'webp'
                        : format,
                    operations: {
                        resized: !!resizeResult,
                        cropped: !!cropResult,
                        aiUsed: processingOptions.crop?.mode === 'smart' && aiModelLoaded && !aiUpscalingDisabled && !!cropResult
                    }
                });
            }

        } catch (error) {
            // Create error entries for each format
            for (const format of formats) {
                const baseName = image.name.replace(/\.[^/.]+$/, '');
                let finalName;

                if (processingOptions.output.rename && processingOptions.output.newFileName) {
                    const numberedName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}`;
                    const extension = format === 'original' ? image.name.split('.').pop() : format;
                    finalName = `${numberedName}.${extension}`;
                } else {
                    if (format === 'original') {
                        finalName = image.name;
                    } else {
                        finalName = `${baseName}.${format}`;
                    }
                }

                processedImages.push({
                    ...image,
                    file: null,
                    name: finalName,
                    processed: false,
                    format: format === 'original' ? image.type?.split('/')[1] : format,
                    error: error.message
                });
            }
        }

        // Add small delay between images for better UI responsiveness
        if (i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
            safeCleanupGPUMemory();
        }
    }

    safeCleanupGPUMemory();
    return processedImages;
};

// ================================
// SVG Processing Functions
// ================================

/**
 * Processes SVG image resizing.
 * @async
 * @param {File} svgFile - SVG file to resize
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<File>} Resized SVG file
 */
export const processSVGResize = async (svgFile, width, height) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const svgText = e.target.result;
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                // Get original dimensions safely
                let originalWidth, originalHeight;

                // Try to get width from attributes
                const widthAttr = svgElement.getAttribute('width');
                if (widthAttr && !isNaN(parseFloat(widthAttr))) {
                    originalWidth = parseFloat(widthAttr);
                }

                // Try to get height from attributes
                const heightAttr = svgElement.getAttribute('height');
                if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                    originalHeight = parseFloat(heightAttr);
                }

                // If not found in attributes, try viewBox
                if (!originalWidth || !originalHeight) {
                    const viewBox = svgElement.getAttribute('viewBox');
                    if (viewBox) {
                        const viewBoxParts = viewBox.split(' ').map(parseFloat);
                        if (viewBoxParts.length >= 4) {
                            if (!originalWidth) originalWidth = viewBoxParts[2];
                            if (!originalHeight) originalHeight = viewBoxParts[3];
                        }
                    }
                }

                // Default fallback values
                if (!originalWidth) originalWidth = 100;
                if (!originalHeight) originalHeight = 100;

                const aspectRatio = originalWidth / originalHeight;
                let finalWidth = width;
                let finalHeight = height;

                // If only width is provided, calculate height to maintain aspect ratio
                if (width && !height) {
                    finalWidth = width;
                    finalHeight = Math.round(width / aspectRatio);
                }
                // If only height is provided, calculate width to maintain aspect ratio
                else if (!width && height) {
                    finalHeight = height;
                    finalWidth = Math.round(height * aspectRatio);
                }
                // If both are provided, use them as-is
                else if (width && height) {
                    finalWidth = width;
                    finalHeight = height;
                }
                // If neither is provided, use original dimensions
                else {
                    finalWidth = originalWidth;
                    finalHeight = originalHeight;
                }

                // Set new dimensions
                svgElement.setAttribute('width', finalWidth.toString());
                svgElement.setAttribute('height', finalHeight.toString());

                // Ensure viewBox exists
                if (!svgElement.hasAttribute('viewBox')) {
                    svgElement.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
                }

                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                const serializer = new XMLSerializer();
                const updatedSVG = serializer.serializeToString(svgElement);

                const blob = new Blob([updatedSVG], { type: 'image/svg+xml' });
                const fileName = svgFile.name.replace(/\.svg$/i, `-${finalWidth}x${finalHeight}.svg`);
                resolve(new File([blob], fileName, { type: 'image/svg+xml' }));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(svgFile);
    });
};

/**
 * Converts SVG to raster format while preserving original aspect ratio.
 * @async
 * @param {File} svgFile - SVG file to convert
 * @param {number} targetWidth - Target width (if null/0, uses original SVG width)
 * @param {number} targetHeight - Target height (if null/0, uses original SVG height)
 * @param {string} format - Output format ('png', 'jpg', 'webp')
 * @returns {Promise<File>} Converted raster image file
 */
export const convertSVGToRaster = async (svgFile, targetWidth, targetHeight, format = 'png') => {
    try {
        return await convertSVGToRasterWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    } catch (error) {
        return await createSVGPlaceholderWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    }
};

/**
 * Convert SVG to raster while preserving original aspect ratio
 */
const convertSVGToRasterWithAspectRatio = async (svgFile, targetWidth, targetHeight, format) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            let svgUrl = null;

            try {
                const svgText = e.target.result;

                // Check if SVG content is valid
                if (!svgText || typeof svgText !== 'string') {
                    throw new Error('Empty or invalid SVG content');
                }

                // Trim and check for SVG/XML declaration
                const trimmedText = svgText.trim();
                if (trimmedText.length === 0) {
                    throw new Error('Empty SVG content');
                }

                // If it doesn't look like XML/SVG, try to wrap it
                let finalSvgText = trimmedText;
                if (!trimmedText.startsWith('<')) {
                    // Try to wrap in SVG tags
                    finalSvgText = `<?xml version="1.0" encoding="UTF-8"?>
                    <svg xmlns="http://www.w3.org/2000/svg"
                         width="${targetWidth || 100}"
                         height="${targetHeight || 100}"
                         viewBox="0 0 ${targetWidth || 100} ${targetHeight || 100}">
                        ${trimmedText}
                    </svg>`;
                }

                // Try to parse the SVG
                let svgElement;
                let originalWidth = targetWidth || 100;
                let originalHeight = targetHeight || 100;

                try {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(finalSvgText, 'image/svg+xml');
                    svgElement = svgDoc.documentElement;

                    // Try to extract dimensions
                    try {
                        const widthAttr = svgElement.getAttribute('width');
                        const heightAttr = svgElement.getAttribute('height');

                        if (widthAttr && heightAttr) {
                            const width = parseFloat(widthAttr);
                            const height = parseFloat(heightAttr);
                            if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
                                originalWidth = width;
                                originalHeight = height;
                            }
                        }

                        // Try viewBox
                        const viewBox = svgElement.getAttribute('viewBox');
                        if (viewBox) {
                            const parts = viewBox.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                            if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
                                originalWidth = parts[2];
                                originalHeight = parts[3];
                            }
                        }
                    } catch (dimError) {
                    }

                } catch (parseError) {
                    // Create a minimal valid SVG
                    finalSvgText = `<?xml version="1.0" encoding="UTF-8"?>
                    <svg xmlns="http://www.w3.org/2000/svg"
                         width="${originalWidth}"
                         height="${originalHeight}"
                         viewBox="0 0 ${originalWidth} ${originalHeight}">
                        <rect width="100%" height="100%" fill="#f8f9fa"/>
                        <text x="50%" y="50%" text-anchor="middle" dy=".3em"
                              font-family="Arial" font-size="${Math.min(24, originalHeight / 10)}"
                              fill="#495057" font-weight="bold">
                            SVG
                        </text>
                    </svg>`;
                }

                // Calculate dimensions preserving aspect ratio
                let finalWidth, finalHeight;
                const aspectRatio = originalWidth / originalHeight;

                if (targetWidth && targetHeight) {
                    // Fit within target while preserving aspect ratio
                    const targetAspectRatio = targetWidth / targetHeight;

                    if (aspectRatio > targetAspectRatio) {
                        // SVG is wider than target - fit to width
                        finalWidth = targetWidth;
                        finalHeight = targetWidth / aspectRatio;
                    } else {
                        // SVG is taller than target - fit to height
                        finalHeight = targetHeight;
                        finalWidth = targetHeight * aspectRatio;
                    }
                } else if (targetWidth && !targetHeight) {
                    // Only width specified
                    finalWidth = targetWidth;
                    finalHeight = targetWidth / aspectRatio;
                } else if (!targetWidth && targetHeight) {
                    // Only height specified
                    finalHeight = targetHeight;
                    finalWidth = targetHeight * aspectRatio;
                } else {
                    // No dimensions specified - use original
                    finalWidth = originalWidth;
                    finalHeight = originalHeight;
                }

                // Ensure integer dimensions and minimum size
                finalWidth = Math.max(1, Math.round(finalWidth));
                finalHeight = Math.max(1, Math.round(finalHeight));

                // Create SVG blob
                const svgBlob = new Blob([finalSvgText], { type: 'image/svg+xml' });
                svgUrl = URL.createObjectURL(svgBlob);

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                const ctx = canvas.getContext('2d');

                // Add white background for JPG if needed
                if (format === 'jpg' || format === 'jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                // Load SVG as image
                const img = new Image();

                await new Promise((resolveLoad, rejectLoad) => {
                    const timeout = setTimeout(() => {
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        rejectLoad(new Error('SVG load timeout'));
                    }, 15000);

                    img.onload = () => {
                        clearTimeout(timeout);
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        resolveLoad();
                    };
                    img.onerror = (error) => {
                        clearTimeout(timeout);
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        rejectLoad(new Error('Failed to load SVG image'));
                    };
                    img.src = svgUrl;
                });

                // Draw SVG onto canvas
                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

                // Set output format
                let mimeType, extension;
                switch (format.toLowerCase()) {
                    case 'jpg':
                    case 'jpeg':
                        mimeType = 'image/jpeg';
                        extension = 'jpg';
                        break;
                    case 'png':
                        mimeType = 'image/png';
                        extension = 'png';
                        break;
                    case 'webp':
                        mimeType = 'image/webp';
                        extension = 'webp';
                        break;
                    default:
                        mimeType = 'image/png';
                        extension = 'png';
                }

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create blob'));
                            return;
                        }

                        const baseName = svgFile.name.replace(/\.svg$/i, '');
                        const fileName = `${baseName}-${finalWidth}x${finalHeight}.${extension}`;
                        resolve(new File([blob], fileName, { type: mimeType }));
                    },
                    mimeType,
                    format.toLowerCase() === 'png' ? 0.9 : 0.85
                );

            } catch (error) {
                if (svgUrl) URL.revokeObjectURL(svgUrl);
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read SVG file'));
        reader.readAsText(svgFile);
    });
};

/**
 * Create SVG placeholder that respects aspect ratio
 */
const createSVGPlaceholderWithAspectRatio = async (svgFile, targetWidth, targetHeight, format) => {
    return new Promise((resolve) => {
        // Try to get aspect ratio from filename or use default
        let aspectRatio = 1; // Default square

        // Try to parse dimensions from filename (common pattern: image-16x9.svg)
        const fileName = svgFile.name || '';
        const dimensionMatch = fileName.match(/(\d+)[x×](\d+)/i);
        if (dimensionMatch) {
            const width = parseInt(dimensionMatch[1]);
            const height = parseInt(dimensionMatch[2]);
            if (width > 0 && height > 0) {
                aspectRatio = width / height;
            }
        }

        // Calculate dimensions based on aspect ratio
        let finalWidth, finalHeight;

        if (targetWidth && targetHeight) {
            // Use the larger dimension to maintain aspect ratio
            const targetAspectRatio = targetWidth / targetHeight;

            if (aspectRatio > targetAspectRatio) {
                // SVG is wider than target - use target width
                finalWidth = targetWidth;
                finalHeight = targetWidth / aspectRatio;
            } else {
                // SVG is taller than target - use target height
                finalHeight = targetHeight;
                finalWidth = targetHeight * aspectRatio;
            }
        } else if (targetWidth && !targetHeight) {
            // Only width specified
            finalWidth = targetWidth;
            finalHeight = targetWidth / aspectRatio;
        } else if (!targetWidth && targetHeight) {
            // Only height specified
            finalHeight = targetHeight;
            finalWidth = targetHeight * aspectRatio;
        } else {
            // No dimensions specified - use reasonable defaults
            finalWidth = 400;
            finalHeight = 400 / aspectRatio;
        }

        // Ensure integer dimensions
        finalWidth = Math.round(finalWidth);
        finalHeight = Math.round(finalHeight);

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');

        // Draw background that matches aspect ratio
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw border
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Calculate center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Draw icon
        ctx.fillStyle = '#4a90e2';
        ctx.font = `bold ${Math.min(32, canvas.height / 8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🖋️', centerX, centerY - 30);

        // Draw text
        ctx.fillStyle = '#495057';
        ctx.font = `bold ${Math.min(18, canvas.height / 12)}px Arial`;
        ctx.fillText('SVG', centerX, centerY);

        // Aspect ratio info
        ctx.fillStyle = '#6c757d';
        ctx.font = `${Math.min(14, canvas.height / 16)}px Arial`;
        ctx.fillText(`${Math.round(aspectRatio * 100) / 100}:1`, centerX, centerY + 30);

        // Dimensions
        ctx.fillStyle = '#28a745';
        ctx.font = `${Math.min(12, canvas.height / 20)}px Arial`;
        ctx.fillText(`${finalWidth}×${finalHeight}`, centerX, centerY + 60);

        // Set output format
        let mimeType, extension;
        switch (format.toLowerCase()) {
            case 'jpg':
            case 'jpeg':
                mimeType = 'image/jpeg';
                extension = 'jpg';
                break;
            case 'png':
                mimeType = 'image/png';
                extension = 'png';
                break;
            case 'webp':
                mimeType = 'image/webp';
                extension = 'webp';
                break;
            default:
                mimeType = 'image/png';
                extension = 'png';
        }

        canvas.toBlob((blob) => {
            const baseName = svgFile.name.replace(/\.svg$/i, '') || 'svg-converted';
            const fileName = `${baseName}-${finalWidth}x${finalHeight}.${extension}`;
            resolve(new File([blob], fileName, { type: mimeType }));
        }, mimeType, 0.8);
    });
};

// ================================
// Format Conversion Functions
// ================================
/**
 * Converts legacy formats (TIFF, BMP, ICO) to web-compatible PNG.
 * @async
 * @param {File} imageFile - Legacy format image file
 * @returns {Promise<File>} Converted PNG file
 */
const convertLegacyFormat = async (imageFile) => {
    // Safely get file properties
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const legacyFormats = ['image/tiff', 'image/tif', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    if (!legacyFormats.includes(mimeType) && !isTIFF) {
        return imageFile;
    }

    // Try multiple conversion methods for TIFF
    if (isTIFF) {
        try {
            return await convertTIFFForProcessing(imageFile);
        } catch (error) {
            return await createTIFFPlaceholderFile(imageFile);
        }
    }

    // Standard conversion for other legacy formats (BMP, ICO)
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image load timeout'));
        }, 30000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');

                // Draw the image
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (!blob) {
                        reject(new Error('Failed to convert legacy format'));
                        return;
                    }

                    const originalName = imageFile.name || 'converted-image';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newFileName = `${baseName}.png`;

                    const convertedFile = new File([blob], newFileName, { type: 'image/png' });
                    resolve(convertedFile);

                }, 'image/png', 1.0);

            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Failed to convert ${mimeType}: ${error.message}`));
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);

            // For BMP/ICO files that fail to load, create a placeholder
            if (fileName.endsWith('.bmp') || fileName.endsWith('.ico')) {
                createSimpleLegacyConversion(imageFile)
                    .then(resolve)
                    .catch(() => reject(new Error(`Failed to load ${mimeType} image`)));
            } else {
                reject(new Error(`Failed to load ${mimeType} image`));
            }
        };

        img.src = objectUrl;
    });
};

/**
 * Convert TIFF with browser's built-in support
 */
const convertTIFFWithBrowser = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(tiffFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('TIFF load timeout'));
        }, 30000);

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
                        reject(new Error('Failed to create PNG'));
                        return;
                    }

                    const originalName = tiffFile.name || 'converted-tiff';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newFileName = `${baseName}.png`;

                    resolve(new File([blob], newFileName, { type: 'image/png' }));

                }, 'image/png', 1.0);

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
 * Create a placeholder file for TIFF when conversion fails
 */
const createTIFFPlaceholderFile = async (tiffFile, targetWidth = null, targetHeight = null) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');

        // Try to get original dimensions from the file name or metadata
        let originalWidth = 800;
        let originalHeight = 600;

        // Check if we have target dimensions
        if (targetWidth && targetHeight) {
            originalWidth = targetWidth;
            originalHeight = targetHeight;
        } else {
            // Try to parse dimensions from filename (common pattern: image-1920x1080.tiff)
            const fileName = tiffFile.name || '';
            const dimensionMatch = fileName.match(/(\d+)x(\d+)/);
            if (dimensionMatch) {
                originalWidth = parseInt(dimensionMatch[1]);
                originalHeight = parseInt(dimensionMatch[2]);
            }
        }

        // Set canvas to original aspect ratio
        const maxSize = 800;
        let canvasWidth, canvasHeight;

        if (originalWidth > originalHeight) {
            canvasWidth = Math.min(maxSize, originalWidth);
            canvasHeight = Math.round((originalHeight / originalWidth) * canvasWidth);
        } else {
            canvasHeight = Math.min(maxSize, originalHeight);
            canvasWidth = Math.round((originalWidth / originalHeight) * canvasHeight);
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        // Draw background with gradient
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw border
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvasWidth - 20, canvasHeight - 20);

        // Calculate text position based on canvas size
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // Draw icon
        ctx.fillStyle = '#6c757d';
        ctx.font = `bold ${Math.min(48, canvasHeight / 8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🖼️', centerX, centerY - (canvasHeight / 10));

        // Draw text
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

        // Convert to PNG
        canvas.toBlob((blob) => {
            const newName = tiffFile.name ?
                tiffFile.name.replace(/\.(tiff|tif)$/i, '.png') :
                'converted-tiff.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

/**
 * Optimizes image for web with transparency handling and legacy format support.
 * @async
 * @param {File} imageFile - Image file to optimize
 * @param {number} quality - Compression quality (0-1)
 * @param {string} format - Output format ('webp', 'jpg', 'png')
 * @returns {Promise<File>} Optimized image file
 * @throws {Error} If invalid image file provided
 */
/**
 * Optimizes image for web with transparency handling and legacy format support.
 * @async
 * @param {File} imageFile - Image file to optimize
 * @param {number} quality - Compression quality (0-1)
 * @param {string} format - Output format ('webp', 'jpg', 'png', 'avif', 'original')
 * @returns {Promise<File>} Optimized image file
 * @throws {Error} If invalid image file provided
 */
export const optimizeForWeb = async (imageFile, quality = 0.8, format = 'webp') => {
    // Safely check file properties
    if (!imageFile || typeof imageFile !== 'object') {
        throw new Error('Invalid image file provided to optimizeForWeb');
    }

    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    // Check if this is a TIFF file
    const isTIFF = fileName.endsWith('.tiff') || fileName.endsWith('.tif') ||
        mimeType === 'image/tiff' || mimeType === 'image/tif';

    // Handle SVG files specially
    if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
        try {
            return await convertSVGToRaster(imageFile, 1000, 1000, format);
        } catch (svgError) {
            return await createSVGPlaceholderWithAspectRatio(imageFile, 1000, 1000, format);
        }
    }

    // Check for legacy formats
    const legacyFormats = [
        'image/tiff', 'image/tif', 'image/bmp',
        'image/x-icon', 'image/vnd.microsoft.icon'
    ];

    const isLegacyFormat = legacyFormats.includes(mimeType) ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif') ||
        fileName.endsWith('.bmp') || fileName.endsWith('.ico');

    let processedFile = imageFile;

    // Convert legacy formats first
    if (isLegacyFormat) {
        try {
            // For TIFF files, use the improved converter
            if (isTIFF) {
                processedFile = await convertTIFFForProcessing(imageFile);
            } else {
                // For other legacy formats
                processedFile = await convertLegacyFormat(imageFile);
            }
        } catch (error) {
            // Create appropriate placeholder
            if (isTIFF) {
                processedFile = await createTIFFPlaceholderFile(imageFile);
            } else {
                processedFile = await createSimpleLegacyConversion(imageFile);
            }
        }
    }

    // Check if user wants to keep original format
    if (format === 'original') {
        // If we converted a legacy format, return the converted file
        if (isLegacyFormat) {
            return processedFile;
        }
        // Otherwise return original file with original format
        return imageFile;
    }

    // For TIFF files that were successfully converted, proceed with optimization
    // [Rest of the optimizeForWeb function remains the same...]
    const supportsAVIF = await checkAVIFSupport();
    const hasTransparency = await checkImageTransparency(processedFile);

    // For JPG format with transparency, we need to add white background
    const needsWhiteBackground = (format === 'jpg' || format === 'jpeg') && hasTransparency;

    return new Promise((resolve, reject) => {
        const img = new Image();
        let objectUrl;

        try {
            objectUrl = URL.createObjectURL(processedFile);
        } catch (error) {
            reject(new Error('Failed to create object URL for image'));
            return;
        }

        // Set timeout for image loading
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image load timeout'));
        }, 30000);

        img.onload = () => {
            clearTimeout(timeout);

            try {
                // Ensure natural dimensions are valid
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Image has invalid dimensions'));
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                // Add white background for JPG if image has transparency
                if (needsWhiteBackground) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                // Draw the image
                ctx.drawImage(img, 0, 0);

                let mimeType, extension;
                let targetQuality = quality;

                switch (format.toLowerCase()) {
                    case 'jpg':
                    case 'jpeg':
                        mimeType = 'image/jpeg';
                        extension = 'jpg';
                        break;
                    case 'png':
                        mimeType = 'image/png';
                        extension = 'png';
                        // PNG uses undefined for lossless compression
                        targetQuality = undefined;
                        break;
                    case 'webp':
                        mimeType = 'image/webp';
                        extension = 'webp';
                        break;
                    case 'avif':
                        if (!supportsAVIF) {
                            mimeType = 'image/webp';
                            extension = 'webp';
                        } else {
                            mimeType = 'image/avif';
                            extension = 'avif';
                        }
                        break;
                    default:
                        mimeType = 'image/webp';
                        extension = 'webp';
                }

                // Convert to blob
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }
                    const originalName = imageFile.name || 'image';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newName = `${baseName}.${extension}`;
                    resolve(new File([blob], newName, { type: mimeType }));
                }, mimeType, targetQuality);

            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Error processing image: ${error.message}`));
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);

            // For TIFF files that fail to load, create a placeholder
            if (isTIFF) {
                createTIFFPlaceholderFile(imageFile)
                    .then((placeholderFile) => {
                        // Try to optimize the placeholder
                        optimizeForWeb(placeholderFile, quality, format)
                            .then(resolve)
                            .catch(() => {
                                // If optimization fails, return the placeholder as-is
                                resolve(placeholderFile);
                            });
                    })
                    .catch(() => {
                        reject(new Error('Failed to create TIFF placeholder'));
                    });
            } else {
                reject(new Error('Failed to load image'));
            }
        };

        img.src = objectUrl;
    });
};

/**
 * Convert SVG to raster and then crop it (proper order: convert first, then crop)
 * @async
 * @param {File} svgFile - SVG file to process
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string} format - Output format
 * @param {string} cropPosition - Crop position
 * @returns {Promise<File>} Cropped raster image
 */
export const convertSVGToRasterAndCrop = async (svgFile, targetWidth, targetHeight, format = 'webp', cropPosition = 'center') => {
    try {
        // Step 1: Convert SVG to raster first (with larger size to preserve quality)
        const scaleFactor = 2; // Convert at higher resolution for better quality
        const conversionWidth = Math.max(targetWidth, 500) * scaleFactor;
        const conversionHeight = Math.max(targetHeight, 500) * scaleFactor;

        const rasterFile = await convertSVGToRaster(svgFile, conversionWidth, conversionHeight, 'png');

        // Step 2: Now crop the raster image to target dimensions
        const cropResults = await processLemGendaryCrop(
            [{ file: rasterFile, name: svgFile.name }],
            targetWidth,
            targetHeight,
            cropPosition,
            { quality: 0.9, format: format }
        );

        if (cropResults.length > 0 && cropResults[0].cropped) {
            return cropResults[0].cropped;
        }

        throw new Error('Crop operation failed');

    } catch (error) {
        // Fallback: create a placeholder with the target dimensions
        return await createSVGPlaceholderWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    }
};

/**
 * Simple conversion for legacy formats when main conversion fails
 */
const createSimpleLegacyConversion = async (imageFile) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const fileName = imageFile.name.toLowerCase();

        // Set canvas size based on file type
        let width = 800;
        let height = 600;

        // Try to parse dimensions from filename
        const dimensionMatch = fileName.match(/(\d+)x(\d+)/);
        if (dimensionMatch) {
            width = parseInt(dimensionMatch[1]);
            height = parseInt(dimensionMatch[2]);
        }

        // Limit size
        const maxSize = 1200;
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw informative placeholder
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        // Draw border
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        // Determine file type for display
        let fileType = 'File';
        if (fileName.endsWith('.tiff') || fileName.endsWith('.tif')) fileType = 'TIFF';
        else if (fileName.endsWith('.bmp')) fileType = 'BMP';
        else if (fileName.endsWith('.ico')) fileType = 'ICO';

        // Calculate center
        const centerX = width / 2;
        const centerY = height / 2;

        // Draw icon
        ctx.fillStyle = '#6c757d';
        ctx.font = `bold ${Math.min(48, height / 8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📄', centerX, centerY - 50);

        // Draw file type
        ctx.fillStyle = '#343a40';
        ctx.font = `bold ${Math.min(24, height / 12)}px Arial`;
        ctx.fillText(fileType, centerX, centerY);

        // Draw dimensions
        ctx.fillStyle = '#28a745';
        ctx.font = `${Math.min(16, height / 16)}px Arial`;
        ctx.fillText(`${width} × ${height}`, centerX, centerY + 40);

        // Draw filename
        ctx.fillStyle = '#6c757d';
        ctx.font = `${Math.min(14, height / 20)}px Arial`;
        const displayName = imageFile.name.length > 30 ?
            imageFile.name.substring(0, 27) + '...' : imageFile.name;
        ctx.fillText(displayName, centerX, centerY + 80);

        // Convert to PNG
        canvas.toBlob((blob) => {
            const newName = imageFile.name ?
                imageFile.name.replace(/\.[^/.]+$/, '.png') : 'converted.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

// ================================
// Utility Functions
// ================================

/**
 * Creates image objects from file arrays with TIFF preview support.
 * @param {Array<File>} files - Array of image files
 * @returns {Array<Object>} Array of image objects
 */
export const createImageObjects = (files) => {
    return Promise.all(Array.from(files).map(async (file) => {
        const fileObj = file instanceof File ? file : new File([file], file.name || 'image', { type: file.type });

        // Check file types
        const fileName = fileObj.name ? fileObj.name.toLowerCase() : '';
        const mimeType = fileObj.type ? fileObj.type.toLowerCase() : '';

        const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
            fileName.endsWith('.tiff') || fileName.endsWith('.tif');
        const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

        let url;
        let previewData = null;
        let originalWidth = null;
        let originalHeight = null;

        if (isTIFF) {
            try {
                // Try to convert TIFF to PNG for preview
                const converted = await convertTIFFForProcessing(fileObj);

                // Load the converted image to get dimensions
                const img = new Image();
                const objectUrl = URL.createObjectURL(converted);

                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        originalWidth = img.naturalWidth;
                        originalHeight = img.naturalHeight;
                        resolve();
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Failed to load converted TIFF'));
                    };
                    img.src = objectUrl;
                });

                url = URL.createObjectURL(converted);
                previewData = {
                    blob: converted,
                    width: originalWidth,
                    height: originalHeight
                };

            } catch (error) {
                // Create a simple placeholder
                url = createTIFFPlaceholder();
            }
        } else if (isSVG) {
            // For SVG files, create a raster preview
            try {
                // First parse SVG to get dimensions
                const svgText = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(fileObj);
                });

                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                // Get dimensions
                let width = 200;
                let height = 200;

                const widthAttr = svgElement.getAttribute('width');
                const heightAttr = svgElement.getAttribute('height');
                if (widthAttr && heightAttr) {
                    width = parseFloat(widthAttr);
                    height = parseFloat(heightAttr);
                } else {
                    const viewBox = svgElement.getAttribute('viewBox');
                    if (viewBox) {
                        const parts = viewBox.split(' ').map(parseFloat);
                        if (parts.length >= 4) {
                            width = parts[2];
                            height = parts[3];
                        }
                    }
                }

                // Create preview
                const previewFile = await convertSVGToRaster(fileObj, Math.min(200, width), Math.min(200, height), 'png');
                url = URL.createObjectURL(previewFile);
                originalWidth = width;
                originalHeight = height;

            } catch (error) {
                url = createTIFFPlaceholder(); // Use same placeholder for SVG
            }
        } else {
            url = URL.createObjectURL(fileObj);
        }

        return {
            id: Date.now() + Math.random(),
            file: fileObj,
            name: fileObj.name,
            url: url,
            size: fileObj.size,
            type: fileObj.type,
            optimized: false,
            isTIFF: isTIFF,
            isSVG: isSVG,
            previewData: previewData,
            originalFormat: isTIFF ? 'tiff' : (isSVG ? 'svg' : fileObj.type.split('/')[1]),
            originalWidth: originalWidth,
            originalHeight: originalHeight,
            hasPreview: true
        };
    }));
};

/**
 * Converts TIFF file to PNG for processing
 */
const convertTIFFForProcessing = async (tiffFile) => {
    try {
        // Method 1: Try simple browser loading first (fastest if it works)
        try {
            const result = await convertTIFFSimple(tiffFile);
            return result;
        } catch (simpleError) {
        }

        // Method 2: Try UTIF.js with extensive error handling
        if (window.UTIF && typeof window.UTIF.decode === 'function') {
            try {
                const result = await convertTIFFWithUTIFRobust(tiffFile);
                return result;
            } catch (utifError) {
            }
        }

        // Method 3: Try to extract basic info and create placeholder
        try {
            return await createTIFFPlaceholderFromInfo(tiffFile);
        } catch (placeholderError) {
        }

        // Method 4: Ultimate fallback - generic placeholder
        return await createTIFFPlaceholderFile(tiffFile);

    } catch (error) {
        return await createTIFFPlaceholderFile(tiffFile);
    }
};

/**
 * Create TIFF placeholder from file info when decoding fails
 */
const createTIFFPlaceholderFromInfo = async (tiffFile) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');

        // Try to get dimensions from filename
        const fileName = tiffFile.name || '';
        let width = 800;
        let height = 600;

        const dimensionMatch = fileName.match(/(\d+)[x×](\d+)/i);
        if (dimensionMatch) {
            width = parseInt(dimensionMatch[1]);
            height = parseInt(dimensionMatch[2]);
        }

        // Limit size
        const maxSize = 1200;
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw placeholder
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#4a90e2');
        gradient.addColorStop(0.5, '#5cb85c');
        gradient.addColorStop(1, '#f0ad4e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw camera icon
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(60, width / 10)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', width / 2, height / 2 - 40);

        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(24, width / 20)}px Arial`;
        ctx.fillText('TIFF Image', width / 2, height / 2 + 20);

        ctx.font = `${Math.min(16, width / 30)}px Arial`;
        ctx.fillText(`${width} × ${height}`, width / 2, height / 2 + 60);

        // Convert to PNG
        canvas.toBlob((blob) => {
            const newName = fileName ?
                fileName.replace(/\.(tiff|tif)$/i, '.png') :
                'converted-tiff.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

/**
 * Robust UTIF.js conversion with comprehensive error handling
 */
const convertTIFFWithUTIFRobust = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;

                // Decode TIFF
                let ifds;
                try {
                    ifds = window.UTIF.decode(arrayBuffer);
                    if (!ifds || ifds.length === 0) {
                        throw new Error('No TIFF data found');
                    }
                } catch (decodeError) {
                    reject(new Error(`TIFF decode failed: ${decodeError.message}`));
                    return;
                }

                // Get first image
                const firstIFD = ifds[0];

                // Try to decode image
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
                }

                // Extract dimensions with multiple fallbacks
                let width = 800;
                let height = 600;

                // Try multiple possible dimension properties
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

                // Find width
                for (const source of widthSources) {
                    if (source && typeof source === 'number' && source > 0 && source < 100000) {
                        width = Math.round(source);
                        break;
                    }
                }

                // Find height
                for (const source of heightSources) {
                    if (source && typeof source === 'number' && source > 0 && source < 100000) {
                        height = Math.round(source);
                        break;
                    }
                }

                // Try to get RGBA data, but handle failures gracefully
                let rgba;
                let rgbaSuccess = false;

                if (decodeSuccess) {
                    try {
                        rgba = window.UTIF.toRGBA8(firstIFD);
                        if (rgba && rgba.length > 0 && rgba.length >= (width * height * 2)) {
                            // Basic validation: ensure we have at least some pixel data
                            rgbaSuccess = true;
                        } else {
                        }
                    } catch (rgbaError) {
                    }
                }

                if (rgbaSuccess) {
                    // Create canvas with the RGBA data
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    const imageData = ctx.createImageData(width, height);

                    // Validate and copy RGBA data
                    const expectedLength = width * height * 4;
                    if (rgba.length === expectedLength) {
                        imageData.data.set(rgba);
                    } else {
                        // Handle length mismatch
                        const copyLength = Math.min(rgba.length, expectedLength);
                        imageData.data.set(rgba.subarray(0, copyLength));

                        // Fill remaining with white
                        for (let i = copyLength; i < expectedLength; i += 4) {
                            imageData.data[i] = 255;     // R
                            imageData.data[i + 1] = 255; // G
                            imageData.data[i + 2] = 255; // B
                            imageData.data[i + 3] = 255; // A
                        }
                    }

                    ctx.putImageData(imageData, 0, 0);

                    // Convert to PNG
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create PNG'));
                            return;
                        }

                        const originalName = tiffFile.name || 'converted-tiff';
                        const baseName = originalName.replace(/\.[^/.]+$/, '');
                        const newFileName = `${baseName}.png`;

                        resolve(new File([blob], newFileName, { type: 'image/png' }));

                    }, 'image/png', 1.0);
                } else {
                    // Create placeholder canvas with extracted dimensions
                    const canvas = document.createElement('canvas');

                    // Limit size for placeholder
                    const maxSize = 1200;
                    if (width > maxSize || height > maxSize) {
                        const scale = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    // Draw gradient background
                    const gradient = ctx.createLinearGradient(0, 0, width, height);
                    gradient.addColorStop(0, '#4a90e2');
                    gradient.addColorStop(0.5, '#5cb85c');
                    gradient.addColorStop(1, '#f0ad4e');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);

                    // Draw border
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(20, 20, width - 40, height - 40);

                    // Calculate center
                    const centerX = width / 2;
                    const centerY = height / 2;

                    // Draw camera icon
                    ctx.fillStyle = '#ffffff';
                    const iconSize = Math.min(60, width / 8);
                    ctx.font = `bold ${iconSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('📷', centerX, centerY - 50);

                    // Draw file type
                    ctx.fillStyle = '#ffffff';
                    const titleSize = Math.min(28, width / 15);
                    ctx.font = `bold ${titleSize}px Arial`;
                    ctx.fillText('TIFF Image', centerX, centerY);

                    // Draw dimensions
                    const infoSize = Math.min(18, width / 25);
                    ctx.font = `${infoSize}px Arial`;
                    ctx.fillText(`${width} × ${height}`, centerX, centerY + 40);

                    // Draw status
                    ctx.fillStyle = '#ff6b6b';
                    ctx.font = `${Math.min(14, width / 30)}px Arial`;
                    ctx.fillText('Preview Not Available', centerX, centerY + 80);

                    // Convert to PNG
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create placeholder'));
                            return;
                        }

                        const originalName = tiffFile.name || 'converted-tiff';
                        const baseName = originalName.replace(/\.[^/.]+$/, '');
                        const newFileName = `${baseName}.png`;
                        resolve(new File([blob], newFileName, { type: 'image/png' }));
                    }, 'image/png', 0.95);
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
 * Simple TIFF conversion using browser's image capabilities
 */
const convertTIFFSimple = (tiffFile) => {
    return new Promise((resolve, reject) => {
        // Create object URL
        const objectUrl = URL.createObjectURL(tiffFile);
        const img = new Image();

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('TIFF load timeout'));
        }, 15000);

        img.onload = () => {
            clearTimeout(timeout);

            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');

                // Draw the image
                ctx.drawImage(img, 0, 0);

                // Convert to PNG
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(objectUrl);

                    if (!blob) {
                        reject(new Error('Failed to create PNG'));
                        return;
                    }

                    const originalName = tiffFile.name || 'converted-tiff';
                    const baseName = originalName.replace(/\.[^/.]+$/, '');
                    const newFileName = `${baseName}.png`;

                    resolve(new File([blob], newFileName, { type: 'image/png' }));

                }, 'image/png', 1.0);

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
 * Creates a placeholder SVG for TIFF files when conversion fails
 */
const createTIFFPlaceholder = () => {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#f8f9fa"/>
            <rect x="10" y="10" width="180" height="180" fill="#ffffff" stroke="#dee2e6" stroke-width="2"/>
            <text x="100" y="90" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#495057" font-weight="bold">TIFF</text>
            <text x="100" y="130" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#6c757d">File</text>
            <text x="100" y="170" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#28a745">Preview not available</text>
        </svg>
    `);
};

/**
 * Cleans up blob URLs from image objects.
 * @param {Array<Object>} imageObjects - Array of image objects with URLs
 * @returns {void}
 */
export const cleanupBlobUrls = (imageObjects) => {
    imageObjects?.forEach(image => {
        // Clean up main URL
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
            } catch (e) {
                // Ignore errors
            }
        }

        // Clean up TIFF preview data
        if (image.previewData && image.previewData.url) {
            try {
                URL.revokeObjectURL(image.previewData.url);
            } catch (e) {
                // Ignore errors
            }
        }

        // Clean up any canvas references
        if (image.previewData && image.previewData.canvas) {
            try {
                // Clear canvas to free memory
                const ctx = image.previewData.canvas.getContext('2d');
                ctx.clearRect(0, 0, image.previewData.canvas.width, image.previewData.canvas.height);
            } catch (e) {
                // Ignore errors
            }
        }
    });
};

/**
 * Ensures an image object has a valid File object.
 * @async
 * @param {Object} image - Image object
 * @returns {Promise<File>} Valid file object
 * @throws {Error} If no valid file data found
 */
export const ensureFileObject = async (image) => {
    if (image.file instanceof File || image.file instanceof Blob) {
        return image.file;
    }

    if (image.url && image.url.startsWith('blob:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            throw new Error('Invalid image file');
        }
    }

    if (image.url && image.url.startsWith('data:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            throw new Error('Invalid image file');
        }
    }

    throw new Error('No valid file data found');
};

/**
 * Checks if an image has transparency.
 * @async
 * @param {File} file - Image file to check
 * @returns {Promise<boolean>} True if image has transparency
 */
export const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
        // Safely handle file object
        if (!file || typeof file !== 'object') {
            resolve(false);
            return;
        }

        const fileName = file.name ? file.name.toLowerCase() : '';
        const mimeType = file.type ? file.type.toLowerCase() : '';

        // Early returns for non-transparent formats
        const nonTransparentFormats = [
            'image/jpeg', 'image/jpg', 'image/bmp',
            'image/tiff', 'image/tif', 'image/x-icon',
            'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
        ];

        // Check file extension
        if (fileName.endsWith('.jpeg') || fileName.endsWith('.jpg') ||
            fileName.endsWith('.bmp') || fileName.endsWith('.tiff') ||
            fileName.endsWith('.tif') || fileName.endsWith('.ico') ||
            fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
            resolve(false);
            return;
        }

        // Check MIME type
        if (mimeType && nonTransparentFormats.includes(mimeType)) {
            resolve(false);
            return;
        }

        // SVG handling
        if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const svgText = e.target.result;

                    // Quick regex checks for common transparency indicators
                    const hasTransparency =
                        // Opacity attributes
                        svgText.includes('opacity=') ||
                        svgText.includes('opacity:') ||
                        svgText.includes('fill-opacity=') ||
                        svgText.includes('stroke-opacity=') ||
                        // RGBA colors
                        svgText.match(/rgba\([^)]+\)/i) ||
                        svgText.match(/hsla\([^)]+\)/i) ||
                        // Transparent fill/stroke
                        svgText.includes('fill="none"') ||
                        svgText.includes('stroke="none"') ||
                        svgText.includes('fill: none') ||
                        svgText.includes('stroke: none') ||
                        svgText.includes('fill:#00000000') ||
                        svgText.includes('fill:#fff0') ||
                        svgText.includes('fill: transparent') ||
                        svgText.includes('stroke: transparent') ||
                        // CSS class with opacity
                        svgText.match(/\.\w+\s*{[^}]*opacity:/i) ||
                        // CSS style with rgba
                        svgText.match(/style="[^"]*rgba\([^)]+\)[^"]*"/i);

                    resolve(hasTransparency);
                } catch (error) {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file);
            return;
        }

        // GIF handling (indexed transparency)
        if (mimeType === 'image/gif' || fileName.endsWith('.gif')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);

                    // GIF format has transparency flag in byte 11
                    // Check for GIF89a with transparency
                    if (bytes.length >= 13) {
                        // Check GIF signature (GIF89a)
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
                            // Byte 10 contains packed fields
                            const packedFields = bytes[10];
                            // Check if transparency flag is set (bit 0 of byte 10)
                            const hasColorTable = (packedFields & 0x80) !== 0;
                            const colorTableSize = packedFields & 0x07;

                            if (hasColorTable && bytes.length >= 14 + (3 * (1 << (colorTableSize + 1)))) {
                                // Check if transparency is enabled (byte 11 is present if flag is set)
                                // Actually, transparency is indicated by the presence of a Graphic Control Extension
                                // Look for Graphic Control Extension (0x21 0xF9)
                                for (let i = 13; i < bytes.length - 1; i++) {
                                    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
                                        if (i + 4 < bytes.length) {
                                            // Byte at i+4 contains transparency flag (bit 0)
                                            const transparencyFlag = (bytes[i + 4] & 0x01) !== 0;
                                            resolve(transparencyFlag);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    resolve(false);
                } catch (error) {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file);
            return;
        }

        // For PNG, WebP, AVIF, APNG - need to load the image
        const transparentFormats = [
            'image/png', 'image/webp', 'image/avif', 'image/apng',
            'image/x-png', 'image/x-webp'
        ];

        const isTransparentFormat = transparentFormats.includes(mimeType) ||
            fileName.endsWith('.png') ||
            fileName.endsWith('.webp') ||
            fileName.endsWith('.avif') ||
            fileName.endsWith('.apng');

        if (!isTransparentFormat) {
            resolve(false);
            return;
        }

        // Create image element to check pixel data
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        // Set timeout for safety
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            resolve(false);
        }, 10000);

        img.onload = () => {
            clearTimeout(timeout);

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                // Clear canvas first
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw image
                ctx.drawImage(img, 0, 0);

                const totalPixels = canvas.width * canvas.height;

                // For very large images, use sampling
                if (totalPixels > 1000000) {
                    // Create a smaller version for checking
                    const sampleCanvas = document.createElement('canvas');
                    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

                    // Calculate sample size (max 1000x1000 pixels)
                    const maxSampleSize = 1000;
                    let sampleWidth, sampleHeight;

                    if (canvas.width > canvas.height) {
                        sampleWidth = Math.min(maxSampleSize, canvas.width);
                        sampleHeight = Math.round(canvas.height * (sampleWidth / canvas.width));
                    } else {
                        sampleHeight = Math.min(maxSampleSize, canvas.height);
                        sampleWidth = Math.round(canvas.width * (sampleHeight / canvas.height));
                    }

                    sampleCanvas.width = sampleWidth;
                    sampleCanvas.height = sampleHeight;

                    // Draw scaled version
                    sampleCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height,
                        0, 0, sampleWidth, sampleHeight);

                    // Check sample
                    const sampleData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

                    // Check every pixel in sample
                    for (let i = 3; i < sampleData.length; i += 4) {
                        if (sampleData[i] < 255) {
                            URL.revokeObjectURL(objectUrl);
                            resolve(true);
                            return;
                        }
                    }

                    // Also check key areas in original (corners and center)
                    const keyAreas = [
                        // Corners
                        { x: 0, y: 0, width: 1, height: 1 },
                        { x: canvas.width - 1, y: 0, width: 1, height: 1 },
                        { x: 0, y: canvas.height - 1, width: 1, height: 1 },
                        { x: canvas.width - 1, y: canvas.height - 1, width: 1, height: 1 },
                        // Center
                        { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2), width: 1, height: 1 },
                        // Edges
                        { x: Math.floor(canvas.width / 2), y: 0, width: 1, height: 1 },
                        { x: 0, y: Math.floor(canvas.height / 2), width: 1, height: 1 },
                        { x: canvas.width - 1, y: Math.floor(canvas.height / 2), width: 1, height: 1 },
                        { x: Math.floor(canvas.width / 2), y: canvas.height - 1, width: 1, height: 1 }
                    ];

                    for (const area of keyAreas) {
                        try {
                            const areaData = ctx.getImageData(area.x, area.y, area.width, area.height).data;
                            if (areaData[3] < 255) {
                                URL.revokeObjectURL(objectUrl);
                                resolve(true);
                                return;
                            }
                        } catch (error) {
                            // Skip if we can't access this area
                        }
                    }

                    URL.revokeObjectURL(objectUrl);
                    resolve(false);
                } else {
                    // For smaller images, check all pixels
                    try {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;

                        // Check every 4th pixel (alpha channel) with stride for performance
                        let stride = 1;
                        if (totalPixels > 250000) stride = 4;
                        else if (totalPixels > 100000) stride = 2;

                        for (let i = 3; i < data.length; i += 4 * stride) {
                            if (data[i] < 255) {
                                URL.revokeObjectURL(objectUrl);
                                resolve(true);
                                return;
                            }
                        }

                        // If no transparent pixels found with stride, check corners and center
                        if (stride > 1) {
                            const checkPixels = [
                                { x: 0, y: 0 },
                                { x: canvas.width - 1, y: 0 },
                                { x: 0, y: canvas.height - 1 },
                                { x: canvas.width - 1, y: canvas.height - 1 },
                                { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) }
                            ];

                            for (const pixel of checkPixels) {
                                const idx = (pixel.y * canvas.width + pixel.x) * 4;
                                if (data[idx + 3] < 255) {
                                    URL.revokeObjectURL(objectUrl);
                                    resolve(true);
                                    return;
                                }
                            }
                        }

                        URL.revokeObjectURL(objectUrl);
                        resolve(false);
                    } catch (error) {
                        // Fallback to sampling method
                        try {
                            const hasTransparency = checkTransparencyBySampling(ctx, canvas.width, canvas.height);
                            URL.revokeObjectURL(objectUrl);
                            resolve(hasTransparency);
                        } catch (samplingError) {
                            URL.revokeObjectURL(objectUrl);
                            resolve(false);
                        }
                    }
                }
            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                resolve(false);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            resolve(false);
        };

        img.src = objectUrl;
    });
};


/**
 * Helper function to check transparency by sampling when full pixel access is restricted.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {boolean} True if transparency detected
 */
const checkTransparencyBySampling = (ctx, width, height) => {
    try {
        // Create a smaller version for sampling
        const sampleWidth = Math.min(100, width);
        const sampleHeight = Math.min(100, height);
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = sampleWidth;
        sampleCanvas.height = sampleHeight;
        const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

        // Draw scaled version
        sampleCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, sampleWidth, sampleHeight);

        // Check sample
        const sampleData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

        // Check every pixel
        for (let i = 3; i < sampleData.length; i += 4) {
            if (sampleData[i] < 255) {
                return true;
            }
        }

        return false;
    } catch (error) {
        return false;
    }
};
/**
 * Enhanced version that also returns transparency type for better format selection.
 * @async
 * @param {File} file - Image file to check
 * @returns {Promise<Object>} Transparency details object
 */
export const checkImageTransparencyDetailed = async (file) => {
    return new Promise((resolve) => {
        // Quick format checks
        const nonTransparentFormats = [
            'image/jpeg', 'image/jpg', 'image/bmp',
            'image/tiff', 'image/tif', 'image/x-icon',
            'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
        ];

        const fileName = file.name.toLowerCase();
        const mimeType = file.type.toLowerCase();

        // Check if it's definitely non-transparent
        if (nonTransparentFormats.includes(mimeType) ||
            fileName.endsWith('.jpeg') || fileName.endsWith('.jpg') ||
            fileName.endsWith('.bmp') || fileName.endsWith('.tiff') ||
            fileName.endsWith('.tif') || fileName.endsWith('.ico') ||
            fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
            resolve({
                hasTransparency: false,
                type: 'opaque',
                alphaChannel: false,
                format: mimeType.split('/')[1] || fileName.split('.').pop()
            });
            return;
        }

        // SVG special handling
        if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const svgText = e.target.result;
                    const hasTransparency =
                        svgText.includes('opacity=') ||
                        svgText.includes('opacity:') ||
                        svgText.includes('fill-opacity=') ||
                        svgText.includes('stroke-opacity=') ||
                        svgText.match(/rgba\([^)]+\)/i) ||
                        svgText.match(/hsla\([^)]+\)/i) ||
                        svgText.includes('fill="none"') ||
                        svgText.includes('stroke="none"') ||
                        svgText.includes('fill: none') ||
                        svgText.includes('stroke: none') ||
                        svgText.includes('fill:#00000000') ||
                        svgText.includes('fill: transparent') ||
                        svgText.includes('stroke: transparent');

                    resolve({
                        hasTransparency,
                        type: hasTransparency ? 'svg-transparency' : 'opaque',
                        alphaChannel: false, // SVG doesn't have alpha channel in the same way
                        format: 'svg'
                    });
                } catch (error) {
                    resolve({
                        hasTransparency: false,
                        type: 'unknown',
                        alphaChannel: false,
                        format: 'svg'
                    });
                }
            };
            reader.onerror = () => resolve({
                hasTransparency: false,
                type: 'unknown',
                alphaChannel: false,
                format: 'svg'
            });
            reader.readAsText(file);
            return;
        }

        // GIF special handling
        if (mimeType === 'image/gif' || fileName.endsWith('.gif')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);
                    let hasTransparency = false;

                    if (bytes.length >= 13) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
                            // Look for Graphic Control Extension (0x21 0xF9)
                            for (let i = 13; i < bytes.length - 1; i++) {
                                if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
                                    if (i + 4 < bytes.length) {
                                        hasTransparency = (bytes[i + 4] & 0x01) !== 0;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    resolve({
                        hasTransparency,
                        type: hasTransparency ? 'gif-transparency' : 'opaque',
                        alphaChannel: false, // GIF uses indexed transparency
                        format: 'gif'
                    });
                } catch (error) {
                    resolve({
                        hasTransparency: false,
                        type: 'unknown',
                        alphaChannel: false,
                        format: 'gif'
                    });
                }
            };
            reader.onerror = () => resolve({
                hasTransparency: false,
                type: 'unknown',
                alphaChannel: false,
                format: 'gif'
            });
            reader.readAsArrayBuffer(file);
            return;
        }

        // For other formats, use the standard check
        checkImageTransparency(file).then((hasTransparency) => {
            // Determine format
            let format = 'unknown';
            if (mimeType.includes('png')) format = 'png';
            else if (mimeType.includes('webp')) format = 'webp';
            else if (mimeType.includes('avif')) format = 'avif';
            else if (mimeType.includes('apng')) format = 'apng';
            else if (fileName.endsWith('.png')) format = 'png';
            else if (fileName.endsWith('.webp')) format = 'webp';
            else if (fileName.endsWith('.avif')) format = 'avif';
            else if (fileName.endsWith('.apng')) format = 'apng';

            // Determine transparency type
            let type = 'opaque';
            let alphaChannel = false;

            if (hasTransparency) {
                if (format === 'gif') {
                    type = 'gif-transparency'; // Indexed transparency
                    alphaChannel = false;
                } else if (['png', 'webp', 'avif', 'apng'].includes(format)) {
                    type = 'alpha-channel'; // True alpha channel
                    alphaChannel = true;
                } else {
                    type = 'unknown-transparency';
                    alphaChannel = false;
                }
            }

            resolve({
                hasTransparency,
                type,
                alphaChannel,
                format
            });
        }).catch(() => {
            resolve({
                hasTransparency: false,
                type: 'unknown',
                alphaChannel: false,
                format: mimeType.split('/')[1] || fileName.split('.').pop()
            });
        });
    });
};

/**
 * Quick check that avoids loading the entire image when possible.
 * Useful for format selection decisions.
 * @async
 * @param {File} file - Image file to check
 * @returns {Promise<boolean>} True if image has transparency
 */
export const checkImageTransparencyQuick = async (file) => {
    // Quick checks based on file type and extension
    const nonTransparentFormats = [
        'image/jpeg', 'image/jpg', 'image/bmp',
        'image/tiff', 'image/tif', 'image/x-icon',
        'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
    ];

    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    // Check extensions first
    if (fileName.endsWith('.jpeg') || fileName.endsWith('.jpg') ||
        fileName.endsWith('.bmp') || fileName.endsWith('.tiff') ||
        fileName.endsWith('.tif') || fileName.endsWith('.ico') ||
        fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        return false;
    }

    // Check MIME types
    if (nonTransparentFormats.includes(mimeType)) {
        return false;
    }

    // For SVG, check file content quickly
    if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result.substring(0, 5000); // Check first 5KB
                const hasTransparency =
                    text.includes('opacity=') ||
                    text.includes('opacity:') ||
                    text.includes('fill-opacity=') ||
                    text.includes('stroke-opacity=') ||
                    text.match(/rgba\([^)]+\)/i) ||
                    text.includes('fill="none"') ||
                    text.includes('fill: none');
                resolve(hasTransparency);
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file.slice(0, 5000)); // Only read first 5KB
        });
    }

    // For GIF, check quickly using binary
    if (mimeType === 'image/gif' || fileName.endsWith('.gif')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);

                    // Quick GIF89a transparency check
                    if (bytes.length >= 14) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
                            // Look for Graphic Control Extension near the beginning
                            for (let i = 13; i < Math.min(1000, bytes.length - 1); i++) {
                                if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
                                    if (i + 4 < bytes.length) {
                                        const hasTransparency = (bytes[i + 4] & 0x01) !== 0;
                                        resolve(hasTransparency);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                    resolve(false);
                } catch (error) {
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(file.slice(0, 1024)); // Only read first 1KB
        });
    }

    // For other formats, need to load the image
    return checkImageTransparency(file);
};

/**
 * Calculates total files generated from selected templates.
 * @param {Array<string>} selectedTemplates - Array of selected template IDs
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - All available templates
 * @returns {number} Total number of files to generate
 */
export const calculateTotalTemplateFiles = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES) => {
    if (!selectedTemplates || selectedTemplates.length === 0) return 0;

    let totalFiles = 0;
    const templateIds = selectedTemplates;
    const templates = SOCIAL_MEDIA_TEMPLATES.filter(t => templateIds.includes(t.id));

    templates.forEach(template => {
        if (template.category === 'web') {
            totalFiles += 2;
        } else if (template.category === 'logo') {
            totalFiles += 1;
        } else {
            totalFiles += 1;
        }
    });

    return totalFiles;
};

/**
 * Generates processing summary object.
 * @param {Object} summaryData - Summary data
 * @param {Function} t - Translation function
 * @returns {Object} Processing summary
 */
export const generateProcessingSummary = (summaryData, t) => {
    const summary = {
        mode: summaryData.mode,
        imagesProcessed: summaryData.imagesProcessed,
        formatsExported: summaryData.formatsExported,
        operations: [],
        aiUsed: summaryData.aiUsed,
        upscalingUsed: false,
        totalFiles: summaryData.totalFiles
    };

    if (summaryData.resizeDimension) {
        summary.operations.push(t('operations.resized', { dimension: summaryData.resizeDimension }));
        summary.upscalingUsed = true;
    }
    if (summaryData.cropWidth && summaryData.cropHeight) {
        const cropType = summaryData.cropMode === 'smart' ? t('operations.aiCrop') : t('operations.standardCrop');
        summary.operations.push(`${cropType} ${summaryData.cropWidth}x${summaryData.cropHeight}`);
        summary.upscalingUsed = true;
    }
    if (summaryData.compressionQuality < 100) {
        summary.operations.push(t('operations.compressed', { quality: summaryData.compressionQuality }));
    }
    if (summaryData.rename && summaryData.newFileName) {
        summary.operations.push(t('operations.renamed', { pattern: summaryData.newFileName }));
    }

    if (summary.upscalingUsed) {
        summary.operations.push(t('operations.autoUpscaling'));
    }

    if (summaryData.mode === 'templates') {
        summary.templatesApplied = summaryData.templatesApplied;
        summary.categoriesApplied = summaryData.categoriesApplied;
        summary.operations = [
            t('operations.templatesApplied', { count: summary.templatesApplied }),
            t('operations.autoUpscaling'),
            t('operations.aiSmartCropping')
        ];
    }

    return summary;
};

/**
 * Validates image files.
 * @param {Array<File>} files - Array of files to validate
 * @returns {Array<File>} Array of valid image files
 */
export const validateImageFiles = (files) => {
    return Array.from(files).filter(file => {
        const mimeType = file.type.toLowerCase();
        return SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType.includes(format.replace('image/', '')) || mimeType === format
        );
    });
};

/**
 * Formats file size for display.
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ================================
// Orchestration Functions
// ================================

/**
 * Orchestrates custom image processing workflow.
 * @async
 * @param {Array<Object>} selectedImages - Selected image objects
 * @param {Object} processingOptions - Processing configuration
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Processed images
 * @throws {Error} If no images selected or no output formats
 */
export const orchestrateCustomProcessing = async (selectedImages, processingOptions, aiModelLoaded = false, onProgress = null) => {
    try {
        if (!selectedImages || selectedImages.length === 0) {
            throw new Error('No images selected for processing');
        }

        if (!processingOptions.output.formats || processingOptions.output.formats.length === 0) {
            throw new Error('No output formats selected');
        }

        if (onProgress) onProgress('preparing', 10);

        const processedImages = await processCustomImagesBatch(
            selectedImages,
            processingOptions,
            aiModelLoaded
        );

        if (onProgress) onProgress('completed', 100);

        return processedImages;

    } catch (error) {
        throw error;
    }
};

/**
 * Orchestrates template image processing workflow.
 * @async
 * @param {Object} selectedImage - Selected image object
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {Array<Object>} templateConfigs - Template configurations
 * @param {boolean} useSmartCrop - Whether to use AI smart cropping
 * @param {boolean} aiModelLoaded - Whether AI model is loaded
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Processed template images
 * @throws {Error} If no image or templates selected
 */
export const orchestrateTemplateProcessing = async (selectedImage, selectedTemplateIds, templateConfigs, useSmartCrop = false, aiModelLoaded = false, onProgress = null) => {
    try {
        if (!selectedImage) {
            throw new Error('No image selected for template processing');
        }

        if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
            throw new Error('No templates selected');
        }

        if (onProgress) onProgress('preparing', 10);

        const selectedTemplates = templateConfigs.filter(template =>
            selectedTemplateIds.includes(template.id)
        );

        if (onProgress) onProgress('processing', 30);

        const processedImages = await processTemplateImages(
            selectedImage,
            selectedTemplates,
            useSmartCrop,
            aiModelLoaded
        );

        if (onProgress) onProgress('completed', 100);

        return processedImages;

    } catch (error) {
        throw error;
    }
};

/**
 * Validates processing options before starting.
 * @param {Object} processingOptions - Processing options to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validateProcessingOptions = (processingOptions) => {
    const errors = [];

    // Validate compression quality
    if (processingOptions.compression?.quality) {
        const quality = parseInt(processingOptions.compression.quality);
        if (isNaN(quality) || quality < 1 || quality > 100) {
            errors.push('Compression quality must be between 1 and 100');
        }
    }

    // Validate file size target if provided (optional field)
    if (processingOptions.compression?.fileSize && processingOptions.compression.fileSize !== '') {
        const fileSize = parseInt(processingOptions.compression.fileSize);
        if (isNaN(fileSize) || fileSize < 1) {
            errors.push('Target file size must be a positive number in KB');
        } else if (fileSize > 100000) { // 100MB limit
            errors.push('Target file size cannot exceed 100,000 KB (100MB)');
        }
    }

    // Validate resize dimension if provided (optional field)
    if (processingOptions.resizeDimension && processingOptions.resizeDimension !== '') {
        const dimension = parseInt(processingOptions.resizeDimension);
        if (isNaN(dimension) || dimension < 1) {
            errors.push('Resize dimension must be a positive number');
        } else if (dimension > 10000) {
            errors.push('Resize dimension cannot exceed 10000 pixels');
        }
    }
    // If resize is enabled but dimension is empty, that's OK - resize will be skipped

    // Validate crop dimensions if provided (optional fields)
    if (processingOptions.cropWidth && processingOptions.cropWidth !== '') {
        const width = parseInt(processingOptions.cropWidth);
        if (isNaN(width) || width < 1) {
            errors.push('Crop width must be a positive number');
        } else if (width > 10000) {
            errors.push('Crop width cannot exceed 10000 pixels');
        }
    }

    if (processingOptions.cropHeight && processingOptions.cropHeight !== '') {
        const height = parseInt(processingOptions.cropHeight);
        if (isNaN(height) || height < 1) {
            errors.push('Crop height must be a positive number');
        } else if (height > 10000) {
            errors.push('Crop height cannot exceed 10000 pixels');
        }
    }

    // Validate that if one crop dimension is provided, both should be provided
    if ((processingOptions.cropWidth && processingOptions.cropWidth !== '') !==
        (processingOptions.cropHeight && processingOptions.cropHeight !== '')) {
        errors.push('Both crop width and height must be provided together, or leave both empty to skip cropping');
    }

    // Validate crop aspect ratio when both dimensions are provided
    if (processingOptions.cropWidth && processingOptions.cropWidth !== '' &&
        processingOptions.cropHeight && processingOptions.cropHeight !== '') {
        const width = parseInt(processingOptions.cropWidth);
        const height = parseInt(processingOptions.cropHeight);

        if (width > 0 && height > 0) {
            const aspectRatio = width / height;
            if (aspectRatio > 100 || aspectRatio < 0.01) {
                errors.push('Crop dimensions have extreme aspect ratio. Please use reasonable values.');
            }
        }
    }

    // Validate output formats
    if (processingOptions.output?.formats) {
        const validFormats = ['webp', 'avif', 'jpg', 'jpeg', 'png', 'original'];
        const invalidFormats = processingOptions.output.formats.filter(f => !validFormats.includes(f));

        if (invalidFormats.length > 0) {
            errors.push(`Invalid output formats: ${invalidFormats.join(', ')}`);
        }

        if (processingOptions.output.formats.length === 0) {
            errors.push('At least one output format must be selected');
        }
    }

    // Validate rename options only if rename is enabled
    if (processingOptions.output?.rename) {
        const newFileName = processingOptions.output?.newFileName || '';

        if (!newFileName.trim()) {
            errors.push('New file name cannot be empty when rename is enabled');
        } else {
            // Check for invalid characters
            const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
            if (invalidChars.test(newFileName)) {
                errors.push('New file name contains invalid characters');
            }

            // Check length
            if (newFileName.length > 100) {
                errors.push('New file name cannot exceed 100 characters');
            }
        }
    }

    // Validate crop mode if provided
    if (processingOptions.cropMode && !['smart', 'standard'].includes(processingOptions.cropMode)) {
        errors.push('Crop mode must be either "smart" or "standard"');
    }

    // Validate crop position if provided
    if (processingOptions.cropPosition) {
        const validPositions = ['center', 'top-left', 'top', 'top-right', 'left',
            'right', 'bottom-left', 'bottom', 'bottom-right'];
        if (!validPositions.includes(processingOptions.cropPosition)) {
            errors.push('Invalid crop position');
        }
    }

    // Validate template mode specific options
    if (processingOptions.processingMode === 'templates') {
        if (!processingOptions.templateSelectedImage) {
            errors.push('No image selected for template processing');
        }

        if (!processingOptions.selectedTemplates || processingOptions.selectedTemplates.length === 0) {
            errors.push('No templates selected for processing');
        }
    }

    // Validate processing mode
    if (processingOptions.processingMode && !['custom', 'templates'].includes(processingOptions.processingMode)) {
        errors.push('Invalid processing mode');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Gets processing configuration based on options.
 * @param {Object} processingOptions - User processing options
 * @returns {Object} Formatted processing configuration
 */
export const getProcessingConfiguration = (processingOptions) => {
    const config = {
        compression: {
            quality: parseInt(processingOptions.compression?.quality || 80) / 100,
            targetSize: processingOptions.compression?.fileSize ? parseInt(processingOptions.compression.fileSize) : null
        },
        output: {
            formats: processingOptions.output?.formats || ['webp'],
            rename: processingOptions.output?.rename || false,
            newFileName: processingOptions.output?.newFileName || ''
        },
        // Only enable resize if dimension is provided and not empty
        resize: (processingOptions.showResize && processingOptions.resizeDimension &&
            processingOptions.resizeDimension.trim() !== '') ? {
            enabled: true,
            dimension: parseInt(processingOptions.resizeDimension)
        } : { enabled: false },
        // Only enable crop if both dimensions are provided and not empty
        crop: (processingOptions.showCrop && processingOptions.cropWidth &&
            processingOptions.cropWidth.trim() !== '' && processingOptions.cropHeight &&
            processingOptions.cropHeight.trim() !== '') ? {
            enabled: true,
            width: parseInt(processingOptions.cropWidth),
            height: parseInt(processingOptions.cropHeight),
            mode: processingOptions.cropMode || 'standard',
            position: processingOptions.cropPosition || 'center'
        } : { enabled: false },
        templates: {
            selected: processingOptions.selectedTemplates || [],
            mode: processingOptions.processingMode || 'custom'
        }
    };

    return config;
};

/**
 * Gets available output formats.
 * @returns {Array<Object>} Array of format objects with id, name, and description
 */
export const getAvailableFormats = () => {
    return [
        { id: 'webp', name: 'WebP', description: 'Modern format with excellent compression' },
        { id: 'avif', name: 'AVIF', description: 'Next-gen format with superior compression' },
        { id: 'jpg', name: 'JPEG', description: 'Standard format with good compression' },
        { id: 'png', name: 'PNG', description: 'Lossless format with transparency support' },
        { id: 'original', name: 'Original', description: 'Keep original format' }
    ];
};

/**
 * Gets template by ID.
 * @param {string} templateId - Template ID
 * @param {Array<Object>} templateConfigs - Template configurations
 * @returns {Object|null} Template object or null if not found
 */
export const getTemplateById = (templateId, templateConfigs) => {
    return templateConfigs.find(t => t.id === templateId) || null;
};

/**
 * Gets templates by category.
 * @param {string} category - Template category
 * @param {Array<Object>} templateConfigs - Template configurations
 * @returns {Array<Object>} Array of templates in the category
 */
export const getTemplatesByCategory = (category, templateConfigs) => {
    return templateConfigs.filter(t => t.category === category);
};

/**
 * Generates file name based on processing options.
 * @param {string} originalName - Original file name
 * @param {Object} options - Processing options
 * @param {number} index - File index (for batch processing)
 * @returns {string} Generated file name
 */
export const generateFileName = (originalName, options, index = 0) => {
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const originalExtension = originalName.split('.').pop();

    if (options.rename && options.newFileName) {
        const numberedName = `${options.newFileName}-${String(index + 1).padStart(2, '0')}`;

        if (options.format === 'original') {
            return `${numberedName}.${originalExtension}`;
        } else {
            return `${numberedName}.${options.format}`;
        }
    } else {
        const suffixParts = [];

        if (options.resize && options.resize.enabled) {
            suffixParts.push(`resized-${options.resize.dimension}`);
        }

        if (options.crop && options.crop.enabled) {
            const cropType = options.crop.mode === 'smart' ? 'smart-crop' : 'crop';
            suffixParts.push(`${cropType}-${options.crop.width}x${options.crop.height}`);

            if (options.crop.mode === 'standard' && options.crop.position !== 'center') {
                suffixParts.push(options.crop.position);
            }
        }

        if (options.compression && options.compression.quality < 1) {
            const qualityPercent = Math.round(options.compression.quality * 100);
            suffixParts.push(`q${qualityPercent}`);
        }

        const suffix = suffixParts.length > 0 ? `-${suffixParts.join('-')}` : '';

        if (options.format === 'original') {
            return `${baseName}${suffix}.${originalExtension}`;
        } else {
            return `${baseName}${suffix}.${options.format}`;
        }
    }
};

/**
 * Creates processing summary for display.
 * @param {Object} result - Processing result
 * @param {Object} options - Processing options
 * @param {Function} t - Translation function
 * @returns {Object} Processing summary
 */
export const createProcessingSummary = (result, options, t) => {
    const summary = {
        mode: options.templates?.mode || 'custom',
        imagesProcessed: result.imagesProcessed || 0,
        operations: [],
        aiUsed: false,
        upscalingUsed: false,
        totalFiles: result.totalFiles || 0,
        success: result.success || false,
        errors: result.errors || []
    };

    if (options.resize && options.resize.enabled) {
        summary.operations.push(t('operations.resized', { dimension: options.resize.dimension }));
        summary.upscalingUsed = true;
    }

    if (options.crop && options.crop.enabled) {
        const cropType = options.crop.mode === 'smart' ? t('operations.aiCrop') : t('operations.standardCrop');
        summary.operations.push(`${cropType} ${options.crop.width}x${options.crop.height}`);
        summary.upscalingUsed = true;

        if (options.crop.mode === 'smart') {
            summary.aiUsed = true;
        }
    }

    if (options.compression && options.compression.quality < 1) {
        const qualityPercent = Math.round(options.compression.quality * 100);
        summary.operations.push(t('operations.compressed', { quality: qualityPercent }));
    }

    if (options.output && options.output.rename && options.output.newFileName) {
        summary.operations.push(t('operations.renamed', { pattern: options.output.newFileName }));
    }

    if (options.output && options.output.formats) {
        summary.formatsExported = options.output.formats;
    }

    if (options.templates && options.templates.selected.length > 0) {
        summary.templatesApplied = options.templates.selected.length;
        summary.categoriesApplied = new Set(
            options.templates.selected.map(id => {
                const template = getTemplateById(id, []);
                return template?.category;
            }).filter(Boolean)
        ).size;
    }

    if (summary.upscalingUsed) {
        summary.operations.push(t('operations.autoUpscaling'));
    }

    return summary;
};

/**
 * Handles image file selection with validation.
 * @param {Event} e - File input event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Validation options
 * @returns {void}
 */
export const handleFileSelect = (e, onUpload, options = {}) => {
    const files = Array.from(e.target.files).filter(file => {
        const mimeType = file.type.toLowerCase();
        const isImage = SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType.includes(format.replace('image/', '')) || mimeType === format
        );
        if (options.maxSize && file.size > options.maxSize) {
            return false;
        }
        if (options.allowedTypes && !options.allowedTypes.some(type =>
            mimeType.includes(type.replace('image/', '')) || mimeType === type
        )) {
            return false;
        }
        return isImage;
    });
    if (files.length > 0) onUpload(files);
};

/**
 * Handles image drop with validation.
 * @param {Event} e - Drag and drop event
 * @param {Function} onUpload - Upload callback
 * @param {Object} options - Validation options
 * @returns {void}
 */
export const handleImageDrop = (e, onUpload, options = {}) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => {
        const mimeType = file.type.toLowerCase();
        const isImage = SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType.includes(format.replace('image/', '')) || mimeType === format
        );
        if (options.maxSize && file.size > options.maxSize) {
            return false;
        }
        if (options.allowedTypes && !options.allowedTypes.some(type =>
            mimeType.includes(type.replace('image/', '')) || mimeType === type
        )) {
            return false;
        }
        return isImage;
    });
    if (files.length > 0) onUpload(files);
};

// ================================
// Internal Helper Functions
// ================================

/**
 * Calculates upscale factor needed for target dimensions.
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {number} Required upscale factor
 */
const calculateUpscaleFactor = (originalWidth, originalHeight, targetWidth, targetHeight) => {
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;
    const requiredScale = Math.max(widthScale, heightScale);

    const availableScales = [2, 3, 4];

    for (const scale of availableScales) {
        if (scale >= requiredScale) {
            const safeDimensions = calculateSafeDimensions(originalWidth, originalHeight, scale);
            if (!safeDimensions.wasAdjusted) return scale;
        }
    }

    if (requiredScale > 1) return Math.min(requiredScale, 2);
    return 1;
};

/**
 * Calculates safe dimensions for upscaling.
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height
 * @param {number} scale - Upscale factor
 * @returns {Object} Safe dimensions and adjustment status
 */
const calculateSafeDimensions = (originalWidth, originalHeight, scale) => {
    let targetWidth = Math.round(originalWidth * scale);
    let targetHeight = Math.round(originalHeight * scale);

    if (targetWidth > MAX_TEXTURE_SIZE || targetHeight > MAX_TEXTURE_SIZE) {
        const maxWidthScale = MAX_SAFE_DIMENSION / originalWidth;
        const maxHeightScale = MAX_SAFE_DIMENSION / originalHeight;
        const safeScale = Math.min(maxWidthScale, maxHeightScale, scale);

        targetWidth = Math.round(originalWidth * safeScale);
        targetHeight = Math.round(originalHeight * safeScale);

        return { width: targetWidth, height: targetHeight, scale: safeScale, wasAdjusted: true };
    }

    const totalPixels = targetWidth * targetHeight;
    if (totalPixels > MAX_TOTAL_PIXELS) {
        const safeScale = Math.sqrt(MAX_TOTAL_PIXELS / (originalWidth * originalHeight));
        targetWidth = Math.round(originalWidth * safeScale);
        targetHeight = Math.round(originalHeight * safeScale);

        return { width: targetWidth, height: targetHeight, scale: safeScale, wasAdjusted: true };
    }

    return { width: targetWidth, height: targetHeight, scale: scale, wasAdjusted: false };
};

/**
 * Upscales image using AI with fallback.
 * @async
 * @param {File} imageFile - Image file to upscale
 * @param {number} scale - Upscale factor
 * @param {string} originalName - Original file name
 * @returns {Promise<File>} Upscaled image file
 */
const upscaleImageWithAI = async (imageFile, scale, originalName) => {
    if (aiUpscalingDisabled) {
        return upscaleImageEnhancedFallback(imageFile, scale, originalName);
    }

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);

        if (safeDimensions.wasAdjusted || safeDimensions.width > MAX_SAFE_DIMENSION || safeDimensions.height > MAX_SAFE_DIMENSION) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        }

        const availableScales = [2, 3, 4];
        if (!availableScales.includes(scale) || scale > 4) {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, Math.min(scale, 2), originalName);
        }

        let upscaler;
        try {
            upscaler = await loadUpscalerForScale(scale);
        } catch (loadError) {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        let upscaleResult;
        try {
            upscaleResult = await safeUpscale(upscaler, img, scale);
        } catch (upscaleError) {
            textureManagerFailures++;
            if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        let canvas;
        if (upscaleResult instanceof HTMLCanvasElement) {
            canvas = upscaleResult;
        } else if (upscaleResult.tensor) {
            canvas = await tensorToCanvas(upscaleResult.tensor);
        } else if (upscaleResult.src) {
            canvas = await dataURLToCanvas(upscaleResult.src);
        } else if (typeof upscaleResult === 'string') {
            canvas = await dataURLToCanvas(upscaleResult);
        } else {
            URL.revokeObjectURL(objectUrl);
            cleanupInProgress = wasCleanupInProgress;
            return upscaleImageEnhancedFallback(imageFile, scale, originalName);
        }

        URL.revokeObjectURL(objectUrl);

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/webp', 0.9);
        });

        if (!blob) throw new Error('Failed to create blob from upscaled canvas');

        const extension = originalName.split('.').pop();
        const newName = originalName.replace(
            /\.[^/.]+$/,
            `-ai-upscaled-${scale}x.${extension}`
        );

        const upscaledFile = new File([blob], newName, { type: 'image/webp' });
        textureManagerFailures = Math.max(0, textureManagerFailures - 1);
        cleanupInProgress = wasCleanupInProgress;
        return upscaledFile;

    } catch (error) {
        textureManagerFailures++;
        if (textureManagerFailures >= MAX_TEXTURE_FAILURES) aiUpscalingDisabled = true;
        cleanupInProgress = wasCleanupInProgress;

        try {
            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(imageFile);

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = objectUrl;
            });

            const safeDimensions = calculateSafeDimensions(img.naturalWidth, img.naturalHeight, scale);
            URL.revokeObjectURL(objectUrl);
            return upscaleImageEnhancedFallback(imageFile, safeDimensions.scale, originalName);
        } catch (fallbackError) {
            throw error;
        }
    }
};

/**
 * Loads upscaler for specific scale.
 * @async
 * @param {number} scale - Upscale factor
 * @returns {Promise<Object>} Upscaler instance
 */
const loadUpscalerForScale = async (scale) => {
    if (upscalerInstances[scale] && upscalerUsageCount[scale] !== undefined) {
        upscalerUsageCount[scale]++;
        upscalerLastUsed[scale] = Date.now();
        return upscalerInstances[scale];
    }

    if (scale === 8) {
        const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        return fallbackUpscaler;
    }

    const wasCleanupInProgress = cleanupInProgress;
    cleanupInProgress = true;

    try {
        if (!window.Upscaler) await loadUpscalerFromCDN();

        let modelGlobalName;
        switch (scale) {
            case 2:
                await loadUpscalerModelScript('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@latest/dist/umd/2x.min.js');
                modelGlobalName = 'ESRGANSlim2x';
                break;
            case 3:
                await loadUpscalerModelScript('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@latest/dist/umd/3x.min.js');
                modelGlobalName = 'ESRGANSlim3x';
                break;
            case 4:
                await loadUpscalerModelScript('https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@latest/dist/umd/4x.min.js');
                modelGlobalName = 'ESRGANSlim4x';
                break;
            default:
                throw new Error(`Unsupported scale: ${scale}`);
        }

        if (!window[modelGlobalName]) throw new Error(`Model ${modelGlobalName} not loaded`);

        let upscaler;
        try {
            upscaler = new window.Upscaler({
                model: window[modelGlobalName],
            });
        } catch (createError) {
            throw createError;
        }

        upscalerInstances[scale] = upscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return upscaler;

    } catch (error) {
        const fallbackUpscaler = createEnhancedFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        upscalerUsageCount[scale] = 1;
        upscalerLastUsed[scale] = Date.now();
        cleanupInProgress = wasCleanupInProgress;
        return fallbackUpscaler;
    }
};

/**
 * Loads upscaler library from CDN.
 * @async
 * @returns {Promise<void>}
 */
const loadUpscalerFromCDN = () => {
    return new Promise((resolve) => {
        if (window.Upscaler) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/upscaler@latest/dist/browser/umd/upscaler.min.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Loads upscaler model script from CDN.
 * @async
 * @param {string} src - Script source URL
 * @returns {Promise<void>}
 */
const loadUpscalerModelScript = (src) => {
    return new Promise((resolve, reject) => {
        const scriptId = `upscaler-model-${src.split('/').pop()}`;
        if (document.getElementById(scriptId)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load model: ${src}`));
        document.head.appendChild(script);
    });
};

/**
 * Releases upscaler for specific scale.
 * @param {number} scale - Upscale factor
 * @returns {void}
 */
const releaseUpscalerForScale = (scale) => {
    if (upscalerUsageCount[scale]) {
        upscalerUsageCount[scale]--;
        upscalerLastUsed[scale] = Date.now();

        if (upscalerUsageCount[scale] <= 0 && currentMemoryUsage > 1000) {
            setTimeout(() => {
                if (upscalerUsageCount[scale] <= 0) {
                    const upscaler = upscalerInstances[scale];
                    if (upscaler && upscaler.dispose) {
                        try { upscaler.dispose(); } catch (e) { }
                    }
                    delete upscalerInstances[scale];
                    delete upscalerUsageCount[scale];
                    delete upscalerLastUsed[scale];
                }
            }, 1000);
        }
    }
};

/**
 * Safely upscales image with timeout protection.
 * @async
 * @param {Object} upscaler - Upscaler instance
 * @param {HTMLImageElement} img - Image element
 * @param {number} scale - Upscale factor
 * @returns {Promise<any>} Upscaling result
 */
const safeUpscale = async (upscaler, img, scale) => {
    if (upscalerUsageCount[scale]) upscalerUsageCount[scale]++;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            releaseUpscalerForScale(scale);
            reject(new Error('Upscaling timeout'));
        }, 45000);

        try {
            upscaler.upscale(img, {
                patchSize: 32,
                padding: 2
            }).then((result) => {
                clearTimeout(timeoutId);
                upscalerLastUsed[scale] = Date.now();
                releaseUpscalerForScale(scale);
                resolve(result);
            }).catch((error) => {
                clearTimeout(timeoutId);
                releaseUpscalerForScale(scale);
                reject(error);
            });
        } catch (error) {
            clearTimeout(timeoutId);
            releaseUpscalerForScale(scale);
            reject(error);
        }
    });
};

/**
 * Creates enhanced fallback upscaler.
 * @param {number} scale - Upscale factor
 * @returns {Object} Fallback upscaler object
 */
const createEnhancedFallbackUpscaler = (scale) => {
    return {
        scale,
        upscale: async (imageElement) => {
            const safeDimensions = calculateSafeDimensions(
                imageElement.naturalWidth,
                imageElement.naturalHeight,
                scale
            );

            const canvas = document.createElement('canvas');
            canvas.width = safeDimensions.width;
            canvas.height = safeDimensions.height;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

            if (safeDimensions.scale >= 2) {
                applySmartSharpening(canvas, ctx, safeDimensions.scale);
            }

            return canvas;
        }
    };
};

/**
 * Applies smart sharpening to canvas.
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} scale - Upscale factor
 * @returns {void}
 */
const applySmartSharpening = (canvas, ctx, scale) => {
    try {
        const width = canvas.width;
        const height = canvas.height;

        if (width * height > 4000000) return;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const originalData = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                for (let channel = 0; channel < 3; channel++) {
                    const channelIdx = idx + channel;

                    const top = originalData[channelIdx - width * 4];
                    const bottom = originalData[channelIdx + width * 4];
                    const left = originalData[channelIdx - 4];
                    const right = originalData[channelIdx + 4];
                    const center = originalData[channelIdx];

                    const sharpened = Math.min(255, Math.max(0,
                        center * 1.5 - (top + bottom + left + right) * 0.125
                    ));

                    data[channelIdx] = sharpened;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    } catch (error) {
        // Silent fail
    }
};

/**
 * Upscales image using enhanced fallback method.
 * @async
 * @param {File} imageFile - Image file to upscale
 * @param {number} scale - Upscale factor
 * @param {string} originalName - Original file name
 * @returns {Promise<File>} Upscaled image file
 */
const upscaleImageEnhancedFallback = async (imageFile, scale, originalName) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });

    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    if (targetWidth * targetHeight > 4000000) {
        URL.revokeObjectURL(objectUrl);
        return upscaleImageTiled(img, scale, originalName);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    if (scale >= 2) applySmartSharpening(canvas, ctx, scale);

    URL.revokeObjectURL(objectUrl);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-enhanced-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

/**
 * Upscales large images using tiled approach.
 * @async
 * @param {HTMLImageElement} img - Image element
 * @param {number} scale - Upscale factor
 * @param {string} originalName - Original file name
 * @param {string} objectUrl - Object URL (optional)
 * @returns {Promise<File>} Tiled upscaled image file
 */
const upscaleImageTiled = async (img, scale, originalName, objectUrl) => {
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    const TILE_SIZE = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const xTiles = Math.ceil(targetWidth / TILE_SIZE);
    const yTiles = Math.ceil(targetHeight / TILE_SIZE);

    for (let y = 0; y < yTiles; y++) {
        for (let x = 0; x < xTiles; x++) {
            const tileX = x * TILE_SIZE;
            const tileY = y * TILE_SIZE;
            const tileWidth = Math.min(TILE_SIZE, targetWidth - tileX);
            const tileHeight = Math.min(TILE_SIZE, targetHeight - tileY);

            const srcX = tileX / scale;
            const srcY = tileY / scale;
            const srcWidth = tileWidth / scale;
            const srcHeight = tileHeight / scale;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileWidth;
            tempCanvas.height = tileHeight;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';

            tempCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, tileWidth, tileHeight);
            applySmartSharpening(tempCanvas, tempCtx, scale);
            ctx.drawImage(tempCanvas, tileX, tileY);
        }
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-tiled-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

/**
 * Processes SVG crop.
 * @async
 * @param {File} svgFile - SVG file to crop
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<File>} Cropped SVG file
 */
const processSVGCrop = async (svgFile, width, height) => {
    const img = new Image();
    const svgUrl = URL.createObjectURL(svgFile);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const scale = Math.max(width / img.width, height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    cropCanvas.width = width;
    cropCanvas.height = height;

    const { offsetX, offsetY } = calculateCropOffset(scaledWidth, scaledHeight, width, height, 'center');

    cropCtx.drawImage(tempCanvas, offsetX, offsetY, width, height, 0, 0, width, height);

    const croppedBlob = await new Promise(resolve => {
        cropCanvas.toBlob(resolve, 'image/png', 0.85);
    });

    const croppedFile = new File([croppedBlob], svgFile.name.replace(/\.svg$/i, '.png'), {
        type: 'image/png'
    });

    URL.revokeObjectURL(svgUrl);
    return croppedFile;
};

/**
 * Resizes image for cropping.
 * @async
 * @param {File} imageFile - Image file to resize
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Promise<Object>} Resized image data
 */
const resizeImageForCrop = async (imageFile, targetWidth, targetHeight) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
            const scaledWidth = Math.round(img.naturalWidth * scale);
            const scaledHeight = Math.round(img.naturalHeight * scale);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(url);

                    if (!blob) {
                        reject(new Error('Failed to create resized image'));
                        return;
                    }

                    resolve({
                        file: new File([blob], 'resized-temp.webp', { type: 'image/webp' }),
                        width: scaledWidth,
                        height: scaledHeight,
                        scale
                    });
                },
                'image/webp',
                0.85
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

/**
 * Load image from file with timeout protection
 * @async
 * @param {File} file - Image file
 * @returns {Promise<Object>} Loaded image data
 */
const loadImage = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load timeout'));
        }, 30000);

        img.onload = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            resolve({
                element: img,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };

        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

/**
 * Optimized image loader with performance improvements
 */
const loadImageWithPerformance = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        // Performance tracking
        const startTime = performance.now();

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load timeout'));
        }, 45000); // Increased timeout for large images

        // Optimized load handler
        const onLoad = () => {
            const loadTime = performance.now() - startTime;

            clearTimeout(timeout);
            URL.revokeObjectURL(url);

            // Use microtask for resolution
            Promise.resolve().then(() => {
                resolve({
                    element: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    loadTime: loadTime
                });
            });
        };

        // Optimized error handler
        const onError = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);

            // Use microtask for rejection
            Promise.resolve().then(() => {
                reject(new Error(`Failed to load image: ${file.name}`));
            });
        };

        img.onload = onLoad;
        img.onerror = onError;
        img.src = url;

        // Use decode API for better performance with large images
        if (file.size > 2000000 && img.decode) { // 2MB+
            img.decode().then(onLoad).catch(onError);
        }
    });
};

/**
 * Calculates crop offset based on position.
 * @param {number} srcWidth - Source width
 * @param {number} srcHeight - Source height
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string} position - Crop position
 * @returns {Object} Crop offset coordinates
 */
const calculateCropOffset = (srcWidth, srcHeight, targetWidth, targetHeight, position) => {
    let offsetX, offsetY;

    switch (position) {
        case 'top-left':
            offsetX = 0;
            offsetY = 0;
            break;
        case 'top':
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = 0;
            break;
        case 'top-right':
            offsetX = srcWidth - targetWidth;
            offsetY = 0;
            break;
        case 'left':
            offsetX = 0;
            offsetY = Math.round((srcHeight - targetHeight) / 2);
            break;
        case 'right':
            offsetX = srcWidth - targetWidth;
            offsetY = Math.round((srcHeight - targetHeight) / 2);
            break;
        case 'bottom-left':
            offsetX = 0;
            offsetY = srcHeight - targetHeight;
            break;
        case 'bottom':
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = srcHeight - targetHeight;
            break;
        case 'bottom-right':
            offsetX = srcWidth - targetWidth;
            offsetY = srcHeight - targetHeight;
            break;
        case 'center':
        default:
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = Math.round((srcHeight - targetHeight) / 2);
    }

    offsetX = Math.max(0, Math.min(offsetX, srcWidth - targetWidth));
    offsetY = Math.max(0, Math.min(offsetY, srcHeight - targetHeight));

    return { offsetX, offsetY };
};

/**
 * Crops image from resized version.
 * @async
 * @param {Object} resized - Resized image data
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string|Object} position - Crop position or subject data
 * @param {File} originalFile - Original file
 * @returns {Promise<File>} Cropped image file
 */
const cropFromResized = async (resized, targetWidth, targetHeight, position, originalFile) => {
    const img = await loadImage(resized.file);

    let offsetX, offsetY;

    if (typeof position === 'string') {
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, position);
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    } else if (position && position.bbox) {
        const bbox = position.bbox;
        const [x, y, width, height] = bbox;

        const subjectCenterX = x + width / 2;
        const subjectCenterY = y + height / 2;

        offsetX = subjectCenterX - targetWidth / 2;
        offsetY = subjectCenterY - targetHeight / 2;

        const margin = Math.min(50, width * 0.1, height * 0.1);

        if (x < margin) offsetX = Math.max(0, offsetX - (margin - x));
        if (x + width > resized.width - margin) offsetX = Math.min(offsetX, resized.width - targetWidth);
        if (y < margin) offsetY = Math.max(0, offsetY - (margin - y));
        if (y + height > resized.height - margin) offsetY = Math.min(offsetY, resized.height - targetHeight);
    } else if (position && position.x !== undefined && position.y !== undefined) {
        offsetX = position.x - targetWidth / 2;
        offsetY = position.y - targetHeight / 2;
    } else {
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, 'center');
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    }

    offsetX = Math.max(0, Math.min(offsetX, resized.width - targetWidth));
    offsetY = Math.max(0, Math.min(offsetY, resized.height - targetHeight));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(
        img.element,
        offsetX, offsetY, targetWidth, targetHeight,
        0, 0, targetWidth, targetHeight
    );

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalFile.name.split('.').pop();
    let suffix = '-cropped';

    if (typeof position === 'string' && position !== 'center') {
        suffix = `-${position}-crop`;
    } else if (position && position.bbox) {
        suffix = '-smart-crop';
    } else if (position && position.x !== undefined) {
        suffix = '-focal-crop';
    }

    const newName = originalFile.name.replace(
        /\.[^/.]+$/,
        `${suffix}-${targetWidth}x${targetHeight}.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

/**
 * Gets luminance value from pixel data.
 * @param {Uint8ClampedArray} data - Image data
 * @param {number} idx - Pixel index
 * @returns {number} Luminance value
 */
const getLuminance = (data, idx) => {
    if (idx < 0 || idx >= data.length) return 0;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
};

/**
 * Finds main subject from AI predictions.
 * @param {Array<Object>} predictions - AI predictions
 * @param {number} imgWidth - Image width
 * @param {number} imgHeight - Image height
 * @returns {Object|null} Main subject data
 */
const findMainSubject = (predictions, imgWidth, imgHeight) => {
    if (!predictions || predictions.length === 0) return null;

    const validPredictions = predictions.filter(pred =>
        pred.score > 0.3 &&
        !['book', 'cell phone', 'remote', 'keyboard', 'mouse'].includes(pred.class)
    );

    if (validPredictions.length === 0) return null;

    const scoredPredictions = validPredictions.map(pred => {
        const bbox = pred.bbox;
        const area = bbox[2] * bbox[3];
        const centerX = bbox[0] + bbox[2] / 2;
        const centerY = bbox[1] + bbox[3] / 2;

        const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - imgWidth / 2, 2) +
            Math.pow(centerY - imgHeight / 2, 2)
        );

        const sizeScore = area / (imgWidth * imgHeight);
        const confidenceScore = pred.score;
        const maxDistance = Math.sqrt(Math.pow(imgWidth / 2, 2) + Math.pow(imgHeight / 2, 2));
        const centralityScore = 1 - (distanceFromCenter / maxDistance);

        let classWeight = 1.0;
        if (['person', 'man', 'woman', 'boy', 'girl'].includes(pred.class)) classWeight = 1.5;
        if (pred.class.includes('face')) classWeight = 1.3;
        if (['dog', 'cat', 'bird'].includes(pred.class)) classWeight = 1.2;

        const score = (sizeScore * 0.4 + confidenceScore * 0.4 + centralityScore * 0.2) * classWeight;

        return {
            ...pred,
            score,
            bbox,
            area,
            centerX,
            centerY
        };
    });

    scoredPredictions.sort((a, b) => b.score - a.score);
    return scoredPredictions[0];
};

/**
 * Detects focal point using simple edge detection.
 * @async
 * @param {HTMLImageElement} imgElement - Image element
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Promise<Object>} Focal point coordinates
 */
const detectFocalPointSimple = async (imgElement, width, height) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imgElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let totalX = 0, totalY = 0, count = 0;
    const edgeThreshold = 30;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            const lum = getLuminance(data, idx);
            const lumRight = getLuminance(data, idx + 4);
            const lumDown = getLuminance(data, idx + width * 4);

            const edgeStrength = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);

            if (edgeStrength > edgeThreshold) {
                totalX += x;
                totalY += y;
                count++;
            }
        }
    }

    if (count > 0) {
        return {
            x: Math.round(totalX / count),
            y: Math.round(totalY / count)
        };
    }

    return {
        x: Math.round(width / 2),
        y: Math.round(height / 2)
    };
};

/**
 * Adjusts crop position based on focal point.
 * @param {string} position - Original crop position
 * @param {Object} focalPoint - Focal point coordinates
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} Adjusted crop position
 */
const adjustCropPositionForFocalPoint = (position, focalPoint, width, height) => {
    const THRESHOLD = 0.3;

    const centerX = width / 2;
    const centerY = height / 2;

    const dx = Math.abs(focalPoint.x - centerX) / centerX;
    const dy = Math.abs(focalPoint.y - centerY) / centerY;

    if (dx > THRESHOLD || dy > THRESHOLD) {
        const isLeft = focalPoint.x < centerX;
        const isRight = focalPoint.x > centerX;
        const isTop = focalPoint.y < centerY;
        const isBottom = focalPoint.y > centerY;

        if (isLeft && isTop) return 'top-left';
        if (isRight && isTop) return 'top-right';
        if (isLeft && isBottom) return 'bottom-left';
        if (isRight && isBottom) return 'bottom-right';
        if (isTop) return 'top';
        if (isBottom) return 'bottom';
        if (isLeft) return 'left';
        if (isRight) return 'right';
    }

    return position;
};

/**
 * Converts tensor to canvas.
 * @async
 * @param {Object} tensor - TensorFlow tensor
 * @returns {Promise<HTMLCanvasElement>} Canvas element
 */
const tensorToCanvas = async (tensor) => {
    return new Promise((resolve) => {
        const [height, width, channels] = tensor.shape;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = tensor.dataSync();

        for (let i = 0; i < data.length; i += channels) {
            const pixelIndex = i / channels * 4;
            imageData.data[pixelIndex] = data[i];
            imageData.data[pixelIndex + 1] = data[i + 1];
            imageData.data[pixelIndex + 2] = data[i + 2];
            if (channels === 4) {
                imageData.data[pixelIndex + 3] = data[i + 3];
            } else {
                imageData.data[pixelIndex + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas);

        if (tensor.dispose) tensor.dispose();
    });
};

/**
 * Converts data URL to canvas.
 * @async
 * @param {string} dataURL - Data URL
 * @returns {Promise<HTMLCanvasElement>} Canvas element
 */
const dataURLToCanvas = (dataURL) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = dataURL;
    });
};

/**
 * Cleans up all resources when page unloads.
 * @returns {void}
 */
export const cleanupAllResources = () => {
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }

    cleanupGPUMemory();

    if (aiModel && aiModel.dispose) {
        aiModel.dispose();
        aiModel = null;
    }

    aiUpscalingDisabled = false;
    textureManagerFailures = 0;
};

// Initialize memory monitoring
if (typeof window !== 'undefined') {
    window.addEventListener('load', initializeGPUMemoryMonitor);
    window.addEventListener('beforeunload', cleanupAllResources);
    window.addEventListener('pagehide', cleanupAllResources);
}

// ============================================
// Component Logic Functions
// ============================================

/**
 * Gets available languages.
 * @returns {Array<Object>} Array of language objects
 */
export const getLanguages = () => {
    return [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' }
    ];
};

/**
 * Gets current language object.
 * @param {string} currentLangCode - Current language code
 * @returns {Object} Current language object
 */
export const getCurrentLanguage = (currentLangCode) => {
    const languages = getLanguages();
    return languages.find(lang => lang.code === currentLangCode) || languages[0];
};

/**
 * Calculates percentage value.
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} value - Current value
 * @returns {number} Percentage
 */
export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

/**
 * Generates tick values for range sliders.
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<number>} Array of tick values
 */
export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

/**
 * Gets file extension from filename.
 * @param {string} filename - Filename
 * @returns {string} File extension
 */
export const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
};

/**
 * Sanitizes filename by removing invalid characters.
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
};

/**
 * Checks if browser supports AVIF encoding
 * @async
 * @returns {Promise<boolean>} True if AVIF is supported
 */
const checkAVIFSupport = async () => {
    return new Promise((resolve) => {
        // Create test image to check AVIF decoding support
        const avif = new Image();

        const timeout = setTimeout(() => {
            resolve(false);
        }, 2000);

        avif.onload = avif.onerror = () => {
            clearTimeout(timeout);
            resolve(avif.height === 2);
        };

        avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    });
};