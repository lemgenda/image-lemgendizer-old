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
    terminateAIWorker,
    cleanupWorkerMemory
} from './aiWorkerUtils';


let aiModel: any = null;
let upscalerInstances: Record<string, any> = {};
let upscalerUsageCount: Record<string, number> = {};
let upscalerLastUsed: Record<string, number> = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval: NodeJS.Timeout | null = null;
let textureManagerFailures = 0;
let cleanupInProgress = false;
let aiModelLoading = false;

// Global tracking for worker-based upscalers
const activeUpscalers = new Set<string>();

/**
 * Registers an active upscaler instance
 * @param {string} id - Upscaler ID
 */
export const registerUpscaler = (id: string): void => {
    activeUpscalers.add(id);
};

/**
 * Unregisters an active upscaler instance
 * @param {string} id - Upscaler ID
 */
export const unregisterUpscaler = (id: string): void => {
    activeUpscalers.delete(id);
};


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
/**
 * Monitors GPU memory usage and triggers cleanup when necessary.
 */
const monitorGPUMemory = (): void => {
    // WebGPU memory monitoring not directly exposed like TFJS.
    // We rely on explicit cleanup calls.
};

/**
 * Safely cleans up GPU memory without disposing models that are in use.
 */
export const safeCleanupGPUMemory = (): void => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;

    try {
        // ONNX Runtime WebGPU cleanup handled by session release
        // Cleanup untracked upscalers
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

        // Trigger worker cleanup if nothing is active
        if (activeUpscalers.size === 0 && !aiModel) {
            initAIWorker().then(() => {
                cleanupWorkerMemory();
            }).catch(() => { });
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
let aiModelPromise: Promise<any> | null = null;

/**
 * Loads AI model (initializes worker)
 * @returns {Promise<Object>} Proxy object for AI model compatible with existing code
 */
export const loadAIModel = async (): Promise<any> => {
    if (aiModel) return aiModel;

    if (aiModelPromise) return aiModelPromise;

    aiModelPromise = (async () => {
        aiModelLoading = true;
        try {
            // Initialize the worker
            await initAIWorker();

            // Create a proxy object that mimics the coco-ssd model interface
            aiModel = {
                detect: async (imageElement: HTMLImageElement | HTMLCanvasElement | ImageData) => {
                    return await detectObjectsInWorker(imageElement);
                },
                modelType: AI_SETTINGS.MODEL_TYPE,
                dispose: () => {
                    terminateAIWorker();
                    aiModel = null;
                    aiModelPromise = null;
                }
            };

            return aiModel;
        } catch (error) {
            console.error('[MemoryUtils] Failed to load AI model, falling back to simple model:', error);
            aiModel = createSimpleAIModel();
            return aiModel;
        } finally {
            aiModelLoading = false;
            // Note: We keep aiModelPromise so subsequent calls get the same result (model or fallback)
        }
    })();

    return aiModelPromise;
};




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
 * Checks if the AI model is currently loading
 * @returns {boolean} True if loading
 */
export const isAIModelLoading = (): boolean => {
    return aiModelLoading;
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
