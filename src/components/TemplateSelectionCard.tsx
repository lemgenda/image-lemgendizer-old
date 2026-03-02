import type { ProcessingOptions } from '../types';
import ScreenShotsCard from './ScreenShotsCard';
import { SOCIAL_MEDIA_TEMPLATES } from '../configs/templateConfigs';
import '../styles/TemplateSelectionCard.css';

/**
 * @file TemplateSelectionCard.tsx
 * @description UI component for selecting social media and branding templates for image processing.
 */

interface TemplateCategory {
    id: string;
    icon: string;
}

interface TemplateSelectionCardProps {
    processingOptions: ProcessingOptions;
    templateCategories: TemplateCategory[];


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

    isFaviconSelected: boolean;
    onFaviconToggle: (selected: boolean) => void;
    onSingleOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    templateSelectedImageObj?: any;
    isLoading: boolean;
    t: (key: string, params?: any) => string;
}

/**
 * TemplateSelectionCard component.
 * @component
 * @param {TemplateSelectionCardProps} props - Component props.
 * @returns {JSX.Element} The rendered template selection card.
 */
const TemplateSelectionCard = ({
    processingOptions,
    templateCategories,


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

    isFaviconSelected,
    onFaviconToggle,
    onSingleOptionChange,
    t
}: TemplateSelectionCardProps) => {
    return (
        <div className="flex flex-col mb-lg">
            <div className="templates-grid mb-lg">
                {templateCategories.map((category) => {
                    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES.filter(template =>
                        template.category === category.id
                    );

                    return (
                        <details key={category.id} className="settings-accordion" name="template-categories">
                            <summary style={{ outline: 'none' }}>
                                <div className="flex items-center gap-sm">
                                    <i className={`${category.icon} text-primary flex-shrink-0`}></i>
                                    <span>{t(`category.${category.id}`)}</span>
                                </div>
                                <i className="fas fa-chevron-down text-sm"></i>
                            </summary>
                            <div className="card-body space-y-sm">
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
                                                    htmlFor="favicon-full"
                                                >
                                                    <input
                                                        id="favicon-full"
                                                        type="radio"
                                                        name="faviconMode"
                                                        className="checkbox-input"
                                                        checked={processingOptions.faviconMode === 'full'}
                                                        onChange={() => onSingleOptionChange('faviconMode', 'full')}
                                                    />
                                                    <span className="checkbox-custom"></span>
                                                    <span className="flex-1 text-sm">{t('templates.fullSet')}</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </details>
                    );
                })}
            </div>
        </div>
    );

};

export default TemplateSelectionCard;
