import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import {
    PROCESSING_MODES,
    STATUS_COLORS,
    SPACING,
    BORDER_RADIUS,
    SHADOWS,
    TRANSITIONS
} from '../constants';

import {
    generateTIFFPreview,
    generateQuickTIFFPreview,
    createFilePlaceholder,
    generateSVGPreview
} from '../utils';

function UploadGallerySection({
    images,
    selectedImages,
    processingMode,
    templateSelectedImage,
    onImageSelect,
    onSelectAll,
    onRemoveSelected,
    formatFileSize
}) {
    const { t } = useTranslation();
    const [imagePreviews, setImagePreviews] = useState({});
    const [failedPreviews, setFailedPreviews] = useState(new Set());
    const [loadingPreviews, setLoadingPreviews] = useState(new Set());

    useEffect(() => {
        const generatePreviews = async () => {
            const newPreviews = { ...imagePreviews };
            const newLoadingPreviews = new Set(loadingPreviews);

            for (const image of images) {
                const imageId = image.id;

                if (newPreviews[imageId] || failedPreviews.has(imageId) || newLoadingPreviews.has(imageId)) continue;

                newLoadingPreviews.add(imageId);
                setLoadingPreviews(newLoadingPreviews);

                try {
                    let previewUrl;

                    if (image.isTIFF) {
                        try {
                            previewUrl = await generateTIFFPreview(image.file, 400);
                        } catch (tiffError) {
                            try {
                                previewUrl = await generateQuickTIFFPreview(image.file, 300);
                            } catch (quickError) {
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

                    newPreviews[imageId] = {
                        url: previewUrl,
                        type: 'image',
                        format: image.isTIFF ? 'tiff' : image.isSVG ? 'svg' : 'regular',
                        timestamp: Date.now()
                    };

                    setFailedPreviews(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(imageId);
                        return newSet;
                    });

                } catch (error) {
                    setFailedPreviews(prev => new Set(prev).add(imageId));
                    newPreviews[imageId] = {
                        url: createFilePlaceholder(image),
                        type: 'placeholder',
                        format: image.isTIFF ? 'tiff' : image.isSVG ? 'svg' : 'regular',
                        timestamp: Date.now()
                    };
                } finally {
                    newLoadingPreviews.delete(imageId);
                    setLoadingPreviews(newLoadingPreviews);
                }
            }

            setImagePreviews(newPreviews);
        };

        generatePreviews();
    }, [images]);

    const generateRegularPreview = useCallback(async (image) => {
        return new Promise((resolve, reject) => {
            if (!image.file) {
                reject(new Error('No file available'));
                return;
            }

            if (image.url && (image.url.startsWith('blob:') || image.url.startsWith('data:'))) {
                const img = new Image();
                img.onload = () => resolve(image.url);
                img.onerror = () => {
                    createNewPreviewFromFile(image).then(resolve).catch(reject);
                };
                img.src = image.url;
                return;
            }

            createNewPreviewFromFile(image).then(resolve).catch(reject);
        });
    }, []);

    const createNewPreviewFromFile = useCallback((image) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const blob = new Blob([e.target.result], { type: image.file.type });
                    const blobUrl = URL.createObjectURL(blob);

                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxSize = 400;
                        let width = img.naturalWidth || img.width || 200;
                        let height = img.naturalHeight || img.height || 150;

                        if (width > maxSize || height > maxSize) {
                            const scale = Math.min(maxSize / width, maxSize / height);
                            width = Math.round(width * scale);
                            height = Math.round(height * scale);
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');

                        ctx.drawImage(img, 0, 0, width, height);

                        URL.revokeObjectURL(blobUrl);
                        resolve(canvas.toDataURL('image/png'));
                    };

                    img.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        reject(new Error('Failed to load image'));
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

    const getPreviewUrl = useCallback((image) => {
        const preview = imagePreviews[image.id];
        if (preview && preview.url) {
            return preview.url;
        }
        return image.url || createFilePlaceholder(image);
    }, [imagePreviews]);

    const shouldShowRealPreview = useCallback((image) => {
        const preview = imagePreviews[image.id];
        return preview && preview.type === 'image' && !failedPreviews.has(image.id);
    }, [imagePreviews, failedPreviews]);

    const isLoading = useCallback((imageId) => {
        return loadingPreviews.has(imageId);
    }, [loadingPreviews]);

    const handleImageClick = useCallback((imageId) => {
        onImageSelect(imageId);
    }, [onImageSelect]);

    useEffect(() => {
        return () => {
            Object.values(imagePreviews).forEach(preview => {
                if (preview.url && preview.url.startsWith('blob:')) {
                    try {
                        URL.revokeObjectURL(preview.url);
                    } catch (e) {
                    }
                }
            });
        };
    }, [imagePreviews]);

    return (
        <>
            <style>{`
                .gallery-card {
                    background-color: var(--color-bg-secondary);
                    border-radius: ${BORDER_RADIUS.LG};
                    border: 1px solid var(--border-color);
                    padding: ${SPACING.LG};
                    margin-bottom: ${SPACING.LG};
                    box-shadow: ${SHADOWS.SM};
                    transition: box-shadow ${TRANSITIONS.FAST};
                }

                .gallery-card:hover {
                    box-shadow: ${SHADOWS.MD};
                }

                .gallery-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: ${SPACING.MD};
                    padding-bottom: ${SPACING.SM};
                    border-bottom: 1px solid var(--border-color);
                }

                .gallery-card-title {
                    color: var(--color-text-primary);
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: ${SPACING.SM};
                }

                .gallery-card-title i {
                    color: var(--color-primary);
                }

                .gallery-card-actions {
                    display: flex;
                    gap: ${SPACING.XS};
                    align-items: center;
                }

                .gallery-image-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: ${SPACING.MD};
                }

                .gallery-image-card {
                    position: relative;
                    background-color: var(--color-bg-primary);
                    border-radius: ${BORDER_RADIUS.MD};
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                    cursor: pointer;
                    transition: all ${TRANSITIONS.FAST};
                }

                .gallery-image-card:hover {
                    border-color: var(--color-primary);
                    box-shadow: ${SHADOWS.MD};
                }

                .gallery-image-card.selected {
                    border-color: var(--color-primary);
                    border-width: 2px;
                }

                .gallery-image-checkbox {
                    position: absolute;
                    top: ${SPACING.XS};
                    right: ${SPACING.XS};
                    z-index: 20;
                    color: var(--color-primary);
                    background-color: rgba(255, 255, 255, 0.95);
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .gallery-image-preview-container {
                    position: relative;
                    width: 100%;
                    height: 150px;
                    overflow: hidden;
                }

                .gallery-image-preview {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .gallery-image-loading {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.9);
                    z-index: 10;
                }

                .gallery-loading-spinner {
                    width: 30px;
                    height: 30px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .gallery-image-placeholder {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: ${SPACING.SM};
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    z-index: 5;
                }

                .gallery-placeholder-icon {
                    font-size: 2.5rem;
                    margin-bottom: ${SPACING.XS};
                    opacity: 0.6;
                }

                .gallery-placeholder-text {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #6c757d;
                    text-align: center;
                }

                .gallery-image-info {
                    padding: ${SPACING.SM};
                    background-color: var(--color-bg-primary);
                }

                .gallery-image-name {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-text-primary);
                    margin-bottom: ${SPACING.XS};
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .gallery-image-size {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                }

                .gallery-image-format-badge {
                    display: inline-block;
                    background-color: ${STATUS_COLORS.WARNING};
                    color: white;
                    font-size: 0.625rem;
                    padding: 1px 4px;
                    border-radius: ${BORDER_RADIUS.SM};
                    margin-left: ${SPACING.XS};
                }

                .gallery-template-badge {
                    position: absolute;
                    top: ${SPACING.XS};
                    left: ${SPACING.XS};
                    background-color: var(--color-primary);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: ${BORDER_RADIUS.SM};
                    z-index: 15;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                .gallery-template-badge i {
                    margin-right: 2px;
                }

                .gallery-special-format-indicator {
                    position: absolute;
                    bottom: ${SPACING.XS};
                    left: ${SPACING.XS};
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    font-size: 0.625rem;
                    font-weight: 600;
                    padding: 1px 4px;
                    border-radius: ${BORDER_RADIUS.SM};
                    z-index: 10;
                }

                @media (max-width: 768px) {
                    .gallery-card-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: ${SPACING.SM};
                    }

                    .gallery-card-actions {
                        width: 100%;
                        justify-content: flex-start;
                    }

                    .gallery-image-grid {
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    }
                }

                @media (max-width: 480px) {
                    .gallery-image-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

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
                            const imageLoading = isLoading(image.id);

                            return (
                                <div
                                    key={image.id}
                                    className={`gallery-image-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleImageClick(image.id)}
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
                                                    alt={image.name}
                                                    className="gallery-image-preview"
                                                    loading="lazy"
                                                    onLoad={(e) => {
                                                        e.target.style.opacity = '1';
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
                                                            {image.isTIFF ? '📄' : image.isSVG ? '🖼️' : '📷'}
                                                        </div>
                                                        <div className="gallery-placeholder-text">
                                                            {image.isTIFF ? 'TIFF' : image.isSVG ? 'SVG' : 'IMAGE'}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {(image.isTIFF || image.isSVG) && !imageLoading && (
                                            <div className="gallery-special-format-indicator">
                                                {image.isTIFF ? 'TIFF' : 'SVG'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="gallery-image-info">
                                        <span className="gallery-image-name">
                                            {image.name}
                                        </span>
                                        <span className="gallery-image-size">
                                            {formatFileSize(image.size)} • {image.originalFormat?.toUpperCase() || image.type.split('/')[1].toUpperCase()}
                                            {image.isTIFF && <span className="gallery-image-format-badge ml-xs">TIFF</span>}
                                            {image.isSVG && <span className="gallery-image-format-badge ml-xs">SVG</span>}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

export default UploadGallerySection;