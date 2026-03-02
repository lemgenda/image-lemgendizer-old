/**
 * Geometry Utilities for Image Restoration (V31)
 */

export const REFERENCE_FACIAL_POINTS = [
    [192.98138, 239.9448],   // Left Eye
    [318.9023, 239.01399],   // Right Eye
    [256.63403, 337.35661],  // Nose
    [208.59146, 429.50611],  // Left Mouth
    [303.20454, 428.71144]   // Right Mouth
]; // Based on FFHQ 512x512 alignment

/**
 * Ordinary Least Squares for Affine Transform [2x3]
 * Matrix format: [a, b, tx, c, d, ty]
 */
export const getAffineTransform = (src: number[][], dst: number[][]): number[] => {
    const n = src.length;
    let sumX = 0, sumY = 0, sumU = 0, sumV = 0;
    let sumXX = 0, sumXY = 0, sumYY = 0, sumXU = 0, sumXV = 0, sumYU = 0, sumYV = 0;

    for (let i = 0; i < n; i++) {
        const [x, y] = src[i];
        const [u, v] = dst[i];
        sumX += x; sumY += y; sumU += u; sumV += v;
        sumXX += x * x; sumXY += x * y; sumYY += y * y;
        sumXU += x * u; sumXV += x * v; sumYU += y * u; sumYV += y * v;
    }

    const M00 = sumXX, M01 = sumXY, M02 = sumX;
    const M10 = sumXY, M11 = sumYY, M12 = sumY;
    const M20 = sumX, M21 = sumY, M22 = n;

    const det = M00 * (M11 * M22 - M12 * M21) - M01 * (M10 * M22 - M12 * M20) + M02 * (M10 * M21 - M11 * M20);
    if (Math.abs(det) < 1e-10) return [1, 0, 0, 0, 1, 0];

    const solve = (b0: number, b1: number, b2: number) => {
        const d0 = b0 * (M11 * M22 - M12 * M21) - M01 * (b1 * M22 - M12 * b2) + M02 * (b1 * M21 - M11 * b2);
        const d1 = M00 * (b1 * M22 - M12 * b2) - b0 * (M10 * M22 - M12 * M20) + M02 * (M10 * b2 - b1 * M20);
        const d2 = M00 * (M11 * b2 - b1 * M21) - M01 * (M10 * b2 - b1 * M20) + b0 * (M10 * M21 - M11 * M20);
        return [d0 / det, d1 / det, d2 / det];
    };

    const [a, b, tx] = solve(sumXU, sumYU, sumU);
    const [c, d, ty] = solve(sumXV, sumYV, sumV);
    return [a, b, tx, c, d, ty];
};

/**
 * Inverts a 2x3 Affine Matrix
 */
export const invertMatrix = (m: number[]): number[] | null => {
    const [a, b, tx, c, d, ty] = m;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) return null;
    return [
        d / det,
        -b / det,
        (b * ty - d * tx) / det,
        -c / det,
        a / det,
        (c * tx - a * ty) / det
    ];
};

/**
 * Decodes RetinaFace scores, boxes, and landmarks
 */
export const decodeRetinaFace = (scores: Float32Array, boxes: Float32Array, landmarks: Float32Array, threshold: number = 0.8) => {
    const results = [];
    const numPriors = scores.length / 2;
    for (let i = 0; i < numPriors; i++) {
        const score = scores[i * 2 + 1];
        if (score > threshold) {
            const bbox = [boxes[i * 4], boxes[i * 4 + 1], boxes[i * 4 + 2], boxes[i * 4 + 3]];
            const ldm = [];
            for (let j = 0; j < 5; j++) {
                ldm.push([landmarks[i * 10 + j * 2], landmarks[i * 10 + j * 2 + 1]]);
            }
            results.push({ score, bbox, landmarks: ldm });
        }
    }
    return results;
};
