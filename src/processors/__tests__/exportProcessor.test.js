import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateExportSettings,
    getExportFolderStructure,
    isPreviewOrErrorFile,
    createExportZip
} from '../exportProcessor';
import { PROCESSING_MODES } from '../../constants';

// Mock JSZip
const mockFile = vi.fn();
// Mock nested folder calls to return an object that also has file()
const mockFolderFn = vi.fn().mockImplementation(() => ({
    file: mockFile,
    folder: mockFolderFn
}));

const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip data']));

vi.mock('jszip', () => {
    return {
        default: class {
            file = mockFile;
            folder = mockFolderFn;
            generateAsync = mockGenerateAsync;
        }
    };
});

describe('exportProcessor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createExportZip', () => {
        const mockOriginalImages = [{ name: 'img1.jpg', file: new File([''], 'img1.jpg'), processed: false }];
        // Valid image for processed needs validImage check (name, file/blob)
        const mockProcessedImages = [{
            name: 'img1.webp',
            file: new File([''], 'img1.webp'),
            processed: true,
            format: 'webp',
            template: { category: 'web' } // For template mode tests
        }];

        it('should add original images if selected', async () => {
            const settings = { includeOriginal: true };
            await createExportZip(mockOriginalImages, [], settings, PROCESSING_MODES.CUSTOM);

            expect(mockFolderFn).toHaveBeenCalledWith('OriginalImages');
            expect(mockFile).toHaveBeenCalledWith('img1.jpg', expect.any(Object));
        });

        it('should add processed images to optimized folder in custom mode', async () => {
            const settings = { includeOptimized: true, includeOriginal: false };
            await createExportZip([], mockProcessedImages, settings, PROCESSING_MODES.CUSTOM);

            expect(mockFolderFn).toHaveBeenCalledWith('OptimizedImages');
            // It creates subfolders for formats too, so we expect file() to be called on the subfolder
            // Since our mock returns the same shape recursively, verify general file adding
            expect(mockFile).toHaveBeenCalled();
        });

        it('should add web images in template mode', async () => {
            const settings = { includeWebImages: true };
            await createExportZip([], mockProcessedImages, settings, PROCESSING_MODES.TEMPLATES);

            expect(mockFolderFn).toHaveBeenCalledWith('WebImages');
            expect(mockFile).toHaveBeenCalled();
        });
    });

    describe('generateExportSettings', () => {
        it('should generate custom mode settings correctly', () => {
            const settings = generateExportSettings(PROCESSING_MODES.CUSTOM);
            expect(settings.includeOriginal).toBe(true);
            expect(settings.includeOptimized).toBe(true);
            expect(settings.createFolders).toBe(true);
        });

        it('should generate template mode settings correctly', () => {
            const settings = generateExportSettings(PROCESSING_MODES.TEMPLATES);
            expect(settings.includeWebImages).toBe(true);
            expect(settings.includeLogoImages).toBe(true);
            expect(settings.includeSocialMedia).toBe(true);
        });

        it('should merge additional settings', () => {
            const settings = generateExportSettings(PROCESSING_MODES.CUSTOM, { includeFavicon: true });
            expect(settings.includeFavicon).toBe(true);
        });
    });

    describe('getExportFolderStructure', () => {
        it('should return original/optimized for custom mode', () => {
            const folders = getExportFolderStructure(PROCESSING_MODES.CUSTOM);
            expect(folders).toContain('OriginalImages');
            expect(folders).toContain('OptimizedImages');
        });

        it('should return template folders for template mode', () => {
            const folders = getExportFolderStructure(PROCESSING_MODES.TEMPLATES);
            expect(folders).toContain('WebImages');
            expect(folders).toContain('LogoImages');
        });
    });

    describe('isPreviewOrErrorFile', () => {
        const dummyFile = { size: 100 };
        it('should identify preview files', () => {
            expect(isPreviewOrErrorFile({ name: 'test-preview.webp', processed: true, file: dummyFile })).toBe(true);
            expect(isPreviewOrErrorFile({ name: 'favicon-preview.png', processed: true, file: dummyFile })).toBe(true);
        });

        it('should identify error/unprocessed files', () => {
            expect(isPreviewOrErrorFile({ name: 'image.jpg', processed: false, file: dummyFile })).toBe(true);
            expect(isPreviewOrErrorFile({ name: 'image.jpg', error: true, processed: false, file: dummyFile })).toBe(true);
        });

        it('should return false for regular processed files', () => {
            expect(isPreviewOrErrorFile({ name: 'image.jpg', processed: true, file: dummyFile })).toBe(false);
        });
    });
});
