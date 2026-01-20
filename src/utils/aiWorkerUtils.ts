/**
 * @file aiWorkerUtils.ts
 * @description Utilities for determining and managing the AI Worker.
 */
import { AI_SETTINGS } from '../constants';

// Singleton worker instance
let aiWorker: Worker | null = null;
let workerLoadPromise: Promise<void> | null = null;

// Type definitions
export interface AIWorkerConfig {
    localLibPath: string;
    localModelPath: string;
    modelType: string;
    useWebGPU: boolean;
    warmup?: boolean;
    preloadMaxim?: boolean;
}

export type AIModelStatus = 'none' | 'loading' | 'warming' | 'ready' | 'error';

let statusCallback: ((model: string, status: AIModelStatus) => void) | null = null;

/**
 * Registers a callback for AI model status updates
 */
export const setAIStatusListener = (callback: (model: string, status: AIModelStatus) => void) => {
    statusCallback = callback;
};

let isWorkerFullyConfigured = false;

/**
 * Initializes the AI Worker if not already active
 */
export const initAIWorker = (configOverrides?: Partial<AIWorkerConfig>): Promise<void> => {
    // If we have a promise and no new overrides that require a re-config, return existing promise
    if (workerLoadPromise && (!configOverrides || isWorkerFullyConfigured)) {
        return workerLoadPromise;
    }

    // If worker exists but we have new and important overrides (like preloads)
    if (aiWorker && configOverrides && (configOverrides.preloadMaxim || configOverrides.warmup)) {
        const config: AIWorkerConfig = {
            localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
            localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
            modelType: AI_SETTINGS.MODEL_TYPE,
            useWebGPU: true,
            ...configOverrides
        };
        aiWorker.postMessage({ type: 'load', config });
        isWorkerFullyConfigured = true;

        // If we already have a promise, we don't want to create a new one,
        // just update the worker state.
        if (workerLoadPromise) return workerLoadPromise;
    }

    workerLoadPromise = new Promise((resolve, reject) => {
        if (aiWorker && isWorkerFullyConfigured) {
            resolve();
            return;
        }

        try {
            if (!aiWorker) {
                // Instantiate the worker
                aiWorker = new Worker(new URL('../workers/ai.worker.ts', import.meta.url), {
                    type: 'classic' // Use classic to allow importScripts
                });
            }

            // Set up listener for all messages
            const handleMessage = (e: MessageEvent) => {
                const { type, model, status, error } = e.data;

                if (type === 'loaded') {
                    resolve();
                } else if (type === 'status' && statusCallback) {
                    statusCallback(model, status);
                } else if (type === 'error' && !workerLoadPromise) {
                    // Only reject if we haven't resolved yet
                } else if (type === 'error') {
                    aiWorker?.removeEventListener('message', handleMessage);
                    reject(new Error(error));
                }
            };

            aiWorker.addEventListener('message', handleMessage);

            // Send configuration to start loading
            const config: AIWorkerConfig = {
                localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
                localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
                modelType: AI_SETTINGS.MODEL_TYPE,
                useWebGPU: true,
                ...configOverrides
            };

            if (configOverrides?.preloadMaxim || configOverrides?.warmup) {
                isWorkerFullyConfigured = true;
            }

            aiWorker.postMessage({ type: 'load', config });

        } catch (err) {
            workerLoadPromise = null;
            reject(err);
        }
    });

    return workerLoadPromise;
};

/**
 * Detects objects in an image using the AI Worker
 */
export const detectObjectsInWorker = async (
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData
): Promise<any[]> => {
    // Ensure worker is ready
    await initAIWorker();

    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            reject(new Error('AI Worker not initialized'));
            return;
        }

        try {
            let imageData: ImageData;
            if (imageSource instanceof ImageData) {
                imageData = imageSource;
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = imageSource.width;
                canvas.height = imageSource.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Failed to get canvas context');
                ctx.drawImage(imageSource, 0, 0);
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }

            const handleDetectionMessage = (e: MessageEvent) => {
                const { type, data, error } = e.data;
                if (type === 'result') {
                    aiWorker?.removeEventListener('message', handleDetectionMessage);
                    resolve(data);
                } else if (type === 'error') {
                    aiWorker?.removeEventListener('message', handleDetectionMessage);
                    reject(new Error(error));
                }
            };

            aiWorker.addEventListener('message', handleDetectionMessage);
            aiWorker.postMessage({ type: 'detect', imageData }, [imageData.data.buffer]);
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Enhances an image using MAXIM in the worker
 */
export const enhanceInWorker = async (
    imageData: ImageData,
    task: string
): Promise<{ data: Float32Array; shape: [number, number]; task: string }> => {
    await initAIWorker();

    return new Promise((resolve, reject) => {
        if (!aiWorker) return reject(new Error('AI Worker not initialized'));

        const handleEnhanceMessage = (e: MessageEvent) => {
            const { type, data, shape, task: resTask, error } = e.data;
            if (type === 'upscale_result') {
                console.log(`[AIWorkerUtils] Received upscale_result for task: ${resTask} (requested: ${task})`);
            }
            if (type === 'upscale_result' && resTask === task) {
                aiWorker?.removeEventListener('message', handleEnhanceMessage);
                resolve({ data, shape, task: resTask });
            } else if (type === 'error') {
                console.error(`[AIWorkerUtils] Received error from worker: ${error}`);
                aiWorker?.removeEventListener('message', handleEnhanceMessage);
                reject(new Error(error));
            }
        };

        aiWorker.addEventListener('message', handleEnhanceMessage);
        console.log(`[AIWorkerUtils] Posting 'enhance' message to worker for task: ${task}`);
        aiWorker.postMessage({
            type: 'enhance',
            imageData,
            task,
            config: {
                localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
                localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
            }
        }, [imageData.data.buffer]);
    });
};

/**
 * Upscales an image using the AI Worker
 */
export const upscaleInWorker = async (
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData,
    scale: number
): Promise<{ data: Float32Array; shape: [number, number]; scale: number }> => {
    await initAIWorker();

    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            reject(new Error('AI Worker not initialized'));
            return;
        }

        try {
            let imageData: ImageData;
            if (imageSource instanceof ImageData) {
                imageData = imageSource;
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = imageSource.width;
                canvas.height = imageSource.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Failed to get canvas context');
                ctx.drawImage(imageSource, 0, 0);
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }

            const handleUpscaleMessage = (e: MessageEvent) => {
                const { type, data, shape, scale: resScale, error } = e.data;
                if (type === 'upscale_result' && resScale === scale && !e.data.task) {
                    aiWorker?.removeEventListener('message', handleUpscaleMessage);
                    resolve({ data, shape, scale: resScale });
                } else if (type === 'error') {
                    aiWorker?.removeEventListener('message', handleUpscaleMessage);
                    reject(new Error(error));
                }
            };

            aiWorker.addEventListener('message', handleUpscaleMessage);

            const config = {
                localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
                localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
                scale
            };

            aiWorker.postMessage({ type: 'upscale', imageData, config }, [imageData.data.buffer]);
        } catch (err) {
            reject(err);
        }
    });
};



/**
 * Preloads a MAXIM model in the worker
 */
export const preloadMaximInWorker = async (task: string): Promise<void> => {
    await initAIWorker();
    aiWorker?.postMessage({
        type: 'preload',
        config: {
            localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
            localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
            task
        }
    });
};

/**
 * Preloads an upscaler model in the worker
 */
export const preloadUpscalerInWorker = async (scale: number): Promise<void> => {
    await initAIWorker();
    aiWorker?.postMessage({
        type: 'preload',
        config: {
            localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
            localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
            scale
        }
    });
};

/**
 * Warms up all AI models in the worker
 */
export const warmupAIModels = async (): Promise<void> => {
    await initAIWorker();
    return new Promise((resolve) => {
        const handleWarmupMessage = (e: MessageEvent) => {
            if (e.data.type === 'warmup_complete') {
                aiWorker?.removeEventListener('message', handleWarmupMessage);
                resolve();
            }
        };
        aiWorker?.addEventListener('message', handleWarmupMessage);
        aiWorker?.postMessage({ type: 'warmup' });

        // Timeout as fallback for warmup
        setTimeout(resolve, 15000);
    });
};

/**
 * Terminates the AI Worker
 */
export const terminateAIWorker = () => {
    if (aiWorker) {
        aiWorker.postMessage({ type: 'dispose' });
        aiWorker.terminate();
        aiWorker = null;
        workerLoadPromise = null;
    }
};
