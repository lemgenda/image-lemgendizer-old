/**
 * @file MemoryPool.ts
 * @description Resource recycling for high-frequency tiled processing (v100.x).
 */

export class MemoryPool {
    private static float32Pool: Map<number, Float32Array[]> = new Map();

    /**
     * Acquires a Float32Array of the specified size.
     */
    static acquire(size: number): Float32Array {
        const pool = this.float32Pool.get(size);
        if (pool && pool.length > 0) {
            return pool.pop()!;
        }
        return new Float32Array(size);
    }

    /**
     * Returns a Float32Array to the pool for reuse.
     */
    static release(buffer: Float32Array): void {
        const size = buffer.length;
        if (!this.float32Pool.has(size)) {
            this.float32Pool.set(size, []);
        }
        this.float32Pool.get(size)!.push(buffer);
    }
}

export class GPUBufferPool {
    private static buffers: Map<number, Map<number, GPUBuffer[]>> = new Map();

    /**
     * Acquires a GPUBuffer of specified size and usage.
     */
    static acquire(device: GPUDevice, size: number, usage: number, label?: string): GPUBuffer {
        if (!this.buffers.has(usage)) {
            this.buffers.set(usage, new Map());
        }
        const usageMap = this.buffers.get(usage)!;

        if (!usageMap.has(size)) {
            usageMap.set(size, []);
        }
        const pool = usageMap.get(size)!;

        if (pool.length > 0) {
            return pool.pop()!;
        }

        return device.createBuffer({
            size,
            usage,
            label: label || `PooledBuffer_${usage}_${size}`
        });
    }

    /**
     * Returns a GPUBuffer to the pool.
     */
    static release(buffer: GPUBuffer, usage: number): void {
        const size = buffer.size;
        const usageMap = this.buffers.get(usage);
        if (usageMap && usageMap.has(size)) {
            usageMap.get(size)!.push(buffer);
        }
    }
}
