import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SCREENSHOT_QUALITY,
    URL_CONSTANTS
} from '../constants';
import {
    getScreenshotTemplatesWithQuality,
    getTemplateDimensions,
    getDeviceName,
    getInitialTemplates,
    normalizeUrl,
    openUrlInNewTab
} from '../utils';
import '../styles/ScreenShotsCard.css';

/**
 * Gets FontAwesome icon component for template
 * @param {string} templateId - Template ID
 * @returns {JSX.Element} FontAwesome icon component
 */
const getTemplateIcon = (templateId) => {
    if (templateId.includes('-full')) {
        if (templateId.includes('mobile')) {
            return (
                <span className="fa-stack">
                    <i className="fa-solid fa-mobile-screen fa-stack-2x"></i>
                    <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                </span>
            );
        } else if (templateId.includes('tablet')) {
            return (
                <span className="fa-stack">
                    <i className="fa-solid fa-tablet-screen-button fa-stack-2x"></i>
                    <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                </span>
            );
        } else if (templateId.includes('hd')) {
            return (
                <span className="fa-stack">
                    <i className="fa-solid fa-display fa-stack-2x"></i>
                    <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                </span>
            );
        } else {
            return (
                <span className="fa-stack">
                    <i className="fa-solid fa-desktop fa-stack-2x"></i>
                    <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                </span>
            );
        }
    } else {
        if (templateId.includes('mobile')) {
            return <i className="fa-solid fa-mobile-screen"></i>;
        } else if (templateId.includes('tablet')) {
            return <i className="fa-solid fa-tablet-screen-button"></i>;
        } else if (templateId.includes('hd')) {
            return <i className="fa-solid fa-display"></i>;
        } else {
            return <i className="fa-solid fa-desktop"></i>;
        }
    }
};

/**
 * ScreenShotsCard component for capturing website screenshots
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isSelected - Whether screenshot feature is selected
 * @param {Function} props.onToggle - Toggle handler for screenshot feature
 * @param {Function} props.onUrlChange - URL change handler
 * @param {string} [props.screenshotUrl=''] - Initial screenshot URL
 * @param {Object} [props.validation=null] - URL validation result
 * @param {boolean} props.isCapturing - Whether screenshots are being captured
 * @param {number} props.captureProgress - Capture progress percentage
 * @param {Function} props.onCaptureClick - Capture button click handler
 * @param {Array<string>} props.selectedTemplates - Selected template IDs
 * @param {Function} props.onTemplateToggle - Template toggle handler
 * @param {Function} props.onSelectAllTemplates - Select all templates handler
 * @param {Function} props.onDeselectAllTemplates - Deselect all templates handler
 * @returns {JSX.Element} Screenshot card component
 */
const ScreenShotsCard = ({
    isSelected,
    onToggle,
    onUrlChange,
    screenshotUrl = '',
    validation = null,
    isCapturing,
    captureProgress,
    onCaptureClick,
    selectedTemplates,
    onTemplateToggle,
    onSelectAllTemplates,
    onDeselectAllTemplates
}) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState(screenshotUrl || '');

    const screenshotTemplateList = getScreenshotTemplatesWithQuality();

    useEffect(() => {
        if (isSelected && selectedTemplates.length === 0) {
            const initialTemplates = getInitialTemplates();
            initialTemplates.forEach(templateId => {
                const templateExists = screenshotTemplateList.find(t => t.id === templateId);
                if (templateExists && onTemplateToggle) {
                    onTemplateToggle(templateId);
                }
            });
        }
    }, [isSelected, selectedTemplates, onTemplateToggle, screenshotTemplateList]);

    // Sync internal state with prop changes
    // Sync internal state with prop changes if they differ
    useEffect(() => {
        // Only update if the prop value is defined
        if (screenshotUrl !== undefined) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setUrl(screenshotUrl || '');
        }
    }, [screenshotUrl]);

    const handleWebsiteScreenshotToggle = (checked) => {
        onToggle(checked);
    };

    const handleUrlChange = (e) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        if (onUrlChange) {
            onUrlChange(newUrl);
        }
    };


    const handleCaptureClick = () => {
        if (onCaptureClick && url.trim() && validation?.isValid && selectedTemplates.length > 0) {
            onCaptureClick(url, selectedTemplates);
        }
    };

    const handleTestUrl = () => {
        if (url.trim() && validation?.isValid) {
            const normalizedUrl = normalizeUrl(url);
            openUrlInNewTab(normalizedUrl);
        }
    };

    return (
        <div className={`screenshot-card ${isSelected ? 'selected' : ''}`}>
            <div className="screenshot-card-header">
                <div className="screenshot-header-controls">
                    <label
                        className="main-checkbox-container"
                    // onClick removed, input inside handles click
                    >
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleWebsiteScreenshotToggle(e.target.checked)}
                            // Stop propagation to prevent double toggle if parent handles something
                            onClick={(e) => e.stopPropagation()}
                            className="main-checkbox"
                        />
                        <span className="main-checkbox-label">
                            {t('screenshots.title')}
                        </span>
                    </label>

                    {isSelected && selectedTemplates.length > 0 && (
                        <div className="counter-badge">
                            {selectedTemplates.length}
                        </div>
                    )}
                </div>
            </div>

            {isSelected && (
                <div className="screenshot-card-content">
                    <div className="url-section">
                        <label className="url-label" htmlFor="screenshot-url-input">
                            {t('screenshots.websiteUrl')}
                        </label>
                        <div className="url-input-container">
                            <input
                                type="url"
                                id="screenshot-url-input"
                                value={url}
                                onChange={handleUrlChange}
                                placeholder={URL_CONSTANTS.PLACEHOLDER}
                                className={`url-input ${validation?.isValid ? 'valid' : url.trim() && !validation?.isValid ? 'invalid' : ''}`}
                                disabled={isCapturing}
                            />
                            <button
                                className="test-url-button"
                                onClick={handleTestUrl}
                                type="button"
                                title="Open URL in new tab (noopener, noreferrer)"
                                disabled={!validation?.isValid || !url.trim() || isCapturing}
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                {t('button.test')}
                            </button>
                        </div>

                        {validation && url.trim() && (
                            <div className={`validation-message ${validation.isValid ? 'valid' : 'invalid'}`}>
                                <i className={`fa-solid fa-${validation.isValid ? 'circle-check' : 'circle-exclamation'}`}></i>
                                {validation.message}
                            </div>
                        )}
                    </div>

                    <div className="template-actions">
                        <h4 className="template-title">
                            {t('screenshots.selectDevices')}
                        </h4>
                        <div className="action-buttons">
                            <button
                                className="action-button"
                                onClick={onSelectAllTemplates}
                                disabled={isCapturing}
                            >
                                <i className="fa-solid fa-check-square"></i>
                                {t('screenshots.selectAll')}
                            </button>
                            <button
                                className="action-button"
                                onClick={onDeselectAllTemplates}
                                disabled={isCapturing}
                            >
                                <i className="fa-solid fa-square"></i>
                                {t('screenshots.deselectAll')}
                            </button>
                        </div>
                    </div>

                    <div className="templates-grid">
                        {screenshotTemplateList.map(template => (
                            <label
                                key={template.id}
                                htmlFor={`template-checkbox-${template.id}`}
                                className={`template-item ${selectedTemplates.includes(template.id) ? 'selected' : ''}`}
                                title={`${t(template.name)} - ${getTemplateDimensions(template)} - ${getDeviceName(template.id)}`}
                                aria-label={t(template.name)}
                            >
                                <input
                                    id={`template-checkbox-${template.id}`}
                                    type="checkbox"
                                    className="template-checkbox"
                                    checked={selectedTemplates.includes(template.id)}
                                    onChange={() => onTemplateToggle(template.id)}
                                    disabled={isCapturing}
                                />
                                <div className="template-icon-container">
                                    {getTemplateIcon(template.id)}
                                </div>
                                <i
                                    className="fa-solid fa-circle-info info-icon"
                                    title={`${t(template.name)} - ${getTemplateDimensions(template)} - ${getDeviceName(template.id)}`}
                                ></i>
                                <span className="sr-only">{t(template.name)}</span>
                            </label>
                        ))}
                    </div>

                    <div className="capture-section">
                        <button
                            className={`capture-button ${isCapturing ? 'capturing' : ''}`}
                            onClick={handleCaptureClick}
                            disabled={!validation?.isValid || !url.trim() || selectedTemplates.length === 0 || isCapturing}
                        >
                            {isCapturing ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin" style={{ animation: 'fa-spin 1s infinite linear' }}></i>
                                    {t('screenshots.capturing')} {captureProgress}%
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-file-zipper"></i>
                                    {t('screenshots.captureButton')}
                                </>
                            )}
                        </button>

                        {isCapturing && (
                            <div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${captureProgress}%` }}
                                    ></div>
                                </div>
                                <p className="progress-text">
                                    {t('message.capturingScreenshots')}
                                    <br />
                                    <small>
                                        {t('quality')}: {SCREENSHOT_QUALITY.JPEG_QUALITY}% |
                                        {t('timeout')}: {SCREENSHOT_QUALITY.TIMEOUT / 1000}s
                                    </small>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScreenShotsCard;