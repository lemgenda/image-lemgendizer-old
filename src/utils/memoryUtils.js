import {
    MEMORY_CLEANUP_INTERVAL,
    UPSCALER_IDLE_TIMEOUT,
    AI_SETTINGS
} from '../constants';

let aiModel = null;
let upscalerInstances = {};
let upscalerUsageCount = {};
let upscalerLastUsed = {};
let currentMemoryUsage = 0;
let memoryCleanupInterval = null;
let textureManagerFailures = 0;
let cleanupInProgress = false;
let aiModelLoading = false;

/**
 * Initializes GPU memory monitoring system.
 * @returns {void}
 */
export const initializeGPUMemoryMonitor = () => {
    if (memoryCleanupInterval) clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = setInterval(monitorGPUMemory, MEMORY_CLEANUP_INTERVAL);
};

/**
 * Monitors GPU memory usage and triggers cleanup when necessary.
 * @returns {void}
 */
const monitorGPUMemory = () => {
    if (cleanupInProgress) return;

    if (window.tf && tf.memory()) {
        const memoryInfo = tf.memory();
        currentMemoryUsage = (memoryInfo.numBytesInGPU || 0) / (1024 * 1024);

        const upscalersInUse = Object.values(upscalerUsageCount).some(count => count > 0);
        if (currentMemoryUsage > 3000 && !upscalersInUse) {
            safeCleanupGPUMemory();
        }
    }
};

/**
 * Safely cleans up GPU memory without disposing models that are in use.
 * @returns {void}
 */
export const safeCleanupGPUMemory = () => {
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
                            try { upscaler.dispose(); } catch (e) { }
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
    } catch (error) {
        // Ignore cleanup errors
    } finally {
        cleanupInProgress = false;
    }
};

/**
 * Aggressively cleans up all GPU memory resources.
 * @returns {void}
 */
export const cleanupGPUMemory = () => {
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
                    try { upscaler.dispose(); } catch (e) { }
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
        aiUpscalingDisabled = false;
        textureManagerFailures = 0;
        aiModelLoading = false;
    } catch (error) {
        // Ignore cleanup errors
    } finally {
        cleanupInProgress = false;
    }
};

/**
 * Loads AI model for object detection
 * @returns {Promise<Object>} AI model instance
 */
export const loadAIModel = async () => {
    if (aiModel) return aiModel;
    if (aiModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return loadAIModel();
    }

    aiModelLoading = true;
    try {
        if (!window.tf) await loadTensorFlowFromCDN();
        if (!window.tf) throw new Error('TensorFlow.js not available');

        if (!window.cocoSsd) await loadCocoSsdFromCDN();
        if (window.cocoSsd) {
            aiModel = await window.cocoSsd.load({ base: AI_SETTINGS.MODEL_TYPE });
            if (aiModel) aiModel.modelType = 'coco-ssd';
        } else {
            throw new Error('COCO-SSD not available');
        }

        aiModelLoading = false;
        return aiModel;
    } catch (error) {
        aiModel = createSimpleAIModel();
        aiModelLoading = false;
        return aiModel;
    }
};

/**
 * Loads TensorFlow.js from CDN
 * @returns {Promise<void>}
 */
const loadTensorFlowFromCDN = () => {
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
 * @returns {Promise<void>}
 */
const loadCocoSsdFromCDN = () => {
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
 * Creates a simple fallback AI model
 * @returns {Object} Simple AI model
 */
const createSimpleAIModel = () => {
    return {
        detect: async (imgElement) => {
            const width = imgElement.naturalWidth || imgElement.width;
            const height = imgElement.naturalHeight || imgElement.height;

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
export const cleanupAllResources = () => {
    if (memoryCleanupInterval) {
        clearInterval(memoryCleanupInterval);
        memoryCleanupInterval = null;
    }

    cleanupGPUMemory();

    if (aiModel && aiModel.dispose) {
        aiModel.dispose();
        aiModel = null;
    }

    aiUpscalingDisabled = false;
    textureManagerFailures = 0;
    aiModelLoading = false;
};

/**
 * Gets current memory usage
 * @returns {number} Current memory usage in MB
 */
export const getCurrentMemoryUsage = () => {
    return currentMemoryUsage;
};

/**
 * Gets texture manager failure count
 * @returns {number} Texture manager failure count
 */
export const getTextureManagerFailures = () => {
    return textureManagerFailures;
};

/**
 * Cleans up blob URLs from image objects
 * @param {Array<Object>} imageObjects - Image objects
 */
export const cleanupBlobUrls = (imageObjects) => {
    if (!imageObjects || !Array.isArray(imageObjects)) return;

    imageObjects.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(image.url);
                image.url = null;
            } catch (e) {
                // Ignore errors
            }
        }

        if (image.previewData && image.previewData.url) {
            try {
                URL.revokeObjectURL(image.previewData.url);
                image.previewData.url = null;
            } catch (e) {
                // Ignore errors
            }
        }

        if (image.previewData && image.previewData.canvas) {
            try {
                const ctx = image.previewData.canvas.getContext('2d');
                ctx.clearRect(0, 0, image.previewData.canvas.width, image.previewData.canvas.height);
            } catch (e) {
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