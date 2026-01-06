#!/usr/bin/env node

/**
 * Post-install script to patch TensorFlow.js packages for WebGPU compatibility
 *
 * This script applies critical patches to enable WebGPU backend and fix memory/async errors.
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Applying TensorFlow.js WebGPU patches...\n');

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
            const isRegex = search instanceof RegExp;
            const hasMatch = isRegex ? search.test(content) : content.includes(search);

            if (hasMatch) {
                const regex = isRegex ? search : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
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

// 1. Patch WebGPU Backend
// 1. Patch WebGPU Backend
patchFile('node_modules/@tensorflow/tfjs-backend-webgpu/dist/base.js', [{
    search: 'const gpuDescriptor = {',
    replace: `const isWindows = typeof navigator !== 'undefined' &&
        ((navigator.platform && navigator.platform.indexOf('Win') > -1) ||
         (navigator.userAgent && navigator.userAgent.indexOf('Windows') > -1));
    const gpuDescriptor = isWindows ? undefined : {`,
    description: 'Fixed Windows powerPreference warning'
}], 'WebGPU Backend - Windows Fix');

patchFile('node_modules/@tensorflow/tfjs-backend-webgpu/dist/conv2d_mm_webgpu.js', [{
    search: "return 'resData = vec3<f32>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);';",
    replace: "return 'resData = vec3<f32>(f32(x[xIndex]), f32(x[xIndex + 1]), f32(x[xIndex + 2]));';",
    description: 'Fixed vec3<f32> shader casting'
}], 'WebGPU Backend - Shader Compiler');

// 2. Patch COCO-SSD (UMD & CJS)
const cocoSsdUmdFiles = [
    'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.js',
    'node_modules/@tensorflow-models/coco-ssd/dist/index.js'
];

cocoSsdUmdFiles.forEach(file => {
    patchFile(file, [{
        // This regex matches the entire block from case 3 to the return statement, wiping out any previous broken patches
        search: /case 3:\s+boxes = _b\.sent\(\);[\s\S]+?return \[2 \/\*return\*\/\s*,\s*this\.buildDetectedObjects\(width, height, boxes, maxScores, indexes, classes\)\];/g,
        replace: `case 3:
                        boxes = _b.sent();
                        var _s = [result[1].shape[1], result[1].shape[3]];
                        batched.dispose();
                        _a = this.calculateMaxScores(scores, result[0].shape[1], result[0].shape[2]), maxScores = _a[0], classes = _a[1];
                        prevBackend = tf.getBackend();
                        if (tf.getBackend() === 'webgl') { tf.setBackend('cpu'); }
                        return [4 /*yield*/, (async function () { var b2 = tf.tensor2d(boxes, _s); var res = await tf.image.nonMaxSuppressionAsync(b2, maxScores, maxNumBoxes, minScore, minScore); b2.dispose(); return res; })()];
                    case 4:
                        indexTensor = _b.sent();
                        return [4 /*yield*/, indexTensor.data()];
                    case 5:
                        indexes = _b.sent();
                        indexTensor.dispose();
                        if (prevBackend !== tf.getBackend()) { tf.setBackend(prevBackend); }
                        tf.dispose(result);
                        return [2 /*return*/, this.buildDetectedObjects(width, height, boxes, maxScores, indexes, classes)];`,
        description: 'Applied full-block Async NMS fix with robust memory management'
    }], `COCO-SSD UMD/CJS Fix: ${path.basename(file)}`);
});

// 3. Patch COCO-SSD (ESM Minified)
patchFile('node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.es2017.esm.min.js', [
    {
        // Fix the raw data retrieval - must be awaited for async data() (handles dataSync calls)
        search: /l=await this\.model\.executeAsync\(d\),t=l\[0\]\.data(Sync)?\(\),o=l\[1\]\.data(Sync)?\(\)/,
        replace: 'l=await this.model.executeAsync(d),t=await l[0].data(),o=await l[1].data()',
        description: 'Awaited initial data (ESM)'
    },
    {
        // Capture shapes correctly (using shape[3] as per original)
        search: /d\.dispose\(\),m\.dispose\(l\)|const _s=\[l\[1\]\.shape\[1\],l\[1\]\.shape\[2\]\];d\.dispose\(\)/,
        replace: 'const _s=[l[1].shape[1],l[1].shape[3]];d.dispose()',
        description: 'Capture shapes (ESM)'
    },
    {
        // Exact Async NMS replacement (Replaces the specific m.tidy block found in 2.2.3)
        // Original: const y=m.tidy((()=>{const e=m.tensor2d(o,[l[1].shape[1],l[1].shape[3]]);return m.image.nonMaxSuppression(e,p,a,i,i)}))
        search: /const y=m\.tidy\(\(\(\)=>{const e=m\.tensor2d\(o,\[l\[1\]\.shape\[1\],l\[1\]\.shape\[3\]\]\);return m\.image\.nonMaxSuppression\(e,p,a,i,i\)}\)\)/,
        replace: 'const y=await(async()=>{const e=m.tensor2d(o,[l[1].shape[1],l[1].shape[3]]);const r=await m.image.nonMaxSuppressionAsync(e,p,a,i,i);e.dispose();return r})()',
        description: 'Async NMS (ESM - Tidy Replacement)'
    },
    {
        // Ensure data() is awaited (handles both dataSync and our previous async conversion)
        search: /N=y\.data(Sync)?\(\)/,
        replace: 'N=await y.data()',
        description: 'Awaited NMS data (ESM)'
    },
    {
        // Final disposal at end
        search: /return y\.dispose\(\),(m\.dispose\(l\),)?c!==m\.getBackend/,
        replace: 'return y.dispose(),m.dispose(l),c!==m.getBackend',
        description: 'Final disposal (ESM)'
    }
], 'COCO-SSD ESM Fix');

// 4. Patch Engine Safeguard
patchFile('node_modules/@tensorflow/tfjs-core/dist/engine.js', [{
    search: 'moveData(backend, dataId) {\n        const info = this.state.tensorData.get(dataId);',
    replace: 'moveData(backend, dataId) {\n        if (!backend) return; // Safeguard against undefined backend during races\n        const info = this.state.tensorData.get(dataId);',
    description: 'Fixed moveData undefined backend crash'
}], 'TFJS Core - Engine Fix');

console.log('✨ All TensorFlow.js patches applied successfully!\n');
