/**
 * @file shaders.ts
 * @description WGSL shader strings for v100.x engine.
 */

export const TILE_EXTRACT_SHADER = `
@group(0) @binding(0)
var inputTex : texture_2d<f32>;

@group(0) @binding(1)
var<storage, write> outputBuffer : array<f32>;

struct Params {
    imageWidth : u32,
    imageHeight : u32,
    tileX : u32,
    tileY : u32,
    tileSize : u32,
};

@group(0) @binding(2)
var<uniform> params : Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    if (gid.x >= params.tileSize || gid.y >= params.tileSize) {
        return;
    }

    let x = params.tileX + gid.x;
    let y = params.tileY + gid.y;

    // Reflection padding
    var sampleX = i32(x);
    var sampleY = i32(y);

    if (x >= params.imageWidth) {
        sampleX = i32(params.imageWidth) - 1 - i32(x - params.imageWidth);
    }
    if (y >= params.imageHeight) {
        sampleY = i32(params.imageHeight) - 1 - i32(y - params.imageHeight);
    }

    sampleX = clamp(sampleX, 0, i32(params.imageWidth) - 1);
    sampleY = clamp(sampleY, 0, i32(params.imageHeight) - 1);

    let pixel = textureLoad(inputTex, vec2<i32>(sampleX, sampleY), 0);

    let numPixels = params.tileSize * params.tileSize;
    let pixelIdx = gid.y * params.tileSize + gid.x;

    outputBuffer[pixelIdx] = pixel.r;
    outputBuffer[pixelIdx + numPixels] = pixel.g;
    outputBuffer[pixelIdx + 2u * numPixels] = pixel.b;
}
`;

export const STITCH_SHADER = `
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

    let overlap: f32 = 32.0;

    let dx = min(gid.x, params.tileSize - 1u - gid.x);
    let dy = min(gid.y, params.tileSize - 1u - gid.y);

    let wx = min(1.0, f32(dx) / overlap);
    let wy = min(1.0, f32(dy) / overlap);
    let weight = wx * wy;

    colorAccumulator[globalIdx] += tileBuffer[pixelIdx] * weight;
    colorAccumulator[globalIdx + 1u] += tileBuffer[pixelIdx + numPixels] * weight;
    colorAccumulator[globalIdx + 2u] += tileBuffer[pixelIdx + 2u * numPixels] * weight;

    weightAccumulator[globalY * params.imageWidth + globalX] += weight;
}
`;
