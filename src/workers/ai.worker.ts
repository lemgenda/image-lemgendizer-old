/**
 * @file ai.worker.ts
 * @description Web Worker for handling AI model operations (off the main thread)
 */

interface AIWorkerMessage {
    type: 'load' | 'detect' | 'dispose';
    imageData?: ImageData;
    config?: any;
}

interface AIWorkerResponse {
    type: 'loaded' | 'result' | 'error';
    data?: any;
    error?: string;
    isLoaded?: boolean;
}

// Global variables for the worker scope
let aiModel: any = null;
let isModelLoading = false;

// Declare importScripts for worker environment
declare function importScripts(...urls: string[]): void;

// Initialize worker context
const ctx: Worker = self as any;

// Suppress benign warnings that are false positives in a worker context
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
    const msg = args.join(' ');
    if (msg.includes('tf.nonMaxSuppression') ||
        msg.includes('synchronously reading data') ||
        msg.includes('This model was compiled with a higher version')) {
        return;
    }
    originalWarn.apply(console, args);
};

/**
 * Loads the AI Model dependencies and initializes the model
 */
const loadModel = async (config: any) => {
    if (aiModel) {
        ctx.postMessage({ type: 'loaded', isLoaded: true });
        return;
    }

    if (isModelLoading) return;
    isModelLoading = true;

    try {
        // Import scripts from the public/lib folder (copied by copy-ai-assets.cjs)
        // Note: in a worker, we must use importScripts for these UMD/Window-style libs if not bundling them
        // However, since we are in a module worker environment (Vite), importing absolute paths might fail
        // depending on the worker type. But usually these are copied to public/lib, so we can access them via global scope.
        //
        // We'll trust the user's environment set up. If this is a module worker, importScripts might not be available,
        // but typical Vite workers support standard ESM.
        //
        // BUT the libraries we are loading (tf.min.js, coco-ssd.min.js) are UMD/IIFE that attach to 'self'.
        // So 'importScripts' is the way to go for the non-module versions we copied.

        // Using simple formatting for paths assuming usage from root
        // Worker location might be blob or separate file.
        // Let's assume standard worker support.

        // We need to define the paths relative to the worker scope or absolute
        const libPath = config.localLibPath || '/lib/';
        const modelPath = config.localModelPath || '/models/';
        const modelType = config.modelType || 'lite_mobilenet_v2';

        // Load TFJS
        if (!(self as any).tf) {
            importScripts(`${libPath}tf.min.js`);

            // Load WebGPU Backend
            // Check if we should try WebGPU
            if (config.useWebGPU !== false) {
                try {
                    if (navigator.gpu) {
                        importScripts(`${libPath}tf-backend-webgpu.min.js`);
                        await (self as any).tf.setBackend('webgpu');
                        await (self as any).tf.ready();
                    } else {
                        // Fallback to WebGL
                        await (self as any).tf.setBackend('webgl');
                    }
                } catch (e) {
                    console.warn('WebGPU load failed in worker, falling back', e);
                    // Fallback
                }
            }
        }

        // Load Coco-SSD
        if (!(self as any).cocoSsd) {
            importScripts(`${libPath}coco-ssd.min.js`);
        }

        if ((self as any).cocoSsd) {
            // Load model
            aiModel = await (self as any).cocoSsd.load({
                base: modelType,
                modelUrl: `${modelPath}coco-ssd/${modelType}/model.json`
            });

            if (aiModel) {
                // Warmup
                const zeros = (self as any).tf.zeros([10, 10, 3], 'int32');
                await aiModel.detect(zeros);
                zeros.dispose();
            }
        } else {
            throw new Error('Failed to load coco-ssd library');
        }

        isModelLoading = false;
        ctx.postMessage({ type: 'loaded', isLoaded: true });

    } catch (error: any) {
        isModelLoading = false;
        ctx.postMessage({
            type: 'error',
            error: `Worker Load Error: ${error.message || error}`
        });
    }
};

/**
 * Run detection on the provided ImageData
 */
const detectObjects = async (imageData: ImageData) => {
    if (!aiModel) {
        ctx.postMessage({ type: 'error', error: 'AI Model not loaded' });
        return;
    }

    try {
        const predictions = await aiModel.detect(imageData);
        ctx.postMessage({ type: 'result', data: predictions });
    } catch (error: any) {
        ctx.postMessage({
            type: 'error',
            error: `Worker Detection Error: ${error.message || error}`
        });
    }
};

/**
 * Clean up resources
 */
const disposeModel = () => {
    if (aiModel && aiModel.dispose) {
        aiModel.dispose();
    }
    aiModel = null;
    isModelLoading = false;

    if ((self as any).tf) {
        (self as any).tf.disposeVariables();
    }
};

// Message Handler
ctx.onmessage = async (e: MessageEvent<AIWorkerMessage>) => {
    const { type, imageData, config } = e.data;

    switch (type) {
        case 'load':
            await loadModel(config);
            break;
        case 'detect':
            if (imageData) {
                await detectObjects(imageData);
            } else {
                ctx.postMessage({ type: 'error', error: 'No image data provided for detection' });
            }
            break;
        case 'dispose':
            disposeModel();
            break;
    }
};
