/**
 * @file ai.worker.ts
 * @description Pure ONNX Runtime Web Worker for Image LemGendizer (WebGPU)
 */

interface AIWorkerMessage {
    type: 'load' | 'upscale' | 'detect' | 'restore' | 'segment' | 'dispose';
    config?: any;
    data?: any;
    scale?: number;
    modelName?: string;
}

let ortInstance: any = null;
let currentSession: any = null;
let currentSessionPath: string | null = null;
let messageQueue: Promise<void> = Promise.resolve();

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
        try {
            await currentSession.release();
        } catch (e) { console.warn('Session release error:', e); }
        currentSession = null;
        currentSessionPath = null;

        if (ortInstance.env.webgpu && ortInstance.env.webgpu.clearCache) {
            try { await ortInstance.env.webgpu.clearCache(); } catch (_) { /* ignored */ }
        }
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
        const handlers = (session as any)._sessionHandler || (session as any).handler;
        const handlerName = handlers?.constructor?.name || 'unknown';
        const protoName = Object.getPrototypeOf(handlers || {}).constructor?.name || 'unknown';
        const sessionEPs = (session as any).executionProviders || [];

        const requestedOnlyWebGPU = sessionOptions.executionProviders.length === 1 && sessionOptions.executionProviders[0] === 'webgpu';

        const actualEP = (handlerName.toLowerCase().includes('webgpu') ||
            protoName.toLowerCase().includes('webgpu') ||
            handlers?.proxy ||
            sessionEPs.includes('webgpu') ||
            (requestedOnlyWebGPU && handlerName !== 'unknown')) ? 'webgpu' : 'wasm';

        if (isRestoration && actualEP === 'wasm') {
            console.error('[AI Worker] Fell back to WASM');
        }

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

            const inputName = session.inputNames[0];

            let useFP16 = modelPath.toLowerCase().includes('-fp16');

            try {
                if (useFP16) {
                    throw new Error('HINT: expected: (tensor(float16))');
                }
                const dummyData = new Float32Array(size).fill(0.5);
                const tensor = new ortInstance.Tensor('float32', dummyData, dims);
                await session.run({ [inputName]: tensor });
            } catch (wError: any) {
                const errorMsg = wError.message || String(wError);
                if (errorMsg.includes('expected: (tensor(float16))')) {
                    useFP16 = true;
                    (session as any)._inputType = 'float16';
                    (session as any)._outputType = 'float16';

                    const dummyDataF16 = float32ToFloat16(new Float32Array(size).fill(0.5));
                    const tensorF16 = new ortInstance.Tensor('float16', dummyDataF16, dims);
                    await session.run({ [inputName]: tensorF16 });
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
    const modelPath = safeConfig.localModelPath ? `${safeConfig.localModelPath}yolo/yolov8n-fp16.onnx` : '/models/yolo/yolov8n-fp16.onnx';

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

    const modelName = `UltraZoom_x${scale}`;
    const modelPath = config.localModelPath ? `${config.localModelPath}ultrazoom/${modelName}.onnx` : `/models/ultrazoom/${modelName}.onnx`;

    const session = await loadSession(modelPath, config);

    const TILE_SIZE = 512;
    const OVERLAP = 64;

    const { width, height, data } = imageData;
    const outWidth = width * scale;
    const outHeight = height * scale;

    const outBuffer = new Uint8ClampedArray(outWidth * outHeight * 4);

    const extractTile = (sx: number, sy: number, sw: number, sh: number) => {
        const tileData = new Float32Array(3 * sw * sh);
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const srcIdx = ((sy + y) * width + (sx + x)) * 4;
                const dstIdx = (y * sw + x);
                tileData[dstIdx] = data[srcIdx] / 255.0;
                tileData[dstIdx + sw * sh] = data[srcIdx + 1] / 255.0;
                tileData[dstIdx + 2 * sw * sh] = data[srcIdx + 2] / 255.0;
            }
        }
        return tileData;
    };

    const effectiveTileIn = TILE_SIZE - 2 * OVERLAP;
    const effectiveTileOut = effectiveTileIn * scale;

    if (effectiveTileIn <= 0) throw new Error("Overlap too large for tile size");

    const cols = Math.ceil(width / effectiveTileIn);
    const rows = Math.ceil(height / effectiveTileIn);

    const totalTiles = rows * cols;
    let tilesProcessed = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const sx = c * effectiveTileIn - OVERLAP;
            const sy = r * effectiveTileIn - OVERLAP;

            const readX = Math.max(0, sx);
            const readY = Math.max(0, sy);
            const readW = Math.min(width - readX, TILE_SIZE);
            const readH = Math.min(height - readY, TILE_SIZE);

            let tileTensorData: any = extractTile(readX, readY, readW, readH);
            const inputName = session.inputNames[0];
            const outputName = session.outputNames[0];
            const inputType = (session as any)._inputType || 'float32';
            const outputType = (session as any)._outputType || 'float32';

            if (inputType === 'float16') {
                tileTensorData = float32ToFloat16(tileTensorData);
            }

            const tensor = new ortInstance.Tensor(inputType, tileTensorData, [1, 3, readH, readW]);

            const results = await session.run({ [inputName]: tensor });
            const output = results[outputName];
            let outData: any = output.data;

            if (outputType === 'float16' && outData instanceof Uint16Array) {
                outData = float16ToFloat32(outData);
            }

            const tileH_out = readH * scale;
            const tileW_out = readW * scale;

            const destX = c * effectiveTileOut;
            const destY = r * effectiveTileOut;
            const destW = Math.min(outWidth - destX, effectiveTileOut);
            const destH = Math.min(outHeight - destY, effectiveTileOut);

            const srcOffX = (c * effectiveTileIn - readX) * scale;
            const srcOffY = (r * effectiveTileIn - readY) * scale;

            for (let y = 0; y < destH; y++) {
                for (let x = 0; x < destW; x++) {
                    const srcX_local = Math.floor(srcOffX + x);
                    const srcY_local = Math.floor(srcOffY + y);

                    const idxR = 0 * tileH_out * tileW_out + srcY_local * tileW_out + srcX_local;
                    const idxG = 1 * tileH_out * tileW_out + srcY_local * tileW_out + srcX_local;
                    const idxB = 2 * tileH_out * tileW_out + srcY_local * tileW_out + srcX_local;

                    const rVal = Math.min(255, Math.max(0, outData[idxR] * 255));
                    const gVal = Math.min(255, Math.max(0, outData[idxG] * 255));
                    const bVal = Math.min(255, Math.max(0, outData[idxB] * 255));

                    const dstIdx = ((destY + y) * outWidth + (destX + x)) * 4;
                    outBuffer[dstIdx] = rVal;
                    outBuffer[dstIdx + 1] = gVal;
                    outBuffer[dstIdx + 2] = bVal;
                    outBuffer[dstIdx + 3] = 255;
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

    const outImageData = new ImageData(outBuffer, outWidth, outHeight);
    ctx.postMessage({
        type: config.resultType || 'upscale_result',
        data: outImageData,
        model: modelName,
        scale: scale
    });
};

const runRestoration = async (imageData: ImageData, config: any) => {
    const totalTimer = new Timer('Total Restoration');
    totalTimer.start();

    const modelName = config.modelName || 'MPRNet-Deraining';
    const modelPath = config.localModelPath ? `${config.localModelPath}restoration/${modelName}.onnx` : `/models/restoration/${modelName}.onnx`;

    const session = await loadSession(modelPath, config);

    const isLowLight = modelName.toLowerCase().includes('lowlight') || modelName.toLowerCase().includes('mirnet');
    const isDeblur = modelName.toLowerCase().includes('deblur');
    const isDenoise = modelName.toLowerCase().includes('denoising');
    const isDeraining = modelName.toLowerCase().includes('deraining');
    const TILE_SIZE = (isLowLight || isDeblur || isDenoise || isDeraining) ? 512 : 768;
    const { width, height, data } = imageData;
    const outWidth = width;
    const outHeight = height;

    const outBuffer = new Float32Array(outWidth * outHeight * 3);
    const weightBuffer = new Float32Array(outWidth * outHeight);
    const ramp = new Float32Array(TILE_SIZE);

    const OVERLAP = 160;
    const STEP = TILE_SIZE - OVERLAP;

    const cols = Math.ceil(width / STEP) + 1;
    const rows = Math.ceil(height / STEP) + 1;

    const isDehaze = modelName.toLowerCase().includes('dehazing');
    const isFFA = modelName.toLowerCase().includes('ffanet');
    const isFFA_Indoor = isFFA && modelName.toLowerCase().includes('indoor');
    const isFFA_Outdoor = isFFA && modelName.toLowerCase().includes('outdoor');
    const isNAFNet = modelName.toLowerCase().includes('nafnet');
    const isBGR = isNAFNet && isDeblur;
    const isMinusOneToOne = (isFFA || isDehaze || modelName.toLowerCase().includes('deblurgan'));
    const isResidualModel = false;

    const getHumanName = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('lowlight')) return 'Low-Light Enhancement';
        if (n.includes('deraining')) return 'Deraining';
        if (n.includes('ffanet-dehazing_outdoor')) return 'Dehazing (Outdoor)';
        if (n.includes('ffanet-dehazing_indoor')) return 'Dehazing (Indoor)';
        if (n.includes('dehazing')) return 'AI Dehazing';
        if (n.includes('deblurring_gopro')) return 'Deblurring (GoPro)';
        if (n.includes('deblurring_reds')) return 'Deblurring (REDS)';
        if (n.includes('denoising')) return 'Denoising (SIDD)';
        if (n.includes('deblurgan-v2-inception')) return 'DeblurGANv2 (Inception)';
        if (n.includes('deblurgan')) return 'DeblurGANv2';
        return 'Restoring';
    };

    const operationName = getHumanName(modelName);

    for (let i = 0; i < TILE_SIZE; i++) {
        let w = 1.0;
        if (i < OVERLAP) w = i / OVERLAP;
        else if (i > TILE_SIZE - OVERLAP) w = (TILE_SIZE - i) / OVERLAP;
        ramp[i] = w;
    }

    let tilesProcessed = 0;
    const totalTiles = rows * cols;
    const persistentTileScale = 1.0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let sx = c * STEP;
            let sy = r * STEP;
            if (sx + TILE_SIZE > width) sx = width - TILE_SIZE;
            if (sy + TILE_SIZE > height) sy = height - TILE_SIZE;
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
                        const scale = isMinusOneToOne ? 127.5 : 255.0;
                        const shift = isMinusOneToOne ? 1.0 : 0.0;
                        tileData[dstIdx] = (data[srcIdx + 2] / scale) - shift; // Blue
                        tileData[dstIdx + TILE_SIZE * TILE_SIZE] = (data[srcIdx + 1] / scale) - shift; // Green
                        tileData[dstIdx + 2 * TILE_SIZE * TILE_SIZE] = (data[srcIdx] / scale) - shift; // Red
                    } else if (isMinusOneToOne) {
                        tileData[dstIdx] = (data[srcIdx] / 127.5) - 1.0;
                        tileData[dstIdx + TILE_SIZE * TILE_SIZE] = (data[srcIdx + 1] / 127.5) - 1.0;
                        tileData[dstIdx + 2 * TILE_SIZE * TILE_SIZE] = (data[srcIdx + 2] / 127.5) - 1.0;
                    } else {
                        tileData[dstIdx] = data[srcIdx] / 255.0;
                        tileData[dstIdx + TILE_SIZE * TILE_SIZE] = data[srcIdx + 1] / 255.0;
                        tileData[dstIdx + 2 * TILE_SIZE * TILE_SIZE] = data[srcIdx + 2] / 255.0;
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

            const tensor = new ortInstance.Tensor(inputType, tileData, [1, 3, TILE_SIZE, TILE_SIZE]);
            const results = await session.run({ [inputName]: tensor });
            const output = results[outputName];
            let outData: any = output.data;

            if (outputType === 'float16') {
                if (outData instanceof Uint16Array) outData = float16ToFloat32(outData);
                else if (typeof Float16Array !== 'undefined' && outData instanceof Float16Array) outData = Float32Array.from(outData);
            }

            const outputShape = output.dims;
            const isNHWC = outputShape[1] !== 3 && outputShape[3] === 3;
            const numPixels = TILE_SIZE * TILE_SIZE;

            const tileScale = isNAFNet ? 1.0 : persistentTileScale;

            for (let y = 0; y < TILE_SIZE; y++) {
                for (let x = 0; x < TILE_SIZE; x++) {
                    const gx = sx + x;
                    const gy = sy + y;

                    if (gx < 0 || gx >= outWidth || gy < 0 || gy >= outHeight) continue;

                    const localIdx = y * TILE_SIZE + x;

                    let wx = ramp[x];
                    let wy = ramp[y];

                    if (sx === 0 && x < OVERLAP) wx = 1.0;
                    if (sx + TILE_SIZE >= width && x >= TILE_SIZE - OVERLAP) wx = 1.0;
                    if (sy === 0 && y < OVERLAP) wy = 1.0;
                    if (sy + TILE_SIZE >= height && y >= TILE_SIZE - OVERLAP) wy = 1.0;

                    const w = wx * wy;

                    let idxR, idxG, idxB;
                    if (isNHWC) {
                        idxR = localIdx * 3 + 0; idxG = localIdx * 3 + 1; idxB = localIdx * 3 + 2;
                    } else {
                        idxR = 0 * numPixels + localIdx; idxG = 1 * numPixels + localIdx; idxB = 2 * numPixels + localIdx;
                    }

                    let dr_raw, dg_raw, db_raw;
                    if (isBGR) {
                        db_raw = outData[idxR];
                        dg_raw = outData[idxG];
                        dr_raw = outData[idxB];
                    } else {
                        dr_raw = outData[idxR]; dg_raw = outData[idxG]; db_raw = outData[idxB];
                    }

                    if (isMinusOneToOne) {
                        dr_raw = (dr_raw + 1.0) / 2.0;
                        dg_raw = (dg_raw + 1.0) / 2.0;
                        db_raw = (db_raw + 1.0) / 2.0;
                    }

                    const inputSafeX = Math.max(0, Math.min(width - 1, gx));
                    const inputSafeY = Math.max(0, Math.min(height - 1, gy));
                    const inputIdx = (inputSafeY * width + inputSafeX) * 4;

                    const r_base = data[inputIdx] / 255.0;
                    const g_base = data[inputIdx + 1] / 255.0;
                    const b_base = data[inputIdx + 2] / 255.0;

                    let dr = isResidualModel ? dr_raw * tileScale : (dr_raw - r_base) * tileScale;
                    let dg = isResidualModel ? dg_raw * tileScale : (dg_raw - g_base) * tileScale;
                    let db = isResidualModel ? db_raw * tileScale : (db_raw - b_base) * tileScale;

                    if (isNaN(dr) || !isFinite(dr)) dr = 0;
                    if (isNaN(dg) || !isFinite(dg)) dg = 0;
                    if (isNaN(db) || !isFinite(db)) db = 0;

                    if (!isNAFNet && !isDeblur && !isDeraining && !isLowLight) {
                        const LIMIT = 0.12;
                        dr = Math.max(-LIMIT, Math.min(LIMIT, dr));
                        dg = Math.max(-LIMIT, Math.min(LIMIT, dg));
                        db = Math.max(-LIMIT, Math.min(LIMIT, db));
                    }

                    outBuffer[(gy * outWidth + gx) * 3] += (r_base + dr) * w;
                    outBuffer[(gy * outWidth + gx) * 3 + 1] += (g_base + dg) * w;
                    outBuffer[(gy * outWidth + gx) * 3 + 2] += (b_base + db) * w;
                    weightBuffer[gy * outWidth + gx] += w;
                }
            }

            tilesProcessed++;

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

    const finalMin = [0.0, 0.0, 0.0];
    const finalMax = [1.0, 1.0, 1.0];

    if (isFFA || isLowLight || isDeblur || isDenoise || isDeraining) {
        const lowIdx = Math.floor(outWidth * outHeight * 0.005);
        const highIdx = Math.floor(outWidth * outHeight * 0.995);

        const channelValues: Float32Array[] = [
            new Float32Array(outWidth * outHeight),
            new Float32Array(outWidth * outHeight),
            new Float32Array(outWidth * outHeight)
        ];

        for (let i = 0; i < outWidth * outHeight; i++) {
            const w = Math.max(0.001, weightBuffer[i]);
            const r_raw = outBuffer[i * 3] / w;
            const g_raw = outBuffer[i * 3 + 1] / w;
            const b_raw = outBuffer[i * 3 + 2] / w;

            channelValues[0][i] = (isNaN(r_raw) || !isFinite(r_raw)) ? 0.0 : r_raw;
            channelValues[1][i] = (isNaN(g_raw) || !isFinite(g_raw)) ? 0.0 : g_raw;
            channelValues[2][i] = (isNaN(b_raw) || !isFinite(b_raw)) ? 0.0 : b_raw;
        }

        for (let ch = 0; ch < 3; ch++) {
            channelValues[ch].sort();
            finalMin[ch] = channelValues[ch][lowIdx];
            finalMax[ch] = channelValues[ch][highIdx];
        }
    }

    const processedBuffer = new Float32Array(outWidth * outHeight * 3);
    for (let y = 0; y < outHeight; y++) {
        for (let x = 0; x < outWidth; x++) {
            const i = y * outWidth + x;
            const w = Math.max(0.001, weightBuffer[i]);
            let r = outBuffer[i * 3] / w;
            let g = outBuffer[i * 3 + 1] / w;
            let b = outBuffer[i * 3 + 2] / w;

            r = Math.max(0, Math.min(1, r));
            g = Math.max(0, Math.min(1, g));
            b = Math.max(0, Math.min(1, b));

            if (isFFA || isDeraining) {
                const localMin = finalMin;
                r = (r - localMin[0]) / Math.max(0.01, finalMax[0] - localMin[0]);
                g = (g - localMin[1]) / Math.max(0.01, finalMax[1] - localMin[1]);
                b = (b - localMin[2]) / Math.max(0.01, finalMax[2] - localMin[2]);
            }

            if (isDeraining) {
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

                r = r * 1.8 + 0.03;
                g = g * 1.75 + 0.03;
                b = b * 1.8 + 0.03;

                const exposure = isFFA_Outdoor ? 0.60 : 0.75;
                r *= exposure * 0.85;
                g *= exposure * 0.95;
                b *= exposure * 1.25;
            } else if (isLowLight || isDeblur || isDenoise) {
                r = (r - finalMin[0]) / Math.max(0.01, finalMax[0] - finalMin[0]);
                g = (g - finalMin[1]) / Math.max(0.01, finalMax[1] - finalMin[1]);
                b = (b - finalMin[2]) / Math.max(0.01, finalMax[2] - finalMin[2]);

                if (isLowLight) {
                    r = Math.pow(Math.max(0, r), 1.4);
                    g = Math.pow(Math.max(0, g), 1.4);
                    b = Math.pow(Math.max(0, b), 1.4);

                    r *= 0.82;
                    g *= 0.82;
                    b *= 0.82;

                    const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                    const saturation = 1.05;
                    r = gray + (r - gray) * saturation;
                    g = gray + (g - gray) * saturation;
                    b = gray + (b - gray) * saturation;
                }

                if (isDeblur) {
                    const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                    const saturation = 1.4;
                    r = gray + (r - gray) * saturation;
                    g = gray + (g - gray) * saturation;
                    b = gray + (b - gray) * saturation;
                }
                r = Math.pow(Math.max(0, r), 0.90);
                g = Math.pow(Math.max(0, g), 0.90);
                b = Math.pow(Math.max(0, b), 0.90);
            }

            if (isLowLight) {
                const gray = (0.299 * r + 0.587 * g + 0.114 * b);
                const saturation = 1.1;
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;

                r = Math.pow(Math.max(0, r), 0.9);
                g = Math.pow(Math.max(0, g), 0.9);
                b = Math.pow(Math.max(0, b), 0.9);

                const lowLightExposure = 1.25;
                r *= lowLightExposure;
                g *= lowLightExposure;
                b *= lowLightExposure;
            }

            processedBuffer[i * 3] = r;
            processedBuffer[i * 3 + 1] = g;
            processedBuffer[i * 3 + 2] = b;
        }
    }

    const finalBuffer = new Uint8ClampedArray(outWidth * outHeight * 4);
    const isAggressive = (isDeblur);
    const sharpenKernel = isAggressive ? [
        -0.5, -1.0, -0.5,
        -1.0, 7.0, -1.0,
        -0.5, -1.0, -0.5
    ] : (isDenoise ? [
        0, 0, 0,
        0, 1.0, 0,
        0, 0, 0
    ] : [
        0, -0.35, 0,
        -0.35, 2.4, -0.35,
        0, -0.35, 0
    ]);
    for (let y = 0; y < outHeight; y++) {
        for (let x = 0; x < outWidth; x++) {
            const i = y * outWidth + x;
            let r_sharp, g_sharp, b_sharp;

            if (x === 0 || x === outWidth - 1 || y === 0 || y === outHeight - 1) {
                r_sharp = processedBuffer[i * 3];
                g_sharp = processedBuffer[i * 3 + 1];
                b_sharp = processedBuffer[i * 3 + 2];
            } else {
                r_sharp = 0; g_sharp = 0; b_sharp = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    const iy = y + ky;
                    const rowIdx = iy * outWidth;
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (rowIdx + (x + kx)) * 3;
                        const w_k = sharpenKernel[(ky + 1) * 3 + (kx + 1)];
                        r_sharp += processedBuffer[idx] * w_k;
                        g_sharp += processedBuffer[idx + 1] * w_k;
                        b_sharp += processedBuffer[idx + 2] * w_k;
                    }
                }
            }

            finalBuffer[i * 4] = Math.max(0, Math.min(255, Math.round(r_sharp * 255)));
            finalBuffer[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g_sharp * 255)));
            finalBuffer[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b_sharp * 255)));
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

            case 'dispose':
                if (currentSession) {
                    await currentSession.release();
                    currentSession = null;
                    currentSessionPath = null;
                }
                break;

            case 'detect':
                if (data && config) {
                    await runDetection(data, config);
                }
                break;

            case 'upscale':
                if (data && config) {
                    await runUpscale(data, config);
                } else {
                    console.error('[AI Worker] Upscale missing args:', { data: !!data, config: !!config });
                    ctx.postMessage({ type: 'error', error: 'Missing logic args (data or config)' });
                }
                break;

            case 'restore':
                if (data && config) {
                    if (config.modelName && config.modelName.toLowerCase().includes('ultrazoom')) {
                        const scaleMatch = config.modelName.match(/_x(\d+)/i);
                        config.scale = scaleMatch ? parseInt(scaleMatch[1]) : 2;
                        config.resultType = 'restore_result';
                        await runUpscale(data, config);
                    } else {
                        await runRestoration(data, config);
                    }
                }
                break;

            case 'preload': {
                if (config) {
                    let modelPath = '';
                    if (config.scale) {
                        const modelName = `UltraZoom_x${config.scale}`;
                        modelPath = config.localModelPath ? `${config.localModelPath}ultrazoom/${modelName}.onnx` : `/models/ultrazoom/${modelName}.onnx`;
                    } else if (config.modelName === 'yolo') {
                        modelPath = config.localModelPath ? `${config.localModelPath}yolo/yolov8n-fp16.onnx` : '/models/yolo/yolov8n-fp16.onnx';
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
                            const mName = `UltraZoom_x${mConfig.scale}`;
                            mPath = (config && config.localModelPath) ? `${config.localModelPath}ultrazoom/${mName}.onnx` : `/models/ultrazoom/${mName}.onnx`;
                        } else if (mConfig.modelName === 'yolo') {
                            mPath = (config && config.localModelPath) ? `${config.localModelPath}yolo/yolov8n-fp16.onnx` : '/models/yolo/yolov8n-fp16.onnx';
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
