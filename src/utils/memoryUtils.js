import {
    MEMORY_CLEANUP_INTERVAL,
    UPSCALER_IDLE_TIMEOUT
} from '../constants/sharedConstants';

// ================================
// Constants and State Management
// ================================

/** AI model instance */
let aiModel = null;

/** Upscaler instances by scale */
let upscalerInstances = {};

/** Upscaler usage count by scale */
let upscalerUsageCount = {};

/** Last used timestamps for upscalers */
let upscalerLastUsed = {};

/** Current GPU memory usage in MB */
let currentMemoryUsage = 0;

/** Memory cleanup interval reference */
let memoryCleanupInterval = null;

/** Whether AI upscaling is disabled */
let aiUpscalingDisabled = false;

/** Texture manager failure count */
let textureManagerFailures = 0;

/** Whether cleanup is in progress */
let cleanupInProgress = false;
// ================================
// GPU Memory Management
// ================================

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
    } catch (error) {
    } finally {
        cleanupInProgress = false;
    }
};