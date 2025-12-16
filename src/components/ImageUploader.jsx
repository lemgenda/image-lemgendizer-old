import { useCallback } from 'react'
import '../styles/App.css'

function ImageUploader({ onUpload, fileInputRef }) {
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
                    <h3>Drop images here or click to upload</h3>
                    <p>Supports JPG, PNG, WebP, GIF, SVG</p>
                    <p className="text-muted">
                        <i className="fas fa-shield-alt icon-sm icon-left"></i> All processing happens in your browser
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
                    <i className="fas fa-folder-open"></i> Select Images
                </button>
            </div>
        </div>
    )
}

export default ImageUploader