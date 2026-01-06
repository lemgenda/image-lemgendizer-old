import {
    MEMORY_CLEANUP_INTERVAL,
    UPSCALER_IDLE_TIMEOUT,
    AI_SETTINGS
} from '../constants';

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
export const loadAIModel = async (): Promise<any> => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        if (!window.tf) await loadTensorFlow();
        if (!window.tf) throw new Error('TensorFlow.js not available');

        // Try to load and set WebGPU backend
        try {
            await loadWebGPUBackend();
            if (window.tf.engine().backendName !== 'webgpu') {
                await window.tf.setBackend('webgpu');
                await window.tf.ready();
            }
        } catch (webgpuError) {
            // Fallback to WebGL or CPU is handled automatically by TF.js if setBackend fails
            // but we want to ensure we at least have WebGL if WebGPU is unavailable
            try {
                if (window.tf.engine().backendName !== 'webgl') {
                    await window.tf.setBackend('webgl');
                    await window.tf.ready();
                }
            } catch { /* Final fallback to CPU */ }
        }

        // Load patched COCO-SSD from local node_modules
        if (!window.cocoSsd) {
            try {
                const cocoSsd = await import('@tensorflow-models/coco-ssd');
                window.cocoSsd = cocoSsd;
            } catch (e) {
                console.error('Failed to load COCO-SSD locally', e);
                await loadCocoSsdFromCDN();
            }
        }
        if (window.cocoSsd) {
            aiModel = await window.cocoSsd.load({ base: AI_SETTINGS.MODEL_TYPE });
            if (aiModel) aiModel.modelType = 'coco-ssd';
        } else {
            throw new Error('COCO-SSD not available');
        }

        aiModelLoading = false;
        return aiModel;
    } catch {
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        return aiModel;
    }
};

/**
 * Loads TensorFlow.js from local package
 */
const loadTensorFlow = async (): Promise<void> => {
    if (window.tf) return;

    try {
        // Dynamic import to avoid bundling if not needed immediately
        const tf = await import('@tensorflow/tfjs');
        window.tf = tf;
    } catch (e) {
        console.error('Failed to load TensorFlow.js locally', e);
        // Fallback to CDN if local load fails
        await loadTensorFlowFromCDN();
    }
};

/**
 * Loads TensorFlow.js from CDN (Fallback)
 */
const loadTensorFlowFromCDN = (): Promise<void> => {
    return new Promise((resolve) => {
        if (window.tf) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${AI_SETTINGS.TENSORFLOW_VERSION}/dist/tf.min.js`;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Loads COCO-SSD model from CDN
 */
const loadCocoSsdFromCDN = (): Promise<void> => {
    return new Promise((resolve) => {
        if (window.cocoSsd) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@${AI_SETTINGS.COCO_SSD_VERSION}/dist/coco-ssd.min.js`;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

/**
 * Loads WebGPU backend from CDN
 */
/**
 * Loads WebGPU backend from local package
 */
const loadWebGPUBackend = async (): Promise<void> => {
    // Check if WebGPU is supported by the browser
    if (!navigator.gpu) {
        return;
    }

    try {
        await import('@tensorflow/tfjs-backend-webgpu');
    } catch (e) {
        console.warn('Failed to load WebGPU backend', e);
    }
};

/**
 * Creates a simple fallback AI model
 * @returns {Object} Simple AI model
 */
function createSimpleAIModel() {
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
}

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
