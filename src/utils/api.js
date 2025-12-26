import {
    VERCEL_ENDPOINTS,
    DEFAULT_SCREENSHOT_TIMEOUT,
    ERROR_MESSAGES,
    DEVICE_PRESETS,
    SCREENSHOT_TEMPLATES
} from './constants/sharedConstants';

/**
 * Captures screenshot using API endpoint
 * @async
 * @param {string} url - Website URL to capture
 * @param {string} templateId - Template ID for dimensions
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Screenshot result with blob, dimensions, and metadata
 */
export async function captureScreenshot(url, templateId = 'desktop', options = {}) {
    try {
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }
        cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

        const template = SCREENSHOT_TEMPLATES[templateId] || SCREENSHOT_TEMPLATES.desktop;
        const width = options.width || template?.width || 1280;
        const height = options.height || (template?.height === 'auto' ? null : template?.height) || 720;
        const device = options.device || 'desktop';

        const requestBody = {
            url: cleanUrl,
            device: device,
            width: width,
            height: height,
            fullPage: options.fullPage || false,
            templateId: templateId,
            quality: options.quality || 80,
            timeout: options.timeout || DEFAULT_SCREENSHOT_TIMEOUT
        };

        let lastError = null;

        for (const endpoint of VERCEL_ENDPOINTS) {
            try {
                const response = await fetch(endpoint.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(DEFAULT_SCREENSHOT_TIMEOUT)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API error: ${response.status}`);
                }

                const contentType = response.headers.get('content-type');

                if (contentType && contentType.includes('image')) {
                    const blob = await response.blob();
                    const dimensions = response.headers.get('x-dimensions');
                    const method = response.headers.get('x-method') || 'api';
                    const isPlaceholder = response.headers.get('x-placeholder') === 'true';

                    return {
                        success: true,
                        blob,
                        url: URL.createObjectURL(blob),
                        device,
                        dimensions: dimensions ? JSON.parse(dimensions) : { width, height },
                        method,
                        isPlaceholder,
                        warning: response.headers.get('x-warning') || null,
                        responseTime: parseInt(response.headers.get('x-response-time') || '0')
                    };
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Unknown error from API');
                }
            } catch (error) {
                lastError = error;
                continue;
            }
        }

        if (lastError) {
            return await createPlaceholderScreenshot(cleanUrl, width, height, device, templateId);
        }

        throw new Error('No endpoints available');

    } catch (error) {
        return {
            success: false,
            error: error.message || ERROR_MESSAGES.SCREENSHOT_CAPTURE_FAILED,
            url: url
        };
    }
}

/**
 * Creates placeholder screenshot when API capture fails
 * @async
 * @param {string} url - Website URL
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} device - Device type
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Placeholder screenshot
 */
async function createPlaceholderScreenshot(url, width, height, device, templateId) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#f0f9ff');
        gradient.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#e5e5e5';
        ctx.fillRect(20, 20, width - 40, 60);

        ctx.fillStyle = '#ff5f57';
        ctx.beginPath();
        ctx.arc(45, 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffbd2e';
        ctx.beginPath();
        ctx.arc(70, 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#28ca42';
        ctx.beginPath();
        ctx.arc(95, 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(120, 35, width - 160, 30);
        ctx.strokeStyle = '#d1d5db';
        ctx.strokeRect(120, 35, width - 160, 30);

        ctx.fillStyle = '#4b5563';
        ctx.font = '14px Arial, sans-serif';
        const displayUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
        ctx.fillText(displayUrl, 125, 56);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20, 100, width - 40, height - 140);
        ctx.strokeStyle = '#e5e7eb';
        ctx.strokeRect(20, 100, width - 40, height - 140);

        ctx.fillStyle = '#1e40af';
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Template: ${templateId}`, width / 2, height / 2 - 60);

        ctx.fillStyle = '#374151';
        ctx.font = '18px Arial, sans-serif';
        ctx.fillText(`${width} × ${height}`, width / 2, height / 2 - 20);

        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText(`Device: ${device}`, width / 2, height / 2 + 20);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText('Placeholder - Real screenshot requires API configuration', width / 2, height / 2 + 60);

        canvas.toBlob((blob) => {
            resolve({
                success: true,
                blob,
                url: URL.createObjectURL(blob),
                device,
                dimensions: { width, height },
                method: 'placeholder',
                isPlaceholder: true,
                warning: 'API endpoint failed, using placeholder',
                responseTime: 0
            });
        }, 'image/png', 0.9);
    });
}

/**
 * Captures multiple screenshots for template processing
 * @async
 * @param {string} url - Website URL
 * @param {Array<string>} templateIds - Template IDs to capture
 * @param {Object} options - Capture options
 * @returns {Promise<Array<Object>>} Array of screenshot results
 */
export async function captureScreenshotsForTemplates(url, templateIds, options = {}) {
    const results = [];

    for (const templateId of templateIds) {
        try {
            const result = await captureScreenshot(url, templateId, options);
            results.push({
                templateId,
                ...result
            });
        } catch (error) {
            results.push({
                templateId,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Tests if the screenshot API is available
 * @async
 * @returns {Promise<Object>} API health check result
 */
export async function testScreenshotAPI() {
    try {
        for (const endpoint of VERCEL_ENDPOINTS) {
            try {
                const response = await fetch(`${endpoint.url.replace('/screenshot', '')}/health`, {
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    return {
                        available: true,
                        endpoint: endpoint.url,
                        message: 'Screenshot API is available'
                    };
                }
            } catch {
                continue;
            }
        }

        return {
            available: false,
            message: 'No screenshot API endpoints available'
        };
    } catch (error) {
        return {
            available: false,
            message: `API test failed: ${error.message}`
        };
    }
}

/**
 * Gets device configuration
 * @param {string} device - Device type
 * @returns {Object} Device configuration
 */
export function getDeviceConfig(device) {
    return DEVICE_PRESETS[device] || DEVICE_PRESETS.desktop;
}

/**
 * Gets screenshot template by ID
 * @param {string} id - Template ID
 * @returns {Object|null} Template object or null
 */
export function getScreenshotTemplate(id) {
    return SCREENSHOT_TEMPLATES[id] || null;
}

/**
 * Gets all screenshot templates
 * @returns {Array<Object>} Array of screenshot templates
 */
export function getAllScreenshotTemplates() {
    return Object.values(SCREENSHOT_TEMPLATES);
}

/**
 * Gets screenshot templates by category
 * @param {string} category - Template category
 * @returns {Array<Object>} Array of screenshot templates
 */
export function getScreenshotTemplatesByCategory(category) {
    return getAllScreenshotTemplates().filter(template =>
        template.category === category
    );
}