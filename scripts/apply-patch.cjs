const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.resolve(__dirname, '../node_modules/@tensorflow/tfjs-backend-webgpu/dist/kernels/Einsum.js');

console.log('[Antigravity] Applying Einsum Optimization Patch...');

if (!fs.existsSync(TARGET_FILE)) {
    console.error(`[Error] Target file not found: ${TARGET_FILE}`);
    process.exit(1);
}

let content = fs.readFileSync(TARGET_FILE, 'utf8');

if (content.includes('// [Antigravity] Fused Einsum Shader')) {
    console.log('[Antigravity] Patch already applied.');
    process.exit(0);
}

// Rename original export
content = content.replace('export function einsum(args)', 'function originalEinsum(args)');

// Add the optimized implementation
const patchCode = `
// [Antigravity] Fused Einsum Shader
class _ag_FusedEinsumProgram {
    constructor(outputShape, type, aShape, bShape) {
        this.variableNames = ['A', 'B'];
        this.outputShape = Array.from(outputShape);
        this.size = true;
        this.workgroupSize = [16, 16, 1];
        this.dispatchLayout = { x: [], y: [], z: [] };
        this.userCode = this.getShaderSource(type, aShape, bShape);
    }

    getShaderSource(type, aShape, bShape) {
        const outDims = this.outputShape;
        const D = (src, idx) => src[idx] !== undefined ? src[idx] : 1;
        const O0 = D(outDims, 0); const O1 = D(outDims, 1);
        const O2 = D(outDims, 2); const O3 = D(outDims, 3);

        if (type === 'abgd,gf->abdf') {
            const G = aShape[2];
            const M = O0 * O1 * O2;
            const N = O3;
            const K = G;
            this.dispatch = [Math.ceil(N / 16), Math.ceil(M / 16), 1];

            return \`
                const BLOCK_SIZE = 16u;
                var<workgroup> As: array<array<f32, 16>, 16>;
                var<workgroup> Bs: array<array<f32, 16>, 16>;
                fn main(index: i32) {
                    let tileRow = localId.y; let tileCol = localId.x;
                    let globalRow = globalId.y; let globalCol = globalId.x;
                    let numTiles = (\${K}u + BLOCK_SIZE - 1u) / BLOCK_SIZE;
                    var sum = 0.0;
                    let m_idx = globalRow;
                    let d = m_idx % \${O2};
                    let tmp = m_idx / \${O2};
                    let b = tmp % \${O1};
                    let a = tmp / \${O1};
                    let baseA_origin = a * \${O1 * G * O2} + b * \${G * O2} + d;
                    for (var t = 0u; t < numTiles; t = t + 1u) {
                        let tiledK = t * BLOCK_SIZE + tileCol;
                        if (globalRow < \${M}u && tiledK < \${K}u) {
                             As[tileRow][tileCol] = f32(A[i32(baseA_origin) + i32(tiledK) * \${O2}]);
                        } else { As[tileRow][tileCol] = 0.0; }
                        let tiledRowB = t * BLOCK_SIZE + tileRow;
                        if (tiledRowB < \${K}u && globalCol < \${N}u) {
                             Bs[tileRow][tileCol] = f32(B[i32(tiledRowB) * \${N} + i32(globalCol)]);
                        } else { Bs[tileRow][tileCol] = 0.0; }
                        workgroupBarrier();
                        for (var k = 0u; k < BLOCK_SIZE; k = k + 1u) { sum = sum + As[tileRow][k] * Bs[k][tileCol]; }
                        workgroupBarrier();
                    }
                    if (globalRow < \${M}u && globalCol < \${N}u) {
                        setOutputAtIndex(i32(globalRow * \${N} + globalCol), sum);
                    }
                }
            \`;
        }
        return \`fn main(index: i32) { }\`;
    }
}

export function einsum(args) {
    const { inputs, backend, attrs } = args;
    const { equation } = attrs;
    const eq = equation.replace(new RegExp('\\\\s', 'g'), '');

    if (!globalThis._antigravity) globalThis._antigravity = {};
    if (!globalThis._antigravity.einsum) globalThis._antigravity.einsum = { count: 0, hits: 0, cpuTime: 0 };

    const t0 = performance.now();
    if (inputs.some(t => t.dtype !== 'float32')) return originalEinsum(args);

    if (eq === 'abgd,gf->abdf' && inputs.length === 2 && inputs[0].shape.length === 4 && inputs[1].shape.length === 2) {
         const outShape = [inputs[0].shape[0], inputs[0].shape[1], inputs[0].shape[3], inputs[1].shape[1]];

         const program = new _ag_FusedEinsumProgram(outShape, eq, inputs[0].shape, inputs[1].shape);
         const res = backend.runWebGPUProgram(program, inputs, 'float32');
         if (globalThis._antigravity.einsum) {
             globalThis._antigravity.einsum.count++;
             globalThis._antigravity.einsum.hits++;
             globalThis._antigravity.einsum.cpuTime += (performance.now() - t0);
         }
         return res;
    }
    return originalEinsum(args);
}
`;

content += patchCode;
fs.writeFileSync(TARGET_FILE, content, 'utf8');
console.log('[Antigravity] Patch successfully applied!');
