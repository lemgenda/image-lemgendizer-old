import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_INPUT_FORMATS, ERROR_MESSAGES } from '../constants/sharedConstants';

/**
 * Handles the drop event for drag-and-drop file upload
 * @param {DragEvent} e - Drag event
 * @param {Function} onUpload - Upload callback function
 */
export const handleImageDrop = (e, onUpload) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file =>
        SUPPORTED_INPUT_FORMATS.some(format =>
            file.type === format ||
            file.name.toLowerCase().endsWith(format.split('/')[1]?.split('+')[0])
        )
    );

    if (imageFiles.length > 0) {
        onUpload(imageFiles);
    } else if (onUpload) {
        onUpload([], ERROR_MESSAGES.INVALID_IMAGE_FILE);
    }
};

/**
 * Handles file selection from input
 * @param {Event} e - Change event
 * @param {Function} onUpload - Upload callback function
 */
export const handleFileSelect = (e, onUpload) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file =>
        SUPPORTED_INPUT_FORMATS.some(format =>
            file.type === format ||
            file.name.toLowerCase().endsWith(format.split('/')[1]?.split('+')[0])
        )
    );

    if (imageFiles.length > 0) {
        onUpload(imageFiles);
        e.target.value = '';
    } else if (onUpload) {
        onUpload([], ERROR_MESSAGES.INVALID_IMAGE_FILE);
    }
};

/**
 * A drag-and-drop and file selection component for uploading images.
 * @param {Object} props - Component props
 * @param {Function} props.onUpload - Upload callback function
 * @param {Object} props.fileInputRef - Reference to file input element
 * @returns {JSX.Element} ImageUploader component
 */
function ImageUploader({ onUpload, fileInputRef }) {
    const { t } = useTranslation();

    /**
     * Handles drop event
     */
    const handleDrop = useCallback((e) => {
        handleImageDrop(e, onUpload);
    }, [onUpload]);

    /**
     * Handles drag over event
     */
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);

    /**
     * Handles file input change event
     */
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
                    accept="image/*,.svg,.svgz,image/avif,image/tiff,image/bmp,image/x-icon,.tif,.tiff,.bmp,.ico"
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

export default ImageUploader;