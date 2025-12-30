import { convertTIFFWithUTIF } from '../processors/imageProcessor';

/**
 * Generates a preview image for TIFF files using UTIF
 * @param {File} tiffFile - TIFF file
 * @param {number} maxSize - Maximum size for preview (default: 400)
 * @returns {Promise<string>} Data URL of the preview image
 */
export const generateTIFFPreview = async (tiffFile, maxSize = 400) => {
    try {
        if (!window.UTIF) {
            console.warn('UTIF library not loaded, attempting to load...');
            // You could load UTIF here if needed
            throw new Error('UTIF library not loaded');
        }

        console.log(`Generating TIFF preview for: ${tiffFile.name}`);

        // First convert TIFF to PNG using your existing function
        const pngFile = await convertTIFFWithUTIF(tiffFile);

        // Create a scaled preview
        const preview = await createScaledPreview(pngFile, maxSize);
        console.log(`TIFF preview generated successfully for: ${tiffFile.name}`);
        return preview;

    } catch (error) {
        console.error('Failed to generate TIFF preview:', error.message);
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

                // Handle invalid dimensions
                if (!width || !height || width <= 0 || height <= 0) {
                    width = 200;
                    height = 150;
                }

                // Scale down if too large
                if (width > maxSize || height > maxSize) {
                    const scale = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // For PNG/transparent images
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

                // Try to decode image
                try {
                    if (window.UTIF.decodeImage) {
                        window.UTIF.decodeImage(arrayBuffer, firstIFD);
                    } else if (window.UTIF.decodeImages) {
                        window.UTIF.decodeImages(arrayBuffer, ifds);
                    }
                } catch (decodeError) {
                    console.warn('UTIF decode failed:', decodeError);
                }

                // Get dimensions
                let width = firstIFD.width || firstIFD['ImageWidth'] || firstIFD['t256'] || 200;
                let height = firstIFD.height || firstIFD['ImageLength'] || firstIFD['t257'] || 150;

                if (width && width.value) width = width.value;
                if (height && height.value) height = height.value;

                // Ensure valid dimensions
                width = Math.max(1, Math.min(width, 10000));
                height = Math.max(1, Math.min(height, 10000));

                // Create preview canvas
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

                // Try to get actual image data
                try {
                    const rgba = window.UTIF.toRGBA8(firstIFD);
                    if (rgba && rgba.length > 0) {
                        // Create scaled image data
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        const imageData = tempCtx.createImageData(width, height);
                        imageData.data.set(rgba);
                        tempCtx.putImageData(imageData, 0, 0);

                        // Draw scaled version
                        ctx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);
                        resolve(canvas.toDataURL('image/png'));
                        return;
                    }
                } catch (rgbaError) {
                    console.warn('Failed to get RGBA data:', rgbaError);
                }

                // Fallback: draw a placeholder
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
        icon = '📄';
        formatText = 'TIFF';
    } else if (image.isSVG) {
        bgColor = '#f3e5f5';
        textColor = '#7b1fa2';
        icon = '🖼️';
        formatText = 'SVG';
    } else {
        bgColor = '#f5f5f5';
        textColor = '#616161';
        icon = '📷';
        formatText = 'IMAGE';
    }

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, bgColor);
    gradient.addColorStop(1, lightenColor(bgColor, 20));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Icon
    ctx.fillStyle = textColor;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, canvas.width / 2, canvas.height / 2 - 20);

    // Format text
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