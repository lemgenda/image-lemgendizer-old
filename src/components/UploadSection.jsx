import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
    SUPPORTED_INPUT_FORMATS,
    ERROR_MESSAGES,
    SPACING,
    BORDER_RADIUS,
    TRANSITIONS
} from '../constants';

import {
     handleImageDrop,
     handleFileSelect
} from '../utils';

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
        <>
            <style>{`
                .upload-section {
                    margin-bottom: ${SPACING.XL};
                }

                .drop-zone {
                    border: 2px dashed var(--border-color);
                    border-radius: ${BORDER_RADIUS.MD};
                    padding: ${SPACING.XXL} ${SPACING.XL};
                    text-align: center;
                    cursor: pointer;
                    background-color: var(--color-bg-secondary);
                    transition: all ${TRANSITIONS.NORMAL};
                }

                .drop-zone:hover {
                    border-color: var(--color-primary);
                    background-color: rgba(59, 130, 246, 0.05);
                }

                .drop-zone-content i {
                    color: var(--color-primary);
                    font-size: 3rem;
                    margin-bottom: ${SPACING.LG};
                }

                .drop-zone-content h3 {
                    color: var(--color-text-primary);
                    margin-bottom: ${SPACING.SM};
                    font-size: 1.3rem;
                }

                .drop-zone-content p {
                    color: var(--color-text-muted);
                    margin-bottom: ${SPACING.XS};
                    font-size: 0.875rem;
                }

                .upload-limits {
                    margin-top: ${SPACING.MD};
                    padding-top: ${SPACING.SM};
                    border-top: 1px solid var(--border-color);
                }

                .hidden {
                    display: none;
                }

                .mt-md {
                    margin-top: ${SPACING.MD};
                }

                p.text-muted > i {
                    font-size: 1rem;
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

export default UploadSection;