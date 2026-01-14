/**
 * @file TemplateImageSection.tsx
 * @description UI section for displaying the selected image and processing statistics in template mode.
 */
import '../styles/TemplateImageSection.css';
import { calculateTotalTemplateFiles } from '../processors';
import { formatFileSize } from '../utils';
import { SOCIAL_MEDIA_TEMPLATES } from '../configs/templateConfigs';
import { FilteredPreview } from '.';
import type { ImageFile, ProcessingOptions } from '../types';

interface TemplateImageSectionProps {
  templateSelectedImageObj?: ImageFile;
  processingOptions: ProcessingOptions;
  isFaviconSelected: boolean;
  isScreenshotSelected: boolean;
  selectedScreenshotTemplates: string[];
  isLoading: boolean;
  onProcessTemplates: () => void;
  formatFileSize?: (size: number) => string;
  t: (key: string, params?: any) => string;
}

/**
 * TemplateImageSection component.
 * @component
 * @param {TemplateImageSectionProps} props - Component props.
 * @returns {JSX.Element} The rendered template image section.
 */
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
}: TemplateImageSectionProps) => {
  const formatFileSizeFn = formatFileSizeProp || formatFileSize;

  const totalFiles = calculateTotalTemplateFiles(
    processingOptions.selectedTemplates,
    SOCIAL_MEDIA_TEMPLATES,
    isFaviconSelected,
    isScreenshotSelected,
    selectedScreenshotTemplates.length,
    processingOptions.faviconMode
  );

  return (
    <>
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
                    <span className="template-image-section-detail-separator">{t('common.dotSeparator')}</span>
                    <span className="template-image-section-detail-separator">
                      {formatFileSizeFn(templateSelectedImageObj.size)}
                    </span>
                    <span className="template-image-section-detail-separator">{t('common.dotSeparator')}</span>
                    <span className="template-image-section-detail-separator">
                      {(templateSelectedImageObj as any).originalFormat?.toUpperCase() ||
                        templateSelectedImageObj.type.split('/')[1].toUpperCase()}
                      {(templateSelectedImageObj as any).isTIFF && (
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
          <div className="template-image-section-preview-container transparency-grid">
            {(templateSelectedImageObj as any).isTIFF ? (
              <div className="template-image-section-tiff-container transparency-grid">
                <FilteredPreview
                  src={(templateSelectedImageObj as any).url}
                  filter={processingOptions.filters?.selectedFilter || 'none'}
                  alt={templateSelectedImageObj.name}
                  className="template-image-section-tiff-img"
                />
                <div className="template-image-section-tiff-label">
                  <i className="fas fa-file-image"></i> TIFF
                </div>
              </div>
            ) : (
              <FilteredPreview
                src={(templateSelectedImageObj as any).url}
                filter={processingOptions.filters?.selectedFilter || 'none'}
                alt={templateSelectedImageObj.name}
                className="template-image-section-regular-img"
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
            <span className="template-image-section-stat-separator">{t('common.commaSeparator')}</span>
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
                <i className="fas fa-spinner fa-spin"></i> {t('button.processing')}
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
