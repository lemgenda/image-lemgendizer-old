import React from 'react';
import PropTypes from 'prop-types';
import { TemplateSelectionCard } from './index';

/**
 * @fileoverview Template processing tab container.
 * Wraps the TemplateSelectionCard and handles any tab-level layout.
 */

/**
 * TemplateProcessingTab - Component for template processing mode
 * @param {Object} props - Component props (passed through to TemplateSelectionCard)
 * @returns {JSX.Element} Template processing tab
 */
const TemplateProcessingTab = (props) => {
    return (
        <TemplateSelectionCard {...props} />
    );
};

TemplateProcessingTab.propTypes = {
    // All props required by TemplateSelectionCard
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

export default TemplateProcessingTab;
