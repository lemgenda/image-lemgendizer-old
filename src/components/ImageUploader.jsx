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
        <div className="uploader-container">
            <div
                className="drop-zone"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: '2px dashed #475569',
                    borderRadius: '8px',
                    padding: '50px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#1e293b',
                    transition: 'all 0.2s ease',
                    marginBottom: '20px'
                }}
            >
                <div className="drop-zone-content">
                    <i className="fas fa-cloud-upload-alt fa-3x" style={{ color: '#3b82f6', marginBottom: '20px' }}></i>
                    <h3 style={{ color: '#e2e8f0', marginBottom: '10px' }}>Drop images here or click to upload</h3>
                    <p style={{ color: '#94a3b8', marginBottom: '5px' }}>Supports JPG, PNG, WebP, GIF, SVG</p>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        <i className="fas fa-shield-alt"></i> All processing happens in your browser
                    </p>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.svg,.svgz"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            <div style={{ textAlign: 'center' }}>
                <button
                    className="btn btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '12px 30px' }}
                >
                    <i className="fas fa-folder-open"></i> Select Images
                </button>
            </div>
        </div>
    )
}

export default ImageUploader