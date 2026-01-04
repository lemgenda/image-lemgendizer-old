import React from 'react';
import PropTypes from 'prop-types';
import { ScreenShotsCard, TemplateImageSection } from './index';
import { SOCIAL_MEDIA_TEMPLATES } from '../configs/templateConfigs';

/**
 * @fileoverview Template selection card component for choosing social media and other templates.
 * Provides a grid of templates categorized by platform, with special sections for screenshots and favicons.
 */

/**
 * TemplateSelectionCard - Component for selecting templates
 * @param {Object} props - Component props
 * @param {Object} props.processingOptions - Current processing options
 * @param {Array} props.templateCategories - List of template categories
 * @param {Function} props.onSelectAllTemplates - Handler for selecting all templates
 * @param {Function} props.onClearAllTemplates - Handler for clearing all templates
 * @param {Function} props.onSelectAllInCategory - Handler for selecting category
 * @param {Function} props.onDeselectAllInCategory - Handler for deselecting category
 * @param {Function} props.onTemplateToggle - Handler for template toggle
 * @param {Function} props.getTranslatedTemplateName - Helper for name translation
 * @param {boolean} props.isScreenshotSelected - Whether screenshots are enabled
 * @param {Function} props.onScreenshotToggle - Handler for screenshot toggle
 * @param {string} props.screenshotUrl - Current screenshot URL
 * @param {Function} props.onScreenshotUrlChange - Handler for URL change
 * @param {Object} props.screenshotValidation - URL validation result
 * @param {boolean} props.isCapturingScreenshots - Capture state
 * @param {number} props.captureProgress - Capture progress percentage
 * @param {Function} props.onCaptureScreenshots - Handler for capture action
 * @param {Array} props.selectedScreenshotTemplates - Selected screenshot template IDs
 * @param {Function} props.onScreenshotTemplateToggle - Handler for screenshot template toggle
 * @param {Function} props.onSelectAllScreenshotTemplates - Handler for select all screenshots
 * @param {Function} props.onDeselectAllScreenshotTemplates - Handler for deselect all screenshots
 * @param {boolean} props.isFaviconSelected - Whether favicons are enabled
 * @param {Function} props.onFaviconToggle - Handler for favicon toggle
 * @param {Function} props.onSingleOptionChange - Handler for mode changes (faviconMode etc)
 * @param {Object} props.templateSelectedImageObj - Currently selected image object for templates
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onProcessTemplates - Handler for final processing
 * @param {Function} props.formatFileSize - Formatter helper
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Template selection card
 */
const TemplateSelectionCard = ({
    processingOptions,
    templateCategories,
    onSelectAllTemplates,
    onClearAllTemplates,
    onSelectAllInCategory,
    onDeselectAllInCategory,
    onTemplateToggle,
    getTranslatedTemplateName,
    isScreenshotSelected,
    onScreenshotToggle,
    screenshotUrl,
    onScreenshotUrlChange,
    screenshotValidation,
    isCapturingScreenshots,
    captureProgress,
    onCaptureScreenshots,
    selectedScreenshotTemplates,
    onScreenshotTemplateToggle,
    onSelectAllScreenshotTemplates,
    onDeselectAllScreenshotTemplates,
    isFaviconSelected,
    onFaviconToggle,
    onSingleOptionChange,
    templateSelectedImageObj,
    isLoading,
    onProcessTemplates,
    formatFileSize,
    t
}) => {
    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <h3 className="card-title">
                        <i className="fas fa-th-large"></i> {t('templates.title')}
                    </h3>
                    <p className="text-muted mt-xs">
                        <i className="fas fa-info-circle"></i>
                        {t('templates.note')}
                    </p>
                </div>
                <div className="card-actions">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onSelectAllTemplates}
                        disabled={!processingOptions.templateSelectedImage}
                    >
                        <i className="fas fa-check-square"></i> {t('templates.selectAll')}
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onClearAllTemplates}
                        disabled={processingOptions.selectedTemplates.length === 0}
                    >
                        <i className="fas fa-times-circle"></i> {t('templates.clearAll')}
                    </button>
                </div>
            </div>

            <div className="templates-grid mb-lg">
                {templateCategories.map((category) => {
                    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES.filter(template =>
                        template.category === category.id
                    );

                    return (
                        <div key={category.id} className="card">
                            <div className="card-header">
                                <h4 className="card-title">
                                    <i className={`${category.icon} mr-sm`}></i> {t(`category.${category.id}`)}
                                </h4>
                                {category.id !== 'screenshots' && (
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => onSelectAllInCategory(category.id)}
                                            disabled={!processingOptions.templateSelectedImage}
                                        >
                                            <i className="fas fa-check"></i> {t('templates.selectCategory')}
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => onDeselectAllInCategory(category.id)}
                                            disabled={!processingOptions.templateSelectedImage}
                                        >
                                            <i className="fas fa-times"></i> {t('templates.deselectCategory')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-sm">
                                {categoryTemplates.map(template => (
                                    <label key={template.id} className="checkbox-wrapper" htmlFor={`template-${template.id}`} aria-label={template.name}>
                                        <input
                                            id={`template-${template.id}`}
                                            type="checkbox"
                                            className="checkbox-input"
                                            checked={processingOptions.selectedTemplates.includes(template.id)}
                                            onChange={() => onTemplateToggle(template.id)}
                                            disabled={!processingOptions.templateSelectedImage}
                                        />
                                        <span className="checkbox-custom"></span>
                                        <span className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{getTranslatedTemplateName(template.name, t)}</span>
                                                <span className="text-muted text-sm">
                                                    {template.width}×{template.height === 'auto' ? 'auto' : template.height}
                                                </span>
                                            </div>
                                        </span>
                                    </label>
                                ))}

                                {category.id === 'screenshots' && (
                                    <div className="screenshot-section">
                                        <ScreenShotsCard
                                            isSelected={isScreenshotSelected}
                                            onToggle={onScreenshotToggle}
                                            screenshotUrl={screenshotUrl}
                                            onUrlChange={onScreenshotUrlChange}
                                            validation={screenshotValidation}
                                            isCapturing={isCapturingScreenshots}
                                            captureProgress={captureProgress}
                                            onCaptureClick={onCaptureScreenshots}
                                            selectedTemplates={selectedScreenshotTemplates}
                                            onTemplateToggle={onScreenshotTemplateToggle}
                                            onSelectAllTemplates={onSelectAllScreenshotTemplates}
                                            onDeselectAllTemplates={onDeselectAllScreenshotTemplates}
                                            showTemplateActions={false}
                                        />
                                    </div>
                                )}

                                {category.id === 'favicon' && (
                                    <div className="flex flex-col">
                                        <label
                                            className="checkbox-wrapper"
                                            htmlFor="favicon-toggle"
                                            aria-label="Toggle Favicon Generation"
                                        >
                                            <input
                                                id="favicon-toggle"
                                                type="checkbox"
                                                className="checkbox-input"
                                                checked={isFaviconSelected}
                                                onChange={(e) => onFaviconToggle(e.target.checked)}
                                                disabled={!processingOptions.templateSelectedImage}
                                            />
                                            <span className="checkbox-custom"></span>
                                            <span className="flex-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">{t('templates.faviconSet')}</span>
                                                    <span className="text-muted text-sm">{t('templates.multipleSizes')}</span>
                                                </div>
                                            </span>
                                        </label>

                                        {isFaviconSelected && (
                                            <div className="mt-2 pl-8 space-y-2">
                                                <label
                                                    className="checkbox-wrapper"
                                                    htmlFor="favicon-basic"
                                                >
                                                    <input
                                                        id="favicon-basic"
                                                        type="radio"
                                                        name="faviconMode"
                                                        className="checkbox-input"
                                                        checked={processingOptions.faviconMode === 'basic'}
                                                        onChange={() => onSingleOptionChange('faviconMode', 'basic')}
                                                    />
                                                    <span className="checkbox-custom"></span>
                                                    <span className="flex-1 text-sm">{t('templates.basicSet')}</span>
                                                </label>

                                                <label
                                                    className="checkbox-wrapper"
                                                    htmlFor="favicon-complete"
                                                >
                                                    <input
                                                        id="favicon-complete"
                                                        type="radio"
                                                        name="faviconMode"
                                                        className="checkbox-input"
                                                        checked={processingOptions.faviconMode !== 'basic'}
                                                        onChange={() => onSingleOptionChange('faviconMode', 'complete')}
                                                    />
                                                    <span className="checkbox-custom"></span>
                                                    <span className="flex-1 text-sm">{t('templates.completeSet')}</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <TemplateImageSection
                templateSelectedImageObj={templateSelectedImageObj}
                processingOptions={processingOptions}
                isFaviconSelected={isFaviconSelected}
                isScreenshotSelected={isScreenshotSelected}
                selectedScreenshotTemplates={selectedScreenshotTemplates}
                isLoading={isLoading}
                onProcessTemplates={onProcessTemplates}
                formatFileSize={formatFileSize}
                t={t}
            />
        </div>
    );
};

TemplateSelectionCard.propTypes = {
    processingOptions: PropTypes.object.isRequired,
    templateCategories: PropTypes.array.isRequired,
    onSelectAllTemplates: PropTypes.func.isRequired,
    onClearAllTemplates: PropTypes.func.isRequired,
    onSelectAllInCategory: PropTypes.func.isRequired,
    onDeselectAllInCategory: PropTypes.func.isRequired,
    onTemplateToggle: PropTypes.func.isRequired,
    getTranslatedTemplateName: PropTypes.func.isRequired,
    isScreenshotSelected: PropTypes.bool.isRequired,
    onScreenshotToggle: PropTypes.func.isRequired,
    screenshotUrl: PropTypes.string,
    onScreenshotUrlChange: PropTypes.func.isRequired,
    screenshotValidation: PropTypes.object,
    isCapturingScreenshots: PropTypes.bool.isRequired,
    captureProgress: PropTypes.number.isRequired,
    onCaptureScreenshots: PropTypes.func.isRequired,
    selectedScreenshotTemplates: PropTypes.array.isRequired,
    onScreenshotTemplateToggle: PropTypes.func.isRequired,
    onSelectAllScreenshotTemplates: PropTypes.func.isRequired,
    onDeselectAllScreenshotTemplates: PropTypes.func.isRequired,
    isFaviconSelected: PropTypes.bool.isRequired,
    onFaviconToggle: PropTypes.func.isRequired,
    onSingleOptionChange: PropTypes.func.isRequired,
    templateSelectedImageObj: PropTypes.object,
    isLoading: PropTypes.bool.isRequired,
    onProcessTemplates: PropTypes.func.isRequired,
    formatFileSize: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default TemplateSelectionCard;
