
import { formatDate, generateNewFileName } from '../renameUtils';

describe('renameUtils', () => {
    describe('formatDate', () => {
        const testDate = new Date('2024-03-15T10:30:45');

        it('should format date with default format YYYY-MM-DD', () => {
            expect(formatDate(testDate)).toBe('2024-03-15');
        });

        it('should format date with complex format YYYY-MM-DD_HH-mm-ss', () => {
            expect(formatDate(testDate, 'YYYY-MM-DD_HH-mm-ss')).toBe('2024-03-15_10-30-45');
        });

        it('should pad single digits with zeros', () => {
            const earlyDate = new Date('2024-01-05T09:05:07');
            expect(formatDate(earlyDate, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-01-05 09:05:07');
        });
    });

    describe('generateNewFileName', () => {
        const originalName = 'holiday-photo.jpg';

        it('should use default pattern {name}', () => {
            expect(generateNewFileName(originalName, 0)).toBe('holiday-photo.jpg');
        });

        it('should handle {name} and {ext} tokens', () => {
            const options = { pattern: 'prefix_{name}_suffix{ext}' };
            expect(generateNewFileName(originalName, 0, options)).toBe('prefix_holiday-photo_suffix.jpg');
        });

        it('should handle {counter} with padding', () => {
            const options = { pattern: 'vacation_{counter}', startSequence: 1, zerosPadding: 3 };
            expect(generateNewFileName(originalName, 0, options)).toBe('vacation_001.jpg');
            expect(generateNewFileName(originalName, 5, { ...options, stepSequence: 2 })).toBe('vacation_011.jpg');
        });

        it('should handle {date} token', () => {
            const options = { pattern: 'backup_{date}', dateFormat: 'YYYY' };
            const currentYear = new Date().getFullYear().toString();
            expect(generateNewFileName(originalName, 0, options)).toBe(`backup_${currentYear}.jpg`);
        });

        it('should perform find and replace (literal)', () => {
            const options = { find: 'photo', replace: 'image' };
            expect(generateNewFileName(originalName, 0, options)).toBe('holiday-image.jpg');
        });

        it('should perform find and replace (regex)', () => {
            const options = { find: '-[a-z]+', replace: '_pic', useRegex: true };
            expect(generateNewFileName(originalName, 0, options)).toBe('holiday_pic.jpg');
        });

        it('should handle casing: uppercase', () => {
            const options = { casing: 'uppercase' };
            expect(generateNewFileName(originalName, 0, options)).toBe('HOLIDAY-PHOTO.JPG');
        });

        it('should handle casing: lowercase', () => {
            const options = { casing: 'lowercase' };
            expect(generateNewFileName('IMAGE.PNG', 0, options)).toBe('image.png');
        });

        it('should handle casing: camelCase', () => {
            const options = { casing: 'camelCase' };
            expect(generateNewFileName('my photo file.jpg', 0, options)).toBe('myPhotoFile.jpg');
        });

        it('should handle casing: kebabCase', () => {
            const options = { casing: 'kebabCase' };
            expect(generateNewFileName('My Photo File.jpg', 0, options)).toBe('my-photo-file.jpg');
        });

        it('should handle casing: snakeCase', () => {
            const options = { casing: 'snakeCase' };
            expect(generateNewFileName('My Photo File.jpg', 0, options)).toBe('my_photo_file.jpg');
        });

        it('should preserve extension if not specified in pattern', () => {
            const options = { pattern: 'new-name' };
            expect(generateNewFileName(originalName, 0, options)).toBe('new-name.jpg');
        });

        it('should not double append extension if already in pattern', () => {
            const options = { pattern: '{name}-copy{ext}' };
            expect(generateNewFileName(originalName, 0, options)).toBe('holiday-photo-copy.jpg');
        });

        it('should handle files without extensions', () => {
            expect(generateNewFileName('no-ext', 0, { pattern: 'test_{counter}' })).toBe('test_001');
        });
    });
});
