/**
 * @file ai.worker.ts
 * @description Web Worker for handling AI model operations (off the main thread)
 */

interface AIWorkerMessage {
    type: 'load' | 'detect' | 'upscale' | 'preload' | 'dispose' | 'warmup';
    imageData?: ImageData;
    config?: any;
    scale?: number;
}

interface AIWorkerResponse {
    type: 'loaded' | 'result' | 'upscale_result' | 'error' | 'warmup_complete';
    data?: any;
    error?: string;
    isLoaded?: boolean;
}


let aiModel: any = null;
let bodySegmenter: any = null;
let upscalerInstances: Record<number, any> = {};
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
        const libPath = config.localLibPath || '/lib/';
        const modelPath = config.localModelPath || '/models/';
        const modelType = config.modelType || 'lite_mobilenet_v2';

        // Load TFJS
        if (!(self as any).tf) {
            importScripts(`${libPath}tf.min.js`);

            // Load WebGPU Backend
            if (config.useWebGPU !== false) {
                try {
                    if (navigator.gpu) {
                        importScripts(`${libPath}tf-backend-webgpu.min.js`);
                        await (self as any).tf.setBackend('webgpu');
                        await (self as any).tf.ready();
                    } else {
                        await (self as any).tf.setBackend('webgl');
                    }
                } catch {
                    /* ignored */
                }
            }
        }

        // Load Coco-SSD
        if (!(self as any).cocoSsd) {
            importScripts(`${libPath}coco-ssd.min.js`);
        }

        // Load Face Landmarks Detection
        if (!(self as any).faceLandmarksDetection) {
            try {
                importScripts(`${libPath}face-landmarks-detection.min.js`);
            } catch {
                /* ignored */
            }
        }

        // Load Body Segmentation
        if (!(self as any).bodySegmentation) {
            try {
                importScripts(`${libPath}body-segmentation.min.js`);
            } catch {
                /* ignored */
            }
        }

        if ((self as any).cocoSsd) {
            aiModel = await (self as any).cocoSsd.load({
                base: modelType,
                modelUrl: `${modelPath}coco-ssd/${modelType}/model.json`
            });

            if (aiModel) {
                const zeros = (self as any).tf.zeros([10, 10, 3], 'int32');
                await aiModel.detect(zeros);
                zeros.dispose();
            }
        }

        // Initialize Body Segmenter
        if ((self as any).bodySegmentation) {
            try {
                const model = (self as any).bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
                const segmenterConfig = {
                    runtime: 'tfjs',
                    modelType: 'general'
                };
                bodySegmenter = await (self as any).bodySegmentation.createSegmenter(model, segmenterConfig);

            } catch {
                /* ignored */
            }
        }

        // Initialize Face Detector
        if ((self as any).faceLandmarksDetection) {
            try {
                const model = (self as any).faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
                const detectorConfig = {
                    runtime: 'tfjs',
                    refineLandmarks: false,
                    maxFaces: 5
                };
                (self as any).faceDetector = await (self as any).faceLandmarksDetection.createDetector(model, detectorConfig);

            } catch {
                /* ignored */
            }
        }

        isModelLoading = false;
        ctx.postMessage({ type: 'loaded', isLoaded: true });

        // Optional: Trigger background warmup if requested
        if (config.warmup) {
            warmupModels();
        }

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
    if ((self as any).faceDetector) {
        try {
            const faces = await (self as any).faceDetector.estimateFaces(imageData);
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

    const libPath = config.localLibPath || '/lib/';
    const modelPath = config.localModelPath || '/models/';

    if (!(self as any).Upscaler) {
        importScripts(`${libPath}upscaler.min.js`);
    }

    if ((self as any).Upscaler) {
        const upscaler = new (self as any).Upscaler({
            model: {
                path: `${modelPath}esrgan-slim/x${scale}/model.json`,
                scale: scale
            }
        });
        upscalerInstances[scale] = upscaler;
        return upscaler;
    }
    throw new Error(`UpscalerJS not found at ${libPath}upscaler.min.js`);
};

/**
 * Upscales target image data
 */
const upscaleImage = async (imageData: ImageData, scale: number, config: any) => {
    try {
        const upscaler = await loadUpscaler(scale, config);

        // Convert ImageData to tensor for UpscalerJS if needed,
        // or let UpscalerJS handle it from ImageData if supported in worker.
        // Most UpscalerJS versions in workers can take ImageData or Tensors.

        const result = await upscaler.upscale(imageData, {
            patchSize: 64, // Increased patch size for worker
            padding: 4,
            output: 'tensor'
        });

        // Convert result back to ImageData or send as Float32Array
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
 * Warms up all loaded models with dummy data
 */
const warmupModels = async () => {
    if (isWarmingUp) return;
    isWarmingUp = true;


    try {
        const tf = (self as any).tf;
        if (!tf) return;

        // 1. Warmup Detection (Coco-SSD)
        if (aiModel) {
            const zeros = tf.zeros([224, 224, 3], 'int32');
            await aiModel.detect(zeros);
            zeros.dispose();

        }

        // 2. Warmup Segmentation
        if (bodySegmenter) {
            const zeros = tf.zeros([256, 256, 3], 'int32');
            await bodySegmenter.segmentPeople(zeros);
            zeros.dispose();

        }

        // 3. Warmup Face Detection
        if ((self as any).faceDetector) {
            const zeros = tf.zeros([256, 256, 3], 'int32');
            await (self as any).faceDetector.estimateFaces(zeros);
            zeros.dispose();

        }

        // 4. Warmup Upscalers (if any loaded)
        for (const scale in upscalerInstances) {
            const upscaler = upscalerInstances[scale];
            const zeros = tf.zeros([32, 32, 3], 'int32');
            await upscaler.upscale(zeros, { output: 'tensor' }).then((t: any) => t.dispose());
            zeros.dispose();

        }

        ctx.postMessage({ type: 'warmup_complete' });
    } catch {
        /* ignored */
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

    if ((self as any).faceDetector && (self as any).faceDetector.dispose) {
        try { (self as any).faceDetector.dispose(); } catch { /* ignored */ }
    }
    (self as any).faceDetector = null;

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
};


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
        case 'upscale':
            if (imageData && config && config.scale) {
                await upscaleImage(imageData, config.scale, config);
            } else {
                ctx.postMessage({ type: 'error', error: 'Missing parameters for upscale' });
            }
            break;
        case 'preload':
            if (config && config.scale) {
                await loadUpscaler(config.scale, config);
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
