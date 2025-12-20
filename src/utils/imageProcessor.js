// ============================================
// IMAGE PROCESSOR - Complete Implementation
// All business logic from components moved here
// ============================================

// ============================================
// SECTION 1: CORE IMAGE PROCESSING FUNCTIONS
// ============================================

/**
 * LemGendary Resize: Smart resize maintaining aspect ratio
 */
export const processLemGendaryResize = async (images, dimension, options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            // Ensure we have a valid File object
            const imageFile = await ensureFileObject(image);
            let processedFile;

            if (imageFile.type === 'image/svg+xml') {
                processedFile = await processSVGResize(imageFile, dimension);
            } else {
                // Create a new Image object with error handling
                const img = new Image();

                // Create object URL from the File/Blob
                const objectUrl = URL.createObjectURL(imageFile);

                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve();
                    };
                    img.onerror = (error) => {
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

                // Check if upscaling is needed
                const needsUpscaling = newWidth > img.naturalWidth || newHeight > img.naturalHeight;

                let sourceFile = imageFile;

                if (needsUpscaling) {
                    // First upscale, then resize if needed
                    const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, newWidth, newHeight);
                    sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, image.name);
                }

                // Create canvas for final processing
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Load the source file (original or upscaled)
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

                processedFile = new File([resizedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), {
                    type: 'image/webp'
                });
            }

            const optimizedFile = await optimizeForWeb(processedFile, options.quality, options.format);

            results.push({
                original: { ...image, file: imageFile },
                resized: optimizedFile,
                dimensions: { width: dimension, height: dimension },
                isSVG: imageFile.type === 'image/svg+xml',
                optimized: true
            });

        } catch (error) {
            console.error(`Error resizing ${image.name}:`, error);
            results.push({
                original: image,
                resized: image.file instanceof File ? image.file : null,
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
 * LemGendary Crop: Resizes image to cover dimensions, then crops from position
 */
export const processLemGendaryCrop = async (images, width, height, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    const results = [];

    for (const image of images) {
        try {
            // Ensure we have a valid File object
            const imageFile = await ensureFileObject(image);
            let croppedFile;

            if (imageFile.type === 'image/svg+xml') {
                // SVG processing
                const img = new Image();
                const svgUrl = URL.createObjectURL(imageFile);

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
                // Check image dimensions
                const img = new Image();
                const objectUrl = URL.createObjectURL(imageFile);

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Failed to load image'));
                    };
                    img.src = objectUrl;
                });

                const needsUpscaling = width > img.naturalWidth || height > img.naturalHeight;
                let sourceFile = imageFile;

                if (needsUpscaling) {
                    // Upscale first, then crop
                    const upscaleFactor = calculateUpscaleFactor(img.naturalWidth, img.naturalHeight, width, height);
                    sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, image.name);
                }

                URL.revokeObjectURL(objectUrl);

                // Now crop from the appropriate file
                const resized = await resizeImageForCrop(sourceFile, width, height);
                croppedFile = await cropFromResized(resized, width, height, cropPosition, imageFile);
            }

            const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);

            results.push({
                original: image,
                cropped: optimizedFile,
                dimensions: { width, height },
                isSVG: imageFile.type === 'image/svg+xml',
                optimized: true
            });

        } catch (error) {
            console.error(`Error cropping ${image.name}:`, error);
            results.push({
                original: image,
                cropped: image.file instanceof File ? image.file : null,
                dimensions: { width, height },
                isSVG: image.file?.type === 'image/svg+xml',
                optimized: false,
                error: error.message
            });
        }
    }

    return results;
};

// ============================================
// SECTION 2: AI PROCESSING FUNCTIONS (FIXED)
// ============================================

let aiModel = null;
let aiModelLoading = false;
let upscalerInstances = {}; // Store multiple upscaler instances by scale

/**
 * Load AI model for smart cropping with fallback
 */
export const loadAIModel = async () => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        // Try to load from CDN to avoid module issues
        await loadTensorFlowFromCDN();

        // Check if TensorFlow is available
        if (!window.tf) {
            throw new Error('TensorFlow.js not available');
        }

        // Load COCO-SSD using dynamic import
        const cocoSsdModule = await import('@tensorflow-models/coco-ssd');
        const cocoSsd = cocoSsdModule.default || cocoSsdModule;

        aiModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        aiModelLoading = false;
        console.log('AI model loaded successfully from CDN');
        return aiModel;
    } catch (error) {
        console.warn('AI model loading failed, using fallback:', error);

        // Create a simple fallback model
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        console.log('Using simple AI fallback model');
        return aiModel;
    }
};

/**
 * Load TensorFlow.js from CDN to avoid module issues
 */
const loadTensorFlowFromCDN = () => {
    return new Promise((resolve, reject) => {
        if (window.tf) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
        script.onload = () => {
            console.log('TensorFlow.js loaded from CDN');
            resolve();
        };
        script.onerror = () => {
            console.warn('Failed to load TensorFlow.js from CDN');
            // Don't reject, we'll use fallback
            resolve();
        };
        document.head.appendChild(script);
    });
};

/**
 * Create a simple AI model fallback
 */
const createSimpleAIModel = () => {
    return {
        detect: async (imgElement) => {
            // Simple fallback detection - returns empty array
            console.log('Using simple AI fallback detection');
            return [];
        }
    };
};

/**
 * Load UpscalerJS for specific scale
 */
const loadUpscalerForScale = async (scale) => {
    // Return existing instance if already loaded
    if (upscalerInstances[scale]) {
        return upscalerInstances[scale];
    }

    console.log(`Loading UpscalerJS model for ${scale}x scaling...`);

    try {
        // Dynamically import the UpscalerJS library
        const upscalerModule = await import('upscaler');
        const Upscaler = upscalerModule.default || upscalerModule;

        // Load the specific model for the scale
        let model;
        switch (scale) {
            case 2:
                model = await import('@upscalerjs/esrgan-slim/2x');
                break;
            case 3:
                model = await import('@upscalerjs/esrgan-slim/3x');
                break;
            case 4:
                model = await import('@upscalerjs/esrgan-slim/4x');
                break;
            case 8:
                model = await import('@upscalerjs/esrgan-slim/8x');
                break;
            default:
                throw new Error(`Unsupported scale: ${scale}`);
        }

        // Create new upscaler instance with the model
        const upscaler = new Upscaler({
            model: model.default || model
        });

        // Store the instance
        upscalerInstances[scale] = upscaler;
        console.log(`UpscalerJS ${scale}x model loaded successfully`);

        return upscaler;
    } catch (error) {
        console.warn(`Failed to load UpscalerJS ${scale}x model:`, error);
        // Create fallback upscaler
        const fallbackUpscaler = createFallbackUpscaler(scale);
        upscalerInstances[scale] = fallbackUpscaler;
        return fallbackUpscaler;
    }
};

/**
 * Create a fallback upscaler (bicubic interpolation)
 */
const createFallbackUpscaler = (scale) => {
    return {
        scale,
        upscale: async (imageElement) => {
            console.log(`Using fallback upscaler for ${scale}x scaling`);
            const canvas = document.createElement('canvas');
            canvas.width = imageElement.naturalWidth * scale;
            canvas.height = imageElement.naturalHeight * scale;
            const ctx = canvas.getContext('2d');

            // Use bicubic interpolation (smoother scaling)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

            return canvas;
        }
    };
};

/**
 * Upscale image with AI using UpscalerJS
 */
const upscaleImageWithAI = async (imageFile, scale, originalName) => {
    try {
        console.log(`Starting AI upscaling at ${scale}x for ${originalName}`);

        // Load the appropriate upscaler for this scale
        const upscaler = await loadUpscalerForScale(scale);

        // Create image element
        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        // Upscale the image
        const upscaledCanvas = await upscaler.upscale(img);

        // Revoke object URL
        URL.revokeObjectURL(objectUrl);

        // Convert canvas to blob
        const blob = await new Promise(resolve => {
            upscaledCanvas.toBlob(resolve, 'image/webp', 0.9);
        });

        if (!blob) {
            throw new Error('Failed to create blob from upscaled canvas');
        }

        // Create new file with upscaled content
        const extension = originalName.split('.').pop();
        const newName = originalName.replace(
            /\.[^/.]+$/,
            `-upscaled-${scale}x.${extension}`
        );

        const upscaledFile = new File([blob], newName, { type: 'image/webp' });

        console.log(`AI upscaling completed: ${originalName} upscaled ${scale}x`);
        return upscaledFile;

    } catch (error) {
        console.warn('AI upscaling failed, using fallback:', error);
        return upscaleImageFallback(imageFile, scale, originalName);
    }
};

/**
 * Fallback upscaling using canvas (bicubic interpolation)
 */
const upscaleImageFallback = async (imageFile, scale, originalName) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');

    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Revoke object URL
    URL.revokeObjectURL(objectUrl);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    const extension = originalName.split('.').pop();
    const newName = originalName.replace(
        /\.[^/.]+$/,
        `-upscaled-fallback-${scale}x.${extension}`
    );

    return new File([blob], newName, { type: 'image/webp' });
};

/**
 * Calculate the appropriate upscale factor
 */
const calculateUpscaleFactor = (originalWidth, originalHeight, targetWidth, targetHeight) => {
    // Calculate required scale for each dimension
    const widthScale = targetWidth / originalWidth;
    const heightScale = targetHeight / originalHeight;

    // Use the larger scale factor
    const requiredScale = Math.max(widthScale, heightScale);

    // Available scales from the models
    const availableScales = [2, 3, 4, 8];

    // Find the smallest available scale that meets or exceeds required scale
    for (const scale of availableScales) {
        if (scale >= requiredScale) {
            return scale;
        }
    }

    // If required scale is larger than 8x, use multiple upscales
    // For example, if we need 16x, do 8x then 2x
    if (requiredScale > 8) {
        console.log(`Required scale ${requiredScale}x exceeds maximum, using 8x`);
        return 8;
    }

    // This shouldn't happen, but just in case
    return 2;
};

/**
 * AI Smart Crop: Resizes first, detects main subject, crops intelligently
 */
export const processSmartCrop = async (imageFile, targetWidth, targetHeight, options = { quality: 0.85, format: 'webp' }) => {
    try {
        // Check if upscaling is needed
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = imageFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, imageFile.name);
        }

        URL.revokeObjectURL(objectUrl);

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);
        const model = await loadAIModel();
        const loadedImg = await loadImage(resized.file);
        const predictions = await model.detect(loadedImg.element);
        const mainSubject = findMainSubject(predictions, loadedImg.width, loadedImg.height);

        let croppedFile;

        if (mainSubject) {
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, mainSubject, imageFile);
        } else {
            croppedFile = await cropFromResized(resized, targetWidth, targetHeight, 'center', imageFile);
        }

        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
        console.error('AI smart crop error:', error);
        return processSimpleSmartCrop(imageFile, targetWidth, targetHeight, 'center', options);
    }
};

/**
 * Simple Smart Crop: Resizes first, uses basic edge detection
 */
export const processSimpleSmartCrop = async (imageFile, targetWidth, targetHeight, cropPosition = 'center', options = { quality: 0.85, format: 'webp' }) => {
    try {
        // Check if upscaling is needed
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });

        const needsUpscaling = targetWidth > img.naturalWidth || targetHeight > img.naturalHeight;
        let sourceFile = imageFile;

        if (needsUpscaling) {
            const upscaleFactor = calculateUpscaleFactor(
                img.naturalWidth,
                img.naturalHeight,
                targetWidth,
                targetHeight
            );
            sourceFile = await upscaleImageWithAI(imageFile, upscaleFactor, imageFile.name);
        }

        URL.revokeObjectURL(objectUrl);

        const resized = await resizeImageForCrop(sourceFile, targetWidth, targetHeight);
        const loadedImg = await loadImage(resized.file);

        // Use simple edge detection instead of TensorFlow
        const focalPoint = await detectFocalPointSimple(loadedImg.element, loadedImg.width, loadedImg.height);
        const adjustedPosition = adjustCropPositionForFocalPoint(cropPosition, focalPoint, loadedImg.width, loadedImg.height);
        const croppedFile = await cropFromResized(resized, targetWidth, targetHeight, adjustedPosition, imageFile);
        const optimizedFile = await optimizeForWeb(croppedFile, options.quality, options.format);
        return optimizedFile;

    } catch (error) {
        console.error('Simple smart crop error:', error);
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
 * Find main subject from AI predictions
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
 * Simple focal point detection without TensorFlow
 */
const detectFocalPointSimple = async (imgElement, width, height) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imgElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Simple edge detection
    let totalX = 0, totalY = 0, count = 0;
    const edgeThreshold = 30;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            // Check for significant color changes (simple edge detection)
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

    // Fallback to center
    return {
        x: Math.round(width / 2),
        y: Math.round(height / 2)
    };
};

// ============================================
// SECTION 3: SVG PROCESSING FUNCTIONS
// ============================================

/**
 * SVG-specific resize function
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
 * Load image with proper cleanup
 */
const loadImage = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            resolve({
                element: img,
                width: img.naturalWidth,
                height: img.naturalHeight
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
 */
const cropFromResized = async (resized, targetWidth, targetHeight, position, originalFile) => {
    const img = await loadImage(resized.file);

    let offsetX, offsetY;

    if (typeof position === 'string') {
        const offset = calculateCropOffset(resized.width, resized.height, targetWidth, targetHeight, position);
        offsetX = offset.offsetX;
        offsetY = offset.offsetY;
    }
    else if (position && position.bbox) {
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
    }
    else if (position && position.x !== undefined && position.y !== undefined) {
        offsetX = position.x - targetWidth / 2;
        offsetY = position.y - targetHeight / 2;
    }
    else {
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
 * Adjust crop position based on focal point
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
 * Calculate luminance from RGB
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
 */
export const getImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight,
                orientation: img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait'
            });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);

        setTimeout(() => URL.revokeObjectURL(img.src), 1000);
    });
};

/**
 * Convert Image element to Blob
 */
export const imageToBlob = (img, format = 'webp', quality = 0.85) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
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

/**
 * Create image objects from uploaded files - FIXED VERSION
 */
export const createImageObjects = (files) => {
    return Array.from(files).map(file => {
        // Ensure we have a File object
        const fileObj = file instanceof File ? file : new File([file], file.name || 'image', { type: file.type });

        return {
            id: Date.now() + Math.random(),
            file: fileObj, // Store the actual File object
            name: fileObj.name,
            url: URL.createObjectURL(fileObj), // Create blob URL for preview
            size: fileObj.size,
            type: fileObj.type,
            optimized: false
        };
    });
};

/**
 * Clean up blob URLs - NEW FUNCTION
 */
export const cleanupBlobUrls = (imageObjects) => {
    imageObjects?.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
            } catch (e) {
                // Ignore errors if URL is already revoked
            }
        }
    });
};

/**
 * Ensure valid File object - NEW FUNCTION
 */
export const ensureFileObject = async (image) => {
    // If already a File or Blob, return it
    if (image.file instanceof File || image.file instanceof Blob) {
        return image.file;
    }

    // If we have a blob URL, fetch it
    if (image.url && image.url.startsWith('blob:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            console.warn('Failed to fetch blob from URL:', error);
            throw new Error('Invalid image file');
        }
    }

    // If we have a data URL
    if (image.url && image.url.startsWith('data:')) {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            return new File([blob], image.name || 'image', { type: blob.type });
        } catch (error) {
            console.warn('Failed to convert data URL to file:', error);
            throw new Error('Invalid image file');
        }
    }

    throw new Error('No valid file data found');
};

/**
 * Process template images for social media
 */
export const processTemplateImages = async (image, selectedTemplates) => {
    const processedImages = [];
    const imageFile = await ensureFileObject(image);
    const isSVG = imageFile.type === 'image/svg+xml';
    const hasTransparency = isSVG ? false : await checkImageTransparency(imageFile);

    for (const template of selectedTemplates) {
        let processedFile = imageFile;

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

        if (isSVG) {
            const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp');
            const jpgPngFile = await optimizeForWeb(processedFile, 0.85, 'png');

            const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`;

            const webpName = `${baseName}.webp`;
            processedImages.push({
                ...image,
                file: webpFile,
                name: webpName,
                template: template,
                format: 'webp',
                processed: true
            });

            if (template.category === 'web' || template.category === 'logo') {
                const pngName = `${baseName}.png`;
                processedImages.push({
                    ...image,
                    file: jpgPngFile,
                    name: pngName,
                    template: template,
                    format: 'png',
                    processed: true
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
                    processed: true
                });
            }
        } else {
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
                processed: true
            });

            if (template.category === 'web' || template.category === 'logo') {
                const jpgPngName = `${baseName}.${hasTransparency ? 'png' : 'jpg'}`;
                processedImages.push({
                    ...image,
                    file: jpgPngFile,
                    name: jpgPngName,
                    template: template,
                    format: hasTransparency ? 'png' : 'jpg',
                    processed: true
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
                    processed: true
                });
            }
        }
    }

    return processedImages;
};

/**
 * Process custom images with given options - UPDATED VERSION
 */
export const processCustomImagesBatch = async (selectedImages, processingOptions, aiModelLoaded = false) => {
    const processedImages = [];

    for (let i = 0; i < selectedImages.length; i++) {
        const image = selectedImages[i];

        try {
            // FIX: Ensure we have a valid File object
            let processedFile = await ensureFileObject(image);

            if (processingOptions.showResize && processingOptions.resizeDimension) {
                const resizeResults = await processLemGendaryResize(
                    [{ ...image, file: processedFile }],
                    parseInt(processingOptions.resizeDimension)
                );
                if (resizeResults.length > 0) {
                    processedFile = resizeResults[0].resized;
                }
            }

            if (processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight) {
                if (processingOptions.cropMode === 'smart') {
                    if (aiModelLoaded) {
                        processedFile = await processSmartCrop(
                            processedFile,
                            parseInt(processingOptions.cropWidth),
                            parseInt(processingOptions.cropHeight)
                        );
                    } else {
                        // Fallback to standard crop if AI not loaded
                        const cropResults = await processLemGendaryCrop(
                            [{ ...image, file: processedFile }],
                            parseInt(processingOptions.cropWidth),
                            parseInt(processingOptions.cropHeight),
                            processingOptions.cropPosition
                        );
                        if (cropResults.length > 0) {
                            processedFile = cropResults[0].cropped;
                        }
                    }
                } else {
                    // Use standard crop with position
                    const cropResults = await processLemGendaryCrop(
                        [{ ...image, file: processedFile }],
                        parseInt(processingOptions.cropWidth),
                        parseInt(processingOptions.cropHeight),
                        processingOptions.cropPosition
                    );
                    if (cropResults.length > 0) {
                        processedFile = cropResults[0].cropped;
                    }
                }
            }

            // Apply rename if enabled
            let finalName = image.name;
            if (processingOptions.output.rename && processingOptions.output.newFileName) {
                const renameResults = await processLemGendaryRename(
                    [{ ...image, file: processedFile }],
                    processingOptions.output.newFileName
                );
                if (renameResults.length > 0) {
                    processedFile = renameResults[0].renamed;
                    const extension = image.name.split('.').pop();
                    finalName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}.${extension}`;
                }
            }

            // Convert to output format if not 'original'
            if (processingOptions.output.format !== 'original') {
                const hasTransparency = await checkImageTransparency(processedFile);
                const targetFormat = processingOptions.output.format;

                let finalFormat;
                if (targetFormat === 'jpg' && hasTransparency) {
                    finalFormat = 'png';
                } else {
                    finalFormat = targetFormat;
                }

                processedFile = await optimizeForWeb(
                    processedFile,
                    processingOptions.compression.quality / 100,
                    finalFormat
                );

                finalName = finalName.replace(/\.[^/.]+$/, '') + '.' + finalFormat;
            }

            processedImages.push({
                ...image,
                file: processedFile,
                name: finalName,
                url: URL.createObjectURL(processedFile), // Create new blob URL for preview
                processed: true,
                format: processingOptions.output.format === 'original'
                    ? image.type?.split('/')[1] || 'webp'
                    : processingOptions.output.format
            });

        } catch (error) {
            console.error(`Error processing ${image.name}:`, error);
            // Skip this image or add error info
            processedImages.push({
                ...image,
                file: null,
                name: image.name,
                processed: false,
                error: error.message
            });
        }
    }

    return processedImages;
};

/**
 * LemGendary Rename: Batch rename functionality
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
 * Optimize image for web with format conversion - FIXED VERSION
 */
export const optimizeForWeb = async (imageFile, quality = 0.8, format = 'webp') => {
    // Ensure we have a valid File object
    if (!(imageFile instanceof File) && !(imageFile instanceof Blob)) {
        throw new Error('Invalid image file provided to optimizeForWeb');
    }

    if (imageFile.type === 'image/svg+xml') {
        return convertSVGToRaster(imageFile, 1000, 1000, format);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

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
                    URL.revokeObjectURL(objectUrl);

                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }

                    const originalName = imageFile.name || 'image';
                    const newName = originalName.replace(/\.[^/.]+$/, '') + '.' + extension;
                    resolve(new File([blob], newName, { type: mimeType }));
                },
                mimeType,
                quality
            );
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            console.error('Image load error:', err);
            reject(new Error('Failed to load image'));
        };

        img.src = objectUrl;
    });
};

/**
 * Check image transparency
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
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
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
// SECTION 6: COMPONENT LOGIC FUNCTIONS
// (From React components)
// ============================================

/**
 * Get available languages (from LanguageSwitcher)
 */
export const getLanguages = () => {
    return [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' }
    ];
};

/**
 * Get current language object
 */
export const getCurrentLanguage = (currentLangCode) => {
    const languages = getLanguages();
    return languages.find(lang => lang.code === currentLangCode) || languages[0];
};

/**
 * Handle image drop event (from ImageUploader)
 */
export const handleImageDrop = (e, onUpload) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
    if (files.length > 0) {
        onUpload(files);
    }
};

/**
 * Handle file selection (from ImageUploader)
 */
export const handleFileSelect = (e, onUpload) => {
    const files = Array.from(e.target.files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
    onUpload(files);
};

/**
 * Calculate percentage for range slider (from RangeSlider)
 */
export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

/**
 * Generate tick values for range slider (from RangeSlider)
 */
export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

/**
 * Validate image files
 */
export const validateImageFiles = (files) => {
    return Array.from(files).filter(file =>
        file.type.startsWith('image/') || file.type === 'image/svg+xml'
    );
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get file extension
 */
export const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
};