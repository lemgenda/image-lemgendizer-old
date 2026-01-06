import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import {
    PROCESSING_MODES
} from '../constants';

import {
    generateTIFFPreview,
    generateQuickTIFFPreview,
    createFilePlaceholder,
    generateSVGPreview
} from '../utils';
import type { ImageFile, ProcessingMode } from '../types';
import '../styles/UploadGallerySection.css';

interface PreviewData {
    url: string;
    type: 'image' | 'placeholder';
    format: 'tiff' | 'svg' | 'regular';
    timestamp: number;
}

interface UploadGallerySectionProps {
    images: ImageFile[];
    selectedImages: string[];
    processingMode: ProcessingMode;
    templateSelectedImage: string | null | undefined;
    onImageSelect: (id: string) => void;
    onSelectAll: () => void;
    onRemoveSelected: () => void;
    formatFileSize: (size: number) => string;
}

/**
 * Gallery component displaying uploaded images.
 * Handles selection, removal, and preview generation for various formats (including TIFF/SVG).
 *
 * @param {UploadGallerySectionProps} props - Component props
 */
function UploadGallerySection({
    images,
    selectedImages,
    processingMode,
    templateSelectedImage,
    onImageSelect,
    onSelectAll,
    onRemoveSelected,
    formatFileSize
}: UploadGallerySectionProps) {
    const { t } = useTranslation();
    const [imagePreviews, setImagePreviews] = useState<Record<string, PreviewData>>({});
    const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set());
    const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());

    const createNewPreviewFromFile = useCallback((image: ImageFile): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const result = e.target?.result;
                if (!result) {
                    reject(new Error('Failed to read file: no result'));
                    return;
                }

                try {
                    const blob = new Blob([result], { type: image.file.type });
                    const blobUrl = URL.createObjectURL(blob);

                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxSize = 400;
                        let width = img.naturalWidth || img.width || 200;
                        let height = img.naturalHeight || img.height || 200;

                        if (width > maxSize || height > maxSize) {
                            const ratio = Math.min(maxSize / width, maxSize / height);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            URL.revokeObjectURL(blobUrl);
                            reject(new Error('Failed to get canvas context'));
                            return;
                        }
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob(
                            (previewBlob) => {
                                URL.revokeObjectURL(blobUrl);
                                if (!previewBlob) {
                                    reject(new Error('Failed to create preview blob'));
                                    return;
                                }
                                const previewUrl = URL.createObjectURL(previewBlob);
                                resolve(previewUrl);
                            },
                            'image/jpeg',
                            0.7
                        );
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        reject(new Error('Failed to load image for preview'));
                    };
                    img.src = blobUrl;
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(image.file);
        });
    }, []);

    const generateRegularPreview = useCallback(async (image: ImageFile): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!image.file) {
                reject(new Error('No file available'));
                return;
            }

            if (image.preview && (image.preview.startsWith('blob:') || image.preview.startsWith('data:'))) {
                const img = new Image();
                img.onload = () => resolve(image.preview);
                img.onerror = () => {
                    createNewPreviewFromFile(image).then(resolve).catch(reject);
                };
                img.src = image.preview;
                return;
            }

            createNewPreviewFromFile(image).then(resolve).catch(reject);
        });
    }, [createNewPreviewFromFile]);

    useEffect(() => {
        const generatePreviews = async () => {
            const currentRunProcessing = new Set<string>();

            for (const image of images) {
                const imageId = image.id;

                if (imagePreviews[imageId] || failedPreviews.has(imageId) || loadingPreviews.has(imageId)) continue;
                if (currentRunProcessing.has(imageId)) continue;

                currentRunProcessing.add(imageId);
                setLoadingPreviews(prev => new Set(prev).add(imageId));

                try {
                    let previewUrl: string;

                    if (image.isTIFF) {
                        try {
                            previewUrl = await generateTIFFPreview(image.file, 400);
                        } catch {
                            try {
                                previewUrl = await generateQuickTIFFPreview(image.file, 300);
                            } catch {
                                throw new Error('Failed to generate TIFF preview');
                            }
                        }
                    }
                    else if (image.isSVG) {
                        previewUrl = await generateSVGPreview(image.file);
                    }
                    else {
                        previewUrl = await generateRegularPreview(image);
                    }

                    setImagePreviews(prev => ({
                        ...prev,
                        [imageId]: {
                            url: previewUrl,
                            type: 'image',
                            format: image.isTIFF ? 'tiff' : image.isSVG ? 'svg' : 'regular',
                            timestamp: Date.now()
                        }
                    }));

                    setFailedPreviews(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(imageId);
                        return newSet;
                    });

                } catch {
                    setFailedPreviews(prev => new Set(prev).add(imageId));

                    setImagePreviews(prev => ({
                        ...prev,
                        [imageId]: {
                            url: createFilePlaceholder(image),
                            type: 'placeholder',
                            format: image.isTIFF ? 'tiff' : image.isSVG ? 'svg' : 'regular',
                            timestamp: Date.now()
                        }
                    }));
                } finally {
                    setLoadingPreviews(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(imageId);
                        return newSet;
                    });
                }
            }
        };

        generatePreviews();
    }, [images, imagePreviews, failedPreviews, loadingPreviews, generateRegularPreview]);

    const getPreviewUrl = useCallback((image: ImageFile): string => {
        const preview = imagePreviews[image.id];
        if (preview && preview.url) {
            return preview.url;
        }
        return image.preview || createFilePlaceholder(image);
    }, [imagePreviews]);

    const shouldShowRealPreview = useCallback((image: ImageFile): boolean => {
        const preview = imagePreviews[image.id];
        return !!(preview && preview.type === 'image' && !failedPreviews.has(image.id));
    }, [imagePreviews, failedPreviews]);

    const isImageLoading = useCallback((imageId: string): boolean => {
        return loadingPreviews.has(imageId);
    }, [loadingPreviews]);

    const handleImageClick = useCallback((imageId: string) => {
        onImageSelect(imageId);
    }, [onImageSelect]);

    useEffect(() => {
        return () => {
            Object.values(imagePreviews).forEach(preview => {
                if (preview.url && preview.url.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(preview.url);
                    } catch { /* ignore */ }
                }
            });
        };
    }, [imagePreviews]);

    return (
        <div className="gallery-card">
            <div className="gallery-card-header">
                <h3 className="gallery-card-title">
                    <i className="fas fa-images"></i> {t('gallery.title')} ({images.length})
                    {processingMode === PROCESSING_MODES.TEMPLATES && (
                        <span className="text-muted font-normal ml-md">
                            {t('gallery.templatesMode')}
                        </span>
                    )}
                </h3>
                <div className="gallery-card-actions">
                    {processingMode === PROCESSING_MODES.CUSTOM && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={onSelectAll}
                        >
                            <i className="fas fa-check-square"></i> {selectedImages.length === images.length ? t('gallery.deselectAll') : t('gallery.selectAll')}
                        </button>
                    )}
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={onRemoveSelected}
                        disabled={
                            processingMode === PROCESSING_MODES.TEMPLATES
                                ? !templateSelectedImage
                                : selectedImages.length === 0
                        }
                    >
                        <i className="fas fa-trash"></i> {t('gallery.removeSelected')}
                    </button>
                </div>
            </div>

            {images.length === 0 ? (
                <div className="text-center py-lg">
                    <i className="fas fa-images text-4xl text-muted mb-sm"></i>
                    <p className="text-muted">{t('gallery.noImages')}</p>
                </div>
            ) : (
                <div className="gallery-image-grid">
                    {images.map(image => {
                        const isSelected = processingMode === PROCESSING_MODES.TEMPLATES
                            ? image.id === templateSelectedImage
                            : selectedImages.includes(image.id);

                        const previewUrl = getPreviewUrl(image);
                        const showRealPreview = shouldShowRealPreview(image);
                        const imageLoading = isImageLoading(image.id);

                        const selectionLabel = isSelected ? t('common.selected') : t('common.notSelected');
                        const ariaLabel = `${t('gallery.image')}: ${image.name} (${selectionLabel})`;

                        return (
                            <button
                                key={image.id}
                                type="button"
                                className={`gallery-image-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleImageClick(image.id)}
                                aria-pressed={isSelected}
                                aria-label={ariaLabel}
                            >
                                <div className="gallery-image-checkbox">
                                    <i className={`fas fa-${isSelected ? 'check-circle' : 'circle'}`}></i>
                                </div>

                                {processingMode === PROCESSING_MODES.TEMPLATES && isSelected && (
                                    <div className="gallery-template-badge">
                                        <i className="fas fa-th-large mr-1"></i> {t('gallery.templateImage')}
                                    </div>
                                )}

                                <div className="gallery-image-preview-container transparency-grid">

                                    {imageLoading ? (
                                        <div className="gallery-image-loading">
                                            <div className="gallery-loading-spinner"></div>
                                        </div>
                                    ) : (
                                        <>
                                            <img
                                                src={previewUrl}
                                                alt=""
                                                className="gallery-image-preview"
                                                loading="lazy"
                                                onLoad={(e) => {
                                                    (e.target as HTMLImageElement).style.opacity = '1';
                                                }}
                                                onError={() => {
                                                    setFailedPreviews(prev => new Set(prev).add(image.id));
                                                }}
                                                style={{
                                                    opacity: showRealPreview ? 1 : 0.7,
                                                    display: showRealPreview ? 'block' : 'none'
                                                }}
                                            />

                                            {!showRealPreview && !imageLoading && (
                                                <div className="gallery-image-placeholder">
                                                    <div className="gallery-placeholder-icon">
                                                        {image.isTIFF ? t('common.format.tiff') : image.isSVG ? t('common.format.svg') : t('common.image_one').toUpperCase()}
                                                    </div>
                                                    <div className="gallery-placeholder-text">
                                                        {image.isTIFF ? t('common.format.tiff') : image.isSVG ? t('common.format.svg') : t('common.image_one').toUpperCase()}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {(image.isTIFF || image.isSVG) && !imageLoading && (
                                        <div className="gallery-special-format-indicator">
                                            {image.isTIFF ? t('common.format.tiff') : t('common.format.svg')}
                                        </div>
                                    )}
                                </div>

                                <div className="gallery-image-info">
                                    <span className="gallery-image-name">
                                        {image.name}
                                    </span>
                                    <span className="gallery-image-size">
                                        {formatFileSize(image.size)} • {image.originalFormat?.toUpperCase() || image.type.split('/')[1].toUpperCase()}
                                        {image.isTIFF && <span className="gallery-image-format-badge ml-xs">{t('common.format.tiff')}</span>}
                                        {image.isSVG && <span className="gallery-image-format-badge ml-xs">{t('common.format.svg')}</span>}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default UploadGallerySection;