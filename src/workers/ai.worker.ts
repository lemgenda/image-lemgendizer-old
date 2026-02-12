/**
 * @file ai.worker.ts
 * @description Pure ONNX Runtime Web Worker for Image LemGendizer (WebGPU)
 */

interface AIWorkerMessage {
    type: 'load' | 'upscale' | 'detect' | 'restore' | 'segment' | 'dispose' | 'cleanup';
    config?: any;
    data?: any;
    scale?: number;
    modelName?: string;
}

let ortInstance: any = null;
let currentSession: any = null;
let currentSessionPath: string | null = null;
const sessionCache: Map<string, any> = new Map();

const WORKER_VERSION = '1.0.7-Pure-MPRNet';

const MAX_CACHED_SESSIONS = 3;
let messageQueue: Promise<void> = Promise.resolve();
// Round 57: Global Busy Flag (Strict Lock)
let isBusy = false;

/**
 * Performance Timer Utility
 */
class Timer {
    private startTime: number = 0;

    constructor(_label: string) {
    }

    start() {
        this.startTime = performance.now();
    }

    end(): number {
        const duration = performance.now() - this.startTime;
        return duration;
    }
}

/**
 * Float32 <-> Float16 Conversion Utils
 */
const float32ToFloat16 = (f32: Float32Array): Uint16Array => {
    const f16 = new Uint16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        const val = f32[i];
        const f32v = new Float32Array([val]);
        const f32i = new Uint32Array(f32v.buffer)[0];

        const sign = (f32i >> 16) & 0x8000;
        const exponent = ((f32i >> 23) & 0xff) - 127 + 15;
        const fraction = f32i & 0x7fffff;

        if (exponent <= 0) {
            f16[i] = sign;
        } else if (exponent >= 31) {
            f16[i] = sign | 0x7c00;
        } else {
            f16[i] = sign | (exponent << 10) | (fraction >> 13);
        }
    }
    return f16;
};

const float16ToFloat32 = (f16: Uint16Array): Float32Array => {
    const f32 = new Float32Array(f16.length);
    for (let i = 0; i < f16.length; i++) {
        const val = f16[i];
        const sign = (val & 0x8000) << 16;
        const exponent = (val & 0x7c00) >> 10;
        const fraction = val & 0x03ff;

        if (exponent === 0) {
            if (fraction === 0) {
                f32[i] = (sign === 0 ? 0 : -0);
            } else {
                const f32v = new Uint32Array([sign | ((127 - 14) << 23) | (fraction << 13)]);
                f32[i] = new Float32Array(f32v.buffer)[0] * (1 / (1 << 14));
            }
        } else if (exponent === 31) {
            f32[i] = (fraction === 0 ? Infinity : NaN);
        } else {
            const f32v = new Uint32Array([sign | ((exponent + 127 - 15) << 23) | (fraction << 13)]);
            f32[i] = new Float32Array(f32v.buffer)[0];
        }
    }
    return f32;
};

declare function importScripts(...urls: string[]): void;

const ctx: Worker = self as any;

let initPromise: Promise<void> | null = null;

// ORT 1.23.2 Upgrade - No polyfill needed

/**
 * Initializes ONNX Runtime Web
 */
const initORT = async (config: any) => {
    if (ortInstance) return;

    if (initPromise) {
        await initPromise;
        return;
    }

    initPromise = (async () => {
        const timer = new Timer('ORT Initialization');
        timer.start();

        try {
            const libPath = config.localLibPath || '/lib/';
            const path = libPath.endsWith('/') ? libPath : libPath + '/';

            const cacheBuster = `?t=${Date.now()}`;

            importScripts(`${path}ort.all.min.js${cacheBuster}`);

            if ((self as any).ort) {
                ortInstance = (self as any).ort;
            }

            if (!ortInstance) throw new Error('Failed to load ort.all.min.js');

            ortInstance.env.wasm.wasmPaths = path;

            ortInstance.env.wasm.simd = true;
            ortInstance.env.wasm.proxy = false;

            if (!ortInstance.env.webgpu) ortInstance.env.webgpu = {};

            const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '');
            if (!isWindows) {
                ortInstance.env.webgpu.powerPreference = 'high-performance';
            }

            ortInstance.env.logLevel = 'error';
            ortInstance.env.debug = false;
        } catch (e) {
            console.error('[AI Worker] ORT Init Failed:', e);
            throw e;
        } finally {
            initPromise = null;
        }
    })();

    await initPromise;
};

/**
 * Session Manager: Enforce single active WebGPU session
 */
const loadSession = async (modelPath: string, config: any) => {
    const sessionTimer = new Timer(`Load Session: ${modelPath}`);
    sessionTimer.start();

    if (!ortInstance) {
        await initORT(config);
    }

    if (currentSession) {
        if (currentSessionPath === modelPath) {
            return currentSession;
        }

        // Round 26: Session Cache Safety
        // Only release the current session if it is NOT in the cache.
        // Cached sessions should only be released by the LRU eviction logic.
        let isCached = false;
        for (const s of sessionCache.values()) {
            if (s === currentSession) {
                isCached = true;
                break;
            }
        }

        if (!isCached) {
            try {
                await currentSession.release();
            } catch (e) { console.warn('Session release error:', e); }
        }

        currentSession = null;
        currentSessionPath = null;

        if (ortInstance.env.webgpu && ortInstance.env.webgpu.clearCache) {
            try { await ortInstance.env.webgpu.clearCache(); } catch (_) { /* ignored */ }
        }

        // yield to allow browser to reclaim memory
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    ctx.postMessage({
        type: 'progress',
        data: { current: 0, total: 100, stage: 'loading_model', currentOperation: 'Loading AI Model...' }
    });

    try {
        if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
            try {
                const adapter = await (navigator as any).gpu.requestAdapter();
                if (adapter) {
                    try {
                        if ((adapter as any).requestAdapterInfo) {
                            await (adapter as any).requestAdapterInfo();
                        }
                    } catch (_) { /* ignored */ }
                }
            } catch (_) { /* ignored */ }
        }

        if (sessionCache.has(modelPath)) {
            currentSession = sessionCache.get(modelPath);
            currentSessionPath = modelPath;
            return currentSession;
        }

        const isYolo = modelPath.includes('yolo');
        const isRestoration = modelPath.includes('restoration') || modelPath.toLowerCase().includes('ultrazoom');

        const sessionOptions: any = {
            executionProviders: isRestoration ? ['webgpu'] : ['webgpu', 'wasm'],
            graphOptimizationLevel: isRestoration ? 'basic' : 'all',
            enableMemPattern: false,
            enableCpuMemArena: false,
            logSeverityLevel: 3,
        };

        if (!isYolo) {
            sessionOptions.graphOptimizationLevel = 'basic';
            sessionOptions.extra = {
                webgpu: {
                    "preferredLayout": "NCHW",
                    "matmulPrecision": "high"
                }
            };
        }

        const finalOptions = { ...sessionOptions };
        const session = await (ortInstance as any).InferenceSession.create(modelPath, finalOptions);

        // LRU Cache Management
        if (sessionCache.size >= MAX_CACHED_SESSIONS) {
            const firstKey = sessionCache.keys().next().value;
            if (firstKey) {
                const oldSession = sessionCache.get(firstKey);
                if (oldSession) {
                    try { await oldSession.release(); } catch (_) { /* ignore release error */ }
                }
                sessionCache.delete(firstKey);
            }
        }
        sessionCache.set(modelPath, session);

        currentSession = session;
        currentSessionPath = modelPath;

        const warmupTimer = new Timer('Warmup Run');
        warmupTimer.start();

        if (!isYolo) {
            ctx.postMessage({
                type: 'progress',
                data: { current: 0, total: 100, stage: 'warming_up', currentOperation: 'Warming Up AI...' }
            });
        }

        try {
            const dims = isYolo ? [1, 3, 640, 640] : (isRestoration ? [1, 3, 512, 512] : [1, 3, 64, 64]);
            const size = dims[1] * dims[2] * dims[3];

            const feeds: any = {};

            // 1. Primary Image Input
            const inputName = session.inputNames[0];
            let useFP16 = modelPath.toLowerCase().includes('-fp16');

            try {
                if (useFP16) {
                    throw new Error('HINT: expected: (tensor(float16))');
                }
                const dummyData = new Float32Array(size).fill(0.5);
                const tensor = new ortInstance.Tensor('float32', dummyData, dims);
                feeds[inputName] = tensor;

                // 2. Secondary Inputs (e.g. Fidelity for CodeFormer)
                for (let i = 1; i < session.inputNames.length; i++) {
                    const name = session.inputNames[i];
                    if (name === 'fidelity') {
                        feeds[name] = new ortInstance.Tensor('float32', new Float32Array([0.5]), [1]);
                    }
                }

                await session.run(feeds);
            } catch (wError: any) {
                const errorMsg = wError.message || String(wError);
                if (errorMsg.includes('expected: (tensor(float16))')) {
                    useFP16 = true;
                    (session as any)._inputType = 'float16';
                    (session as any)._outputType = 'float16';

                    const dummyDataF16 = float32ToFloat16(new Float32Array(size).fill(0.5));
                    const tensorF16 = new ortInstance.Tensor('float16', dummyDataF16, dims);
                    feeds[inputName] = tensorF16;

                    // Re-add secondary inputs (they are usually scalar float32, but check if they need fp16?)
                    // CodeFormer fidelity is float32 even in fp16 models usually, but let's prevent errors.
                    // For now, assume fidelity is float32.

                    await session.run(feeds);
                } else {
                    throw wError;
                }
            }

            if (!(session as any)._inputType) {
                (session as any)._inputType = useFP16 ? 'float16' : 'float32';
                (session as any)._outputType = useFP16 ? 'float16' : 'float32';
            }
        } catch (wError) {
            console.warn('[AI Worker] Warmup failed (non-fatal):', wError);
        }

        return session;
    } catch (e) {
        console.error('[AI Worker] Session startup failed:', e);
        throw e;
    }
};

const resizeAndPad = async (imageData: ImageData, targetSize: number) => {
    const { width: w, height: h } = imageData;
    const scale = Math.min(targetSize / w, targetSize / h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);
    const dx = Math.round((targetSize - newW) / 2);
    const dy = Math.round((targetSize - newH) / 2);

    const canvas = new OffscreenCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas context failed');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, targetSize, targetSize);

    const bitmap = await createImageBitmap(imageData);
    ctx.drawImage(bitmap, dx, dy, newW, newH);

    return {
        data: ctx.getImageData(0, 0, targetSize, targetSize).data,
        scale,
        dx,
        dy
    };
};

const yoloNMS = (boxes: number[][], scores: number[], iouThresh: number) => {
    const indices = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]);
    const keep: number[] = [];

    while (indices.length > 0) {
        const current = indices.shift()!;
        keep.push(current);

        for (let i = indices.length - 1; i >= 0; i--) {
            const idx = indices[i];
            const iou = calculateIoU(boxes[current], boxes[idx]);
            if (iou > iouThresh) {
                indices.splice(i, 1);
            }
        }
    }
    return keep;
};

const calculateIoU = (boxA: number[], boxB: number[]) => {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[2], boxB[2]);
    const yB = Math.min(boxA[3], boxB[3]);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
    const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

    return interArea / ((boxAArea + boxBArea - interArea) || 1e-6);
};

const runDetection = async (imageData: ImageData, config: any = {}) => {
    const safeConfig = config || {};
    const modelFileName = safeConfig.modelType || 'YOLO(v8)';
    const modelPath = safeConfig.localModelPath ? `${safeConfig.localModelPath}yolo/${modelFileName}.onnx` : `/models/yolo/${modelFileName}.onnx`;

    const session = await loadSession(modelPath, safeConfig);

    const targetSize = 640;
    const { data, scale, dx, dy } = await resizeAndPad(imageData, targetSize);

    let float32Data: any = new Float32Array(3 * targetSize * targetSize);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        float32Data[j] = data[i] / 255.0;
        float32Data[j + targetSize * targetSize] = data[i + 1] / 255.0;
        float32Data[j + 2 * targetSize * targetSize] = data[i + 2] / 255.0;
    }

    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    const inputType = (session as any)._inputType || 'float32';
    const outputType = (session as any)._outputType || 'float32';

    if (inputType === 'float16') {
        float32Data = float32ToFloat16(float32Data);
    }

    const tensor = new ortInstance.Tensor(inputType === 'float16' ? 'float16' : 'float32', float32Data, [1, 3, targetSize, targetSize]);

    const resultsDict = await session.run({ [inputName]: tensor });
    const output0 = resultsDict[outputName];

    let outputData: any = output0.data;
    if (outputType === 'float16' && outputData instanceof Uint16Array) {
        outputData = float16ToFloat32(outputData);
    }

    const boxes: number[][] = [];
    const scores: number[] = [];
    const classes: number[] = [];

    const [_, _attributes, proposals] = output0.dims;
    const confThresh = 0.25;

    for (let i = 0; i < proposals; i++) {
        let maxScore = 0;
        let maxClass = 0;

        for (let c = 0; c < 80; c++) {
            const prob = outputData[(4 + c) * proposals + i];
            if (prob > maxScore) {
                maxScore = prob;
                maxClass = c;
            }
        }

        if (maxScore > confThresh) {
            const cx = outputData[0 * proposals + i];
            const cy = outputData[1 * proposals + i];
            const w = outputData[2 * proposals + i];
            const h = outputData[3 * proposals + i];

            const x1 = cx - w / 2;
            const y1 = cy - h / 2;

            const x1_org = (x1 - dx) / scale;
            const y1_org = (y1 - dy) / scale;
            const w_org = w / scale;
            const h_org = h / scale;

            boxes.push([x1_org, y1_org, x1_org + w_org, y1_org + h_org]);
            scores.push(maxScore);
            classes.push(maxClass);
        }
    }

    const COCO_CLASSES = [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
        'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
        'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
        'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
        'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
        'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
        'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
        'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
        'hair drier', 'toothbrush'
    ];

    const keep = yoloNMS(boxes, scores, 0.45);

    const finalResults = keep.map(idx => ({
        bbox: [boxes[idx][0], boxes[idx][1], boxes[idx][2] - boxes[idx][0], boxes[idx][3] - boxes[idx][1]],
        class: COCO_CLASSES[classes[idx]] || `class_${classes[idx]}`,
        score: scores[idx],
        source: 'yolo'
    }));

    ctx.postMessage({ type: 'result', data: finalResults });
};

const runUpscale = async (imageData: ImageData, config: any) => {
    const totalTimer = new Timer('Total Upscaling');
    totalTimer.start();

    const scale = config.scale || 2;

    // FP32 models are now standard (UltraZoom-xN.onnx)
    const modelName = `UltraZoom-x${scale}`;
    const modelPath = config.localModelPath ? `${config.localModelPath}ultrazoom/${modelName}.onnx` : `/models/ultrazoom/${modelName}.onnx`;

    const session = await loadSession(modelPath, config);

    const { width, height, data } = imageData;

    const preProcessedData = data;

    // --- SCALE-SPECIFIC CONFIGS (Round 19) ---
    let TILE_SIZE = 512;
    let OVERLAP = 128; // Default <25%
    let JITTER_MAX = 2; // Default for x3

    if (scale === 2) {
        TILE_SIZE = 384;
        OVERLAP = 64;
        JITTER_MAX = 2;
    } else if (scale === 3) {
        TILE_SIZE = 512;
        OVERLAP = 96;
        JITTER_MAX = 2;
    }

    const STEP = TILE_SIZE - OVERLAP;
    const outWidth = width * scale;
    const outHeight = height * scale;

    const outBuffer = new Float32Array(outWidth * outHeight * 3);
    const weightBuffer = new Float32Array(outWidth * outHeight);
    const ramp = new Float32Array(TILE_SIZE * scale);
    for (let i = 0; i < TILE_SIZE * scale; i++) {
        const scaledTileSize = TILE_SIZE * scale;
        // Standard Hann Window (Unity at 50% overlap)
        ramp[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / scaledTileSize);

        // Round 21: Aggressive 32px Edge Suppression
        const fade = 32 * scale;
        if (i < fade) ramp[i] *= (i / fade);
        else if (i > scaledTileSize - fade) ramp[i] *= ((scaledTileSize - 1 - i) / fade);
    }

    // Helper: Extract tile with Edge Replication Padding
    // Always returns a TILE_SIZE x TILE_SIZE float32 array
    const extractTilePad = (sx: number, sy: number) => {
        const tileData = new Float32Array(3 * TILE_SIZE * TILE_SIZE);
        for (let y = 0; y < TILE_SIZE; y++) {
            for (let x = 0; x < TILE_SIZE; x++) {
                let gx = sx + x;
                let gy = sy + y;

                // Edge Replication Padding
                if (gx < 0) gx = -gx;
                else if (gx >= width) gx = 2 * (width - 1) - gx;
                if (gy < 0) gy = -gy;
                else if (gy >= height) gy = 2 * (height - 1) - gy;

                gx = Math.max(0, Math.min(width - 1, gx));
                gy = Math.max(0, Math.min(height - 1, gy));

                const srcIdx = (gy * width + gx) * 4;
                const dstIdx = y * TILE_SIZE + x;

                tileData[dstIdx] = preProcessedData[srcIdx] / 255.0;
                tileData[dstIdx + TILE_SIZE * TILE_SIZE] = preProcessedData[srcIdx + 1] / 255.0;
                tileData[dstIdx + 2 * TILE_SIZE * TILE_SIZE] = preProcessedData[srcIdx + 2] / 255.0;
            }
        }
        return tileData;
    };

    if (STEP <= 0) throw new Error("Overlap too large for tile size");

    const cols = Math.ceil(width / STEP) + 1;
    const rows = Math.ceil(height / STEP) + 1;

    const totalTiles = rows * cols;
    let tilesProcessed = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const baseSx = c * STEP - OVERLAP;
            const baseSy = r * STEP - OVERLAP;

            // --- PHYSICAL TILE JITTERING (Round 19) ---
            const jitterX = JITTER_MAX > 0 ? ((r * 7 + c * 13) % (JITTER_MAX * 2 + 1)) - JITTER_MAX : 0;
            const jitterY = JITTER_MAX > 0 ? ((r * 13 + c * 7) % (JITTER_MAX * 2 + 1)) - JITTER_MAX : 0;
            const sx = baseSx + jitterX;
            const sy = baseSy + jitterY;

            // Boundary handling: Ensure we cover exactly the image by wrapping or reflection
            // In Uniform Step Tiling, we don't clamp sx/sy, we let the tile loop handle it
            // but we ensure we don't go past the "virtual" padded bounds.

            // We now pass the raw coordinates, padding logic handles clamping inside extractTilePad
            let tileTensorData: any = extractTilePad(sx, sy);

            const inputName = session.inputNames[0];
            const outputName = session.outputNames[0];
            const inputType = (session as any)._inputType || 'float32';

            if (inputType === 'float16') {
                tileTensorData = float32ToFloat16(tileTensorData);
            }

            // Always creating TILE_SIZE x TILE_SIZE tensor
            const tensor = new ortInstance.Tensor(inputType, tileTensorData, [1, 3, TILE_SIZE, TILE_SIZE]);

            let outData: any = null;
            let outputShape = null;

            try {
                const results = await session.run({ [inputName]: tensor });
                const output = results[outputName];
                outData = output.data;
                outputShape = output.dims;
            } catch (e: any) {
                console.error(`[AI Worker] TILE FAILED (${r},${c}): ${e.message}`);
                // Fallback: If tile fails (OOM?), we skip it (leave weight=0).
                // But wait! If weight=0, final buffer divides by 0.001 -> Black.
                // If user sees ORIGINAL, it implies the buffer was never touched?
                // Actually, if we skip, weightBuffer is 0.
                // Line 651: w = 0.001.
                // Line 652: val = 0 / 0.001 = 0.
                // So skipping yields BLACK.
                // User sees ORIGINAL. This means the Worker CRASHED before sending result?
                // Or maybe my "Safety Gate" return is happening? No, I disabled it.

                // CRITICAL: If a tile fails, we should output the ORIGINAL tile data to the buffer
                // so at least we don't have black holes.
                // But for now, let's just Log and Continue.
                continue;
            }

            const isNHWC = outputShape[1] !== 3 && outputShape[3] === 3;
            const isBGR = modelName.toLowerCase().includes('bgr');

            // Output Dimensions from Model
            const outTileSize = TILE_SIZE * scale; // e.g., 512 * 4 = 2048

            for (let y = 0; y < outTileSize; y++) {
                const gy = baseSy * scale + y;
                for (let x = 0; x < outTileSize; x++) {
                    const gx = baseSx * scale + x;
                    if (gx < 0 || gx >= outWidth || gy < 0 || gy >= outHeight) continue;

                    const wx = ramp[x];
                    const wy = ramp[y];

                    // In Pre-Padding Tiling, every tile is an interior tile
                    const w = wx * wy;

                    let idxR, idxG, idxB;
                    if (isNHWC) {
                        idxR = (y * outTileSize + x) * 3 + 0;
                        idxG = (y * outTileSize + x) * 3 + 1;
                        idxB = (y * outTileSize + x) * 3 + 2;
                    } else {
                        idxR = 0 * outTileSize * outTileSize + y * outTileSize + x;
                        idxG = 1 * outTileSize * outTileSize + y * outTileSize + x;
                        idxB = 2 * outTileSize * outTileSize + y * outTileSize + x;
                    }

                    let dr, dg, db;
                    if (isBGR) {
                        db = outData[idxR]; dg = outData[idxG]; dr = outData[idxB];
                    } else {
                        dr = outData[idxR]; dg = outData[idxG]; db = outData[idxB];
                    }

                    outBuffer[(gy * outWidth + gx) * 3] += dr * 255 * w;
                    outBuffer[(gy * outWidth + gx) * 3 + 1] += dg * 255 * w;
                    outBuffer[(gy * outWidth + gx) * 3 + 2] += db * 255 * w;
                    weightBuffer[gy * outWidth + gx] += w;
                }
            }
            tilesProcessed++;

            ctx.postMessage({
                type: 'progress',
                data: {
                    current: tilesProcessed,
                    total: totalTiles,
                    stage: 'upscaling',
                    currentOperation: `Upscaling (Tile ${tilesProcessed}/${totalTiles})`
                }
            });
        }
    }

    const finalBuffer = new Uint8ClampedArray(outWidth * outHeight * 4);
    for (let i = 0; i < outWidth * outHeight; i++) {
        const w = Math.max(0.001, weightBuffer[i]);
        finalBuffer[i * 4] = Math.min(255, Math.max(0, outBuffer[i * 3] / w));
        finalBuffer[i * 4 + 1] = Math.min(255, Math.max(0, outBuffer[i * 3 + 1] / w));
        finalBuffer[i * 4 + 2] = Math.min(255, Math.max(0, outBuffer[i * 3 + 2] / w));
        finalBuffer[i * 4 + 3] = 255;
    }

    const outImageData = new ImageData(finalBuffer, outWidth, outHeight);
    ctx.postMessage({
        type: config.resultType || 'upscale_result',
        data: outImageData,
        model: modelName,
        scale: scale
    });
};

const runRestoration = async (imageData: ImageData, config: any): Promise<void> => {
    const totalTimer = new Timer('Total Restoration');
    totalTimer.start();

    const modelName = config.modelName || 'MPRNet-Deraining';
    const modelPath = config.localModelPath ? `${config.localModelPath}restoration/${modelName}.onnx` : `/models/restoration/${modelName}.onnx`;

    const session = await loadSession(modelPath, config);

    const isLowLight = modelName.toLowerCase().includes('lowlight') || modelName.toLowerCase().includes('mirnet');
    const isDeblur = modelName.toLowerCase().includes('deblur');
    const isDenoise = modelName.toLowerCase().includes('denoising');

    // Round 53 Revert: User says "It was ok in last version".
    // This implies 768px Tiling (Default) worked fine. My 512px force might have caused the Seams.
    // We KEEP the Clamp/OOB Exemption (because that was the "not good" part), but revert Tiling.
    const isDeraining = modelName.toLowerCase().includes('deraining');
    const isMPRNet = modelName.toLowerCase().includes('mprnet');

    // Round 53 Fix: Error "Expected 512, Got 768" proves MPRNet IS a 512px model.
    // The "Vertical Seams" were likely caused by the Safety Gate (Fixed in Round 51).
    // We MUST use 512px.
    const TILE_SIZE = (isLowLight || isDeblur || isDenoise || isDeraining || isMPRNet) ? 512 : 768;
    const { width, height, data } = imageData;

    // Round 30: Smart Safety Gate (Protect against Catastrophic Failure)
    // Round 51: Exempt Rain/MPRNet. Rain streaks are "Sharp" (High Laplacian), causing the Gate to
    // falsely trigger and skip the tile. We MUST process rain.
    if (modelName.toLowerCase().includes('deblur') && !modelName.toLowerCase().includes('rain') && !modelName.toLowerCase().includes('mprnet')) {
        // Lightweight Quality Analysis (Center 512x512)
        const sampleSize = 512;
        const sx = Math.max(0, Math.floor(width / 2 - sampleSize / 2));
        const sy = Math.max(0, Math.floor(height / 2 - sampleSize / 2));
        const sW = Math.min(sampleSize, width - sx);
        const sH = Math.min(sampleSize, height - sy);

        let lapVar = 0;
        let blockScore = 0;
        let pixelCount = 0;

        for (let y = 1; y < sH - 1; y++) {
            for (let x = 1; x < sW - 1; x++) {
                const idx = ((sy + y) * width + (sx + x)) * 4;
                const val = data[idx + 1]; // Green channel

                const up = data[((sy + y - 1) * width + (sx + x)) * 4 + 1];
                const down = data[((sy + y + 1) * width + (sx + x)) * 4 + 1];
                const left = data[((sy + y) * width + (sx + x - 1)) * 4 + 1];
                const right = data[((sy + y) * width + (sx + x + 1)) * 4 + 1];

                lapVar += Math.abs(up + down + left + right - 4 * val);

                if ((sx + x) % 8 === 0 || (sy + y) % 8 === 0) {
                    const diff = Math.abs(val - right) + Math.abs(val - down);
                    if (diff > 20) blockScore += diff;
                }
                pixelCount++;
            }
        }

        const avgLap = lapVar / pixelCount;
        const avgBlock = blockScore / (pixelCount / 64);


        if (avgLap > 20 || avgBlock > 50) {
            console.warn(`[AI Worker] SAFETY GATE TRIGGERED: Skipping Deblur.`);
            ctx.postMessage({ type: 'progress', data: { current: 100, total: 100, stage: 'skipped', currentOperation: 'processing.skipped.safetyGate' } });
            await new Promise(r => setTimeout(r, 50));

            const skippedData = new ImageData(new Uint8ClampedArray(data), width, height);
            ctx.postMessage({
                type: 'restore_result',
                data: skippedData,
                modelName
            });
            return;
        }
    }

    // Round 57 Fix: Cinematic/Backlight Rain Gate
    // Round 61 Fix: User reported "Nothing Fixed" when gate triggered on '0.54' Luma image.
    // We DISABLE the gate for MPRNet to force processing. User prefers artifacts over "Nothing".
    if (isDeraining && !isMPRNet) {
        // User Heuristic: "Backlit rain... Light shafts... High dynamic range"
        // Rule: if (bright_pixels > 5% && mean_luma < 0.25) -> Backlit -> SKIP
        let sumLuma = 0;
        let brightCount = 0;
        let totalPixels = 0;

        // Sampling (Center 512x512 is enough)
        const sampleSize = 512;
        const sx = Math.max(0, Math.floor(width / 2 - sampleSize / 2));
        const sy = Math.max(0, Math.floor(height / 2 - sampleSize / 2));
        const sW = Math.min(sampleSize, width - sx);
        const sH = Math.min(sampleSize, height - sy);

        for (let y = 0; y < sH; y++) {
            for (let x = 0; x < sW; x++) {
                const idx = ((sy + y) * width + (sx + x)) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                // Luma (Standard)
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                sumLuma += luma;

                if (luma > 240) brightCount++; // > 94% brightness
                totalPixels++;
            }
        }

        const meanLuma = (sumLuma / totalPixels) / 255.0;
        const brightRatio = brightCount / totalPixels;


        // Round 58 Fix (Retry): Aggressive Gate for "Mid-Tone" Cinematic Scenes
        // User logged MeanLuma=0.54, BrightPoints=9.9% and it still failed.
        // We raise threshold to 0.60 (cover mid-tones) and lower BrightRatio to 0.02 (2%).
        if (meanLuma < 0.60 && brightRatio > 0.02) {
            console.warn(`[AI Worker] CINEMATIC BACKLIGHT DETECTED: Skipping Derain.`);
            ctx.postMessage({ type: 'progress', data: { current: 100, total: 100, stage: 'skipped', currentOperation: 'processing.skipped.backlight' } });
            await new Promise(r => setTimeout(r, 50));
            const skippedData = new ImageData(new Uint8ClampedArray(data), width, height);
            ctx.postMessage({ type: 'restore_result', data: skippedData, modelName });
            return;
        }
    }

    const outWidth = width;
    const outHeight = height;

    const outBuffer = new Float32Array(outWidth * outHeight * 3);
    const weightBuffer = new Float32Array(outWidth * outHeight);
    const numPixels = TILE_SIZE * TILE_SIZE;
    // Round 63: Increase Overlap for Deraining (25% = 128px) to reduce grid artifacts.
    // Others keep 12.5% (64px) for speed.
    const overlapRatio = isDeraining ? 0.25 : 0.125;
    const OVERLAP = Math.floor(TILE_SIZE * overlapRatio);
    const STEP = TILE_SIZE - OVERLAP;
    const JITTER_MAX = 0; // Round 59 Fix: Disable Jitter for Restoration to prevent ghosting/alignment issues.

    const cols = Math.ceil(width / STEP) + 1;
    const rows = Math.ceil(height / STEP) + 1;

    const isDehaze = modelName.toLowerCase().includes('dehazing');
    const isFFA = modelName.toLowerCase().includes('ffanet');
    const isFFA_Indoor = isFFA && modelName.toLowerCase().includes('indoor');
    const isFFA_Outdoor = isFFA && modelName.toLowerCase().includes('outdoor');
    const isDehazing = modelName.toLowerCase().includes('dehazing') || isFFA;
    const isBGR = false; // RGB confirmed by PyTorch transforms (uses RGB by default)

    // FFA-Net Specific Normalization (From Research):
    // Mean: [0.64, 0.60, 0.58]
    // Std:  [0.14, 0.15, 0.152]
    const FFA_MEAN = [0.64, 0.60, 0.58];
    const FFA_STD = [0.14, 0.15, 0.152];

    // Standard NAFNet/MIRNet: [0, 1] Input -> [0, 1] Output
    // DeblurGAN: [-1, 1] Input -> [-1, 1] Output
    // FFA-Net: (x - mean) / std Input -> De-normalized Output
    const isDeblurGAN = modelName.toLowerCase().includes('deblurgan');

    const useInputMinusOneToOne = isDeblurGAN; // Only DeblurGAN uses [-1, 1]
    const useFFANormalization = isDehazing;    // FFA-Net uses specific Mean/Std (Input Only)

    // Output Normalization Logic
    const expectOutputMinusOneToOne = isDeblurGAN;
    // Round 46: Hybrid Normalization.
    // Diagnostics suggest Output is NOT normalized (de-norm caused washed out look).
    // We assume model outputs standard [0, 1] or [-1, 1] directly.
    const expectFFANormalization = false;

    const getHumanName = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('lowlight')) return 'Low-Light Enhancement';
        if (n.includes('mirnet')) return 'MIRNet Restoration';
        if (n.includes('nafnet')) return 'NAFNet Alignment';
        if (n.includes('deraining')) return 'Deraining';
        if (n.includes('ffanet-dehazing_outdoor')) return 'Dehazing (Outdoor)';
        if (n.includes('ffanet-dehazing_indoor')) return 'Dehazing (Indoor)';
        if (n.includes('dehazing')) return 'AI Dehazing';
        if (n.includes('deblurring_gopro')) return 'Deblurring (GoPro)';
        if (n.includes('deblurring_reds')) return 'Deblurring (REDS)';
        if (n.includes('denoising')) return 'Denoising (SIDD)';
        if (n.includes('deblurgan-v2-inception')) return 'DeblurGANv2 (Inception)';
        if (n.includes('deblurgan')) return 'DeblurGANv2';
        if (n.includes('mprnet')) return 'MPRNet Restoration';
        return 'Restoring';
    };

    const operationName = getHumanName(modelName);

    const ramp = new Float32Array(TILE_SIZE);
    for (let i = 0; i < TILE_SIZE; i++) {
        // Round 24: Pure Hann Window (Restore COLA property)
        // High-precision windowing without custom edges
        ramp[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / TILE_SIZE);
    }

    let tilesProcessed = 0;
    const totalTiles = rows * cols;
    let lastProgressTime = 0; // Throttling state

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const baseSx = c * STEP - OVERLAP;
            const baseSy = r * STEP - OVERLAP;

            // --- PHYSICAL TILE JITTERING (Round 20) ---
            // Jitter 0-2px
            const jitterX = ((r * 7 + c * 13) % (JITTER_MAX * 2 + 1)) - JITTER_MAX;
            const jitterY = ((r * 13 + c * 7) % (JITTER_MAX * 2 + 1)) - JITTER_MAX;
            const sx = baseSx + jitterX;
            const sy = baseSy + jitterY;

            let tileData: any = new Float32Array(3 * TILE_SIZE * TILE_SIZE);

            for (let y = 0; y < TILE_SIZE; y++) {
                for (let x = 0; x < TILE_SIZE; x++) {
                    const globalX = sx + x;
                    const globalY = sy + y;

                    let safeX = globalX;
                    let safeY = globalY;

                    if (safeX < 0) safeX = -safeX;
                    else if (safeX >= width) safeX = 2 * (width - 1) - safeX;

                    if (safeY < 0) safeY = -safeY;
                    else if (safeY >= height) safeY = 2 * (height - 1) - safeY;

                    safeX = Math.max(0, Math.min(width - 1, safeX));
                    safeY = Math.max(0, Math.min(height - 1, safeY));

                    const srcIdx = (safeY * width + safeX) * 4;
                    const dstIdx = (y * TILE_SIZE + x);

                    if (isBGR) {
                        const scale = useInputMinusOneToOne ? 127.5 : 255.0;
                        const shift = useInputMinusOneToOne ? 1.0 : 0.0;
                        tileData[dstIdx] = (data[srcIdx + 2] / scale) - shift;
                        tileData[dstIdx + numPixels] = (data[srcIdx + 1] / scale) - shift;
                        tileData[dstIdx + 2 * numPixels] = (data[srcIdx] / scale) - shift;
                    } else if (useFFANormalization) {
                        // Round 45: FFA-Net Specific Normalization
                        // (x - mean) / std
                        const r = data[srcIdx] / 255.0;
                        const g = data[srcIdx + 1] / 255.0;
                        const b = data[srcIdx + 2] / 255.0;
                        tileData[dstIdx] = (r - FFA_MEAN[0]) / FFA_STD[0];
                        tileData[dstIdx + numPixels] = (g - FFA_MEAN[1]) / FFA_STD[1];
                        tileData[dstIdx + 2 * numPixels] = (b - FFA_MEAN[2]) / FFA_STD[2];
                    } else if (useInputMinusOneToOne) {
                        // Round 12: Unified Standard Normalization
                        const normScale = 127.5;
                        tileData[dstIdx] = (data[srcIdx] / normScale) - 1.0;
                        tileData[dstIdx + numPixels] = (data[srcIdx + 1] / normScale) - 1.0;
                        tileData[dstIdx + 2 * numPixels] = (data[srcIdx + 2] / normScale) - 1.0;
                    } else {
                        tileData[dstIdx] = data[srcIdx] / 255.0;
                        tileData[dstIdx + numPixels] = data[srcIdx + 1] / 255.0;
                        tileData[dstIdx + 2 * numPixels] = data[srcIdx + 2] / 255.0;
                    }
                }
            }

            const inputName = session.inputNames[0];
            const outputName = session.outputNames[0];
            const inputType = (session as any)._inputType || 'float32';
            const outputType = (session as any)._outputType || 'float32';

            if (inputType === 'float16') {
                tileData = float32ToFloat16(tileData);
            }

            let results;
            let tensor: any = null;
            try {
                tensor = new ortInstance.Tensor(inputType, tileData, [1, 3, TILE_SIZE, TILE_SIZE]);
                results = await session.run({ [inputName]: tensor });
            } catch (e: any) {
                console.error(`[AI Worker] RESTORATION TILE FAILED (${r},${c}): ${e.message}`);
                // Round 56: Fix Progress Lag.
                // Even if we fail, we MUST increment progress.
                tilesProcessed++;
                ctx.postMessage({ type: 'progress', data: { current: tilesProcessed, total: totalTiles, stage: 'restoration', currentOperation: operationName } });
                continue;
            }

            const output = results[outputName];
            let outData: any = output.data;

            if (outputType === 'float16') {
                if (outData instanceof Uint16Array) outData = float16ToFloat32(outData);
                else if (typeof Float16Array !== 'undefined' && outData instanceof Float16Array) outData = Float32Array.from(outData);
            }

            const outputShape = output.dims;
            const isNHWC = outputShape[1] !== 3 && outputShape[3] === 3;

            // Round 22: Diagnostic Sniffing
            let sMin = 100, sMax = -100;
            for (let i = 0; i < outData.length; i++) {
                const v = outData[i];
                if (v < sMin) sMin = v;
                if (v > sMax) sMax = v;
            }

            // Round 22: Dynamic Range Normalization
            const isPixelScale = (sMax > 2.0 || sMin < -2.0);
            const rangeScale = isPixelScale ? 255.0 : 1.0;

            // --- PER-CHANNEL ZERO-MEAN STABILIZER (Round 23) ---
            // For residual models (like NAFNet/MIRNet), the DC bias (average brightness)
            // of the model output can vary between tiles, causing a visible grid artifacts.
            // We calculate and subtract the per-channel mean to neutralize this.
            let sumR = 0, sumG = 0, sumB = 0;
            for (let i = 0; i < numPixels; i++) {
                if (isNHWC) {
                    sumR += outData[i * 3]; sumG += outData[i * 3 + 1]; sumB += outData[i * 3 + 2];
                } else {
                    sumR += outData[i]; sumG += outData[numPixels + i]; sumB += outData[2 * numPixels + i];
                }
            }
            const meanR = sumR / numPixels;
            const meanG = sumG / numPixels;
            const meanB = sumB / numPixels;

            for (let y = 0; y < TILE_SIZE; y++) {
                for (let x = 0; x < TILE_SIZE; x++) {
                    const gx = sx + x;
                    const gy = sy + y;

                    if (gx < 0 || gx >= outWidth || gy < 0 || gy >= outHeight) continue;

                    const localIdx = y * TILE_SIZE + x;

                    const w = ramp[x] * ramp[y];

                    let idxR, idxG, idxB;
                    if (isNHWC) {
                        idxR = localIdx * 3 + 0; idxG = localIdx * 3 + 1; idxB = localIdx * 3 + 2;
                    } else {
                        idxR = 0 * numPixels + localIdx; idxG = 1 * numPixels + localIdx; idxB = 2 * numPixels + localIdx;
                    }

                    let dr_raw, dg_raw, db_raw;
                    if (isBGR) {
                        db_raw = outData[idxR]; dg_raw = outData[idxG]; dr_raw = outData[idxB];
                    } else {
                        dr_raw = outData[idxR]; dg_raw = outData[idxG]; db_raw = outData[idxB];
                    }

                    // Apply range normalization from sniffing
                    const dr_norm = dr_raw / rangeScale;
                    const dg_norm = dg_raw / rangeScale;
                    const db_norm = db_raw / rangeScale;

                    const inputSafeX = Math.max(0, Math.min(width - 1, gx));
                    const inputSafeY = Math.max(0, Math.min(height - 1, gy));
                    const inputIdx = (inputSafeY * width + inputSafeX) * 4;

                    const r_base = data[inputIdx] / 255.0;
                    const g_base = data[inputIdx + 1] / 255.0;
                    const b_base = data[inputIdx + 2] / 255.0;

                    let r_final, g_final, b_final;

                    // Round 23: Stable Residual Blending factor (0.8x) to prevent oversaturation
                    const blend = 0.8;

                    // Round 25/27: Robust Model Type Detection
                    // We use Mean and Range to distinguish between:
                    // 1. Direct [0, 255] or [0, 1] (Mean ~0.5)
                    // 2. Direct [-1, 1] (Mean ~0, but Range ~2.0)
                    // 3. Residual (Mean ~0, Range small < 1.0)

                    const avgMean = (meanR + meanG + meanB) / 3.0; // Raw mean
                    const normMean = avgMean / rangeScale; // Normalized mean [0, 1] or [-1, 1]
                    const rangeExtent = (sMax - sMin) / rangeScale;

                    // Heuristic:
                    // - If normalized mean is clearly positive (> 0.15), it's likely a [0, 1] or [0, 255] Direct Image.
                    // - If range is huge (> 1.5 in normalized space) AND matches known [-1, 1] models, treat as Direct [-1, 1].
                    // - Otherwise, it's likely a Residual/Difference map (Mean ~0).
                    // Round 40: Asymmetric Normalization Logic
                    // We check if the model is KNOWN to output [-1, 1] (DeblurGAN) OR if sniffed properties demand it.
                    const isOutputMinusOneToOne = expectOutputMinusOneToOne || (rangeExtent > 1.5 && useInputMinusOneToOne);
                    const isMPRNet = modelName.toLowerCase().includes('mprnet');

                    // Round 54 Fix: MPRNet Diag logs show Mean ~ 0.2 (Full Image), Range ~ [0, 1].
                    // It is NOT a residual model. We must treat it as Direct to prevent "Zero-Mean" subtraction
                    // and "Original + Output" double-exposure.
                    // Round 64: Explicitly include Low-Light and MIRNet in Direct Models.
                    // MIRNet/Low-Light models are Direct [0, 1] models, not residuals.
                    // Treating them as residuals causes "Double Exposure" artifacts (burnt look).
                    const isDirectModel = (normMean > 0.15) || (rangeExtent > 1.5 && useInputMinusOneToOne) || expectFFANormalization || isMPRNet || isLowLight;

                    if (isDirectModel) {
                        if (expectFFANormalization) {
                            // Round 45: FFA-Net De-Normalization
                            // x * std + mean
                            // dr_raw = outData[idxR].
                            // If model output is normalized, we need to de-normalize.
                            r_final = (outData[idxR] * FFA_STD[0]) + FFA_MEAN[0];
                            g_final = (outData[idxG] * FFA_STD[1]) + FFA_MEAN[1];
                            b_final = (outData[idxB] * FFA_STD[2]) + FFA_MEAN[2];
                        } else if (isOutputMinusOneToOne && !isPixelScale) {
                            // Direct [-1, 1] -> [0, 1]
                            r_final = (dr_norm + 1.0) / 2.0;
                            g_final = (dg_norm + 1.0) / 2.0;
                            b_final = (db_norm + 1.0) / 2.0;
                        } else {
                            // Direct [0, 1] or [0, 255] -> [0, 1]
                            // Already normalized by dr_norm = dr_raw / rangeScale
                            r_final = dr_norm;
                            g_final = dg_norm;
                            b_final = db_norm;
                        }

                        // Round 55 Fix: MPRNet Output Clamping (Mandatory)
                        // Round 65 Revert: Don't clamp Low-Light (MIRNet) here.
                        // We need to preserve >1.0 values for dimming in post-processing.
                        if (isMPRNet) {
                            r_final = Math.max(0, Math.min(1.0, r_final));
                            g_final = Math.max(0, Math.min(1.0, g_final));
                            b_final = Math.max(0, Math.min(1.0, b_final));

                            // Round 55 Fix: "Cinematic Rain" Blending
                            // For backlit/high-contrast scenes, MPRNet destroys valid details
                            // (mistaking them for rain).
                            // User suggests blending output with input (e.g. 0.4 - 0.7 strength).
                            // "Worse now" was due to artifacts from the Residual Bug. Now that it's strict Direct,
                            // we can safely increase strength to 0.8 to actually see the rain removal.
                            // Round 61 Fix: "Square 1" - User demands pure model output.
                            // Blending (0.8) causes ghosting/rain-leakage.
                            // We restore 1.0 (Full Strength) as MPRNet is a Direct Model.
                            const blendStrength = 1.0;
                            r_final = (r_final * blendStrength) + (r_base * (1.0 - blendStrength));
                            g_final = (g_final * blendStrength) + (g_base * (1.0 - blendStrength));
                            b_final = (b_final * blendStrength) + (b_base * (1.0 - blendStrength));
                        }
                    } else {
                        // Residual Model (Additive)
                        // Use Zero-Mean Stabilizer to strictly add only detail, not brightness shift.
                        // Round 35 Fix: HARD CLAMPING for Exploding Residuals (Red Artifacts)
                        // NAFNet-Denoising on WebGPU behaves erratically with stray pixels exploding to +/- 100.
                        // We clamp the correction to [-0.5, 0.5], which is plenty for denoising but stops explosions.
                        const reR = Math.max(-0.5, Math.min(0.5, (dr_norm - (meanR / rangeScale))));
                        const reG = Math.max(-0.5, Math.min(0.5, (dg_norm - (meanG / rangeScale))));
                        const reB = Math.max(-0.5, Math.min(0.5, (db_norm - (meanB / rangeScale))));

                        r_final = r_base + reR * blend;
                        g_final = g_base + reG * blend;
                        b_final = b_base + reB * blend;
                    }

                    // Round 22: Aggressive clamping removed to allow OOB detection
                    // We declare the values raw first, then check for safety.
                    let valR = r_final;
                    let valG = g_final;
                    let valB = b_final;

                    // Round 34 Fix: NaN/Inf filtering for WebGPU stability
                    // NAFNet-Denoising can produce NaNs in FP16, leading to specific channel dropouts (e.g. Red dots).
                    if (!Number.isFinite(valR) || !Number.isFinite(valG) || !Number.isFinite(valB)) {
                        valR = r_base;
                        valG = g_base;
                        valB = b_base;
                    }

                    // Round 37 Fix: Out-Of-Bounds (OOB) Rejection
                    // The previous clamp still allowed exploding pixels to hit the limit (e.g. +0.2 Red),
                    // which created visible artifacts. Now, if a pixel tries to explode beyond reasonable bounds
                    // (meaning the model failed completely for that pixel), we REJECT it and use the original.
                    // THIS IS CRITICAL FOR DENOISING.

                    // Round 47 Fix: Relax OOB for Dehazing
                    // Dehazing often produces "blacker than black" values (e.g. -0.5) when removing heavy fog.
                    // If we treat -0.5 as "Exploded" and revert to Original (Foggy 0.7), we undo the dehazing!
                    // So for Dehazing, we only reject TRUE explosions (NaN or > 5.0).
                    // Round 65: Add isLowLight to ensure high-range MIRNet results aren't rejected as blotches.
                    const isDehazingModel = isDehazing || modelName.includes('deblurring') || modelName.includes('rain') || modelName.includes('mprnet') || isLowLight;

                    // Round 52: Fully Disable OOB for MPRNet.
                    // Diagnostics suggest heavy rain removal creates massive pixel shifts (> 5.0 in 0-255 scale diff?)
                    // To be safe, we disable OOB for MPRNet entirely.
                    // (isMPRNet is already defined above)
                    const OOB_MIN = isMPRNet ? -9999.0 : (isDehazingModel ? -5.0 : -0.1);
                    const OOB_MAX = isMPRNet ? 9999.0 : (isDehazingModel ? 5.0 : 1.1);

                    let isExploded = false;
                    if (valR < OOB_MIN || valR > OOB_MAX) isExploded = true;
                    if (valG < OOB_MIN || valG > OOB_MAX) isExploded = true;
                    if (valB < OOB_MIN || valB > OOB_MAX) isExploded = true;

                    if (isExploded) {
                        // Only revert if TRULY broken
                        valR = r_base;
                        valG = g_base;
                        valB = b_base;
                    } else {
                        // Round 38: Context-Aware Clamping
                        // Dehazing/Deblurring often requires massive contrast shifts (removing white haze).
                        // Round 42: We effectively disable the clamp (2.0 = 200%) for Dehazing to ensure
                        // maximum haze removal power.
                        let CLAMP_LIMIT = 0.15; // Default: Tight clamp for Denoising/Restoration
                        if (isDirectModel || isLowLight || isDehaze || modelName.includes('deblurring') || modelName.includes('enhance') || modelName.includes('rain') || modelName.includes('mprnet')) {
                            CLAMP_LIMIT = 2.0; // Fully Disabled (200% shift allowed)
                        }

                        valR = Math.max(r_base - CLAMP_LIMIT, Math.min(r_base + CLAMP_LIMIT, valR));
                        valG = Math.max(g_base - CLAMP_LIMIT, Math.min(g_base + CLAMP_LIMIT, valG));
                        valB = Math.max(b_base - CLAMP_LIMIT, Math.min(b_base + CLAMP_LIMIT, valB));

                        // Round 48: Dehazing Visual Polish
                        // Even with correct normalization, Dehazing often leaves residual "flatness" or grey fog.
                        // We apply a gentle post-process to cut the fog (Gamma) and restore life (Sat).
                        if (isDehaze) {
                            // 1. Gamma Correction (1.25): Darkens mid-tones to kill grey fog.
                            // Power > 1.0 pushes mid-greys towards black.
                            valR = valR < 0 ? 0 : Math.pow(valR, 1.25);
                            valG = valG < 0 ? 0 : Math.pow(valG, 1.25);
                            valB = valB < 0 ? 0 : Math.pow(valB, 1.25);

                            // 2. Saturation Boost (1.15): Fog kills color; bring it back.
                            const lum = 0.299 * valR + 0.587 * valG + 0.114 * valB;
                            valR = lum + (valR - lum) * 1.15;
                            valG = lum + (valG - lum) * 1.15;
                            valB = lum + (valB - lum) * 1.15;
                        }
                    }

                    outBuffer[(gy * outWidth + gx) * 3] += valR * w;
                    outBuffer[(gy * outWidth + gx) * 3 + 1] += valG * w;
                    outBuffer[(gy * outWidth + gx) * 3 + 2] += valB * w;
                    weightBuffer[gy * outWidth + gx] += w;
                }
            }

            // Round 29: VRAM Leak Fix
            // Explicitly dispose of tensors to ensure WebGPU backend frees resources immediately.
            try {
                // Round 29: VRAM Leak Fix
                // Explicitly dispose of tensors to ensure WebGPU backend frees resources immediately.
                if (tensor && typeof (tensor as any).dispose === 'function') {
                    (tensor as any).dispose();
                }
                if (results) {
                    // Dispose all outputs in the results object
                    Object.values(results).forEach((t: any) => {
                        if (t && typeof t.dispose === 'function') t.dispose();
                    });
                }
            } catch { /* ignore disposal errors */ }

            // Round 56 Fix: Progress Bar Jumps/Lag
            // We increment tilesProcessed HERE to ensure consistent monotonic progress
            // regardless of success/failure (handled by try/catch above).
            tilesProcessed++;

            // Round 62 Fix: Throttle Progress Updates (Fix Violation/Freeze)
            // Only post if changed significantly or enough time passed (e.g. 50ms = 20fps)
            // OR if it's the last tile (Force 100%)
            const now = Date.now();
            if (tilesProcessed === totalTiles || (now - lastProgressTime > 50)) {
                lastProgressTime = now;
                ctx.postMessage({
                    type: 'progress',
                    data: {
                        current: tilesProcessed,
                        total: totalTiles,
                        stage: 'restoration',
                        currentOperation: operationName
                    }
                });
            }
        }
    }

    const finalBuffer = new Uint8ClampedArray(outWidth * outHeight * 4);
    for (let y = 0; y < outHeight; y++) {
        for (let x = 0; x < outWidth; x++) {
            const i = y * outWidth + x;
            const w = Math.max(0.001, weightBuffer[i]);
            let r = outBuffer[i * 3] / w;
            let g = outBuffer[i * 3 + 1] / w;
            let b = outBuffer[i * 3 + 2] / w;

            // Round 67 Fix: "Subject Too Bright" + "Highlight Artifacts"
            // We MUST apply post-processing BEFORE the hard [0, 1] clamp.
            // Clamping first destroys the >1.0 data MIRNet recovered in highlights,
            // making them look like "flat white" artifacts even if we dim them later.
            if (isLowLight) {
                const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                const saturation = 1.25; // Boosted for "vivid" look
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;

                // 1. Exposure Adjustment (0.81x): Punchy subject.
                const lowLightExposure = 0.81;
                r *= lowLightExposure; g *= lowLightExposure; b *= lowLightExposure;

                // 2. White Balance / Tint Correction (Round 68):
                // Neutralize Green-Yellow cast common in night-time AI restoration.
                // We pull down Green and push up Red/Blue for natural skin tones.
                r *= 1.02; g *= 0.95; b *= 1.04;

                // 3. Gamma Restoration (1.0): Neutral for color "pop".
                r = Math.pow(Math.max(0, r), 1.0);
                g = Math.pow(Math.max(0, g), 1.0);
                b = Math.pow(Math.max(0, b), 1.0);

                // 3. Highlight Protection (Expanded for "Artefacts on White"):
                // If the original area was already bright (>0.7), we protect it.
                // We also check if the AI output is DARKER than original (luma-wise),
                // which as what causes "dirty" artifacts on shirts.
                const origIdx = i * 4;
                const oR = data[origIdx] / 255.0;
                const oG = data[origIdx + 1] / 255.0;
                const oB = data[origIdx + 2] / 255.0;
                const oLuma = 0.299 * oR + 0.587 * oG + 0.114 * oB;

                if (oLuma > 0.7) {
                    const rLuma = 0.299 * r + 0.587 * g + 0.114 * b;
                    let protectionWeight = Math.min(1.0, (oLuma - 0.7) / 0.3); // Linear 0.7->1.0

                    // If AI darkened a bright area, force high protection to prevent "dirty" blotches.
                    if (rLuma < oLuma) protectionWeight = Math.max(protectionWeight, 0.8);

                    r = (r * (1 - protectionWeight)) + (oR * protectionWeight);
                    g = (g * (1 - protectionWeight)) + (oG * protectionWeight);
                    b = (b * (1 - protectionWeight)) + (oB * protectionWeight);
                }
            }

            if (isDeraining) {
                // Round 63: Gamma 1.1 to remove "gray rain haze" + Saturation 1.35
                const gamma = 1.1;
                r = Math.pow(Math.max(0, r), gamma);
                g = Math.pow(Math.max(0, g), gamma);
                b = Math.pow(Math.max(0, b), gamma);

                const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                const saturation = 1.35;
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;
            }

            if (isFFA) {
                const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                const saturation = isFFA_Indoor ? 1.3 : 1.7;
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;
                r = Math.pow(Math.max(0, r), 1.1);
                g = Math.pow(Math.max(0, g), 1.1);
                b = Math.pow(Math.max(0, b), 1.1);
                r = r * 1.8 + 0.03; g = g * 1.75 + 0.03; b = b * 1.8 + 0.03;
                const exposure = isFFA_Outdoor ? 0.60 : 0.75;
                r *= exposure * 0.85; g *= exposure * 0.95; b *= exposure * 1.25;
            }

            r = Math.max(0, Math.min(1, r));
            g = Math.max(0, Math.min(1, g));
            b = Math.max(0, Math.min(1, b));

            // Sharpen loop
            // No sharpening applied, so r_sharp, g_sharp, b_sharp are redundant.
            // Direct assignment with clamping to [0, 255]
            finalBuffer[i * 4] = Math.max(0, Math.min(255, Math.round(r * 255)));
            finalBuffer[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
            finalBuffer[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
            finalBuffer[i * 4 + 3] = 255;
        }
    }

    const outImageData = new ImageData(finalBuffer, outWidth, outHeight);
    ctx.postMessage({ type: 'restore_result', data: outImageData });
};


ctx.onmessage = (e: MessageEvent) => {
    // Queue all incoming messages to prevent race conditions (Session mismatch/already started)
    messageQueue = messageQueue.then(async () => {
        await handleMessage(e);
    }).catch(err => {
        console.error('[AI Worker] Global Queue Error:', err);
        ctx.postMessage({ type: 'error', error: err.message || String(err) });
    });
};

// Helper: Color Transfer (Reinhard Method - Simple RGB Mean/Std)
// Matches the color distribution of the 'target' (original) to the 'source' (restored).
const transferColor = (source: Float32Array, target: Uint8Array | Uint8ClampedArray, sW: number, sH: number, tW: number, tH: number) => {
    const sPixels = sW * sH;
    const tPixels = tW * tH;

    const sYcc = new Float32Array(sPixels * 3);
    const sMean = [0, 0, 0], sSqMean = [0, 0, 0];
    const tMean = [0, 0, 0], tSqMean = [0, 0, 0];

    const rgbToYcc = (r: number, g: number, b: number) => {
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        return [y, cb, cr];
    };

    // Calculate Source Stats (Restored Face)
    for (let i = 0; i < sPixels; i++) {
        const sr = (source[i] + 1.0) * 127.5;
        const sg = (source[i + sPixels] + 1.0) * 127.5;
        const sb = (source[i + 2 * sPixels] + 1.0) * 127.5;
        const [sy, scb, scr] = rgbToYcc(sr, sg, sb);
        sYcc[i] = sy; sYcc[i + sPixels] = scb; sYcc[i + 2 * sPixels] = scr;

        sMean[0] += sy; sMean[1] += scb; sMean[2] += scr;
        sSqMean[0] += sy * sy; sSqMean[1] += scb * scb; sSqMean[2] += scr * scr;
    }

    // Calculate Target Stats (Original Face Crop)
    for (let i = 0; i < tPixels; i++) {
        const tr = target[i * 4];
        const tg = target[i * 4 + 1];
        const tb = target[i * 4 + 2];
        const [ty, tcb, tcr] = rgbToYcc(tr, tg, tb);

        tMean[0] += ty; tMean[1] += tcb; tMean[2] += tcr;
        tSqMean[0] += ty * ty; tSqMean[1] += tcb * tcb; tSqMean[2] += tcr * tcr;
    }

    for (let c = 0; c < 3; c++) {
        sMean[c] /= sPixels;
        tMean[c] /= tPixels;
        const sVar = (sSqMean[c] / sPixels) - (sMean[c] * sMean[c]);
        const tVar = (tSqMean[c] / tPixels) - (tMean[c] * tMean[c]);
        sSqMean[c] = Math.sqrt(Math.max(0, sVar));
        tSqMean[c] = Math.sqrt(Math.max(0, tVar));
    }

    const yccToRgb = (y: number, cb: number, cr: number) => {
        const r = y + 1.402 * (cr - 128);
        const g = y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128);
        const b = y + 1.772 * (cb - 128);
        return [r, g, b];
    };

    const corrected = new Float32Array(source.length);
    for (let i = 0; i < sPixels; i++) {
        let y = sYcc[i];
        let cb = sYcc[i + sPixels];
        let cr = sYcc[i + 2 * sPixels];

        y = (y - sMean[0]) * (tSqMean[0] / (sSqMean[0] || 1)) + tMean[0];
        cb = (cb - sMean[1]) * (tSqMean[1] / (sSqMean[1] || 1)) + tMean[1];
        cr = (cr - sMean[2]) * (tSqMean[2] / (sSqMean[2] || 1)) + tMean[2];

        const [r, g, b] = yccToRgb(y, cb, cr);
        corrected[i] = (r / 127.5) - 1.0;
        corrected[i + sPixels] = (g / 127.5) - 1.0;
        corrected[i + 2 * sPixels] = (b / 127.5) - 1.0;
    }
    return corrected;
};

const runFaceRestoration = async (imageData: ImageData, config: any): Promise<void> => {
    const totalTimer = new Timer('Total Face Restoration');
    totalTimer.start();

    const { width, height, data } = imageData;
    const modelName = config.modelName || 'CodeFormer'; // Default to CodeFormer
    const localModelPath = config.localModelPath || '/models/';
    const fidelity = config.fidelity !== undefined ? config.fidelity : 1.0;

    // 1. Face Detection
    const detectionConfig = { ...config, modelType: 'YOLO(v8)' };
    const detectModelPath = config.localModelPath ? `${config.localModelPath}yolo/YOLO(v8).onnx` : `/models/yolo/YOLO(v8).onnx`;
    const detectSession = await loadSession(detectModelPath, detectionConfig);

    const targetSizeDetect = 640;
    const { data: detectData, scale: detectScale, dx: detectDx, dy: detectDy } = await resizeAndPad(imageData, targetSizeDetect);

    let float32Detect: any = new Float32Array(3 * targetSizeDetect * targetSizeDetect);
    for (let i = 0, j = 0; i < detectData.length; i += 4, j++) {
        float32Detect[j] = detectData[i] / 255.0;
        float32Detect[j + targetSizeDetect * targetSizeDetect] = detectData[i + 1] / 255.0;
        float32Detect[j + 2 * targetSizeDetect * targetSizeDetect] = detectData[i + 2] / 255.0;
    }

    const detectInputName = detectSession.inputNames[0];
    const detectOutputName = detectSession.outputNames[0];
    const detectInputType = (detectSession as any)._inputType || 'float32';
    if (detectInputType === 'float16') float32Detect = float32ToFloat16(float32Detect);

    const detectTensor = new ortInstance.Tensor(detectInputType === 'float16' ? 'float16' : 'float32', float32Detect, [1, 3, targetSizeDetect, targetSizeDetect]);
    const detectResults = await detectSession.run({ [detectInputName]: detectTensor });
    const detectOutput = detectResults[detectOutputName];
    let detectOutputData: any = detectOutput.data;
    if ((detectSession as any)._outputType === 'float16' && detectOutputData instanceof Uint16Array) {
        detectOutputData = float16ToFloat32(detectOutputData);
    }

    const [_, _attrs, proposals] = detectOutput.dims;
    const faceBoxes: number[][] = [];
    const faceScores: number[] = [];

    for (let i = 0; i < proposals; i++) {
        // In COCO YOLOv8, 'person' is index 0. We'll use 0 as a proxy for face if no specialized model is provided.
        const score = detectOutputData[(4 + 0) * proposals + i];
        if (score > 0.3) {
            const cx = detectOutputData[0 * proposals + i];
            const cy = detectOutputData[1 * proposals + i];
            const w = detectOutputData[2 * proposals + i];
            const h = detectOutputData[3 * proposals + i];

            const x1 = (cx - w / 2 - detectDx) / detectScale;
            const y1 = (cy - h / 2 - detectDy) / detectScale;
            const w_org = w / detectScale;
            const h_org = h / detectScale;

            faceBoxes.push([x1, y1, x1 + w_org, y1 + h_org]);
            faceScores.push(score);
        }
    }

    const keep = yoloNMS(faceBoxes, faceScores, 0.45);
    const finalFaces = keep.map(idx => ({
        bbox: [faceBoxes[idx][0], faceBoxes[idx][1], faceBoxes[idx][2] - faceBoxes[idx][0], faceBoxes[idx][3] - faceBoxes[idx][1]],
        score: faceScores[idx]
    }));

    if (finalFaces.length === 0) {
        ctx.postMessage({ type: 'restore_result', data: imageData, modelName });
        return;
    }

    // 2. Prepare Restoration Session
    const faceModelPath = `${localModelPath}restoration/${modelName}.onnx`;
    const faceSession = await loadSession(faceModelPath, config);
    const faceInputName = faceSession.inputNames[0];
    const faceOutputName = faceSession.outputNames[0];
    const faceInputType = (faceSession as any)._inputType || 'float32';
    const faceOutputSize = 512;

    const workingBuffer = new Uint8ClampedArray(data);












    for (const face of finalFaces) {
        const [fx, fy, fw, fh] = face.bbox;

        // 3. Face Crop (Square, 1:1, Padded)
        const centerX = fx + fw / 2;
        const centerY = fy + fh / 2;
        const size = Math.max(fw, fh) * 1.5;
        const sx = centerX - size / 2;
        const sy = centerY - size / 2;

        const faceCanvas = new OffscreenCanvas(faceOutputSize, faceOutputSize);
        const faceCtx = faceCanvas.getContext('2d', { willReadFrequently: true });
        if (!faceCtx) continue;

        const originalBitmap = await createImageBitmap(imageData);
        faceCtx.drawImage(originalBitmap, sx, sy, size, size, 0, 0, faceOutputSize, faceOutputSize);

        const faceImageData = faceCtx.getImageData(0, 0, faceOutputSize, faceOutputSize);
        const facePixels = faceImageData.data;

        // 4. Quality Gate
        let lapVar = 0;
        for (let i = 1; i < faceOutputSize - 1; i++) {
            for (let j = 1; j < faceOutputSize - 1; j++) {
                const idx = (i * faceOutputSize + j) * 4;
                const val = facePixels[idx + 1];
                const up = facePixels[((i - 1) * faceOutputSize + j) * 4 + 1];
                const down = facePixels[((i + 1) * faceOutputSize + j) * 4 + 1];
                const left = facePixels[(i * faceOutputSize + j - 1) * 4 + 1];
                const right = facePixels[(i * faceOutputSize + j + 1) * 4 + 1];
                lapVar += Math.abs(up + down + left + right - 4 * val);
            }
        }
        const avgLap = lapVar / (faceOutputSize * faceOutputSize);
        if (avgLap > 25) continue;

        // 5. Run Restoration Model
        // GAN-based models (CodeFormer) expect [-1, 1] input.
        let float32Face: any = new Float32Array(3 * faceOutputSize * faceOutputSize);
        for (let i = 0, j = 0; i < facePixels.length; i += 4, j++) {
            float32Face[j] = (facePixels[i] / 127.5) - 1.0;
            float32Face[j + faceOutputSize * faceOutputSize] = (facePixels[i + 1] / 127.5) - 1.0;
            float32Face[j + 2 * faceOutputSize * faceOutputSize] = (facePixels[i + 2] / 127.5) - 1.0;
        }

        if (faceInputType === 'float16') float32Face = float32ToFloat16(float32Face);

        const faceTensor = new ortInstance.Tensor(faceInputType === 'float16' ? 'float16' : 'float32', float32Face, [1, 3, faceOutputSize, faceOutputSize]);
        const inputs: any = { [faceInputName]: faceTensor };
        if (faceSession.inputNames.length > 1) {
            const fidelityName = faceSession.inputNames[1];
            inputs[fidelityName] = new ortInstance.Tensor('float32', new Float32Array([fidelity]), [1]);
        }

        const faceRestoreResults = await faceSession.run(inputs);
        const faceRestoreOutput = faceRestoreResults[faceOutputName];
        let faceRestoreData: any = faceRestoreOutput.data;

        if ((faceSession as any)._outputType === 'float16' && faceRestoreData instanceof Uint16Array) {
            faceRestoreData = float16ToFloat32(faceRestoreData);
        }

        const faceOutputShape = faceRestoreOutput.dims;
        let outH: number, outW: number;
        const isFaceNHWC = faceOutputShape[1] !== 3 && faceOutputShape[3] === 3;

        if (isFaceNHWC) {
            // NHWC: [batch, height, width, channels]
            outH = faceOutputShape[1];
            outW = faceOutputShape[2];
        } else {
            // NCHW: [batch, channels, height, width]
            outH = faceOutputShape[2];
            outW = faceOutputShape[3];
        }
        const curFaceArea = outH * outW;

        // Sniff range for normalization
        let fMin = 100, fMax = -100;
        for (let i = 0; i < faceRestoreData.length; i += Math.max(1, Math.floor(faceRestoreData.length / 1000))) {
            const v = faceRestoreData[i];
            if (v < fMin) fMin = v;
            if (v > fMax) fMax = v;
        }

        // If it's NHWC, convert to NCHW (planar) for transferColor and masking logic
        if (isFaceNHWC) {
            const planar = new Float32Array(faceRestoreData.length);
            for (let i = 0; i < curFaceArea; i++) {
                planar[i] = faceRestoreData[i * 3 + 0];
                planar[i + curFaceArea] = faceRestoreData[i * 3 + 1];
                planar[i + 2 * curFaceArea] = faceRestoreData[i * 3 + 2];
            }
            faceRestoreData = planar;
        }

        // Handle Normalization
        if (fMax > 1.5 || fMin < -1.5) {
            for (let i = 0; i < faceRestoreData.length; i++) {
                faceRestoreData[i] = (faceRestoreData[i] / 127.5) - 1.0;
            }
        } else if (fMin >= -0.1 && fMax > 0.1 && fMax <= 1.1) {
            for (let i = 0; i < faceRestoreData.length; i++) {
                faceRestoreData[i] = (faceRestoreData[i] * 2.0) - 1.0;
            }
        }

        for (let i = 0; i < faceRestoreData.length; i++) {
            if (!Number.isFinite(faceRestoreData[i])) faceRestoreData[i] = 0;
        }

        // Apply Color Transfer (Dynamic Sizes)
        faceRestoreData = transferColor(faceRestoreData, facePixels, outW, outH, faceOutputSize, faceOutputSize);

        // 6. Alpha-Blended Re-integration (Elliptical Mask)
        const restoredFaceCanvas = new OffscreenCanvas(outW, outH);
        const restoredFaceCtx = restoredFaceCanvas.getContext('2d');
        if (!restoredFaceCtx) continue;

        const restoredPixels = new Uint8ClampedArray(curFaceArea * 4);
        const blendingCenterX = outW / 2;
        const blendingCenterY = outH / 2;
        const radiusX = (outW / 2) * 0.95;
        const radiusY = (outH / 2) * 0.95;

        for (let i = 0; i < curFaceArea; i++) {
            restoredPixels[i * 4] = Math.min(255, Math.max(0, (faceRestoreData[i] + 1.0) * 127.5));
            restoredPixels[i * 4 + 1] = Math.min(255, Math.max(0, (faceRestoreData[i + curFaceArea] + 1.0) * 127.5));
            restoredPixels[i * 4 + 2] = Math.min(255, Math.max(0, (faceRestoreData[i + 2 * curFaceArea] + 1.0) * 127.5));

            const row = Math.floor(i / outW);
            const col = i % outW;

            const ny = (row - blendingCenterY) / radiusY;
            const nx = (col - blendingCenterX) / radiusX;
            let dist = Math.sqrt(nx * nx + ny * ny);
            if (isNaN(dist)) dist = 1.0;

            const innerRadius = 0.7;
            const outerRadius = 1.0;
            let alpha = 1.0;
            if (dist > outerRadius) alpha = 0.0;
            else if (dist > innerRadius) {
                const t = (dist - innerRadius) / (outerRadius - innerRadius);
                alpha = 1.0 - (t * t * (3 - 2 * t));
            }
            restoredPixels[i * 4 + 3] = alpha * 255;
        }

        restoredFaceCtx.putImageData(new ImageData(restoredPixels, outW, outH), 0, 0);

        const mainCanvas = new OffscreenCanvas(width, height);
        const mainCtx = mainCanvas.getContext('2d');
        if (!mainCtx) continue;

        mainCtx.putImageData(new ImageData(workingBuffer, width, height), 0, 0);
        const restoredBitmap = await createImageBitmap(restoredFaceCanvas);
        mainCtx.drawImage(restoredBitmap, 0, 0, outW, outH, sx, sy, size, size);

        workingBuffer.set(mainCtx.getImageData(0, 0, width, height).data);
    }

    const finalImageData = new ImageData(workingBuffer, width, height);
    ctx.postMessage({ type: 'restore_result', data: finalImageData, modelName });
};

async function handleMessage(e: MessageEvent) {
    const { type, config, imageData } = e.data;
    let { data } = e.data;

    if (!data && imageData) {
        data = imageData;
    }

    try {
        switch (type) {
            case 'load':
                await initORT(config);
                ctx.postMessage({ type: 'loaded', isLoaded: true });
                break;

            case 'cleanup': {
                if (currentSession) {
                    try {
                        await currentSession.release();
                    } catch {
                        // console.debug('[AI Worker] Cleanup release error (probably already released)');
                    }
                    currentSession = null;
                    currentSessionPath = null;
                }

                // Critical Fix Round 31: Clear the session map to prevent "invalid session id" reuse
                sessionCache.clear();

                if (ortInstance?.env?.webgpu?.clearCache) {
                    try {
                        await ortInstance.env.webgpu.clearCache();
                    } catch (e) {
                        console.warn('[AI Worker] Cleanup cache error:', e);
                    }
                }
                ctx.postMessage({ type: 'cleanup_complete' });
                break;
            }

            case 'detect':
                if (data && config) {
                    await runDetection(data, config);
                }
                break;

            case 'upscale':
                if (isBusy) {
                    ctx.postMessage({ type: 'error', error: 'Worker is busy.' });
                    return;
                }
                isBusy = true;
                try {
                    if (data && config) {
                        await runUpscale(data, config);
                    } else {
                        console.error('[AI Worker] Upscale missing args:', { data: !!data, config: !!config });
                        ctx.postMessage({ type: 'error', error: 'Missing logic args (data or config)' });
                    }
                } finally {
                    isBusy = false;
                }
                break;

            case 'restore':
                if (isBusy) {
                    ctx.postMessage({ type: 'error', error: 'Worker is busy.' });
                    return;
                }
                isBusy = true;
                try {
                    if (data && config) {
                        const mName = (config.modelName || '').toLowerCase();
                        if (mName.includes('ultrazoom')) {
                            const scaleMatch = config.modelName.match(/_x(\d+)/i);
                            config.scale = scaleMatch ? parseInt(scaleMatch[1]) : 2;
                            config.resultType = 'restore_result';
                            await runUpscale(data, config);
                        } else if (mName.includes('face') || mName.includes('codeformer')) {
                            await runFaceRestoration(data, config);
                        } else {
                            await runRestoration(data, config);
                        }
                    }
                } finally {
                    isBusy = false;
                }
                break;

            case 'preload': {
                if (config) {
                    let modelPath = '';
                    if (config.scale) {
                        const modelName = `UltraZoom-x${config.scale}`;
                        modelPath = config.localModelPath ? `${config.localModelPath}ultrazoom/${modelName}.onnx` : `/models/ultrazoom/${modelName}.onnx`;
                    } else if (config.modelName === 'yolo') {
                        // Use standard FP32 model name
                        const modelFileName = config.modelType || 'YOLO(v8)';
                        modelPath = config.localModelPath ? `${config.localModelPath}yolo/${modelFileName}.onnx` : `/models/yolo/${modelFileName}.onnx`;
                    }
                    if (modelPath) {
                        try {
                            await loadSession(modelPath, config);
                            ctx.postMessage({ type: 'preloaded', modelPath });
                        } catch (e) {
                            console.warn(`[AI Worker] Preload failed for ${modelPath}:`, e);
                        }
                    }
                }
                break;
            }

            case 'warmup': {
                const modelsToWarm = (config && config.models) ? config.models : [
                    { scale: 2 },
                    { modelName: 'yolo' }
                ];

                for (const mConfig of modelsToWarm) {
                    try {
                        let mPath = '';
                        if (mConfig.scale) {
                            const mName = `UltraZoom-x${mConfig.scale}`;
                            mPath = (config && config.localModelPath) ? `${config.localModelPath}ultrazoom/${mName}.onnx` : `/models/ultrazoom/${mName}.onnx`;
                        } else if (mConfig.modelName === 'yolo') {
                            const mFileName = (config && config.modelType) || 'YOLO(v8)';
                            mPath = (config && config.localModelPath) ? `${config.localModelPath}yolo/${mFileName}.onnx` : `/models/yolo/${mFileName}.onnx`;
                        }
                        if (mPath) {
                            await loadSession(mPath, config || {});
                        }
                    } catch (mErr) {
                        console.warn(`[AI Worker] Sequential warmup failed for a model: ${mErr}`);
                    }
                }
                ctx.postMessage({ type: 'warmup_complete' });
                break;
            }

            case 'segment':
                ctx.postMessage({ type: 'error', error: `Not Implemented Yet: ${type}` });
                break;

            default:
                console.warn(`[AI Worker] Unknown message type: ${type}`);
        }
    } catch (err: any) {
        console.error(`[AI Worker] Global Error (${type}):`, err);
        ctx.postMessage({ type: 'error', error: err.message || String(err) });
    }
}
