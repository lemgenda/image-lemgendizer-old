import { useCallback } from 'react'
import { useTranslation } from 'react-i18next';
import { handleImageDrop, handleFileSelect } from '../utils/imageProcessor';
import '../styles/App.css'

/**
 * A drag-and-drop and file selection component for uploading images.
 */
function ImageUploader({ onUpload, fileInputRef }) {
    const { t } = useTranslation();

    const handleDrop = useCallback((e) => {
        handleImageDrop(e, onUpload);
    }, [onUpload]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);

    const handleFileChange = (e) => {
        handleFileSelect(e, onUpload);
    };

    return (
        <>
            <style>{`
                .upload-section {
                    margin-bottom: var(--space-xl);
                }

                .drop-zone {
                    border: 2px dashed var(--border-color);
                    border-radius: var(--radius-md);
                    padding: var(--space-xxl) var(--space-xl);
                    text-align: center;
                    cursor: pointer;
                    background-color: var(--color-bg-secondary);
                    transition: all var(--transition-normal);
                }

                .drop-zone:hover {
                    border-color: var(--color-primary);
                    background-color: rgba(59, 130, 246, 0.05);
                }

                .drop-zone-content i {
                    color: var(--color-primary);
                    font-size: 3rem;
                    margin-bottom: var(--space-lg);
                }

                .drop-zone-content h3 {
                    color: var(--color-text-primary);
                    margin-bottom: var(--space-sm);
                    font-size: 1.3rem;
                }

                .drop-zone-content p {
                    color: var(--color-text-muted);
                    margin-bottom: var(--space-xs);
                    font-size: 0.875rem;
                }

                .upload-limits {
                    margin-top: var(--space-md);
                    padding-top: var(--space-sm);
                    border-top: 1px solid var(--border-color);
                }

                .hidden {
                    display: none;
                }

                .mt-md {
                    margin-top: var(--space-md);
                }
            `}</style>

            <div className="upload-section">
                <div
                    className="drop-zone"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="drop-zone-content">
                        <i className="fas fa-cloud-upload-alt fa-3x"></i>
                        <h3>{t('upload.dropZone.title')}</h3>
                        <p>{t('upload.dropZone.supported')}</p>
                        <p className="text-muted">
                            <i className="fas fa-shield-alt icon-sm icon-left"></i> {t('upload.dropZone.processing')}
                        </p>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.svg,.svgz"
                    onChange={handleFileChange}
                    className="hidden"
                />

                <div className="text-center mt-md">
                    <button
                        className="btn btn-primary"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <i className="fas fa-folder-open"></i> {t('upload.selectImages')}
                    </button>
                </div>
            </div>
        </>
    )
}

export default ImageUploader