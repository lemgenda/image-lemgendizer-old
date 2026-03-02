/**
 * @file aiWorkerUtils.ts
 * @description Utilities for determining and managing the AI Worker.
 */
import { AI_SETTINGS, IMAGE_LOAD_TIMEOUT, ERROR_MESSAGES } from '../constants';

import AIWorker from '../workers/ai.worker?worker&inline';

// Singleton worker instance
let aiWorker: Worker | null = null;
let workerLoadPromise: Promise<void> | null = null;

// Type definitions
export interface AIWorkerConfig {
    localLibPath: string;
    localModelPath: string;
    modelType: string;
    useWebGPU: boolean;
}

/**
 * Initializes the AI Worker if not already active
 */
export const initAIWorker = (): Promise<void> => {
    if (workerLoadPromise) return workerLoadPromise;

    workerLoadPromise = new Promise((resolve, reject) => {
        if (aiWorker) {
            resolve();
            return;
        }

        try {
            // Instantiate the worker
            aiWorker = new AIWorker();

            const timeout = setTimeout(() => {
                aiWorker?.terminate();
                aiWorker = null;
                workerLoadPromise = null; // Clear promise on timeout
                reject(new Error('AI Worker initialization timed out (30s)'));
            }, 30000);

            // Set up one-time listener for the load event
            const handleLoadMessage = (e: MessageEvent) => {
                const { type, error } = e.data;
                if (type === 'loaded') {
                    clearTimeout(timeout);
                    aiWorker?.removeEventListener('message', handleLoadMessage);
                    resolve();
                } else if (type === 'error') {
                    clearTimeout(timeout);
                    aiWorker?.removeEventListener('message', handleLoadMessage);
                    aiWorker?.terminate();
                    aiWorker = null;
                    workerLoadPromise = null; // Clear promise on error
                    reject(new Error(error));
                }
            };

            aiWorker.addEventListener('message', handleLoadMessage);

            // Resolve paths relative to Vite's root base to prevent Worker 404s
            const base = import.meta.env.BASE_URL || '/';
            const resolvePath = (p: string) => {
                const clean = p.startsWith('/') ? p.slice(1) : p;
                return base.endsWith('/') ? base + clean : base + '/' + clean;
            };

            // Send configuration to start loading
            const config: AIWorkerConfig = {
                localLibPath: resolvePath(AI_SETTINGS.LOCAL_LIB_PATH),
                localModelPath: resolvePath(AI_SETTINGS.LOCAL_MODEL_PATH),
                modelType: AI_SETTINGS.MODEL_TYPE,
                useWebGPU: true // Default to true, worker handles fallback
            };

            aiWorker.postMessage({ type: 'load', config });

        } catch (err) {
            aiWorker?.terminate();
            aiWorker = null;
            workerLoadPromise = null;
            reject(err);
        }
    });

    return workerLoadPromise;
};

/**
 * Ensures image data is available from various sources
 */
export const ensureImageData = async (imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | Blob | File): Promise<ImageData> => {
    if (imageSource instanceof ImageData) {
        return imageSource;
    }

    if (imageSource instanceof Blob || imageSource instanceof File) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(url);
                reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_TIMEOUT));
            }, IMAGE_LOAD_TIMEOUT);

            img.onload = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
            };

            img.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                reject(new Error(ERROR_MESSAGES.IMAGE_LOAD_FAILED));
            };

            img.src = url;
        });
    }

    // Handle HTMLImageElement or HTMLCanvasElement
    const canvas = document.createElement('canvas');
    canvas.width = (imageSource as any).width || (imageSource as any).naturalWidth;
    canvas.height = (imageSource as any).height || (imageSource as any).naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(imageSource as any, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Detects objects in an image using the AI Worker
 */
export const detectObjectsInWorker = async (
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | Blob | File
): Promise<any[]> => {
    // Ensure worker is ready
    await initAIWorker();

    const imageData = await ensureImageData(imageSource);

    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            reject(new Error('AI Worker not initialized'));
            return;
        }

        try {
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

            const config = {
                localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
                localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
                modelType: AI_SETTINGS.MODEL_TYPE
            };

            aiWorker.addEventListener('message', handleDetectionMessage);
            aiWorker.postMessage({ type: 'detect', imageData, config }, [imageData.data.buffer]);
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Upscales an image using the AI Worker
 */
export const upscaleInWorker = async (
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | Blob | File,
    scale: number,
    onProgress?: (progress: any) => void
): Promise<{ data: any; shape: [number, number]; scale: number; model?: string }> => {
    await initAIWorker();

    const imageData = await ensureImageData(imageSource);

    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            reject(new Error('AI Worker not initialized'));
            return;
        }

        try {

            const handleUpscaleMessage = (e: MessageEvent) => {
                const { type, data, shape, scale: resScale, model, error } = e.data;
                if (type === 'upscale_result') {
                    aiWorker?.removeEventListener('message', handleUpscaleMessage);
                    resolve({ data, shape, scale: resScale, model });
                } else if (type === 'progress') {
                    if (onProgress && data) {
                        onProgress(data);
                    }
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
 * Pre-warms models used for cropping (UltraZoom and YOLO)
 */
export const prewarmCropModels = async (): Promise<void> => {
    await initAIWorker();
    return new Promise((resolve) => {
        const handleWarmupMessage = (e: MessageEvent) => {
            if (e.data.type === 'warmup_complete') {
                aiWorker?.removeEventListener('message', handleWarmupMessage);
                resolve();
            }
        };
        aiWorker?.addEventListener('message', handleWarmupMessage);

        const config = {
            localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
            localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
            models: [
                { scale: 4 }, // Largest first
                { scale: 3 },
                { scale: 2 },
                { modelName: 'yolo', modelType: AI_SETTINGS.MODEL_TYPE } // Last
            ]
        };

        aiWorker?.postMessage({ type: 'warmup', config });

        // Timeout as fallback
        setTimeout(resolve, 30000); // 30s for 4 models
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
        setTimeout(resolve, 10000);
    });
};

export const terminateAIWorker = () => {
    if (aiWorker) {
        aiWorker.postMessage({ type: 'dispose' });
        aiWorker.terminate();
        aiWorker = null;
    }
};

/**
 * Sends a cleanup message to the worker to release GPU memory
 */
export const cleanupWorkerMemory = (): void => {
    if (aiWorker) {
        aiWorker.postMessage({ type: 'cleanup' });
    }
};

/**
 * Restores an image using the AI Worker
 */
export const restoreInWorker = async (
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData,
    modelName: string,
    onProgress?: (progress: any) => void,
    options: any = {}
): Promise<ImageData> => {
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

            const handleRestoreMessage = (e: MessageEvent) => {
                const { type, data, error } = e.data;
                if (type === 'restore_result') {
                    aiWorker?.removeEventListener('message', handleRestoreMessage);
                    resolve(data);
                } else if (type === 'progress') {
                    if (onProgress && data) {
                        onProgress(data);
                    }
                } else if (type === 'error') {
                    aiWorker?.removeEventListener('message', handleRestoreMessage);
                    reject(new Error(error));
                }
            };

            aiWorker.addEventListener('message', handleRestoreMessage);

            const config = {
                localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
                localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
                modelName,
                ...options
            };

            aiWorker.postMessage({ type: 'restore', imageData, config }, [imageData.data.buffer]);
        } catch (err) {
            reject(err);
        }
    });
};
/**
 * Enhances an image using the LemGendary Enhance system in the AI Worker
 */
export const enhanceInWorker = async (
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | Blob | File | ImageBitmap,
    onProgress?: (progress: any) => void,
    options: any = {}
): Promise<{ data: ImageData, nimaScore: number, opsApplied: string[] }> => {
    await initAIWorker();

    // Prepare image data before creating the promise
    let imageData: ImageData;

    if (imageSource instanceof ImageData) {
        imageData = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
        // Load File/Blob into an Image element first
        const img = new Image();
        const url = URL.createObjectURL(imageSource);

        await new Promise<void>((imgResolve, imgReject) => {
            img.onload = () => imgResolve();
            img.onerror = () => imgReject(new Error('Failed to load image'));
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');
        ctx.drawImage(img, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
    } else if (imageSource instanceof HTMLImageElement ||
        imageSource instanceof HTMLCanvasElement ||
        imageSource instanceof ImageBitmap) {
        // Handle valid drawable types
        const canvas = document.createElement('canvas');
        canvas.width = (imageSource as any).width || (imageSource as any).naturalWidth;
        canvas.height = (imageSource as any).height || (imageSource as any).naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');
        ctx.drawImage(imageSource as any, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
        throw new Error('Invalid image source type');
    }

    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            reject(new Error('AI Worker not initialized'));
            return;
        }

        try {
            const handleEnhanceMessage = (e: MessageEvent) => {
                const { type, data, nimaScore, opsApplied, error } = e.data;
                if (type === 'enhance_result') {
                    aiWorker?.removeEventListener('message', handleEnhanceMessage);
                    resolve({ data, nimaScore, opsApplied });
                } else if (type === 'progress') {
                    if (onProgress && data) {
                        onProgress(data);
                    }
                } else if (type === 'error') {
                    aiWorker?.removeEventListener('message', handleEnhanceMessage);
                    reject(new Error(error));
                }
            };

            aiWorker.addEventListener('message', handleEnhanceMessage);

            const config = {
                localLibPath: AI_SETTINGS.LOCAL_LIB_PATH,
                localModelPath: AI_SETTINGS.LOCAL_MODEL_PATH,
                ...options
            };

            aiWorker.postMessage({ type: 'enhance', imageData, config }, [imageData.data.buffer]);
        } catch (err) {
            reject(err);
        }
    });
};
