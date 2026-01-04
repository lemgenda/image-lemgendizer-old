// Sharpening Worker
// Handles expensive pixel manipulation off the main thread

interface SharpenMessage {
    imageData: ImageData;
    width: number;
    height: number;
    threshold?: number;
}

interface SharpenResponse {
    imageData?: ImageData;
    processed: boolean;
    error?: string;
}

self.onmessage = function (e: MessageEvent<SharpenMessage>) {
    const { imageData, width, height, threshold } = e.data;

    try {
        const data = imageData.data;
        const originalData = new Uint8ClampedArray(data);
        const maxPixels = threshold || 25000000; // Default safety threshold

        if (width * height > maxPixels) {
            const response: SharpenResponse = {
                imageData,
                processed: false,
                error: 'Image too large for sharpening'
            };
            self.postMessage(response);
            return;
        }

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                for (let channel = 0; channel < 3; channel++) {
                    const channelIdx = idx + channel;

                    const top = originalData[channelIdx - width * 4];
                    const bottom = originalData[channelIdx + width * 4];
                    const left = originalData[channelIdx - 4];
                    const right = originalData[channelIdx + 4];
                    const center = originalData[channelIdx];

                    // Kernel:
                    //  0  -1   0
                    // -1   5  -1
                    //  0  -1   0
                    // Scaled strength often used: center*1.5 - neighbors*0.125
                    // But standard kernel convolution is simpler.
                    // The existing logic was: center * 1.5 - (sum_neighbors) * 0.125
                    // 1.5 - 4*0.125 = 1.5 - 0.5 = 1.0 (preserves brightness roughly)

                    const sharpened = Math.min(255, Math.max(0,
                        center * 1.5 - (top + bottom + left + right) * 0.125
                    ));

                    data[channelIdx] = sharpened;
                }
                // Alpha channel (data[idx + 3]) remains unchanged
            }
        }

        const response: SharpenResponse = { imageData, processed: true };
        self.postMessage(response);
    } catch (error) {
        const response: SharpenResponse = {
            error: error instanceof Error ? error.message : 'Unknown error',
            processed: false
        };
        self.postMessage(response);
    }
};

export {};
