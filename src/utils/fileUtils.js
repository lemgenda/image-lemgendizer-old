import {
    MAX_FILENAME_LENGTH,
    INVALID_FILENAME_CHARS,
    MIME_TYPE_MAP
} from '../constants/sharedConstants.js';

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
    return filename.replace(INVALID_FILENAME_CHARS, '_');
};

/**
 * Gets MIME type from file extension
 * @param {string} extension - File extension
 * @returns {string} MIME type
 */
export const getMimeType = (extension) => {
    return MIME_TYPE_MAP[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Checks if filename is too long
 * @param {string} filename - Filename to check
 * @returns {boolean} True if filename is too long
 */
export const isFilenameTooLong = (filename) => {
    return filename.length > MAX_FILENAME_LENGTH;
};

/**
 * Checks if browser supports AVIF encoding
 * @async
 * @returns {Promise<boolean>} True if AVIF is supported
 */
export const checkAVIFSupport = async () => {
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
 * Create a placeholder file for TIFF when conversion fails
 */
export const createTIFFPlaceholderFile = async (tiffFile, targetWidth = null, targetHeight = null) => {
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