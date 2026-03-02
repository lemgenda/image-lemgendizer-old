/**
 * @file engine.ts
 * @description Type definitions for the v100.x Modular Neural Graph architecture.
 */

export interface UPNResults {
    degradation: {
        rain: number;
        haze: number;
        blur: number;
        noise: number;
        lowlight: number;
    };
    theta: {
        denoise: number;
        deblur: number;
        dehaze: number;
        gamma: number;
        exposure: number;
    } & Record<string, number>;
    confidence: number;
    embedding: Float32Array;
    state: string;
}

export interface PolicyVector {
    mode: string;
    primaryStrength: number;
    derain: number;
    denoise: number;
    deblur: number;
    haze: number;
    lowlight: number;
    sharpen: number;
    thetaDiff: number;
}

export interface TileParams {
    imageWidth: number;
    imageHeight: number;
    tileX: number;
    tileY: number;
    tileSize: number;
    offsetX?: number;
    offsetY?: number;
}
