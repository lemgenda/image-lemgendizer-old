import { describe, it, expect } from 'vitest';
import { decodeRetinaFace, getAffineTransform, invertMatrix } from '../geometryUtils';

describe('V31 Geometry & Decoding Verification', () => {
    it('should decode RetinaFace outputs with high precision', () => {
        const scores = new Float32Array([0.05, 0.95]); // 1 prior: [bg, face]
        const boxes = new Float32Array([100, 150, 400, 450]); // x1, y1, x2, y2
        const landmarks = new Float32Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

        const results = decodeRetinaFace(scores, boxes, landmarks, 0.5);
        expect(results).toHaveLength(1);
        expect(results[0].score).toBeCloseTo(0.95, 5);
        expect(Array.from(results[0].bbox)).toEqual([100, 150, 400, 450]);
        expect(results[0].landmarks[0]).toEqual([10, 20]);
        expect(results[0].landmarks[4]).toEqual([90, 100]);
    });

    it('should compute and invert complex affine transforms', () => {
        // Simple scale + translate
        const src = [[0, 0], [100, 0], [100, 100], [0, 100], [50, 50]];
        const dst = [[10, 20], [210, 20], [210, 220], [10, 220], [110, 120]]; // Scale 2, Translate (10, 20)

        const matrix = getAffineTransform(src, dst);
        expect(matrix[0]).toBeCloseTo(2, 4); // a (scale x)
        expect(matrix[4]).toBeCloseTo(2, 4); // d (scale y)
        expect(matrix[2]).toBeCloseTo(10, 4); // tx
        expect(matrix[5]).toBeCloseTo(20, 4); // ty

        const inv = invertMatrix(matrix);
        expect(inv).not.toBeNull();
        if (inv) {
            expect(inv[0]).toBeCloseTo(0.5, 4); // 1/scale
            expect(inv[2]).toBeCloseTo(-5, 4);  // -tx/scale = -10/2 = -5
        }
    });

    it('should handle identity mapping for REFERENCE_FACIAL_POINTS', async () => {
        const { REFERENCE_FACIAL_POINTS } = await import('../geometryUtils');
        const matrix = getAffineTransform(REFERENCE_FACIAL_POINTS, REFERENCE_FACIAL_POINTS);
        expect(matrix[0]).toBeCloseTo(1, 5);
        expect(matrix[4]).toBeCloseTo(1, 5);
        expect(matrix[2]).toBeCloseTo(0, 5);
        expect(matrix[5]).toBeCloseTo(0, 5);
    });
});
