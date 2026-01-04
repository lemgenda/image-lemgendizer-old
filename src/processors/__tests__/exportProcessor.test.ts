import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateExportSettings,
    getExportFolderStructure,
    isPreviewOrErrorFile,
    createExportZip
} from '../exportProcessor';
import { PROCESSING_MODES } from '../../constants';
import type { ImageFile, ExportSettings, ProcessingMode } from '../../types';

// Mock JSZip
const mockFile = vi.fn();
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
        const mockOriginalImages: ImageFile[] = [{
            id: '1',
            name: 'img1.jpg',
            file: new File([''], 'img1.jpg', { type: 'image/jpeg' }),
            preview: '',
            size: 100,
            type: 'image/jpeg',
            originalWidth: 100,
            originalHeight: 100,
            processed: false
        }];

        const mockProcessedImages: ImageFile[] = [{
            name: 'img1.webp',
            file: new File([''], 'img1.webp'),
            processed: true,
            format: 'webp',
            id: '2',
            size: 0,
            type: 'image/webp',
            preview: '',
            originalWidth: 800,
            originalHeight: 600,
            template: { category: 'web', width: 800, height: 600 } as any
        }];

        it('should add original images if selected', async () => {
            const settings = { includeOriginal: true } as ExportSettings;
            await createExportZip(mockOriginalImages, [], settings, PROCESSING_MODES.CUSTOM as ProcessingMode);

            expect(mockFolderFn).toHaveBeenCalledWith('OriginalImages');
            expect(mockFile).toHaveBeenCalledWith('img1.jpg', expect.any(Object));
        });

        it('should add processed images to optimized folder in custom mode', async () => {
            const settings = { includeOptimized: true, includeOriginal: false } as ExportSettings;
            await createExportZip([], mockProcessedImages, settings, PROCESSING_MODES.CUSTOM as ProcessingMode);

            expect(mockFolderFn).toHaveBeenCalledWith('OptimizedImages');
            expect(mockFile).toHaveBeenCalled();
        });

        it('should add web images in template mode', async () => {
            const settings = { includeWebImages: true } as ExportSettings;
            await createExportZip([], mockProcessedImages, settings, PROCESSING_MODES.TEMPLATES as ProcessingMode);

            expect(mockFolderFn).toHaveBeenCalledWith('WebImages');
            expect(mockFile).toHaveBeenCalled();
        });
    });

    describe('generateExportSettings', () => {
        it('should generate custom mode settings correctly', () => {
            const settings = generateExportSettings(PROCESSING_MODES.CUSTOM as ProcessingMode);
            expect(settings.includeOriginal).toBe(true);
            expect(settings.includeOptimized).toBe(true);
            expect(settings.createFolders).toBe(true);
        });

        it('should generate template mode settings correctly', () => {
            const settings = generateExportSettings(PROCESSING_MODES.TEMPLATES as ProcessingMode);
            expect(settings.includeWebImages).toBe(true);
            expect(settings.includeLogoImages).toBe(true);
            expect(settings.includeSocialMedia).toBe(true);
        });

        it('should merge additional settings', () => {
            const settings = generateExportSettings(PROCESSING_MODES.CUSTOM as ProcessingMode, { includeFavicon: true });
            expect(settings.includeFavicon).toBe(true);
        });
    });

    describe('getExportFolderStructure', () => {
        it('should return original/optimized for custom mode', () => {
            const folders = getExportFolderStructure(PROCESSING_MODES.CUSTOM as ProcessingMode);
            expect(folders).toContain('OriginalImages');
            expect(folders).toContain('OptimizedImages');
        });

        it('should return template folders for template mode', () => {
            const folders = getExportFolderStructure(PROCESSING_MODES.TEMPLATES as ProcessingMode);
            expect(folders).toContain('WebImages');
            expect(folders).toContain('LogoImages');
        });
    });

    describe('isPreviewOrErrorFile', () => {
        const dummyFile = {
            id: 'dummy',
            name: 'dummy.jpg',
            file: new File([''], 'dummy.jpg'),
            preview: '',
            originalWidth: 100,
            originalHeight: 100,
            size: 100,
            type: 'image/jpeg',
            processed: true
        } as ImageFile;

        it('should identify preview files', () => {
            expect(isPreviewOrErrorFile({ ...dummyFile, name: 'test-preview.webp' })).toBe(true);
            expect(isPreviewOrErrorFile({ ...dummyFile, name: 'favicon-preview.png' })).toBe(true);
        });

        it('should identify error/unprocessed files', () => {
            expect(isPreviewOrErrorFile({ ...dummyFile, name: 'image.jpg', processed: false })).toBe(true);
            expect(isPreviewOrErrorFile({ ...dummyFile, name: 'image.jpg', error: 'failed', processed: false })).toBe(true);
        });

        it('should return false for regular processed files', () => {
            expect(isPreviewOrErrorFile({ ...dummyFile, name: 'image.jpg', processed: true })).toBe(false);
        });
    });
});
