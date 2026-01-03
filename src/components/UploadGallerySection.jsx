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
import '../styles/UploadGallerySection.css';

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
                        let height = img.naturalHeight || img.height || 200;

                        if (width > maxSize || height > maxSize) {
                            const ratio = Math.min(maxSize / width, maxSize / height);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob(
                            (previewBlob) => {
                                URL.revokeObjectURL(blobUrl);
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
    }, [createNewPreviewFromFile]);

    useEffect(() => {
        const generatePreviews = async () => {
            // We use a set to track what we are about to process in this run
            // to avoid processing the same image multiple times if effect re-runs quickly
            const currentRunProcessing = new Set();

            for (const image of images) {
                const imageId = image.id;

                // Check refs/state to see if we really need to check this one
                if (imagePreviews[imageId] || failedPreviews.has(imageId) || loadingPreviews.has(imageId)) continue;
                if (currentRunProcessing.has(imageId)) continue;

                currentRunProcessing.add(imageId);

                // Mark as loading immediately to prevent other effects picking it up
                setLoadingPreviews(prev => new Set(prev).add(imageId));

                try {
                    let previewUrl;

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

                    // Success - update state incrementally
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
                    // Preview generation failed
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
                    // Remove from loadingPreviews
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
                        const imageLoading = isLoading(image.id);

                        // Determine selection state label
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
                                                alt="" // Decorative since button has aria-label
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
                                                        {image.isTIFF ? 'TIFF' : image.isSVG ? 'SVG' : 'IMG'}
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
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default UploadGallerySection;