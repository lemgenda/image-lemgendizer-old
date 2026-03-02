import TemplateSelectionCard from './TemplateSelectionCard';
import type { ProcessingOptions } from '../types';

/**
 * @file TemplateProcessingTab.tsx
 * @description Container component for template-based image processing (App Icons, Social Media, etc.).
 */

interface TemplateProcessingTabProps {
    processingOptions: ProcessingOptions;
    templateCategories: any[];
    onTemplateToggle: (templateId: string) => void;
    getTranslatedTemplateName: (name: string, tFunc: any) => string;
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
 * TemplateProcessingTab component.
 * @component
 * @param {TemplateProcessingTabProps} props - Component props.
 * @returns {JSX.Element} The rendered template processing tab.
 */
const TemplateProcessingTab = ({
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
    templateSelectedImageObj,
    isLoading,
    t
}: TemplateProcessingTabProps) => {
    return (
        <TemplateSelectionCard
            processingOptions={processingOptions}
            templateCategories={templateCategories}
            onTemplateToggle={onTemplateToggle}
            getTranslatedTemplateName={getTranslatedTemplateName}
            isScreenshotSelected={isScreenshotSelected}
            onScreenshotToggle={onScreenshotToggle}
            screenshotUrl={screenshotUrl}
            onScreenshotUrlChange={onScreenshotUrlChange}
            screenshotValidation={screenshotValidation}
            isCapturingScreenshots={isCapturingScreenshots}
            captureProgress={captureProgress}
            onCaptureScreenshots={onCaptureScreenshots}
            selectedScreenshotTemplates={selectedScreenshotTemplates}
            onScreenshotTemplateToggle={onScreenshotTemplateToggle}
            isFaviconSelected={isFaviconSelected}
            onFaviconToggle={onFaviconToggle}
            onSingleOptionChange={onSingleOptionChange}
            templateSelectedImageObj={templateSelectedImageObj}
            isLoading={isLoading}
            t={t}
        />
    );
};

export default TemplateProcessingTab;
