import UTIF from 'utif';
import {
    MEMORY_CLEANUP_INTERVAL,
    UPSCALER_IDLE_TIMEOUT,
    MIME_TYPE_MAP,
    INVALID_FILENAME_CHARS,
    CROP_POSITIONS,
    MAX_TEXTURE_SIZE,
    MAX_SAFE_DIMENSION,
    MAX_TOTAL_PIXELS,
    MAX_TOTAL_PIXELS_FOR_AI,
    MAX_DIMENSION_FOR_AI,
    SUPPORTED_INPUT_FORMATS,
    LEGACY_FORMATS,
    TIFF_FORMATS,
    MAX_TEXTURE_FAILURES,
    AVAILABLE_UPSCALE_FACTORS,
    TILE_SIZE,
    AI_SETTINGS,
    IMAGE_LOAD_TIMEOUT,
    UPSCALING_TIMEOUT,
    DEFAULT_QUALITY,
    DEFAULT_WEBP_QUALITY,
    DEFAULT_PNG_QUALITY,
    OUTPUT_FORMATS,
    PROCESSING_MODES,
    CROP_MODES,
    CROP_MARGIN,
    MAX_SCALE_FACTOR,
    MAX_PIXELS_FOR_SMART_SHARPENING
} from '../constants/sharedConstants';

import {
    cleanupGPUMemory,
    initializeGPUMemoryMonitor,
    ensureFileObject,
    createTIFFPlaceholderFile,
    checkAVIFSupport,
    getTemplateById
} from '../utils';

if (!window.UTIF) {
    window.UTIF = UTIF;
}

let aiModel = null;
let aiModelLoading = false;
let upscalerInstances = {};
let upscalerUsageCount = {};
let upscalerLastUsed = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval = null;
let aiUpscalingDisabled = false;
let textureManagerFailures = 0;
let cleanupInProgress = false;

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

const convertTIFFWithUTIF = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target.result;
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
                } catch (decodeError) {
                    reject(new Error('Failed to decode TIFF image'));
                    return;
                }

                if (!firstIFD.width || !firstIFD.height ||
                    typeof firstIFD.width !== 'number' || typeof firstIFD.height !== 'number' ||
                    firstIFD.width <= 0 || firstIFD.height <= 0) {

                    const imageWidth = firstIFD['ImageWidth'] || firstIFD['t256'] || firstIFD[256];
                    const imageLength = firstIFD['ImageLength'] || firstIFD['t257'] || firstIFD[257];

                    if (imageWidth && imageLength) {
                        firstIFD.width = imageWidth.value || imageWidth;
                        firstIFD.height = imageLength.value || imageLength;
                    } else {
                        firstIFD.width = 800;
                        firstIFD.height = 600;
                    }
                }

                let rgba;
                try {
                    rgba = window.UTIF.toRGBA8(firstIFD);

                    if (!rgba || !rgba.length) {
                        throw new Error('Empty RGBA data');
                    }

                    const expectedLength = firstIFD.width * firstIFD.height * 4;
                    if (rgba.length !== expectedLength) {
                        const fixedRgba = new Uint8ClampedArray(expectedLength);
                        const copyLength = Math.min(rgba.length, expectedLength);
                        fixedRgba.set(rgba.subarray(0, copyLength));

                        for (let i = copyLength; i < expectedLength; i += 4) {
                            fixedRgba[i] = 0;
                            fixedRgba[i + 1] = 0;
                            fixedRgba[i + 2] = 0;
                            fixedRgba[i + 3] = 0;
                        }
                        rgba = fixedRgba;
                    }
                } catch (rgbaError) {
                    const canvas = document.createElement('canvas');
                    canvas.width = firstIFD.width;
                    canvas.height = firstIFD.height;
                    const ctx = canvas.getContext('2d');

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

                const canvas = document.createElement('canvas');
                canvas.width = firstIFD.width;
                canvas.height = firstIFD.height;
                const ctx = canvas.getContext('2d');

                const imageData = ctx.createImageData(firstIFD.width, firstIFD.height);
                imageData.data.set(rgba);
                ctx.putImageData(imageData, 0, 0);

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

export const processLemGendaryResize = async (images, dimension, options = { quality: DEFAULT_QUALITY, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);

            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');
            const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
                fileName.endsWith('.tiff') || fileName.endsWith('.tif');

            if (isSVG) {
                try {
                    const svgText = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsText(imageFile);
                    });

                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                    const svgElement = svgDoc.documentElement;

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

                    if ((!widthAttr || !heightAttr) && svgElement.hasAttribute('viewBox')) {
                        const viewBox = svgElement.getAttribute('viewBox');
                        const parts = viewBox.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                        if (parts.length >= 4) {
                            originalWidth = parts[2];
                            originalHeight = parts[3];
                        }
                    }

                    let newWidth, newHeight;
                    const aspectRatio = originalWidth / originalHeight;

                    if (originalWidth >= originalHeight) {
                        newWidth = dimension;
                        newHeight = Math.round(dimension / aspectRatio);
                    } else {
                        newHeight = dimension;
                        newWidth = Math.round(dimension * aspectRatio);
                    }

                    newWidth = Math.max(1, newWidth);
                    newHeight = Math.max(1, newHeight);

                    const resizedSVG = await processSVGResize(imageFile, newWidth, newHeight);

                    let rasterFile;
                    try {
                        rasterFile = await convertSVGToRaster(resizedSVG, newWidth, newHeight, options.format || 'webp');
                    } catch (svgConversionError) {
                        const canvas = document.createElement('canvas');
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                        const ctx = canvas.getContext('2d');

                        const bgColor = '#f8f9fa';
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(0, 0, newWidth, newHeight);

                        ctx.strokeStyle = '#dee2e6';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(10, 10, newWidth - 20, newHeight - 20);

                        const centerX = newWidth / 2;
                        const centerY = newHeight / 2;

                        ctx.fillStyle = '#4a90e2';
                        const iconSize = Math.min(32, newHeight / 8);
                        ctx.font = `bold ${iconSize}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('🖋️', centerX, centerY - iconSize);

                        ctx.fillStyle = '#495057';
                        const titleSize = Math.min(18, newHeight / 12);
                        ctx.font = `bold ${titleSize}px Arial`;
                        ctx.fillText('SVG', centerX, centerY);

                        ctx.fillStyle = '#6c757d';
                        const infoSize = Math.min(14, newHeight / 16);
                        ctx.font = `${infoSize}px Arial`;
                        ctx.fillText(`${newWidth}×${newHeight}`, centerX, centerY + iconSize);

                        ctx.fillStyle = '#28a745';
                        const ratio = Math.round((originalWidth / originalHeight) * 100) / 100;
                        ctx.fillText(`${ratio}:1`, centerX, centerY + iconSize * 2);

                        const blob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
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
                    const canvas = document.createElement('canvas');
                    canvas.width = dimension;
                    canvas.height = dimension;
                    const ctx = canvas.getContext('2d');

                    ctx.fillStyle = '#f8d7da';
                    ctx.fillRect(0, 0, dimension, dimension);

                    ctx.strokeStyle = '#f5c6cb';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(10, 10, dimension - 20, dimension - 20);

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
                try {
                    let convertedFile;
                    try {
                        convertedFile = await convertLegacyFormat(imageFile);
                    } catch (convertError) {
                        convertedFile = await createTIFFPlaceholderFile(imageFile, dimension, dimension);
                    }

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
                        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
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
                    canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
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

export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: DEFAULT_QUALITY, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            const imageFile = await ensureFileObject(image);

            const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
            const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

            const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
                fileName.endsWith('.tiff') || fileName.endsWith('.tif');
            const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

            let croppedFile;

            if (isSVG) {
                croppedFile = await processSVGCrop(imageFile, width, height);
            } else {
                let processableFile = imageFile;
                if (isTIFF) {
                    try {
                        processableFile = await convertLegacyFormat(imageFile);
                    } catch (convertError) {
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
                        continue;
                    }
                }

                const img = new Image();
                const objectUrl = URL.createObjectURL(processableFile);

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Image load timeout'));
                    }, IMAGE_LOAD_TIMEOUT);

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

export const processSmartCrop = async (imageFile, targetWidth, targetHeight, options = { quality: DEFAULT_QUALITY, format: 'webp' }) => {
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

    if (isSVG) {
        try {
            return await convertSVGToRasterAndCrop(imageFile, targetWidth, targetHeight, options.format || 'webp', 'center');
        } catch (svgError) {
            return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
        }
    }

    const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    try {
        let processableFile = imageFile;

        if (isTIFF) {
            try {
                processableFile = await convertTIFFForProcessing(imageFile);
            } catch (convertError) {
                return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
            }
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(processableFile);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image load timeout'));
            }, IMAGE_LOAD_TIMEOUT);

            img.onload = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                setTimeout(resolve, 0);
            };
            img.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image'));
            };
            img.src = objectUrl;

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

        const totalPixels = img.naturalWidth * img.naturalHeight;

        if (totalPixels > MAX_TOTAL_PIXELS_FOR_AI ||
            img.naturalWidth > MAX_DIMENSION_FOR_AI ||
            img.naturalHeight > MAX_DIMENSION_FOR_AI) {
            return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
        }

        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = processableFile;

        if (needsUpscaling && !aiUpscalingDisabled) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            if (upscaleFactor > 1 && upscaleFactor <= MAX_SCALE_FACTOR) {
                try {
                    sourceFile = await upscaleImageWithAI(processableFile, upscaleFactor, imageFile.name);
                } catch (upscaleError) {
                }
            }
        }

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);

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
                    croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile);
                } else {
                    const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
                    const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
                    croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
                }
            } catch (aiError) {
                const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
                const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
                croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
            }
        } else {
            const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
            const adjustedPosition = adjustCropPositionForFocalPoint('center', focalPoint, loadedImg.width, loadedImg.height);
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
        }

        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
        return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }
};

export const processSimpleSmartCrop = async (imageFile, targetWidth, targetHeight, cropPosition = 'center', options = { quality: DEFAULT_QUALITY, format: 'webp' }) => {
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

    if (isSVG) {
        try {
            return await convertSVGToRasterAndCrop(imageFile, targetWidth, targetHeight, options.format || 'webp', cropPosition);
        } catch (svgError) {
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

    const isTIFF = mimeType === 'image/tiff' || mimeType === 'image/tif' ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    try {
        let processableFile = imageFile;

        if (isTIFF) {
            try {
                processableFile = await convertLegacyFormat(imageFile);
            } catch (convertError) {
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

        const img = new Image();
        const objectUrl = URL.createObjectURL(processableFile);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image load timeout'));
            }, IMAGE_LOAD_TIMEOUT);

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
                    if (!aiUpscalingDisabled) {
                        sourceFile = await upscaleImageWithAI(processableFile, upscaleFactor, imageFile.name);
                    } else {
                        sourceFile = await upscaleImageEnhancedFallback(processableFile, upscaleFactor, imageFile.name);
                    }
                } catch (upscaleError) {
                }
            }
        }

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);

        const loadedImg = await loadImage(resized.file);
        const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);

        const adjustedPosition = adjustCropPositionForFocalPoint(cropPosition, focalPoint, loadedImg.width, loadedImg.height);

        const croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);

        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
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
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

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

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/webp', 0.8);
            });

            return new File([blob], `${imageFile.name}-crop-error.webp`, {
                type: 'image/webp'
            });
        }
    }
};

export const processSVGResize = async (svgFile, width, height) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const svgText = e.target.result;
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                let originalWidth, originalHeight;

                const widthAttr = svgElement.getAttribute('width');
                if (widthAttr && !isNaN(parseFloat(widthAttr))) {
                    originalWidth = parseFloat(widthAttr);
                }

                const heightAttr = svgElement.getAttribute('height');
                if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                    originalHeight = parseFloat(heightAttr);
                }

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

                if (!originalWidth) originalWidth = 100;
                if (!originalHeight) originalHeight = 100;

                const aspectRatio = originalWidth / originalHeight;
                let finalWidth = width;
                let finalHeight = height;

                if (width && !height) {
                    finalWidth = width;
                    finalHeight = Math.round(width / aspectRatio);
                }
                else if (!width && height) {
                    finalHeight = height;
                    finalWidth = Math.round(height * aspectRatio);
                }
                else if (width && height) {
                    finalWidth = width;
                    finalHeight = height;
                }
                else {
                    finalWidth = originalWidth;
                    finalHeight = originalHeight;
                }

                svgElement.setAttribute('width', finalWidth.toString());
                svgElement.setAttribute('height', finalHeight.toString());

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

export const convertSVGToRaster = async (svgFile, targetWidth, targetHeight, format = 'png') => {
    try {
        return await convertSVGToRasterWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    } catch (error) {
        return await createSVGPlaceholderWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    }
};

const convertSVGToRasterWithAspectRatio = async (svgFile, targetWidth, targetHeight, format) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            let svgUrl = null;

            try {
                const svgText = e.target.result;

                if (!svgText || typeof svgText !== 'string') {
                    throw new Error('Empty or invalid SVG content');
                }

                const trimmedText = svgText.trim();
                if (trimmedText.length === 0) {
                    throw new Error('Empty SVG content');
                }

                let finalSvgText = trimmedText;
                if (!trimmedText.startsWith('<')) {
                    finalSvgText = `<?xml version="1.0" encoding="UTF-8"?>
                    <svg xmlns="http://www.w3.org/2000/svg"
                         width="${targetWidth || 100}"
                         height="${targetHeight || 100}"
                         viewBox="0 0 ${targetWidth || 100} ${targetHeight || 100}">
                        ${trimmedText}
                    </svg>`;
                }

                let svgElement;
                let originalWidth = targetWidth || 100;
                let originalHeight = targetHeight || 100;

                try {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(finalSvgText, 'image/svg+xml');
                    svgElement = svgDoc.documentElement;

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

                let finalWidth, finalHeight;
                const aspectRatio = originalWidth / originalHeight;

                if (targetWidth && targetHeight) {
                    const targetAspectRatio = targetWidth / targetHeight;

                    if (aspectRatio > targetAspectRatio) {
                        finalWidth = targetWidth;
                        finalHeight = targetWidth / aspectRatio;
                    } else {
                        finalHeight = targetHeight;
                        finalWidth = targetHeight * aspectRatio;
                    }
                } else if (targetWidth && !targetHeight) {
                    finalWidth = targetWidth;
                    finalHeight = targetWidth / aspectRatio;
                } else if (!targetWidth && targetHeight) {
                    finalHeight = targetHeight;
                    finalWidth = targetHeight * aspectRatio;
                } else {
                    finalWidth = originalWidth;
                    finalHeight = originalHeight;
                }

                finalWidth = Math.max(1, Math.round(finalWidth));
                finalHeight = Math.max(1, Math.round(finalHeight));

                const svgBlob = new Blob([finalSvgText], { type: 'image/svg+xml' });
                svgUrl = URL.createObjectURL(svgBlob);

                const canvas = document.createElement('canvas');
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                const ctx = canvas.getContext('2d');

                if (format === 'jpg' || format === 'jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                const img = new Image();

                await new Promise((resolveLoad, rejectLoad) => {
                    const timeout = setTimeout(() => {
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        rejectLoad(new Error('SVG load timeout'));
                    }, IMAGE_LOAD_TIMEOUT);

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

                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

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
                    format.toLowerCase() === 'png' ? DEFAULT_PNG_QUALITY : DEFAULT_QUALITY
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

const createSVGPlaceholderWithAspectRatio = async (svgFile, targetWidth, targetHeight, format) => {
    return new Promise((resolve) => {
        let aspectRatio = 1;

        const fileName = svgFile.name || '';
        const dimensionMatch = fileName.match(/(\d+)[x×](\d+)/i);
        if (dimensionMatch) {
            const width = parseInt(dimensionMatch[1]);
            const height = parseInt(dimensionMatch[2]);
            if (width > 0 && height > 0) {
                aspectRatio = width / height;
            }
        }

        let finalWidth, finalHeight;

        if (targetWidth && targetHeight) {
            const targetAspectRatio = targetWidth / targetHeight;

            if (aspectRatio > targetAspectRatio) {
                finalWidth = targetWidth;
                finalHeight = targetWidth / aspectRatio;
            } else {
                finalHeight = targetHeight;
                finalWidth = targetHeight * aspectRatio;
            }
        } else if (targetWidth && !targetHeight) {
            finalWidth = targetWidth;
            finalHeight = targetWidth / aspectRatio;
        } else if (!targetWidth && targetHeight) {
            finalHeight = targetHeight;
            finalWidth = targetHeight * aspectRatio;
        } else {
            finalWidth = 400;
            finalHeight = 400 / aspectRatio;
        }

        finalWidth = Math.round(finalWidth);
        finalHeight = Math.round(finalHeight);

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.fillStyle = '#4a90e2';
        ctx.font = `bold ${Math.min(32, canvas.height / 8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🖋️', centerX, centerY - 30);

        ctx.fillStyle = '#495057';
        ctx.font = `bold ${Math.min(18, canvas.height / 12)}px Arial`;
        ctx.fillText('SVG', centerX, centerY);

        ctx.fillStyle = '#6c757d';
        ctx.font = `${Math.min(14, canvas.height / 16)}px Arial`;
        ctx.fillText(`${Math.round(aspectRatio * 100) / 100}:1`, centerX, centerY + 30);

        ctx.fillStyle = '#28a745';
        ctx.font = `${Math.min(12, canvas.height / 20)}px Arial`;
        ctx.fillText(`${finalWidth}×${finalHeight}`, centerX, centerY + 60);

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

const convertLegacyFormat = async (imageFile) => {
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isTIFF = TIFF_FORMATS.includes(mimeType) ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    if (!LEGACY_FORMATS.includes(mimeType) && !isTIFF) {
        return imageFile;
    }

    if (isTIFF) {
        try {
            return await convertTIFFForProcessing(imageFile);
        } catch (error) {
            return await createTIFFPlaceholderFile(imageFile);
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image load timeout'));
        }, IMAGE_LOAD_TIMEOUT);

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

const convertTIFFWithBrowser = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(tiffFile);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('TIFF load timeout'));
        }, IMAGE_LOAD_TIMEOUT);

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

export const optimizeForWeb = async (imageFile, quality = DEFAULT_QUALITY, format = 'webp') => {
    if (!imageFile || typeof imageFile !== 'object') {
        throw new Error('Invalid image file provided to optimizeForWeb');
    }

    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isTIFF = TIFF_FORMATS.includes(mimeType) ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif');

    if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
        try {
            return await convertSVGToRaster(imageFile, 1000, 1000, format);
        } catch (svgError) {
            return await createSVGPlaceholderWithAspectRatio(imageFile, 1000, 1000, format);
        }
    }

    const isLegacyFormat = LEGACY_FORMATS.includes(mimeType) ||
        fileName.endsWith('.tiff') || fileName.endsWith('.tif') ||
        fileName.endsWith('.bmp') || fileName.endsWith('.ico');

    let processedFile = imageFile;

    if (isLegacyFormat) {
        try {
            if (isTIFF) {
                processedFile = await convertTIFFForProcessing(imageFile);
            } else {
                processedFile = await convertLegacyFormat(imageFile);
            }
        } catch (error) {
            if (isTIFF) {
                processedFile = await createTIFFPlaceholderFile(imageFile);
            } else {
                processedFile = await createSimpleLegacyConversion(imageFile);
            }
        }
    }

    if (format === 'original') {
        if (isLegacyFormat) {
            return processedFile;
        }
        return imageFile;
    }

    const supportsAVIF = await checkAVIFSupport();
    const hasTransparency = await checkImageTransparency(processedFile);

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

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image load timeout'));
        }, IMAGE_LOAD_TIMEOUT);

        img.onload = () => {
            clearTimeout(timeout);

            try {
                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Image has invalid dimensions'));
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (needsWhiteBackground) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

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

            if (isTIFF) {
                createTIFFPlaceholderFile(imageFile)
                    .then((placeholderFile) => {
                        optimizeForWeb(placeholderFile, quality, format)
                            .then(resolve)
                            .catch(() => {
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

export const convertSVGToRasterAndCrop = async (svgFile, targetWidth, targetHeight, format = 'webp', cropPosition = 'center') => {
    try {
        const scaleFactor = 2;
        const conversionWidth = Math.max(targetWidth, 500) * scaleFactor;
        const conversionHeight = Math.max(targetHeight, 500) * scaleFactor;

        const rasterFile = await convertSVGToRaster(svgFile, conversionWidth, conversionHeight, 'png');

        const cropResults = await processLemGendaryCrop(
            [{ file: rasterFile, name: svgFile.name }],
            targetWidth,
            targetHeight,
            cropPosition,
            { quality: DEFAULT_PNG_QUALITY, format: format }
        );

        if (cropResults.length > 0 && cropResults[0].cropped) {
            return cropResults[0].cropped;
        }

        throw new Error('Crop operation failed');

    } catch (error) {
        return await createSVGPlaceholderWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    }
};

const createSimpleLegacyConversion = async (imageFile) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const fileName = imageFile.name.toLowerCase();

        let width = 800;
        let height = 600;

        const dimensionMatch = fileName.match(/(\d+)x(\d+)/);
        if (dimensionMatch) {
            width = parseInt(dimensionMatch[1]);
            height = parseInt(dimensionMatch[2]);
        }

        const maxSize = 1200;
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        let fileType = 'File';
        if (fileName.endsWith('.tiff') || fileName.endsWith('.tif')) fileType = 'TIFF';
        else if (fileName.endsWith('.bmp')) fileType = 'BMP';
        else if (fileName.endsWith('.ico')) fileType = 'ICO';

        const centerX = width / 2;
        const centerY = height / 2;

        ctx.fillStyle = '#6c757d';
        ctx.font = `bold ${Math.min(48, height / 8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📄', centerX, centerY - 50);

        ctx.fillStyle = '#343a40';
        ctx.font = `bold ${Math.min(24, height / 12)}px Arial`;
        ctx.fillText(fileType, centerX, centerY);

        ctx.fillStyle = '#28a745';
        ctx.font = `${Math.min(16, height / 16)}px Arial`;
        ctx.fillText(`${width} × ${height}`, centerX, centerY + 40);

        ctx.fillStyle = '#6c757d';
        ctx.font = `${Math.min(14, height / 20)}px Arial`;
        const displayName = imageFile.name.length > 30 ?
            imageFile.name.substring(0, 27) + '...' : imageFile.name;
        ctx.fillText(displayName, centerX, centerY + 80);

        canvas.toBlob((blob) => {
            const newName = imageFile.name ?
                imageFile.name.replace(/\.[^/.]+$/, '.png') : 'converted.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

export const createImageObjects = (files) => {
    return Promise.all(Array.from(files).map(async (file) => {
        const fileObj = file instanceof File ? file : new File([file], file.name || 'image', { type: file.type });

        const fileName = fileObj.name ? fileObj.name.toLowerCase() : '';
        const mimeType = fileObj.type ? fileObj.type.toLowerCase() : '';

        const isTIFF = TIFF_FORMATS.includes(mimeType) ||
            fileName.endsWith('.tiff') || fileName.endsWith('.tif');
        const isSVG = mimeType === 'image/svg+xml' || fileName.endsWith('.svg');

        let url;
        let previewData = null;
        let originalWidth = null;
        let originalHeight = null;

        if (isTIFF) {
            try {
                const converted = await convertTIFFForProcessing(fileObj);

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
                url = createTIFFPlaceholder();
            }
        } else if (isSVG) {
            try {
                const svgText = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(fileObj);
                });

                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

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

                const previewFile = await convertSVGToRaster(fileObj, Math.min(200, width), Math.min(200, height), 'png');
                url = URL.createObjectURL(previewFile);
                originalWidth = width;
                originalHeight = height;

            } catch (error) {
                url = createTIFFPlaceholder();
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

const convertTIFFForProcessing = async (tiffFile) => {
    try {
        try {
            const result = await convertTIFFSimple(tiffFile);
            return result;
        } catch (simpleError) {
        }

        if (window.UTIF && typeof window.UTIF.decode === 'function') {
            try {
                const result = await convertTIFFWithUTIFRobust(tiffFile);
                return result;
            } catch (utifError) {
            }
        }

        try {
            return await createTIFFPlaceholderFromInfo(tiffFile);
        } catch (placeholderError) {
        }

        return await createTIFFPlaceholderFile(tiffFile);

    } catch (error) {
        return await createTIFFPlaceholderFile(tiffFile);
    }
};

const createTIFFPlaceholderFromInfo = async (tiffFile) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');

        const fileName = tiffFile.name || '';
        let width = 800;
        let height = 600;

        const dimensionMatch = fileName.match(/(\d+)[x×](\d+)/i);
        if (dimensionMatch) {
            width = parseInt(dimensionMatch[1]);
            height = parseInt(dimensionMatch[2]);
        }

        const maxSize = 1200;
        if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#4a90e2');
        gradient.addColorStop(0.5, '#5cb85c');
        gradient.addColorStop(1, '#f0ad4e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(60, width / 10)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', width / 2, height / 2 - 40);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.min(24, width / 20)}px Arial`;
        ctx.fillText('TIFF Image', width / 2, height / 2 + 20);

        ctx.font = `${Math.min(16, width / 30)}px Arial`;
        ctx.fillText(`${width} × ${height}`, width / 2, height / 2 + 60);

        canvas.toBlob((blob) => {
            const newName = fileName ?
                fileName.replace(/\.(tiff|tif)$/i, '.png') :
                'converted-tiff.png';
            resolve(new File([blob], newName, { type: 'image/png' }));
        }, 'image/png', 0.9);
    });
};

const convertTIFFWithUTIFRobust = (tiffFile) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;

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
                }

                let width = 800;
                let height = 600;

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
                        } else {
                        }
                    } catch (rgbaError) {
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
                            reject(new Error('Failed to create PNG'));
                            return;
                        }

                        const originalName = tiffFile.name || 'converted-tiff';
                        const baseName = originalName.replace(/\.[^/.]+$/, '');
                        const newFileName = `${baseName}.png`;

                        resolve(new File([blob], newFileName, { type: 'image/png' }));

                    }, 'image/png', 1.0);
                } else {
                    const canvas = document.createElement('canvas');

                    const maxSize = 1200;
                    if (width > maxSize || height > maxSize) {
                        const scale = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    const gradient = ctx.createLinearGradient(0, 0, width, height);
                    gradient.addColorStop(0, '#4a90e2');
                    gradient.addColorStop(0.5, '#5cb85c');
                    gradient.addColorStop(1, '#f0ad4e');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(20, 20, width - 40, height - 40);

                    const centerX = width / 2;
                    const centerY = height / 2;

                    ctx.fillStyle = '#ffffff';
                    const iconSize = Math.min(60, width / 8);
                    ctx.font = `bold ${iconSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('📷', centerX, centerY - 50);

                    ctx.fillStyle = '#ffffff';
                    const titleSize = Math.min(28, width / 15);
                    ctx.font = `bold ${titleSize}px Arial`;
                    ctx.fillText('TIFF Image', centerX, centerY);

                    const infoSize = Math.min(18, width / 25);
                    ctx.font = `${infoSize}px Arial`;
                    ctx.fillText(`${width} × ${height}`, centerX, centerY + 40);

                    ctx.fillStyle = '#ff6b6b';
                    ctx.font = `${Math.min(14, width / 30)}px Arial`;
                    ctx.fillText('Preview Not Available', centerX, centerY + 80);

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

const convertTIFFSimple = (tiffFile) => {
    return new Promise((resolve, reject) => {
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
            reject(new Error('Browser cannot load TIFF'));
        };

        img.src = objectUrl;
    });
};

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

export const cleanupBlobUrls = (imageObjects) => {
    imageObjects?.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
            } catch (e) {
            }
        }

        if (image.previewData && image.previewData.url) {
            try {
                URL.revokeObjectURL(image.previewData.url);
            } catch (e) {
            }
        }

        if (image.previewData && image.previewData.canvas) {
            try {
                const ctx = image.previewData.canvas.getContext('2d');
                ctx.clearRect(0, 0, image.previewData.canvas.width, image.previewData.canvas.height);
            } catch (e) {
            }
        }
    });
};

export const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
        if (!file || typeof file !== 'object') {
            resolve(false);
            return;
        }

        const fileName = file.name ? file.name.toLowerCase() : '';
        const mimeType = file.type ? file.type.toLowerCase() : '';

        const nonTransparentFormats = [
            'image/jpeg', 'image/jpg', 'image/bmp',
            'image/tiff', 'image/tif', 'image/x-icon',
            'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
        ];

        if (fileName.endsWith('.jpeg') || fileName.endsWith('.jpg') ||
            fileName.endsWith('.bmp') || fileName.endsWith('.tiff') ||
            fileName.endsWith('.tif') || fileName.endsWith('.ico') ||
            fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
            resolve(false);
            return;
        }

        if (mimeType && nonTransparentFormats.includes(mimeType)) {
            resolve(false);
            return;
        }

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
                        svgText.includes('fill:#fff0') ||
                        svgText.includes('fill: transparent') ||
                        svgText.includes('stroke: transparent') ||
                        svgText.match(/\.\w+\s*{[^}]*opacity:/i) ||
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

        if (mimeType === 'image/gif' || fileName.endsWith('.gif')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);

                    if (bytes.length >= 13) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
                            const packedFields = bytes[10];
                            const hasColorTable = (packedFields & 0x80) !== 0;
                            const colorTableSize = packedFields & 0x07;

                            if (hasColorTable && bytes.length >= 14 + (3 * (1 << (colorTableSize + 1)))) {
                                for (let i = 13; i < bytes.length - 1; i++) {
                                    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
                                        if (i + 4 < bytes.length) {
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

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

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

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0);

                const totalPixels = canvas.width * canvas.height;

                if (totalPixels > 1000000) {
                    const sampleCanvas = document.createElement('canvas');
                    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

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

                    sampleCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height,
                        0, 0, sampleWidth, sampleHeight);

                    const sampleData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

                    for (let i = 3; i < sampleData.length; i += 4) {
                        if (sampleData[i] < 255) {
                            URL.revokeObjectURL(objectUrl);
                            resolve(true);
                            return;
                        }
                    }

                    const keyAreas = [
                        { x: 0, y: 0, width: 1, height: 1 },
                        { x: canvas.width - 1, y: 0, width: 1, height: 1 },
                        { x: 0, y: canvas.height - 1, width: 1, height: 1 },
                        { x: canvas.width - 1, y: canvas.height - 1, width: 1, height: 1 },
                        { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2), width: 1, height: 1 },
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
                        }
                    }

                    URL.revokeObjectURL(objectUrl);
                    resolve(false);
                } else {
                    try {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;

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

const checkTransparencyBySampling = (ctx, width, height) => {
    try {
        const sampleWidth = Math.min(100, width);
        const sampleHeight = Math.min(100, height);
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = sampleWidth;
        sampleCanvas.height = sampleHeight;
        const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

        sampleCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, sampleWidth, sampleHeight);

        const sampleData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

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

export const checkImageTransparencyDetailed = async (file) => {
    return new Promise((resolve) => {
        const nonTransparentFormats = [
            'image/jpeg', 'image/jpg', 'image/bmp',
            'image/tiff', 'image/tif', 'image/x-icon',
            'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
        ];

        const fileName = file.name.toLowerCase();
        const mimeType = file.type.toLowerCase();

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
                        alphaChannel: false,
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
                        alphaChannel: false,
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

        checkImageTransparency(file).then((hasTransparency) => {
            let format = 'unknown';
            if (mimeType.includes('png')) format = 'png';
            else if (mimeType.includes('webp')) format = 'webp';
            else if (mimeType.includes('avif')) format = 'avif';
            else if (mimeType.includes('apng')) format = 'apng';
            else if (fileName.endsWith('.png')) format = 'png';
            else if (fileName.endsWith('.webp')) format = 'webp';
            else if (fileName.endsWith('.avif')) format = 'avif';
            else if (fileName.endsWith('.apng')) format = 'apng';

            let type = 'opaque';
            let alphaChannel = false;

            if (hasTransparency) {
                if (format === 'gif') {
                    type = 'gif-transparency';
                    alphaChannel = false;
                } else if (['png', 'webp', 'avif', 'apng'].includes(format)) {
                    type = 'alpha-channel';
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

export const checkImageTransparencyQuick = async (file) => {
    const nonTransparentFormats = [
        'image/jpeg', 'image/jpg', 'image/bmp',
        'image/tiff', 'image/tif', 'image/x-icon',
        'image/vnd.microsoft.icon', 'image/heic', 'image/heif'
    ];

    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    if (fileName.endsWith('.jpeg') || fileName.endsWith('.jpg') ||
        fileName.endsWith('.bmp') || fileName.endsWith('.tiff') ||
        fileName.endsWith('.tif') || fileName.endsWith('.ico') ||
        fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        return false;
    }

    if (nonTransparentFormats.includes(mimeType)) {
        return false;
    }

    if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result.substring(0, 5000);
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
            reader.readAsText(file.slice(0, 5000));
        });
    }

    if (mimeType === 'image/gif' || fileName.endsWith('.gif')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);

                    if (bytes.length >= 14) {
                        const signature = String.fromCharCode(...bytes.slice(0, 6));
                        if (signature === 'GIF89a') {
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
            reader.readAsArrayBuffer(file.slice(0, 1024));
        });
    }

    return checkImageTransparency(file);
};

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
        const cropType = summaryData.cropMode === CROP_MODES.SMART ? t('operations.aiCrop') : t('operations.standardCrop');
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

    if (summaryData.mode === PROCESSING_MODES.TEMPLATES) {
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

export const validateImageFiles = (files) => {
    return Array.from(files).filter(file => {
        const mimeType = file.type.toLowerCase();
        return SUPPORTED_INPUT_FORMATS.some(format =>
            mimeType.includes(format.replace('image/', '')) || mimeType === format
        );
    });
};

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
        resize: (processingOptions.showResize && processingOptions.resizeDimension &&
            processingOptions.resizeDimension.trim() !== '') ? {
            enabled: true,
            dimension: parseInt(processingOptions.resizeDimension)
        } : { enabled: false },
        crop: (processingOptions.showCrop && processingOptions.cropWidth &&
            processingOptions.cropWidth.trim() !== '' && processingOptions.cropHeight &&
            processingOptions.cropHeight.trim() !== '') ? {
            enabled: true,
            width: parseInt(processingOptions.cropWidth),
            height: parseInt(processingOptions.cropHeight),
            mode: processingOptions.cropMode || CROP_MODES.STANDARD,
            position: processingOptions.cropPosition || 'center'
        } : { enabled: false },
        templates: {
            selected: processingOptions.selectedTemplates || [],
            mode: processingOptions.processingMode || PROCESSING_MODES.CUSTOM
        }
    };

    return config;
};

export const getAvailableFormats = () => {
    return OUTPUT_FORMATS;
};

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
            const cropType = options.crop.mode === CROP_MODES.SMART ? 'smart-crop' : 'crop';
            suffixParts.push(`${cropType}-${options.crop.width}x${options.crop.height}`);

            if (options.crop.mode === CROP_MODES.STANDARD && options.crop.position !== 'center') {
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

export const createProcessingSummary = (result, options, t) => {
    const summary = {
        mode: options.templates?.mode || PROCESSING_MODES.CUSTOM,
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
        const cropType = options.crop.mode === CROP_MODES.SMART ? t('operations.aiCrop') : t('operations.standardCrop');
        summary.operations.push(`${cropType} ${options.crop.width}x${options.crop.height}`);
        summary.upscalingUsed = true;

        if (options.crop.mode === CROP_MODES.SMART) {
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

const calculateUpscaleFactor = (originalWidth, originalHeight, targetWidth, targetHeight) => {
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;
    const requiredScale = Math.max(widthScale, heightScale);

    const availableScales = AVAILABLE_UPSCALE_FACTORS;

    for (const scale of availableScales) {
        if (scale >= requiredScale) {
            const safeDimensions = calculateSafeDimensions(originalWidth, originalHeight, scale);
            if (!safeDimensions.wasAdjusted) return scale;
        }
    }

    if (requiredScale > 1) return Math.min(requiredScale, 2);
    return 1;
};

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

        const availableScales = AVAILABLE_UPSCALE_FACTORS;
        const maxScaleFactor = Math.max(...AVAILABLE_UPSCALE_FACTORS);
        if (!availableScales.includes(scale) || scale > maxScaleFactor) {
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
            canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
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

const safeUpscale = async (upscaler, img, scale) => {
    if (upscalerUsageCount[scale]) upscalerUsageCount[scale]++;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            releaseUpscalerForScale(scale);
            reject(new Error('Upscaling timeout'));
        }, UPSCALING_TIMEOUT);

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

const applySmartSharpening = (canvas, ctx, scale) => {
    try {
        const width = canvas.width;
        const height = canvas.height;

        if (width * height > MAX_PIXELS_FOR_SMART_SHARPENING) return;

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
    }
};

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

    if (targetWidth * targetHeight > MAX_PIXELS_FOR_SMART_SHARPENING) {
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
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-enhanced-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

const upscaleImageTiled = async (img, scale, originalName, objectUrl) => {
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    const tileSize = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const xTiles = Math.ceil(targetWidth / tileSize);
    const yTiles = Math.ceil(targetHeight / tileSize);

    for (let y = 0; y < yTiles; y++) {
        for (let x = 0; x < xTiles; x++) {
            const tileX = x * tileSize;
            const tileY = y * tileSize;
            const tileWidth = Math.min(tileSize, targetWidth - tileX);
            const tileHeight = Math.min(tileSize, targetHeight - tileY);

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
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-tiled-upscaled-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

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
        cropCanvas.toBlob(resolve, 'image/png', DEFAULT_PNG_QUALITY);
    });

    const croppedFile = new File([croppedBlob], svgFile.name.replace(/\.svg$/i, '.png'), {
        type: 'image/png'
    });

    URL.revokeObjectURL(svgUrl);
    return croppedFile;
};

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
                DEFAULT_WEBP_QUALITY
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

const loadImage = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load timeout'));
        }, IMAGE_LOAD_TIMEOUT);

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

const loadImageWithPerformance = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        const startTime = performance.now();

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load timeout'));
        }, UPSCALING_TIMEOUT);

        const onLoad = () => {
            const loadTime = performance.now() - startTime;

            clearTimeout(timeout);
            URL.revokeObjectURL(url);

            Promise.resolve().then(() => {
                resolve({
                    element: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    loadTime: loadTime
                });
            });
        };

        const onError = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);

            Promise.resolve().then(() => {
                reject(new Error(`Failed to load image: ${file.name}`));
            });
        };

        img.onload = onLoad;
        img.onerror = onError;
        img.src = url;

        if (file.size > 2000000 && img.decode) {
            img.decode().then(onLoad).catch(onError);
        }
    });
};

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

        const margin = Math.min(CROP_MARGIN, width * 0.1, height * 0.1);

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
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
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

const getLuminance = (data, idx) => {
    if (idx < 0 || idx >= data.length) return 0;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
};

const findMainSubject = (predictions, imgWidth, imgHeight) => {
    if (!predictions || predictions.length === 0) return null;

    const validPredictions = predictions.filter(pred =>
        pred.score > AI_SETTINGS.MIN_CONFIDENCE &&
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

if (typeof window !== 'undefined') {
    window.addEventListener('load', initializeGPUMemoryMonitor);
    window.addEventListener('beforeunload', cleanupAllResources);
    window.addEventListener('pagehide', cleanupAllResources);
}