import decode, { init as initDecode } from '@jsquash/jxl/decode';
import encode, { init as initEncode } from '@jsquash/jxl/encode';
import jxlDecWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url';
import jxlEncWasmUrl from '@jsquash/jxl/codec/enc/jxl_enc.wasm?url';

let decodeInitialized = false;
let encodeInitialized = false;

/**
 * Initializes the WASM module for decoding JXL images.
 */
export const initJXLDecode = async () => {
    if (!decodeInitialized) {
        await initDecode({ locateFile: () => jxlDecWasmUrl });
        decodeInitialized = true;
    }
};

/**
 * Initializes the WASM module for encoding JXL images.
 */
export const initJXLEncode = async () => {
    if (!encodeInitialized) {
        await initEncode({ locateFile: () => jxlEncWasmUrl });
        encodeInitialized = true;
    }
};

/**
 * Decodes a JXL file into an ImageData object.
 * @param file The JXL File object
 * @returns Promise resolving to an ImageData object
 */
export const decodeJXL = async (file: File): Promise<ImageData> => {
    await initJXLDecode();
    const arrayBuffer = await file.arrayBuffer();
    return await decode(arrayBuffer);
};

/**
 * Encodes an ImageData object into a JXL ArrayBuffer.
 * @param imageData The ImageData object to encode
 * @param quality Encoding quality (0-100), default 75
 * @returns Promise resolving to a Uint8Array containing the JXL file data
 */
export const encodeJXL = async (imageData: ImageData, quality: number = 75): Promise<Uint8Array> => {
    await initJXLEncode();
    // jsquash/jxl uses effort (1-9) and quality (0-100)
    // We map out the quality parameter directly
    const buffer = await encode(imageData, { effort: 7, quality });
    return new Uint8Array(buffer);
};

/**
 * Converts a JXL File into a Blob with a standard MIME type (e.g. image/png)
 * Useful for displaying the image in an <img> tag or canvas since browsers don't natively support JXL rendering.
 * @param file The JXL File object
 * @param targetType The output MIME type (default 'image/png')
 * @returns Promise resolving to a Blob
 */
export const convertJXLToStandardBlob = async (file: File, targetType: string = 'image/png'): Promise<Blob> => {
    const imageData = await decodeJXL(file);
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context for JXL conversion');

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to convert Canvas to Blob for JXL fallback'));
        }, targetType);
    });
};
