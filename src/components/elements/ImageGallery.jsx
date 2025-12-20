import { useState } from 'react';
import UploadGalleryCard from './UploadGalleryCard';
import { Card, Button, Modal, Input } from '../common';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faEye, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import '../../styles/elements/ImageGallery.css';

function ImageGallery({ images, onSelect, onClear, t }) {
    const [previewImage, setPreviewImage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredImages = images.filter(image =>
        image.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRemove = (imageId) => {
        // Deselect if selected
        if (images.find(img => img.id === imageId)?.selected) {
            onSelect(imageId);
        }
        // In real app, you'd remove from images array
    };

    return (
        <div className="image-gallery">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div style={{ maxWidth: '300px' }}>
                    <Input
                        type="text"
                        placeholder={t('processor.searchImages')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        size="small"
                    />
                </div>

                {images.length > 0 && (
                    <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={onClear}
                        icon={<FontAwesomeIcon icon={faTrash} />}
                    >
                        {t('processor.clearAll')}
                    </Button>
                )}
            </div>

            {filteredImages.length === 0 ? (
                <div className="text-center py-4">
                    {searchTerm ? (
                        <p className="text-muted">{t('processor.noImagesFound')}</p>
                    ) : (
                        <p className="text-muted">{t('processor.noImagesUploaded')}</p>
                    )}
                </div>
            ) : (
                <div className="gallery-grid">
                    {filteredImages.map(image => (
                        <UploadGalleryCard
                            key={image.id}
                            image={image}
                            selected={image.selected}
                            onSelect={onSelect}
                            onRemove={handleRemove}
                            onPreview={setPreviewImage}
                            t={t}
                        />
                    ))}
                </div>
            )}

            <Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                title={previewImage?.name}
                actions={
                    <Button variant="secondary" onClick={() => setPreviewImage(null)}>
                        {t('processor.close')}
                    </Button>
                }
            >
                {previewImage && (
                    <div className="text-center">
                        <img
                            src={URL.createObjectURL(previewImage.file)}
                            alt={previewImage.name}
                            className="img-fluid rounded mb-3"
                            style={{ maxHeight: '400px', maxWidth: '100%' }}
                        />
                        <div className="row text-start">
                            <div className="col-md-6">
                                <p><strong>{t('processor.name')}:</strong> {previewImage.name}</p>
                                <p><strong>{t('processor.dimensions')}:</strong> {previewImage.dimensions?.width} × {previewImage.dimensions?.height}px</p>
                            </div>
                            <div className="col-md-6">
                                <p><strong>{t('processor.size')}:</strong> {(previewImage.file.size / 1024).toFixed(1)} KB</p>
                                <p><strong>{t('processor.type')}:</strong> {previewImage.file.type}</p>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default ImageGallery;