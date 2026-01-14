/**
 * @file memoryUtils.ts
 * @description Utilities for monitoring and managing GPU and systemic memory.
 */
import {
    MEMORY_CLEANUP_INTERVAL,
    UPSCALER_IDLE_TIMEOUT,
    AI_SETTINGS
} from '../constants';
import {
    initAIWorker,
    detectObjectsInWorker,
    terminateAIWorker
} from './aiWorkerUtils';

// Declare global types for CDN-loaded libraries
declare global {
    interface Window {
        tf: any;
        cocoSsd: any;
    }
}

let aiModel: any = null;
let upscalerInstances: Record<string, any> = {};
let upscalerUsageCount: Record<string, number> = {};
let upscalerLastUsed: Record<string, number> = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval: NodeJS.Timeout | null = null;
let textureManagerFailures = 0;
let cleanupInProgress = false;
let aiModelLoading = false;


/**
 * Initializes GPU memory monitoring system.
 */
export const initializeGPUMemoryMonitor = (): void => {
    if (memoryCleanupInterval) clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = setInterval(monitorGPUMemory, MEMORY_CLEANUP_INTERVAL);
};

/**
 * Monitors GPU memory usage and triggers cleanup when necessary.
 */
const monitorGPUMemory = (): void => {
    if (cleanupInProgress) return;

    if (window.tf && window.tf.memory()) {
        const memoryInfo = window.tf.memory();
        currentMemoryUsage = (memoryInfo.numBytesInGPU || 0) / (1024 * 1024);

        const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
        if (currentMemoryUsage > 3000 && !upscalersInUse) {
            safeCleanupGPUMemory();
        }
    }
};

/**
 * Safely cleans up GPU memory without disposing models that are in use.
 */
export const safeCleanupGPUMemory = (): void => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        if (window.tf) {
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
            if (!upscalersInUse) {
                const now = Date.now();
                Object.keys(upscalerInstances).forEach(key => {
                    if (upscalerUsageCount[key] === 0 &&
                        (!upscalerLastUsed[key] || (now - upscalerLastUsed[key] > UPSCALER_IDLE_TIMEOUT))) {
                        const upscaler = upscalerInstances[key];
                        if (upscaler && upscaler.dispose) {
                            try { upscaler.dispose(); } catch { /* ignored */ }
                        }
                        delete upscalerInstances[key];
                        delete upscalerUsageCount[key];
                        delete upscalerLastUsed[key];
                    }
                });
                window.tf.disposeVariables();
                window.tf.engine().startScope();
                window.tf.engine().endScope();
            }
        }
        currentMemoryUsage = 0;
    } catch {
        // Ignore cleanup errors
    } finally {
        cleanupInProgress = false;
    }
};

/**
 * Aggressively cleans up all GPU memory resources.
 */
export const cleanupGPUMemory = (): void => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        if (window.tf) {
            const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
            if (upscalersInUse) {
                cleanupInProgress = false;
                return;
            }

            if (aiModel && aiModel.dispose) {
                aiModel.dispose();
                aiModel = null;
            }

            Object.keys(upscalerInstances).forEach(key => {
                const upscaler = upscalerInstances[key];
                if (upscaler && upscaler.dispose) {
                    try { upscaler.dispose(); } catch { /* ignored */ }
                }
            });

            upscalerInstances = {};
            upscalerUsageCount = {};
            upscalerLastUsed = {};

            window.tf.disposeVariables();
            window.tf.engine().startScope();
            window.tf.engine().endScope();

            if (window.tf.ENV) window.tf.ENV.reset();
        }

        currentMemoryUsage = 0;
        textureManagerFailures = 0;
        aiModelLoading = false;
    } catch {
        // Ignore cleanup errors
    } finally {
        cleanupInProgress = false;
    }
};

/**
 * Loads AI model for object detection
 * @returns {Promise<Object>} AI model instance
 */
/**
 * Loads AI model (initializes worker)
 * @returns {Promise<Object>} Proxy object for AI model compatible with existing code
 */
export const loadAIModel = async (): Promise<any> => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        // Initialize the worker
        await initAIWorker();

        // Create a proxy object that mimics the coco-ssd model interface
        // This allows existing code in cropProcessor to work without major changes
        aiModel = {
            detect: async (imageElement: HTMLImageElement | HTMLCanvasElement | ImageData) => {
                return await detectObjectsInWorker(imageElement);
            },
            modelType: AI_SETTINGS.MODEL_TYPE,
            dispose: () => {
                terminateAIWorker();
                aiModel = null;
            }
        };

        aiModelLoading = false;
        return aiModel;
    } catch (err) {
        console.warn('Failed to load AI in worker, falling back to simple model', err);
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        return aiModel;
    }
};

// Removed local loading helpers as they are now handled in the worker


/**
 * Creates a simple fallback AI model
 * @returns {Object} Simple AI model
 */
const createSimpleAIModel = () => {
    return {
        detect: async (imgElement: HTMLImageElement | HTMLCanvasElement) => {
            const width = imgElement.width || 0;
            const height = imgElement.height || 0;

            return [{
                bbox: [width * 0.25, height * 0.25, width * 0.5, height * 0.5],
                class: 'person',
                score: 0.8
            }];
        },
        modelType: 'fallback'
    };
};

/**
 * Cleans up all resources
 */
export const cleanupAllResources = (): void => {
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }

    cleanupGPUMemory();

    if (aiModel && aiModel.dispose) {
        aiModel.dispose();
        aiModel = null;
    }

    textureManagerFailures = 0;
    aiModelLoading = false;
};

/**
 * Gets current memory usage
 * @returns {number} Current memory usage in MB
 */
export const getCurrentMemoryUsage = (): number => {
    return currentMemoryUsage;
};

/**
 * Gets texture manager failure count
 * @returns {number} Texture manager failure count
 */
export const getTextureManagerFailures = (): number => {
    return textureManagerFailures;
};

/**
 * Cleans up blob URLs from image objects
 * @param {Array<Object>} imageObjects - Image objects
 */
export const cleanupBlobUrls = (imageObjects: any[]): void => {
    if (!imageObjects || !Array.isArray(imageObjects)) return;

    imageObjects.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
                image.url = null;
            } catch {
                // Ignore errors
            }
        }

        if (image.previewData && image.previewData.url) {
            try {
                URL.revokeObjectURL(image.previewData.url);
                image.previewData.url = null;
            } catch {
                // Ignore errors
            }
        }

        if (image.previewData && image.previewData.canvas) {
            try {
                const ctx = image.previewData.canvas.getContext('2d');
                ctx.clearRect(0, 0, image.previewData.canvas.width, image.previewData.canvas.height);
            } catch {
                // Ignore errors
            }
        }
    });
};

// Add event listeners for memory management
if (typeof window !== 'undefined') {
    window.addEventListener('load', initializeGPUMemoryMonitor);
    window.addEventListener('beforeunload', cleanupAllResources);
    window.addEventListener('pagehide', cleanupAllResources);
}
