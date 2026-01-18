import { WATERMARK_POSITIONS, WATERMARK_SIZES } from '../constants';
import { WatermarkOptions } from '../types';

/**
 * @file watermarkProcessor.ts
 * @description Logic for applying text and image watermarks to a canvas.
 */

/**
 * Calculates the bounding box for a watermark based on position and size.
 * @param {number} canvasWidth - Width of the target image
 * @param {number} canvasHeight - Height of the target image
 * @param {number} watermarkWidth - Calculated width of watermark
 * @param {number} watermarkHeight - Calculated height of watermark
 * @param {string} position - Position identifier
 * @returns {{x: number, y: number}} Coordinates for drawing
 */
const calculatePosition = (
    canvasWidth: number,
    canvasHeight: number,
    watermarkWidth: number,
    watermarkHeight: number,
    position: string
): { x: number; y: number } => {
    const padding = 20;
    let x = padding;
    let y = padding;

    switch (position) {
        case WATERMARK_POSITIONS.TOP_LEFT:
            x = padding;
            y = padding;
            break;
        case WATERMARK_POSITIONS.TOP:
            x = (canvasWidth - watermarkWidth) / 2;
            y = padding;
            break;
        case WATERMARK_POSITIONS.TOP_RIGHT:
            x = canvasWidth - watermarkWidth - padding;
            y = padding;
            break;
        case WATERMARK_POSITIONS.LEFT:
            x = padding;
            y = (canvasHeight - watermarkHeight) / 2;
            break;
        case WATERMARK_POSITIONS.CENTER:
            x = (canvasWidth - watermarkWidth) / 2;
            y = (canvasHeight - watermarkHeight) / 2;
            break;
        case WATERMARK_POSITIONS.RIGHT:
            x = canvasWidth - watermarkWidth - padding;
            y = (canvasHeight - watermarkHeight) / 2;
            break;
        case WATERMARK_POSITIONS.BOTTOM_LEFT:
            x = padding;
            y = canvasHeight - watermarkHeight - padding;
            break;
        case WATERMARK_POSITIONS.BOTTOM:
            x = (canvasWidth - watermarkWidth) / 2;
            y = canvasHeight - watermarkHeight - padding;
            break;
        case WATERMARK_POSITIONS.BOTTOM_RIGHT:
        default:
            x = canvasWidth - watermarkWidth - padding;
            y = canvasHeight - watermarkHeight - padding;
            break;
    }

    return { x, y };
};

/**
 * Gets calculations for watermark size based on preset.
 * @param {number} canvasWidth - Target canvas width
 * @param {number} canvasHeight - Target canvas height
 * @param {string} sizePreset - size preset (small, medium, large, etc)
 * @returns {number} Scale factor or proportional dimension
 */
const getWatermarkScale = (sizePreset: string): number => {
    switch (sizePreset) {
        case WATERMARK_SIZES.SMALL: return 0.1;
        case WATERMARK_SIZES.MEDIUM: return 0.2;
        case WATERMARK_SIZES.LARGE: return 0.3;
        case WATERMARK_SIZES.EXTRA_LARGE: return 0.5;
        default: return 0.2;
    }
};

/**
 * Applies a watermark to the provided canvas.
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {WatermarkOptions} options - Watermark settings
 * @returns {Promise<void>}
 */
export const applyWatermark = async (
    canvas: HTMLCanvasElement,
    options: WatermarkOptions
): Promise<void> => {
    if (!options.enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;



    const { type, opacity, position, size, repeat, fontFamily } = options;
    ctx.save();
    ctx.globalAlpha = opacity;

    if (type === 'text' && options.text) {
        // Base font size relative to canvas width
        const baseFontSize = canvas.width * getWatermarkScale(size) * 0.5;
        const finalFontSize = options.fontSize || baseFontSize;
        const font = `${finalFontSize}px ${fontFamily || 'Arial'}`;
        ctx.font = font;
        ctx.fillStyle = options.color || '#ffffff';
        ctx.textBaseline = 'top';

        const metrics = ctx.measureText(options.text);
        const w = metrics.width;
        const h = finalFontSize;

        if (repeat) {
            // Tilting logic
            const spacingX = w * 1.5;
            const spacingY = h * 3;
            ctx.rotate(-45 * Math.PI / 180); // Optional: Rotate for that classic tiled feel

            // Adjust loop ranges because of rotation
            for (let x = -canvas.width; x < canvas.width * 2; x += spacingX) {
                for (let y = -canvas.height; y < canvas.height * 2; y += spacingY) {
                    ctx.fillText(options.text, x, y);
                }
            }
        } else {
            const { x, y } = calculatePosition(canvas.width, canvas.height, w, h, position);
            ctx.fillText(options.text, x, y);
        }
    } else if (type === 'image' && options.image) {
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const i = new Image();
                i.onload = () => {
                    resolve(i);
                };
                i.onerror = () => {
                    reject(new Error('Failed to load watermark image'));
                };

                i.src = options.image as string;
            });

            const scale = getWatermarkScale(size);
            // Maintain aspect ratio, size relative to canvas
            let w = canvas.width * scale;
            let h = (img.height / img.width) * w;

            // If it gets too tall, scale by height instead
            if (h > canvas.height * scale) {
                h = canvas.height * scale;
                w = (img.width / img.height) * h;
            }

            if (repeat) {
                const spacingX = w * 1.5;
                const spacingY = h * 1.5;
                for (let x = 0; x < canvas.width; x += spacingX) {
                    for (let y = 0; y < canvas.height; y += spacingY) {
                        ctx.drawImage(img, x, y, w, h);
                    }
                }
            } else {
                const { x, y } = calculatePosition(canvas.width, canvas.height, w, h, position);
                ctx.drawImage(img, x, y, w, h);
            }
        } catch {
            // Fail silently
        }
    }

    ctx.restore();
};
