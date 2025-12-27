import { VERCEL_ENDPOINTS, DEFAULT_SCREENSHOT_TIMEOUT } from '../constants/sharedConstants';
import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';
/**
 * Captures screenshot from URL using the working backend
 * @param {string} url - Website URL
 * @param {string} templateId - Template ID (e.g., 'screenshots-desktop')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Screenshot result
 */
export async function captureScreenshot(url, templateId = 'screenshots-desktop', options = {}) {
    let controller = null;
    let timeoutId = null;

    try {
        // Clean URL (same as backend)
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }
        cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

        const width = options.width || template?.width || 1280;
        const height = options.height || (template?.height === 'auto' ? null : template?.height) || 720;
        const timeout = Math.min(options.timeout || DEFAULT_SCREENSHOT_TIMEOUT, 60000);

        const requestBody = {
            url: cleanUrl,
            templateId: templateId,
            timeout: timeout
        };

        // Add optional parameters only if provided
        if (width !== null && width !== undefined) requestBody.width = width;
        if (height !== null && height !== undefined) requestBody.height = height;
        if (options.fullPage !== undefined) requestBody.fullPage = Boolean(options.fullPage);

        // Use your working backend endpoint
        const endpoint = 'https://image-lemgendizer-old-x2qz.vercel.app/api/screenshot';

        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'image/png, application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        controller = null;
        timeoutId = null;

        const contentType = response.headers.get('content-type');

        if (response.ok && contentType && contentType.includes('image')) {
            const blob = await response.blob();
            const dimensions = response.headers.get('x-dimensions');
            const method = response.headers.get('x-method') || 'browserless';
            const isPlaceholder = response.headers.get('x-is-placeholder') === 'true';
            const device = response.headers.get('x-device') || 'desktop';
            const template = SCREENSHOT_TEMPLATES[templateId] || SCREENSHOT_TEMPLATES['screenshots-desktop'];

            return {
                success: true,
                blob,
                url: URL.createObjectURL(blob),
                device,
                template,
                dimensions: dimensions ? JSON.parse(dimensions) : { width: 1280, height: 720 },
                method,
                isPlaceholder,
                responseTime: parseInt(response.headers.get('x-response-time') || '0')
            };
        } else {
            // Handle JSON error response
            const errorData = await response.json();
            throw new Error(errorData.error || 'Unknown error from API');
        }

    } catch (error) {
        // Return placeholder instead of throwing
        const placeholder = await createPlaceholderScreenshot(
            url,
            options.width || 1280,
            options.height || 720,
            'desktop',
            templateId
        );

        return {
            success: true,
            blob: placeholder.blob,
            url: placeholder.url,
            device: 'desktop',
            template: templateId,
            dimensions: { width: options.width || 1280, height: options.height || 720 },
            method: 'placeholder-fallback',
            isPlaceholder: true,
            warning: error.message || 'Capture failed, using placeholder',
            responseTime: 0
        };
    } finally {
        if (controller) controller.abort();
        if (timeoutId) clearTimeout(timeoutId);
    }
}

/**
 * Creates placeholder screenshot for fallback
 */
async function createPlaceholderScreenshot(url, width, height, device, templateId) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#f0f9ff');
        gradient.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Browser window
        ctx.fillStyle = '#e5e5e5';
        ctx.fillRect(20, 20, width - 40, 60);

        // Browser buttons
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

        // URL bar
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(120, 35, width - 160, 30);
        ctx.strokeStyle = '#d1d5db';
        ctx.strokeRect(120, 35, width - 160, 30);

        ctx.fillStyle = '#4b5563';
        ctx.font = '14px Arial, sans-serif';
        const displayUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
        ctx.fillText(displayUrl, 125, 56);

        // Content area
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20, 100, width - 40, height - 140);
        ctx.strokeStyle = '#e5e7eb';
        ctx.strokeRect(20, 100, width - 40, height - 140);

        // Template info
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
        ctx.fillText('Placeholder - Configure Browserless API for real screenshots', width / 2, height / 2 + 60);

        canvas.toBlob((blob) => {
            resolve({
                blob,
                url: URL.createObjectURL(blob)
            });
        }, 'image/png', 0.9);
    });
}

/**
 * Captures screenshots for multiple templates at once
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
 */
export async function testScreenshotAPI() {
    try {
        const response = await fetch('https://image-lemgendizer-old-x2qz.vercel.app/api/health');

        if (response.ok) {
            const data = await response.json();
            return {
                available: true,
                endpoint: 'https://image-lemgendizer-old-x2qz.vercel.app/api/screenshot',
                message: 'Screenshot API is available',
                health: data
            };
        }

        return {
            available: false,
            message: 'Health check failed'
        };
    } catch (error) {
        return {
            available: false,
            message: `API test failed: ${error.message}`
        };
    }
}