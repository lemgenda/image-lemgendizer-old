import {
    VERCEL_ENDPOINTS,
    DEFAULT_SCREENSHOT_TIMEOUT,
    DEVICE_PRESETS
} from './constants/sharedConstants';

import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';

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
        const timeout = Math.min(options.timeout || DEFAULT_SCREENSHOT_TIMEOUT, 30000);

        const requestBody = {
            url: cleanUrl,
            device: device,
            width: width,
            height: height,
            fullPage: options.fullPage || false,
            templateId: templateId,
            timeout: timeout
        };

        let lastError = null;

        for (const endpoint of VERCEL_ENDPOINTS) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(endpoint.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

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
            const placeholder = await createPlaceholderScreenshot(cleanUrl, width, height, device, templateId);
            return {
                success: true,
                blob: placeholder.blob,
                url: placeholder.url,
                device,
                dimensions: { width, height },
                method: 'placeholder',
                isPlaceholder: true,
                warning: 'API endpoint failed, using placeholder',
                responseTime: 0
            };
        }

        throw new Error('No endpoints available');

    } catch (error) {
        const placeholder = await createPlaceholderScreenshot(url,
            options.width || 1280,
            options.height || 720,
            options.device || 'desktop',
            templateId);

        return {
            success: true,
            blob: placeholder.blob,
            url: placeholder.url,
            device: options.device || 'desktop',
            dimensions: { width: options.width || 1280, height: options.height || 720 },
            method: 'placeholder-fallback',
            isPlaceholder: true,
            warning: 'Capture failed, using placeholder',
            responseTime: 0
        };
    }
}

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
                blob,
                url: URL.createObjectURL(blob)
            });
        }, 'image/png', 0.9);
    });
}

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

export function getDeviceConfig(device) {
    return DEVICE_PRESETS[device] || DEVICE_PRESETS.desktop;
}

export function getScreenshotTemplate(id) {
    return SCREENSHOT_TEMPLATES[id] || null;
}

export function getAllScreenshotTemplates() {
    return Object.values(SCREENSHOT_TEMPLATES);
}

export function getScreenshotTemplatesByCategory(category) {
    return getAllScreenshotTemplates().filter(template =>
        template.category === category
    );
}