import {
    MAXIM_MODEL_URLS,
    OPERATION_NAMES
} from '../constants/sharedConstants';
import { loadMaximModel } from '../utils/aiLoaderUtils';
import * as tf from '@tensorflow/tfjs';

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
    onProgress: (progress: number, status: string) => void
) => {
    let modelUrl = '';
    let operationName = '';

    // Determine which operation is requested (Mutually Exclusive)
    if (options.deblur) {
        modelUrl = MAXIM_MODEL_URLS.DEBLUR;
        operationName = OPERATION_NAMES.AI_DEBLURRED;
    } else if (options.dehazeIndoor) {
        modelUrl = MAXIM_MODEL_URLS.DEHAZE_INDOOR;
        operationName = OPERATION_NAMES.AI_DEHAZED;
    } else if (options.dehazeOutdoor) {
        modelUrl = MAXIM_MODEL_URLS.DEHAZE_OUTDOOR;
        operationName = OPERATION_NAMES.AI_DEHAZED;
    } else if (options.denoise) {
        modelUrl = MAXIM_MODEL_URLS.DENOISE;
        operationName = OPERATION_NAMES.AI_DENOISED;
    } else if (options.derain) {
        modelUrl = MAXIM_MODEL_URLS.DERAIN;
        operationName = OPERATION_NAMES.AI_DERAINED;
    } else if (options.lowLight) {
        modelUrl = MAXIM_MODEL_URLS.ENHANCEMENT;
        operationName = OPERATION_NAMES.AI_LOW_LIGHT_ENHANCED;
    } else if (options.retouch) {
        modelUrl = MAXIM_MODEL_URLS.RETOUCHING;
        operationName = OPERATION_NAMES.AI_RETOUCHED;
    } else if (options.detailReconstruction) {
        modelUrl = MAXIM_MODEL_URLS.ENHANCEMENT; // Using Enhancement model for now
        operationName = OPERATION_NAMES.AI_DETAIL_RECONSTRUCTED;
    } else if (options.colorCorrection) {
        // Placeholder for color correction
        console.log('AI Color Correction requested (Model pending)');
        operationName = OPERATION_NAMES.AI_COLOR_CORRECTED;
        return canvas; // Return original canvas for now
    }

    if (!modelUrl) return canvas;

    try {
        onProgress(0.1, `Loading AI ${operationName} Model...`);

        // Load Model
        const model = await loadMaximModel(modelUrl);

        onProgress(0.3, `Applying ${operationName}...`);

        // Prepare Tensor
        const inputTensor = tf.browser.fromPixels(canvas);
        const expandedTensor = inputTensor.expandDims(0);
        const floatTensor = expandedTensor.toFloat().div(255.0); // Normalize to [0, 1]

        // Execute Model
        // MAXIM models typically output a single tensor
        let outputTensor = model.predict(floatTensor);

        if (Array.isArray(outputTensor)) {
            outputTensor = outputTensor[0]; // Handle multi-output if necessary
        }

        // Post-process
        // Denormalize: [0, 1] -> [0, 255] and clip
        const processedTensor = (outputTensor as tf.Tensor)
            .mul(255.0)
            .clipByValue(0, 255)
            .squeeze()
            .toInt();

        onProgress(0.8, 'Finalizing image...');

        // Write to new canvas
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = canvas.width;
        outputCanvas.height = canvas.height;
        await tf.browser.toPixels(processedTensor as tf.Tensor3D, outputCanvas);

        // Cleanup
        inputTensor.dispose();
        expandedTensor.dispose();
        floatTensor.dispose();
        (outputTensor as tf.Tensor).dispose();
        processedTensor.dispose();
        model.dispose(); // Dispose model to free memory? Or keep it cached?
        // For WebGPU longevity we might want to cache, but for now safe dispose.

        return outputCanvas;
    } catch (error) {
        console.error(`AI Quality Improvement failed (${operationName}):`, error);
        throw error;
    }
};
