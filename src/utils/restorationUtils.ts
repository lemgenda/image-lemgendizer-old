import {
    processLemGendaryRestoration
} from '../processors';
import { safeCleanupGPUMemory } from './memoryUtils';
import { ImageFile, ProcessingOptions } from '../types';

/**
 * Orchestrates restoration processing
 */
export const orchestrateRestorationProcessing = async (
    images: ImageFile[],
    processingConfig: ProcessingOptions,
    onProgress?: (index: number, total: number) => void
): Promise<ImageFile[]> => {
    const processedImages: ImageFile[] = [];
    const modelName = processingConfig.restoration?.modelName || 'mprnet-deraining-restoration-fp16';

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (onProgress) onProgress(i, images.length);

        try {
            const restoredFile = await processLemGendaryRestoration(image.file, modelName);

            processedImages.push({
                ...image,
                file: restoredFile,
                name: restoredFile.name,
                type: restoredFile.type || 'image/png', // Restoration returns PNG
                processed: true,
                format: 'png'
            });
        } catch (error: any) {
            console.error(`Restoration failed for ${image.name}:`, error);
            processedImages.push({
                ...image,
                error: error.message,
                processed: false
            });
        } finally {
            if (i % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100)); // Yield to UI
                safeCleanupGPUMemory();
            }
        }
    }

    safeCleanupGPUMemory();
    return processedImages;
};
