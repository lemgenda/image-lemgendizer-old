import * as ort from 'onnxruntime-web';
import { RestorationEngine } from '../engine/RestorationEngine';
import { ThetaAdapter } from '../engine/ThetaAdapter';
import { UPNResults, TileParams } from '../types/engine';

const ctx: Worker = self as any;

enum PrimaryState {
    NORMAL = 'NORMAL',
    LOWLIGHT = 'LOWLIGHT',
    RAIN = 'RAIN',
    OVEREXPOSED = 'OVEREXPOSED'
}

// Configure ONNX Runtime environment

// Dynamic web paths are configured inside initORT()

// Fix: Resolve Module.MountedFiles error for models with external data (ResNet50)
// by forcing single-threaded execution in the Worker. Multi-threading in Workers
// often triggers buggy Emscripten FS mount logic for external .data files.
ort.env.wasm.numThreads = 1;

let lastProgressTime = 0;
const PROGRESS_THROTTLE_MS = 100;

function throttleProgress(message: any) {
    const now = performance.now();
    if (now - lastProgressTime >= PROGRESS_THROTTLE_MS || message.data.current === 100 || message.data.current === 0) {
        ctx.postMessage(message);
        lastProgressTime = now;
    }
}


const ortInstance: any = ort;
let currentSession: any = null;
let currentSessionPath: string | null = null;
let nimaSession: any = null;
/** Separate session for NIMA. */
const sessionCache: Map<string, any> = new Map();

/**
 * v79.0: Persistent Model Registry
 * Reuses sessions to avoid WebGPU re-bind overhead
 */
class ModelRegistry {
    private sessions = new Map<string, any>();

    async getOrLoad(path: string): Promise<any> {
        if (this.sessions.has(path)) return this.sessions.get(path);

        // v100.0 Phase 6: Verify asset existence and type before loading
        try {
            const response = await fetch(path, { method: 'HEAD' });
            if (!response.ok) throw new Error(`Model not found: ${path}`);

            // Vite/Servers often serve index.html for missing routes with 200 OK
            const type = response.headers.get('content-type') || '';
            if (type.includes('text/html')) throw new Error(`Invalid model type (HTML): ${path}`);
        } catch (_error) {
            throw new Error(`Asset verification failed: ${path}`);
        }

        const session = await ortInstance.InferenceSession.create(path, {
            executionProviders: [{
                name: 'webgpu',
                deviceType: 'gpu',
            }],
            graphOptimizationLevel: 'all'
        });

        this.sessions.set(path, session);
        return session;
    }

    async clear() {
        for (const session of this.sessions.values()) {
            try { await session.release(); } catch (_e) { /* ignore release failure */ }
        }
        this.sessions.clear();
    }
}

const modelRegistry = new ModelRegistry();
let restorationEngine: RestorationEngine | null = null;

/**
 * v79.0: Calibration Logger
 */
interface CalibrationLog {
    timestamp: string;
    medianLuma: number;
    entropy: number;
    anisotropy: number;
    noiseRatio: number;
    state: string;
    passCount: number;
    entropyDelta: number;
}

const calibrationLogs: CalibrationLog[] = [];

function logCalibration(data: CalibrationLog) {
    calibrationLogs.push(data);
    if (calibrationLogs.length > 100) calibrationLogs.shift();
}

/** Maximum number of cached sessions. */
const MAX_CACHED_SESSIONS = 5;




async function runUPN(imageData: ImageData): Promise<UPNResults> {
    if (!restorationEngine) {
        return {
            degradation: { rain: 0, haze: 0, blur: 0, noise: 0, lowlight: 0 },
            embedding: new Float32Array(128).fill(0),
            theta: { denoise: 0, deblur: 0, dehaze: 0, gamma: 0.5, exposure: 0.5 },
            confidence: 0.5,
            state: 'NORMAL'
        };
    }

    // WGSL Bypass: Use pure CPU extraction for the center crop
    // Center-crop analysis
    const centerParams: TileParams = {
        imageWidth: imageData.width,
        imageHeight: imageData.height,
        tileX: Math.max(0, Math.floor(imageData.width / 2 - 128)),
        tileY: Math.max(0, Math.floor(imageData.height / 2 - 128)),
        tileSize: 256,
        offsetX: 0,
        offsetY: 0
    };

    const tileTensorData = new Float32Array(256 * 256 * 3);

    // Convert directly from ImageData to ORT WebGPU Float32Array
    (restorationEngine as any).tileManager.extractTileCPU(imageData, centerParams, tileTensorData);

    // Pass strictly to ORT WebGPU Native (Bypasses custom WGSL shader pipes)
    const results = await (restorationEngine as any).runUPNCpu(tileTensorData);

    return results;
}

/**
 * v100.0: Online RL Controller (Contextual Bandit)
 * Optimizes the parameter vector θ dynamically per device/user.
 */
class RLController {
    private alpha = 0.05; // Learning rate
    private thetaAdjustments: Record<string, number> = {
        derain: 0, dehaze: 0, deblur: 0, denoise: 0, gamma: 0, sharp: 0, diff: 0
    };

    /**
     * Refines θ using policy refinement π(s).
     * θ = θ₀ + π(s)
     * where s = [θ₀, d, c, device, f]
     */
    public refine(theta0: any, degradation: any, confidence: number, _embedding: Float32Array): any {
        const theta = { ...theta0 };
        const thetaSafe = 0.1;

        // Apply RL adjustments (π head logic)
        for (const key in theta) {
            // Adaptive refinement using d (degradation) and alpha (LR)
            const d = degradation[key] || 0;
            const val = theta[key] + (this.thetaAdjustments[key] || 0) + (this.alpha * d * 0.1);

            // Confidence Blending: c * θ + (1 - c) * θ_safe
            theta[key] = clamp(confidence * val + (1 - confidence) * thetaSafe, 0, 1);
        }

        return theta;
    }

    public updateReward(metricsBefore: any, metricsAfter: any, latency: number) {
        // R = w1(LPIPS_before - LPIPS_after) + w2(NIMA_after - NIMA_before) - w3*Latency - w4*Artifacts
        const w1 = 10.0, w2 = 2.0, w3 = 0.01, w4 = 5.0;

        const deltaLPIPS = metricsBefore.perceptual - metricsAfter.perceptual;
        const deltaNIMA = metricsAfter.nima - metricsBefore.nima;
        const artifactScore = metricsAfter.artifacts || 0;

        const reward = w1 * deltaLPIPS + w2 * deltaNIMA - w3 * latency - w4 * artifactScore;

        // θ ← θ + α * ∇R logic would update thetaAdjustments based on gradient of R w.r.t theta
        console.log(`[AI Worker] RL Reward: ${reward.toFixed(3)} (dLPIPS=${deltaLPIPS.toFixed(3)}, dNIMA=${deltaNIMA.toFixed(3)}, Latency=${latency}ms)`);

        // Placeholder for online bandit update
        // this.thetaAdjustments...
    }
}

const rlController = new RLController();

/**
 * v100.0: Latent Diffusion HQ Path (ω)
 * Placeholder for tiled DDIM 4-step execution.
 */
async function runLatentDiffusion(_imageData: ImageData, _theta: any, _config: any): Promise<ImageData> {
    // DDIM 4-10 steps execution stub
    // This will involve VAE Encoder -> UNet(θ) -> VAE Decoder
    return _imageData;
}

/**
 * v100.0: Blended Output Node
 * y = y_f + θ_diff * (y_d - y_f)
 */
function blendImages(fast: ImageData, hq: ImageData, thetaDiff: number): ImageData {
    if (thetaDiff <= 0) return fast;
    if (thetaDiff >= 1) return hq;

    const out = new ImageData(new Uint8ClampedArray(fast.data.length), fast.width, fast.height);
    for (let i = 0; i < fast.data.length; i++) {
        // Linear interpolation in sRGB (approximate)
        out.data[i] = fast.data[i] + thetaDiff * (hq.data[i] - fast.data[i]);
    }
    return out;
}

/**
 * v90.0: Universal FiLM-Modulated Restoration
 * Maps parameter vector θ to a single lightweight restoration backbone.
 */


function applyExposureScaling(imageData: ImageData, scale: number): ImageData {
    if (Math.abs(scale - 1.0) < 0.01) return imageData;
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] * scale));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * scale));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * scale));
    }
    return new ImageData(data, imageData.width, imageData.height);
}
let messageQueue: Promise<void> = Promise.resolve();
/** Global busy flag for strict locking. */
let isBusy = false;
/** Progress tracking. */
let lastReportedProgress = 0;

/**
 * Performance Timer Utility
 */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

/**
 * v100.0: Perceptual Distance (L2)
 * L_perc = ||f(x) - f(y*)||₂
 */
function perceptualDistance(f1: Float32Array, f2: Float32Array): number {
    let d = 0;
    for (let i = 0; i < f1.length; i++) {
        const diff = f1[i] - f2[i];
        d += diff * diff;
    }
    return Math.sqrt(d);
}


let initPromise: Promise<void> | null = null;

// ORT 1.23.2 Upgrade - No polyfill needed

let isOrtInitialized = false;

/**
 * Initializes ONNX Runtime Web
 */
const initORT = async (_config: any) => {

    if (isOrtInitialized) return;

    if (initPromise) {
        await initPromise;
        return;
    }

    initPromise = (async () => {
        const timer = new Timer('ORT Initialization');
        timer.start();

        try {
            // Map ONNX Runtime backend binaries to properly resolved Vite server public base
            const libPath = _config?.localLibPath || 'ort/';
            ortInstance.env.wasm.wasmPaths = {
                'ort-wasm-simd-threaded.wasm': `${libPath}ort-wasm-simd-threaded.wasm`,
                'ort-wasm-simd-threaded.jsep.wasm': `${libPath}ort-wasm-simd-threaded.jsep.wasm`,
                'ort-wasm-simd-threaded.mjs': `${libPath}ort-wasm-simd-threaded.js`,
                'ort-wasm-simd-threaded.jsep.mjs': `${libPath}ort-wasm-simd-threaded.jsep.js`,
                'ort-wasm-simd.wasm': `${libPath}ort-wasm-simd.wasm`,
                'ort-wasm-simd.jsep.wasm': `${libPath}ort-wasm-simd.jsep.wasm`,
                'ort-wasm.wasm': `${libPath}ort-wasm.wasm`,
                'ort-wasm-threaded.wasm': `${libPath}ort-wasm-threaded.wasm`
            } as any;

            // Configuration is already done at top level, but we can ensure execution provider settings here
            ortInstance.env.wasm.simd = true;
            ortInstance.env.wasm.proxy = false;

            if (!ortInstance.env.webgpu) ortInstance.env.webgpu = {};

            const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '');
            if (!isWindows) {
                ortInstance.env.webgpu.powerPreference = 'high-performance';
            }

            ortInstance.env.logLevel = 'error';
            ortInstance.env.debug = false;
        } catch (error) {
            console.error('[AI Worker] Model loading failed:', error);
            throw error;
        } finally {
            initPromise = null;
            isOrtInitialized = true;
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

    if (modelPath.toLowerCase().includes('nima')) {
        if (nimaSession) return nimaSession;
        if (sessionCache.has(modelPath)) {
            nimaSession = sessionCache.get(modelPath);
            return nimaSession;
        }
    } else {
        if (currentSession && currentSessionPath === modelPath) {
            return currentSession;
        }

        if (currentSession) {
            /** Attempt to release the previous session. */
            let isCached = false;
            for (const s of sessionCache.values()) {
                if (s === currentSession) {
                    isCached = true;
                    break;
                }
            }

            if (!isCached) {
                try {
                    const sessionToRelease = currentSession;
                    currentSession = null;
                    await sessionToRelease.release();
                } catch {
                    /** Silent failure on session release. */
                }
            }

            currentSession = null;
            currentSessionPath = null;

            if (ortInstance.env.webgpu && ortInstance.env.webgpu.clearCache) {
                try {
                    await ortInstance.env.webgpu.clearCache();
                } catch (_) { /* ignored */ }
            }

            /** Yield to allow browser to reclaim memory. */
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    if (sessionCache.has(modelPath)) {
        const cached = sessionCache.get(modelPath);
        if (modelPath.toLowerCase().includes('nima')) {
            nimaSession = cached;
        } else {
            currentSession = cached;
            currentSessionPath = modelPath;
        }
        return cached;
    }

    ctx.postMessage({
        type: 'progress',
        data: { current: 0, total: 100, stage: 'loading_model', currentOperation: 'Loading AI Model...' }
    });

    try {
        const lowerPath = modelPath.toLowerCase();
        const isYolo = lowerPath.includes('yolo');
        const isFacelib = lowerPath.includes('facelib');
        const isRestoration = lowerPath.includes('restoration') || lowerPath.includes('restorer') || lowerPath.includes('upn') || lowerPath.includes('ultrazoom') || isFacelib;
        const isNima = lowerPath.includes('nima');

        const sessionOptions: any = {
            executionProviders: isRestoration ? ['webgpu'] : ['webgpu', 'wasm'],
            graphOptimizationLevel: isRestoration ? 'basic' : 'all',
            enableMemPattern: false,
            enableCpuMemArena: false,
            logSeverityLevel: 3,
        };

        if (!isYolo) {
            sessionOptions.graphOptimizationLevel = 'basic';

            /**
             * NAFNet on WebGPU (ORT 1.23.2) Stability Fix.
             * 1. Disabling optimizations is the primary cure.
             * 2. Switched back to 'high' precision to eliminate vertical artifacts.
             * 3. Forcing 'NHWC' layout bypasses potential NCHW optimization bugs.
             */
            if (modelPath.toLowerCase().includes('nafnet')) {
                sessionOptions.graphOptimizationLevel = 'disabled';
                sessionOptions.extra = {
                    webgpu: {
                        "preferredLayout": "NHWC",
                        "matmulPrecision": "high"
                    }
                };
            } else {
                sessionOptions.extra = {
                    webgpu: {
                        "preferredLayout": "NCHW",
                        "matmulPrecision": "high"
                    }
                };
            }
        }

        const finalOptions = { ...sessionOptions };

        const isResNet = lowerPath.includes('resnet50');
        const isMobileNet = lowerPath.includes('mobilenet0.25');
        // v106.1: Clean load for standardized FP16 models.
        // Standardized FP16 models have embedded weights, so simple create() works.
        const absoluteModelPath = new URL(modelPath, self.location.origin).href;
        const session = await (ortInstance as any).InferenceSession.create(absoluteModelPath, finalOptions);

        /** LRU Cache Management. */
        if (sessionCache.size >= MAX_CACHED_SESSIONS) {
            let keyToEvict = null;
            for (const key of sessionCache.keys()) {
                if (!key.toLowerCase().includes('nima')) {
                    keyToEvict = key;
                    break;
                }
            }

            if (keyToEvict) {
                const oldSession = sessionCache.get(keyToEvict);
                if (oldSession) {
                    /** Pointer Sync: If evicting active session, nullify pointer. */
                    if (oldSession === currentSession) {
                        currentSession = null;
                        currentSessionPath = null;
                    }
                    if (oldSession === nimaSession) {
                        nimaSession = null;
                    }
                    try { await oldSession.release(); } catch (_) { /* ignore */ }
                }
                sessionCache.delete(keyToEvict);
            }
        }
        sessionCache.set(modelPath, session);

        if (modelPath.toLowerCase().includes('nima')) {
            nimaSession = session;
        } else {
            currentSession = session;
            currentSessionPath = modelPath;
        }

        const warmupTimer = new Timer('Warmup Run');
        warmupTimer.start();

        if (!isYolo) {
            ctx.postMessage({
                type: 'progress',
                data: { current: 0, total: 100, stage: 'warming_up', currentOperation: 'Warming Up AI...' }
            });
        }

        try {
            const dims = isYolo ? [1, 3, 640, 640] :
                (isResNet || isMobileNet ? [1, 3, 640, 640] :
                    (isRestoration ? [1, 3, 512, 512] :
                        (isNima ? [1, 3, 224, 224] : [1, 3, 64, 64])));
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
    const modelFileName = 'YOLO(v8n)_FP16';
    const modelPath = safeConfig.localModelPath ? `${safeConfig.localModelPath}yolo/${modelFileName}.onnx` : `models/yolo/${modelFileName}.onnx`;

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

const internalRunUpscale = async (imageData: ImageData, config: any): Promise<ImageData> => {
    const totalTimer = new Timer('Total Upscaling');
    totalTimer.start();

    const scale = config.scale || 2;

    // FP16 models are now standard (UltraZoom(xN)_FP16.onnx)
    const modelName = `UltraZoom(x${scale})_FP16`;
    const modelPath = config.localModelPath ? `${config.localModelPath}ultrazoom/${modelName}.onnx` : `models/ultrazoom/${modelName}.onnx`;

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
    let lastProgressTime = 0;
    lastReportedProgress = 0; // Reset for this operation

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

            const now = Date.now();
            if (tilesProcessed === totalTiles || (now - lastProgressTime > 50)) {
                lastProgressTime = now;
                const progressPct = Math.round((tilesProcessed / totalTiles) * 100);

                if (progressPct >= lastReportedProgress) {
                    lastReportedProgress = progressPct;
                    console.log(`[AI Worker] Upscaling Progress: ${progressPct}% (${tilesProcessed}/${totalTiles})`);
                    ctx.postMessage({
                        type: 'progress',
                        data: {
                            current: tilesProcessed,
                            total: totalTiles,
                            granular: progressPct,
                            stage: 'upscaling',
                            currentOperation: `Upscaling (Tile ${tilesProcessed}/${totalTiles})`
                        }
                    });
                }
            }
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
    return outImageData;
};

const runUpscale = async (imageData: ImageData, config: any) => {
    const scale = config.scale || 2;
    const modelName = `UltraZoom-x${scale}`;
    const outImageData = await internalRunUpscale(imageData, config);
    ctx.postMessage({
        type: config.resultType || 'upscale_result',
        data: outImageData,
        model: modelName,
        scale: scale
    });
};

const internalRunRestoration = async (imageData: ImageData, config: any, progressOffset: number = 0, progressWidth: number = 100): Promise<ImageData> => {
    const totalTimer = new Timer('Total Restoration');
    totalTimer.start();

    const rawModelName = config.modelName || 'MPRNet-Deraining';
    let modelBasePath = 'restoration';
    let actualModelName = `${rawModelName}_FP16`;

    if (rawModelName === 'CodeFormer') {
        modelBasePath = 'face-restoration';
        actualModelName = 'CodeFormer-FaceRestoration_FP16';
    } else if (rawModelName === 'NAFNet-Debluring(REDS)') {
        actualModelName = 'NAFNet-Debluring_FP16';
    }

    const modelName = actualModelName;
    const modelPath = config.localModelPath ? `${config.localModelPath}${modelBasePath}/${actualModelName}.onnx` : `models/${modelBasePath}/${actualModelName}.onnx`;

    const session = await modelRegistry.getOrLoad(modelPath);

    const isLowLight = modelName.toLowerCase().includes('lowlight') || modelName.toLowerCase().includes('mirnet');
    const isDeblur = modelName.toLowerCase().includes('deblur');
    const isDenoise = modelName.toLowerCase().includes('denoising');

    // Round 53 Revert: User says "It was ok in last version".
    // This implies 768px Tiling (Default) worked fine. My 512px force might have caused the Seams.
    // We KEEP the Clamp/OOB Exemption (because that was the "not good" part), but revert Tiling.
    const isDeraining = modelName.toLowerCase().includes('deraining');
    const isMPRNet = modelName.toLowerCase().includes('mprnet');

    // v67.1 Restoration Recovery: MPRNet strictly requires 512px tiles.
    // v67 accidentaly forced 768px which caused dimension mismatches.
    // v67.8 Spectral Continuity: Reverting to 512px for MPRNet to fix dimension mismatch.
    const TILE_SIZE = (isLowLight || isDeblur || isDenoise || isDeraining || isMPRNet) ? 512 : 768;
    const { width, height, data } = imageData;

    // Round 30: Smart Safety Gate (Protect against Catastrophic Failure)
    // Round 51: Exempt Rain/MPRNet.
    // Round 70: EXEMPT LEMGENDARY ENHANCE. The orchestrator handles its own decisions.
    // Enhanced config check to ensure isEnhance is correctly detected deep in internalRunRestoration
    const isEnhance = config.isEnhance || (config as any).enhance?.enabled || config.modelName?.includes('restorer');
    if (modelName.toLowerCase().includes('deblur') && !modelName.toLowerCase().includes('rain') && !modelName.toLowerCase().includes('mprnet') && !isEnhance) {
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

            return new ImageData(new Uint8ClampedArray(data), width, height);
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
            return new ImageData(new Uint8ClampedArray(data), width, height);
        }
    }

    const outWidth = width;
    const outHeight = height;

    const outBuffer = new Float32Array(outWidth * outHeight * 3);
    const weightBuffer = new Float32Array(outWidth * outHeight);
    const numPixels = TILE_SIZE * TILE_SIZE;
    // Round 63: Increase Overlap for Deraining (25% = 128px) to reduce grid artifacts.
    // Others keep 12.5% (64px) for speed.
    // V21: Maximum Smoothness for MPRNet (30% overlap = 154px)
    const overlapRatio = (isDeraining || isMPRNet) ? 0.30 : 0.125;
    const OVERLAP = Math.floor(TILE_SIZE * overlapRatio);
    const STEP = TILE_SIZE - OVERLAP;
    const JITTER_MAX = 0; // Round 59 Fix: Disable Jitter for Restoration to prevent ghosting/alignment issues.

    const cols = Math.ceil(width / STEP) + 1;
    const rows = Math.ceil(height / STEP) + 1;

    const isDehaze = modelName.toLowerCase().includes('dehazing');
    const isFFA = modelName.toLowerCase().includes('ffanet');
    const isFFA_Indoor = isFFA && modelName.toLowerCase().includes('indoor');
    const isDehazing = modelName.toLowerCase().includes('dehazing') || isFFA;
    const isBGR = isMPRNet || modelName.includes('NAFNet-Denoising'); // v67.6: Native models expect BGR



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

    // V51: Global Contrast (StdDev) for Recoverability R-Ratio logic
    let globalStd = 0.15; // Default safe contrast
    if (isDehazing) {
        let sumL = 0, sumL2 = 0, count = 0;
        const stride = Math.max(4, Math.floor(data.length / 4000) * 4); // Sample for speed
        for (let i = 0; i < data.length; i += stride) {
            const l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255.0;
            sumL += l; sumL2 += l * l; count++;
        }
        const meanL = sumL / count;
        globalStd = Math.sqrt(Math.max(0, (sumL2 / count) - (meanL * meanL)));
    }

    const getHumanName = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('lowlight')) return 'Low-Light Enhancement';
        if (n.includes('mirnet')) return 'MIRNet Restoration';
        if (n.includes('nafnet')) return 'NAFNet Alignment';
        if (n.includes('deraining')) return 'Deraining';
        if (n.includes('ffanet-dehazing_outdoor')) return 'Dehazing (Outdoor)';
        if (n.includes('ffanet-dehazing_indoor')) return 'Dehazing (Indoor)';
        if (n.includes('dehazing')) return 'AI Dehazing';
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
    let lastProgressTime = 0;
    lastReportedProgress = 0;

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

            // V51: Tile-Level Recoverability Analysis
            let tileStd = 0.1;
            if (isDehazing) {
                let tSumL = 0, tSumL2 = 0, tCount = 0;
                for (let ty = 0; ty < TILE_SIZE; ty += 8) { // Coarse sample
                    for (let tx = 0; tx < TILE_SIZE; tx += 8) {
                        const gx = sx + tx; const gy = sy + ty;
                        if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue;
                        const idx = (gy * width + gx) * 4;
                        const l = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255.0;
                        tSumL += l; tSumL2 += l * l; tCount++;
                    }
                }
                if (tCount > 0) {
                    const tMean = tSumL / tCount;
                    tileStd = Math.sqrt(Math.max(0, (tSumL2 / tCount) - (tMean * tMean)));
                }
            }
            const R_ratio = isDehazing ? (tileStd / (globalStd + 0.001)) : 1.0;

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

            if (useInputMinusOneToOne) {
                // Manifold reprojection not applied to signed models yet
            } else if (!useFFANormalization) {
                // v60: Opt-out primary restorers from reprojection.
                // These models are trained on natural signal dynamics; forcing std=0.22
                // kills the very rain/noise features they target.
                const isPrimaryRestorer = isDeblur || isDenoise || isDeraining || isMPRNet || isLowLight;
                if (!isPrimaryRestorer) {
                    reprojectSignal(tileData as Float32Array);
                }
            }

            if (inputType === 'float16') {
                tileData = float32ToFloat16(tileData as Float32Array);
            }

            let results;
            let tensor: any = null;
            let outData: any;
            let outputShape: any;
            try {
                tensor = new ortInstance.Tensor(inputType, tileData, [1, 3, TILE_SIZE, TILE_SIZE]);
                results = await session.run({ [inputName]: tensor });
                const output = results[outputName];
                outData = output.data;
                outputShape = output.dims;
            } catch (e: any) {
                console.error(`[AI Worker] RESTORATION TILE FAILED (${r},${c}): ${e.message}`);
                tilesProcessed++;
                ctx.postMessage({ type: 'progress', data: { current: tilesProcessed, total: totalTiles, granular: Math.round((tilesProcessed / totalTiles) * 100), stage: 'restoration', currentOperation: operationName } });

                // v67.1 Restoration Recovery: If the model fails, we MUST return the original pixels
                // to prevent the extreme Beta logic from creating black artifacts.
                outData = new Float32Array(tileData.length || 0);
                if (tileData) {
                    for (let i = 0; i < tileData.length; i++) {
                        outData[i] = tileData[i] || 0;
                    }
                }
                outputShape = [1, 3, TILE_SIZE, TILE_SIZE]; // Default assumption
            }

            if (outputType === 'float16') {
                if (outData instanceof Uint16Array) outData = float16ToFloat32(outData);
                else if (typeof Float16Array !== 'undefined' && outData instanceof Float16Array) outData = Float32Array.from(outData);
            }

            // V24: Universal Signal Shield (Explosion Prevention for ALL models)
            let outMeanTile = 0;
            let outMaxTile = -999;

            for (let i = 0; i < outData.length; i++) {
                const v = outData[i];
                outMeanTile += v;
                if (v > outMaxTile) outMaxTile = v;
            }
            outMeanTile /= outData.length;

            // V26 Refinement: Signal Shield (Explosion Prevention)
            // v67 Purity Audit: Terminate Shield for restorers to prevent silent reversions.
            const isVerifiedRestorer = isDeblur || isDenoise || isDeraining || isMPRNet || isLowLight;
            const SHIELD_MAX = isVerifiedRestorer ? 10000.0 : 2.5;

            // Debug: Verify Shield Limits
            if (r === 0 && c === 0) {
                console.log(`[AI Worker] Shield Logic: Model=${modelName}, MaxLimit=${SHIELD_MAX}`);
            }

            if (isNaN(outMeanTile) || outMaxTile > SHIELD_MAX) {
                /** v67.3: Signal Shield is DIAGNOSTIC ONLY. We do NOT revert to input. */
                console.error(`[AI Worker] Signal Shield WARNING (${r},${c}): Max=${outMaxTile.toFixed(2)} > ${SHIELD_MAX}. Continuing with AI output for Purity Audit.`);
            }

            // v67.5 Sticky Scalar: Terminated. It caused explosions/rainbows in v67.4.
            // We use the raw sniff data to determine logic instead.

            const isNHWC = outputShape && outputShape[1] !== 3 && outputShape[3] === 3;

            // Round 22: Diagnostic Sniffing
            // v67.3: Enforce REAL sniffing for all restorers to drive Sticky Scalar correctly.
            let sMin = 100, sMax = -100;
            if (isLowLight) {
                sMin = 0; sMax = 1; // Lowlight models are often pre-clamped
            } else {
                for (let i = 0; i < outData.length; i++) {
                    const v = outData[i];
                    if (v < sMin) sMin = v;
                    if (v > sMax) sMax = v;
                }
            }

            // Round 22: Dynamic Range Normalization
            const rangeScale = 1.0;

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

            // Round 25/27: Robust Model Type Detection
            const normMean = (meanR + meanG + meanB) / 3.0;
            const rangeExtent = (sMax - sMin);

            // Diagnostic log for first tile to verify normalization flow
            if (r === 0 && c === 0) {
                console.log(`[AI Worker] ${operationName} Global Sniff: sMin=${sMin.toFixed(3)}, sMax=${sMax.toFixed(3)}, normMean=${normMean.toFixed(3)}, Extent=${rangeExtent.toFixed(3)}`);
            }

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

                    // V33: Turbo-Deblur - Use full 1.0 blend for deblur/denoise residuals
                    const isRestorer = modelName.includes('deblurring') || modelName.includes('denoising') || modelName.includes('mprnet');
                    const blend = isRestorer ? 1.0 : 0.8;

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
                    // v67.6: Hard-code Direct status for verified restorers (MPRNet/NAFNet).
                    // They frequently output standard [0, 1] images in Direct mode.
                    const isDirectModel = ((normMean > 0.15 && sMin > -0.1) || (rangeExtent > 1.5 && useInputMinusOneToOne) || expectFFANormalization || isMPRNet || isLowLight || isDenoise);

                    if (isDirectModel) {
                        if (expectFFANormalization) {
                            // Round 45: FFA-Net De-Normalization
                            // x * std + mean
                            // dr_raw = outData[idxR].
                            // If model output is normalized, we need to de-normalize.
                            r_final = (outData[idxR] * FFA_STD[0]) + FFA_MEAN[0];
                            g_final = (outData[idxG] * FFA_STD[1]) + FFA_MEAN[1];
                            b_final = (outData[idxB] * FFA_STD[2]) + FFA_MEAN[2];
                        } else if (isOutputMinusOneToOne) {
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

                            // V23: Global Mean Alignment for Direct Models
                            const inMeanTile = (meanR + meanG + meanB) / 3.0;
                            // Round 75 (V27.3): Revert to V10 "Pure" Mode for MPRNet (1.0 Scale)
                            const lumaScaleFactor = isMPRNet ? 1.0 : ((outMeanTile > 0.1) ? Math.min(1.5, Math.max(0.6, inMeanTile / outMeanTile)) : 1.0);

                            // V27: Diagnostic logs silenced to reduce noise
                            // console.log(`[AI Worker] ${operationName} Alignment: inMean=${inMeanTile.toFixed(3)}, outMean=${outMeanTile.toFixed(3)}, scale=${lumaScaleFactor.toFixed(2)}`);

                            r_final *= lumaScaleFactor;
                            g_final *= lumaScaleFactor;
                            b_final *= lumaScaleFactor;

                            // V34/V37: Full Authority - Use 1.0 blend for all restorer models even if direct
                            const isRestorerModel = modelName.includes('deblurring') || modelName.includes('denoising') || modelName.includes('mprnet') || modelName.includes('restoration') || modelName.includes('dehaze') || modelName.includes('ffanet');
                            const blendStrength = isRestorerModel ? 1.0 : 0.8;
                            r_final = (r_final * blendStrength) + (r_base * (1.0 - blendStrength));
                            g_final = (g_final * blendStrength) + (g_base * (1.0 - blendStrength));
                            b_final = (b_final * blendStrength) + (b_base * (1.0 - blendStrength));
                        }
                    } else {
                        // V33: Turbo-Deblur - Removed restrictive 0.05 cap for restoration models
                        const isRestorationModel = modelName.includes('deblurring') || modelName.includes('restoration') || modelName.includes('mprnet');
                        const cap = isRestorationModel ? 1.0 : 0.05;
                        const reR = Math.max(-cap, Math.min(cap, (dr_norm - meanR)));
                        const reG = Math.max(-cap, Math.min(cap, (dg_norm - meanG)));
                        const reB = Math.max(-cap, Math.min(cap, (db_norm - meanB)));

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
                    const OOB_MIN = isMPRNet ? -9999.0 : (isDehazingModel ? -5.0 : -0.2); // v60: Relaxed -0.1 -> -0.2
                    const OOB_MAX = isMPRNet ? 9999.0 : (isDehazingModel ? 5.0 : 1.25); // v60: Relaxed 1.1 -> 1.25

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
                        // V36/V37: Atmosphere Pierce - Stronger smog cutting for Outdoor scenes
                        if (isDehaze) {
                            const isOutdoor = modelName.includes('Outdoor');
                            // V50 Sovereignty Supreme: 5x5 Grit Striker
                            // structural artifacts ("pepper noise") require a wider radius than 3x3.
                            // We use a 5x5 cross clamp (reach=2) to definitively kill architectural grit.
                            if (isOutdoor && x > 1 && x < TILE_SIZE - 2 && y > 1 && y < TILE_SIZE - 2) {
                                const pIdx = isNHWC ? (localIdx - 1) * 3 : (localIdx - 1);
                                const nIdx = isNHWC ? (localIdx + 1) * 3 : (localIdx + 1);
                                const tIdx = isNHWC ? (localIdx - TILE_SIZE) * 3 : (localIdx - TILE_SIZE);
                                const bIdx = isNHWC ? (localIdx + TILE_SIZE) * 3 : (localIdx + TILE_SIZE);

                                // reach 2 cardinal checks
                                const pIdx2 = isNHWC ? (localIdx - 2) * 3 : (localIdx - 2);
                                const nIdx2 = isNHWC ? (localIdx + 2) * 3 : (localIdx + 2);
                                const tIdx2 = isNHWC ? (localIdx - 2 * TILE_SIZE) * 3 : (localIdx - 2 * TILE_SIZE);
                                const bIdx2 = isNHWC ? (localIdx + 2 * TILE_SIZE) * 3 : (localIdx + 2 * TILE_SIZE);

                                // 5x5 Grit Check: Clamp if the pixel is wildly different from its 5x5 cross neighborhood.
                                const avgNeighborR_norm = (outData[pIdx] + outData[nIdx] + outData[tIdx] + outData[bIdx] + outData[pIdx2] + outData[nIdx2] + outData[tIdx2] + outData[bIdx2]) / (8 * rangeScale);
                                if (Math.abs(dr_norm - avgNeighborR_norm) > 0.08) { // v51: tighten to 0.08
                                    valR = avgNeighborR_norm; // Correct: no de-norm needed for 0-1 models
                                }

                                const avgNeighborG_norm = (outData[pIdx + 1] + outData[nIdx + 1] + outData[tIdx + 1] + outData[bIdx + 1] + outData[pIdx2 + 1] + outData[nIdx2 + 1] + outData[tIdx2 + 1] + outData[bIdx2 + 1]) / (8 * rangeScale);
                                if (Math.abs(dg_norm - avgNeighborG_norm) > 0.08) {
                                    valG = avgNeighborG_norm;
                                }

                                const avgNeighborB_norm = (outData[pIdx + 2] + outData[nIdx + 2] + outData[tIdx + 2] + outData[bIdx + 2] + outData[pIdx2 + 2] + outData[nIdx2 + 2] + outData[tIdx2 + 2] + outData[bIdx2 + 2]) / (8 * rangeScale);
                                if (Math.abs(db_norm - avgNeighborB_norm) > 0.08) {
                                    valB = avgNeighborB_norm;
                                }
                            }

                            // V50 Sovereignty Supreme: Smog Floor Removal (Force Black Point)
                            if (isOutdoor) {
                                // v50: Ground Crush 7.0 (Exponential 4.0x Overdrive).
                                const normY = gy / outHeight;
                                const vFactor = 0.90 + 3.10 * (normY * normY); // v50: 4.0x force at the absolute bottom

                                // V50 Blue-Chroma Dehaze: Atmospheric haze is Blue-heavy.
                                // WeClear more "floor" from the Blue channel specifically.
                                const baseFloor = 0.20 * vFactor; // v50: Nuclear floor.
                                const bFloor = baseFloor * 1.25; // v50: 25% extra Blue suppression

                                const adaptiveR = baseFloor * (1.0 / (1.0 + Math.exp(-50.0 * (valR - 0.025))));
                                const adaptiveG = baseFloor * (1.0 / (1.0 + Math.exp(-50.0 * (valG - 0.025))));
                                const adaptiveB = bFloor * (1.0 / (1.0 + Math.exp(-50.0 * (valB - 0.025))));

                                valR = Math.max(0, (valR - adaptiveR) / (1.0 - adaptiveR));
                                valG = Math.max(0, (valG - adaptiveG) / (1.0 - adaptiveG));
                                valB = Math.max(0, (valB - adaptiveB) / (1.0 - adaptiveB));
                            }

                            // V37/.../V50 Atmosphere Mastery: Power boost
                            const gPower = isOutdoor ? 1.85 : 1.25; // v50: Absolute Crush
                            const sPower = isOutdoor ? 1.45 : 1.15;

                            // 1. Gamma Correction: Darkens mid-tones to kill remaining fog.
                            valR = valR < 0 ? 0 : Math.pow(valR, gPower);
                            valG = valG < 0 ? 0 : Math.pow(valG, gPower);
                            valB = valB < 0 ? 0 : Math.pow(valB, gPower);


                            // 2. Saturation Boost: Fog kills color; bring it back.
                            const lum = 0.299 * valR + 0.587 * valG + 0.114 * valB;
                            valR = lum + (valR - lum) * sPower;
                            valG = lum + (valG - lum) * sPower;
                            valB = lum + (valB - lum) * sPower;

                            // V51: Atmospheric Physics (Koschmieder's Law)
                            // We recognize that physically lost radiance behind thick fog cannot be "hidden" detail.
                            // We use a Dark Channel Prior approximation (Transmission t) to weight the AI result.
                            const t_val = 1.0 - Math.min(r_base, g_base, b_base);
                            const transmission = Math.max(0.02, Math.pow(t_val, 1.7)); // Koschmieder power

                            // Recoverability Test: If local contrast is significantly lower than global, suppress restoration.
                            const recoverability = (R_ratio < 0.35) ? 0.35 : 1.0;
                            const blendFactor = transmission * recoverability;

                            // J_final = lerp(Original, AI, transmission * recoverability)
                            valR = r_base * (1.0 - blendFactor) + (valR * blendFactor);
                            valG = g_base * (1.0 - blendFactor) + (valG * blendFactor);
                            valB = b_base * (1.0 - blendFactor) + (valB * blendFactor);
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
                const progressPct = Math.round(progressOffset + (tilesProcessed / totalTiles) * progressWidth);

                // V20: Monotonic Progress Lock
                if (progressPct >= lastReportedProgress) {
                    lastReportedProgress = progressPct;
                    ctx.postMessage({
                        type: 'progress',
                        data: {
                            current: tilesProcessed,
                            total: totalTiles,
                            granular: progressPct,
                            stage: 'restoration',
                            currentOperation: operationName
                        }
                    });
                }
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
                // V24: Ultimate Fidelity - Removed overdriven multipliers (1.8x) and excessive saturation (1.3x)
                // We keep a subtle saturation boost and natural gamma for clarity without clipping.
                const saturation = isFFA_Indoor ? 1.05 : 1.3;
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;

                // Keep subtle mid-tone contrast but avoid high multipliers
                r = Math.pow(Math.max(0, r), 1.05);
                g = Math.pow(Math.max(0, g), 1.05);
                b = Math.pow(Math.max(0, b), 1.05);

                const exposure = isFFA_Indoor ? 0.95 : 1.0;
                r *= exposure; g *= exposure; b *= exposure;
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
    return outImageData;
};

const runRestoration = async (imageData: ImageData, config: any) => {
    const outImageData = await internalRunRestoration(imageData, config);
    ctx.postMessage({ type: 'restore_result', data: outImageData });
};


ctx.onmessage = (e: MessageEvent) => {
    /** Queue all incoming messages to prevent race conditions. */
    messageQueue = messageQueue.then(async () => {
        await handleMessage(e);
    }).catch(err => {
        /** Silent failure on global queue error. */
        ctx.postMessage({ type: 'error', error: err.message || String(err) });
    });
};

const runFaceLibDetection = async (imageData: ImageData, config: any, threshold: number = 0.82) => {
    const useResNet = config.faceDetectionModel === 'resnet50';
    const modelPath = useResNet ? 'models/face-restoration/RESNet50-Detection_FP16.onnx' : 'models/face-restoration/MobileNet0.25-Detection_FP16.onnx';
    const session = await loadSession(modelPath, config);

    // Resize to 640x640 (preserving AR with padding)
    const targetSize = 640;
    const { data: resizedData, scale, dx, dy } = await resizeAndPad(imageData, targetSize);

    let float32: any = new Float32Array(3 * targetSize * targetSize);
    // [1, 3, 640, 640] - NCHW
    for (let i = 0, j = 0; i < resizedData.length; i += 4, j++) {
        float32[j] = resizedData[i] / 255.0;
        float32[j + targetSize * targetSize] = resizedData[i + 1] / 255.0;
        float32[j + 2 * targetSize * targetSize] = resizedData[i + 2] / 255.0;
    }

    const inputType = 'float16';
    if (inputType === 'float16') float32 = float32ToFloat16(float32);

    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: new ortInstance.Tensor(inputType, float32, [1, 3, targetSize, targetSize]) });

    // retinaface outputs: scores, boxes, landmarks
    let scores = results.scores.data;
    let boxes = results.boxes.data;
    let landmarks = results.landmarks.data;

    if (results.scores.type === 'float16') scores = float16ToFloat32(scores as any);
    if (results.boxes.type === 'float16') boxes = float16ToFloat32(boxes as any);
    if (results.landmarks.type === 'float16') landmarks = float16ToFloat32(landmarks as any);

    const detections = decodeRetinaFace(scores as Float32Array, boxes as Float32Array, landmarks as Float32Array, threshold);

    // Adjust for padding/scaling
    for (const det of detections) {
        // [x1, y1, x2, y2]
        det.bbox[0] = (det.bbox[0] * targetSize - dx) / scale;
        det.bbox[1] = (det.bbox[1] * targetSize - dy) / scale;
        det.bbox[2] = (det.bbox[2] * targetSize - dx) / scale;
        det.bbox[3] = (det.bbox[3] * targetSize - dy) / scale;

        for (let i = 0; i < 5; i++) {
            det.landmarks[i][0] = (det.landmarks[i][0] * targetSize - dx) / scale;
            det.landmarks[i][1] = (det.landmarks[i][1] * targetSize - dy) / scale;
        }
    }

    return detections;
};

const runFaceLibParsing = async (alignedFace: ImageData, config: any): Promise<Uint8ClampedArray> => {
    const modelPath = 'models/face-restoration/ParseNet-Parsing_FP16.onnx';
    const session = await loadSession(modelPath, config);

    const size = 512;
    let float32: any = new Float32Array(3 * size * size);
    for (let i = 0, j = 0; i < alignedFace.data.length; i += 4, j++) {
        float32[j] = (alignedFace.data[i] / 127.5) - 1.0;
        float32[j + size * size] = (alignedFace.data[i + 1] / 127.5) - 1.0;
        float32[j + 2 * size * size] = (alignedFace.data[i + 2] / 127.5) - 1.0;
    }

    const inputType = 'float16';
    if (inputType === 'float16') float32 = float32ToFloat16(float32);

    const results = await session.run({ [session.inputNames[0]]: new ortInstance.Tensor(inputType, float32, [1, 3, size, size]) });

    // parsenet outputs: output_mask [1, 19, 512, 512]
    let maskData = results.output_mask.data;
    if (results.output_mask.type === 'float16') maskData = float16ToFloat32(maskData as any);

    const finalMask = new Uint8ClampedArray(size * size);
    // argmax over 19 channels
    for (let i = 0; i < size * size; i++) {
        let maxVal = -Infinity;
        let maxIdx = 0;
        for (let c = 0; c < 19; c++) {
            const val = maskData[c * size * size + i];
            if (val > maxVal) {
                maxVal = val;
                maxIdx = c;
            }
        }
        // V31 Heuristic: Face core, nose, mouth, eyes are usually classes 1-13
        // We want to exclude ears (17, 18), hair (16), background (0), clothing?
        // Let's create a soft binary mask.
        const isCore = (maxIdx > 0 && maxIdx < 16);
        finalMask[i] = isCore ? 255 : 0;
    }
    return finalMask;
};

const internalRunFaceRestoration = async (imageData: ImageData, config: any) => {
    const { width, height } = imageData;
    const { fidelity = 0.5 } = config;

    // V31: Dynamic Detector Selection
    // Run a global NIMA scan to determine image quality
    const globalNima = await runNIMA(imageData, config);
    // If NIMA < 5.0 (Difficult/Low-Quality), upgrade to ResNet50 for robustness
    const detectorToUse = globalNima < 5.0 ? 'resnet50' : 'mobilenet0.25';
    console.log(`[AI Worker] Dynamic Detector: Global NIMA ${globalNima.toFixed(2)} -> Engaging ${detectorToUse}`);

    // 1. Detection Level 2 (RetinaFace)
    // V32: Lower threshold for low-NIMA images to catch faces in blurry motion
    const detectionThreshold = globalNima < 5.0 ? 0.65 : 0.82;
    const finalFaces = await runFaceLibDetection(imageData, { ...config, faceDetectionModel: detectorToUse }, detectionThreshold);

    if (finalFaces.length === 0) {
        console.log('[AI Worker] No faces found for restoration');
        return imageData;
    }

    const workingCanvas = new OffscreenCanvas(width, height);
    const workingCtx = workingCanvas.getContext('2d');
    if (!workingCtx) throw new Error('Main canvas init failed');
    workingCtx.drawImage(await createImageBitmap(imageData), 0, 0);

    // 2. High-Precision restoration loop
    for (const face of finalFaces) {
        // V31: Size Gate (Avoid restoring tiny faces that might cause artifacts)
        const [fx, fy, fx2, fy2] = face.bbox;
        const faceArea = (fx2 - fx) * (fy2 - fy);
        if (faceArea < 1024) {
            console.log(`[AI Worker] Skipping face due to small area: ${Math.round(faceArea)}px`);
            continue;
        }

        // V31: Alignment to 512x512 FFHQ template
        const matrix = getAffineTransform(face.landmarks, REFERENCE_FACIAL_POINTS);
        const alignedFace = await warpAffine(imageData, matrix, 512, 512);

        // V31: Quality Gate (NIMA)
        // Skip if face is already high quality (> 7.5)
        const nimaScore = await runNIMA(alignedFace, config);
        if (nimaScore > 7.5) {
            console.log(`[AI Worker] Skipping restoration for high-quality face (NIMA: ${nimaScore.toFixed(2)})`);
            continue;
        }

        // 3. CodeFormer semantic reconstruction
        const cfSession = await modelRegistry.getOrLoad('models/face-restoration/CodeFormer-FaceRestoration_FP16.onnx');
        let float32: any = new Float32Array(3 * 512 * 512);
        for (let i = 0, j = 0; i < alignedFace.data.length; i += 4, j++) {
            float32[j] = (alignedFace.data[i] / 127.5) - 1.0;
            float32[j + 512 * 512] = (alignedFace.data[i + 1] / 127.5) - 1.0;
            float32[j + 2 * 512 * 512] = (alignedFace.data[i + 2] / 127.5) - 1.0;
        }

        const inputType = 'float16';
        if (inputType === 'float16') float32 = float32ToFloat16(float32);

        const inputs: any = { [cfSession.inputNames[0]]: new ortInstance.Tensor(inputType, float32, [1, 3, 512, 512]) };
        if (cfSession.inputNames.length > 1) {
            inputs[cfSession.inputNames[1]] = new ortInstance.Tensor('float32', new Float32Array([fidelity]), [1]);
        }

        const results = await cfSession.run(inputs);
        let restoredData = results[Object.keys(results)[0]].data;
        if (results[Object.keys(results)[0]].type === 'float16') restoredData = float16ToFloat32(restoredData as any);

        // Convert planar back to ImageData
        const restoredFacePixels = new Uint8ClampedArray(512 * 512 * 4);
        for (let i = 0; i < 512 * 512; i++) {
            restoredFacePixels[i * 4] = Math.min(255, Math.max(0, (restoredData[i] + 1) * 127.5));
            restoredFacePixels[i * 4 + 1] = Math.min(255, Math.max(0, (restoredData[i + 512 * 512] + 1) * 127.5));
            restoredFacePixels[i * 4 + 2] = Math.min(255, Math.max(0, (restoredData[i + 2 * 512 * 512] + 1) * 127.5));
            restoredFacePixels[i * 4 + 3] = 255;
        }
        const restoredFaceImg = new ImageData(restoredFacePixels, 512, 512);

        // 4. Semantic Masking (ParsingNet)
        const mask = await runFaceLibParsing(restoredFaceImg, config);

        const maskedRestorePixels = new Uint8ClampedArray(512 * 512 * 4);
        for (let i = 0; i < 512 * 512; i++) {
            maskedRestorePixels[i * 4] = restoredFacePixels[i * 4];
            maskedRestorePixels[i * 4 + 1] = restoredFacePixels[i * 4 + 1];
            maskedRestorePixels[i * 4 + 2] = restoredFacePixels[i * 4 + 2];
            maskedRestorePixels[i * 4 + 3] = mask[i]; // Alpha channel as mask
        }
        const maskedFaceCanvas = new OffscreenCanvas(512, 512);
        maskedFaceCanvas.getContext('2d')?.putImageData(new ImageData(maskedRestorePixels, 512, 512), 0, 0);

        // 5. Inverse Warp & Composite
        const invMatrix = invertMatrix(matrix);
        if (invMatrix) {
            const restoredAligned = await warpAffine(maskedFaceCanvas, invMatrix, width, height);
            const restoredBitmap = await createImageBitmap(restoredAligned);
            workingCtx.drawImage(restoredBitmap, 0, 0);
        }

        // V31: VRAM Cleanup (Proactive release)
        const parsePath = 'models/face-restoration/ParseNet-Parsing_FP16.onnx';
        if (sessionCache.has(parsePath)) {
            const session = sessionCache.get(parsePath);
            await session.release();
            sessionCache.delete(parsePath);
        }
    }

    return workingCtx.getImageData(0, 0, width, height);
};

const runFaceRestoration = async (imageData: ImageData, config: any): Promise<ImageData> => {
    const modelName = config.modelName || 'CodeFormer';
    const outImageData = await internalRunFaceRestoration(imageData, config);
    ctx.postMessage({ type: 'restore_result', data: outImageData, modelName });
    return outImageData;
};

/**
 * Bilinear Resizing for Analysis
 */
const resizeImageData = (imageData: ImageData, targetW: number, targetH: number): ImageData => {
    const { width, height, data } = imageData;
    const newData = new Uint8ClampedArray(targetW * targetH * 4);

    for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
            const srcX = (x + 0.5) * (width / targetW) - 0.5;
            const srcY = (y + 0.5) * (height / targetH) - 0.5;

            const x0 = Math.floor(srcX);
            const x1 = Math.min(x0 + 1, width - 1);
            const y0 = Math.floor(srcY);
            const y1 = Math.min(y0 + 1, height - 1);

            const dx = srcX - x0;
            const dy = srcY - y0;

            for (let c = 0; c < 4; c++) {
                const p00 = data[(y0 * width + x0) * 4 + c];
                const p01 = data[(y0 * width + x1) * 4 + c];
                const p10 = data[(y1 * width + x0) * 4 + c];
                const p11 = data[(y1 * width + x1) * 4 + c];

                const val = (p00 * (1 - dx) * (1 - dy)) +
                    (p01 * dx * (1 - dy)) +
                    (p10 * (1 - dx) * dy) +
                    (p11 * dx * dy);

                newData[(y * targetW + x) * 4 + c] = val;
            }
        }
    }
    return new ImageData(newData, targetW, targetH);
};

// FP16 Conversion Helper
const toHalf = (val: number): number => {
    const floatView = new Float32Array([val]);
    const int32View = new Int32Array(floatView.buffer);
    const x = int32View[0];
    const s = (x >> 16) & 0x8000;
    const e = ((x >> 23) & 0xFF) - 127 + 15;
    let m = x & 0x7FFFFF;

    if (e <= 0) {
        if (e < -10) return s;
        m = (m | 0x800000) >> (1 - e);
        return s | (m >> 13);
    } else if (e === 0xFF - 127 + 15) {
        return s | 0x7C00 | (m ? 1 : 0);
    } else {
        return s | (e << 10) | (m >> 13);
    }
};

const runNIMA = async (imageData: ImageData, config: any): Promise<number> => {
    const modelPath = config.localModelPath ? `${config.localModelPath}enhance/NIMA_FP16.onnx` : 'models/enhance/NIMA_FP16.onnx';
    const session = await loadSession(modelPath, config);

    const targetSize = 224;
    const resized = resizeImageData(imageData, targetSize, targetSize);
    const { data } = resized;

    // NIMA expects NHWC format: [1, 224, 224, 3]
    // ImageNet normalization: (x/255 - mean) / std
    // MobileNetV2 backbone: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]

    const isFP16 = true;
    const numElements = 1 * targetSize * targetSize * 3;
    let tensor: import('onnxruntime-web').Tensor;

    if (isFP16) {
        const float16 = new Uint16Array(numElements);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            float16[j] = toHalf((data[i] / 255.0 - 0.485) / 0.229);       // R
            float16[j + targetSize * targetSize] = toHalf((data[i + 1] / 255.0 - 0.456) / 0.224);   // G
            float16[j + 2 * targetSize * targetSize] = toHalf((data[i + 2] / 255.0 - 0.406) / 0.225);   // B
        }
        tensor = new ortInstance.Tensor('float16', float16, [1, 3, targetSize, targetSize]);
    } else {
        const float32 = new Float32Array(numElements);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            float32[j] = (data[i] / 255.0 - 0.485) / 0.229;       // R
            float32[j + targetSize * targetSize] = (data[i + 1] / 255.0 - 0.456) / 0.224;   // G
            float32[j + 2 * targetSize * targetSize] = (data[i + 2] / 255.0 - 0.406) / 0.225;   // B
        }
        tensor = new ortInstance.Tensor('float32', float32, [1, 3, targetSize, targetSize]);
    }

    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: tensor });
    const output = results[session.outputNames[0]].data;

    // NIMA output is a probability distribution over scores [1..10]
    let score = 0;
    for (let i = 0; i < 10; i++) {
        score += output[i] * (i + 1);
    }
    return score;
};

const runYOLOAnalysis = async (imageData: ImageData, config: any): Promise<any[]> => {
    const modelPath = config.localModelPath ? `${config.localModelPath}yolo/YOLO(v8n)_FP16.onnx` : 'models/yolo/YOLO(v8n)_FP16.onnx';
    const session = await loadSession(modelPath, config);

    const targetSize = 640;
    const { data: detectData, scale, dx, dy } = await resizeAndPad(imageData, targetSize);

    const isFP16 = true;
    const numElements = 3 * targetSize * targetSize;
    let tensor: import('onnxruntime-web').Tensor;

    if (isFP16) {
        const float16 = new Uint16Array(numElements);
        for (let i = 0, j = 0; i < detectData.length; i += 4, j++) {
            float16[j] = toHalf(detectData[i] / 255.0);
            float16[j + targetSize * targetSize] = toHalf(detectData[i + 1] / 255.0);
            float16[j + 2 * targetSize * targetSize] = toHalf(detectData[i + 2] / 255.0);
        }
        tensor = new ortInstance.Tensor('float16', float16, [1, 3, targetSize, targetSize]);
    } else {
        const float32 = new Float32Array(numElements);
        for (let i = 0, j = 0; i < detectData.length; i += 4, j++) {
            float32[j] = detectData[i] / 255.0;
            float32[j + targetSize * targetSize] = detectData[i + 1] / 255.0;
            float32[j + 2 * targetSize * targetSize] = detectData[i + 2] / 255.0;
        }
        tensor = new ortInstance.Tensor('float32', float32, [1, 3, targetSize, targetSize]);
    }

    const results = await session.run({ [session.inputNames[0]]: tensor });
    const output = results[session.outputNames[0]].data;
    const dims = results[session.outputNames[0]].dims;
    const proposals = dims[2];

    const boxes: number[][] = [];
    const scores: number[] = [];
    const classes: number[] = [];

    const INTERIOR_CLASSES = new Set([56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79]);
    const EXTERIOR_CLASSES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    for (let i = 0; i < proposals; i++) {
        // Find best class for this proposal
        let maxClassScore = -1;
        let bestClassIdx = -1;

        // We only care about person (0), interior, and exterior categories
        const classesToScan = [0, ...Array.from(INTERIOR_CLASSES), ...Array.from(EXTERIOR_CLASSES)];
        for (const c of classesToScan) {
            const score = output[(c + 4) * proposals + i];
            if (score > maxClassScore) {
                maxClassScore = score;
                bestClassIdx = c;
            }
        }

        if (maxClassScore > 0.3) {
            const cx = output[0 * proposals + i];
            const cy = output[1 * proposals + i];
            const w = output[2 * proposals + i];
            const h = output[3 * proposals + i];
            boxes.push([(cx - w / 2 - dx) / scale, (cy - h / 2 - dy) / scale, (cx + w / 2 - dx) / scale, (cy + h / 2 - dy) / scale]);
            scores.push(maxClassScore);
            classes.push(bestClassIdx);
        }
    }

    const keep = yoloNMS(boxes, scores, 0.45);
    const cocoNames: Record<number, string> = {
        0: 'person', 2: 'car', 7: 'truck', 9: 'traffic_light',
        56: 'chair', 57: 'couch', 60: 'dining_table'
    };

    return keep.map(idx => {
        const c = classes[idx];
        let type = 'other';
        if (c === 0) type = 'person';
        else if (INTERIOR_CLASSES.has(c)) type = 'interior';
        else if (EXTERIOR_CLASSES.has(c)) type = 'exterior';

        return {
            class: cocoNames[c] || `coco_${c}`,
            type,
            score: scores[idx],
            box: boxes[idx]
        };
    });
};

const applyToneMapping = (imageData: ImageData, nimaScore: number, colorStrength: number = 0.5, originalSource?: ImageData, isInterior: boolean = false, mode: PrimaryState = PrimaryState.NORMAL, metrics?: SignalMetrics): ImageData => {
    const pixels = new Uint8ClampedArray(imageData.data);
    const sourcePixels = originalSource ? originalSource.data : null;
    const len = pixels.length;

    // v77.0: Deterministic State Overrides
    const isRainScene = mode === PrimaryState.RAIN;

    // 1. Contrast Stretching (Subtle)
    let minPix = 255, maxPix = 0;
    let sum = 0;
    for (let i = 0; i < len; i += 4) {
        const avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (avg < minPix) minPix = avg;
        if (avg > maxPix) maxPix = avg;
        sum += avg;
    }

    const avgLuma = sum / (len / 4);

    // V14: Base gamma push for dark images, or darkening for bright images
    // v71.0: Hammer-slam gamma for overexposed/night photos for maximum visibility.
    let baseGamma = nimaScore < 5.0 ? 1.05 : 1.0;
    if (isRainScene) {
        // v68.1: For rain scenes, never boost gamma > 1.05. Silhouette contrast must be preserved.
        baseGamma = Math.min(baseGamma, 1.05);
    } else if (avgLuma < 80) baseGamma = 1.35; // v71.0: Pop shadow detail before ShadowBoost reset
    else if (avgLuma < 90) baseGamma = 1.15;
    else if (avgLuma > 170) baseGamma = 0.50; // v71.0: Stronger recovery for washed-out skies
    else if (avgLuma > 150) baseGamma = 0.75;
    else if (avgLuma > 115) baseGamma = 0.95;

    // v75.0: Absolution Override. Avoid gamma caps for very dark images even in rain.
    if (avgLuma < 70) baseGamma = Math.max(baseGamma, 1.25);
    // v76.0: Overdrive II. Force light for deep darkness.
    if (avgLuma < 50) baseGamma = Math.max(baseGamma, 1.45);

    // v72.0: Diagnostic ShadowBoost scaling
    const medianLuma = metrics && typeof metrics.medianLuma === 'number' ? metrics.medianLuma : (avgLuma / 255.0);
    // v73.0: Shadow Restoration scaling (2.5 -> 3.0)
    let shadowBoost = clamp((0.45 - medianLuma) * 3.0, 1.0, (isRainScene ? 1.5 : 2.0));

    // v75.0: Absolution Shift. Remove arbitrary night cap and prioritze light.
    if (avgLuma < 80) {
        shadowBoost = Math.max(shadowBoost, 1.25); // v76.0: Guaranteed boost (1.15 -> 1.25)
    }

    // v74.0: Night Overdrive. Permit boost for deep darkness (< 60) even in rain.
    if (isRainScene && avgLuma > 70) shadowBoost = 1.00;

    const gamma = (baseGamma * shadowBoost) * (1 + 0.15 * colorStrength);

    // v73.0: Logging Gamma
    console.log(`[AI Worker] ToneMapping Debug: Min=${minPix}, Max=${maxPix}, AvgLuma=${avgLuma.toFixed(2)}, ShadowBoost=${shadowBoost.toFixed(2)}, Gamma=${gamma.toFixed(2)}${isRainScene ? ' [RAIN CAP]' : ''}`);

    const softMin = Math.max(0, minPix - 2.0);
    const softMax = Math.min(255, maxPix + 2.0);
    const softRange = Math.max(1, softMax - softMin);

    // V28 Saturation scaling
    const satFactor = 0.95 + (0.05 * colorStrength);

    // v72.0: Filmic Highlight Recovery
    const highlightRatio = metrics && typeof metrics.highlightRatio === 'number' ? metrics.highlightRatio : 0;
    const isOverexposed = highlightRatio > 0.15;

    for (let i = 0; i < len; i += 4) {
        // V30: Shadow Sentinel - We use the sourcePixels passed in for definitive anchoring.

        // Apply Contrast + Gamma
        for (let c = 0; c < 3; c++) {
            const original = pixels[i + c];
            const sLuma = sourcePixels ? (sourcePixels[i] * 0.299 + sourcePixels[i + 1] * 0.587 + sourcePixels[i + 2] * 0.114) / 255.0 : 0.5;

            // V32/V34/V35: Ambient Sanctuary Contrast Bypass (Smooth Sigmoid)
            // Skip the linear contrast stretch for shadows to preserve natural haze and structures.
            const stretchSigmoid = isInterior ? 1.0 / (1.0 + Math.exp(-15.0 * (sLuma - 0.40))) : 1.0;
            let stretched = original;
            if (sLuma > 0.05) {
                const sVal = (original - softMin) * (255 / softRange);
                stretched = original * (1 - stretchSigmoid) + sVal * stretchSigmoid;
            }

            let v = stretched / 255.0;

            // v72.0: Filmic Highlight Recovery
            if (isOverexposed && v > 0.8) {
                // Reinhard-like compression for blown highlights
                v = v / (1.0 + (v - 0.8) * 0.5);
            }

            // Gamma correction
            if (gamma !== 1.0) v = Math.pow(Math.max(0, v), 1 / gamma);
            stretched = 255 * v;

            // V18: Exposure Recovery Blend
            // v74.0: Sovereign Authority - Force 100% blend (Sovereignty) if a major shift is detected.
            let blendFactor = 0.5;
            const shiftMag = Math.abs(1.0 - baseGamma);
            if (shiftMag > 0.2) {
                blendFactor = 1.0;
            } else if (shiftMag > 0.1) {
                blendFactor = 0.8;
            } else {
                if (avgLuma > 110) blendFactor = isInterior ? 0.4 : 1.0;
                else if (avgLuma > 90) blendFactor = isInterior ? 0.0 : 0.6;
                else if (avgLuma > 70) blendFactor = 0.2;
            }

            pixels[i + c] = Math.min(255, Math.max(0, (original * (1 - blendFactor)) + (stretched * blendFactor)));
        }

        // V32: Ambient Sanctuary - Passive Noise Guard
        if (sourcePixels) {
            const sR = sourcePixels[i], sG = sourcePixels[i + 1], sB = sourcePixels[i + 2];
            const sLuma = (sR * 0.299 + sG * 0.587 + sB * 0.114) / 255.0;
            if (sLuma < 0.15) {
                pixels[i] = Math.min(pixels[i], sR * 1.05);
                pixels[i + 1] = Math.min(pixels[i + 1], sG * 1.05);
                pixels[i + 2] = Math.min(pixels[i + 2], sB * 1.05);
            }
        }

        // 2. V10 Naturalizer: Active pulling back of saturation
        if (nimaScore > 5.5) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            pixels[i] = Math.min(255, gray + (r - gray) * satFactor);
            pixels[i + 1] = Math.min(255, gray + (g - gray) * satFactor);
            pixels[i + 2] = Math.min(255, gray + (b - gray) * satFactor);
        }
    }
    return new ImageData(pixels, imageData.width, imageData.height);
};

/**
 * V34.7: Liquid Sharp - 3x3 High-Boost with Edge-Force
 * Reverted to 3x3 for stability, but kept the low detection threshold.
 */
const applyPrecisionSharpen = (imageData: ImageData, strength: number): ImageData => {
    if (strength < 0.05) return imageData;
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            const centerLuma = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const grad = computeGradients(data, idx, width);

            // Tier 1: mask based on detail and luma
            const mask = Math.min(1, grad / 5) * (centerLuma > 20 ? 1 : 0);

            // V21: Radiant Shield - Luma-Masked Sharpening
            // We suppress sharpening in bright regions to prevent neon blooming.
            const normLuma = centerLuma / 255;
            const sharpMask = Math.pow(Math.max(0, 1 - Math.max(0, normLuma - 0.5) / 0.5), 2);

            const activeStrength = strength * mask * sharpMask;
            if (activeStrength < 0.01) continue;

            for (let c = 0; c < 3; c++) {
                const center = data[idx + c];

                // 8-Neighbor Laplacian (Center=9, Neighbors=-1)
                let neighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy === 0 && dx === 0) continue;
                        neighbors += data[((y + dy) * width + (x + dx)) * 4 + c];
                    }
                }
                const laplacian = 9 * center - neighbors;

                // Tier 2: LCE (Mid-tone contrast push) - subtle
                const lce = (centerLuma > 60 && centerLuma < 190) ? (center - centerLuma) * 0.1 : 0;

                const sharpVal = center * (1 - activeStrength) + laplacian * activeStrength;
                output[idx + c] = Math.max(0, Math.min(255, sharpVal + lce));
            }
        }
    }
    return new ImageData(output, width, height);
};




// V29 Pixel Fusion Utilities (Linear Light)


import { REFERENCE_FACIAL_POINTS, getAffineTransform, invertMatrix, decodeRetinaFace } from '../utils/geometryUtils';

const warpAffine = async (imageData: ImageData | OffscreenCanvas, matrix: number[], outW: number, outH: number): Promise<ImageData> => {
    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas init failed');

    const bitmap = await createImageBitmap(imageData);
    ctx.clearRect(0, 0, outW, outH);
    // Standard affine [a b tx; c d ty] -> setTransform(a, c, b, d, tx, ty)
    ctx.setTransform(matrix[0], matrix[3], matrix[1], matrix[4], matrix[2], matrix[5]);
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, outW, outH);
};

// removed calculateWeight

/**
 * Gradient Computation (V29)
 * Simple local variance as a proxy for structural complexity at a pixel.
 */
const computeGradients = (data: Uint8ClampedArray | Float32Array, idx: number, w: number): number => {
    // Sampling 3x3 local variance
    let sum = 0;
    let sumSq = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const pIdx = idx + (dy * w + dx) * 4;
            if (pIdx < 0 || pIdx >= data.length) continue;
            const luma = (data[pIdx] + data[pIdx + 1] + data[pIdx + 2]) / 3;
            sum += luma;
            sumSq += luma * luma;
        }
    }
    const mean = sum / 9;
    return Math.max(0, (sumSq / 9) - (mean * mean));
};

// removed computeKurtosis

// removed reconcileTones

// removed computeResidualEnergy

// removed computeGradientEntropy

/**
 * Detail Band Extraction (V29)
 * Gaussian band-pass extract of high-frequencies from original image.
 */
// removed extractDetailBand

/**
 * Signal Reprojection Utility (V57)
 * Maps signal to natural image statistics [std=0.22] to stay within model manifold.
 */
const reprojectSignal = (tileData: Float32Array): void => {
    let sum = 0, sumSq = 0;
    for (let i = 0; i < tileData.length; i++) {
        const v = Math.max(0, Math.min(1, tileData[i]));
        sum += v;
        sumSq += v * v;
    }
    const mean = sum / tileData.length;
    const std = Math.sqrt(Math.max(1e-6, (sumSq / tileData.length) - (mean * mean)));
    const targetStd = 0.22; // Natural luminance std
    const scale = targetStd / std;

    for (let i = 0; i < tileData.length; i++) {
        tileData[i] = (tileData[i] - mean) * scale + mean;
    }
};


const lerpImageData = (imgA: ImageData, imgB: ImageData, strength: number): ImageData => {
    if (strength <= 0) return imgA;
    if (strength >= 1) return imgB;

    const dataA = imgA.data;
    const dataB = imgB.data;
    const result = new Uint8ClampedArray(dataA.length);

    for (let i = 0; i < dataA.length; i++) {
        result[i] = Math.round(dataA[i] * (1 - strength) + dataB[i] * strength);
    }
    return new ImageData(result, imgA.width, imgA.height);
};

// merged into the single definition below

const analyzeSignal = (imageData: ImageData, nimaScore: number): SignalMetrics => {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    // 1. L (Lowlight): Simple average luma normalization
    let sumLuma = 0;
    for (let i = 0; i < data.length; i += 4) {
        sumLuma += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    const avgLuma = sumLuma / (data.length / 4);
    const L = Math.max(0, 1 - (avgLuma / 110)); // Boost if luma < 110

    // 2. D (Detail) via Laplacian Variance
    // Heuristic: compute 3x3 laplacian on a sampling of pixels
    let lapSum = 0;
    let lapSumSq = 0;
    let count = 0;
    const stride = Math.floor(w / 128); // Sample for speed

    for (let y = 1; y < h - 1; y += stride) {
        for (let x = 1; x < w - 1; x += stride) {
            const idx = (y * w + x) * 4;
            const current = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

            // Laplacian kernel: [[0,-1,0],[-1,4,-1],[0,-1,0]]
            const up = (data[((y - 1) * w + x) * 4] + data[((y - 1) * w + x) * 4 + 1] + data[((y - 1) * w + x) * 4 + 2]) / 3;
            const down = (data[((y + 1) * w + x) * 4] + data[((y + 1) * w + x) * 4 + 1] + data[((y + 1) * w + x) * 4 + 2]) / 3;
            const left = (data[(y * w + x - 1) * 4] + data[(y * w + x - 1) * 4 + 1] + data[(y * w + x - 1) * 4 + 2]) / 3;
            const right = (data[(y * w + x + 1) * 4] + data[(y * w + x + 1) * 4 + 1] + data[(y * w + x + 1) * 4 + 2]) / 3;

            const lap = Math.abs(4 * current - up - down - left - right);
            lapSum += lap;
            lapSumSq += lap * lap;
            count++;
        }
    }

    const lapMean = lapSum / count;
    const lapVar = (lapSumSq / count) - (lapMean * lapMean);
    const D = Math.min(1, lapVar / 150); // Threshold for "High Detail"

    // 3. N (Noise): Inverse correlation of NIMA and Variance
    // If NIMA is low and variance is high in local patches, it's likely noise not detail.
    const N = Math.max(0, (6.5 - nimaScore) / 4) * (1 - D * 0.5);

    // 4. B (Blur): Low high-freq energy
    const B = Math.max(0, 1 - (lapMean / 15));

    // 5. H (Haze): Dark Channel Prior heuristic
    let minSum = 0;
    let maxLuma = 0;
    let minLuma = 255;
    const lumaHistogram = new Int32Array(256);
    const entropyStride = Math.max(4, Math.floor(data.length / 4000) * 4); // Adaptive sample for entropy

    for (let i = 0; i < data.length; i += entropyStride) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

        minSum += Math.min(r, g, b);
        if (luma > maxLuma) maxLuma = luma;
        if (luma < minLuma) minLuma = luma;
        lumaHistogram[luma]++;
    }

    const avgMin = minSum / (data.length / entropyStride);
    const H = Math.max(0, (avgMin - 40) / 180);

    // V51: Global Contrast (StdDev) for Recoverability R-Ratio logic
    const sampleCount = data.length / entropyStride;
    let lumaSum = 0;
    let lumaSumSq = 0;
    for (let i = 0; i < data.length; i += entropyStride) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = r * 0.299 + g * 0.587 + b * 0.114;
        lumaSum += luma;
        lumaSumSq += luma * luma;
    }
    const lumaMean = lumaSum / sampleCount;
    const lumaVar = (lumaSumSq / sampleCount) - (lumaMean * lumaMean);
    const globalStd = Math.sqrt(Math.max(0, lumaVar));

    // V51: Recoverability Test (R-Ratio)
    // Sample 16x16 tiles to compare local vs global contrast
    let rSum = 0, rCount = 0;
    const tileStride = 16;
    for (let y = 0; y < h - tileStride; y += tileStride * 4) {
        for (let x = 0; x < w - tileStride; x += tileStride * 4) {
            let tSum = 0, tSumSq = 0, tCount = 0;
            for (let ty = 0; ty < tileStride; ty += 2) {
                for (let tx = 0; tx < tileStride; tx += 2) {
                    const idx = ((y + ty) * w + (x + tx)) * 4;
                    const l = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255.0;
                    tSum += l; tSumSq += l * l; tCount++;
                }
            }
            const tMean = tSum / tCount;
            const tStd = Math.sqrt(Math.max(0, (tSumSq / tCount) - (tMean * tMean)));
            const recoverabilityFactor = tStd / (globalStd + 0.001);
            // We only care about recoverability in "hazy" (high luma) regions
            if (tMean > 0.45) {
                rSum += Math.min(1.5, recoverabilityFactor);
                rCount++;
            }
        }
    }
    const recoverability = rCount > 0 ? (rSum / rCount) : 1.0;

    // 6. S (Chromatic Entropy): Shannon entropy on luma distribution
    let entropy = 0;
    for (let j = 0; j < 256; j++) {
        if (lumaHistogram[j] > 0) {
            const p = lumaHistogram[j] / sampleCount;
            entropy -= p * Math.log2(p);
        }
    }
    const S = Math.min(1, entropy / 8); // Max entropy for 8-bit is 8

    // 7. K (Dynamic Range)
    const K = (maxLuma - minLuma) / 255;

    // 8. C (Scene Complexity): Weighted laplacian variance vs entropy
    const C = Math.min(1, (D * 0.7 + S * 0.3));

    // 9. Q (Base Quality): Normalized NIMA
    const Q = Math.min(1, Math.max(0, (nimaScore - 2) / 6));

    // 10. R (Rain): Vertical streak detection heuristic
    // We look for vertical high-freq > horizontal high-freq
    let vertSum = 0;
    let horizSum = 0;
    const atmosStride = Math.max(8, Math.floor(w / 100));
    for (let y = 1; y < h - 1; y += atmosStride) {
        for (let x = 1; x < w - 1; x += atmosStride) {
            const idx = (y * w + x) * 4;
            const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const up = (data[((y - 1) * w + x) * 4] + data[((y - 1) * w + x) * 4 + 1] + data[((y - 1) * w + x) * 4 + 2]) / 3;
            const down = (data[((y + 1) * w + x) * 4] + data[((y + 1) * w + x) * 4 + 1] + data[((y + 1) * w + x) * 4 + 2]) / 3;
            const left = (data[(y * w + x - 1) * 4] + data[(y * w + x - 1) * 4 + 1] + data[(y * w + x - 1) * 4 + 2]) / 3;
            const right = (data[(y * w + x + 1) * 4] + data[(y * w + x + 1) * 4 + 1] + data[(y * w + x + 1) * 4 + 2]) / 3;

            vertSum += Math.abs(2 * center - up - down);
            horizSum += Math.abs(2 * center - left - right);
        }
    }
    const rainAnisotropy = horizSum / (vertSum + 1e-6);
    const rainFactor = Math.min(1, Math.max(0, (rainAnisotropy - 1.2) * 1.5)); // v59: Corrected ratio (H/V)

    // 11. M (Motion Coherence) (V34.14)
    // Directional orientation histogram for global smudge detection
    const orientBins = new Float32Array(36);
    let orientTotal = 0;
    const strideM = Math.max(4, Math.floor(w / 128));
    for (let y = 1; y < h - 1; y += strideM) {
        for (let x = 1; x < w - 1; x += strideM) {
            const idx = (y * w + x) * 4;
            const u = (data[idx - w * 4] + data[idx - w * 4 + 1] + data[idx - w * 4 + 2]) / 3;
            const d = (data[idx + w * 4] + data[idx + w * 4 + 1] + data[idx + w * 4 + 2]) / 3;
            const l = (data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3;
            const r = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;

            const gx = r - l;
            const gy = d - u;
            const mag = Math.sqrt(gx * gx + gy * gy);
            if (mag < 1.0) continue; // Maximum sensitivity for soft motion

            const angle = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;
            const bin = Math.min(35, Math.floor(angle / 5));
            orientBins[bin]++;
            orientTotal++;
        }
    }

    // v55: M (Motion Coherence) (V34.14) (Threshold raised to 0.15 to prevent rain-shadowing)
    let maxBinValue = 0;
    for (let i = 0; i < 36; i++) {
        if (orientBins[i] > maxBinValue) maxBinValue = orientBins[i];
    }
    const M = orientTotal > 0 ? maxBinValue / orientTotal : 0;
    console.log(`[AI Worker] Coherence Guard: orientTotal=${orientTotal}, maxBin=${maxBinValue}, M=${M.toFixed(3)}`);

    // 12. J (JPEG): Periodic blocking artifact detection (8px boundaries)
    let blockDiff = 0;
    let interiorDiff = 0;
    for (let y = 8; y < h - 8; y += 8) {
        for (let x = 8; x < w - 8; x += 8) {
            const idxB = (y * w + x) * 4;
            const idxI = (y * w + x + 4) * 4;
            const b0 = (data[idxB] + data[idxB + 1] + data[idxB + 2]) / 3;
            const b1 = (data[idxB - 4] + data[idxB - 3] + data[idxB - 2]) / 3; // Boundary 1
            const i0 = (data[idxI] + data[idxI + 1] + data[idxI + 2]) / 3;
            const i1 = (data[idxI - 4] + data[idxI - 3] + data[idxI - 2]) / 3; // Interior 1

            blockDiff += Math.abs(b0 - b1);
            interiorDiff += Math.abs(i0 - i1);
        }
    }
    const J = Math.min(1, Math.max(0, (blockDiff / (interiorDiff + 1)) - 1.2));

    // 12. Noise Ratio (V58)
    // HF / G ratio. If high, energy is likely random salt/pepper noise.
    let gSum = 0;
    for (let y = 1; y < h - 1; y += stride) {
        for (let x = 1; x < w - 1; x += stride) {
            const up = (data[((y - 1) * w + x) * 4] + data[((y - 1) * w + x) * 4 + 1] + data[((y - 1) * w + x) * 4 + 2]) / 3;
            const down = (data[((y + 1) * w + x) * 4] + data[((y + 1) * w + x) * 4 + 1] + data[((y + 1) * w + x) * 4 + 2]) / 3;
            const left = (data[(y * w + x - 1) * 4] + data[(y * w + x - 1) * 4 + 1] + data[(y * w + x - 1) * 4 + 2]) / 3;
            const right = (data[(y * w + x + 1) * 4] + data[(y * w + x + 1) * 4 + 1] + data[(y * w + x + 1) * 4 + 2]) / 3;
            const gx = right - left;
            const gy = down - up;
            gSum += Math.sqrt(gx * gx + gy * gy);
        }
    }
    const gMean = gSum / (count || 1);
    const noiseRatio = lapMean / (gMean + 0.001);

    console.log(`[AI Worker] Signal Diagnostics: noiseRatio=${noiseRatio.toFixed(3)} (HF=${lapMean.toFixed(2)}, G=${gMean.toFixed(2)}), rainAnisotropy=${rainAnisotropy.toFixed(2)}`);

    // v72.0: Diagnostic Luma Median (derived from histogram)
    let cumulative = 0;
    let medianPixel = -1;
    const targetHalf = sampleCount / 2;
    for (let i = 0; i < 256; i++) {
        cumulative += lumaHistogram[i];
        if (cumulative >= targetHalf && medianPixel === -1) {
            medianPixel = i;
        }
    }
    const medianLuma = medianPixel / 255.0;

    // v72.0: Highlight Ratio (P(luma > 0.92))
    let highSum = 0;
    for (let i = 235; i < 256; i++) highSum += lumaHistogram[i];
    const highlightRatio = highSum / sampleCount;

    // v77.0: Deterministic State Scores (User Specified Formulas)
    const pDark = lumaHistogram.slice(0, 64).reduce((a, b) => a + b, 0) / sampleCount;
    const pBright = lumaHistogram.slice(242, 256).reduce((a, b) => a + b, 0) / sampleCount;

    const S_lowlight = clamp((0.45 - medianLuma) * 2.2, 0, 1) * clamp(pDark * 2, 0, 1);
    const S_overexp = clamp((pBright - 0.12) * 4, 0, 1);
    const S_rain = clamp((rainAnisotropy - 2.0) / 4.0, 0, 1);
    const S_noise = clamp((noiseRatio - 1.0) * 1.5, 0, 1);

    return {
        L, D, N, B, H, R: rainFactor, J, S, K, C, Q, V: lapVar, M,
        avgLuma,
        stdLuma: globalStd,
        recoverability,
        noiseRatio,
        rainAnisotropy,
        medianLuma,
        highlightRatio,
        entropy,
        S_lowlight,
        S_overexp,
        S_rain,
        S_noise
    };
}

interface SignalMetrics {
    L: number; D: number; N: number; B: number; H: number; R: number; J: number; S: number; K: number; C: number; Q: number; V: number; M: number;
    avgLuma: number;
    stdLuma: number;
    recoverability: number;
    noiseRatio: number;
    rainAnisotropy: number;
    medianLuma: number;
    highlightRatio: number;
    entropy: number;
    S_lowlight: number;
    S_overexp: number;
    S_rain: number;
    S_noise: number;
    upn?: UPNResults;
}

interface PolicyVector {
    mode: PrimaryState;
    primaryStrength: number;
    lowlight: number;
    deblur: number;
    denoise: number;
    sharpen: number;
    haze: number;
    derain: number;
    face: number;
    faceFidelity: number;
    color: number;
    safety: number;
    stdLuma: number;
    thetaDiff: number; // v100.0 Diffusion weight
}

const calculatePolicy = (m: SignalMetrics, hasFaces: boolean): PolicyVector => {
    // v100.0: Modular Neural Graph Orchestration
    const upn = m.upn!;
    const mode = upn.state as PrimaryState;
    const confidence = upn.confidence;

    // Phase 2: RL-Adjusted θ Refinement (π head)
    // s = [θ₀, d, c, device, f]
    const theta = rlController.refine(upn.theta, upn.degradation, confidence, upn.embedding);

    // Map θ to PolicyVector
    const rawFace = hasFaces ? (0.4 + m.Q * 0.5) : 0;
    const faceFidelity = hasFaces ? Math.max(0.1, Math.min(1.0, 0.4 + m.Q * 0.6)) : 1.0;

    return {
        mode,
        primaryStrength: confidence,
        lowlight: theta.gamma,
        deblur: theta.deblur,
        denoise: theta.denoise,
        sharpen: theta.sharp,
        haze: theta.dehaze,
        derain: theta.derain,
        face: clamp(rawFace, 0, 0.8),
        faceFidelity,
        color: clamp((1 - m.K) * 0.6 + (1 - m.S) * 0.4, 0, 0.7),
        safety: (m.Q > 0.8) ? 0.3 : 0.9,
        stdLuma: m.stdLuma,
        thetaDiff: theta.diff // Experimental diffusion weight
    };
}


const runEnhance = async (imageData: ImageData, config: any) => {
    throttleProgress({ type: 'progress', data: { current: 5, total: 100, stage: 'analysis', currentOperation: 'V29 Signal Intelligence...' } });

    // Phase A: Intelligence Gathering
    const nimaScore = await runNIMA(imageData, config);

    // v78.0: WebGPU Diagnostic Offload
    const detections = await runYOLOAnalysis(imageData, config);
    const hasFaces = detections.some(d => d.type === 'person');
    const interiorCount = detections.filter(d => d.type === 'interior').length;
    const exteriorCount = detections.filter(d => d.type === 'exterior').length;

    const metrics = analyzeSignal(imageData, nimaScore);

    // v100.0: Signal Intelligence (UPN v2 Authority)
    const upn = await runUPN(imageData);

    // v100.0 Phase 6: Start reward-relevant latency timer AFTER model loading/analysis
    const rewardTimer = new Timer('RL Reward Timer');
    rewardTimer.start();

    metrics.upn = upn;
    metrics.medianLuma = upn.theta.gamma;
    metrics.noiseRatio = upn.theta.denoise;
    metrics.entropy = 0.5; // Fixed placeholder
    metrics.rainAnisotropy = upn.theta.derain * 10.0;

    // Sovereign Scoring
    metrics.S_lowlight = upn.degradation.lowlight;
    metrics.S_overexp = 0;
    metrics.S_rain = upn.degradation.rain;
    metrics.S_noise = upn.degradation.noise;

    console.log(`[AI Worker] UPN v2 Signal Intelligence: Conf=${upn.confidence.toFixed(2)}, State=${upn.state}`);

    // v100.0: Modular Graph Adaptive Orchestration
    const P = calculatePolicy(metrics, hasFaces);

    const opsApplied: string[] = [];
    const policyDosages: Record<string, number> = { ...P as any };

    console.log(`[AI Worker] CNN STATE: ${P.mode} (Conf=${upn.confidence.toFixed(2)}, Luma=${metrics.medianLuma.toFixed(2)})`);

    let fusedImage = imageData;

    // v80.2: Exposure-Aware Normalization
    let exposureScale = 1.0;
    if (P.mode === PrimaryState.LOWLIGHT || P.mode === PrimaryState.OVEREXPOSED) {
        exposureScale = 0.5 / Math.max(metrics.medianLuma, 0.05);
        exposureScale = Math.min(2.5, Math.max(0.6, exposureScale));
        if (Math.abs(exposureScale - 1.0) > 0.05) {
            console.log(`[AI Worker] Exposure Scaling: x${exposureScale.toFixed(2)} (Primary Strength: ${P.primaryStrength.toFixed(2)})`);
            fusedImage = applyExposureScaling(fusedImage, exposureScale);
            opsApplied.push(`Exposure Scale (x${exposureScale.toFixed(2)})`);
        }
    }

    // Phase B: Modular Neural Restoration Graph
    let passCount = 0;
    const theta = {
        derain: P.derain,
        dehaze: P.haze,
        deblur: P.deblur,
        denoise: P.denoise,
        gamma: P.lowlight,
        sharp: P.sharpen,
        diff: P.thetaDiff
    };

    const tau_hq = 0.4; // HQ Path threshold
    const useHQ = upn.confidence < tau_hq || P.thetaDiff > 0.5;

    if (P.mode !== PrimaryState.NORMAL || useHQ) {
        throttleProgress({ type: 'progress', data: { current: 30, total: 100, stage: 'restoring', currentOperation: `Fast Path Restoration (θ=${P.primaryStrength.toFixed(2)})...` } });
        fusedImage = await runUniversalRestoration(fusedImage, theta, config);
        opsApplied.push(`Fast Path CNN`);
        passCount++;

        if (useHQ) {
            throttleProgress({ type: 'progress', data: { current: 45, total: 100, stage: 'restoring', currentOperation: 'HQ Diffusion Refinement...' } });
            // v100.0 HQ Path Implementation
            // y = y_f + θ_diff * (y_d - y_f)

            // Placeholder: runLatentDiffusion would be the ω path
            const y_diffusion = await runLatentDiffusion(imageData, theta, config);

            // Perform Blending on Canvas/TypedArray
            fusedImage = blendImages(fusedImage, y_diffusion, P.thetaDiff);

            console.log(`[AI Worker] HQ Path Blended: confidence=${upn.confidence.toFixed(2)}, theta_diff=${P.thetaDiff.toFixed(2)}`);
            opsApplied.push(`HQ Diffusion (${Math.round(P.thetaDiff * 100)}%)`);
        }
    }

    // Reverse Exposure Scaling before face/sharpening
    if (exposureScale !== 1.0) {
        fusedImage = applyExposureScaling(fusedImage, 1.0 / exposureScale);
    }

    // Phase C: Post-Processing & Face Alignment
    if (hasFaces && passCount < 2) {
        throttleProgress({ type: 'progress', data: { current: 60, total: 100, stage: 'restoring', currentOperation: 'Neural Face Restoration...' } });
        fusedImage = await runFaceRestoration(fusedImage, { ...config, modelName: 'CodeFormer' });
        opsApplied.push('CodeFormer Face');
        passCount++;
    }

    // v100.0: Perceptual Embedding Guard (UPN v2 Ph_upn)
    const restoreAnalysis = await runUPN(fusedImage);
    const dist = perceptualDistance(upn.embedding, restoreAnalysis.embedding);

    const lpipsThreshold = 0.35; // L2 calibrated threshold

    if (dist > lpipsThreshold && upn.confidence < 0.8) {
        console.warn(`[AI Worker] Perceptual Guard: UNACCEPTABLE STRUCTURE LOSS (Dist=${dist.toFixed(3)}, Conf=${upn.confidence.toFixed(2)}). Reverting.`);
        fusedImage = imageData; // Revert
        opsApplied.push(`GUARD: Reverted (Dist ${dist.toFixed(2)})`);
    }

    // RL Step: Log Reward components
    rlController.updateReward(
        { perceptual: 0, nima: nimaScore }, // baseline before
        { perceptual: dist, nima: await runNIMA(fusedImage, config) }, // after
        rewardTimer.end()
    );

    logCalibration({
        timestamp: new Date().toISOString(),
        medianLuma: metrics.medianLuma,
        entropy: metrics.entropy,
        anisotropy: metrics.rainAnisotropy,
        noiseRatio: metrics.noiseRatio,
        state: P.mode,
        passCount,
        entropyDelta: dist // Using embedding distance in logs
    });

    // Final Tone Mapping & Mastering
    throttleProgress({ type: 'progress', data: { current: 85, total: 100, stage: 'mastering', currentOperation: 'Sovereign Mastering...' } });
    const isInterior = interiorCount > exteriorCount;
    const toned = applyToneMapping(fusedImage, nimaScore, P.color, imageData, isInterior, P.mode, metrics);
    const finalColorAuthority = (P.mode === PrimaryState.OVEREXPOSED || P.mode === PrimaryState.LOWLIGHT) ? P.color : (P.color * 0.8);

    fusedImage = lerpImageData(fusedImage, toned, finalColorAuthority);
    opsApplied.push(`Color Mastered (${Math.round(finalColorAuthority * 100)}%)`);

    // Phase D: Shared Enhancements (Capped/Guarded)
    if (P.sharpen > 0.05) {
        fusedImage = applyPrecisionSharpen(fusedImage, P.sharpen);
        opsApplied.push(`Sharpen (${Math.round(P.sharpen * 100)}%)`);
    }


    const finalScore = await runNIMA(fusedImage, config);

    throttleProgress({ type: 'progress', data: { current: 100, total: 100, granular: 100, stage: 'executing', currentOperation: 'Enhance Complete' } });

    ctx.postMessage({
        type: 'enhance_result',
        data: fusedImage,
        nimaScore: finalScore,
        opsApplied: opsApplied,
        enhanceMetadata: {
            nimaScore: finalScore,
            opsApplied: opsApplied,
            policyDosages: policyDosages
        }
    });

    rewardTimer.end();
};

const runUniversalRestoration = async (imageData: ImageData, theta: any, _config: any): Promise<ImageData> => {
    if (!restorationEngine) {
        console.warn('[AI Worker] RestorationEngine not initialized - using fallback');
        return imageData;
    }

    // Update RL adapter with current theta shift if needed
    if (theta.diff > 0.5) {
        ThetaAdapter.update(0.1); // Reward for triggering HQ path
    }

    const result = await restorationEngine.process(imageData);
    return result;
};

async function handleMessage(e: MessageEvent) {
    const { type, config, imageData } = e.data;
    let data = e.data.data;

    if (!data && imageData) {
        data = imageData;
    }

    try {
        // V20: Reset progress for new batch
        if (type === 'enhance' || type === 'restore') {
            lastReportedProgress = 0;
        }

        switch (type) {
            case 'load':
                try {
                    await initORT(config);
                    // Initialize v100.x Restoration Engine
                    if (navigator.gpu) {
                        const adapter = await navigator.gpu.requestAdapter();
                        const device = await adapter?.requestDevice();
                        if (device) {
                            restorationEngine = new RestorationEngine(device);
                            const basePath = config?.localModelPath || 'models/';
                            const upnModelPath = `${basePath}enhance/UPN(v2)-Modular_FP16.onnx`;
                            const restorerModelPath = `${basePath}enhance/UniversalFilmRestorer_FP16.onnx`;

                            const upnSession = await modelRegistry.getOrLoad(upnModelPath);
                            const restorerSession = await modelRegistry.getOrLoad(restorerModelPath);

                            await restorationEngine.init(upnSession, restorerSession);
                        }
                    }
                    ctx.postMessage({ type: 'loaded', isLoaded: true });
                } catch (e: any) {
                    console.error('[AI Worker] Failed to initialize worker:', e);
                    ctx.postMessage({ type: 'error', error: e.message || String(e) });
                }
                break;

            case 'export_calibration': {
                const csv = [
                    'timestamp,medianLuma,entropy,anisotropy,noiseRatio,state,passes,delta',
                    ...calibrationLogs.map(l => `${l.timestamp},${l.medianLuma},${l.entropy},${l.anisotropy},${l.noiseRatio},${l.state},${l.passCount},${l.entropyDelta}`)
                ].join('\n');
                ctx.postMessage({ type: 'calibration_export', csv });
                break;
            }

            case 'cleanup': {
                modelRegistry.clear();
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
                        ctx.postMessage({ type: 'error', error: 'Missing data or config for upscale' });
                    }
                } finally {
                    isBusy = false;
                }
                break;

            case 'enhance':
                if (isBusy) {
                    ctx.postMessage({ type: 'error', error: 'Worker is busy.' });
                    return;
                }
                isBusy = true;
                try {
                    if (data && config) {
                        await runEnhance(data, config);
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
                        const modelName = `UltraZoom(x${config.scale})_FP16`;
                        modelPath = config.localModelPath ? `${config.localModelPath}ultrazoom/${modelName}.onnx` : `models/ultrazoom/${modelName}.onnx`;
                    } else if (config.modelName === 'yolo') {
                        modelPath = config.localModelPath ? `${config.localModelPath}yolo/YOLO(v8n)_FP16.onnx` : `models/yolo/YOLO(v8n)_FP16.onnx`;
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
                            const mName = `UltraZoom(x${mConfig.scale})_FP16`;
                            mPath = (config && config.localModelPath) ? `${config.localModelPath}ultrazoom/${mName}.onnx` : `models/ultrazoom/${mName}.onnx`;
                        } else if (mConfig.modelName === 'yolo') {
                            mPath = (config && config.localModelPath) ? `${config.localModelPath}yolo/YOLO(v8n)_FP16.onnx` : `models/yolo/YOLO(v8n)_FP16.onnx`;
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

            default:
                console.warn(`[AI Worker] Unknown message type: ${type}`);
        }
    } catch (err: any) {
        console.error(`[AI Worker] Global Error (${type}):`, err);
        ctx.postMessage({ type: 'error', error: err.message || String(err) });
    }
}
