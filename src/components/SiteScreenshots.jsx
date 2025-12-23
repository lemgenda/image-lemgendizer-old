// src/components/SiteScreenshots.jsx (simplified)
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreenshotService } from '../utils/screenshotUtils';

/**
 * Site Screenshots Component
 * @param {Object} props - Component props
 * @param {boolean} props.isSelected - Whether screenshot is selected
 * @param {Function} props.onToggle - Toggle callback function
 * @param {Function} props.onUrlChange - URL change callback function
 * @param {string} props.screenshotUrl - Current screenshot URL
 * @param {Object|null} props.validation - URL validation result
 * @returns {JSX.Element} SiteScreenshots component
 */
const SiteScreenshots = ({ isSelected, onToggle, onUrlChange, screenshotUrl = '', validation = null }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState(screenshotUrl);
    const { captureTemplates, isLoading, progress, error } = useScreenshotService();

    useEffect(() => {
        setUrl(screenshotUrl);
    }, [screenshotUrl]);

    /**
     * Handles URL input change
     * @param {React.ChangeEvent<HTMLInputElement>} e - Change event
     */
    const handleUrlChange = (e) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        if (onUrlChange) {
            onUrlChange(newUrl);
        }
    };

    /**
     * Gets validation CSS class based on validation state
     * @returns {string} CSS class name
     */
    const getValidationClass = () => {
        if (!validation) return '';
        if (validation.isValid) return 'url-input-success';
        if (url.trim() && !validation.isValid) return 'url-input-error';
        return '';
    };

    /**
     * Gets validation message component
     * @returns {JSX.Element|null} Validation message component
     */
    const getValidationMessage = () => {
        if (!validation || !url.trim()) return null;
        if (validation.isValid) {
            return (
                <div className="validation-message success">
                    <i className="fas fa-check-circle mr-1"></i>
                    {validation.message}
                </div>
            );
        } else {
            return (
                <div className="validation-message error">
                    <i className="fas fa-exclamation-circle mr-1"></i>
                    {validation.message}
                </div>
            );
        }
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            // Cleanup handled by service
        };
    }, []);

    return (
        <>
            <style>{`
                .site-screenshots-component {
                    margin-bottom: 1.5rem;
                }
                .screenshot-checkbox {
                    display: flex;
                    align-items: center;
                    margin-bottom: 1rem;
                    cursor: pointer;
                }
                .screenshot-checkbox input[type="checkbox"] {
                    margin-right: 0.5rem;
                    cursor: pointer;
                }
                .screenshot-checkbox-label {
                    font-weight: 600;
                    color: #ced4da;
                    display: flex;
                    align-items: center;
                }
                .screenshot-checkbox-label i {
                    margin-right: 0.5rem;
                    color: #ced4da;
                }
                .screenshot-options {
                    background-color: var(--color-bg-tertiary);
                    border-radius: var(--radius-md);
                    padding: var(--space-lg);
                    border: 1px solid var(--border-color);
                    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
                }
                .url-input-with-button {
                    margin-bottom: 0.75rem;
                }
                .input-wrapper {
                    position: relative;
                    display: flex;
                    width: 100%;
                }
                .url-input {
                    width: 100%;
                    padding: 0.5rem 2.5rem 0.5rem 0.75rem;
                    border: 1px solid #ced4da;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    transition: all 0.15s ease;
                }
                .url-input:focus {
                    outline: none;
                    border-color: #4a90e2;
                    box-shadow: 0 0 0 0.2rem rgba(74, 144, 226, 0.25);
                }
                .url-input-success {
                    border-color: #28a745 !important;
                    padding-right: 2.75rem;
                }
                .url-input-error {
                    border-color: #dc3545 !important;
                    padding-right: 2.75rem;
                }
                .test-url-button {
                    position: absolute;
                    right: 4px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: transparent;
                    border: none;
                    color: #6c757d;
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 0.25rem;
                    transition: all 0.15s ease;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .test-url-button.enabled {
                    color: #28a745;
                }
                .test-url-button.enabled:hover {
                    color: #218838;
                    background-color: rgba(40, 167, 69, 0.1);
                }
                .test-url-button.disabled {
                    color: #adb5bd;
                    cursor: not-allowed;
                    opacity: 0.5;
                }
                .validation-message {
                    font-size: 0.75rem;
                    padding: 0.25rem 0;
                    margin-top: 0.25rem;
                }
                .validation-message.success {
                    color: #28a745;
                }
                .validation-message.error {
                    color: #dc3545;
                }
                .screenshot-warning {
                    background-color: rgba(255, 193, 7, 0.1);
                    border: 1px solid rgba(255, 193, 7, 0.3);
                    border-radius: 0.375rem;
                    padding: 0.5rem;
                    font-size: 0.75rem;
                    margin-top: 0.5rem;
                }
            `}</style>

            <div className="site-screenshots-component">
                <div className="screenshot-checkbox" onClick={() => onToggle && onToggle(!isSelected)}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggle && onToggle(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="screenshot-checkbox-label">
                        <i className="fas fa-camera"></i>
                        {t('screenshots.title', 'Generate Screenshots')}
                    </div>
                </div>

                {isSelected && (
                    <div className="screenshot-options">
                        <div className="url-input-with-button">
                            <div className="input-wrapper">
                                <input
                                    type="url"
                                    className={`url-input ${getValidationClass()}`}
                                    value={url}
                                    onChange={handleUrlChange}
                                    placeholder="https://example.com"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                    type="button"
                                    className={`test-url-button ${validation?.isValid ? 'enabled' : 'disabled'}`}
                                    onClick={() => {
                                        if (validation?.isValid && url.trim()) {
                                            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                                            window.open(fullUrl, '_blank', 'noopener,noreferrer');
                                        }
                                    }}
                                    disabled={!validation?.isValid || !url.trim()}
                                    title={validation?.isValid ? `${t('button.test')} ${url}` : t('message.errorScreenshotUrl')}
                                >
                                    <i className="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                        </div>

                        {getValidationMessage()}

                        {isLoading && (
                            <div className="progress-indicator">
                                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                            </div>
                        )}

                        {error && (
                            <div className="error-message">
                                <i className="fas fa-exclamation-triangle mr-1"></i>
                                {error}
                            </div>
                        )}

                        <div className="screenshot-warning">
                            <i className="fas fa-exclamation-triangle text-warning mr-1"></i>
                            <span className="text-sm text-warning">
                                {t('screenshots.warning', 'Note: Some websites block screenshot capture due to security settings. If this happens, you\'ll still get informative error images.')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default SiteScreenshots;