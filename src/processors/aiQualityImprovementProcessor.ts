import {
    MAXIM_MODEL_URLS,
    OPERATION_NAMES
} from '../constants/sharedConstants';
import { loadMaximModel } from '../utils/aiLoaderUtils';
import * as tf from '@tensorflow/tfjs';

// Cache for loaded models to prevent reloading
const modelCache: Map<string, tf.GraphModel> = new Map();

export const clearModelCacheForTesting = () => {
    modelCache.clear();
};

// Tiling configuration
const TILE_SIZE = 1024; // WebGPU can handle larger tiles, but 1024 is safe for most GPUs
const TILE_OVERLAP = 32; // Overlap to prevent seams

/**
 * Processes an image using the appropriate AI Quality Improvement model.
 *
 * @param {HTMLCanvasElement} canvas - The source canvas
 * @param {Object} options - AI Quality options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<HTMLCanvasElement>} - Enhanced canvas
 */
export const processAiQualityImprovement = async (
    canvas: HTMLCanvasElement,
    options: any,
    onProgress: (progress: number, status: string) => void,
    t: (key: string, params?: any) => string
) => {
    // [Antigravity] Support chained execution of multiple models
    // We define the order of operations to ensure consistent results
    const executionOrder = [
        { key: 'derain', url: MAXIM_MODEL_URLS.DERAIN, name: OPERATION_NAMES.AI_DERAINED },
        { key: 'deblur', url: MAXIM_MODEL_URLS.DEBLUR, name: OPERATION_NAMES.AI_DEBLURRED },
        { key: 'denoise', url: MAXIM_MODEL_URLS.DENOISE, name: OPERATION_NAMES.AI_DENOISED },
        { key: 'dehazeIndoor', url: MAXIM_MODEL_URLS.DEHAZE_INDOOR, name: OPERATION_NAMES.AI_DEHAZED },
        { key: 'dehazeOutdoor', url: MAXIM_MODEL_URLS.DEHAZE_OUTDOOR, name: OPERATION_NAMES.AI_DEHAZED },
        { key: 'lowLight', url: MAXIM_MODEL_URLS.ENHANCEMENT, name: OPERATION_NAMES.AI_LOW_LIGHT_ENHANCED },
        { key: 'retouch', url: MAXIM_MODEL_URLS.RETOUCHING, name: OPERATION_NAMES.AI_RETOUCHED },
        { key: 'detailReconstruction', url: MAXIM_MODEL_URLS.ENHANCEMENT, name: OPERATION_NAMES.AI_DETAIL_RECONSTRUCTED },
    ];

    let currentCanvas = canvas;
    let processedCount = 0;
    const activeOperations = executionOrder.filter(op => options[op.key]);

    if (activeOperations.length === 0 && !options.colorCorrection) return canvas;

    for (const op of activeOperations) {
        processedCount++;
        const progressBase = (processedCount - 1) / activeOperations.length;
        const progressChunk = 1 / activeOperations.length;

        try {
            // 1. Load Model (with caching)
            let model = modelCache.get(op.url);
            if (!model) {
                onProgress(progressBase + 0.1 * progressChunk, t('loading.aiStatus.loadingModel', { name: op.name }));
                model = await loadMaximModel(op.url);
                modelCache.set(op.url, model);
            } else {
                 onProgress(progressBase + 0.1 * progressChunk, t('loading.aiStatus.usingCache', { name: op.name }));
            }

            onProgress(progressBase + 0.3 * progressChunk, t('loading.aiStatus.applying', { name: op.name }));

            // 2. Prepare Input
            // Note: fromPixels can be expensive, but we need to move between CPU (Canvas) and GPU (Tensor)
            // for each step if we want to share the generic tiling logic easily.
            // Optimization: We could keep it in tensor land, but that requires refactoring tiling to take tensor input/output fully.
            // For now, robust Canvas-based chaining is safer.
            const inputTensor = tf.browser.fromPixels(currentCanvas);
            const [height, width] = inputTensor.shape;

            // 3. Process Image
            let processedTensor: tf.Tensor3D;

            if (width > TILE_SIZE || height > TILE_SIZE) {
                onProgress(progressBase + 0.4 * progressChunk, t('loading.aiStatus.tiling', { width, height }));
                processedTensor = await processWithTiling(model!, inputTensor as tf.Tensor3D, TILE_SIZE, TILE_OVERLAP, (p, s) => {
                     onProgress(progressBase + (0.4 + p * 0.5) * progressChunk, s);
                }, t);
            } else {
                 processedTensor = await tf.tidy(() => {
                    const expanded = inputTensor.expandDims(0);
                    const floatInput = expanded.toFloat().div(255.0);

                    let output = model!.predict(floatInput);
                    if (Array.isArray(output)) output = output[0];

                    return (output as tf.Tensor)
                        .mul(255.0)
                        .clipByValue(0, 255)
                        .squeeze()
                        .toInt() as tf.Tensor3D;
                });
            }

            inputTensor.dispose();

            // 4. Write to Intermediate Output
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = width;
            outputCanvas.height = height;
            await tf.browser.toPixels(processedTensor, outputCanvas);
            processedTensor.dispose();

            currentCanvas = outputCanvas; // Chain update

        } catch (error) {
            throw error;
        }
    }

    if (options.colorCorrection) {
        onProgress(0.95, t('loading.aiStatus.applying', { name: OPERATION_NAMES.AI_COLOR_CORRECTED }));

        try {
            const inputTensor = tf.browser.fromPixels(currentCanvas);

            const correctedTensor = tf.tidy(() => {
                 const rgb = tf.split(inputTensor, 3, 2);

                 const normalizeChannel = (channel: tf.Tensor) => {
                     const min = channel.min();
                     const max = channel.max();
                     const range = max.sub(min);

                     // If image is flat (range < 1), return original channel to avoid turning it black
                     const isFlat = range.less(tf.scalar(1.0));

                     // We perform normalization regardless, but valid only if not flat
                     // division by small number is avoided by adding epsilon anyway, but logic is cleaner with where
                     const normalized = channel.sub(min).div(range.add(tf.scalar(0.0001))).mul(255.0);

                     return tf.where(isFlat, channel, normalized);
                 };

                 const r = normalizeChannel(rgb[0]);
                 const g = normalizeChannel(rgb[1]);
                 const b = normalizeChannel(rgb[2]);

                 return tf.stack([r, g, b], 2)
                    .clipByValue(0, 255)
                    .toInt() as tf.Tensor3D;
            });

            inputTensor.dispose();

            const [h, w] = correctedTensor.shape;
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = w;
            outputCanvas.height = h;
            await tf.browser.toPixels(correctedTensor, outputCanvas);
            correctedTensor.dispose();

            currentCanvas = outputCanvas;
        } catch {
            // Ignore color correction errors to prevent pipeline failure
        }
    }

    return currentCanvas;
};

/**
 * Processes an image tensor using tiling to handle high resolutions.
 */
async function processWithTiling(
    model: tf.GraphModel,
    inputTensor: tf.Tensor3D,
    tileSize: number,
    overlap: number,
    onProgress: (progress: number, status: string) => void,
    t: (key: string, params?: any) => string
): Promise<tf.Tensor3D> {
    const [height, width] = inputTensor.shape;

    // We'll reconstruct the image on the CPU using a canvas because stitching tensors
    // in WebGL/WebGPU with variable overlap requires complex shader logic.
    // For simplicity and reliability, we process tiles on GPU, download them, and stitch on CPU.
    // This is a trade-off: simpler code vs slower stitching.
    // Given the processing time is dominated by the model inference, CPU stitching is acceptable.

    // HOWEVER, for maximum quality, we should stay in Tensor land if possible.
    // Let's use a simpler approach: Process tiles and write mostly non-overlapping parts to a canvas context.

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })!;

    // Create a temporary canvas for the full input to grab tile data easily
    // We already have the tensor, let's dump it to a canvas once to easily slice from it
    const tempInputCanvas = document.createElement('canvas');
    tempInputCanvas.width = width;
    tempInputCanvas.height = height;
    await tf.browser.toPixels(inputTensor, tempInputCanvas);

    // Calculate grid
    const effectiveTileSize = tileSize - 2 * overlap;
    const tilesX = Math.ceil((width - overlap * 2) / effectiveTileSize);
    const tilesY = Math.ceil((height - overlap * 2) / effectiveTileSize);
    const totalTiles = tilesX * tilesY;
    let processedTiles = 0;

    for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
             // Calculate coordinates (including overlap)
             let startX = x * effectiveTileSize;
             let startY = y * effectiveTileSize;

             // Adjust for first/last tiles to ensure we cover everything properly with overlap
             // Actually, a simpler sliding window approach:
             // Center of the tile is target, we grab surrounding with overlap.

             // Let's explicitly define window:
             let extractX = max(0, startX);
             let extractY = max(0, startY);

             // Ensure we don't go out of bounds
             let extractW = min(width - extractX, tileSize);
             let extractH = min(height - extractY, tileSize);

             // If we are at the end, we might need to shift back to get a full tile for better context
             if (extractW < tileSize && extractX > 0) {
                 extractX = max(0, width - tileSize);
                 extractW = min(width - extractX, tileSize);
             }
             if (extractH < tileSize && extractY > 0) {
                 extractY = max(0, height - tileSize);
                 extractH = min(height - extractY, tileSize);
             }

             // Get image data for this tile
             const tileData = tempInputCanvas.getContext('2d')!.getImageData(extractX, extractY, extractW, extractH);

             // Process Tile
             const tileTensor = tf.tidy(() => {
                 return tf.browser.fromPixels(tileData)
                    .expandDims(0)
                    .toFloat()
                    .div(255.0);
             });

             const tileOutput = await model.predict(tileTensor) as tf.Tensor | tf.Tensor[];
             const resultTensor = Array.isArray(tileOutput) ? tileOutput[0] : tileOutput;

             const processedTile = tf.tidy(() => {
                 return resultTensor
                    .mul(255.0)
                    .clipByValue(0, 255)
                    .squeeze()
                    .toInt() as tf.Tensor3D;
             });

             // Cleanup inputs
             tileTensor.dispose();
             if (Array.isArray(tileOutput)) tileOutput.forEach(t => t.dispose());
             else (tileOutput as tf.Tensor).dispose();

             // Draw back to canvas
             // We need to handle the overlap blending.
             // Simpler approach: Draw the center part of the tile, discarding the overlap edges.
             // Except for the borders of the image.

             const tileCanvas = document.createElement('canvas');
             tileCanvas.width = extractW;
             tileCanvas.height = extractH;
             await tf.browser.toPixels(processedTile, tileCanvas);
             processedTile.dispose();

             // Determine logical area to write (removing overlap)
             // Start write:
             let writeX = extractX;
             let writeY = extractY;
             let writeW = extractW;
             let writeH = extractH;

             // Source read offsets
             let srcX = 0;
             let srcY = 0;

             // If not first col, cut overlap from left
             if (extractX > 0) {
                 writeX += overlap;
                 writeW -= overlap;
                 srcX += overlap;
             }
             // If not last col, cut overlap from right
             if (extractX + extractW < width) {
                 writeW -= overlap;
             }

             // If not first row, cut overlap from top
             if (extractY > 0) {
                 writeY += overlap;
                 writeH -= overlap;
                 srcY += overlap;
             }
             // If not last row, cut overlap from bottom
             if (extractY + extractH < height) {
                 writeH -= overlap;
             }

             ctx.drawImage(tileCanvas, srcX, srcY, writeW, writeH, writeX, writeY, writeW, writeH);

             processedTiles++;
             onProgress(0.4 + (processedTiles / totalTiles) * 0.4, t('loading.aiStatus.processingTile', { current: processedTiles, total: totalTiles }));
        }
    }

    // Return result as Tensor for consistency with non-tiled path
    return tf.browser.fromPixels(outputCanvas);
}

function max(a: number, b: number) { return a > b ? a : b; }
function min(a: number, b: number) { return a < b ? a : b; }
