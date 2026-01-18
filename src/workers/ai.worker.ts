/**
 * @file ai.worker.ts
 * @description Web Worker for handling AI model operations (off the main thread)
 */

interface AIWorkerMessage {
    type: 'load' | 'detect' | 'dispose';
    imageData?: ImageData;
    config?: any;
}

interface AIWorkerResponse {
    type: 'loaded' | 'result' | 'error';
    data?: any;
    error?: string;
    isLoaded?: boolean;
}

// Global variables for the worker scope
let aiModel: any = null;
let bodySegmenter: any = null;
let isModelLoading = false;

// Declare importScripts for worker environment
declare function importScripts(...urls: string[]): void;

// Initialize worker context
const ctx: Worker = self as any;

// Suppress benign warnings that are false positives in a worker context
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
                } catch (e) {
                    console.warn('WebGPU load failed in worker, falling back', e);
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
            } catch (e) {
                console.warn('Failed to load face-landmarks-detection script', e);
            }
        }

        // Load Body Segmentation
        if (!(self as any).bodySegmentation) {
            try {
                importScripts(`${libPath}body-segmentation.min.js`);
            } catch (e) {
                console.warn('Failed to load body-segmentation script', e);
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
                console.log('Body Segmenter (SelfieSegmentation) initialized');
            } catch (e) {
                console.warn('Failed to initialize Body Segmenter', e);
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
                console.log('Face Detector initialized');
            } catch (e) {
                console.warn('Failed to initialize Face Detector', e);
            }
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
        } catch (error: any) {
            console.warn('Coco-SSD detection failed', error);
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
        } catch (error) {
            console.warn('Body Segmentation failed', error);
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
        } catch (error) {
            console.warn('Face detection failed', error);
        }
    }

    ctx.postMessage({ type: 'result', data: results });
};


/**
 * Clean up resources
 */
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
};

// Message Handler
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
        case 'dispose':
            disposeModel();
            break;
    }
};
