import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';
import {
    THEME_COLORS,
    STATUS_COLORS,
    SCREENSHOT_QUALITY,
    URL_CONSTANTS,
    DEVICE_PRESETS,
    DEVICE_VIEWPORTS,
    SPACING,
    BORDER_RADIUS,
    TRANSITIONS,
    SHADOWS
} from '../constants';

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
    const [url, setUrl] = useState(screenshotUrl);
    const [isDarkTheme, setIsDarkTheme] = useState(true);

    // Detect current theme from document
    useEffect(() => {
        const detectTheme = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                (!document.documentElement.getAttribute('data-theme') &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches);
            setIsDarkTheme(isDark);
        };

        // Initial detection
        detectTheme();

        // Listen for theme changes
        const observer = new MutationObserver(detectTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => detectTheme();
        mediaQuery.addEventListener('change', handleSystemThemeChange);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', handleSystemThemeChange);
        };
    }, []);

    // Get theme colors based on current theme
    const themeColors = isDarkTheme ? THEME_COLORS.DARK : THEME_COLORS.LIGHT;

    // Get all screenshot templates with applied constants
    const screenshotTemplateList = Object.values(SCREENSHOT_TEMPLATES || {}).map(template => {
        // Apply quality settings from constants
        const updatedTemplate = { ...template };
        if (updatedTemplate.requestBody?.options) {
            updatedTemplate.requestBody.options.quality = SCREENSHOT_QUALITY.JPEG_QUALITY;
        }
        return updatedTemplate;
    });

    // Get device-specific viewport using DEVICE_PRESETS
    const getDeviceViewport = (deviceType) => {
        switch (deviceType) {
            case 'mobile':
                return DEVICE_PRESETS.mobile.viewport;
            case 'tablet':
                return DEVICE_PRESETS.tablet.viewport;
            case 'desktop':
                return DEVICE_PRESETS.desktop.viewport;
            case 'desktop-hd':
                return DEVICE_VIEWPORTS.DESKTOP_HD;
            default:
                return DEVICE_PRESETS.desktop.viewport;
        }
    };

    // Auto-select mobile and desktop templates when main checkbox is checked
    useEffect(() => {
        if (isSelected && selectedTemplates.length === 0) {
            // Auto-select basic mobile and desktop templates
            const basicMobile = screenshotTemplateList.find(t => t.id === 'screenshots-mobile');
            const basicDesktop = screenshotTemplateList.find(t => t.id === 'screenshots-desktop');

            if (basicMobile && onTemplateToggle) {
                onTemplateToggle(basicMobile.id);
            }
            if (basicDesktop && onTemplateToggle) {
                onTemplateToggle(basicDesktop.id);
            }
        }
    }, [isSelected]);

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
            // Clean and format the URL properly
            let cleanUrl = url.trim();

            // Remove any localhost:5173 prefix
            if (cleanUrl.includes('localhost:5173/')) {
                cleanUrl = cleanUrl.replace('localhost:5173/', '');
            }

            // Ensure URL has protocol
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = `${URL_CONSTANTS.DEFAULT_PROTOCOL}${cleanUrl}`;
            }

            // Remove duplicate slashes and normalize URL
            cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

            // Open in new tab with proper safety attributes
            window.open(cleanUrl, '_blank', 'noopener,noreferrer');
        }
    };

    // Get icon for template
    const getTemplateIcon = (templateId, templateName) => {
        if (templateId.includes('-full')) {
            // Full page templates use stacked icons
            if (templateId.includes('mobile')) {
                return (
                    <span className="fa-stack fa-4x">
                        <i className="fa-solid fa-mobile-screen fa-stack-2x"></i>
                        <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                    </span>
                );
            } else if (templateId.includes('tablet')) {
                return (
                    <span className="fa-stack fa-4x">
                        <i className="fa-solid fa-tablet-screen-button fa-stack-2x"></i>
                        <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                    </span>
                );
            } else if (templateId.includes('hd')) {
                return (
                    <span className="fa-stack fa-4x">
                        <i className="fa-solid fa-display fa-stack-2x"></i>
                        <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                    </span>
                );
            } else {
                return (
                    <span className="fa-stack fa-4x">
                        <i className="fa-solid fa-desktop fa-stack-2x"></i>
                        <i className="fa-solid fa-arrows-down-to-line fa-stack-1x"></i>
                    </span>
                );
            }
        } else {
            // Regular templates use single icons
            if (templateId.includes('mobile')) {
                return <i className="fa-solid fa-mobile-screen fa-4x"></i>;
            } else if (templateId.includes('tablet')) {
                return <i className="fa-solid fa-tablet-screen-button fa-4x"></i>;
            } else if (templateId.includes('hd')) {
                return <i className="fa-solid fa-display fa-4x"></i>;
            } else {
                return <i className="fa-solid fa-desktop fa-4x"></i>;
            }
        }
    };

    // Get template dimensions using device viewports
    const getTemplateDimensions = (template) => {
        const deviceType = template.id.includes('mobile') ? 'mobile' :
            template.id.includes('tablet') ? 'tablet' :
                template.id.includes('hd') ? 'desktop-hd' : 'desktop';

        const viewport = getDeviceViewport(deviceType);

        if (template.height === 'auto') {
            return `${viewport.width}×auto`;
        }
        return `${viewport.width}×${viewport.height}`;
    };

    // Get device name for display
    const getDeviceName = (templateId) => {
        if (templateId.includes('mobile')) return DEVICE_PRESETS.mobile.name;
        if (templateId.includes('tablet')) return DEVICE_PRESETS.tablet.name;
        if (templateId.includes('hd')) return 'Desktop HD';
        return DEVICE_PRESETS.desktop.name;
    };

    return (
        <>
            <style>{`
                /* Spinner animations - override prefers-reduced-motion */
                @keyframes fa-spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                .fa-spin {
                    animation: fa-spin 1s infinite linear !important;
                    animation-duration: 1s !important;
                    animation-timing-function: linear !important;
                    animation-iteration-count: infinite !important;
                }

                /* Override prefers-reduced-motion for spinners */
                @media (prefers-reduced-motion: reduce) {
                    .fa-spin {
                        animation: fa-spin 1s infinite linear !important;
                        animation-duration: 1s !important;
                        animation-timing-function: linear !important;
                        animation-iteration-count: infinite !important;
                    }
                }

                .screenshot-card {
                    background-color: ${themeColors.bgSecondary};
                    border-radius: 12px;
                    border: 1px solid ${themeColors.border};
                    overflow: hidden;
                    box-shadow: ${isDarkTheme ? SHADOWS.MD : SHADOWS.SM};
                    transition: all ${TRANSITIONS.NORMAL};
                    margin-bottom: 20px;
                }

                .screenshot-card-header {
                    padding: ${SPACING.LG};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background-color: ${themeColors.bgSecondary};
                    border-bottom: ${isSelected ? `1px solid ${themeColors.border}` : 'none'};
                }

                .screenshot-header-title {
                    display: flex;
                    align-items: center;
                    gap: ${SPACING.SM};
                    color: ${themeColors.textPrimary};
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                }

                .screenshot-header-icon {
                    color: ${STATUS_COLORS.PRIMARY};
                    font-size: 20px;
                }

                .screenshot-header-controls {
                    display: flex;
                    align-items: center;
                    gap: ${SPACING.SM};
                }

                .main-checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: ${SPACING.SM};
                    cursor: pointer;
                    user-select: none;
                }

                .main-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: ${STATUS_COLORS.PRIMARY};
                    margin: 0;
                }

                .main-checkbox-label {
                    color: ${themeColors.textPrimary};
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                }

                .counter-badge {
                    background-color: ${STATUS_COLORS.PRIMARY};
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                    padding: 4px 8px;
                    border-radius: 12px;
                    min-width: 24px;
                    text-align: center;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .screenshot-card-content {
                    padding: ${isSelected ? SPACING.LG : '0'};
                    max-height: ${isSelected ? '1000px' : '0'};
                    opacity: ${isSelected ? '1' : '0'};
                    overflow: hidden;
                    transition: all ${TRANSITIONS.NORMAL};
                    background-color: ${themeColors.bgSecondary};
                }

                .url-section {
                    margin-bottom: 20px;
                }

                .url-label {
                    display: block;
                    margin-bottom: 8px;
                    color: ${themeColors.textSecondary};
                    font-size: 14px;
                    font-weight: 500;
                }

                .url-input-container {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .url-input {
                    flex: 1;
                    padding: ${SPACING.SM} ${SPACING.MD};
                    border-radius: ${BORDER_RADIUS.MD};
                    border: 1px solid ${themeColors.border};
                    background-color: ${themeColors.bgPrimary};
                    color: ${themeColors.textPrimary};
                    font-size: 14px;
                    transition: all ${TRANSITIONS.FAST};
                }

                .url-input:focus {
                    outline: none;
                    border-color: ${STATUS_COLORS.PRIMARY};
                    box-shadow: 0 0 0 3px ${isDarkTheme ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.1)'};
                }

                .url-input.valid {
                    border-color: ${STATUS_COLORS.SUCCESS};
                }

                .url-input.invalid {
                    border-color: ${STATUS_COLORS.ERROR};
                }

                .url-input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    background-color: ${themeColors.bgTertiary};
                }

                .test-url-button {
                    padding: ${SPACING.SM} ${SPACING.MD};
                    background-color: ${themeColors.bgTertiary};
                    color: ${themeColors.textSecondary};
                    border: 1px solid ${themeColors.border};
                    border-radius: ${BORDER_RADIUS.MD};
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all ${TRANSITIONS.FAST};
                    white-space: nowrap;
                }

                .test-url-button:hover:not(:disabled) {
                    background-color: ${themeColors.borderHover};
                    border-color: ${themeColors.borderHover};
                }

                .test-url-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .validation-message {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                    font-size: 13px;
                    padding: 6px 10px;
                    border-radius: ${BORDER_RADIUS.SM};
                    color: ${validation?.isValid ? STATUS_COLORS.SUCCESS : STATUS_COLORS.ERROR};
                    background-color: ${validation?.isValid ?
                    (isDarkTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)') :
                    (isDarkTheme ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)')};
                }

                .template-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding: 12px 0;
                    border-bottom: 1px solid ${themeColors.border};
                }

                .template-title {
                    color: ${themeColors.textPrimary};
                    font-size: 15px;
                    font-weight: 600;
                    margin: 0;
                }

                .action-buttons {
                    display: flex;
                    gap: ${SPACING.XS};
                }

                .action-button {
                    padding: 6px 12px;
                    background-color: ${themeColors.bgPrimary};
                    color: ${themeColors.textSecondary};
                    border: 1px solid ${themeColors.border};
                    border-radius: ${BORDER_RADIUS.SM};
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all ${TRANSITIONS.FAST};
                }

                .action-button:hover:not(:disabled) {
                    background-color: ${themeColors.bgTertiary};
                    border-color: ${themeColors.borderHover};
                }

                .action-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .templates-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .template-item {
                    background-color: ${themeColors.bgPrimary};
                    border: 1px solid ${themeColors.border};
                    border-radius: ${BORDER_RADIUS.SM};
                    padding: ${SPACING.SM};
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all ${TRANSITIONS.FAST};
                    cursor: pointer;
                    min-height: 60px;
                }

                .template-item:hover {
                    border-color: ${themeColors.borderHover};
                    background-color: ${themeColors.bgTertiary};
                }

                .template-item.selected {
                    background-color: ${isDarkTheme ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)'};
                    border-color: ${STATUS_COLORS.PRIMARY};
                }

                .template-icon-container {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${themeColors.textMuted};
                }

                .fa-stack {
                    font-size: 0.8rem;
                }

                .fa-stack .fa-stack-1x {
                    font-size: 0.5rem;
                }

                .fa-solid {
                    font-size: 16px;
                }

                .template-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .info-icon {
                    color: ${themeColors.textMuted};
                    font-size: 12px;
                    cursor: help;
                    opacity: 0.7;
                    transition: opacity ${TRANSITIONS.FAST};
                }

                .info-icon:hover {
                    opacity: 1;
                }

                .template-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: ${STATUS_COLORS.PRIMARY};
                    margin-left: ${SPACING.XS};
                }

                .template-checkbox:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .capture-section {
                    text-align: center;
                    padding-top: 16px;
                    border-top: 1px solid ${themeColors.border};
                }

                .capture-button {
                    padding: ${SPACING.MD} ${SPACING.LG};
                    background-color: ${STATUS_COLORS.PRIMARY};
                    color: white;
                    border: none;
                    border-radius: ${BORDER_RADIUS.MD};
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    transition: background-color ${TRANSITIONS.FAST};
                }

                .capture-button:hover:not(:disabled):not(.capturing) {
                    background-color: ${STATUS_COLORS.PRIMARY_HOVER};
                }

                .capture-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .capture-button.capturing {
                    background-color: ${themeColors.bgTertiary};
                    color: ${themeColors.textMuted};
                    cursor: wait;
                }

                .progress-bar {
                    height: 6px;
                    background-color: ${themeColors.bgTertiary};
                    border-radius: 3px;
                    overflow: hidden;
                    margin-top: 12px;
                }

                .progress-fill {
                    height: 100%;
                    background-color: ${STATUS_COLORS.PRIMARY};
                    transition: width ${TRANSITIONS.NORMAL} ease;
                    border-radius: 3px;
                }

                .progress-text {
                    margin-top: 8px;
                    color: ${themeColors.textMuted};
                    font-size: 13px;
                }

                .fa-arrows-down-to-line{
                    top: -0.3rem;
                }

                @media (max-width: 768px) {
                    .screenshot-card-header {
                        padding: 15px;
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }

                    .screenshot-header-controls {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .templates-grid {
                        grid-template-columns: 1fr;
                    }

                    .url-input-container {
                        flex-direction: column;
                    }

                    .test-url-button {
                        width: 100%;
                        justify-content: center;
                    }

                    .template-actions {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }

                    .action-buttons {
                        width: 100%;
                        justify-content: flex-start;
                    }
                }
            `}</style>

            <div className="screenshot-card">
                {/* Card Header - ALWAYS VISIBLE */}
                <div className="screenshot-card-header">
                    <div className="screenshot-header-controls">
                        <div
                            className="main-checkbox-container"
                            onClick={() => handleWebsiteScreenshotToggle(!isSelected)}
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleWebsiteScreenshotToggle(e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                                className="main-checkbox"
                            />
                            <label className="main-checkbox-label">
                                {t('screenshots.title')}
                            </label>
                        </div>

                        {isSelected && selectedTemplates.length > 0 && (
                            <div className="counter-badge">
                                {selectedTemplates.length}
                            </div>
                        )}
                    </div>
                </div>

                {/* Card Content - HIDDEN UNTIL CHECKBOX IS CHECKED */}
                {isSelected && (
                    <div className="screenshot-card-content">
                        {/* URL Input Section */}
                        <div className="url-section">
                            <label className="url-label">
                                {t('screenshots.websiteUrl')}
                            </label>
                            <div className="url-input-container">
                                <input
                                    type="url"
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
                                <div className="validation-message">
                                    <i className={`fa-solid fa-${validation.isValid ? 'circle-check' : 'circle-exclamation'}`}></i>
                                    {validation.message}
                                </div>
                            )}
                        </div>

                        {/* Template Actions - BUTTONS ARE BACK! */}
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

                        {/* Templates Grid - 2 columns × 4 rows */}
                        <div className="templates-grid">
                            {screenshotTemplateList.map(template => (
                                <label
                                    key={template.id}
                                    className={`template-item ${selectedTemplates.includes(template.id) ? 'selected' : ''}`}
                                    title={`${t(template.name)} - ${getTemplateDimensions(template)} - ${getDeviceName(template.id)}`}
                                >
                                    <div className="template-icon-container">
                                        {getTemplateIcon(template.id, template.name)}
                                    </div>
                                    <div className="template-info">
                                        <i
                                            className="fa-solid fa-circle-info info-icon"
                                            title={`${t(template.name)} - ${getTemplateDimensions(template)} - ${getDeviceName(template.id)}`}
                                        ></i>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="template-checkbox"
                                        checked={selectedTemplates.includes(template.id)}
                                        onChange={() => onTemplateToggle(template.id)}
                                        disabled={isCapturing}
                                    />
                                </label>
                            ))}
                        </div>

                        {/* Capture Button */}
                        <div className="capture-section">
                            <button
                                className={`capture-button ${isCapturing ? 'capturing' : ''}`}
                                onClick={handleCaptureClick}
                                disabled={!validation?.isValid || !url.trim() || selectedTemplates.length === 0 || isCapturing}
                            >
                                {isCapturing ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" style={{ animation: 'fa-spin 1s infinite linear !important' }}></i>
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
        </>
    );
};

export default ScreenShotsCard;