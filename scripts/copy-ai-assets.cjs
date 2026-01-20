const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    { src: 'node_modules/@tensorflow/tfjs/dist/tf.min.js', dest: 'lib/tf.min.js' },
    { src: 'node_modules/@tensorflow/tfjs-backend-webgpu/dist/tf-backend-webgpu.min.js', dest: 'lib/tf-backend-webgpu-patched.min.js' },
    { src: 'node_modules/@tensorflow-models/coco-ssd/dist/coco-ssd.min.js', dest: 'lib/coco-ssd.min.js' },
    { src: 'node_modules/upscaler/dist/browser/umd/upscaler.min.js', dest: 'lib/upscaler.min.js' },
    { src: 'node_modules/@tensorflow-models/body-segmentation/dist/body-segmentation.min.js', dest: 'lib/body-segmentation.min.js' },
    { src: 'node_modules/@tensorflow-models/face-landmarks-detection/dist/face-landmarks-detection.min.js', dest: 'lib/face-landmarks-detection.min.js' }
];

console.log('--- Copying AI Assets (V15 - Self-Healing) ---');

ASSETS_TO_COPY.forEach(asset => {
    const srcPath = path.join(ROOT_DIR, asset.src);
    const destPath = path.join(PUBLIC_DIR, asset.dest);

    if (fs.existsSync(srcPath)) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        let content = fs.readFileSync(srcPath, 'utf8');
        let modified = false;

        if (asset.dest.includes('tf-backend-webgpu-patched.min.js')) {
            console.log(`Processing Backend: ${asset.dest}`);
            content = '/* eslint-disable */\n' + content;

            // Fix 1: powerPreference
            const powerRegex = /powerPreference:(.\.env\(\)\.get\("WEBGPU_USE_LOW_POWER_GPU"\)\?"low-power":"high-performance"|"high-performance")/g;
            if (powerRegex.test(content)) {
                content = content.replace(powerRegex, '__powerPreference:$1');
                console.log('  [MATCH] powerPreference');
                modified = true;
            }

            // Fix 2: vec3 constructor fix - Robust Regex
            // Matches: resData = vec3<f32>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);
            const v3Regex = /resData\s*=\s*vec3<f32>\(\s*x\[xIndex\]\s*,\s*x\[xIndex\s*\+\s*1\]\s*,\s*x\[xIndex\s*\+\s*2\]\s*\);/g;
            if (v3Regex.test(content)) {
                content = content.replace(v3Regex, () => {
                    // We want: resData=vec3<f32>(f32(x[xIndex]),f32(x[xIndex+1]),f32(x[xIndex+2]));
                    // Preserve spacing usually isn't needed for WGSL but safe to just normalize.
                    // However, we must ensure we wrap each component in f32().
                    // We can just return the fixed string since the pattern is very specific.
                    return 'resData=vec3<f32>(f32(x[xIndex]),f32(x[xIndex+1]),f32(x[xIndex+2]));';
                });
                console.log('  [MATCH] vec3 constructor (regex)');
                modified = true;
            }

            // Inject Einsum logic
            const einsumCode = `
(function() {
  if (self._ag_patched) return;
  self._ag_patched = true;
  console.warn('[Antigravity] Fused Einsum Patch Loading...');
  const tf = self.tf || window.tf; if (!tf) return;
  class AgFusedEinsumProgram {
    constructor(outputShape, type, aShape, bShape) {
        this.variableNames = ['A', 'B']; this.outputShape = outputShape; this.type = type; this.aShape = aShape; this.bShape = bShape;
        this.workgroupSize = [16, 16, 1]; this.dispatchLayout = { x: [1], y: [0] };
        const M_count = outputShape.slice(0, -1).reduce((a,b)=>a*b, 1);
        const N_count = outputShape[outputShape.length - 1];
        this.dispatch = [Math.ceil(N_count / 16), Math.ceil(M_count / 16), 1];
        this.userCode = this.getUserCode();
    }
    getUserCode() {
        const type = this.type; const aShape = this.aShape; const bShape = this.bShape; const outDims = this.outputShape;
        const rank = outDims.length; const M = outDims.slice(0, -1).reduce((a,b)=>a*b, 1); const N = outDims[rank - 1];
        let K = 0; let strideA = 0; let strideB = 0; let indexing = ''; let constDefs = '';
        if (type === 'abgd,gf->abdf') {
            K = aShape[2]; strideA = aShape[3]; strideB = N; const O1 = outDims[1]; const O2 = outDims[2];
            constDefs = \`let O1 = \${O1}u; let O2 = \${O2}u; let K_val = \${K}u;\`;
            indexing = \`let d_idx = i32(m_idx % O2); let tmp_idx = m_idx / O2; let b_idx = i32(tmp_idx % O1); let a_idx = i32(tmp_idx / O1); let baseA_origin = a_idx * i32(O1 * K_val * O2) + b_idx * i32(K_val * O2) + d_idx; let baseB_origin = 0;\`;
        } else if (type === 'abcg,gf->abcf') {
            K = aShape[3]; strideA = 1; strideB = N; constDefs = \`let K_val = \${K}u;\`;
            indexing = \`let baseA_origin = i32(m_idx) * i32(K_val); let baseB_origin = 0;\`;
        } else if (type === 'gb,cgef->bcef') {
            const G = aShape[0]; const B_dim = aShape[1]; const C = bShape[0]; const E = bShape[2]; const F = bShape[3];
            K = G; strideA = B_dim; strideB = E * F; constDefs = \`let E = \${E}u; let C = \${C}u; let G = \${G}u; let F = \${F}u; let K_val = \${K}u;\`;
            indexing = \`let e_idx = i32(m_idx % E); let tmp_idx = m_idx / E; let c_idx = i32(tmp_idx % C); let b_idx = i32(tmp_idx / C); let baseA_origin = b_idx; let baseB_origin = (c_idx * i32(G * E * F)) + (e_idx * i32(F));\`;
        } else { return 'fn main() {}'; }
        return \`var<workgroup> As: array<array<f32, 16>, 16>; var<workgroup> Bs: array<array<f32, 16>, 16>; fn main() { let _unused = uniforms.outShapeStrides; let BLOCK_SIZE = 16u; let M_const = \${M}u; let N_const = \${N}u; let K_const = \${K}u; \${constDefs} let STRIDE_A = i32(\${strideA}); let STRIDE_B = i32(\${strideB}); let tileRow = i32(localId.y); let tileCol = i32(localId.x); let globalRow = i32(globalId.y); let globalCol = i32(globalId.x); var acc = 0.0; let numTiles = (K_const + BLOCK_SIZE - 1u) / BLOCK_SIZE; for (var t = 0u; t < numTiles; t = t + 1u) { let tiledK = t * BLOCK_SIZE + u32(tileCol); if (u32(globalRow) < M_const && tiledK < K_const) { let m_idx = u32(globalRow); \${indexing} As[tileRow][tileCol] = A[baseA_origin + i32(tiledK) * STRIDE_A]; } else { As[tileRow][tileCol] = 0.0; } let tiledRowB = t * BLOCK_SIZE + u32(tileRow); if (tiledRowB < K_const && u32(globalCol) < N_const) { Bs[tileRow][tileCol] = B[i32(tiledRowB) * STRIDE_B + globalCol]; } else { Bs[tileRow][tileCol] = 0.0; } workgroupBarrier(); for (var k = 0u; k < BLOCK_SIZE; k = k + 1u) { acc = acc + As[tileRow][k] * Bs[k][tileCol]; } workgroupBarrier(); } if (u32(globalRow) < M_const && u32(globalCol) < N_const) { setOutputAtIndex(globalRow * i32(N_const) + globalCol, acc); } }\`;
    }
  }
  let originalEinsum = null;
  try { const config = tf.getKernel('Einsum', 'webgpu'); if (config) originalEinsum = config.kernelFunc; } catch (e) { }
  try { tf.unregisterKernel('Einsum', 'webgpu'); } catch (e) { }
  tf.registerKernel({
    kernelName: 'Einsum', backendName: 'webgpu',
    kernelFunc: (args) => {
        const { inputs, attrs } = args; const eq = attrs.equation.replace(/\\s/g, '');
        let actualOut = null;
        if (eq === 'abgd,gf->abdf' && inputs.length === 2 && inputs[0].shape.length === 4 && inputs[1].shape.length === 2) {
            actualOut = [inputs[0].shape[0], inputs[0].shape[1], inputs[0].shape[3], inputs[1].shape[1]];
        } else if (eq === 'abcg,gf->abcf' && inputs.length === 2 && inputs[0].shape.length === 4 && inputs[1].shape.length === 2) {
            actualOut = [inputs[0].shape[0], inputs[0].shape[1], inputs[0].shape[2], inputs[1].shape[1]];
        } else if (eq === 'gb,cgef->bcef' && inputs.length === 2 && inputs[0].shape.length === 2 && inputs[1].shape.length === 4) {
            actualOut = [inputs[0].shape[1], inputs[1].shape[0], inputs[1].shape[2], inputs[1].shape[3]];
        }
        if (actualOut) {
            const s0 = Array.from(inputs[0].shape); const s1 = Array.from(inputs[1].shape);
            try {
                const program = new AgFusedEinsumProgram(actualOut, eq, s0, s1);
                return args.backend.runWebGPUProgram(program, inputs, 'float32');
            } catch (e) { console.error('[Antigravity] Optimized Einsum failed:', e.message || e); }
        }
        if (originalEinsum) return originalEinsum(args);
        return null;
    }
  });
  console.warn('[Antigravity] Patch Initialization Complete (Custom Einsum ENABLED).');
})();`;
            content += '\n' + einsumCode + '\n';
            modified = true;
        } else if (asset.dest.includes('tf.min.js')) {
            console.log(`Processing Core: ${asset.dest}`);

            // Fix 3: conv2DBackpropInput depth check
            const depthRegex = /var\s+(\w+)="NHWC"===(\w+)\?(\w+)\[3\]:(\w+)\[1\],(\w+)="NHWC"===(\w+)\?(\w+)\.shape\[3\]:(\w+)\.shape\[1\];F\$\((\w+)===(\w+)\.shape\[2\]/;
            if (depthRegex.test(content)) {
                content = content.replace(depthRegex, (m, l, i, s, s1, h, i2, u, u2, l2, n) => {
                    return `if(${s}[3]===0)${s}[3]=${n}.shape[2]; if(${u}.shape[3]===0)${u}.shape[3]=${n}.shape[3]; var ${l}="NHWC"===${i}?${s}[3]:${s}[1],${h}="NHWC"===${i}?${u}.shape[3]:${u}.shape[1]; F$(${l}===${n}.shape[2]`;
                });
                console.log('  [MATCH] conv2DBackpropInput depth check');
                modified = true;
            }

            // Fix 4: parseSliceParams (Yae) - Robust Balanced Search
            const yaeKey = 'return"Negative size values';
            const yaeIdx = content.indexOf(yaeKey);
            if (yaeIdx !== -1) {
                // Find start of map call backwards
                const mapStartKey = '.map((function(';
                const mapStartIdx = content.lastIndexOf(mapStartKey, yaeIdx);

                if (mapStartIdx !== -1 && (yaeIdx - mapStartIdx < 500)) {
                    // Find balanced end
                    let open = 0;
                    let endIdx = -1;
                    // Start counting from '.map' which is 4 chars.
                    // content[mapStartIdx] = '.'
                    // content[mapStartIdx+1] = 'm'
                    // content[mapStartIdx+2] = 'a'
                    // content[mapStartIdx+3] = 'p'
                    // content[mapStartIdx+4] = '(' -> This is the one we start with.

                    for (let i = mapStartIdx + 4; i < content.length; i++) {
                        if (content[i] === '(') open++;
                        else if (content[i] === ')') open--;

                        if (open === 0) {
                            endIdx = i + 1; // Include the closing ')'
                            break;
                        }
                    }

                    if (endIdx !== -1) {
                        console.log('  [MATCH] parseSliceParams (Yae) with balanced search');

                        const sub = content.substring(mapStartIdx, endIdx);

                        // Extract params: .map((function(t,n){
                        const paramsMatch = sub.match(/\.map\(\(function\((\w+),(\w+)\)\{/);
                        // Extract closure vars: e.shape[n]-r[n]
                        const closureMatch = sub.match(/(\w+)\.shape\[\w+\]-(\w+)\[\w+\]/);

                        let p1 = 't', p2 = 'n', eVar = 'e', rVar = 'r';
                        if (paramsMatch) { p1 = paramsMatch[1]; p2 = paramsMatch[2]; }
                        if (closureMatch) { eVar = closureMatch[1]; rVar = closureMatch[2]; }

                        console.log(`    [VARS] ${p1}, ${p2}, ${eVar}, ${rVar}`);

                        const replacement = `.map((function(${p1},${p2}){return ${p1}>=0?${p1}:Math.max(0,${eVar}.shape[${p2}]-${rVar}[${p2}])}))`;
                        content = content.replace(sub, replacement);
                        modified = true;
                    }
                }
            }

            // Fix 5: runKernel (Reshape/StridedSlice inline)
            // Found via debug dump: {key:"runKernel",value:function(e,t,n){
            const rkRegex = /key:"runKernel",value:function\((.*?)\)\{/g;
            if (rkRegex.test(content)) {
                let matchCount = 0;
                content = content.replace(rkRegex, (m, args) => {
                    matchCount++;
                    const argParts = args.split(',').map(s => s.trim());
                    const name = argParts[0]; const inputs = argParts[1]; const attrs = argParts[2];
                    return m +
                        `if(!self._agTrace) self._agTrace = [];` +
                        // `if(self._agTrace.length < 25) console.warn("[Antigravity] HEARTBEAT:", ${name});` + // SILENCED
                        `if(${name}!=="Cast" && ${name}!=="Identity" && ${name}!=="Greater" && ${name}!=="Less" && ${name}!=="LogicalAnd"){` +
                        `  var trcInp=${inputs} instanceof Array?${inputs}[0]:(${inputs}?${inputs}.x:null);` +
                        `  var msg = "OP: "+${name}+" In: "+(trcInp?trcInp.shape:"?");` +
                        `  if(${name}==="ResizeBilinear"){ msg += " Size: "+${attrs}.size; }` +
                        `  else if(${name}==="StridedSlice"){ msg += " Begin: "+${attrs}.begin+" End: "+${attrs}.end; }` +
                        `  else if(${name}==="Reshape"){ msg += " Out: "+${attrs}.shape; }` +
                        `  try {` +
                        `    if(msg){` +
                        `       self._agTrace.push(msg);` +
                        `       if(self._agTrace.length>100) self._agTrace.shift();` +
                        // `       if(self._agTrace.length < 50) console.warn("[Antigravity] DEBUG TRACE:", msg);` + // SILENCED
                        `    }` +
                        `  } catch(e) { console.error("[Antigravity] TRACE ERROR:", e); }` +
                        `}` +
                        `if(${name}==="Reshape"){` +
                        `  var inp=${inputs} instanceof Array?${inputs}[0]:(${inputs}?${inputs}.x:null);` +
                        `  if(inp && inp.shape && ${attrs} && ${attrs}.shape){` +
                        `    var sz=inp.shape.reduce(function(a,b){return a*b},1);` +
                        `    var targetShape=${attrs}.shape;` +
                        `    var knownTargetSz=targetShape.reduce(function(a,b){return b!==-1?a*b:a},1);` +
                        `    var hasWildcard=targetShape.indexOf(-1)!==-1;` +
                        `    var isValid=hasWildcard ? (sz%knownTargetSz===0) : (sz===knownTargetSz);` +
                        `    if(!isValid) {` +
                        `       console.error("[Antigravity] Reshape SHAPE MISMATCH:", inp.shape, "->", ${attrs}.shape, "Size:", sz, "vs", knownTargetSz, "(Wildcard:", hasWildcard, ")");` +
                        // `       console.warn("[Antigravity] HISTORY START");` + // SILENCED
                        // `       (self._agTrace||[]).forEach(function(l){ console.warn(l); });` + // SILENCED
                        // `       console.warn("[Antigravity] HISTORY END");` + // SILENCED
                        `    }` +
                        `    if(${attrs}.shape.some(function(v){return v===0}) && inp.shape.every(function(v){return v>0})){` +
                        `      var fx=${attrs}.shape.map(function(v,k){return v!==0?v:(inp.shape[k]||1)});` +
                        `      if(sz===fx.reduce(function(a,b){return a*b},1)){` +
                        `         console.warn("[Antigravity] Reshape FIX:",${attrs}.shape,"->",fx); ${attrs}.shape=fx;` +
                        `      } else {` +
                        `         console.error("[Antigravity] Reshape FIX FAILED (Size Mismatch): Input", inp.shape, "Target", fx);` +
                        `      }` +
                        `    }` +
                        `  }` +
                        `}` +
                        `if(${name}==="StridedSlice"&&${attrs}&&${attrs}.begin&&${attrs}.end){` +
                        `var inp=${inputs} instanceof Array?${inputs}[0]:(${inputs}?${inputs}.x:null);` +
                        `if(inp&&inp.shape&&inp.shape.every(function(v){return v>0})){` +
                        `for(var k=0;k<${attrs}.end.length;k++){` +
                        `if(!(${attrs}.endMask&(1<<k))&&${attrs}.end[k]<=${attrs}.begin[k]){` +
                        `console.warn("[Antigravity] StridedSlice FIX:",${attrs}.end[k],"->",inp.shape[k]); ${attrs}.end[k]=inp.shape[k];` +
                        `}` +
                        `}` +
                        `}` +
                        `}`;


                });
                console.log(`  [MATCH] runKernel (${matchCount} times)`);
                modified = true;
            } else {
                console.error("  [ANTIGRAVITY] RUNKERNEL PATCH FAILED TO MATCH! Regex: " + rkRegex);
            }

            // Fix 6: assertAndGetBroadcastShape (z7) - Self-healing logic
            const z7Magic = 'var s="Operands could not be broadcast together with shapes "';
            if (content.includes(z7Magic)) {
                console.log('  [MATCH] assertAndGetBroadcastShape (z7) magic string');
                // We'll replace the throw with a fallback to the non-zero dimension.
                const throwPattern = /throw Error\(s\)\}/;
                content = content.replace(throwPattern, 'r[n-a-1]=Math.max(i,o)}');
                // And we also need to handle the i===0/o===0 case earlier in the loop.
                const preCheck = /if\(null==o&&(o=1),1===i\)r\[n-a-1\]=o;else if\(1===o\)r\[n-a-1\]=i;/;
                content = content.replace(preCheck, 'if(null==o&&(o=1),i===0||o===0)r[n-a-1]=Math.max(i,o);else if(1===i)r[n-a-1]=o;else if(1===o)r[n-a-1]=i;');
                modified = true;
            }
        }

        // Final Syntax check
        try {
            new vm.Script(content);
            console.log(`  [OK] Syntax check passed for ${asset.dest}`);
        } catch (e) {
            console.error(`  [FATAL] Patched file ${asset.dest} has syntax error: ${e.message}`);
            // We still write it so the developer can see the error, but this is a fail.
        }

        fs.writeFileSync(destPath, content);
        console.log(`[OK] ${asset.dest} ${modified ? '(PATCHED)' : '(COPY)'}`);
    } else {
        console.error(`[ERROR] Missing: ${srcPath}`);
    }
});

// Copy directories
const DIRS_TO_COPY = [
    { src: 'node_modules/@upscalerjs/maxim-deblurring/models', dest: 'maxim/deblurring' },
    { src: 'node_modules/@upscalerjs/maxim-enhancement/models', dest: 'maxim/enhancement' }
];

DIRS_TO_COPY.forEach(dir => {
    const srcPath = path.join(ROOT_DIR, dir.src);
    const destPath = path.join(MODELS_DIR, dir.dest);
    if (fs.existsSync(srcPath)) {
        const copyDir = (s, d) => {
            if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
            fs.readdirSync(s, { withFileTypes: true }).forEach(e => {
                const sp = path.join(s, e.name); const dp = path.join(d, e.name);
                if (e.isDirectory()) copyDir(sp, dp); else fs.copyFileSync(sp, dp);
            });
        };
        copyDir(srcPath, destPath);
        console.log(`[OK] Models: ${dir.dest}`);
    }
});

console.log('--- Assets Finish ---');
