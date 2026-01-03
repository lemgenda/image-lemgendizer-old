import {
    FILE_EXTENSIONS,
    SVG_CONSTANTS,
    IMAGE_COLORS,
    FONT_CONSTANTS,
    DEFAULT_PNG_QUALITY,
    DEFAULT_WEBP_QUALITY,
    DEFAULT_QUALITY,
    ERROR_MESSAGES,
    PROCESSING_ERRORS,
    TEMP_FILE_NAMES,
    FILE_TYPE_NAMES,
    SVG_XML_TEMPLATE,
    CROP_MARGIN,
    MIME_TYPE_MAP
} from '../constants';

import { APP_TEMPLATE_CONFIG, DEFAULT_PLACEHOLDER_DIMENSIONS } from '../configs/templateConfigs';

/**
 * Checks if file is SVG
 * @param {File} file - File to check
 * @returns {boolean} True if file is SVG
 */
export const isSVGFile = (file) => {
    if (!file || !file.name) return false;

    const fileName = file.name.toLowerCase();
    const mimeType = file.type?.toLowerCase() || '';

    return mimeType === 'image/svg+xml' ||
        FILE_EXTENSIONS.SVG.some(ext => fileName.endsWith(ext));
};

/**
 * Gets SVG dimensions from file
 * @param {File} svgFile - SVG file
 * @returns {Promise<Object>} SVG dimensions
 */
export const getSVGDimensions = async (svgFile) => {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(e.target.result, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                let width = SVG_CONSTANTS.DEFAULT_WIDTH;
                let height = SVG_CONSTANTS.DEFAULT_HEIGHT;

                const widthAttr = svgElement.getAttribute('width');
                const heightAttr = svgElement.getAttribute('height');

                if (widthAttr && !isNaN(parseFloat(widthAttr))) {
                    width = parseFloat(widthAttr);
                }
                if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                    height = parseFloat(heightAttr);
                }

                if ((!widthAttr || !heightAttr) && svgElement.hasAttribute('viewBox')) {
                    const viewBox = svgElement.getAttribute('viewBox');
                    const parts = viewBox.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                    if (parts.length >= 4) {
                        width = parts[2];
                        height = parts[3];
                    }
                }

                resolve({ width, height, aspectRatio: width / height });
            } catch {
                resolve({
                    width: SVG_CONSTANTS.DEFAULT_WIDTH,
                    height: SVG_CONSTANTS.DEFAULT_HEIGHT,
                    aspectRatio: SVG_CONSTANTS.DEFAULT_WIDTH / SVG_CONSTANTS.DEFAULT_HEIGHT
                });
            }
        };

        reader.onerror = () => resolve({
            width: SVG_CONSTANTS.DEFAULT_WIDTH,
            height: SVG_CONSTANTS.DEFAULT_HEIGHT,
            aspectRatio: SVG_CONSTANTS.DEFAULT_WIDTH / SVG_CONSTANTS.DEFAULT_HEIGHT
        });

        reader.readAsText(svgFile);
    });
};

/**
 * Converts SVG to raster format
 * @param {File} svgFile - SVG file
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string} format - Output format
 * @returns {Promise<File>} Raster image file
 */
export const convertSVGToRaster = async (svgFile, targetWidth, targetHeight, format = 'png') => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            let svgUrl = null;

            try {
                const svgText = e.target.result;

                if (!svgText || typeof svgText !== 'string') {
                    throw new Error(PROCESSING_ERRORS.INVALID_SVG_CONTENT);
                }

                const trimmedText = svgText.trim();
                if (trimmedText.length === 0) {
                    throw new Error(PROCESSING_ERRORS.INVALID_SVG_CONTENT);
                }

                let finalSvgText = trimmedText;
                if (!trimmedText.startsWith('<')) {
                    finalSvgText = SVG_XML_TEMPLATE
                        .replace(/{width}/g, targetWidth || SVG_CONSTANTS.DEFAULT_WIDTH)
                        .replace(/{height}/g, targetHeight || SVG_CONSTANTS.DEFAULT_HEIGHT)
                        .replace(/{content}/g, trimmedText);
                }

                let svgElement;
                let originalWidth = targetWidth || SVG_CONSTANTS.DEFAULT_WIDTH;
                let originalHeight = targetHeight || SVG_CONSTANTS.DEFAULT_HEIGHT;

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
                    } catch { /* ignored */ }

                } catch {
                    finalSvgText = SVG_XML_TEMPLATE
                        .replace(/{width}/g, originalWidth)
                        .replace(/{height}/g, originalHeight)
                        .replace(/{content}/g,
                            `<rect width="100%" height="100%" fill="${IMAGE_COLORS.PLACEHOLDER_BACKGROUND}"/>
                             <text x="50%" y="50%" text-anchor="middle" dy=".3em"
                                   font-family="${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}" font-size="${Math.min(FONT_CONSTANTS.HEADLINE_FONT_SIZE, originalHeight / 10)}"
                                   fill="${IMAGE_COLORS.PLACEHOLDER_TEXT}" font-weight="bold">
                               ${FILE_TYPE_NAMES.SVG}
                             </text>`);
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

                finalWidth = Math.min(SVG_CONSTANTS.MAX_SIZE, Math.max(SVG_CONSTANTS.MIN_SIZE, Math.round(finalWidth)));
                finalHeight = Math.min(SVG_CONSTANTS.MAX_SIZE, Math.max(SVG_CONSTANTS.MIN_SIZE, Math.round(finalHeight)));

                const svgBlob = new Blob([finalSvgText], { type: 'image/svg+xml' });
                svgUrl = URL.createObjectURL(svgBlob);

                const canvas = document.createElement('canvas');
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                const ctx = canvas.getContext('2d');

                if (format === 'jpg' || format === 'jpeg') {
                    ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                const img = new Image();

                await new Promise((resolveLoad, rejectLoad) => {
                    const timeout = setTimeout(() => {
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        rejectLoad(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
                    }, 10000);

                    img.onload = () => {
                        clearTimeout(timeout);
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        resolveLoad();
                    };
                    img.onerror = () => {
                        clearTimeout(timeout);
                        if (svgUrl) URL.revokeObjectURL(svgUrl);
                        rejectLoad(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
                    };
                    img.src = svgUrl;
                });

                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

                let mimeType, extension;
                switch (format.toLowerCase()) {
                    case 'jpg':
                    case 'jpeg':
                        mimeType = MIME_TYPE_MAP.jpg;
                        extension = 'jpg';
                        break;
                    case 'png':
                        mimeType = MIME_TYPE_MAP.png;
                        extension = 'png';
                        break;
                    case 'webp':
                        mimeType = MIME_TYPE_MAP.webp;
                        extension = 'webp';
                        break;
                    default:
                        mimeType = MIME_TYPE_MAP.png;
                        extension = 'png';
                }

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error(PROCESSING_ERRORS.BLOB_CREATION_FAILED));
                            return;
                        }

                        const baseName = svgFile.name.replace(/\.svg$/i, '');
                        const fileName = `${baseName}-${finalWidth}x${finalHeight}.${extension}`;
                        resolve(new File([blob], fileName, { type: mimeType }));
                    },
                    mimeType,
                    format.toLowerCase() === 'png' ? DEFAULT_PNG_QUALITY : DEFAULT_WEBP_QUALITY
                );

            } catch (error) {
                if (svgUrl) URL.revokeObjectURL(svgUrl);
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error(ERROR_MESSAGES.SVG_CONVERSION_FAILED));
        reader.readAsText(svgFile);
    });
};

/**
 * Creates SVG placeholder with aspect ratio
 * @param {File} svgFile - SVG file
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {string} format - Output format
 * @returns {Promise<File>} Placeholder image file
 */
export const createSVGPlaceholderWithAspectRatio = async (svgFile, targetWidth, targetHeight, format) => {
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
            finalWidth = DEFAULT_PLACEHOLDER_DIMENSIONS.WIDTH;
            finalHeight = DEFAULT_PLACEHOLDER_DIMENSIONS.WIDTH / aspectRatio;
        }

        finalWidth = Math.round(finalWidth);
        finalHeight = Math.round(finalHeight);

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');

        if (format === 'jpg' || format === 'jpeg') {
            ctx.fillStyle = APP_TEMPLATE_CONFIG.FAVICON.DEFAULT_BACKGROUND_COLOR;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = IMAGE_COLORS.PLACEHOLDER_BACKGROUND;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.strokeStyle = IMAGE_COLORS.PLACEHOLDER_BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(CROP_MARGIN, CROP_MARGIN, canvas.width - CROP_MARGIN * 2, canvas.height - CROP_MARGIN * 2);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.fillStyle = IMAGE_COLORS.INFO;
        ctx.font = `bold ${Math.min(32, canvas.height / 8)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(FILE_TYPE_NAMES.SVG, centerX, centerY - 30);

        ctx.fillStyle = IMAGE_COLORS.PLACEHOLDER_TEXT;
        ctx.font = `bold ${Math.min(18, canvas.height / 12)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText('Image', centerX, centerY);

        ctx.fillStyle = IMAGE_COLORS.PLACEHOLDER_TEXT;
        ctx.font = `${Math.min(14, canvas.height / 16)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText(`${Math.round(aspectRatio * 100) / 100}:1`, centerX, centerY + 30);

        ctx.fillStyle = IMAGE_COLORS.SUCCESS;
        ctx.font = `${Math.min(12, canvas.height / 20)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillText(`${finalWidth}×${finalHeight}`, centerX, centerY + 60);

        let mimeType, extension;
        switch (format.toLowerCase()) {
            case 'jpg':
            case 'jpeg':
                mimeType = MIME_TYPE_MAP.jpg;
                extension = 'jpg';
                break;
            case 'png':
                mimeType = MIME_TYPE_MAP.png;
                extension = 'png';
                break;
            case 'webp':
                mimeType = MIME_TYPE_MAP.webp;
                extension = 'webp';
                break;
            default:
                mimeType = MIME_TYPE_MAP.png;
                extension = 'png';
        }

        canvas.toBlob((blob) => {
            const baseName = svgFile.name.replace(/\.svg$/i, '') || TEMP_FILE_NAMES.CONVERTED_SVG;
            const fileName = `${baseName}-${finalWidth}x${finalHeight}.${extension}`;
            resolve(new File([blob], fileName, { type: mimeType }));
        }, mimeType, DEFAULT_QUALITY);
    });
};

/**
 * Resizes SVG file
 * @param {File} svgFile - SVG file
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<File>} Resized SVG file
 */
export const resizeSVG = async (svgFile, width, height) => {
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

                if (!originalWidth) originalWidth = SVG_CONSTANTS.DEFAULT_WIDTH;
                if (!originalHeight) originalHeight = SVG_CONSTANTS.DEFAULT_HEIGHT;

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

/**
 * Generates SVG preview
 * @param {File} svgFile - SVG file
 * @param {number} maxSize - Maximum preview size
 * @returns {Promise<string>} Data URL preview
 */
export const generateSVGPreview = async (svgInput, maxSize = 400) => {
    const svgFile = svgInput instanceof File ? svgInput : (svgInput.file || svgInput);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const svgText = e.target.result;
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                const svgUrl = URL.createObjectURL(svgBlob);

                const img = new Image();

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.naturalWidth || img.width || 200;
                    let height = img.naturalHeight || img.height || 150;

                    if (width > maxSize || height > maxSize) {
                        const scale = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    ctx.drawImage(img, 0, 0, width, height);

                    URL.revokeObjectURL(svgUrl);
                    resolve(canvas.toDataURL('image/png'));
                };

                img.onerror = () => {
                    URL.revokeObjectURL(svgUrl);
                    reject(new Error('Failed to load SVG'));
                };

                img.src = svgUrl;

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read SVG file'));
        reader.readAsText(svgFile);
    });
};

/**
 * Creates SVG error placeholder
 */
export const createSVGErrorPlaceholder = async (image, dimension, errorMessage) => {
    const canvas = document.createElement('canvas');
    canvas.width = dimension;
    canvas.height = dimension;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = IMAGE_COLORS.ERROR_BACKGROUND;
    ctx.fillRect(0, 0, dimension, dimension);

    ctx.strokeStyle = IMAGE_COLORS.ERROR_BORDER;
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, dimension - 10, dimension - 10);

    ctx.fillStyle = IMAGE_COLORS.ERROR_TEXT;
    const fontSize = Math.min(16, dimension / 10);
    ctx.font = `bold ${fontSize}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = dimension / 2;
    const centerY = dimension / 2;

    ctx.fillText('SVG Error', centerX, centerY - fontSize);

    const displayName = image.name.length > 20 ? image.name.substring(0, 17) + '...' : image.name;
    ctx.fillText(displayName, centerX, centerY);

    ctx.fillStyle = IMAGE_COLORS.WARNING_TEXT;
    ctx.font = `${Math.min(12, dimension / 15)}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
    ctx.fillText(errorMessage.substring(0, 30) + '...', centerX, centerY + fontSize);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
    });

    return new File([blob], image.name.replace(/\.svg$/i, '-error.webp'), {
        type: 'image/webp'
    });
};

/**
 * Creates error placeholder
 */
export const createErrorPlaceholder = async (image, dimension, errorMessage) => {
    const canvas = document.createElement('canvas');
    canvas.width = dimension;
    canvas.height = dimension;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = IMAGE_COLORS.ERROR_BACKGROUND;
    ctx.fillRect(0, 0, dimension, dimension);

    ctx.fillStyle = IMAGE_COLORS.ERROR_TEXT;
    ctx.font = `bold ${FONT_CONSTANTS.BODY_FONT_SIZE}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = dimension / 2;
    const centerY = dimension / 2;

    const displayName = image.name.length > 20 ? image.name.substring(0, 17) + '...' : image.name;
    ctx.fillText('Error', centerX, centerY - 20);
    ctx.fillText(displayName, centerX, centerY);

    ctx.fillStyle = IMAGE_COLORS.WARNING_TEXT;
    ctx.font = `${FONT_CONSTANTS.CAPTION_FONT_SIZE}px ${FONT_CONSTANTS.DEFAULT_FONT_FAMILY}`;
    const errorMsg = errorMessage.length > 30 ? errorMessage.substring(0, 27) + '...' : errorMessage;
    ctx.fillText(errorMsg, centerX, centerY + 25);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', DEFAULT_WEBP_QUALITY);
    });

    return new File([blob], `${image.name}-error.webp`, {
        type: 'image/webp'
    });
};