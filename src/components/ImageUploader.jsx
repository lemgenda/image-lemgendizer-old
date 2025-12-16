import { useCallback } from 'react'
import { useTranslation } from 'react-i18next';
import '../styles/App.css'

function ImageUploader({ onUpload, fileInputRef }) {
    const { t } = useTranslation();

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files).filter(file =>
            file.type.startsWith('image/') || file.type === 'image/svg+xml'
        )
        if (files.length > 0) {
            onUpload(files)
        }
    }, [onUpload])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
    }, [])

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files).filter(file =>
            file.type.startsWith('image/') || file.type === 'image/svg+xml'
        )
        onUpload(files)
    }

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
                accept="image/*,.svg,.svgz"
                onChange={handleFileSelect}
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

export default ImageUploader