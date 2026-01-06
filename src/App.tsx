import React from 'react';
import { useTranslation } from 'react-i18next';
import { useProcessingContext } from './context/ProcessingContext';
import {
  PROCESSING_MODES,
  MODAL_TYPES
} from './constants';
import {
  UploadSection,
  HeaderSection,
  FooterSection,
  ModalElement,
  UploadGallerySection,
  CustomProcessingTab,
  TemplateProcessingTab,
  AdvancedRenameTab,
  TabPanel,
  ErrorBoundary
} from './components';
import type { ProcessingOptions, ProcessingMode } from './types';
import {
  formatFileSize
} from './utils';
import './styles/App.css';
import './styles/TabPanel.css';

/**
 * Main application component
 * @component
 * @returns {JSX.Element} App component
 */
function App() {
  const { t } = useTranslation();
  const {
    isScreenshotMode,
    isFaviconSelected,
    isScreenshotSelected,
    screenshotUrl,
    isCapturingScreenshots,
    captureProgress,
    screenshotValidation,
    selectedScreenshotTemplates,
    images,
    selectedImages,
    modal,
    isLoading,
    aiModelLoaded,
    aiLoading,
    processingSummary,
    processingOptions,
    fileInputRef,
    closeModal,
    handleModalInteraction,

    // Handlers
    handleScreenshotUrlChange,
    handleImageUpload,
    handleImageSelect,
    handleScreenshotTemplateToggle,
    handleSelectAllScreenshotTemplates,
    handleDeselectAllScreenshotTemplates,
    handleSelectAll,
    handleRemoveSelected,
    handleFaviconToggle,
    handleScreenshotToggle,
    toggleResizeCrop,
    toggleCropMode,
    handleFormatToggle,
    handleSelectAllFormats,
    handleClearAllFormats,
    toggleProcessingMode,
    getTranslatedTemplateName,
    handleTemplateToggle,
    handleSelectAllTemplates,
    handleSelectAllInCategory,
    handleDeselectAllInCategory,
    handleOptionChange,
    handleSingleOptionChange,
    applyRenamePatternToCustom,
    processCustomImages,
    processTemplates,
    handleCaptureScreenshots,

    // Derived
    selectedImagesForProcessing,
    templateCategories,
    templateSelectedImageObj,
    setProcessingOptions
  } = useProcessingContext();

  return (
    <ErrorBoundary t={t}>
      <div className="app-container">
        <HeaderSection />

        <main className="app-main">
          <UploadSection
            onImagesSelected={handleImageUpload}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            isScreenshotMode={isScreenshotMode}
          />

          {images.length > 0 && (
            <div className="processing-section animate-fade-in">

              <div className="processing-modes-tabs mt-xl">
                <TabPanel
                  tabs={[
                    { id: PROCESSING_MODES.CUSTOM, label: t('mode.custom'), description: t('mode.customInfo') },
                    { id: PROCESSING_MODES.TEMPLATES, label: t('mode.templates'), description: t('mode.templatesInfo') },
                    { id: PROCESSING_MODES.BATCH_RENAME, label: t('mode.batchRename') || 'Batch Rename', description: t('mode.batchRenameInfo') || 'Advanced file renaming' }
                  ]}
                  activeTab={processingOptions.processingMode}
                  onTabChange={(id: string) => toggleProcessingMode(id as ProcessingMode)}
                >
                  {null}
                </TabPanel>

                <div className="tab-content mt-lg">
                  {processingOptions.processingMode === PROCESSING_MODES.CUSTOM && (
                    <CustomProcessingTab
                      processingOptions={processingOptions}
                      isLoading={isLoading}
                      aiLoading={aiLoading}
                      selectedImagesForProcessing={selectedImagesForProcessing}
                      onOptionChange={handleOptionChange}
                      onSingleOptionChange={handleSingleOptionChange}
                      onToggleResizeCrop={toggleResizeCrop}
                      onToggleCropMode={toggleCropMode}
                      onProcess={processCustomImages}
                      onFormatToggle={handleFormatToggle}
                      onSelectAllFormats={handleSelectAllFormats}
                      onClearAllFormats={handleClearAllFormats}
                      t={t}
                    />
                  )}

                  {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && (
                    <TemplateProcessingTab
                      processingOptions={processingOptions}
                      templateCategories={templateCategories}
                      onSelectAllTemplates={handleSelectAllTemplates}
                      onClearAllTemplates={() => setProcessingOptions((prev: ProcessingOptions) => ({ ...prev, selectedTemplates: [] as string[] }))}
                      onSelectAllInCategory={handleSelectAllInCategory}
                      onDeselectAllInCategory={handleDeselectAllInCategory}
                      onTemplateToggle={handleTemplateToggle}
                      getTranslatedTemplateName={getTranslatedTemplateName}
                      isScreenshotSelected={isScreenshotSelected}
                      onScreenshotToggle={handleScreenshotToggle}
                      screenshotUrl={screenshotUrl}
                      onScreenshotUrlChange={handleScreenshotUrlChange}
                      screenshotValidation={screenshotValidation}
                      isCapturingScreenshots={isCapturingScreenshots}
                      captureProgress={captureProgress}
                      onCaptureScreenshots={handleCaptureScreenshots}
                      selectedScreenshotTemplates={selectedScreenshotTemplates}
                      onScreenshotTemplateToggle={handleScreenshotTemplateToggle}
                      onSelectAllScreenshotTemplates={handleSelectAllScreenshotTemplates}
                      onDeselectAllScreenshotTemplates={handleDeselectAllScreenshotTemplates}
                      isFaviconSelected={isFaviconSelected}
                      onFaviconToggle={handleFaviconToggle}
                      onSingleOptionChange={handleSingleOptionChange}
                      templateSelectedImageObj={templateSelectedImageObj || undefined}
                      isLoading={isLoading}
                      onProcessTemplates={processTemplates}
                      formatFileSize={formatFileSize}
                      t={t}
                    />
                  )}

                  {processingOptions.processingMode === PROCESSING_MODES.BATCH_RENAME && (
                    <AdvancedRenameTab
                      processingOptions={processingOptions}
                      selectedImagesForProcessing={selectedImagesForProcessing}
                      onOptionChange={handleOptionChange}
                      onApplyToCustom={applyRenamePatternToCustom}
                      onProcess={processCustomImages}
                      isLoading={isLoading}
                    />
                  )}
                </div>
              </div>

              <div className="mt-xl">
                <UploadGallerySection
                  images={images}
                  selectedImages={selectedImages}
                  processingMode={processingOptions.processingMode}
                  templateSelectedImage={processingOptions.templateSelectedImage}
                  onImageSelect={handleImageSelect}
                  onRemoveSelected={handleRemoveSelected}
                  onSelectAll={handleSelectAll}
                  formatFileSize={formatFileSize}
                />
              </div>
            </div>
          )}
        </main>

        <FooterSection />

        <ModalElement
          isOpen={modal.isOpen}
          onClose={closeModal}
          title={modal.title}
          type={modal.type}
          onInteraction={handleModalInteraction}
        >
          <p>{modal.message}</p>
          {modal.showProgress && modal.progress < 100 && (
            <div className="mt-3">
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${modal.progress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                <span>{modal.progressStep}</span>
                <span>{modal.progress}%</span>
              </div>
            </div>
          )}
        </ModalElement>

        <ModalElement
          isOpen={modal.isOpen && modal.type === MODAL_TYPES.SUMMARY}
          onClose={closeModal}
          title={modal.title}
          type={MODAL_TYPES.SUMMARY}
          onInteraction={handleModalInteraction}
          actions={
            <button
              className="btn btn-primary"
              onClick={closeModal}
              onMouseDown={handleModalInteraction}
            >
              {t('button.ok')}
            </button>
          }
        >
          {processingSummary && (
            <div className="summary-content">
              <div className="summary-section">
                <h4 className="summary-title">
                  <i className="fas fa-check-circle text-success mr-2"></i>
                  {t('summary.processingComplete')}
                </h4>

                <div className="summary-grid">
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.mode')}:</div>
                    <div className="summary-value capitalize">{processingSummary.mode}</div>
                  </div>

                  {processingSummary.mode === 'templates' && processingSummary.templatesApplied > 0 && (
                    <div className="summary-item">
                      <div className="summary-label">{t('summary.templatesApplied')}:</div>
                      <div className="summary-value">
                        {processingSummary.templatesApplied}
                      </div>
                    </div>
                  )}

                  {processingSummary.mode === 'templates' && processingSummary.categoriesApplied > 0 && (
                    <div className="summary-item">
                      <div className="summary-label">{t('summary.categoriesApplied')}:</div>
                      <div className="summary-value">{processingSummary.categoriesApplied}</div>
                    </div>
                  )}

                  {(processingSummary.screenshotCount || 0) > 0 && (
                    <div className="summary-item">
                      <div className="summary-label">{t('summary.screenshotCount')}:</div>
                      <div className="summary-value text-success">
                        <i className="fas fa-camera mr-1"></i>
                        {processingSummary.screenshotCount || 0}
                      </div>
                    </div>
                  )}

                  {processingSummary.mode === 'templates' && (
                    <div className="summary-item">
                      <div className="summary-label">{t('summary.formatsExported')}:</div>
                      <div className="summary-value">
                        {processingSummary.formatsExported && processingSummary.formatsExported.length > 0
                          ? processingSummary.formatsExported.map(format => (
                            <span key={format} className="format-badge">
                              {format.toUpperCase()}
                            </span>
                          ))
                          : 'WEBP, PNG, JPG, ICO'}
                      </div>
                    </div>
                  )}

                  <div className="summary-item">
                    <div className="summary-label">{t('summary.totalFiles')}:</div>
                    <div className="summary-value">
                      {processingSummary.totalFiles}
                    </div>
                  </div>

                  <div className="summary-item">
                    <div className="summary-label">{t('summary.aiUsed')}:</div>
                    <div className="summary-value">
                      {processingSummary.aiUsed ? (
                        <span className="text-success">
                          <i className="fas fa-brain mr-1"></i> {t('summary.yes')}
                        </span>
                      ) : (
                        <span className="text-muted">{t('summary.no')}</span>
                      )}
                    </div>
                  </div>

                  {(processingSummary.aiSmartCroppedCount ?? 0) > 0 && (
                    <div className="summary-item">
                      <div className="summary-label">{t('summary.aiSmartCropped')}:</div>
                      <div className="summary-value text-success">
                        <i className="fas fa-magic mr-1"></i> {t('summary.aiSmartCropped', { count: processingSummary.aiSmartCroppedCount })}
                      </div>
                    </div>
                  )}

                  {(processingSummary.aiUpscaledCount ?? 0) > 0 && (
                    <div className="summary-item">
                      <div className="summary-label">{t('summary.aiUpscaled')}:</div>
                      <div className="summary-value text-success">
                        <i className="fas fa-expand-arrows-alt mr-1"></i> {t('summary.aiUpscaled', { count: processingSummary.aiUpscaledCount })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {processingSummary.operations && processingSummary.operations.length > 0 && (
                <div className="summary-section">
                  <h5 className="summary-subtitle">
                    <i className="fas fa-tasks mr-2"></i>
                    {t('summary.operationsPerformed')}:
                  </h5>
                  <ul className="summary-list">
                    {processingSummary.operations.map((op, index) => (
                      <li key={index} className="summary-list-item">
                        <i className="fas fa-check text-success mr-2"></i>
                        {op}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ModalElement>

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              {isScreenshotSelected ? (
                <>
                  <i className="fas fa-camera fa-spin fa-3x"></i>
                  <p>{t('loading.capturingScreenshots')}</p>
                  <p className="text-muted text-sm mt-2">
                    {t('loading.screenshotProcess')}
                  </p>
                </>
              ) : (
                <>
                  <i className="fas fa-spinner fa-spin fa-3x"></i>
                  <p>{t('loading.preparing')}</p>
                  <p className="text-muted text-sm mt-2">
                    {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && aiModelLoaded
                      ? t('loading.aiCropping')
                      : t('loading.upscalingWhenNeeded')}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {aiLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <i className="fas fa-brain fa-spin fa-3x"></i>
              <p>{t('loading.aiModel')}</p>
              <p className="text-muted">{t('loading.oncePerSession')}</p>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
