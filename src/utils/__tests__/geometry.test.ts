import { describe, it, expect } from 'vitest';
import { getAffineTransform, invertMatrix, REFERENCE_FACIAL_POINTS, decodeRetinaFace } from '../geometryUtils';

describe('Geometry Utilities', () => {
    it('should compute an identity transform for matching points', () => {
        const matrix = getAffineTransform(REFERENCE_FACIAL_POINTS, REFERENCE_FACIAL_POINTS);
        // [a, b, tx, c, d, ty]
        expect(matrix[0]).toBeCloseTo(1, 5); // a
        expect(matrix[1]).toBeCloseTo(0, 5); // b
        expect(matrix[2]).toBeCloseTo(0, 5); // tx
        expect(matrix[3]).toBeCloseTo(0, 5); // c
        expect(matrix[4]).toBeCloseTo(1, 5); // d
        expect(matrix[5]).toBeCloseTo(0, 5); // ty
    });

    it('should compute a valid translation transform', () => {
        const shifted = REFERENCE_FACIAL_POINTS.map(([x, y]) => [x + 10, y + 20]);
        const matrix = getAffineTransform(REFERENCE_FACIAL_POINTS, shifted);
        expect(matrix[2]).toBeCloseTo(10, 5); // tx
        expect(matrix[5]).toBeCloseTo(20, 5); // ty
    });

    it('should invert a matrix correctly', () => {
        const m = [2, 0, 10, 0, 2, 20]; // Scale 2, translate 10,20
        const inv = invertMatrix(m);
        expect(inv).not.toBeNull();
        if (inv) {
            expect(inv[0]).toBeCloseTo(0.5, 5);
            expect(inv[4]).toBeCloseTo(0.5, 5);
            expect(inv[2]).toBeCloseTo(-5, 5); // tx_shifted = -tx/scale = -10/2 = -5
            expect(inv[5]).toBeCloseTo(-10, 5); // ty_shifted = -20/2 = -10
        }
    });

    it('should decode RetinaFace outputs properly', () => {
        const scores = new Float32Array([0.1, 0.9, 0.8, 0.2]); // 2 priors: [bg, face]
        const boxes = new Float32Array([10, 15, 100, 110, 20, 25, 200, 210]);
        const landmarks = new Float32Array(20).fill(0);
        landmarks[0] = 50; landmarks[1] = 55; // landmark 0
        landmarks[2] = 60; landmarks[3] = 65; // landmark 1

        const results = decodeRetinaFace(scores, boxes, landmarks, 0.5);
        expect(results).toHaveLength(1);
        expect(results[0].score).toBeCloseTo(0.9, 5);
        expect(Array.from(results[0].bbox)).toEqual([10, 15, 100, 110]);
        expect(results[0].landmarks[0]).toEqual([50, 55]);
        expect(results[0].landmarks[1]).toEqual([60, 65]);
    });
});
