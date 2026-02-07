const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const LIB_DIR = path.join(PUBLIC_DIR, 'lib');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');

[LIB_DIR, MODELS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ORT_SOURCE = path.join(ROOT_DIR, 'node_modules/onnxruntime-web/dist');
const ORT_FILES = [
    'ort.all.min.js',
    'ort.all.min.js.map',
    'ort-wasm.wasm',
    'ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm',
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs'
];

console.log('--- Copying AI Assets (Unified Schema) ---');

if (fs.existsSync(ORT_SOURCE)) {
    ORT_FILES.forEach(file => {
        const src = path.join(ORT_SOURCE, file);
        const dest = path.join(LIB_DIR, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`[ORT] Copied: ${file}`);
        }
    });
}

const modelsToCopy = [
    { src: 'local_models/restoration/MIRNetV2-LowLight.onnx', dest: 'models/restoration/MIRNetV2-LowLight.onnx' },
    { src: 'local_models/restoration/MPRNet-Deraining.onnx', dest: 'models/restoration/MPRNet-Deraining.onnx' },
    { src: 'local_models/restoration/NAFNet-Denoising.onnx', dest: 'models/restoration/NAFNet-Denoising.onnx' },
    { src: 'local_models/restoration/NAFNet-Debluring(REDS).onnx', dest: 'models/restoration/NAFNet-Debluring(REDS).onnx' },
    { src: 'local_models/restoration/FFANet-Dehazing(Indoor).onnx', dest: 'models/restoration/FFANet-Dehazing(Indoor).onnx' },
    { src: 'local_models/restoration/FFANet-Dehazing(Outdoor).onnx', dest: 'models/restoration/FFANet-Dehazing(Outdoor).onnx' },

    { src: 'local_models/ultrazoom/UltraZoom_x2.onnx', dest: 'models/ultrazoom/UltraZoom_x2.onnx' },
    { src: 'local_models/ultrazoom/UltraZoom_x3.onnx', dest: 'models/ultrazoom/UltraZoom_x3.onnx' },
    { src: 'local_models/ultrazoom/UltraZoom_x4.onnx', dest: 'models/ultrazoom/UltraZoom_x4.onnx' },
    { src: 'local_models/yolo/yolov8n-fp16.onnx', dest: 'models/yolo/yolov8n-fp16.onnx' }
];

modelsToCopy.forEach(item => {
    const srcPath = path.join(ROOT_DIR, item.src);
    const destPath = path.join(PUBLIC_DIR, item.dest);

    if (fs.existsSync(srcPath)) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        fs.copyFileSync(srcPath, destPath);
        const size = fs.statSync(destPath).size / 1024 / 1024;
        console.log(`[Model] Copied: ${item.dest} (${size.toFixed(2)} MB)`);

        const srcDataPath = srcPath + '.data';
        const destDataPath = destPath + '.data';
        if (fs.existsSync(srcDataPath)) {
            fs.copyFileSync(srcDataPath, destDataPath);
            const dataSize = fs.statSync(destDataPath).size / 1024 / 1024;
            console.log(`[Model] Copied associated data: ${item.dest}.data (${dataSize.toFixed(2)} MB)`);
        }
    } else {
        console.warn(`[Warning] Source model not found: ${item.src}`);
    }
});

console.log('--- Assets Copy Complete ---');
