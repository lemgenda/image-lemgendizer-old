/**
 * @file ImageLemGendizer.tsx
 * @description Main image processing page for Image LemGendizer.
 * Contains the upload, gallery, processing tabs, modals, and loading overlays.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import FilterSelectionCard from '../components/FilterSelectionCard';
import { useProcessingContext } from '../context/ProcessingContext';
import { IMAGE_FILTERS } from '../constants';
import {
    PROCESSING_MODES,
    MODAL_TYPES
} from '../constants';
import {
    UploadSection,
    UploadGallerySection,
    CustomProcessingTab,
    TemplateProcessingTab,
    AdvancedRenameTab,
    TabPanel,
    ModalElement,
    TemplateImageSection
} from '../components';
import type { ProcessingMode } from '../types';
import {
    formatFileSize
} from '../utils';
import { generateNewFileName } from '../utils/renameUtils';

/**
 * ImageLemGendizer page component
 * @component
 * @returns {JSX.Element} The main image processing page
 */
function ImageLemGendizer() {
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

        handleScreenshotUrlChange,
        handleImageUpload,
        handleImageSelect,
        handleScreenshotTemplateToggle,
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
        handleOptionChange,
        handleSingleOptionChange,
        applyRenamePatternToCustom,
        processCustomImages,
        processTemplates,
        handleCaptureScreenshots,


        selectedImagesForProcessing,
        templateCategories,
        templateSelectedImageObj,
    } = useProcessingContext();


    return (
        <>
            <main className="app-main">
                <UploadSection
                    onImagesSelected={handleImageUpload}
                    fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                    isScreenshotMode={isScreenshotMode}
                />

                {images.length > 0 && (
                    <div className="processing-section animate-fade-in">
                        <div className="processing-modes-tabs mt-xl mb-lg">
                            <TabPanel
                                tabs={[
                                    { id: PROCESSING_MODES.CUSTOM, label: t('mode.custom'), description: t('mode.customInfo') },
                                    { id: PROCESSING_MODES.TEMPLATES, label: t('mode.templates'), description: t('mode.templatesInfo') },
                                    { id: PROCESSING_MODES.BATCH_RENAME, label: t('mode.batchRename'), description: t('mode.batchRenameInfo') }
                                ]}
                                activeTab={processingOptions.processingMode}
                                onTabChange={(id: string) => toggleProcessingMode(id as ProcessingMode)}
                            >
                                {null}
                            </TabPanel>
                        </div>

                        <div className="processing-layout-split">
                            <div className="processing-sidebar">
                                <div className="tab-content">
                                    {processingOptions.processingMode === PROCESSING_MODES.CUSTOM && (
                                        <CustomProcessingTab
                                            processingOptions={processingOptions}
                                            aiLoading={aiLoading}
                                            onOptionChange={handleOptionChange}
                                            onSingleOptionChange={handleSingleOptionChange}
                                            onToggleResizeCrop={toggleResizeCrop}
                                            onToggleCropMode={toggleCropMode}
                                            onFormatToggle={handleFormatToggle}
                                            onSelectAllFormats={handleSelectAllFormats}
                                            onClearAllFormats={handleClearAllFormats}
                                            processCustomImages={processCustomImages}
                                            isLoading={isLoading}
                                            selectedImagesCount={selectedImagesForProcessing.length}
                                            t={t}
                                        />
                                    )}

                                    {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && (
                                        <TemplateProcessingTab
                                            processingOptions={processingOptions}
                                            templateCategories={templateCategories}
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
                                            isFaviconSelected={isFaviconSelected}
                                            onFaviconToggle={handleFaviconToggle}
                                            onSingleOptionChange={handleSingleOptionChange}
                                            templateSelectedImageObj={templateSelectedImageObj}
                                            isLoading={isLoading}
                                            t={t}
                                        />
                                    )}


                                    {processingOptions.processingMode === PROCESSING_MODES.BATCH_RENAME && (
                                        <AdvancedRenameTab
                                            processingOptions={processingOptions}
                                            selectedImagesForProcessing={selectedImagesForProcessing}
                                            onOptionChange={handleOptionChange}
                                            onApplyToCustom={applyRenamePatternToCustom}
                                            isLoading={isLoading}
                                            processImages={processCustomImages}
                                            selectedImagesCount={selectedImagesForProcessing.length}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="processing-main" style={{ minWidth: 0, overflow: 'hidden' }}>
                                {processingOptions.processingMode === PROCESSING_MODES.CUSTOM && (
                                    <div className="mb-lg">
                                        <FilterSelectionCard
                                            selectedFilter={processingOptions.filters?.selectedFilter || IMAGE_FILTERS.NONE}
                                            onFilterChange={(filter: string) => handleOptionChange('filters', 'selectedFilter', filter)}
                                            t={t}
                                            disabled={!!processingOptions.colorCorrection?.enabled}
                                        />
                                    </div>
                                )}

                                {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && (
                                    <div className="mb-lg">
                                        <TemplateImageSection
                                            templateSelectedImageObj={templateSelectedImageObj || undefined}
                                            processingOptions={processingOptions}
                                            isFaviconSelected={isFaviconSelected}
                                            isScreenshotSelected={isScreenshotSelected}
                                            selectedScreenshotTemplates={selectedScreenshotTemplates}
                                            isLoading={isLoading}
                                            onProcessTemplates={processTemplates}
                                            formatFileSize={formatFileSize}
                                            t={t}
                                        />
                                    </div>
                                )}

                                {processingOptions.processingMode === PROCESSING_MODES.BATCH_RENAME && (
                                    <div className="mb-lg">
                                        <div className="card">
                                            <div className="card-header">
                                                <h4 className="card-title m-0 flex items-center">
                                                    <i className="fas fa-eye mr-2 text-primary"></i>
                                                    {t('rename.previewTitle')}
                                                </h4>
                                            </div>
                                            <div className="card-body">
                                                <div className="overflow-auto border rounded border-gray-100 dark:border-gray-800 rename-preview-list">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                                                            <tr>
                                                                <th className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 font-medium">{t('common.hashSymbol')}</th>
                                                                <th className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 font-medium">{t('rename.originalName')}</th>
                                                                <th className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 font-medium text-primary">{t('rename.newName')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedImagesForProcessing.length > 0 ? (
                                                                selectedImagesForProcessing.map((img, idx) => {
                                                                    const renameOpts = processingOptions.batchRename || { pattern: '{name}', find: '', replace: '', useRegex: false, casing: 'original', startSequence: 1, stepSequence: 1, zerosPadding: 3, dateFormat: 'YYYY-MM-DD' };
                                                                    return (
                                                                        <tr key={img.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                                            <td className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 text-muted">{idx + 1}</td>
                                                                            <td className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 truncate max-w-xs" title={img.name}>{img.name}</td>
                                                                            <td className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 font-medium text-primary">
                                                                                {generateNewFileName(img.name, idx, renameOpts, { width: img.originalWidth, height: img.originalHeight })}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan={3} className="px-3 py-8 text-center text-muted">{t('rename.noSelectedImages')}</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <p className="text-xs text-muted mt-3">{t('rename.previewInfo')}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-md no-outline" id="gallery-section" tabIndex={-1}>
                                    <UploadGallerySection
                                        images={images}
                                        selectedImages={selectedImages}
                                        processingMode={processingOptions.processingMode}
                                        templateSelectedImage={processingOptions.templateSelectedImage}
                                        onImageSelect={handleImageSelect}
                                        onRemoveSelected={handleRemoveSelected}
                                        onSelectAll={handleSelectAll}
                                        formatFileSize={formatFileSize}
                                        selectedFilter={processingOptions.filters?.selectedFilter}
                                        watermarkOptions={processingOptions.watermark}
                                        colorCorrectionOptions={processingOptions.colorCorrection}
                                    />
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </main>

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
                                style={{ '--modal-progress': `${modal.progress}%` } as React.CSSProperties}
                            ></div>
                        </div>
                        <div className="progress-text" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{modal.progressStep}</span>
                                <span>{modal.progress.toFixed(1)}%</span>
                            </div>
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

                                {(processingSummary.elapsedTime || 0) > 0 && (
                                    <div className="summary-item">
                                        <div className="summary-label">{t('summary.elapsedTime') || 'Processing Time'}:</div>
                                        <div className="summary-value font-bold text-primary">
                                            {(processingSummary.elapsedTime || 0).toFixed(1)}s
                                        </div>
                                    </div>
                                )}

                                <div className="summary-item full-width">
                                    <div className="summary-value-highlight">
                                        {t('summary.totalFiles', { count: processingSummary.totalFiles })}
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

                                {processingSummary.upscalingUsed && (
                                    <div className="summary-item">
                                        <div className="summary-label">{t('summary.upscalingUsed')}:</div>
                                        <div className="summary-value text-success">
                                            <i className="fas fa-expand-arrows-alt mr-1"></i>
                                            {processingSummary.upscaleScale
                                                ? `${t('summary.yes')} (x${processingSummary.upscaleScale}${processingSummary.upscaleModel ? ` - ${processingSummary.upscaleModel}` : ''
                                                })`
                                                : t('summary.yes')}
                                        </div>
                                    </div>
                                )}

                                {processingSummary.watermarkApplied && (
                                    <div className="summary-item">
                                        <div className="summary-label">{t('summary.watermarkApplied')}:</div>
                                        <div className="summary-value text-success">
                                            <i className="fas fa-copyright mr-1"></i> {t('summary.yes')}
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
                                        <li key={index}>{op}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {processingSummary.policyDosages && processingSummary.policyDosages.length > 0 && (
                            <div className="summary-section mt-md">
                                <h5 className="summary-subtitle">
                                    <i className="fas fa-microscope mr-2 text-primary"></i>
                                    {t('enhance.prescription') || 'AI Restoration Prescription'}:
                                </h5>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {processingSummary.policyDosages.map((dosage, index) => (
                                        <span key={index} className="badge bg-primary/10 text-primary border border-primary/20 text-xxs px-2 py-1 rounded">
                                            {dosage}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {processingSummary.enhancedImages && processingSummary.enhancedImages.length > 0 && (
                            <div className="summary-section mt-lg border-top pt-lg">
                                <h5 className="summary-subtitle text-primary">
                                    <i className="fas fa-magic mr-2"></i>
                                    {t('enhance.summary_title', 'Enhancement Summary')}:
                                </h5>
                                <p className="text-muted text-sm mb-2">{t('enhance.summary_desc', 'The following images were optimized using LemGendary AI:')}</p>
                                <div className="summary-enhance-list">
                                    {processingSummary.enhancedImages.map((img, idx) => (
                                        <div key={idx} className="summary-enhance-item p-2 border rounded mb-2 bg-light">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="font-weight-bold truncate text-sm">{img.name}</span>
                                                <span className="badge badge-info text-xs">
                                                    {t('enhance.quality')}: {img.enhanceMetadata?.nimaScore.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="d-flex flex-wrap gap-1">
                                                {img.enhanceMetadata?.opsApplied.map((op, opIdx) => (
                                                    <span key={opIdx} className="badge badge-secondary text-xxs px-1 py-0">
                                                        {op}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xxs text-muted font-italic mt-2">
                                    {t('enhance.summary_footer', 'All enhancements were applied iteratively based on real-time quality analysis.')}
                                </p>
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
        </>
    );
}

export default ImageLemGendizer;
