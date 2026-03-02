/**
 * @file stitch.wgsl
 * @description Weighted blending (stitching) of restoration tiles to eliminate seams (v100.x).
 */

@group(0) @binding(0)
var<storage, read> tileBuffer : array<f32>;

@group(0) @binding(1)
var<storage, read_write> colorAccumulator : array<f32>;

@group(0) @binding(2)
var<storage, read_write> weightAccumulator : array<f32>;

struct Params {
    imageWidth : u32,
    imageHeight : u32,
    tileSize : u32,
    offsetX : u32,
    offsetY : u32,
};

@group(0) @binding(3)
var<uniform> params : Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    if (gid.x >= params.tileSize || gid.y >= params.tileSize) {
        return;
    }

    let globalX = params.offsetX + gid.x;
    let globalY = params.offsetY + gid.y;

    if (globalX >= params.imageWidth || globalY >= params.imageHeight) {
        return;
    }

    let numPixels = params.tileSize * params.tileSize;
    let pixelIdx = gid.y * params.tileSize + gid.x;
    let globalIdx = (globalY * params.imageWidth + globalX) * 3u;

    // Compute Weight (Linear Overlap Mask)
    let overlap: f32 = 32.0;

    // Calculate distance from edges for the current pixel within the tile
    let dx = min(gid.x, params.tileSize - 1u - gid.x);
    let dy = min(gid.y, params.tileSize - 1u - gid.y);

    // Scale weight linearly based on overlap
    let wx = min(1.0, f32(dx) / overlap);
    let wy = min(1.0, f32(dy) / overlap);
    let weight = wx * wy;

    // Accumulate Color (Planar to Interleaved RGB)
    colorAccumulator[globalIdx] += tileBuffer[pixelIdx] * weight;
    colorAccumulator[globalIdx + 1u] += tileBuffer[pixelIdx + numPixels] * weight;
    colorAccumulator[globalIdx + 2u] += tileBuffer[pixelIdx + 2u * numPixels] * weight;

    // Accumulate Weight
    weightAccumulator[globalY * params.imageWidth + globalX] += weight;
}
