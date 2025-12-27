import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ScreenshotCapture from './ScreenshotCapture';
import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';

/**
 * Site Screenshots Component with integrated capture
 * @param {Object} props - Component props
 * @param {boolean} props.isSelected - Whether screenshot is selected
 * @param {Function} props.onToggle - Toggle callback function
 * @param {Function} props.onUrlChange - URL change callback function
 * @param {string} props.screenshotUrl - Current screenshot URL
 * @param {Object|null} props.validation - URL validation result
 * @returns {JSX.Element} SiteScreenshots component
 */
const SiteScreenshots = ({
    isSelected,
    onToggle,
    onUrlChange,
    screenshotUrl = '',
    validation = null,
    onScreenshotComplete
}) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState(screenshotUrl);
    const [captureResults, setCaptureResults] = useState(null);
    const [isValidUrl, setIsValidUrl] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState([]);

    /**
     * Updates local URL state when prop changes
     */
    useEffect(() => {
        setUrl(screenshotUrl);
    }, [screenshotUrl]);

    /**
     * Updates URL validation state
     */
    useEffect(() => {
        setIsValidUrl(validation?.isValid || false);
    }, [validation]);

    /**
     * Load available screenshot templates
     */
    useEffect(() => {
        const screenshotTemplates = Object.values(SCREENSHOT_TEMPLATES)
            .filter(template => template.category === 'screenshots');
        setAvailableTemplates(screenshotTemplates);
    }, []);

    /**
     * Handles URL input change
     * @param {React.ChangeEvent<HTMLInputElement>} e - Change event
     */
    const handleUrlChange = (e) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setCaptureResults(null);
        if (onUrlChange) {
            onUrlChange(newUrl);
        }
    };

    /**
     * Handles screenshot capture completion
     * @param {Object} results - Capture results
     */
    const handleCaptureComplete = (results) => {
        setCaptureResults(results);
        if (onScreenshotComplete) {
            onScreenshotComplete(results);
        }
    };

    /**
     * Tests the URL by opening in a new tab
     */
    const testUrl = () => {
        if (isValidUrl && url.trim()) {
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        }
    };

    /**
     * Downloads all captured screenshots
     */
    const downloadAllScreenshots = () => {
        if (!captureResults || !captureResults.results) return;

        const successful = captureResults.results.filter(r => r.success);

        successful.forEach((result, index) => {
            if (result.blob) {
                const filename = `screenshot-${result.templateName || result.device}-${Date.now()}-${index + 1}.png`
                    .replace(/\s+/g, '-')
                    .toLowerCase();

                const url = URL.createObjectURL(result.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });
    };

    /**
     * Renders a preview of a screenshot
     */
    const renderScreenshotPreview = (result) => {
        if (!result.success) return null;

        return (
            <div className="screenshot-preview">
                <img
                    src={result.url}
                    alt={`Screenshot: ${result.templateName}`}
                    className="w-full h-32 object-cover rounded"
                    onError={(e) => {
                        e.target.src = `data:image/svg+xml;base64,${btoa(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 200">
                                <rect width="100%" height="100%" fill="#f3f4f6"/>
                                <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="Arial" font-size="14">
                                    ${result.templateName}
                                </text>
                            </svg>
                        `)}`;
                    }}
                />
            </div>
        );
    };

    return (
        <div className="site-screenshots-component bg-white rounded-xl shadow-lg p-6">
            <style>{`
                .site-screenshots-component {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                }

                .screenshot-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e5e7eb;
                }

                .screenshot-toggle {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                }

                .screenshot-toggle input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                    margin-right: 0.75rem;
                    cursor: pointer;
                    accent-color: #3b82f6;
                }

                .screenshot-toggle-label {
                    font-weight: 600;
                    font-size: 1.125rem;
                    color: #1f2937;
                    display: flex;
                    align-items: center;
                }

                .screenshot-toggle-label i {
                    margin-right: 0.5rem;
                    color: #3b82f6;
                    font-size: 1.25rem;
                }

                .url-input-section {
                    margin-bottom: 1.5rem;
                }

                .url-input-wrapper {
                    position: relative;
                    width: 100%;
                }

                .url-input {
                    width: 100%;
                    padding: 0.875rem 3.5rem 0.875rem 1rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 0.75rem;
                    font-size: 1rem;
                    transition: all 0.2s ease;
                    background-color: #f9fafb;
                }

                .url-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    background-color: white;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .url-input.valid {
                    border-color: #10b981;
                    background-color: #f0fdf4;
                }

                .url-input.invalid {
                    border-color: #ef4444;
                    background-color: #fef2f2;
                }

                .url-button {
                    position: absolute;
                    right: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .url-button.valid {
                    color: #10b981;
                }

                .url-button.valid:hover {
                    background-color: rgba(16, 185, 129, 0.1);
                }

                .url-button:disabled {
                    color: #d1d5db;
                    cursor: not-allowed;
                }

                .validation-message {
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    display: flex;
                    align-items: center;
                }

                .validation-message.success {
                    background-color: #ecfdf5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                }

                .validation-message.error {
                    background-color: #fef2f2;
                    color: #991b1b;
                    border: 1px solid #fca5a5;
                }

                .capture-results {
                    margin-top: 1.5rem;
                    padding: 1.5rem;
                    background-color: #f9fafb;
                    border-radius: 0.75rem;
                    border: 1px solid #e5e7eb;
                }

                .results-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                }

                .results-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .result-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.75rem;
                    padding: 1rem;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .result-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }

                .result-card.success {
                    border-left: 4px solid #10b981;
                }

                .result-card.error {
                    border-left: 4px solid #ef4444;
                }

                .result-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .result-icon {
                    margin-right: 0.5rem;
                    color: #6b7280;
                }

                .download-all-btn {
                    width: 100%;
                    padding: 0.875rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }

                .download-all-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }

                .download-all-btn:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .info-note {
                    margin-top: 1.5rem;
                    padding: 1rem;
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    border: 1px solid #ffd43b;
                    border-radius: 0.75rem;
                    color: #664d03;
                    font-size: 0.875rem;
                }

                .screenshot-preview {
                    margin-top: 0.75rem;
                    border-radius: 0.5rem;
                    overflow: hidden;
                }
            `}</style>

            <div className="screenshot-header">
                <div className="screenshot-toggle" onClick={() => onToggle && onToggle(!isSelected)}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggle && onToggle(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="screenshot-toggle-label">
                        <i className="fas fa-camera"></i>
                        {t('screenshots.title', 'Website Screenshots')}
                    </div>
                </div>
            </div>

            {isSelected && (
                <div className="screenshot-content">
                    <div className="url-input-section">
                        <div className="url-input-wrapper">
                            <input
                                type="url"
                                className={`url-input ${isValidUrl ? 'valid' : url.trim() && !isValidUrl ? 'invalid' : ''}`}
                                value={url}
                                onChange={handleUrlChange}
                                placeholder="https://example.com or example.com"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                type="button"
                                className={`url-button ${isValidUrl ? 'valid' : 'disabled'}`}
                                onClick={testUrl}
                                disabled={!isValidUrl || !url.trim()}
                                title={isValidUrl ? `Test ${url}` : 'Enter a valid URL first'}
                            >
                                <i className="fas fa-external-link-alt"></i>
                            </button>
                        </div>

                        {url.trim() && (
                            <div className={`validation-message ${isValidUrl ? 'success' : 'error'}`}>
                                <i className={`fas ${isValidUrl ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
                                <span>
                                    {isValidUrl
                                        ? 'Valid URL - Ready for screenshot capture'
                                        : 'Please enter a valid website URL'
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SiteScreenshots;