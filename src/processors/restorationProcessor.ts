import {
    MIME_TYPE_MAP,
    ERROR_MESSAGES
} from '../constants';
import { restoreInWorker } from '../utils/aiWorkerUtils';

/**
 * Processes image restoration using AI
 * @param {File} imageFile - Image file to restore
 * @param {string} modelName - Name of the restoration model
 * @returns {Promise<File>} Restored image file
 */
export const processLemGendaryRestoration = async (
    imageFile: File,
    modelName: string,
    onProgress?: (progress: any) => void
): Promise<File> => {
    try {
        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(imageFile);

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = objectUrl;
        });

        const restoredImageData = await restoreInWorker(img, modelName, onProgress);
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        canvas.width = restoredImageData.width;
        canvas.height = restoredImageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        ctx.putImageData(restoredImageData, 0, 0);

        const blob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, MIME_TYPE_MAP.png); // Use PNG for lossless result
        });

        if (!blob) throw new Error("Blob creation failed");

        const originalName = imageFile.name;
        const extension = originalName.split('.').pop() || 'png';
        const newName = originalName.replace(
            /\.[^/.]+$/,
            `-restored-${modelName}.${extension}`
        );

        return new File([blob], newName, { type: MIME_TYPE_MAP.png });
    } catch (_error) {
        throw new Error(ERROR_MESSAGES.RESTORATION_FAILED || 'Restoration failed');
    }
};
