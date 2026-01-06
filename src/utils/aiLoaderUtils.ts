import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import Upscaler from 'upscaler';
// @ts-ignore
import esrganSlim2x from '@upscalerjs/esrgan-slim/2x';
// @ts-ignore
import esrganSlim3x from '@upscalerjs/esrgan-slim/3x';
// @ts-ignore
import esrganSlim4x from '@upscalerjs/esrgan-slim/4x';

import {
    UPSCALER_CDN_URLS,
    BACKEND_BLACKLIST_KEY,
    BACKEND_BLACKLIST_EXPIRY
} from '../constants/sharedConstants';

// Session-based blacklist to avoid re-trying failed backends
const BACKEND_BLACKLIST: Record<string, boolean> = {};

// Initialize blacklist from localStorage if available
try {
    const stored = localStorage.getItem(BACKEND_BLACKLIST_KEY);
    if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() < parsed.expires) {
            Object.assign(BACKEND_BLACKLIST, parsed.backends);
        } else {
            localStorage.removeItem(BACKEND_BLACKLIST_KEY);
        }
    }
} catch (e) {
    // Ignore storage errors
}

const blacklistBackend = (backend: string) => {
    BACKEND_BLACKLIST[backend] = true;
    try {
        localStorage.setItem(BACKEND_BLACKLIST_KEY, JSON.stringify({
            backends: BACKEND_BLACKLIST,
            expires: Date.now() + BACKEND_BLACKLIST_EXPIRY
        }));
    } catch (e) {
        // Ignore
    }
};

/**
 * Initializes TensorFlow with the best available backend.
 * Priority: WebGPU -> WebGL -> CPU
 */
export const initializeTensorFlow = async (): Promise<string> => {
    // 1. Check current backend
    const currentBackend = tf.getBackend();
    if (currentBackend === 'webgpu' || currentBackend === 'webgl') {
        return currentBackend;
    }

    // 2. Attempt backend initialization
    const backends = ['webgpu', 'webgl', 'cpu'];

    for (const backend of backends) {
        if (BACKEND_BLACKLIST[backend]) continue;

        try {

            // [Antigravity Perf] Aggressively batch commands for MAXIM's 28k kernels
            if (backend === 'webgpu') {
                tf.env().set('WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE', 4096);
            }

            // [Antigravity Fix] Install warning filter for known benign warnings from third-party libraries
            const { installWarningFilter } = await import('./warningFilter');
            installWarningFilter();

            await tf.setBackend(backend);
            await tf.ready();

            if (backend === 'webgpu' || backend === 'webgl') {
                if (backend === 'webgpu' && navigator.gpu) {
                    try {
                        const adapter = await navigator.gpu.requestAdapter();
                        // adapter.info is the standard property, requestAdapterInfo is deprecated/removed
                        await (adapter as any).requestAdapterInfo();
                    } catch (e) {
                         // Ignore adapter info errors
                    }
                }

                // Validate backend with a simple operation
                const testTensor = tf.tensor1d([1, 2, 3]);
                const result = testTensor.add(tf.tensor1d([1, 1, 1]));
                await result.data();
                testTensor.dispose();
                result.dispose();

                return backend;
            }
        } catch (e) {
            if (backend !== 'cpu') {
                blacklistBackend(backend);
            }
        }
    }

    // Fallback to CPU is implicit if loop finishes, but explicit here for clarity
    // Fallback to CPU is implicit if loop finishes, but explicit here for clarity
    await tf.setBackend('cpu');
    return 'cpu';
};

import { AI_SETTINGS } from '../constants/aiConstants';

/**
 * Loads the COCO-SSD model.
 */
export const loadCocoSsdModel = async () => {
    try {
        const modelType = AI_SETTINGS.MODEL_TYPE || 'lite_mobilenet_v2';
        // We use dynamic import for the model to avoid bundling issues
        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        const model = await cocoSsd.load({ base: modelType as any });
        return model;
    } catch (error) {
        throw error;
    }
};

/**
 * Loads an UpscalerJS model with retry logic and local fallback.
 */
export const loadUpscalerModel = async (modelType: '2x' | '3x' | '4x' = '2x') => {
    // Determine model config
    let modelConfig;
    let modelUrl;

    switch (modelType) {
        case '2x':
            modelConfig = esrganSlim2x;
            modelUrl = UPSCALER_CDN_URLS.ESRGAN_SLIM_2X;
            break;
        case '3x':
            modelConfig = esrganSlim3x;
            modelUrl = UPSCALER_CDN_URLS.ESRGAN_SLIM_3X;
            break;
        case '4x':
            modelConfig = esrganSlim4x;
            modelUrl = UPSCALER_CDN_URLS.ESRGAN_SLIM_4X;
            break;
    }

    // Strategy 1: Try CDN
    try {
        // Override the path to use the CDN URL specifically
        const cdnConfig = {
            ...modelConfig,
            path: modelUrl
        };
        const upscaler = new Upscaler({
            model: cdnConfig
        });
        await upscaler.getModel(); // Warmup to verify loading
        return upscaler;
    } catch (cdnError) {
        // CDN load failed, trying local fallback
    }

    // Strategy 2: Local Fallback
    try {
        // Use the original config which defaults to local node_modules path (handled by Vite)
        const upscaler = new Upscaler({
            model: modelConfig
        });
        await upscaler.getModel();
        return upscaler;
    } catch (localError) {
        throw new Error(`Failed to load Upscaler model ${modelType}`);
    }
};

/**
 * Loads a MAXIM model (deblur, dehaze, etc) for specific image enhancement tasks.
 * Uses the same 3-tier loading strategy.
 */
export const loadMaximModel = async (modelUrl: string) => {
    // Helper to get local path from CDN URL
    const getLocalPath = (url: string) => {
        // Map URL keywords to local directory names
        if (url.includes('maxim-deblurring')) return '/models/maxim/deblurring/model.json';
        if (url.includes('maxim-dehazing-indoor')) return '/models/maxim/dehazing-indoor/model.json';
        if (url.includes('maxim-dehazing-outdoor')) return '/models/maxim/dehazing-outdoor/model.json';
        if (url.includes('maxim-denoising')) return '/models/maxim/denoising/model.json';
        if (url.includes('maxim-deraining')) return '/models/maxim/deraining/model.json';
        if (url.includes('maxim-enhancement')) return '/models/maxim/enhancement/model.json';
        if (url.includes('maxim-retouching')) return '/models/maxim/retouching/model.json';

        // Fallback default
        const filename = url.split('/').pop();
        return `/models/maxim/${filename}`;
    };

    // Strategy 1: CDN
    try {
        const model = await tf.loadGraphModel(modelUrl);
        return model;
    } catch (cdnError) {
        // CDN load failed, trying local fallback
    }

    // Strategy 2: Local Fallback
    try {
        const localPath = getLocalPath(modelUrl);
        const model = await tf.loadGraphModel(localPath);
        return model;
    } catch (localError) {
        throw new Error(`Failed to load MAXIM model`);
    }
};
