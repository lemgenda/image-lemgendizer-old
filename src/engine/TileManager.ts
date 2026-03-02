/**
 * @file TileManager.ts
 * @description Manages GPU-side tile extraction and weighted stitching (v100.x).
 */

import { GPUBufferPool } from './MemoryPool';
import { TileParams } from '../types/engine';

export class TileManager {
    private device: GPUDevice;
    private extractPipeline!: GPUComputePipeline;
    private stitchPipeline!: GPUComputePipeline;

    constructor(device: GPUDevice) {
        this.device = device;
    }

    async init(extractShader: string, stitchShader: string) {
        this.extractPipeline = await this.createPipeline(extractShader);
        this.stitchPipeline = await this.createPipeline(stitchShader);
    }

    private async createPipeline(code: string): Promise<GPUComputePipeline> {
        const module = this.device.createShaderModule({ code });
        return await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: { module, entryPoint: 'main' }
        });
    }

    /**
     * Extracts a tile using the GPU.
     */
    async extractTile(
        inputTex: GPUTexture,
        params: TileParams,
        outputBuffer: GPUBuffer
    ): Promise<void> {
        const uniformData = new Uint32Array([
            params.imageWidth,
            params.imageHeight,
            params.tileX,
            params.tileY,
            params.tileSize
        ]);

        const uniformBuffer = GPUBufferPool.acquire(
            this.device,
            uniformData.byteLength,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        const bindGroup = this.device.createBindGroup({
            layout: this.extractPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: inputTex.createView() },
                { binding: 1, resource: { buffer: outputBuffer } },
                { binding: 2, resource: { buffer: uniformBuffer } }
            ]
        });

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.extractPipeline);
        pass.setBindGroup(0, bindGroup);
        const groups = Math.ceil(params.tileSize / 16);
        pass.dispatchWorkgroups(groups, groups);
        pass.end();

        this.device.queue.submit([encoder.finish()]);

        // Finalize resource usage
        GPUBufferPool.release(uniformBuffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    }

    /**
     * Stitches a tile back into the global accumulator using weighted blending.
     */
    async stitchTile(
        tileBuffer: GPUBuffer,
        colorAccum: GPUBuffer,
        weightAccum: GPUBuffer,
        params: TileParams
    ): Promise<void> {
        const uniformData = new Uint32Array([
            params.imageWidth,
            params.imageHeight,
            params.tileSize,
            params.offsetX || 0,
            params.offsetY || 0
        ]);

        const uniformBuffer = GPUBufferPool.acquire(
            this.device,
            uniformData.byteLength,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        const bindGroup = this.device.createBindGroup({
            layout: this.stitchPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: tileBuffer } },
                { binding: 1, resource: { buffer: colorAccum } },
                { binding: 2, resource: { buffer: weightAccum } },
                { binding: 3, resource: { buffer: uniformBuffer } }
            ]
        });

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.stitchPipeline);
        pass.setBindGroup(0, bindGroup);
        const groups = Math.ceil(params.tileSize / 16);
        pass.dispatchWorkgroups(groups, groups);
        pass.end();

        this.device.queue.submit([encoder.finish()]);

        GPUBufferPool.release(uniformBuffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    }

    /**
     * WGSL Bypass: Pure CPU Tile Extraction
     */
    extractTileCPU(
        source: ImageData,
        params: TileParams,
        outputTensorData: Float32Array // Expected size: 3 * tileSize * tileSize
    ) {
        const { imageWidth, imageHeight, tileX, tileY, tileSize } = params;
        const srcData = source.data;
        const channelStride = tileSize * tileSize;

        for (let y = 0; y < tileSize; y++) {
            const gy = tileY + y;
            for (let x = 0; x < tileSize; x++) {
                const gx = tileX + x;
                const outIdx = y * tileSize + x;

                if (gx >= 0 && gx < imageWidth && gy >= 0 && gy < imageHeight) {
                    const srcIdx = (gy * imageWidth + gx) * 4;
                    outputTensorData[outIdx] = srcData[srcIdx] / 255.0; // R
                    outputTensorData[channelStride + outIdx] = srcData[srcIdx + 1] / 255.0; // G
                    outputTensorData[channelStride * 2 + outIdx] = srcData[srcIdx + 2] / 255.0; // B
                } else {
                    outputTensorData[outIdx] = 0;
                    outputTensorData[channelStride + outIdx] = 0;
                    outputTensorData[channelStride * 2 + outIdx] = 0;
                }
            }
        }
    }

    /**
     * WGSL Bypass: Pure CPU Tile Stitching
     */
    stitchTileCPU(
        tileTensorData: Float32Array, // Expected size: 3 * tileSize * tileSize
        colorAccum: Float32Array,     // Expected size: 3 * imageWidth * imageHeight
        weightAccum: Float32Array,    // Expected size: imageWidth * imageHeight
        params: TileParams
    ) {
        const { imageWidth, imageHeight, tileSize, offsetX = 0, offsetY = 0 } = params;
        const channelStride = tileSize * tileSize;
        const accumChannelStride = typeof imageWidth === 'number' && typeof imageHeight === 'number' ? imageWidth * imageHeight : 0;

        for (let y = 0; y < tileSize; y++) {
            const gy = offsetY + y;
            for (let x = 0; x < tileSize; x++) {
                const gx = offsetX + x;

                if (gx >= 0 && gx < imageWidth && gy >= 0 && gy < imageHeight) {
                    const outIdx = y * tileSize + x;
                    const accumIdx = gy * imageWidth + gx;

                    // Compute triangular window weight
                    const wx = 1.0 - Math.abs((x - tileSize / 2.0 + 0.5) / (tileSize / 2.0));
                    const wy = 1.0 - Math.abs((y - tileSize / 2.0 + 0.5) / (tileSize / 2.0));
                    const w = wx * wy;

                    colorAccum[accumIdx] += tileTensorData[outIdx] * w;
                    colorAccum[accumChannelStride + accumIdx] += tileTensorData[channelStride + outIdx] * w;
                    colorAccum[accumChannelStride * 2 + accumIdx] += tileTensorData[channelStride * 2 + outIdx] * w;
                    weightAccum[accumIdx] += w;
                }
            }
        }
    }
}
