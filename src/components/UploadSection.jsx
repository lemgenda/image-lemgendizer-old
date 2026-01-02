import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { handleImageDrop, handleFileSelect } from '../utils';
import '../styles/UploadSection.css';

function UploadSection({ onUpload, fileInputRef }) {
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
    )
}

export default UploadSection;