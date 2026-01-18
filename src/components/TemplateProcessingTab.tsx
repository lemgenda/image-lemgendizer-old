import TemplateSelectionCard from './TemplateSelectionCard';
import type { ProcessingOptions, ImageFile } from '../types';

/**
 * @file TemplateProcessingTab.tsx
 * @description Container component for template-based image processing (App Icons, Social Media, etc.).
 */

interface TemplateProcessingTabProps {
    processingOptions: ProcessingOptions;
    templateCategories: any[];
    onSelectAllTemplates: () => void;
    onClearAllTemplates: () => void;
    onSelectAllInCategory: (category: string) => void;
    onDeselectAllInCategory: (category: string) => void;
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
    onSelectAllScreenshotTemplates: () => void;
    onDeselectAllScreenshotTemplates: () => void;
    isFaviconSelected: boolean;
    onFaviconToggle: (selected: boolean) => void;
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    onSingleOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    templateSelectedImageObj?: ImageFile;
    isLoading: boolean;
    onProcessTemplates: () => void;
    formatFileSize: (size: number) => string;
    t: (key: string, params?: any) => string;
}

/**
 * TemplateProcessingTab component.
 * @component
 * @param {TemplateProcessingTabProps} props - Component props.
 * @returns {JSX.Element} The rendered template processing tab.
 */
const TemplateProcessingTab = (props: TemplateProcessingTabProps) => {
    return (
        <TemplateSelectionCard {...props} />
    );
};

export default TemplateProcessingTab;
