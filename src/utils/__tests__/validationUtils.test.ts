import { describe, it, expect } from 'vitest';
import { validateProcessingOptions } from '../validationUtils';
import type { ProcessingOptions } from '../../types';

describe('validationUtils', () => {
    describe('validateProcessingOptions', () => {
        it('should return valid for correct options', () => {
            const options: Partial<ProcessingOptions> = {
                compression: { quality: 85, fileSize: '100' },
                resizeDimension: '800',
                cropWidth: '1080',
                cropHeight: '1080',
                output: { formats: ['webp'], quality: 85, rename: false, newFileName: '{name}' }
            };
            const result = validateProcessingOptions(options as ProcessingOptions);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should catch invalid quality', () => {
            const options = { compression: { quality: 150 } };
            const result = validateProcessingOptions(options as any);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Compression quality must be between 1 and 100');
        });

        it('should catch extreme resize dimensions', () => {
            const options = { resizeDimension: '50000' };
            const result = validateProcessingOptions(options as any);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Resize dimension cannot exceed 10000 pixels');
        });

        it('should catch mismatched crop dimensions', () => {
            const options = { cropWidth: '1000', cropHeight: '' };
            const result = validateProcessingOptions(options as any);
            expect(result.errors).toContain('Both crop width and height must be provided together, or leave both empty to skip cropping');
        });

        it('should catch extreme aspect ratios', () => {
            const options = { cropWidth: '1000', cropHeight: '1' };
            const result = validateProcessingOptions(options as any);
            expect(result.errors).toContain('Crop dimensions have extreme aspect ratio. Please use reasonable values.');
        });

        it('should catch empty output formats', () => {
            const options = { output: { formats: [] } };
            const result = validateProcessingOptions(options as any);
            expect(result.errors).toContain('At least one output format must be selected');
        });
    });
});
