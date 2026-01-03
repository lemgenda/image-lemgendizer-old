import {
    URL_CONSTANTS
} from '../constants';
import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';
import { DEVICE_PRESETS, DEVICE_VIEWPORTS, SCREENSHOT_QUALITY } from '../constants';

/**
 * Fetch with retry logic for rate limiting
 * @async
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            return response;
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw lastError || new Error('All retry attempts failed');
}

/**
 * Gets viewport configuration based on template
 * @param {Object} template - Screenshot template
 * @returns {Object} Viewport configuration
 */
const getViewportConfig = (template) => {
    const isMobile = template.id.includes('mobile');
    const isTablet = template.id.includes('tablet');

    let viewport = {
        isMobile: false,
        isLandscape: false,
        hasTouch: false,
        width: 1920,
        height: 1080
    };

    if (isMobile) {
        viewport.isMobile = true;
        viewport.hasTouch = true;
        viewport.width = 375;
        viewport.height = 667;
    } else if (isTablet) {
        viewport.width = 768;
        viewport.height = 1024;
    } else {
        viewport.width = template.width || 1920;
        viewport.height = template.height === 'auto' ? 1080 : (template.height || 1080);
    }

    return viewport;
};

/**
 * Captures a screenshot using Browserless API via Vite proxy
 * @async
 * @param {string} url - URL to capture
 * @param {Object} template - Screenshot template
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Screenshot result
 */
export const captureScreenshot = async (url, template, options = {}) => {
    try {
        let processedUrl = url;
        if (typeof processedUrl !== 'string') {
            processedUrl = String(processedUrl);
        }

        if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
            processedUrl = `https://${processedUrl}`;
        }

        if (processedUrl.includes('localhost:5173/')) {
            processedUrl = processedUrl.replace('localhost:5173/', '');
        }

        const viewport = getViewportConfig(template);
        const isFullPage = template.id.includes('-full');

        const requestBody = {
            url: processedUrl,
            bestAttempt: true,
            blockConsentModals: true,
            options: {
                optimizeForSpeed: true,
                fullPage: isFullPage,
                type: 'jpeg',
                quality: options.quality || 90
            },
            viewport: viewport
        };

        const response = await fetchWithRetry(
            '/api/browserless/chromium/screenshot',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            },
            3
        );

        if (!response.ok) {
            throw new Error('Screenshot API failed');
        }

        const blob = await response.blob();

        const timestamp = new Date().toISOString().split('T')[0];
        const templateName = template.name.replace(/\s+/g, '-').toLowerCase();
        const domain = new URL(processedUrl).hostname.replace('www.', '');
        const filename = `${domain}-${templateName}-${timestamp}.jpg`;

        return {
            file: blob,
            name: filename,
            template: template,
            format: 'jpg',
            processed: true,
            url: processedUrl,
            width: viewport.width,
            height: viewport.height
        };

    } catch (error) {
        const errorImage = await createScreenshotErrorImage(template, url, error);
        return {
            ...errorImage,
            error: error.message,
            processed: false
        };
    }
};

/**
 * Creates error image for failed screenshots
 * @async
 * @param {Object} template - Screenshot template
 * @param {string} url - URL that failed
 * @param {Error} error - Error object
 * @returns {Promise<Object>} Error image data
 */
const createScreenshotErrorImage = async (template, url, error) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const width = template?.width || 1200;
        const height = template?.height === 'auto' ? 800 : template?.height || 800;

        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#dc3545';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        ctx.fillStyle = '#dc3545';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const warningSymbol = 'ERR';
        ctx.fillText(warningSymbol, width / 2, height / 2 - 100);

        ctx.font = 'bold 36px Arial';
        ctx.fillText('Screenshot Failed', width / 2, height / 2 - 20);

        ctx.fillStyle = '#6c757d';
        ctx.font = '20px Arial';
        ctx.fillText(`URL: ${url}`, width / 2, height / 2 + 30);

        ctx.fillText(`Template: ${template?.name || 'Unknown'}`, width / 2, height / 2 + 60);

        ctx.fillStyle = '#495057';
        ctx.font = '16px Arial';
        const errorMessage = error.message || 'Unknown error occurred';
        const maxWidth = width - 100;
        const lines = wrapText(ctx, errorMessage, maxWidth);

        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, height / 2 + 100 + (index * 25));
        });

        canvas.toBlob((blob) => {
            resolve({
                file: new File([blob], `error-${template?.name || 'screenshot'}.jpg`, { type: 'image/jpeg' }),
                name: `error-${template?.name || 'screenshot'}.jpg`,
                template: template,
                format: 'jpg',
                processed: false
            });
        }, 'image/jpeg', 0.8);
    });
};

/**
 * Wraps text to fit within specified width
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width
 * @returns {Array<string>} Array of text lines
 */
const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
};

/**
 * Captures multiple screenshots with reduced concurrency
 * @async
 * @param {Array<Object>} templates - Screenshot templates
 * @param {string} url - URL to capture
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Screenshot results
 */
export async function captureMultipleScreenshots(templates, url, options = {}) {
    const results = [];
    const maxConcurrent = 1;

    for (let i = 0; i < templates.length; i += maxConcurrent) {
        const batch = templates.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(template => {
            return captureScreenshot(url, template, options);
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        if (i + maxConcurrent < templates.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    return {
        url,
        timestamp: new Date().toISOString(),
        results,
        successful: results.filter(r => r.processed).length,
        total: results.length,
        hasPlaceholders: results.some(r => r.isPlaceholder)
    };
}

/**
 * Converts screenshot results to processed image format
 * @param {Object} screenshotResults - Screenshot results
 * @returns {Array<Object>} Array of processed images
 */
export function convertScreenshotResultsToImages(screenshotResults) {
    return screenshotResults.results
        .filter(result => result.file && result.template)
        .map((result, index) => {
            const timestamp = Date.now();
            const baseName = `${result.template.platform}-${result.template.name}-${timestamp}`;
            const fileName = `${baseName}-${index + 1}.${result.format}`;

            return {
                file: result.file,
                name: fileName,
                template: result.template,
                format: result.format,
                processed: result.processed,
                success: !result.error,
                error: result.error,
                url: result.url,
                width: result.width,
                height: result.height
            };
        });
}

/**
 * Gets default screenshot templates for initial selection
 * @returns {Array<string>} Array of default template IDs
 */
export function getDefaultScreenshotTemplates() {
    return ['screenshots-mobile', 'screenshots-desktop'];
}

/**
 * Gets all screenshot template IDs
 * @returns {Array<string>} Array of all template IDs
 */
export function getAllScreenshotTemplateIds() {
    return Object.keys(SCREENSHOT_TEMPLATES || {});
}

/**
 * Filters screenshot templates by selected IDs
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @returns {Array<Object>} Filtered screenshot templates
 */
export function filterScreenshotTemplates(selectedTemplateIds) {
    if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
        return [];
    }

    const allTemplates = [];

    if (SCREENSHOT_TEMPLATES && typeof SCREENSHOT_TEMPLATES === 'object') {
        Object.values(SCREENSHOT_TEMPLATES).forEach(template => {
            if (selectedTemplateIds.includes(template.id)) {
                allTemplates.push(template);
            }
        });
    }

    return allTemplates;
}

/**
 * Gets screenshot template by ID
 * @param {string} templateId - Template ID
 * @returns {Object|null} Screenshot template or null
 */
export function getScreenshotTemplateById(templateId) {
    return SCREENSHOT_TEMPLATES[templateId] || null;
}

/**
 * Gets all screenshot templates
 * @returns {Array<Object>} Array of all screenshot templates
 */
export function getAllScreenshotTemplates() {
    return Object.values(SCREENSHOT_TEMPLATES || {});
}

/**
 * Gets regular screenshot templates (non-full page)
 * @returns {Array<Object>} Array of regular screenshot templates
 */
export function getRegularScreenshotTemplates() {
    return Object.values(SCREENSHOT_TEMPLATES || {}).filter(t => !t.id.includes('-full'));
}

/**
 * Gets full page screenshot templates
 * @returns {Array<Object>} Array of full page screenshot templates
 */
export function getFullPageScreenshotTemplates() {
    return Object.values(SCREENSHOT_TEMPLATES || {}).filter(t => t.id.includes('-full'));
}

/**
 * Gets default screenshot template objects for initial selection
 * @returns {Array<Object>} Array of default screenshot template objects
 */
export function getDefaultScreenshotTemplateObjects() {
    const regularTemplates = getRegularScreenshotTemplates();
    return regularTemplates.filter(t =>
        t.id === 'screenshots-mobile' ||
        t.id === 'screenshots-desktop'
    );
}

/**
 * Gets screenshot template configurations
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @returns {Array<Object>} Array of screenshot template configurations
 */
export function getScreenshotTemplateConfigs(selectedTemplateIds) {
    if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
        return [];
    }

    return selectedTemplateIds
        .map(id => SCREENSHOT_TEMPLATES[id])
        .filter(template => template);
}

/**
 * Prepares screenshot templates for capture
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {string} url - URL to capture
 * @returns {Array<Object>} Prepared screenshot templates
 */
export function prepareScreenshotTemplates(selectedTemplateIds, url) {
    const templates = getScreenshotTemplateConfigs(selectedTemplateIds);

    return templates.map(template => ({
        ...template,
        requestBody: {
            ...template.requestBody,
            url: url
        }
    }));
}

/**
 * Orchestrates screenshot processing
 * @async
 * @param {Array<string>} selectedTemplateIds - Selected template IDs
 * @param {string} url - URL to capture
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Screenshot processing results
 */
export async function orchestrateScreenshotProcessing(selectedTemplateIds, url, onProgress = null) {
    if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
        throw new Error('No screenshot templates selected');
    }

    if (!url || url.trim() === '') {
        throw new Error('No URL provided');
    }

    if (onProgress) onProgress('preparing-screenshots', 10);

    const screenshotTemplates = getScreenshotTemplateConfigs(selectedTemplateIds);

    if (onProgress) onProgress('capturing-screenshots', 30);

    const results = await captureMultipleScreenshots(screenshotTemplates, url, {
        delayBetweenRequests: 2000
    });

    if (onProgress) onProgress('processing-results', 80);

    const processedImages = convertScreenshotResultsToImages(results);

    if (onProgress) onProgress('completed', 100);

    return {
        results,
        processedImages,
        success: results.successful > 0,
        total: results.total,
        successful: results.successful
    };
}

/**
 * Handles screenshot template selection
 * @param {Array<string>} currentSelected - Currently selected template IDs
 * @param {string} templateId - Template ID to toggle
 * @param {boolean} isScreenshotSelected - Whether screenshot feature is selected
 * @returns {Array<string>} Updated selected template IDs
 */
export function handleScreenshotTemplateToggle(currentSelected, templateId, isScreenshotSelected) {
    if (!isScreenshotSelected) {
        return currentSelected;
    }

    const isScreenshotTemplate = templateId.startsWith('screenshots-');

    if (!isScreenshotTemplate) {
        return currentSelected.includes(templateId)
            ? currentSelected.filter(id => id !== templateId)
            : [...currentSelected, templateId];
    }

    if (currentSelected.includes(templateId)) {
        return currentSelected.filter(id => id !== templateId);
    } else {
        return [...currentSelected, templateId];
    }
}

/**
 * Calculates screenshot capture progress
 * @param {number} current - Current progress
 * @param {number} total - Total progress
 * @returns {number} Progress percentage
 */
export function calculateCaptureProgress(current, total) {
    if (total === 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
}

/**
 * Creates screenshot capture status message
 * @param {number} successful - Number of successful captures
 * @param {number} total - Total number of captures
 * @param {boolean} hasPlaceholders - Whether placeholders were generated
 * @returns {string} Status message
 */
export function createCaptureStatusMessage(successful, total, hasPlaceholders) {
    if (successful === total) {
        return `Successfully captured ${successful} screenshots`;
    } else if (successful > 0) {
        return `Captured ${successful} of ${total} screenshots${hasPlaceholders ? ' (some placeholders generated)' : ''}`;
    } else {
        return 'Failed to capture screenshots';
    }
}

/**
 * Gets all screenshot templates with quality settings applied
 * @returns {Array<Object>} Array of screenshot templates with quality settings
 */
export const getScreenshotTemplatesWithQuality = () => {
    return Object.values(SCREENSHOT_TEMPLATES || {}).map(template => {
        const updatedTemplate = { ...template };
        if (updatedTemplate.requestBody?.options) {
            updatedTemplate.requestBody.options.quality = SCREENSHOT_QUALITY.JPEG_QUALITY;
        }
        return updatedTemplate;
    });
};

/**
 * Gets device viewport configuration
 * @param {string} deviceType - Device type ('mobile', 'tablet', 'desktop', 'desktop-hd')
 * @returns {Object} Viewport configuration with width and height
 */
export const getDeviceViewport = (deviceType) => {
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

/**
 * Gets template dimensions as formatted string
 * @param {Object} template - Screenshot template object
 * @returns {string} Formatted dimensions string (e.g., "1920×1080" or "375×auto")
 */
export const getTemplateDimensions = (template) => {
    const deviceType = template.id.includes('mobile') ? 'mobile' :
        template.id.includes('tablet') ? 'tablet' :
            template.id.includes('hd') ? 'desktop-hd' : 'desktop';

    const viewport = getDeviceViewport(deviceType);

    if (template.height === 'auto') {
        return `${viewport.width}×auto`;
    }
    return `${viewport.width}×${viewport.height}`;
};

/**
 * Gets device name based on template ID
 * @param {string} templateId - Template ID
 * @returns {string} Device name
 */
export const getDeviceName = (templateId) => {
    if (templateId.includes('mobile')) return DEVICE_PRESETS.mobile.name;
    if (templateId.includes('tablet')) return DEVICE_PRESETS.tablet.name;
    if (templateId.includes('hd')) return 'Desktop HD';
    return DEVICE_PRESETS.desktop.name;
};

/**
 * Gets initial templates for selection
 * @returns {Array<string>} Array of default template IDs
 */
export const getInitialTemplates = () => {
    return ['screenshots-mobile', 'screenshots-desktop'];
};