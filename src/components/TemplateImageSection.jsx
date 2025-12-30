import {
    calculateTotalTemplateFiles
} from '../processors';

import {
  formatFileSize
} from '../utils';

import {
    SOCIAL_MEDIA_TEMPLATES
} from '../configs/templateConfigs';

const TemplateImageSection = ({
    templateSelectedImageObj,
    processingOptions,
    isFaviconSelected,
    isScreenshotSelected,
    selectedScreenshotTemplates,
    isLoading,
    onProcessTemplates,
    formatFileSize: formatFileSizeProp,
    t
}) => {
    // Use the passed formatFileSize function or the imported one
    const formatFileSizeFn = formatFileSizeProp || formatFileSize;

    // Calculate total files to generate
    const totalFiles = calculateTotalTemplateFiles(
        processingOptions.selectedTemplates,
        SOCIAL_MEDIA_TEMPLATES,
        isFaviconSelected,
        isScreenshotSelected,
        selectedScreenshotTemplates.length
    );

    return (
        <>
            <style>{`
        .template-image-section-card {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          padding: var(--space-lg);
          margin-bottom: var(--space-lg);
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition-fast);
        }

        .template-image-section-card:hover {
          box-shadow: var(--shadow-md);
        }

        .template-image-section-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
          padding-bottom: var(--space-sm);
          border-bottom: 1px solid var(--border-color);
        }

        .template-image-section-card-title {
          color: var(--color-text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .template-image-section-card-title i {
          color: var(--color-primary);
        }

        .template-image-section-card-header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          width: 100%;
        }

        .template-image-section-card-header-left {
          flex: 1;
        }

        .template-image-section-card-header-title {
          color: var(--color-text-primary);
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .template-image-section-info-container {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .template-image-section-name-truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 20rem;
        }

        .template-image-section-detail-separator {
          flex-shrink: 0;
        }

        .template-image-section-tiff-badge {
          margin-left: 0.25rem;
          padding: 0.125rem 0.375rem;
          background-color: rgba(249, 115, 22, 0.1);
          color: rgb(249, 115, 22);
          font-size: 0.75rem;
          border-radius: var(--radius-sm);
        }

        .template-image-section-preview-container {
          position: relative;
          width: 100%;
          border-radius: var(--radius-lg);
          overflow: hidden;
          background-color: var(--color-bg-tertiary);
          margin-top: 1rem;
        }

        .template-image-section-tiff-container {
          position: relative;
          width: 100%;
          height: 24rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
        }

        .template-image-section-tiff-img {
          width: 100%;
          height: auto;
          object-fit: contain;
          max-height: 100%;
        }

        .template-image-section-tiff-label {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          background-color: var(--color-primary);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .template-image-section-regular-img {
          width: 100%;
          height: auto;
          object-fit: contain;
          max-height: 24rem;
        }

        .template-image-section-preview-border {
          position: absolute;
          inset: 0;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          pointer-events: none;
        }

        .template-image-section-stats-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }

        .template-image-section-stats {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .template-image-section-stat-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .template-image-section-stat-icon {
          font-size: 0.75rem;
        }

        .template-image-section-stat-separator {
          color: var(--color-text-muted);
        }

        .template-image-section-button-container {
          text-align: center;
          margin-top: 1.5rem;
        }

        .template-image-section-download-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
          padding: var(--space-md) var(--space-lg);
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          background-color: var(--color-primary);
          color: white;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          min-height: 3rem;
        }

        .template-image-section-download-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .template-image-section-download-btn:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
        }

        .template-image-section-count-badge {
          position: absolute;
          top: 50%;
          right: 0.5rem;
          transform: translateY(-50%);
          background-color: var(--color-danger);
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 9999px;
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .template-image-section-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .template-image-section-name-truncate {
            max-width: 12rem;
          }

          .template-image-section-info-container {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .template-image-section-stats {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .template-image-section-stat-separator {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .template-image-section-name-truncate {
            max-width: 8rem;
          }

          .template-image-section-tiff-container {
            height: 18rem;
          }

          .template-image-section-regular-img {
            max-height: 18rem;
          }

          .template-image-section-download-btn {
            padding: var(--space-sm) var(--space-md);
            font-size: 0.875rem;
          }
        }
      `}</style>

            <div className="template-image-section-card">
                <div className="template-image-section-card-header">
                    <div className="template-image-section-card-header-content">
                        <div className="template-image-section-card-header-left">
                            <h4 className="template-image-section-card-header-title">
                                {t('templates.imageForTemplates')}
                            </h4>
                            <div className="template-image-section-info-container">
                                <span className="template-image-section-name-truncate">
                                    {templateSelectedImageObj
                                        ? templateSelectedImageObj.name
                                        : t('templates.noImageSelected')
                                    }
                                </span>
                                {templateSelectedImageObj && (
                                    <>
                                        <span className="template-image-section-detail-separator">&nbsp;•&nbsp;</span>
                                        <span className="template-image-section-detail-separator">
                                            {formatFileSizeFn(templateSelectedImageObj.size)}
                                        </span>
                                        <span className="template-image-section-detail-separator">&nbsp;•&nbsp;</span>
                                        <span className="template-image-section-detail-separator">
                                            {templateSelectedImageObj.originalFormat?.toUpperCase() ||
                                                templateSelectedImageObj.type.split('/')[1].toUpperCase()}
                                            {templateSelectedImageObj.isTIFF && (
                                                <span className="template-image-section-tiff-badge">
                                                    TIFF
                                                </span>
                                            )}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {templateSelectedImageObj && (
                    <div className="template-image-section-preview-container">
                        {templateSelectedImageObj.isTIFF ? (
                            <div className="template-image-section-tiff-container">
                                <img
                                    alt={templateSelectedImageObj.name}
                                    className="template-image-section-tiff-img"
                                    src={templateSelectedImageObj.url}
                                />
                                <div className="template-image-section-tiff-label">
                                    <i className="fas fa-file-image"></i> TIFF
                                </div>
                            </div>
                        ) : (
                            <img
                                alt={templateSelectedImageObj.name}
                                className="template-image-section-regular-img"
                                src={templateSelectedImageObj.url}
                            />
                        )}
                        <div className="template-image-section-preview-border"></div>
                    </div>
                )}

                <div className="template-image-section-stats-container">
                    <div className="template-image-section-stats">
                        <div className="template-image-section-stat-item">
                            <i className="fas fa-layer-group template-image-section-stat-icon"></i>
                            <span>
                                {t('button.templateCount', { count: processingOptions.selectedTemplates.length })} {t('templates.selected')}
                            </span>
                        </div>
                        <span className="template-image-section-stat-separator">,&nbsp;</span>
                        <div className="template-image-section-stat-item">
                            <span>
                                {processingOptions.selectedTemplates.length > 0 || isFaviconSelected || isScreenshotSelected
                                    ? `${totalFiles} ${t('templates.filesToGenerate')}`
                                    : t('templates.selectTemplates')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="template-image-section-button-container">
                    <button
                        className="template-image-section-download-btn"
                        disabled={!processingOptions.templateSelectedImage ||
                            (processingOptions.selectedTemplates.length === 0 && !isFaviconSelected && !isScreenshotSelected) ||
                            isLoading}
                        onClick={onProcessTemplates}
                    >
                        {isLoading ? (
                            <>
                                <i className="fas fa-spinner template-image-section-spinner"></i> {t('button.processing')}
                            </>
                        ) : (
                            <>
                                <i className="fas fa-file-archive"></i> {t('templates.download')}
                                {(processingOptions.selectedTemplates.length > 0 || isFaviconSelected || isScreenshotSelected) && (
                                    <span className="template-image-section-count-badge">
                                        {totalFiles}
                                    </span>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export default TemplateImageSection;