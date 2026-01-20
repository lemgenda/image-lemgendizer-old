/**
 * @file ai.worker.ts
 * @description Web Worker for handling AI model operations (off the main thread)
 */

interface AIWorkerMessage {
    type: 'load' | 'detect' | 'upscale' | 'preload' | 'dispose' | 'warmup' | 'enhance';
    imageData?: ImageData;
    config?: any;
    scale?: number;
    task?: string;
}

interface AIWorkerResponse {
    type: 'loaded' | 'result' | 'upscale_result' | 'error' | 'warmup_complete' | 'status';
    data?: any;
    error?: string;
    isLoaded?: boolean;
    model?: string;
    status?: 'loading' | 'warming' | 'ready' | 'error';
}


let aiModel: any = null;
let bodySegmenter: any = null;
let faceDetector: any = null;
let upscalerInstances: Record<number, any> = {};
let maximInstances: Record<string, any> = {};
let isModelLoading = false;
let isWarmingUp = false;


declare function importScripts(...urls: string[]): void;


const ctx: Worker = self as any;


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

const sendStatus = (model: string, status: 'loading' | 'warming' | 'ready' | 'error') => {
    ctx.postMessage({ type: 'status', model, status });
};

let upscalerScriptPromise: Promise<void> | null = null;
const loadUpscalerScript = (libPath: string) => {
    if ((self as any).Upscaler) return Promise.resolve();
    if (upscalerScriptPromise) return upscalerScriptPromise;
    upscalerScriptPromise = new Promise((resolve, reject) => {
        try {
            importScripts(`${libPath}upscaler.min.js`);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
    return upscalerScriptPromise;
};

/**
 * Loads a MAXIM model for a specific task
 */
const loadMaximModel = async (task: string, config: any) => {
    if (maximInstances[task]) return maximInstances[task];

    sendStatus(task, 'loading');
    const libPath = config.localLibPath || '/lib/';
    const modelPath = config.localModelPath || '/models/';

    const startLoad = performance.now();
    await loadUpscalerScript(libPath);

    if ((self as any).Upscaler) {
        const upscaler = new (self as any).Upscaler({
            model: {
                path: `${modelPath}maxim/${task}/model.json`,
                scale: 1,
                modelType: 'graph' // EXPLICITLY set for MAXIM models to avoid Layers format error
            }
        });
        await upscaler.getModel(); // Ensure it loads
        maximInstances[task] = upscaler;
        const duration = performance.now() - startLoad;
        console.log(`[AI Worker] MAXIM Model '${task}' LOADED in ${duration.toFixed(2)}ms`);
        sendStatus(task, 'ready');
        return upscaler;
    }
    sendStatus(task, 'error');
    throw new Error(`UpscalerJS not found for MAXIM task: ${task}`);
};

/**
 * Loads the AI Model dependencies and initializes the model
 */
const loadModel = async (config: any) => {
    const libPath = config.localLibPath || '/lib/';
    const modelPath = config.localModelPath || '/models/';
    const modelType = config.modelType || 'lite_mobilenet_v2';

    // 1. MUST load TFJS & WebGPU first as all other models depend on it
    if (!(self as any).tf) {
        importScripts(`${libPath}tf.min.js`);
    }

    const tf = (self as any).tf;
    const currentBackend = tf ? tf.getBackend() : 'none';
    console.log(`[AI Worker] Backend Check - Current: ${currentBackend}, Requested WebGPU: ${config.useWebGPU !== false}`);

    if (tf && config.useWebGPU !== false) {
        // If it's already webgpu, we're good. If not (cpu or webgl), try to force webgpu.
        if (currentBackend !== 'webgpu') {
            try {
                if (navigator.gpu) {
                    console.log('[AI Worker] Prioritizing WebGPU backend...');
                    // Cache bust using renamed file
                    importScripts(`${libPath}tf-backend-webgpu-patched.min.js`);
                    await tf.setBackend('webgpu');
                    await tf.ready();
                    console.log(`[AI Worker] WebGPU backend READY. Active Backend: ${tf.getBackend()}`);
                } else {
                    console.log('[AI Worker] navigator.gpu NOT available. Falling back to CPU (WebGL strictly disabled).');
                    await tf.setBackend('cpu');
                    await tf.ready();
                }
            } catch (e) {
                console.warn('[AI Worker] WebGPU initialization failed, falling back to CPU (WebGL strictly disabled):', e);
                await tf.setBackend('cpu');
                await tf.ready();
            }
        } else {
            console.log('[AI Worker] WebGPU already active.');
            await tf.ready();
        }
    } else if (tf) {
        await tf.setBackend('cpu'); // Force CPU if WebGPU not preferred
        await tf.ready();
    }

    // 2. Preloading strategy
    if (config.preloadMaxim) {
        // Models for production: enhancement, deblurring as requested
        const startTotalPreload = performance.now();
        console.log('[AI Worker] Starting parallel preloading of CORE models...');

        await Promise.allSettled([
            loadMaximModel('enhancement', config),
            loadMaximModel('deblurring', config),
            loadUpscaler(2, config)
        ]);

        const totalPreloadTime = performance.now() - startTotalPreload;
        console.log(`[AI Worker] CORE preloading COMPLETE in ${totalPreloadTime.toFixed(2)}ms`);
    }

    if (aiModel && !config.warmup) {
        ctx.postMessage({ type: 'loaded', isLoaded: true });
        return;
    }

    if (isModelLoading) return;
    isModelLoading = true;

    try {
        // 3. Load other models
        if (!(self as any).cocoSsd) {
            sendStatus('coco', 'loading');
            importScripts(`${libPath}coco-ssd.min.js`);
        }
        if (!(self as any).faceLandmarksDetection) { try { importScripts(`${libPath}face-landmarks-detection.min.js`); } catch { /* ignored */ } }
        if (!(self as any).bodySegmentation) { try { importScripts(`${libPath}body-segmentation.min.js`); } catch { /* ignored */ } }

        // Coco-SSD
        if ((self as any).cocoSsd && !aiModel) {
            const startLoad = performance.now();
            aiModel = await (self as any).cocoSsd.load({
                base: modelType,
                modelUrl: `${modelPath}coco-ssd/${modelType}/model.json`
            });
            const duration = performance.now() - startLoad;
            console.log(`[AI Worker] Coco-SSD Model LOADED in ${duration.toFixed(2)}ms`);
            sendStatus('coco', 'ready');
        }

        // Body Segmenter
        if ((self as any).bodySegmentation && !bodySegmenter) {
            try {
                sendStatus('body', 'loading');
                const model = (self as any).bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
                bodySegmenter = await (self as any).bodySegmentation.createSegmenter(model, { runtime: 'tfjs', modelType: 'general' });
                sendStatus('body', 'ready');
            } catch { sendStatus('body', 'error'); }
        }

        // Face Detector
        if ((self as any).faceLandmarksDetection && !faceDetector) {
            try {
                sendStatus('face', 'loading');
                const model = (self as any).faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
                faceDetector = await (self as any).faceLandmarksDetection.createDetector(model, { runtime: 'tfjs', refineLandmarks: false, maxFaces: 5 });
                sendStatus('face', 'ready');
            } catch { sendStatus('face', 'error'); }
        }

        // 4. Trigger Warmup if requested AND Await it
        if (config.warmup) {
            await warmupModels();
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
    const results: any[] = [];

    // 1. Run Coco-SSD detection
    if (aiModel) {
        try {
            const predictions = await aiModel.detect(imageData);
            results.push(...predictions);
        } catch {
            /* ignored */
        }
    }

    // 2. Run Body Segmentation (if available) for better person detection
    if (bodySegmenter) {
        try {
            const segmentations = await bodySegmenter.segmentPeople(imageData, {
                multiSegmentation: false,
                segmentBodyParts: false
            });

            if (segmentations && segmentations.length > 0) {
                for (const segmentation of segmentations) {
                    const mask = await segmentation.mask.toImageData();
                    const { width, height, data } = mask;

                    let minX = width;
                    let minY = height;
                    let maxX = 0;
                    let maxY = 0;
                    let hasPixels = false;

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = (y * width + x) * 4;
                            if (data[idx + 3] > 0) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                                hasPixels = true;
                            }
                        }
                    }

                    if (hasPixels) {
                        const bbox = [minX, minY, maxX - minX, maxY - minY];
                        results.push({
                            bbox: bbox,
                            class: 'person',
                            score: 0.99,
                            source: 'body-segmentation'
                        });
                    }
                }
            }
        } catch {
            /* ignored */
        }
    }

    // 3. Run Face Detection
    if (faceDetector) {
        try {
            const faces = await faceDetector.estimateFaces(imageData);
            if (faces && faces.length > 0) {
                for (const face of faces) {
                    const box = face.box;
                    results.push({
                        bbox: [box.xMin, box.yMin, box.width, box.height],
                        class: 'face',
                        score: face.score || 0.9,
                        source: 'face-detection'
                    });
                }
            }
        } catch {
            /* ignored */
        }
    }

    ctx.postMessage({ type: 'result', data: results });
};

/**
 * Loads an upscaler for a specific scale
 */
const loadUpscaler = async (scale: number, config: any) => {
    if (upscalerInstances[scale]) return upscalerInstances[scale];

    const modelKey = `upscaler${scale}x`;
    sendStatus(modelKey, 'loading');

    const libPath = config.localLibPath || '/lib/';
    const modelPath = config.localModelPath || '/models/';

    if (!(self as any).Upscaler) {
        importScripts(`${libPath}upscaler.min.js`);
    }

    if ((self as any).Upscaler) {
        const startLoad = performance.now();
        const upscaler = new (self as any).Upscaler({
            model: {
                path: `${modelPath}esrgan-slim/x${scale}/model.json`,
                scale: scale
            }
        });
        await upscaler.getModel();
        upscalerInstances[scale] = upscaler;
        const duration = performance.now() - startLoad;
        console.log(`[AI Worker] ESRGAN Upscaler x${scale} LOADED in ${duration.toFixed(2)}ms`);
        sendStatus(modelKey, 'ready');
        return upscaler;
    }
    sendStatus(modelKey, 'error');
    throw new Error(`UpscalerJS not found at ${libPath}upscaler.min.js`);
};

/**
 * Upscales target image data
 */
const upscaleImage = async (imageData: ImageData, scale: number, config: any) => {
    try {
        const upscaler = await loadUpscaler(scale, config);

        const result = await upscaler.upscale(imageData, {
            patchSize: 64,
            padding: 4,
            output: 'tensor'
        });

        let outputData: any;
        let shape: [number, number];

        if (result && result.data && typeof result.data === 'function') {
            outputData = await result.data();
            shape = [result.shape[0], result.shape[1]];
            result.dispose();
        } else {
            outputData = result;
            shape = [imageData.height * scale, imageData.width * scale];
        }

        ctx.postMessage({
            type: 'upscale_result',
            data: outputData,
            shape,
            scale
        }, [outputData.buffer]);

    } catch (error: any) {
        ctx.postMessage({ type: 'error', error: `Upscale Error: ${error.message}` });
    }
};

/**
 * Enhances a tile with MAXIM model
 */
const enhanceImage = async (imageData: ImageData, task: string, config: any) => {
    const tf = (self as any).tf;
    if (tf && tf.engine) tf.engine().startScope();
    try {
        const upscaler = await loadMaximModel(task, config);

        // Convert ImageData to float32 tensor explicitly
        // MAXIM models typically expect [0,1] float32 inputs
        const inputTensor = tf.browser.fromPixels(imageData).toFloat().div(255); // Normalize to [0,1] if needed, verify model expectancy
        // Actually, UpscalerJS usually handles this, but for GraphModel we might need to be explicit if it fails

        const result = await upscaler.upscale(inputTensor, {
            output: 'tensor'
        });

        // Clean up input immediately to free VRAM for data download
        inputTensor.dispose();

        const outputData = await result.data();
        const shape = [result.shape[0], result.shape[1]];

        // Dispose tensor immediately after data extraction
        result.dispose();

        ctx.postMessage({
            type: 'upscale_result',
            data: outputData,
            shape,
            task
        }, [outputData.buffer]);
    } catch (error: any) {
        ctx.postMessage({ type: 'error', error: `Enhancement Error: ${error.message}` });
    } finally {
        if (tf && tf.engine) tf.engine().endScope();
    }
};

/**
 * Warms up all loaded models with dummy data
 */
const warmupModels = async () => {
    if (isWarmingUp) return;
    isWarmingUp = true;

    try {
        const tf = (self as any).tf;
        if (!tf) return;

        console.log('[AI Worker] Starting AI Engine Warmup Sequence...');

        // 1. Warmup Detection (Coco-SSD)
        if (aiModel) {
            try {
                const startWarmup = performance.now();
                sendStatus('coco', 'warming');
                const zeros = tf.zeros([224, 224, 3], 'int32');
                await aiModel.detect(zeros);
                zeros.dispose();
                const duration = performance.now() - startWarmup;
                console.log(`[AI Worker] Coco-SSD Model WARMED UP in ${duration.toFixed(2)}ms`);
                sendStatus('coco', 'ready');
            } catch (err: any) {
                console.warn(`[AI Worker] Coco-SSD Warmup skipped/failed: ${err.message}`);
                sendStatus('coco', 'error');
            }
        }

        // 2. Warmup Segmentation & Face
        if (bodySegmenter) {
            try {
                sendStatus('body', 'warming');
                const zeros = tf.zeros([256, 256, 3], 'int32');
                await bodySegmenter.segmentPeople(zeros);
                zeros.dispose();
                sendStatus('body', 'ready');
            } catch { sendStatus('body', 'error'); }
        }
        if (faceDetector) {
            try {
                sendStatus('face', 'warming');
                const zeros = tf.zeros([256, 256, 3], 'int32');
                await faceDetector.estimateFaces(zeros);
                zeros.dispose();
                sendStatus('face', 'ready');
            } catch { sendStatus('face', 'error'); }
        }

        // 3. Warmup Upscalers
        const upscalerKeys = Object.keys(upscalerInstances);
        if (upscalerKeys.length > 0) {
            console.log(`[AI Worker] Warming up ${upscalerKeys.length} ESRGAN upscalers...`);
            for (const scale of upscalerKeys) {
                try {
                    const startWarmup = performance.now();
                    const modelKey = `upscaler${scale}x`;
                    sendStatus(modelKey, 'warming');
                    const upscaler = upscalerInstances[parseInt(scale)];
                    const zeros = tf.zeros([32, 32, 3], 'int32');
                    const result = await upscaler.upscale(zeros, { output: 'tensor' });
                    if (result && typeof result.dispose === 'function') result.dispose();
                    zeros.dispose();
                    const duration = performance.now() - startWarmup;
                    console.log(`[AI Worker] ESRGAN Upscaler x${scale} WARMED UP in ${duration.toFixed(2)}ms`);
                    sendStatus(modelKey, 'ready');
                } catch (err: any) {
                    console.warn(`[AI Worker] ESRGAN Upscaler x${scale} Warmup FAILED: ${err.message}`);
                    sendStatus(`upscaler${scale}x`, 'error');
                }
            }
        }

        // 4. Warmup MAXIM models
        const maximKeys = Object.keys(maximInstances);
        if (maximKeys.length > 0) {
            console.log(`[AI Worker] Warming up ${maximKeys.length} MAXIM models...`);
            // helper: Set all to warming immediately so UI reflects busy state even for queued output
            maximKeys.forEach(key => sendStatus(key, 'warming'));

            for (const task of maximKeys) {
                // Use explicit scope management for each model
                if (tf && tf.engine) tf.engine().startScope();
                let zeros: any = null;
                let result: any = null;
                let memStart: any = null;

                try {
                    const startWarmup = performance.now();
                    memStart = tf.memory();
                    sendStatus(task, 'warming');
                    const upscaler = maximInstances[task];

                    // Increased warmup size to 128x128 to avoid zero-dimension reshapes in downsampled layers
                    // 64x64 was too small for some models at deep downsampling levels.
                    zeros = tf.zeros([128, 128, 3], 'float32');

                    // Run inference - result is a Tensor or Tensor[]
                    result = await upscaler.upscale(zeros, { output: 'tensor' });

                    // Await the backend to finish execution
                    // We don't need dataSync() here as the await above ensures the command buffer is submitted
                    // and accessing .data() later (if needed) would sync.
                    // For warmup, just execution is enough.

                    const duration = performance.now() - startWarmup;
                    console.log(`[AI Worker] MAXIM Model '${task}' WARMED UP in ${duration.toFixed(2)}ms`);
                    sendStatus(task, 'ready');
                } catch (err: any) {
                    console.error(`[AI Worker] MAXIM Model '${task}' Warmup FAILED:`, err);
                    if (err && typeof err === 'object') {
                        console.error('Error Details:', {
                            message: err.message,
                            name: err.name,
                            stack: err.stack,
                            ...err
                        });
                    }
                    sendStatus(task, 'error');
                } finally {
                    // Explicitly dispose created tensors if they exist
                    if (zeros) zeros.dispose();
                    if (result) {
                        if (Array.isArray(result)) {
                            result.forEach(t => t.dispose());
                        } else if (result.dispose) {
                            result.dispose();
                        }
                    }

                    // End scope to cleanup intermediates
                    if (tf && tf.engine) tf.engine().endScope();

                    const memEnd = tf.memory();
                    console.log(`[AI Worker] Memory Delta for '${task}': Tensors: ${memEnd.numTensors - (memStart?.numTensors || 0)}, GPU Bytes: ${(memEnd.numBytesInGPU - (memStart?.numBytesInGPU || 0)) / 1024 / 1024} MB`);
                }
            }
        }

        console.log('[AI Worker] AI Engine Warmup Sequence COMPLETED.');
        // Increased delay to ensure all status messages are processed by UI before hiding splash
        setTimeout(() => {
            ctx.postMessage({ type: 'warmup_complete' });
        }, 300);
    } catch (err: any) {
        console.error('[AI Worker] Fatal error during overall warmup:', err);
        // Still send completion so splash doesn't hang forever
        ctx.postMessage({ type: 'warmup_complete' });
    } finally {
        isWarmingUp = false;
    }
};

const disposeModel = () => {
    if (aiModel && aiModel.dispose) {
        try { aiModel.dispose(); } catch { /* ignored */ }
    }
    aiModel = null;
    isModelLoading = false;

    if (faceDetector && faceDetector.dispose) {
        try { faceDetector.dispose(); } catch { /* ignored */ }
    }
    faceDetector = null;

    if (bodySegmenter && bodySegmenter.dispose) {
        try { bodySegmenter.dispose(); } catch { /* ignored */ }
    }
    bodySegmenter = null;

    if ((self as any).tf) {
        (self as any).tf.disposeVariables();
    }

    for (const scale in upscalerInstances) {
        const upscaler = upscalerInstances[scale];
        if (upscaler && upscaler.dispose) {
            try { upscaler.dispose(); } catch { /* ignored */ }
        }
    }
    upscalerInstances = {};

    for (const task in maximInstances) {
        const upscaler = maximInstances[task];
        if (upscaler && upscaler.dispose) {
            try { upscaler.dispose(); } catch { /* ignored */ }
        }
    }
    maximInstances = {};
};


ctx.onmessage = async (e: MessageEvent<AIWorkerMessage>) => {
    const { type, imageData, config, task } = e.data;

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
        case 'upscale':
            if (imageData && config && config.scale) {
                await upscaleImage(imageData, config.scale, config);
            } else {
                ctx.postMessage({ type: 'error', error: 'Missing parameters for upscale' });
            }
            break;
        case 'enhance':
            if (imageData && task) {
                await enhanceImage(imageData, task, config);
            } else {
                ctx.postMessage({ type: 'error', error: 'Missing parameters for enhancement' });
            }
            break;
        case 'preload':
            if (config) {
                if (config.scale) {
                    await loadUpscaler(config.scale, config);
                } else if (config.task) {
                    await loadMaximModel(config.task, config);
                }
            }
            break;
        case 'warmup':
            await warmupModels();
            break;
        case 'dispose':
            disposeModel();
            break;
    }
};
