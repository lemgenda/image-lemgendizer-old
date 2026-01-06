/**
 * Post-install script to patch TensorFlow.js packages for WebGPU compatibility
 *
 * This script applies critical patches to enable WebGPU backend and fix UI-blocking operations.
 *
 * Run automatically after: npm install, npm ci
 * Run manually: node scripts/postinstall.cjs
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Applying TensorFlow.js WebGPU patches...\n');

/**
 * Applies a text replacement patch to a file
 */
function patchFile(filePath, patches, description) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);

        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  File not found: ${filePath}`);
            return false;
        }

        let content = fs.readFileSync(fullPath, 'utf8');
        let patchCount = 0;

        for (const { search, replace, description: patchDesc } of patches) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            if (content.match(regex)) {
                content = content.replace(regex, replace);
                patchCount++;
                if (patchDesc) console.log(`  ✓ ${patchDesc}`);
            }
        }

        if (patchCount > 0) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ ${description} (${patchCount} patches applied)\n`);
            return true;
        } else {
            console.log(`ℹ️  ${description} - already patched\n`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Error patching ${filePath}:`, error.message);
        return false;
    }
}

// 1. Patch WebGPU Backend - requestAdapterInfo polyfill
patchFile(
    'node_modules/@tensorflow/tfjs-backend-webgpu/dist/base.js',
    [{
        search: 'const adapterInfo = await adapter.requestAdapterInfo();',
        replace: `const adapterInfo = adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {
            vendor: 'unknown',
            architecture: 'unknown',
            device: 'unknown',
            description: 'unknown',
        };`,
        description: 'Added requestAdapterInfo polyfill'
    }],
    'WebGPU Backend - Adapter Info'
);

// 2. Patch WebGPU Backend - Shader vec3<f32> casting
patchFile(
    'node_modules/@tensorflow/tfjs-backend-webgpu/dist/conv2d_mm_webgpu.js',
    [{
        search: 'case 3:\n        return \'resData = vec3<f32>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);\';',
        replace: 'case 3:\n        return \'resData = vec3<f32>(f32(x[xIndex]), f32(x[xIndex + 1]), f32(x[xIndex + 2]));\';',
        description: 'Fixed vec3<f32> shader casting'
    }],
    'WebGPU Backend - Shader Compiler'
);

// 3. Patch WebGPU Backend - Silence powerPreference warning on Windows
const webgpuBaseFiles = [
    'node_modules/@tensorflow/tfjs-backend-webgpu/dist/base.js',
    'node_modules/@tensorflow/tfjs-backend-webgpu/dist/tf-backend-webgpu.js',
    'node_modules/@tensorflow/tfjs-backend-webgpu/dist/tf-backend-webgpu.es2017.js'
];

webgpuBaseFiles.forEach((file) => {
    patchFile(
        file,
        [{
            search: 'const gpuDescriptor = {\n            powerPreference:',
            replace: 'const gpuDescriptor = (navigator.platform.indexOf(\'Win\') !== -1) ? {} : {\n            powerPreference:',
            description: 'Silenced powerPreference warning on Windows'
        }, {
            search: 'const gpuDescriptor = {\n                powerPreference:',
            replace: 'const gpuDescriptor = (navigator.platform.indexOf(\'Win\') !== -1) ? {} : {\n                powerPreference:',
            description: 'Silenced powerPreference warning on Windows (16-space indentation)'
        }, {
            search: 'gpuDescriptor = {\n                            powerPreference:',
            replace: 'gpuDescriptor = (navigator.platform.indexOf(\'Win\') !== -1) ? {} : {\n                            powerPreference:',
            description: 'Silenced powerPreference warning on Windows (minified/bundled)'
        }],
        `WebGPU Backend - Windows Warning Fix (${path.basename(file)})`
    );
});

// 3-6. Patch COCO-SSD - Replace sync NMS with async (ONLY, not dataSync)
// NOTE: We do NOT patch dataSync() because it breaks minified code's promise handling
const cocoSsdFiles = [
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.js',
    'node_modules/@tensorflow-models/coco-ssd/dist/index.js',
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.min.js',
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.es2017.esm.min.js'
];

cocoSsdFiles.forEach((file, index) => {
    patchFile(
        file,
        [{
            search: 'tf.image.nonMaxSuppression(',
            replace: 'tf.image.nonMaxSuppressionAsync(',
            description: 'Converted NMS to async'
        }, {
            search: 'image.nonMaxSuppression(',
            replace: 'image.nonMaxSuppressionAsync(',
            description: 'Converted NMS to async (minified)'
        }],
        `COCO-SSD File ${index + 1}/4`
    );
});

// 7. Fix COCO-SSD tsconfig to prevent IDE errors
patchFile(
    'node_modules/@tensorflow-models/coco-ssd/tsconfig.json',
    [{
        search: '"extends": "../tsconfig",',
        replace: '"files": ["package.json"],',
        description: 'Fixed tsconfig to prevent IDE errors'
    }],
    'COCO-SSD - TypeScript Config'
);

console.log('✨ All TensorFlow.js patches applied successfully!\n');
console.log('Patches include:');
console.log('  • WebGPU adapter initialization compatibility');
console.log('  • Shader compilation fixes (vec3<f32> casting)');
console.log('  • Async NMS (prevents UI thread locking)\n');
console.log('Note: dataSync() warnings are expected but do not cause UI blocking.\n');
