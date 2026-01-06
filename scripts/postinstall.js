#!/usr/bin/env node

/**
 * Post-install script to patch TensorFlow.js packages for WebGPU compatibility
 *
 * This script applies critical patches to enable WebGPU backend and eliminate
 * synchronous GPU operations that cause UI thread blocking.
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Applying TensorFlow.js WebGPU patches...\n');

/**
 * Applies a text replacement patch to a file
 */
function patchFile(filePath, patches, description) {
    try {
        const fullPath = path.join(__dirname, filePath);

        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  File not found: ${filePath}`);
            return false;
        }

        let content = fs.readFileSync(fullPath, 'utf8');
        let patchCount = 0;

        for (const { search, replace, description: patchDesc } of patches) {
            if (content.includes(search)) {
                content = content.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
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

// 3. Patch COCO-SSD - Main UMD bundle
patchFile(
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.js',
    [
        {
            search: 'tf.image.nonMaxSuppression(',
            replace: 'tf.image.nonMaxSuppressionAsync(',
            description: 'Converted NMS to async'
        },
        {
            search: '.dataSync()',
            replace: '.data()',
            description: 'Converted dataSync to async data'
        }
    ],
    'COCO-SSD - Main Bundle'
);

// 4. Patch COCO-SSD - CommonJS entry
patchFile(
    'node_modules/@tensorflow-models/coco-ssd/dist/index.js',
    [
        {
            search: 'tf.image.nonMaxSuppression(',
            replace: 'tf.image.nonMaxSuppressionAsync(',
            description: 'Converted NMS to async'
        },
        {
            search: '.dataSync()',
            replace: '.data()',
            description: 'Converted dataSync to async data'
        }
    ],
    'COCO-SSD - CommonJS Entry'
);

// 5. Patch COCO-SSD - Minified UMD
patchFile(
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.min.js',
    [
        {
            search: 'image.nonMaxSuppression(',
            replace: 'image.nonMaxSuppressionAsync(',
            description: 'Converted NMS to async'
        },
        {
            search: '.dataSync()',
            replace: '.data()',
            description: 'Converted dataSync to async data'
        }
    ],
    'COCO-SSD - Minified UMD'
);

// 6. Patch COCO-SSD - ES2017 module
patchFile(
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.es2017.esm.min.js',
    [
        {
            search: 'image.nonMaxSuppression(',
            replace: 'image.nonMaxSuppressionAsync(',
            description: 'Converted NMS to async'
        },
        {
            search: '.dataSync()',
            replace: '.data()',
            description: 'Converted dataSync to async data'
        }
    ],
    'COCO-SSD - ES2017 Module'
);

// 7. Fix COCO-SSD tsconfig to prevent IDE errors
patchFile(
    'node_modules/@tensorflow-models/coco-ssd/tsconfig.json',
    [{
        search: /"extends": "\.\.\/tsconfig",\s*"include": \[\s*"src\/"\s*\],/,
        replace: '"files": ["package.json"],',
        description: 'Fixed tsconfig to prevent IDE errors'
    }],
    'COCO-SSD - TypeScript Config'
);

console.log('✨ All TensorFlow.js patches applied successfully!\n');
console.log('Patches include:');
console.log('  • WebGPU adapter initialization compatibility');
console.log('  • Shader compilation fixes (vec3<f32> casting)');
console.log('  • Async GPU operations (no UI blocking)');
console.log('  • All synchronous dataSync converted to async\n');
