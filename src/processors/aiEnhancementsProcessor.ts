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
    const tileCtx = tileCanvas.getContext('2d');
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
            tileCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
            tileCtx.drawImage(
                canvas,
                tileX, tileY, tileWidth, tileHeight,
                0, 0, tileWidth, tileHeight
            );

            let currentTileData = tileCtx.getImageData(0, 0, tileWidth, tileHeight);

            // 2. Apply sequential enhancements
            for (const task of tasks) {
                const taskStartTime = performance.now();
                if (onProgress) {
                    const label = TASK_PROGRESS_MAP[task] || 'Processing';
                    onProgress(label, tileIndex + 1, totalTiles);
                }

                const result = await enhanceInWorker(currentTileData, task);

                // Convert Float32Array result back to ImageData
                const enhancedData = new Uint8ClampedArray(result.data.length);
                for (let i = 0; i < result.data.length; i++) {
                    enhancedData[i] = Math.max(0, Math.min(255, result.data[i] * 255));
                }

                currentTileData = new ImageData(enhancedData, result.shape[1], result.shape[0]);
                const taskDuration = performance.now() - taskStartTime;
                console.log(`[AI Processor] Tile ${tileIndex + 1}/${totalTiles} - Task '${task}' took ${taskDuration.toFixed(2)}ms`);
            }

            // 3. Put result into temporary tile canvas to handle stitching
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = tileWidth;
            tempCanvas.height = tileHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.putImageData(currentTileData, 0, 0);
                // 4. Stitch back to output
                outputCtx.drawImage(tempCanvas, tileX, tileY);
            }

            const tileDuration = performance.now() - tileStartTime;
            console.log(`[AI Processor] Tile ${tileIndex + 1}/${totalTiles} completed in ${tileDuration.toFixed(2)}ms`);
        }
    }

    const totalDuration = performance.now() - startTime;
    console.log(`[AI Processor] Enhancement pipeline COMPLETE for image. Total time: ${totalDuration.toFixed(2)}ms`);
    return outputCanvas;
};
