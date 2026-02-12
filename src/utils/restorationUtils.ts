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

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (onProgress) onProgress(i, images.length);

        const selectedModels = processingConfig.restoration?.selectedModels ||
            (processingConfig.restoration?.modelName ? [processingConfig.restoration.modelName] : []);

        try {
            let currentFile = image.file;
            for (const modelId of selectedModels) {
                currentFile = await processLemGendaryRestoration(currentFile, modelId);
            }

            processedImages.push({
                ...image,
                file: currentFile,
                name: currentFile.name,
                type: currentFile.type || 'image/png', // Restoration returns PNG
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
