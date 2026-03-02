import diagnosticsShader from '../shaders/diagnostics.wgsl?raw';

export interface GPUDiagnostics {
    pixelCount: number;
    medianLuma: number;
    pDark: number;
    pBright: number;
    noiseRatio: number;
    anisotropy: number;
    entropy: number;
    orientBins: number[];
    lumaHistogram: number[];
}

export class WebGPUDiagnosticEngine {
    private device: any = null;
    private mainPipeline: any = null;
    private scanPipeline: any = null;
    private medianPipeline: any = null;

    constructor() { }

    async init() {
        if (this.device) return;

        if (!(navigator as any).gpu) {
            throw new Error('WebGPU not supported');
        }

        const adapter = await (navigator as any).gpu.requestAdapter();
        if (!adapter) throw new Error('No appropriate GPU adapter found');

        this.device = await adapter.requestDevice();

        const shaderModule = this.device.createShaderModule({
            code: diagnosticsShader
        });

        const mainLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                this.device.createBindGroupLayout({
                    entries: [
                        { binding: 0, visibility: (globalThis as any).GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
                        { binding: 1, visibility: (globalThis as any).GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
                    ]
                })
            ]
        });

        const medianLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                this.device.createBindGroupLayout({
                    entries: [
                        { binding: 0, visibility: (globalThis as any).GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
                        { binding: 1, visibility: (globalThis as any).GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
                    ]
                }),
                this.device.createBindGroupLayout({
                    entries: [
                        { binding: 0, visibility: (globalThis as any).GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
                    ]
                })
            ]
        });

        this.mainPipeline = this.device.createComputePipeline({
            layout: mainLayout,
            compute: { module: shaderModule, entryPoint: 'main' }
        });

        this.scanPipeline = this.device.createComputePipeline({
            layout: medianLayout,
            compute: { module: shaderModule, entryPoint: 'prefix_sum' }
        });

        this.medianPipeline = this.device.createComputePipeline({
            layout: medianLayout,
            compute: { module: shaderModule, entryPoint: 'find_median' }
        });
    }

    async run(imageBitmap: ImageBitmap | HTMLVideoElement | HTMLCanvasElement): Promise<GPUDiagnostics> {
        await this.init();
        if (!this.device) throw new Error('Engine not initialized');

        const width = imageBitmap.width;
        const height = imageBitmap.height;

        const texture = this.device.createTexture({
            size: [width, height],
            format: 'rgba8unorm',
            usage: (globalThis as any).GPUTextureUsage.TEXTURE_BINDING | (globalThis as any).GPUTextureUsage.COPY_DST | (globalThis as any).GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture }, [width, height]);

        const outputBufferSize = 270 * 4;
        const outputBuffer = this.device.createBuffer({
            size: outputBufferSize,
            usage: (globalThis as any).GPUBufferUsage.STORAGE | (globalThis as any).GPUBufferUsage.COPY_SRC
        });

        const medianBufferSize = 260 * 4;
        const medianBuffer = this.device.createBuffer({
            size: medianBufferSize,
            usage: (globalThis as any).GPUBufferUsage.STORAGE | (globalThis as any).GPUBufferUsage.COPY_SRC
        });

        const statsStaging = this.device.createBuffer({
            size: outputBufferSize,
            usage: (globalThis as any).GPUBufferUsage.MAP_READ | (globalThis as any).GPUBufferUsage.COPY_DST
        });

        const medianStaging = this.device.createBuffer({
            size: medianBufferSize,
            usage: (globalThis as any).GPUBufferUsage.MAP_READ | (globalThis as any).GPUBufferUsage.COPY_DST
        });

        const bg0 = this.device.createBindGroup({
            layout: this.mainPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: { buffer: outputBuffer } }
            ]
        });

        const bg1 = this.device.createBindGroup({
            layout: this.scanPipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: medianBuffer } }]
        });

        const commandEncoder = this.device.createCommandEncoder();

        // 1. Stats Pass
        const pass1 = commandEncoder.beginComputePass();
        pass1.setPipeline(this.mainPipeline);
        pass1.setBindGroup(0, bg0);
        pass1.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
        pass1.end();

        // 2. Scan Pass
        const pass2 = commandEncoder.beginComputePass();
        pass2.setPipeline(this.scanPipeline);
        pass2.setBindGroup(0, bg0);
        pass2.setBindGroup(1, bg1);
        pass2.dispatchWorkgroups(1, 1);
        pass2.end();

        // 3. Median Pass
        const pass3 = commandEncoder.beginComputePass();
        pass3.setPipeline(this.medianPipeline);
        pass3.setBindGroup(0, bg0);
        pass3.setBindGroup(1, bg1);
        pass3.dispatchWorkgroups(1, 1);
        pass3.end();

        commandEncoder.copyBufferToBuffer(outputBuffer, 0, statsStaging, 0, outputBufferSize);
        commandEncoder.copyBufferToBuffer(medianBuffer, 0, medianStaging, 0, medianBufferSize);

        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);

        await Promise.all([
            statsStaging.mapAsync((globalThis as any).GPUMapMode.READ),
            medianStaging.mapAsync((globalThis as any).GPUMapMode.READ)
        ]);

        const statsRes = new Uint32Array(statsStaging.getMappedRange());
        // Median is at the end of medianBuffer after prefixSum (256 * 4 bytes)
        const medianVal = new Float32Array(medianStaging.getMappedRange().slice(256 * 4, 256 * 4 + 4))[0];

        const pixelCount = statsRes[0] || 1;
        const hfEnergy = statsRes[4] / 1024.0;
        const gradEnergy = statsRes[5] / 1024.0;
        const lumaHistogram = Array.from(statsRes.slice(14, 270));

        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            const count = lumaHistogram[i];
            if (count > 0) {
                const p = count / pixelCount;
                entropy -= p * Math.log2(p);
            }
        }

        const diagnostic: GPUDiagnostics = {
            pixelCount,
            medianLuma: medianVal,
            pDark: statsRes[2] / pixelCount,
            pBright: statsRes[3] / pixelCount,
            noiseRatio: hfEnergy / Math.max(gradEnergy, 0.001),
            anisotropy: Math.max(...Array.from(statsRes.slice(6, 14))) / (statsRes.slice(6, 14).reduce((a, b) => a + b, 0) || 1),
            entropy,
            orientBins: Array.from(statsRes.slice(6, 14)),
            lumaHistogram
        };

        statsStaging.unmap();
        medianStaging.unmap();
        texture.destroy();
        outputBuffer.destroy();
        medianBuffer.destroy();
        statsStaging.destroy();
        medianStaging.destroy();

        return diagnostic;
    }
}
