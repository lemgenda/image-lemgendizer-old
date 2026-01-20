/**
 * @file aiEnhancementsProcessor.ts
 * @description Processor for AI-powered image enhancements using MAXIM models.
 * Implements tile-based sequential processing with WebGPU.
 */
import { enhanceInWorker } from '../utils/aiWorkerUtils';

// Map tasks to progressive verbs for UI

const TASK_PROGRESS_MAP: Record<string, string> = {
    'denoising': 'Denoising',
    'deblurring': 'Deblurring',
    'deraining': 'Deraining',
    'dehazing-indoor': 'Dehazing',
    'dehazing-outdoor': 'Dehazing',
    'enhancement': 'Enhancing',
    'retouching': 'Retouching'
};

const TILE_SIZE = 192;

/**
 * Enhances an image using one or more MAXIM models with tiling.
 */
export const enhanceImageWithMaxim = async (
    canvas: HTMLCanvasElement,
    tasks: string[],
    onProgress?: (taskName: string, tileIndex: number, totalTiles: number) => void
): Promise<HTMLCanvasElement> => {
    const startTime = performance.now();
    if (!tasks || tasks.length === 0) return canvas;

    const width = canvas.width;
    const height = canvas.height;

    const cols = Math.ceil(width / TILE_SIZE);
    const rows = Math.ceil(height / TILE_SIZE);
    const totalTiles = cols * rows;

    console.log(`[AI Processor] Starting enhancement pipeline: ${tasks.join(', ')}`);
    console.log(`[AI Processor] Image dimensions: ${width}x${height}. Tiling into ${totalTiles} tiles (${cols}x${rows}).`);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) throw new Error("Failed to get output canvas context");

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = TILE_SIZE;
    tileCanvas.height = TILE_SIZE;
    const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
    if (!tileCtx) throw new Error("Failed to get tile canvas context");

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const tileStartTime = performance.now();
            const tileX = c * TILE_SIZE;
            const tileY = r * TILE_SIZE;
            const tileWidth = Math.min(TILE_SIZE, width - tileX);
            const tileHeight = Math.min(TILE_SIZE, height - tileY);
            const tileIndex = r * cols + c;

            // 1. Extract tile
            // Always clear full buffer to ensure clean padding
            tileCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

            // Draw the partial tile into the top-left of the fixed-size buffer
            // The rest will be transparent/empty (zero-padding), which is usually safe for inference
            // though edge artifacts might occur. Reflected padding would be better but more complex.
            tileCtx.drawImage(
                canvas,
                tileX, tileY, tileWidth, tileHeight,
                0, 0, tileWidth, tileHeight
            );

            // ALWAYS send full TILE_SIZE x TILE_SIZE data to worker to avoid shape errors
            let currentTileData = tileCtx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);

            // 2. Apply sequential enhancements
            for (const task of tasks) {
                const taskStartTime = performance.now();
                if (onProgress) {
                    const label = TASK_PROGRESS_MAP[task] || 'Processing';
                    console.log(`[AI Processor] Reporting progress: ${label} Tile ${tileIndex + 1}/${totalTiles}`);
                    onProgress(label, tileIndex + 1, totalTiles);
                }

                console.log(`[AI Processor] Sending tile ${tileIndex + 1} to worker for task '${task}'...`);
                // Note: we are sending the full padded tile
                const result = await enhanceInWorker(currentTileData, task);
                console.log(`[AI Processor] Worker returned result for tile ${tileIndex + 1}`);

                // Convert Float32Array result back to ImageData
                // Model output might be RGB (3 channels) or RGBA (4 channels)
                const shape = result.shape as unknown as number[];
                const channels = shape[2] || (result.data.length / (shape[0] * shape[1]));
                const pixelCount = shape[0] * shape[1];
                const enhancedData = new Uint8ClampedArray(pixelCount * 4); // Always RGBA for Canvas

                for (let i = 0; i < pixelCount; i++) {
                    const srcIdx = i * channels;
                    const destIdx = i * 4;

                    // R
                    enhancedData[destIdx] = Math.max(0, Math.min(255, result.data[srcIdx] * 255));
                    // G
                    enhancedData[destIdx + 1] = Math.max(0, Math.min(255, result.data[srcIdx + 1] * 255));
                    // B
                    enhancedData[destIdx + 2] = Math.max(0, Math.min(255, result.data[srcIdx + 2] * 255));
                    // A (preserve if exists, else fully opaque)
                    if (channels === 4) {
                        enhancedData[destIdx + 3] = Math.max(0, Math.min(255, result.data[srcIdx + 3] * 255));
                    } else {
                        enhancedData[destIdx + 3] = 255;
                    }
                }

                currentTileData = new ImageData(enhancedData, result.shape[1], result.shape[0]);
                const taskDuration = performance.now() - taskStartTime;
                console.log(`[AI Processor] Tile ${tileIndex + 1}/${totalTiles} - Task '${task}' took ${taskDuration.toFixed(2)}ms`);
            }

            // 3. Put result into temporary tile canvas to handle stitching
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = TILE_SIZE; // It's full size coming back
            tempCanvas.height = TILE_SIZE;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.putImageData(currentTileData, 0, 0);
                // 4. Stitch back to output
                // Only draw the valid portion (tileWidth x tileHeight) from the padded result
                outputCtx.drawImage(
                    tempCanvas,
                    0, 0, tileWidth, tileHeight, // Source: valid region
                    tileX, tileY, tileWidth, tileHeight // Dest: original position
                );
            }

            const tileDuration = performance.now() - tileStartTime;
            console.log(`[AI Processor] Tile ${tileIndex + 1}/${totalTiles} COMPLETED (${tileWidth}x${tileHeight}) in ${tileDuration.toFixed(2)}ms`);
        }
    }

    const totalDuration = performance.now() - startTime;
    console.log(`[AI Processor] Enhancement pipeline COMPLETE for image. Total time: ${totalDuration.toFixed(2)}ms`);
    return outputCanvas;
};
