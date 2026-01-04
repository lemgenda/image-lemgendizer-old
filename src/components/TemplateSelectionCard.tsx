import type { ProcessingOptions, ImageFile } from '../types';
import { ScreenShotsCard, TemplateImageSection } from './index';
import { SOCIAL_MEDIA_TEMPLATES } from '../configs/templateConfigs';

/**
 * @fileoverview Template selection card component for choosing social media and other templates.
 * Provides a grid of templates categorized by platform, with special sections for screenshots and favicons.
 */

interface TemplateCategory {
    id: string;
    icon: string;
}

interface TemplateSelectionCardProps {
    processingOptions: ProcessingOptions;
    templateCategories: TemplateCategory[];
    onSelectAllTemplates: () => void;
    onClearAllTemplates: () => void;
    onSelectAllInCategory: (categoryId: string) => void;
    onDeselectAllInCategory: (categoryId: string) => void;
    onTemplateToggle: (templateId: string) => void;
    getTranslatedTemplateName: (name: string, t: any) => string;
    isScreenshotSelected: boolean;
    onScreenshotToggle: (selected: boolean) => void;
    screenshotUrl: string;
    onScreenshotUrlChange: (url: string) => void;
    screenshotValidation: any;
    isCapturingScreenshots: boolean;
    captureProgress: number;
    onCaptureScreenshots: (url: string, templates: string[]) => void;
    selectedScreenshotTemplates: string[];
    onScreenshotTemplateToggle: (templateId: string) => void;
    onSelectAllScreenshotTemplates: () => void;
    onDeselectAllScreenshotTemplates: () => void;
    isFaviconSelected: boolean;
    onFaviconToggle: (selected: boolean) => void;
    onSingleOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    templateSelectedImageObj?: ImageFile;
    isLoading: boolean;
    onProcessTemplates: () => void;
    formatFileSize: (size: number) => string;
    t: (key: string, params?: any) => string;
}

/**
 * TemplateSelectionCard - Component for selecting templates
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
}: TemplateSelectionCardProps) => {
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

export default TemplateSelectionCard;
