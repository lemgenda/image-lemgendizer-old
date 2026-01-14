const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const LIB_DIR = path.join(PUBLIC_DIR, 'lib');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');

// Ensure directories exist
[LIB_DIR, MODELS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const ASSETS_TO_COPY = [
    // Libraries
    {
        src: 'node_modules/@tensorflow/tfjs/dist/tf.min.js',
        dest: 'lib/tf.min.js'
    },
    {
        src: 'node_modules/@tensorflow/tfjs-backend-webgpu/dist/tf-backend-webgpu.min.js',
        dest: 'lib/tf-backend-webgpu.min.js'
    },
    {
        src: 'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.min.js',
        dest: 'lib/coco-ssd.min.js'
    },
    {
        src: 'node_modules/upscaler/dist/browser/umd/upscaler.min.js',
        dest: 'lib/upscaler.min.js'
    },
    // Esrgan Slim Models
    {
        src: 'node_modules/@upscalerjs/esrgan-slim/models/x2/model.json',
        dest: 'models/esrgan-slim/x2/model.json'
    },
    {
        src: 'node_modules/@upscalerjs/esrgan-slim/models/x2/2/model.json', // Check if this exists, nested
        dest: 'models/esrgan-slim/x2/2/model.json',
        optional: true
    },
    {
        src: 'node_modules/@upscalerjs/esrgan-slim/models/x3/model.json',
        dest: 'models/esrgan-slim/x3/model.json'
    },
    {
        src: 'node_modules/@upscalerjs/esrgan-slim/models/x4/model.json',
        dest: 'models/esrgan-slim/x4/model.json'
    }
];

// Helper to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('--- Copying AI Assets ---');

ASSETS_TO_COPY.forEach(asset => {
    const srcPath = path.join(ROOT_DIR, asset.src);
    const destPath = path.join(PUBLIC_DIR, asset.dest);

    if (fs.existsSync(srcPath)) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        if (asset.dest.includes('tf-backend-webgpu.min.js')) {
            let content = fs.readFileSync(srcPath, 'utf8');
            // Patch powerPreference to suppress Windows warning
            // Pattern: powerPreference:t.env().get("WEBGPU_USE_LOW_POWER_GPU")?"low-power":"high-performance"
            const regex = /powerPreference:.\.env\(\)\.get\("WEBGPU_USE_LOW_POWER_GPU"\)\?"low-power":"high-performance"/g;
            if (regex.test(content)) {
                content = content.replace(regex, ''); // Removes the property entirely, leaving e={}
                console.log('Patched tf-backend-webgpu.min.js to suppress powerPreference warning.');
            } else {
                console.warn('Warning: Could not find powerPreference pattern in tf-backend-webgpu.min.js to patch.');
            }
            fs.writeFileSync(destPath, content);
            console.log(`Copied and Patched: ${asset.src} -> ${asset.dest}`);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied: ${asset.src} -> ${asset.dest}`);
        }
    } else if (!asset.optional) {
        console.warn(`Warning: Source file not found: ${asset.src}`);
    }
});

// Also copy the entire models directory from @upscalerjs/esrgan-slim if it exists
const esrganModelsSrc = path.join(ROOT_DIR, 'node_modules/@upscalerjs/esrgan-slim/models');
const esrganModelsDest = path.join(MODELS_DIR, 'esrgan-slim');
if (fs.existsSync(esrganModelsSrc)) {
    copyDir(esrganModelsSrc, esrganModelsDest);
    console.log('Copied all ESRGAN-slim models');
}

// Copy downloaded local models (COCO-SSD)
const localModelsSrc = path.join(ROOT_DIR, 'local_models');
const localModelsDest = path.join(MODELS_DIR);
if (fs.existsSync(localModelsSrc)) {
    copyDir(localModelsSrc, localModelsDest);
    console.log('Copied local models (COCO-SSD) to public/models');
}

console.log('--- Assets Copy Complete ---');
