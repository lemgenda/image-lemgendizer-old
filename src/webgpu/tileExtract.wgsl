/**
 * @file tileExtract.wgsl
 * @description Extracts a normalized Float32 tile from an RGBA texture (v100.x).
 */

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

    // Reflection padding for out-of-bounds pixels
    var sampleX = i32(x);
    var sampleY = i32(y);

    if (x >= params.imageWidth) {
        sampleX = i32(params.imageWidth) - 1 - i32(x - params.imageWidth);
    }
    if (y >= params.imageHeight) {
        sampleY = i32(params.imageHeight) - 1 - i32(y - params.imageHeight);
    }

    // Clamp to ensure safety even with reflection logic
    sampleX = clamp(sampleX, 0, i32(params.imageWidth) - 1);
    sampleY = clamp(sampleY, 0, i32(params.imageHeight) - 1);

    let pixel = textureLoad(inputTex, vec2<i32>(sampleX, sampleY), 0);

    // Planar output (R...G...B...) for ONNX NCHW format
    let numPixels = params.tileSize * params.tileSize;
    let pixelIdx = gid.y * params.tileSize + gid.x;

    outputBuffer[pixelIdx] = pixel.r;
    outputBuffer[pixelIdx + numPixels] = pixel.g;
    outputBuffer[pixelIdx + 2u * numPixels] = pixel.b;
}
