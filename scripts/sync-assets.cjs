const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ORT_DIR = path.join(PUBLIC_DIR, 'ort');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');

// Ensure directories exist
[ORT_DIR, MODELS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Copies ORT WASM and Glue files
 */
function syncOrtAssets() {
    console.log('--- Syncing ORT Assets ---');
    const ortSource = path.join(ROOT_DIR, 'node_modules', 'onnxruntime-web', 'dist');
    if (!fs.existsSync(ortSource)) {
        console.warn('[Warning] onnxruntime-web dist not found in node_modules');
        return;
    }

    const files = fs.readdirSync(ortSource);
    files.forEach(file => {
        // Copy .wasm, .js, and rename .mjs to .js for worker compatibility
        if (file.endsWith('.wasm') || file.endsWith('.js') || file.endsWith('.mjs')) {
            const src = path.join(ortSource, file);
            let destName = file;
            if (file.endsWith('.mjs')) {
                destName = file.replace('.mjs', '.js');
            }
            const dest = path.join(ORT_DIR, destName);
            fs.copyFileSync(src, dest);
            console.log(`[ORT] Synchronized: ${destName}`);
        }
    });
}

/**
 * Recursively copies models from local_models to public/models
 */
async function syncModels(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            await syncModels(srcPath, destPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            const name = entry.name.toLowerCase();

            // v106.1: Unified Embedded Weight Sync
            // All models now have embedded weights. We ONLY copy *_FP16.onnx models to public.
            // Other metadata (.json, .bin) is only copied if explicitly associated with an FP16 model.
            const isFP16Model = name.endsWith('_fp16.onnx');
            const isFP16Metadata = (ext === '.json' || ext === '.bin') && name.includes('_fp16');

            if (isFP16Model || isFP16Metadata) {
                // Ensure directory exists
                const dir = path.dirname(destPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const srcStats = fs.statSync(srcPath);
                let shouldCopy = true;

                if (fs.existsSync(destPath)) {
                    const destStats = fs.statSync(destPath);
                    if (srcStats.size === destStats.size && srcStats.mtimeMs <= destStats.mtimeMs) {
                        shouldCopy = false;
                    }
                }

                if (shouldCopy) {
                    fs.copyFileSync(srcPath, destPath);
                    const sizeMB = (srcStats.size / (1024 * 1024)).toFixed(2);
                    console.log(`[Model] Synchronized: ${path.relative(LOCAL_MODELS_SRC_DIR, srcPath)} (${sizeMB} MB)`);
                }
            }
        }
    }
}

const LOCAL_MODELS_SRC_DIR = path.join(ROOT_DIR, 'local_models');

console.log('=== Starting Unified Asset Synchronization ===');
syncOrtAssets();
syncModels(LOCAL_MODELS_SRC_DIR, MODELS_DIR).then(() => {
    console.log('=== Asset Synchronization Complete ===');
}).catch(err => {
    console.error('=== Asset Synchronization Failed ===');
    console.error(err);
});
