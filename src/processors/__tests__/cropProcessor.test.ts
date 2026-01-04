import { describe, it, expect } from 'vitest';
import { calculateCropOffset, adjustCropPositionForFocalPoint } from '../cropProcessor';
import { CROP_POSITIONS } from '../../constants';
import type { CropPosition, FocalPoint } from '../../types';

describe('cropProcessor', () => {
    describe('calculateCropOffset', () => {
        const srcWidth = 2000;
        const srcHeight = 1000;
        const targetWidth = 500;
        const targetHeight = 500;

        it('should calculate offset for CENTER', () => {
            const { offsetX, offsetY } = calculateCropOffset(srcWidth, srcHeight, targetWidth, targetHeight, CROP_POSITIONS.CENTER as CropPosition);
            // (2000 - 500) / 2 = 750
            // (1000 - 500) / 2 = 250
            expect(offsetX).toBe(750);
            expect(offsetY).toBe(250);
        });

        it('should calculate offset for TOP_LEFT', () => {
            const { offsetX, offsetY } = calculateCropOffset(srcWidth, srcHeight, targetWidth, targetHeight, CROP_POSITIONS.TOP_LEFT as CropPosition);
            expect(offsetX).toBe(0);
            expect(offsetY).toBe(0);
        });

        it('should calculate offset for BOTTOM_RIGHT', () => {
            const { offsetX, offsetY } = calculateCropOffset(srcWidth, srcHeight, targetWidth, targetHeight, CROP_POSITIONS.BOTTOM_RIGHT as CropPosition);
            expect(offsetX).toBe(1500); // 2000 - 500
            expect(offsetY).toBe(500);  // 1000 - 500
        });

        it('should constrain offsets to safe bounds', () => {
            const { offsetX, offsetY } = calculateCropOffset(100, 100, 100, 100, CROP_POSITIONS.BOTTOM_RIGHT as CropPosition);
            expect(offsetX).toBe(0);
            expect(offsetY).toBe(0);
        });
    });

    describe('adjustCropPositionForFocalPoint', () => {
        const width = 1000;
        const height = 1000;

        it('should not adjust if focal point is near center', () => {
            const focalPoint: FocalPoint = { x: 520, y: 520 }; // Very close to 500,500
            const pos = adjustCropPositionForFocalPoint(CROP_POSITIONS.CENTER as CropPosition, focalPoint, width, height);
            expect(pos).toBe(CROP_POSITIONS.CENTER);
        });

        it('should adjust to TOP if focal point is high', () => {
            const focalPoint: FocalPoint = { x: 500, y: 100 }; // High up
            const pos = adjustCropPositionForFocalPoint(CROP_POSITIONS.CENTER as CropPosition, focalPoint, width, height);
            expect(pos).toBe(CROP_POSITIONS.TOP);
        });

        it('should adjust to BOTTOM if focal point is low', () => {
            const focalPoint: FocalPoint = { x: 500, y: 900 }; // Low down
            const pos = adjustCropPositionForFocalPoint(CROP_POSITIONS.CENTER as CropPosition, focalPoint, width, height);
            expect(pos).toBe(CROP_POSITIONS.BOTTOM);
        });

        it('should adjust to LEFT if focal point is on the left', () => {
            const focalPoint: FocalPoint = { x: 100, y: 500 };
            const pos = adjustCropPositionForFocalPoint(CROP_POSITIONS.CENTER as CropPosition, focalPoint, width, height);
            expect(pos).toBe(CROP_POSITIONS.LEFT);
        });
    });
});
