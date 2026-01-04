import { TemplateSelectionCard } from './index';
import type { ProcessingOptions, ImageFile } from '../types';

/**
 * @fileoverview Template processing tab container.
 * Wraps the TemplateSelectionCard and handles any tab-level layout.
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
    onSingleOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    templateSelectedImageObj?: ImageFile;
    isLoading: boolean;
    onProcessTemplates: () => void;
    formatFileSize: (size: number) => string;
    t: (key: string, params?: any) => string;
}

/**
 * TemplateProcessingTab - Component for template processing mode
 */
const TemplateProcessingTab = (props: TemplateProcessingTabProps) => {
    return (
        <TemplateSelectionCard {...props} />
    );
};

export default TemplateProcessingTab;
