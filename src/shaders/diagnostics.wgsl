struct Diagnostics {
    pixelCount: atomic<u32>,
    lumaSum: atomic<u32>,
    darkCount: atomic<u32>,
    brightCount: atomic<u32>,
    hfEnergy: atomic<u32>,
    gradEnergy: atomic<u32>,
    orientBins: array<atomic<u32>, 8>,
    lumaHist: array<atomic<u32>, 256>,
};

struct MedianResults {
    prefixSum: array<u32, 256>,
    medianLuma: f32,
};

@group(0) @binding(0) var inputTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> outputBuf : Diagnostics;
@group(1) @binding(0) var<storage, read_write> medianBuf : MedianResults;

var<workgroup> localHist: array<atomic<u32>, 256>;
var<workgroup> localOrient: array<atomic<u32>, 8>;
var<workgroup> localHF: atomic<u32>;
var<workgroup> localGrad: atomic<u32>;
var<workgroup> localPixels: atomic<u32>;
var<workgroup> localLumaSum: atomic<u32>;
var<workgroup> localDark: atomic<u32>;
var<workgroup> localBright: atomic<u32>;

fn luma(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

@compute @workgroup_size(16, 16)
fn main(
    @builtin(global_invocation_id) gid : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32
) {
    // 1. Initialize workgroup shared memory
    if (local_idx < 256u) {
        atomicStore(&localHist[local_idx], 0u);
    }
    if (local_idx < 8u) {
        atomicStore(&localOrient[local_idx], 0u);
    }
    if (local_idx == 0u) {
        atomicStore(&localHF, 0u);
        atomicStore(&localGrad, 0u);
        atomicStore(&localPixels, 0u);
        atomicStore(&localLumaSum, 0u);
        atomicStore(&localDark, 0u);
        atomicStore(&localBright, 0u);
    }
    workgroupBarrier();

    let dims = textureDimensions(inputTex);
    if (gid.x < dims.x && gid.y < dims.y) {
        let color = textureLoad(inputTex, vec2<i32>(gid.xy), 0).rgb;
        let Y = luma(color);

        atomicAdd(&localPixels, 1u);
        atomicAdd(&localLumaSum, u32(Y * 1024.0));

        if (Y < 0.25) {
            atomicAdd(&localDark, 1u);
        }
        if (Y > 0.95) {
            atomicAdd(&localBright, 1u);
        }

        // 256-bin Luma Histogram
        let hBin = u32(clamp(Y * 255.0, 0.0, 255.0));
        atomicAdd(&localHist[hBin], 1u);

        // Gradient & Orientation
        if (gid.x > 0u && gid.y > 0u && gid.x < dims.x - 1u && gid.y < dims.y - 1u) {
            let c00 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0xffffffffu, 0xffffffffu)), 0).rgb);
            let c10 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0u, 0xffffffffu)), 0).rgb);
            let c20 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(1u, 0xffffffffu)), 0).rgb);
            let c01 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0xffffffffu, 0u)), 0).rgb);
            let c21 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(1u, 0u)), 0).rgb);
            let c02 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0xffffffffu, 1u)), 0).rgb);
            let c12 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0u, 1u)), 0).rgb);
            let c22 = luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(1u, 1u)), 0).rgb);

            let gx = -c00 - 2.0*c01 - c02 + c20 + 2.0*c21 + c22;
            let gy = -c00 - 2.0*c10 - c20 + c02 + 2.0*c12 + c22;

            let gMag = sqrt(gx*gx + gy*gy);
            atomicAdd(&localGrad, u32(gMag * 1024.0));

            let angle = atan2(gy, gx);
            let bin = u32((angle + 3.14159) / 0.785398) % 8u;
            atomicAdd(&localOrient[bin], 1u);
        }

        // Laplacian
        let lp = abs(4.0*Y -
            luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(1u, 0u)), 0).rgb) -
            luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0xffffffffu, 0u)), 0).rgb) -
            luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0u, 1u)), 0).rgb) -
            luma(textureLoad(inputTex, vec2<i32>(gid.xy + vec2<u32>(0u, 0xffffffffu)), 0).rgb)
        );
        atomicAdd(&localHF, u32(lp * 1024.0));
    }

    workgroupBarrier();

    // 2. Accumulate to global buffer
    if (local_idx < 256u) {
        let val = atomicLoad(&localHist[local_idx]);
        if (val > 0u) {
            atomicAdd(&outputBuf.lumaHist[local_idx], val);
        }
    }
    if (local_idx < 8u) {
        let val = atomicLoad(&localOrient[local_idx]);
        if (val > 0u) {
            atomicAdd(&outputBuf.orientBins[local_idx], val);
        }
    }
    if (local_idx == 0u) {
        atomicAdd(&outputBuf.pixelCount, atomicLoad(&localPixels));
        atomicAdd(&outputBuf.lumaSum, atomicLoad(&localLumaSum));
        atomicAdd(&outputBuf.darkCount, atomicLoad(&localDark));
        atomicAdd(&outputBuf.brightCount, atomicLoad(&localBright));
        atomicAdd(&outputBuf.hfEnergy, atomicLoad(&localHF));
        atomicAdd(&outputBuf.gradEnergy, atomicLoad(&localGrad));
    }
}

// v80.0: Parallel Prefix Sum for Median Calculation
var<workgroup> temp_scan: array<u32, 256>;

@compute @workgroup_size(256)
fn prefix_sum(@builtin(local_invocation_id) lid: vec3<u32>) {
    let i = lid.x;
    temp_scan[i] = atomicLoad(&outputBuf.lumaHist[i]);
    workgroupBarrier();

    for (var offset = 1u; offset < 256u; offset *= 2u) {
        var t = 0u;
        if (i >= offset) {
            t = temp_scan[i - offset];
        }
        workgroupBarrier();
        if (i >= offset) {
            temp_scan[i] += t;
        }
        workgroupBarrier();
    }

    medianBuf.prefixSum[i] = temp_scan[i];
}

@compute @workgroup_size(1)
fn find_median() {
    let total = atomicLoad(&outputBuf.pixelCount);
    if (total == 0u) {
        medianBuf.medianLuma = 0.5;
        return;
    }
    let mid = total / 2u;

    for (var i = 0u; i < 256u; i++) {
        if (medianBuf.prefixSum[i] >= mid) {
            medianBuf.medianLuma = f32(i) / 255.0;
            break;
        }
    }
}
