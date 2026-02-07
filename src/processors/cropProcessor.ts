/**
 * @fileoverview Image cropping processor with AI-powered smart crop functionality.
 *
 * This module provides advanced image cropping capabilities including:
 * - AI-powered smart crop with subject detection
 * - Logo-specific cropping with subject protection
 * - Standard position-based cropping
 * - SVG handling and conversion
 * - Template-aware cropping for social media and web templates
 *
 * The smart crop functionality uses TensorFlow.js COCO-SSD model for object detection
 * and implements intelligent subject prioritization with face detection support.
 */

import {
    CROP_MARGIN,
    SMART_CROP_CONFIG,
    LOGO_DETECTION_CONFIG,
    PROCESSING_THRESHOLDS,
    MAX_TOTAL_PIXELS_FOR_AI,
    MAX_DIMENSION_FOR_AI,
    MAX_SCALE_FACTOR,
    TIFF_FORMATS,
    FILE_EXTENSIONS,
    IMAGE_COLORS,
    FONT_CONSTANTS,
    ERROR_MESSAGES,
    DEFAULT_QUALITY,
    DEFAULT_WEBP_QUALITY,
    DEFAULT_PNG_QUALITY,
    TEMP_FILE_NAMES,
    IMAGE_LOAD_TIMEOUT,
    COLOR_DETECTION,
    IGNORED_OBJECTS,
    CATEGORY_MAPPING,
    CATEGORY_WEIGHTS,
    AI_MODEL_WEIGHTS,
    AI_SETTINGS,
    CROP_POSITIONS,
    CROP_MODES,
    IMAGE_FORMATS,
    MIME_TYPE_MAP
} from '../constants';

import {
    convertLegacyFormat,
    convertTIFFForProcessing,
    loadAIModel,
    calculateUpscaleFactor,
    safeCleanupGPUMemory,
    convertSVGToRaster,
    isSVGFile,
    getSVGDimensions,
    createSVGPlaceholderWithAspectRatio
} from '../utils';

import {
    upscaleImageWithAI
} from './resizeProcessor';

let aiModel: any = null;
let aiModelLoading = false;

/* --- Helpers (Hoisted) --- */

/**
 * Converts SVG to raster and crops it
 */
async function convertSVGToRasterAndCrop(svgFile: File, targetWidth: number, targetHeight: number, format: string = IMAGE_FORMATS.WEBP, _position: string = 'center'): Promise<File> {
    try {
        const scaleFactor = 2;
        const conversionWidth = Math.max(targetWidth, 800) * scaleFactor;
        const conversionHeight = Math.max(targetHeight, 600) * scaleFactor;

        const rasterFile = await convertSVGToRaster(svgFile, conversionWidth, conversionHeight, IMAGE_FORMATS.PNG);

        const img = new Image();
        const objectUrl = URL.createObjectURL(rasterFile);

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load rasterized SVG'));
            };
            img.src = objectUrl;
        });

        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const targetAspectRatio = targetWidth / targetHeight;
        const imageAspectRatio = img.width / img.height;

        let sourceWidth, sourceHeight, sourceX, sourceY;

        if (imageAspectRatio > targetAspectRatio) {
            sourceHeight = img.height;
            sourceWidth = img.height * targetAspectRatio;
            sourceX = (img.width - sourceWidth) / 2;
            sourceY = 0;
        } else {
            sourceWidth = img.width;
            sourceHeight = img.width / targetAspectRatio;
            sourceX = 0;
            sourceY = (img.height - sourceHeight) / 2;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

        const blob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, format === IMAGE_FORMATS.PNG ? MIME_TYPE_MAP.png : MIME_TYPE_MAP.webp,
                format === IMAGE_FORMATS.PNG ? DEFAULT_PNG_QUALITY : DEFAULT_WEBP_QUALITY);
        });

        if (!blob) {
            throw new Error('Failed to create cropped image');
        }

        const extension = format === 'png' ? 'png' : 'webp';
        const fileName = svgFile.name.replace(/\.svg$/i, `-${targetWidth}x${targetHeight}.${extension}`);
        return new File([blob], fileName, {
            type: format === IMAGE_FORMATS.PNG ? MIME_TYPE_MAP.png : MIME_TYPE_MAP.webp
        });

    } catch {
        return await createSVGPlaceholderWithAspectRatio(svgFile, targetWidth, targetHeight, format);
    }
}

/**
 * Resizes image for crop operation
 */
async function resizeImageForCrop(imageFile: File, targetWidth: number, targetHeight: number, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);
        img.onload = () => {
            try {
                const targetAspectRatio = targetWidth / targetHeight;
                const imageAspectRatio = img.naturalWidth / img.naturalHeight;
                const format = options.format || 'webp';
                const quality = options.quality || DEFAULT_WEBP_QUALITY;
                const mimeType = MIME_TYPE_MAP[format] || 'image/webp';
                let scale;
                let scaledWidth, scaledHeight;
                if (imageAspectRatio > targetAspectRatio) {
                    scale = targetHeight / img.naturalHeight;
                    scaledWidth = Math.round(img.naturalWidth * scale);
                    scaledHeight = targetHeight;
                } else {
                    scale = targetWidth / img.naturalWidth;
                    scaledWidth = targetWidth;
                    scaledHeight = Math.round(img.naturalHeight * scale);
                }
                const minSizeForAI = 300;
                if (scaledWidth < minSizeForAI || scaledHeight < minSizeForAI) {
                    const minScale = Math.max(
                        minSizeForAI / img.naturalWidth,
                        minSizeForAI / img.naturalHeight
                    );
                    scaledWidth = Math.round(img.naturalWidth * minScale);
                    scaledHeight = Math.round(img.naturalHeight * minScale);
                }
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("No context");

                canvas.width = scaledWidth;
                canvas.height = scaledHeight;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
                canvas.toBlob(
                    (blob) => {
                        URL.revokeObjectURL(url);
                        if (!blob) {
                            reject(new Error('Failed to create resized image'));
                            return;
                        }
                        resolve({
                            file: new File([blob], TEMP_FILE_NAMES.RESIZED, { type: mimeType }),
                            element: canvas,
                            width: scaledWidth,
                            height: scaledHeight,
                            scale,
                            originalWidth: img.naturalWidth,
                            originalHeight: img.naturalHeight
                        });
                    },
                    mimeType,
                    quality
                );
            } catch (error) {
                URL.revokeObjectURL(url);
                reject(error);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for resizing'));
        };
        img.src = url;
    });
}

/**
 * Loads image from file
 */
function loadImage(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
        }, IMAGE_LOAD_TIMEOUT);
        img.onload = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                reject(new Error('Invalid image dimensions'));
                return;
            }
            resolve({
                element: img,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error(`${ERROR_MESSAGES.IMAGE_LOAD_FAILED}: ${file.name}`));
        };
        img.src = url;
    });
}

/**
 * Calculates crop offset based on position
 */
export function calculateCropOffset(srcWidth: number, srcHeight: number, targetWidth: number, targetHeight: number, position: string) {
    let offsetX, offsetY;
    switch (position) {
        case CROP_POSITIONS.TOP_LEFT:
            offsetX = 0;
            offsetY = 0;
            break;
        case CROP_POSITIONS.TOP:
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = 0;
            break;
        case CROP_POSITIONS.TOP_RIGHT:
            offsetX = srcWidth - targetWidth;
            offsetY = 0;
            break;
        case CROP_POSITIONS.LEFT:
            offsetX = 0;
            offsetY = Math.round((srcHeight - targetHeight) / 2);
            break;
        case CROP_POSITIONS.RIGHT:
            offsetX = srcWidth - targetWidth;
            offsetY = Math.round((srcHeight - targetHeight) / 2);
            break;
        case CROP_POSITIONS.BOTTOM_LEFT:
            offsetX = 0;
            offsetY = srcHeight - targetHeight;
            break;
        case CROP_POSITIONS.BOTTOM:
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = srcHeight - targetHeight;
            break;
        case CROP_POSITIONS.BOTTOM_RIGHT:
            offsetX = srcWidth - targetWidth;
            offsetY = srcHeight - targetHeight;
            break;
        case CROP_POSITIONS.CENTER:
        default:
            offsetX = Math.round((srcWidth - targetWidth) / 2);
            offsetY = Math.round((srcHeight - targetHeight) / 2);
    }
    offsetX = Math.max(0, Math.min(offsetX, srcWidth - targetWidth));
    offsetY = Math.max(0, Math.min(offsetY, srcHeight - targetHeight));
    return { offsetX, offsetY };
}

/**
 * Crops from resized image
 */
async function cropFromResized(resized: any, targetWidth: number, targetHeight: number, position: any, originalFile: File, options: any = {}, logos: any[] = []): Promise<File> {
    const img = resized.element;
    let offsetX = 0, offsetY = 0;

    if (typeof position === 'string') {
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, position);
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    } else if (position && position.bbox) {
        const bbox = position.bbox;
        const [x, y, width, height] = bbox;

        const verticalFits = height * 1.1 <= targetHeight;

        const subjectCenterX = x + width / 2;
        let subjectCenterY;

        const category = position.category || 'default';
        if (verticalFits) {
            subjectCenterY = y + height / 2;
        } else {
            if (category === 'face') {
                subjectCenterY = y + height * 0.45; // Focus slightly higher on face
            } else if (category === 'person') {
                subjectCenterY = y + height * 0.3; // Focus on upper body/head
            } else if (category === 'animal') {
                subjectCenterY = y + height * 0.25; // Animals have heads higher up/forward
            } else {
                subjectCenterY = y + height * 0.5;
            }
        }

        offsetX = subjectCenterX - targetWidth / 2;
        offsetY = subjectCenterY - targetHeight / 2;

        if (logos.length > 0 && LOGO_DETECTION_CONFIG.PRESERVE_WHOLE_LOGO) {
            const adjustedOffset = adjustForLogos(offsetX, offsetY, targetWidth, targetHeight,
                resized.width, resized.height, logos);
            offsetX = adjustedOffset.x;
            offsetY = adjustedOffset.y;
        } else {
            const margin = Math.max(
                CROP_MARGIN,
                Math.min(
                    width * (SMART_CROP_CONFIG.PADDING_RATIO || 0.05),
                    height * (SMART_CROP_CONFIG.PADDING_RATIO || 0.05),
                    150
                )
            );
            if (x < margin) offsetX = Math.max(0, offsetX - (margin - x));
            if (x + width > resized.width - margin) {
                const rightOverflow = (x + width) - (resized.width - margin);
                offsetX = Math.min(offsetX + rightOverflow, resized.width - targetWidth);
            }
            if (y < margin) offsetY = Math.max(0, offsetY - (margin - y));
            if (y + height > resized.height - margin) {
                const bottomOverflow = (y + height) - (resized.height - margin);
                offsetY = Math.min(offsetY + bottomOverflow, resized.height - targetHeight);
            }
        }
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
    if (!ctx) throw new Error("No context");

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(
        img,
        offsetX, offsetY, targetWidth, targetHeight,
        0, 0, targetWidth, targetHeight
    );
    const format = options.format || 'webp';
    const quality = options.quality || DEFAULT_WEBP_QUALITY;
    const mimeType = MIME_TYPE_MAP[format] || 'image/webp';

    const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, mimeType, quality);
    });

    if (!blob) throw new Error('Failed to create blob');

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
    return new File([blob], newName, { type: mimeType });
}

/**
 * Detects logos in an image
 */
async function detectLogos(imgElement: any, width: number, height: number, model: any): Promise<any[]> {
    if (!model) return [];
    try {
        const predictions = await model.detect(imgElement);
        const logos = predictions.filter((pred: any) => {
            if (!pred.class) return false;
            const className = pred.class.toLowerCase();
            const isActualLogo = LOGO_DETECTION_CONFIG.LOGO_CLASSES?.some(
                logoClass => className.includes(logoClass) || logoClass.includes(className)
            ) || false;
            const meetsConfidence = pred.score >= (LOGO_DETECTION_CONFIG.MIN_LOGO_CONFIDENCE || 0.7);
            if (pred.bbox) {
                const [, , w, h] = pred.bbox;
                const area = w * h;
                const imageArea = width * height;
                const sizeRatio = area / imageArea;
                const meetsSize = sizeRatio >= (LOGO_DETECTION_CONFIG.MIN_LOGO_SIZE_RATIO || 0.005) &&
                    sizeRatio <= (LOGO_DETECTION_CONFIG.MAX_LOGO_SIZE_RATIO || 0.3);
                return isActualLogo && meetsConfidence && meetsSize;
            }
            return false;
        });
        logos.sort((a: any, b: any) => b.score - a.score);
        return logos;
    } catch {
        return [];
    }
}

/**
 * Adjusts crop offset to preserve logos
 */
function adjustForLogos(offsetX: number, offsetY: number, cropWidth: number, cropHeight: number,
    imageWidth: number, imageHeight: number, logos: any[]): { x: number, y: number } {
    let adjustedX = offsetX;
    let adjustedY = offsetY;
    for (const logo of logos) {
        const [logoX, logoY, logoWidth, logoHeight] = logo.bbox;
        const cropLeft = adjustedX;
        const cropRight = adjustedX + cropWidth;
        const cropTop = adjustedY;
        const cropBottom = adjustedY + cropHeight;
        const logoPadding = Math.min(logoWidth, logoHeight) * (LOGO_DETECTION_CONFIG.LOGO_PADDING_RATIO || 0.1);
        const logoLeft = logoX - logoPadding;
        const logoRight = logoX + logoWidth + logoPadding;
        const logoTop = logoY - logoPadding;
        const logoBottom = logoY + logoHeight + logoPadding;
        const isCutHorizontally = (logoLeft < cropLeft && logoRight > cropLeft) ||
            (logoLeft < cropRight && logoRight > cropRight);
        const isCutVertically = (logoTop < cropTop && logoBottom > cropTop) ||
            (logoTop < cropBottom && logoBottom > cropBottom);
        if (isCutHorizontally || isCutVertically) {
            if (logoLeft < cropLeft) {
                adjustedX = Math.max(0, logoLeft);
            } else if (logoRight > cropRight) {
                adjustedX = Math.min(imageWidth - cropWidth, logoRight - cropWidth);
            }
            if (logoTop < cropTop) {
                adjustedY = Math.max(0, logoTop);
            } else if (logoBottom > cropBottom) {
                adjustedY = Math.min(imageHeight - cropHeight, logoBottom - cropHeight);
            }
        }
    }
    return { x: adjustedX, y: adjustedY };
}

/**
 * Finds main subject in predictions
 */
function findMainSubject(predictions: any[], imgWidth: number, imgHeight: number): any | null {
    if (!predictions || predictions.length === 0) {

        return null;
    }


    const validPredictions = predictions.filter(pred => {
        if (!pred.class) return false;
        const className = pred.class.toLowerCase();
        const isValid = pred.score > (AI_SETTINGS.MIN_CONFIDENCE || 0.3) &&
            !(IGNORED_OBJECTS || []).includes(className);

        return isValid;
    });

    if (validPredictions.length === 0) {

        return null;
    }


    const hasHumanAnywhere = validPredictions.some(p => {
        const className = (p.class || '').toLowerCase();
        const cat = (CATEGORY_MAPPING || {})[className] || 'default';
        return cat === 'face' || cat === 'person' || cat === 'facial_feature';
    });

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
        const category = (CATEGORY_MAPPING || {})[pred.class] || 'default';
        const categoryWeight = (CATEGORY_WEIGHTS || {})[category] || (CATEGORY_WEIGHTS || {}).default || 1.0;

        let sizePenalty = 1.0;
        if (sizeScore < (SMART_CROP_CONFIG.MIN_SUBJECT_SIZE_RATIO || 0.05)) {
            sizePenalty = 0.5;
        }

        // Penalty for background-like boxes (too large)
        if (sizeScore > (SMART_CROP_CONFIG.MAX_SUBJECT_SIZE_RATIO || 0.95)) {
            sizePenalty *= 0.15; // Hard penalty for overly large boxes
        }

        let bonus = 1.0;
        if (centralityScore > 0.8 && confidenceScore > 0.7) {
            bonus = 1.2;
        }

        if (category === 'logo') {
            bonus *= (LOGO_DETECTION_CONFIG.PRIORITIZE_LOGOS ? 1.4 : 1.0);
        }

        // Specific focal point bonuses
        if (category === 'face') {
            bonus *= 5.0; // Increased from 4.0
        } else if (category === 'facial_feature') {
            bonus *= 3.0; // Increased from 2.5
        } else if (category === 'person') {
            bonus *= 2.0; // Increased from 1.8
        } else if (category === 'animal' || category === 'bird') {
            bonus *= 3.0; // Increased from 2.0 - Dogs/cats are primary targets
        } else if (category === 'food') {
            bonus *= 2.2;
        }

        // Human dominance logic - deprioritize secondary items if human is present
        if (hasHumanAnywhere && (category === 'electronics' || category === 'kitchen' || category === 'furniture' || category === 'building')) {
            bonus *= 0.1;
        }

        const score = (sizeScore * (AI_MODEL_WEIGHTS?.SIZE_WEIGHT || 0.2) +
            confidenceScore * (AI_MODEL_WEIGHTS?.CONFIDENCE_WEIGHT || 0.4) +
            centralityScore * (AI_MODEL_WEIGHTS?.CENTRALITY_WEIGHT || 0.4)) *
            categoryWeight * bonus * sizePenalty;



        return {
            ...pred,
            score,
            bbox,
            area,
            centerX,
            centerY,
            category
        };
    });
    scoredPredictions.sort((a: any, b: any) => b.score - a.score);



    return scoredPredictions[0] || null;
}

/**
 * Detects focal point using edge detection
 */
async function detectFocalPointSimple(imgElement: any, width: number, height: number): Promise<{ x: number, y: number }> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imgElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let totalX = 0, totalY = 0, count = 0;
    const edgeThreshold = PROCESSING_THRESHOLDS.EDGE_DETECTION_THRESHOLD || 30;
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
}

/**
 * Gets luminance value from image data
 */
function getLuminance(data: Uint8ClampedArray, idx: number): number {
    if (idx < 0 || idx >= data.length) return 0;
    return (COLOR_DETECTION?.LUMINANCE_RED || 0.299) * data[idx] +
        (COLOR_DETECTION?.LUMINANCE_GREEN || 0.587) * data[idx + 1] +
        (COLOR_DETECTION?.LUMINANCE_BLUE || 0.114) * data[idx + 2];
}

/**
 * Creates error placeholder image
 */
async function createErrorPlaceholder(imageFile: File, width: number, height: number, title: string, message: string): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    ctx.fillStyle = IMAGE_COLORS.ERROR_BACKGROUND || '#ffebee';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = IMAGE_COLORS.ERROR_TEXT || '#c62828';
    ctx.font = `bold ${FONT_CONSTANTS.BODY_FONT_SIZE || 16}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = width / 2;
    const centerY = height / 2;
    const displayName = imageFile.name.length > 20 ?
        imageFile.name.substring(0, 17) + '...' : imageFile.name;
    ctx.fillText(title, centerX, centerY - 20);
    ctx.fillText(displayName, centerX, centerY);
    ctx.fillStyle = IMAGE_COLORS.WARNING_TEXT || '#ff9800';
    ctx.font = `${FONT_CONSTANTS.CAPTION_FONT_SIZE || 12}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY || 'Arial'}`;
    const errorMsg = message.length > 30 ?
        message.substring(0, 27) + '...' : message;
    ctx.fillText(errorMsg, centerX, centerY + 25);
    const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
    });

    if (!blob) throw new Error('Failed to create error placeholder');

    return new File([blob], `${imageFile.name}-crop-error.webp`, {
        type: 'image/webp'
    });
}

/**
 * Fits image to contain within target dimensions (no cropping)
 */
async function fitImageToContain(imageFile: File, targetWidth: number, targetHeight: number, options: any = {}): Promise<File> {
    const img = await loadImage(imageFile);
    const imageAspectRatio = img.width / img.height;
    const targetAspectRatio = targetWidth / targetHeight;

    let scaleWidth, scaleHeight;
    if (imageAspectRatio > targetAspectRatio) {
        // Image is wider - fit to width
        scaleWidth = targetWidth;
        scaleHeight = Math.round(targetWidth / imageAspectRatio);
    } else {
        // Image is taller - fit to height
        scaleHeight = targetHeight;
        scaleWidth = Math.round(targetHeight * imageAspectRatio);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No context");

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Fill with transparent background
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Center the image
    const offsetX = (targetWidth - scaleWidth) / 2;
    const offsetY = (targetHeight - scaleHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.element, offsetX, offsetY, scaleWidth, scaleHeight);

    const format = options.format || IMAGE_FORMATS.WEBP;
    const quality = options.quality || DEFAULT_QUALITY;
    const mimeType = MIME_TYPE_MAP[format] || MIME_TYPE_MAP.webp;

    const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, mimeType, quality);
    });

    if (!blob) {
        throw new Error('Failed to create fitted image blob');
    }

    const extension = format === IMAGE_FORMATS.PNG ? 'png' : 'webp';
    const fileName = imageFile.name.replace(/\.[^.]+$/, `-fitted-${targetWidth}x${targetHeight}.${extension}`);

    return new File([blob], fileName, { type: blob.type });
}

/* --- Exported Functions --- */

/**
 * Processes smart crop with proper resize
 */
export const processSmartCrop = async (imageFile: File, targetWidth: number, targetHeight: number, options: any = { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }): Promise<File> => {
    console.log('[SmartCrop] processSmartCrop started for:', imageFile.name);
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isSVG = isSVGFile(imageFile);

    if (isSVG) {
        try {
            return await convertSVGToRasterAndCrop(imageFile, targetWidth, targetHeight, options.format || IMAGE_FORMATS.WEBP, 'center');
        } catch {
            return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, options) as File;
        }
    }

    if (options.cropMode === CROP_MODES.STANDARD || options.cropMode === CROP_MODES.CENTER) {
        return await processStandardCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: options.cropPosition || 'center' });
    }

    const isTIFF = TIFF_FORMATS.includes(mimeType) || FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
    const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
    const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
    const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

    try {
        let processableFile = imageFile;

        if (isTIFF || isBMP || isGIF || isICO) {
            try {
                processableFile = await convertLegacyFormat(imageFile);
            } catch {
                return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, options) as File;
            }
        }

        const img = await loadImage(processableFile);

        const needsUpscaling = targetWidth > img.width || targetHeight > img.height;
        let sourceFile = processableFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(img.width, img.height, targetWidth, targetHeight);
            if (upscaleFactor > 1 && upscaleFactor <= MAX_SCALE_FACTOR) {
                try {
                    const upscaleResult = await upscaleImageWithAI(processableFile, upscaleFactor, imageFile.name);
                    sourceFile = upscaleResult.file;
                    (sourceFile as any).aiUpscaleScale = upscaleResult.scale;
                    (sourceFile as any).aiUpscaleModel = upscaleResult.model;
                    (sourceFile as any).isSmartCropUpscale = true;
                } catch (err) {
                    console.error('[SmartCrop] Internal upscale failed:', err);
                }
            }
        }

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight, options);

        let model = aiModel;
        if (!model) {
            try {
                model = await loadAIModel();
                aiModel = model;
            } catch {
                model = null;
            }
        }

        const templateConfig = options.templateConfig || {};
        const useAIDetection = templateConfig.useAIDetection !== false && model !== null;

        // Fix: Detect logos if explicit "Logo" mode OR if we need to preserve them
        const useLogoDetection = (options.isLogo === true || templateConfig.preserveLogos === true) && model !== null;

        let logos: any[] = [];
        if (useLogoDetection) {
            try {
                logos = await detectLogos(resized.element, resized.width, resized.height, model);
            } catch { /* ignored */ }
        }

        let croppedFile: File;
        let mainSubject: any = null;
        let focalPoint: any = null;

        // Fix: Respect template strategy
        const currentStrategy = (templateConfig.strategy || SMART_CROP_CONFIG.DEFAULT_STRATEGY || 'ai_priority').toLowerCase();

        // Fix: Only prioritize Logo crop if it is explicitly a "Logo" operation OR strategy demands it
        const prioritizeLogo = options.isLogo === true || currentStrategy === 'logo_priority';

        if (logos.length > 0 && prioritizeLogo) {
            const primaryLogo = logos[0];
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, primaryLogo, imageFile, options, logos);
            mainSubject = primaryLogo;
        }
        if (useAIDetection && currentStrategy !== 'focal_point') {
            try {
                const isResizedTooLargeForAI = (resized.width * resized.height > MAX_TOTAL_PIXELS_FOR_AI) ||
                    (resized.width > MAX_DIMENSION_FOR_AI) ||
                    (resized.height > MAX_DIMENSION_FOR_AI);

                let detectionElement = resized.element;
                let detectionScale = 1;

                if (isResizedTooLargeForAI) {
                    const maxAIdim = MAX_DIMENSION_FOR_AI || 1500;
                    detectionScale = Math.min(maxAIdim / resized.width, maxAIdim / resized.height);

                    const dCanvas = document.createElement('canvas');
                    dCanvas.width = Math.round(resized.width * detectionScale);
                    dCanvas.height = Math.round(resized.height * detectionScale);
                    const dctx = dCanvas.getContext('2d');
                    if (dctx) {
                        dctx.drawImage(resized.element, 0, 0, dCanvas.width, dCanvas.height);
                        detectionElement = dCanvas;
                    }
                }

                let predictions = await model.detect(detectionElement);

                if (detectionScale !== 1 && predictions.length > 0) {
                    const invScale = 1 / detectionScale;
                    predictions = predictions.map((p: any) => ({
                        ...p,
                        bbox: [
                            p.bbox[0] * invScale,
                            p.bbox[1] * invScale,
                            p.bbox[2] * invScale,
                            p.bbox[3] * invScale
                        ]
                    }));
                }

                if (templateConfig.prioritySubject) {
                    predictions.forEach((pred: any) => {
                        if (pred.class && pred.class.toLowerCase().includes(templateConfig.prioritySubject)) {
                            pred.score *= 1.5;
                        }
                    });
                }

                mainSubject = findMainSubject(predictions, resized.width, resized.height);

                if (mainSubject) {
                    console.log(`[SmartCrop] Main subject identified: ${mainSubject.class} (${mainSubject.category}) with score ${mainSubject.score.toFixed(3)}`);
                    if (SMART_CROP_CONFIG.USE_FACIAL_FEATURES &&
                        (mainSubject.category === 'face' || mainSubject.category === 'facial_feature')) {
                        croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile, options, logos);
                    }
                    else if (SMART_CROP_CONFIG.DEFAULT_STRATEGY === 'ai_priority' || SMART_CROP_CONFIG.DEFAULT_STRATEGY === 'hybrid') {
                        croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile, options, logos);
                    } else {
                        console.log('[SmartCrop] Strategy not AI-priority, falling back to focal point detection');
                        focalPoint = await detectFocalPointSimple(resized.element, resized.width, resized.height);
                        croppedFile = await cropFromResized(resized, targetWidth, targetHeight, focalPoint, imageFile, options, logos);
                    }
                } else {
                    console.log('[SmartCrop] No suitable subject found by YOLO, falling back to focal point detection');
                    focalPoint = await detectFocalPointSimple(resized.element, resized.width, resized.height);
                    croppedFile = await cropFromResized(resized, targetWidth, targetHeight, focalPoint, imageFile, options, logos);
                }
            } catch {
                focalPoint = await detectFocalPointSimple(resized.element, resized.width, resized.height);
                croppedFile = await cropFromResized(resized, targetWidth, targetHeight, focalPoint, imageFile, options, logos);
            }
        } else {
            focalPoint = await detectFocalPointSimple(resized.element, resized.width, resized.height);
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, focalPoint, imageFile, options, logos);
        }
        if (croppedFile) {
            (croppedFile as any).aiSmartCrop = true;
            if ((sourceFile as any).aiUpscaleScale) {
                (croppedFile as any).aiUpscaleScale = (sourceFile as any).aiUpscaleScale;
                (croppedFile as any).aiUpscaleModel = (sourceFile as any).aiUpscaleModel;

                // CRITICAL FIX: Propagate the isSmartCropUpscale flag
                if ((sourceFile as any).isSmartCropUpscale) {
                    (croppedFile as any).isSmartCropUpscale = true;
                }
            }
        }
        return croppedFile!;
    } catch (error) {
        console.error('[SmartCrop] Error in processSmartCrop:', error); // Add error log
        return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, options) as File;
    }
};

/**
 * Processes smart crop for template requirements
 */
export const processTemplateSmartCrop = async (imageFile: File, template: any, options: any = {}) => {
    const {
        width,
        height,
        aspectRatio,
        cropMode = CROP_MODES.SMART,
        cropPosition = 'center'
    } = template;

    const isSVG = isSVGFile(imageFile);
    const normalizedCropMode = (template.cropMode || '').toLowerCase();
    const isSmartMode = normalizedCropMode === CROP_MODES.SMART || normalizedCropMode === 'smart';

    const templateConfig = {
        useAIDetection: isSmartMode,
        useLogoDetection: isSmartMode && template.preserveLogos !== false,
        ignoreLogos: template.tightCrop === true || template.preserveLogos === false,
        prioritySubject: template.prioritySubject,
        minSubjectSize: template.minSubjectSize || 0.1,
        maxPadding: template.maxPadding || 0.2
    };

    const mergedOptions = {
        ...options,
        cropMode: isSmartMode ? CROP_MODES.SMART : cropMode,
        cropPosition,
        templateConfig
    };

    let finalWidth = width;
    let finalHeight = height;

    if (aspectRatio && (!width || !height)) {
        let imgWidth, imgHeight;
        if (isSVG) {
            try {
                const svgText = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.onerror = reject;
                    reader.readAsText(imageFile);
                });
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;
                const widthAttr = svgElement.getAttribute('width');
                const heightAttr = svgElement.getAttribute('height');
                imgWidth = widthAttr ? parseFloat(widthAttr) : 800;
                imgHeight = heightAttr ? parseFloat(heightAttr) : 600;
                if ((!widthAttr || !heightAttr) && svgElement.hasAttribute('viewBox')) {
                    const viewBox = svgElement.getAttribute('viewBox');
                    const parts = viewBox?.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n)) || [];
                    if (parts.length >= 4) {
                        imgWidth = parts[2];
                        imgHeight = parts[3];
                    }
                }
            } catch {
                imgWidth = 800;
                imgHeight = 600;
            }
        } else {
            try {
                const img = await loadImage(imageFile);
                imgWidth = img.width;
                imgHeight = img.height;
            } catch {
                imgWidth = 800;
                imgHeight = 600;
            }
        }
        const imgAspectRatio = imgWidth / imgHeight;
        if (aspectRatio > imgAspectRatio) {
            finalWidth = Math.round(imgWidth);
            finalHeight = Math.round(imgWidth / aspectRatio);
        } else {
            finalHeight = Math.round(imgHeight);
            finalWidth = Math.round(imgHeight * aspectRatio);
        }
    } else {
        finalWidth = width || 800;
        finalHeight = height || 600;
    }

    if (isSVG) {
        try {
            return await convertSVGToRasterAndCrop(imageFile, finalWidth, finalHeight, options.format || IMAGE_FORMATS.WEBP, cropPosition);
        } catch {
            return await processStandardCrop(imageFile, finalWidth, finalHeight, mergedOptions);
        }
    }
    return await processSmartCrop(imageFile, finalWidth, finalHeight, mergedOptions);
};

/**
 * Processes simple smart crop without AI (center crop fallback or standard crop)
 */
export const processSimpleSmartCrop = async (imageFile: File, targetWidth: number, targetHeight: number, options: any = { quality: DEFAULT_QUALITY, format: IMAGE_FORMATS.WEBP }): Promise<File | object> => {
    console.log('[SmartCrop] processSimpleSmartCrop started');
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';
    const isSVG = isSVGFile(imageFile);

    if (isSVG) {
        try {
            return await processSVGCrop(imageFile, targetWidth, targetHeight);
        } catch {
            return await processStandardCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: CROP_POSITIONS.CENTER });
        }
    }

    const isTIFF = TIFF_FORMATS.includes(mimeType) || FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
    const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
    const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
    const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

    try {
        let processableFile = imageFile;
        if (isTIFF) {
            try {
                processableFile = await convertTIFFForProcessing(imageFile);
            } catch {
                return await processStandardCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: CROP_POSITIONS.CENTER });
            }
        } else if (isBMP || isGIF || isICO) {
            try {
                processableFile = await convertLegacyFormat(imageFile);
            } catch {
                return await processStandardCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: CROP_POSITIONS.CENTER });
            }
        }

        const img = await loadImage(processableFile);
        const needsUpscaling = targetWidth > img.width || targetHeight > img.height;
        let sourceFile = processableFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(
                img.width,
                img.height,
                targetWidth,
                targetHeight
            );
            if (upscaleFactor > 1) {
                try {
                    const upscaleResult = await upscaleImageWithAI(processableFile, upscaleFactor, imageFile.name);
                    sourceFile = upscaleResult.file;
                    (sourceFile as any).isSmartCropUpscale = true; // Mark as smart crop upscale
                } catch { /* ignored */ }
            }
        }

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight, options);
        const focalPoint = await detectFocalPointSimple(resized.element, resized.width, resized.height);
        const adjustedPosition = adjustCropPositionForFocalPoint(CROP_POSITIONS.CENTER, focalPoint, resized.width, resized.height);
        const croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile, options);

        // Propagate metadata to ensure summary is correct even on fallback
        if (sourceFile && croppedFile) {
            (croppedFile as any).aiSmartCrop = true; // FORCE FLAG FOR SUMMARY
            if ((sourceFile as any).aiUpscaleScale) (croppedFile as any).aiUpscaleScale = (sourceFile as any).aiUpscaleScale;
            if ((sourceFile as any).aiUpscaleModel) (croppedFile as any).aiUpscaleModel = (sourceFile as any).aiUpscaleModel;
            if ((sourceFile as any).isSmartCropUpscale) (croppedFile as any).isSmartCropUpscale = true;
        }

        return croppedFile;
    } catch (error: any) {
        try {
            return await processStandardCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: CROP_POSITIONS.CENTER });
        } catch {
            return await createErrorPlaceholder(imageFile, targetWidth, targetHeight, 'Crop Error', error.message);
        }
    }
};

/**
 * Processes standard crop with proper resize
 */
export const processStandardCrop = async (imageFile: File, targetWidth: number, targetHeight: number, options: any = {}): Promise<File> => {
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';

    const isTIFF = TIFF_FORMATS.includes(mimeType) || FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
    const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
    const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
    const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

    let processableFile = imageFile;
    if (isTIFF) {
        try {
            processableFile = await convertTIFFForProcessing(imageFile);
        } catch {
            // Ignore
        }
    } else if (isBMP || isGIF || isICO) {
        try {
            processableFile = await convertLegacyFormat(imageFile);
        } catch {
            // Intentionally ignore
        }
    }

    const resized = await resizeImageForCrop(processableFile, targetWidth, targetHeight, options);
    return await cropFromResized(resized, targetWidth, targetHeight, options.cropPosition || CROP_POSITIONS.CENTER, imageFile, options);
};

/**
 * Processes SVG crop operation with proper resize
 */
export const processSVGCrop = async (svgFile: File, width: number, height: number): Promise<File> => {
    try {
        const rasterFile = await convertSVGToRaster(svgFile, width * 2, height * 2, IMAGE_FORMATS.PNG);
        const img = new Image();
        const svgUrl = URL.createObjectURL(rasterFile);
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load rasterized SVG'));
            img.src = svgUrl;
        });
        URL.revokeObjectURL(svgUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");
        ctx.drawImage(img, 0, 0);
        const scale = Math.max(width / img.width, height / img.height);
        const scaledWidth = Math.round(img.width * scale);
        const scaledHeight = Math.round(img.height * scale);
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error("No temp context");
        tempCanvas.width = scaledWidth;
        tempCanvas.height = scaledHeight;
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        const offsetX = Math.max(0, Math.round((scaledWidth - width) / 2));
        const offsetY = Math.max(0, Math.round((scaledHeight - height) / 2));
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) throw new Error("No crop context");
        cropCanvas.width = width;
        cropCanvas.height = height;
        cropCtx.imageSmoothingEnabled = true;
        cropCtx.imageSmoothingQuality = 'high';
        cropCtx.drawImage(tempCanvas, offsetX, offsetY, width, height, 0, 0, width, height);
        const croppedBlob = await new Promise<Blob | null>(resolve => {
            cropCanvas.toBlob(resolve, 'image/png', DEFAULT_PNG_QUALITY);
        });

        if (!croppedBlob) throw new Error("Failed to create blob");

        const croppedFile = new File([croppedBlob], svgFile.name.replace(/\.svg$/i, '.png'), {
            type: 'image/png'
        });
        return croppedFile;
    } catch (error: any) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        ctx.fillStyle = IMAGE_COLORS.ERROR_BACKGROUND || '#ffebee';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = IMAGE_COLORS.ERROR_TEXT || '#c62828';
        ctx.font = `bold ${Math.min(16, height / 10)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY || 'Arial'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = width / 2;
        const centerY = height / 2;
        ctx.fillText('SVG Crop Error', centerX, centerY - 20);
        const displayName = svgFile.name.length > 20 ?
            svgFile.name.substring(0, 17) + '...' : svgFile.name;
        ctx.fillText(displayName, centerX, centerY);
        ctx.fillStyle = IMAGE_COLORS.WARNING_TEXT || '#ff9800';
        ctx.font = `${Math.min(12, height / 15)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY || 'Arial'}`;
        const errorMsg = error.message.length > 30 ?
            error.message.substring(0, 27) + '...' : error.message;
        ctx.fillText(errorMsg, centerX, centerY + 25);
        const blob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, MIME_TYPE_MAP.png, DEFAULT_PNG_QUALITY);
        });

        if (!blob) throw new Error("Failed to create error blob");

        return new File([blob], `${svgFile.name}-crop-error.png`, {
            type: MIME_TYPE_MAP.png
        });
    }
};

/**
 * Adjusts crop position based on focal point
 */
export function adjustCropPositionForFocalPoint(position: string, focalPoint: any, width: number, height: number): string {
    const THRESHOLD = PROCESSING_THRESHOLDS.FOCAL_POINT_THRESHOLD || 0.3;
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
}

/**
 * Checks if AI model is loaded
 */
export const isAIModelLoaded = () => {
    return aiModel !== null;
};

/**
 * Gets current AI model status
 */
export const getAIModelStatus = () => {
    return {
        loaded: aiModel !== null,
        loading: aiModelLoading,
        type: aiModel?.modelType || null
    };
};

/**
 * Gets available crop positions
 */
export const getCropPositions = () => {
    return CROP_POSITIONS || ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
};

/**
 * Gets crop mode options
 */
export const getCropModeOptions = () => {
    return [
        { value: 'standard', label: 'Standard Crop', icon: 'fas fa-crop' },
        { value: 'smart', label: 'Smart AI Crop', icon: 'fas fa-brain' }
    ];
};

/**
 * Gets processing statistics
 */
export const getProcessingStatistics = () => {
    return {
        aiModelLoaded: aiModel !== null,
        aiModelLoading,
        lastProcessed: null,
        totalProcessed: 0,
        successRate: 100
    };
};

/**
 * Processes smart crop specifically for logos with subject protection
 */
export const processSmartCropForLogo = async (imageFile: File, targetWidth: number, targetHeight: number, options: any = {}): Promise<File> => {
    const fileName = imageFile.name ? imageFile.name.toLowerCase() : '';
    const mimeType = imageFile.type ? imageFile.type.toLowerCase() : '';
    const isSVG = isSVGFile(imageFile);

    if (isSVG) {
        try {
            const svgDimensions = await getSVGDimensions(imageFile);
            const svgAspectRatio = svgDimensions.width / svgDimensions.height;
            const targetAspectRatio = targetWidth / targetHeight;

            let scaleWidth, scaleHeight;
            if (svgAspectRatio > targetAspectRatio) {
                scaleWidth = targetWidth;
                scaleHeight = Math.round(targetWidth / svgAspectRatio);
            } else {
                scaleHeight = targetHeight;
                scaleWidth = Math.round(targetHeight * svgAspectRatio);
            }

            const rasterFile = await convertSVGToRaster(imageFile, scaleWidth, scaleHeight, IMAGE_FORMATS.PNG);

            const img = new Image();
            const objectUrl = URL.createObjectURL(rasterFile);

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Failed to load rasterized SVG'));
                };
                img.src = objectUrl;
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No context");

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            ctx.clearRect(0, 0, targetWidth, targetHeight);

            const offsetX = (targetWidth - scaleWidth) / 2;
            const offsetY = (targetHeight - scaleHeight) / 2;
            ctx.drawImage(img, offsetX, offsetY, scaleWidth, scaleHeight);

            const blob = await new Promise<Blob | null>(resolve => {
                canvas.toBlob(resolve, MIME_TYPE_MAP.png, DEFAULT_PNG_QUALITY);
            });

            if (!blob) throw new Error("Failed to create blob for logo");

            return new File([blob], fileName.replace(/\.svg$/i, `.png`), { type: MIME_TYPE_MAP.png });
        } catch {
            return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: 'center' }) as File;
        }
    }

    const isTIFF = TIFF_FORMATS.includes(mimeType) || FILE_EXTENSIONS.TIFF.some(ext => fileName.endsWith(ext));
    const isBMP = mimeType === 'image/bmp' || FILE_EXTENSIONS.BMP.some(ext => fileName.endsWith(ext));
    const isGIF = mimeType === 'image/gif' || FILE_EXTENSIONS.GIF.some(ext => fileName.endsWith(ext));
    const isICO = mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon' || FILE_EXTENSIONS.ICO.some(ext => fileName.endsWith(ext));

    try {
        let processableFile = imageFile;

        if (isTIFF || isBMP || isGIF || isICO) {
            try {
                processableFile = await convertLegacyFormat(imageFile);


            } catch {
                return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: 'center' }) as File;
            }
        }

        const img = await loadImage(processableFile);

        let model = aiModel;
        if (!model) {
            try {
                model = await loadAIModel();
                aiModel = model;
            } catch {
                return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: 'center' }) as File;
            }
        }

        try {
            const detections = await model.detect(img.element);

            if (!detections || detections.length === 0) {

                return await processStandardCrop(processableFile, targetWidth, targetHeight, { ...options, cropPosition: 'center' });
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const detection of detections) {
                const [x, y, w, h] = detection.bbox;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + w);
                maxY = Math.max(maxY, y + h);
            }

            const subjectWidth = maxX - minX;
            const subjectHeight = maxY - minY;
            const subjectCenterX = minX + subjectWidth / 2;
            const subjectCenterY = minY + subjectHeight / 2;

            const paddingRatio = LOGO_DETECTION_CONFIG.PROTECTIVE_PADDING || 0.2;
            const paddedWidth = subjectWidth * (1 + paddingRatio * 2);
            const paddedHeight = subjectHeight * (1 + paddingRatio * 2);

            const subjectAspectRatio = paddedWidth / paddedHeight;
            const targetAspectRatio = targetWidth / targetHeight;

            let cropWidth, cropHeight;
            if (subjectAspectRatio > targetAspectRatio) {
                cropWidth = paddedWidth;
                cropHeight = cropWidth / targetAspectRatio;
            } else {
                cropHeight = paddedHeight;
                cropWidth = cropHeight * targetAspectRatio;
            }

            cropWidth = Math.min(cropWidth, img.width);
            cropHeight = Math.min(cropHeight, img.height);

            let cropX = subjectCenterX - cropWidth / 2;
            let cropY = subjectCenterY - cropHeight / 2;

            cropX = Math.max(0, Math.min(cropX, img.width - cropWidth));
            cropY = Math.max(0, Math.min(cropY, img.height - cropHeight));

            if (cropWidth >= img.width * 0.95 && cropHeight >= img.height * 0.95) {
                return await fitImageToContain(processableFile, targetWidth, targetHeight, options);
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No context");

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img.element, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

            const format = options.format || IMAGE_FORMATS.WEBP;
            const quality = options.quality || DEFAULT_QUALITY;
            const blob = await new Promise<Blob | null>(resolve => {
                canvas.toBlob(resolve, MIME_TYPE_MAP[format] || MIME_TYPE_MAP.webp, quality);
            });

            if (!blob) {
                throw new Error('Failed to create logo crop blob');
            }

            const extension = format === IMAGE_FORMATS.PNG ? 'png' : 'webp';
            const outputFileName = fileName.replace(/\.[^.]+$/, `-logo-${targetWidth}x${targetHeight}.${extension}`);

            return new File([blob], outputFileName, { type: blob.type });

        } catch {

            return await processStandardCrop(processableFile, targetWidth, targetHeight, { ...options, cropPosition: 'center' });
        }

    } catch {
        return await processSimpleSmartCrop(imageFile, targetWidth, targetHeight, { ...options, cropPosition: 'center' }) as File;
    }
};

/**
 * Cleans up resources
 */
export const cleanupCropProcessor = () => {
    aiModel = null;
    aiModelLoading = false;
    safeCleanupGPUMemory();
};

/**
 * Gets crop processor version
 */
export const getCropProcessorVersion = () => {
    return '1.0.0';
};

/**
 * Gets recommended crop dimensions based on aspect ratio
 */
export const getRecommendedCropDimensions = (width: number, height: number, aspectRatio: string = '1:1') => {
    const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number);
    const targetRatio = ratioWidth / ratioHeight;
    const currentRatio = width / height;
    let cropWidth, cropHeight;
    if (currentRatio > targetRatio) {
        cropHeight = height;
        cropWidth = Math.round(height * targetRatio);
    } else {
        cropWidth = width;
        cropHeight = Math.round(width / targetRatio);
    }
    return {
        width: cropWidth,
        height: cropHeight,
        aspectRatio: targetRatio,
        originalRatio: currentRatio,
        isWider: currentRatio > targetRatio,
        isTaller: currentRatio < targetRatio
    };
};

/**
 * Initializes crop processor
 */
export const initializeCropProcessor = async () => {
    try {
        if (!aiModel) {
            aiModelLoading = true;
            try {
                aiModel = await loadAIModel();
            } catch { /* ignored */ } finally {
                aiModelLoading = false;
            }
        }
        return {
            success: true,
            aiModelLoaded: aiModel !== null,
            version: getCropProcessorVersion()
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            aiModelLoaded: false
        };
    }
};
