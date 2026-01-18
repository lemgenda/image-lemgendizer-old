import { describe, it, expect } from 'vitest';
import {
    formatFileSize,
    getFileExtension,
    sanitizeFilename,
    getMimeType,
    isFilenameTooLong,
    calculateUpscaleFactor
} from './fileUtils';

describe('fileUtils', () => {
    describe('formatFileSize', () => {
        it('should correctly format bytes', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1048576)).toBe('1 MB');
            expect(formatFileSize(1500)).toBe('1.46 KB');
        });
    });

    describe('getFileExtension', () => {
        it('should extract extension and lowercase it', () => {
            expect(getFileExtension('test.jpg')).toBe('jpg');
            expect(getFileExtension('IMAGE.PNG')).toBe('png');
            expect(getFileExtension('archive.tar.gz')).toBe('gz');
        });
    });

    describe('sanitizeFilename', () => {
        it('should replace invalid characters with underscore', () => {
            expect(sanitizeFilename('test/file.jpg')).toBe('test_file.jpg');
            expect(sanitizeFilename('a:b*c?d.png')).toBe('a_b_c_d.png');
        });
    });

    describe('getMimeType', () => {
        it('should return correct mime type for known extensions', () => {
            expect(getMimeType('jpg')).toBe('image/jpeg');
            expect(getMimeType('png')).toBe('image/png');
            expect(getMimeType('webp')).toBe('image/webp');
        });

        it('should return default for unknown extensions', () => {
            expect(getMimeType('unknown')).toBe('application/octet-stream');
        });
    });

    describe('isFilenameTooLong', () => {
        it('should correctly identify long filenames', () => {
            const shortName = 'a'.repeat(50);
            const longName = 'a'.repeat(101); // MAX_FILENAME_LENGTH is 100
            expect(isFilenameTooLong(shortName)).toBe(false);
            expect(isFilenameTooLong(longName)).toBe(true);
        });
    });

    describe('calculateUpscaleFactor', () => {
        it('should return 1 if target is smaller or equal', () => {
            expect(calculateUpscaleFactor(100, 100, 50, 50)).toBe(1);
            expect(calculateUpscaleFactor(100, 100, 100, 100)).toBe(1);
        });

        it('should return appropriate scale factor', () => {
            expect(calculateUpscaleFactor(100, 100, 200, 200)).toBe(2);
            expect(calculateUpscaleFactor(100, 100, 350, 350)).toBe(4);
        });
    });
});
