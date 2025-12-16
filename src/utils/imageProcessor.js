// ============================================
// IMAGE PROCESSOR - Complete Proper Implementation
// ============================================
// All crops resize first (cover mode) for consistent behavior
// All processed images are automatically optimized

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// ============================================
// SECTION 1: CORE PROCESSING FUNCTIONS (Exported)
// ============================================

/**
 * LemGendary Resize: Smart resize maintaining aspect ratio
 * For portrait: sets height to dimension, calculates width
 * For landscape: sets width to dimension, calculates height
 * @param {Array} images - Array of image objects with {file, name} properties
 * @param {number} dimension - Target dimension (px)
 * @param {Object} options - Optimization options {quality: number, format: string}
 * @returns {Promise<Array>} - Array of optimized resized images
 */
export const processLemGendaryResize = async (images, dimension, options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            let processedFile;

            if (image.file.type === 'image/svg+xml') {
                // SVG resize
                processedFile = await processSVGResize(image.file, dimension);
            } else {
                // Raster image resize
                const img = await createImageBitmap(image.file);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let newWidth, newHeight;
                if (img.width >= img.height) {
                    // Landscape or square
                    newWidth = dimension;
                    newHeight = Math.round((img.height / img.width) * dimension);
                } else {
                    // Portrait
                    newHeight = dimension;
                    newWidth = Math.round((img.width / img.height) * dimension);
                }

                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                const resizedBlob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/webp', 0.85);
                });

                processedFile = new File([resizedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), {
                    type: 'image/webp'
                });
            }

            // Optimize the resized image
            const optimizedFile = await optimizeForWeb(processedFile, options.quality, options.format);

            results.push({
                original: image,
                resized: optimizedFile,
                dimensions: { width: dimension, height: dimension },
                isSVG: image.file.type === 'image/svg+xml',
                optimized: true
            });

        } catch (error) {
            console.error(`Error resizing ${image.name}:`, error);
        }
    }

    return results;
};

/**
 * LemGendary Crop: Resizes image to cover dimensions, then crops from position
 * @param {Array} images - Array of image objects with {file, name} properties
 * @param {number} width - Target width (px)
 * @param {number} height - Target height (px)
 * @param {string} cropPosition - Crop position ('center', 'top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right')
 * @param {Object} options - Optimization options {quality: number, format: string}
 * @returns {Promise<Array>} - Array of optimized cropped images
 */
export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            let croppedFile;

            if (image.file.type === 'image/svg+xml') {
                // SVG requires special handling
                const img = new Image();
                const svgUrl = URL.createObjectURL(image.file);

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = svgUrl;
                });

                // Convert SVG to raster, resize, then crop
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

                const { offsetX, offsetY } = calculateCropOffset(scaledWidth, scaledHeight, width, height, cropPosition);

                cropCtx.drawImage(
                    tempCanvas,
                    offsetX, offsetY, width, height,
                    0, 0, width, height
                );

                const croppedBlob = await new Promise(resolve => {
                    cropCanvas.toBlob(resolve, 'image/png', 0.85);
                });

                croppedFile = new File([croppedBlob], image.name.replace(/\.svg$/i, '.png'), {
                    type: 'image/png'
                });

                URL.revokeObjectURL(svgUrl);

            } else {
                // Raster image: resize first, then crop
                const resized = await resizeImageForCrop(image.file, width, height);
                croppedFile = await cropFromResized(resized, width, height, cropPosition, image.file);
            }

            // Optimize the cropped image
            const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedFile,
                dimensions: { width, height },
                isSVG: image.file.type === 'image/svg+xml',
                optimized: true
            });

        } catch (error) {
            console.error(`Error cropping ${image.name}:`, error);
        }
    }

    return results;
};

/**
 * AI Smart Crop: Resizes first, detects main subject, crops intelligently
 * @param {File} imageFile - Input image file
 * @param {number} targetWidth - Target width (px)
 * @param {number} targetHeight - Target height (px)
 * @param {Object} options - Optimization options {quality: number, format: string}
 * @returns {Promise<File>} - Optimized smart-cropped image
 */
export const processSmartCrop = async (imageFile, targetWidth, targetHeight, options = { quality: 0.85, format: 'webp' }) => {
    try {
        // 1. Resize image to cover target dimensions FIRST
        const resized = await resizeImageForCrop(imageFile, targetWidth, targetHeight);

        // 2. Load AI model
        const model = await loadAIModel();

        // 3. Load the RESIZED image for AI detection
        const img = await loadImage(resized.file);
        const predictions = await model.detect(img.element);

        // 4. Find main subject in RESIZED image
        const mainSubject = findMainSubject(predictions, img.width, img.height);

        let croppedFile;

        if (mainSubject) {
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile);
        } else {
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, 'center', imageFile);
        }

        // 7. Optimize the cropped image
        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

        return optimizedFile;

    } catch (error) {
        console.error('AI smart crop error:', error);
        // Fallback to simple smart crop
        return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }
};

/**
 * Simple Smart Crop: Resizes first, uses TensorFlow.js for edge detection to find focal point
 * @param {File} imageFile - Input image file
 * @param {number} targetWidth - Target width (px)
 * @param {number} targetHeight - Target height (px)
 * @param {string} cropPosition - Crop position
 * @param {Object} options - Optimization options {quality: number, format: string}
 * @returns {Promise<File>} - Optimized simple-smart-cropped image
 */
export const processSimpleSmartCrop = async (imageFile, targetWidth, targetHeight, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    try {
        // 1. Resize image to cover target dimensions
        const resized = await resizeImageForCrop(imageFile, targetWidth, targetHeight);

        // 2. Load the resized image
        const img = await loadImage(resized.file);

        // 3. Create saliency map using TensorFlow.js edge detection
        const saliencyMap = await createSaliencyMapTensorFlow(img.element, img.width, img.height);

        // 4. Calculate focal point from saliency map
        const focalPoint = calculateFocalPoint(saliencyMap, img.width, img.height);

        // 5. Adjust crop position based on focal point
        const adjustedPosition = adjustCropPositionForFocalPoint(cropPosition, focalPoint, img.width, img.height);

        // 6. Crop from resized image
        const croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);

        // 7. Optimize the cropped image
        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

        return optimizedFile;

    } catch (error) {
        console.error('Simple smart crop error:', error);
        // Fallback to standard crop
        const cropResults = await processLemGendaryCrop(
            [{ file: imageFile, name: imageFile.name }],
            targetWidth,
            targetHeight,
            cropPosition,
            options
        );
        return cropResults[0]?.cropped || imageFile;
    }
};

/**
 * LemGendary Rename: Batch rename functionality
 * @param {Array} images - Array of image objects with {file, name, type} properties
 * @param {string} baseName - Base name for renamed files
 * @returns {Promise<Array>} - Array of renamed image results
 */
export const processLemGendaryRename = async (images, baseName) => {
    return images.map((image, index) => {
        const extension = image.name.split('.').pop();
        const newName = baseName
            ? `${baseName}-${String(index + 1).padStart(2, '0')}.${extension}`
            : image.name;

        return {
            original: image,
            renamed: new File([image.file], newName, { type: image.type }),
            newName
        };
    });
};

/**
 * Optimize image for web with format conversion
 * @param {File} imageFile - Input image file
 * @param {number} quality - Quality level (0.1 to 1.0)
 * @param {string} format - Output format ('webp', 'jpg', 'jpeg', 'png')
 * @returns {Promise<File>} - Optimized image file
 */
export const optimizeForWeb = async (imageFile, quality = 0.8, format = 'webp') => {
    if (imageFile.type === 'image/svg+xml') {
        return convertSVGToRaster(imageFile, 1000, 1000, format);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');

            if (format === 'jpg' || format === 'jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0);

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
                    mimeType = 'image/webp';
                    extension = 'webp';
            }

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }

                    const originalName = imageFile.name.replace(/\.[^/.]+$/, '');
                    const newName = `${originalName}.${extension}`;
                    resolve(new File([blob], newName, { type: mimeType }));
                },
                mimeType,
                quality
            );
        };

        img.onerror = (err) => {
            console.error('Image load error:', err);
            reject(new Error('Failed to load image'));
        };

        img.src = URL.createObjectURL(imageFile);

        setTimeout(() => {
            if (img.src) URL.revokeObjectURL(img.src);
        }, 1000);
    });
};

/**
 * Check image transparency
 * @param {File} file - Image file
 * @returns {Promise<boolean>} - True if image has transparency
 */
export const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
        if (file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const svgText = e.target.result;
                const hasTransparency = svgText.includes('fill="none"') ||
                    svgText.includes('opacity=') ||
                    svgText.includes('fill-opacity') ||
                    svgText.includes('rgba(') ||
                    svgText.includes('fill:#00000000');
                resolve(hasTransparency);
            };
            reader.onerror = () => resolve(false);
            reader.readAsText(file);
        } else if (file.type !== 'image/png') {
            resolve(false);
        } else {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 255) {
                        resolve(true);
                        return;
                    }
                }
                resolve(false);
            };
            img.onerror = () => resolve(false);
            img.src = URL.createObjectURL(file);
        }
    });
};

// ============================================
// SECTION 2: AI PROCESSING FUNCTIONS
// ============================================

let aiModel = null;
let aiModelLoading = false;

/**
 * Load AI model for smart cropping
 * @returns {Promise<Object>} - Loaded AI model
 */
export const loadAIModel = async () => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        aiModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        aiModelLoading = false;
        return aiModel;
    } catch (error) {
        aiModelLoading = false;
        throw error;
    }
};

/**
 * Find main subject from AI predictions
 * @param {Array} predictions - AI model predictions
 * @param {number} imgWidth - Image width
 * @param {number} imgHeight - Image height
 * @returns {Object|null} - Main subject object or null
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

// ============================================
// SECTION 3: SVG PROCESSING FUNCTIONS
// ============================================

/**
 * SVG-specific resize function
 * @param {File} svgFile - SVG file
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<File>} - Resized SVG file
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

                const originalWidth = parseFloat(svgElement.getAttribute('width')) ||
                    svgElement.viewBox?.baseVal?.width || 100;
                const originalHeight = parseFloat(svgElement.getAttribute('height')) ||
                    svgElement.viewBox?.baseVal?.height || 100;

                const aspectRatio = originalWidth / originalHeight;

                let finalWidth = width;
                let finalHeight = height;

                if (width <= height) {
                    finalWidth = width;
                    finalHeight = Math.round(width / aspectRatio);
                } else {
                    finalHeight = height;
                    finalWidth = Math.round(height * aspectRatio);
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

/**
 * Convert SVG to raster format
 * @param {File} svgFile - SVG file
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {string} format - Output format ('webp', 'jpg', 'png')
 * @returns {Promise<File>} - Rasterized image file
 */
export const convertSVGToRaster = async (svgFile, width, height, format = 'png') => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                if (format === 'jpg' || format === 'jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                const imgAspectRatio = img.width / img.height;
                const targetAspectRatio = width / height;

                let drawWidth, drawHeight, drawX, drawY;

                if (imgAspectRatio > targetAspectRatio) {
                    drawWidth = width;
                    drawHeight = width / imgAspectRatio;
                    drawX = 0;
                    drawY = (height - drawHeight) / 2;
                } else {
                    drawHeight = height;
                    drawWidth = height * imgAspectRatio;
                    drawX = (width - drawWidth) / 2;
                    drawY = 0;
                }

                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

                let mimeType, extension;
                switch (format) {
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

                        const fileName = svgFile.name.replace(/\.svg$/i, `-${width}x${height}.${extension}`);
                        resolve(new File([blob], fileName, { type: mimeType }));
                    },
                    mimeType,
                    0.9
                );
            };

            img.onerror = reject;
            img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(svgFile);
    });
};

// ============================================
// SECTION 4: HELPER FUNCTIONS (Internal)
// ============================================

/**
 * Resize image for cropping (cover mode)
 * @param {File} imageFile - Input image file
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Promise<Object>} - Resized image data {file, width, height, scale}
 */
const resizeImageForCrop = async (imageFile, targetWidth, targetHeight) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
            const scaledWidth = Math.round(img.width * scale);
            const scaledHeight = Math.round(img.height * scale);

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
 * Load image with proper cleanup
 * @param {File} file - Image file
 * @returns {Promise<Object>} - Image data {element, width, height}
 */
const loadImage = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            resolve({
                element: img,
                width: img.width,
                height: img.height
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

/**
 * Calculate crop offset based on position
 * @param {number} srcWidth - Source width
 * @param {number} srcHeight - Source height
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string} position - Crop position
 * @returns {Object} - Offset coordinates {offsetX, offsetY}
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
 * Crop from resized image with flexible positioning
 * @param {Object} resized - Resized image data {file, width, height, scale}
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string|Object} position - Either position string or AI subject object
 * @param {File} originalFile - Original file for naming
 * @returns {Promise<File>} - Cropped file
 */
const cropFromResized = async (resized, targetWidth, targetHeight, position, originalFile) => {
    const img = await loadImage(resized.file);

    let offsetX, offsetY;

    // Handle different position types
    if (typeof position === 'string') {
        // Standard position string ('center', 'top-left', etc.)
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, position);
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    }
    else if (position && position.bbox) {
        // AI subject object - smart crop centered on subject
        const bbox = position.bbox;
        const [x, y, width, height] = bbox;

        // Calculate center of subject
        const subjectCenterX = x + width / 2;
        const subjectCenterY = y + height / 2;

        // Center crop on subject
        offsetX = subjectCenterX - targetWidth / 2;
        offsetY = subjectCenterY - targetHeight / 2;

        // Ensure subject stays visible with minimum margin
        const margin = Math.min(50, width * 0.1, height * 0.1);

        // Adjust if subject is near edges
        if (x < margin) offsetX = Math.max(0, offsetX - (margin - x));
        if (x + width > resized.width - margin) offsetX = Math.min(offsetX, resized.width - targetWidth);
        if (y < margin) offsetY = Math.max(0, offsetY - (margin - y));
        if (y + height > resized.height - margin) offsetY = Math.min(offsetY, resized.height - targetHeight);
    }
    else if (position && position.x !== undefined && position.y !== undefined) {
        // Focal point object {x, y}
        offsetX = position.x - targetWidth / 2;
        offsetY = position.y - targetHeight / 2;
    }
    else {
        // Default to center
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, 'center');
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    }

    // Clamp to bounds
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

    // Add descriptive suffix based on position type
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
 * Create saliency map using TensorFlow.js for edge detection (GPU accelerated)
 * @param {HTMLImageElement} img - Image element
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Promise<Array<number>>} - Saliency map array
 */
const createSaliencyMapTensorFlow = async (img, width, height) => {
    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);

    // Convert to TensorFlow tensor
    const tensor = tf.browser.fromPixels(canvas);

    // Convert to grayscale
    const gray = tf.mean(tensor, 2).expandDims(2);

    // Apply Sobel edge detection using TensorFlow
    // Create Sobel filters
    const sobelX = tf.tensor2d([
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ], [3, 3], 'float32').expandDims(2).expandDims(3);

    const sobelY = tf.tensor2d([
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ], [3, 3], 'float32').expandDims(2).expandDims(3);

    // Apply convolution
    const gx = tf.conv2d(gray, sobelX, 1, 'same');
    const gy = tf.conv2d(gray, sobelY, 1, 'same');

    // Calculate gradient magnitude
    const gradient = tf.sqrt(tf.add(tf.square(gx), tf.square(gy)));

    // Normalize to 0-255
    const minVal = gradient.min();
    const maxVal = gradient.max();
    const normalized = tf.div(tf.sub(gradient, minVal), tf.sub(maxVal, minVal));
    const scaled = tf.mul(normalized, 255);

    // Get data and convert to array
    const saliencyData = await scaled.data();
    const saliencyMap = Array.from(saliencyData);

    // Clean up tensors to prevent memory leaks
    tf.dispose([tensor, gray, sobelX, sobelY, gx, gy, gradient, minVal, maxVal, normalized, scaled]);

    return saliencyMap;
};

/**
 * Create saliency map using edge detection (CPU fallback)
 * @param {HTMLImageElement} img - Image element
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array<number>} - Saliency map array
 */
const createSaliencyMap = (img, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const saliencyMap = new Array(width * height).fill(0);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            const gx =
                (-1 * getLuminance(data, idx - width * 4 - 4)) +
                (-2 * getLuminance(data, idx - 4)) +
                (-1 * getLuminance(data, idx + width * 4 - 4)) +
                (1 * getLuminance(data, idx - width * 4 + 4)) +
                (2 * getLuminance(data, idx + 4)) +
                (1 * getLuminance(data, idx + width * 4 + 4));

            const gy =
                (-1 * getLuminance(data, idx - width * 4 - 4)) +
                (-2 * getLuminance(data, idx - width * 4)) +
                (-1 * getLuminance(data, idx + width * 4 + 4)) +
                (1 * getLuminance(data, idx + width * 4 - 4)) +
                (2 * getLuminance(data, idx + width * 4)) +
                (1 * getLuminance(data, idx + width * 4 + 4));

            saliencyMap[y * width + x] = Math.sqrt(gx * gx + gy * gy);
        }
    }

    return saliencyMap;
};

/**
 * Calculate focal point from saliency map
 * @param {Array<number>} saliencyMap - Saliency map array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} - Focal point coordinates {x, y}
 */
const calculateFocalPoint = (saliencyMap, width, height) => {
    let totalX = 0, totalY = 0, count = 0;
    const threshold = 50;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const saliency = saliencyMap[y * width + x];
            if (saliency > threshold) {
                totalX += x;
                totalY += y;
                count++;
            }
        }
    }

    return {
        x: count > 0 ? Math.round(totalX / count) : Math.round(width / 2),
        y: count > 0 ? Math.round(totalY / count) : Math.round(height / 2)
    };
};

/**
 * Adjust crop position based on focal point
 * @param {string} position - Original crop position
 * @param {Object} focalPoint - Focal point coordinates {x, y}
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} - Adjusted crop position
 */
const adjustCropPositionForFocalPoint = (position, focalPoint, width, height) => {
    // For simple smart crop, we adjust the position based on focal point
    // If focal point is significantly off-center, adjust the crop

    const THRESHOLD = 0.3; // 30% from center

    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate normalized distance from center (0-1)
    const dx = Math.abs(focalPoint.x - centerX) / centerX;
    const dy = Math.abs(focalPoint.y - centerY) / centerY;

    // Only adjust if focal point is significantly off-center
    if (dx > THRESHOLD || dy > THRESHOLD) {
        // Determine which quadrant the focal point is in
        const isLeft = focalPoint.x < centerX;
        const isRight = focalPoint.x > centerX;
        const isTop = focalPoint.y < centerY;
        const isBottom = focalPoint.y > centerY;

        // Map to position
        if (isLeft && isTop) return 'top-left';
        if (isRight && isTop) return 'top-right';
        if (isLeft && isBottom) return 'bottom-left';
        if (isRight && isBottom) return 'bottom-right';
        if (isTop) return 'top';
        if (isBottom) return 'bottom';
        if (isLeft) return 'left';
        if (isRight) return 'right';
    }

    return position; // Keep original position if focal point is near center
};

/**
 * Calculate luminance from RGB
 * @param {Uint8ClampedArray} data - Image data array
 * @param {number} idx - Index in data array
 * @returns {number} - Luminance value
 */
const getLuminance = (data, idx) => {
    if (idx < 0 || idx >= data.length) return 0;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
};

// ============================================
// SECTION 5: UTILITY FUNCTIONS (Exported)
// ============================================

/**
 * Convert image to data URL
 * @param {File} file - Image file
 * @returns {Promise<string>} - Data URL string
 */
export const imageToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Get image dimensions
 * @param {File} file - Image file
 * @returns {Promise<Object>} - Image dimensions {width, height, orientation}
 */
export const getImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                width: img.width,
                height: img.height,
                orientation: img.width >= img.height ? 'landscape' : 'portrait'
            });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);

        setTimeout(() => URL.revokeObjectURL(img.src), 1000);
    });
};

/**
 * Convert Image element to Blob
 * @param {HTMLImageElement} img - Image element
 * @param {string} format - Output format ('webp', 'jpg', 'png')
 * @param {number} quality - Quality level (0.1 to 1.0)
 * @returns {Promise<Blob>} - Image blob
 */
export const imageToBlob = (img, format = 'webp', quality = 0.85) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let mimeType;
        switch (format.toLowerCase()) {
            case 'jpg':
            case 'jpeg':
                mimeType = 'image/jpeg';
                break;
            case 'png':
                mimeType = 'image/png';
                break;
            case 'webp':
            default:
                mimeType = 'image/webp';
        }

        canvas.toBlob(resolve, mimeType, quality);
    });
};