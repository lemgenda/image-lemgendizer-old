// screenshot.js - Vercel-compatible FIXED production version

// ================================
// Device & Screenshot Constants
// ================================

const DEVICE_CONFIGS = {
    mobile: {
        name: 'Mobile',
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    },
    tablet: {
        name: 'Tablet',
        viewport: { width: 768, height: 1024 },
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    },
    desktop: {
        name: 'Desktop',
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    },
    'desktop-hd': {
        name: 'Desktop HD',
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    }
};

// Match your frontend SCREENSHOT_TEMPLATES exactly
const SCREENSHOT_TEMPLATE_CONFIGS = {
    'screenshots-mobile': {
        id: 'screenshots-mobile',
        name: 'Mobile Screenshot',
        device: 'mobile',
        width: 375,
        height: 667,
        fullPage: false
    },
    'screenshots-tablet': {
        id: 'screenshots-tablet',
        name: 'Tablet Screenshot',
        device: 'tablet',
        width: 768,
        height: 1024,
        fullPage: false
    },
    'screenshots-desktop': {
        id: 'screenshots-desktop',
        name: 'Desktop Screenshot',
        device: 'desktop',
        width: 1280,
        height: 720,
        fullPage: false
    },
    'screenshots-desktop-hd': {
        id: 'screenshots-desktop-hd',
        name: 'Desktop HD Screenshot',
        device: 'desktop-hd',
        width: 1920,
        height: 1080,
        fullPage: false
    },
    'screenshots-mobile-full': {
        id: 'screenshots-mobile-full',
        name: 'Mobile Full Page',
        device: 'mobile',
        width: 375,
        height: null,
        fullPage: true
    },
    'screenshots-tablet-full': {
        id: 'screenshots-tablet-full',
        name: 'Tablet Full Page',
        device: 'tablet',
        width: 768,
        height: null,
        fullPage: true
    },
    'screenshots-desktop-full': {
        id: 'screenshots-desktop-full',
        name: 'Desktop Full Page',
        device: 'desktop',
        width: 1280,
        height: null,
        fullPage: true
    },
    'screenshots-desktop-hd-full': {
        id: 'screenshots-desktop-hd-full',
        name: 'Desktop HD Full Page',
        device: 'desktop-hd',
        width: 1920,
        height: null,
        fullPage: true
    }
};

// ================================
// Helper Functions
// ================================

function getDeviceConfig(deviceName) {
    return DEVICE_CONFIGS[deviceName] || DEVICE_CONFIGS.desktop;
}

function getScreenshotTemplate(templateId) {
    return SCREENSHOT_TEMPLATE_CONFIGS[templateId] || SCREENSHOT_TEMPLATE_CONFIGS['screenshots-desktop'];
}

function getTemplateViewport(templateId, customWidth, customHeight, customFullPage) {
    const template = getScreenshotTemplate(templateId);
    const device = template.device || 'desktop';
    const deviceConfig = getDeviceConfig(device);

    const width = customWidth || template.width;
    const fullPage = customFullPage !== undefined ? customFullPage : template.fullPage;
    const height = fullPage ? null : (customHeight || template.height);

    return {
        width,
        height,
        fullPage,
        device,
        deviceScaleFactor: deviceConfig.deviceScaleFactor,
        isMobile: deviceConfig.isMobile,
        hasTouch: deviceConfig.hasTouch
    };
}

function validateAndCleanUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new Error('URL is required');
    }

    let cleanUrl = url.trim();

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

    try {
        new URL(cleanUrl);
        return cleanUrl;
    } catch {
        throw new Error(`Invalid URL format: ${url}`);
    }
}

function setResponseHeaders(res, headers, origin, isError = false) {
    const allowedOrigins = [
        'https://image-lemgendizer.vercel.app',
        'https://image-lemgendizer-old-x2qz.vercel.app',
        'https://lemgenda.github.io',
        'http://localhost:3000',
        'http://localhost:5173'
    ];

    // Set content type
    res.setHeader('Content-Type', isError ? 'application/json' : 'image/png');

    // Set custom headers
    if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                res.setHeader(key, value.toString());
            }
        });
    }

    // Set both placeholder headers for compatibility
    if (headers && headers['x-is-placeholder'] !== undefined) {
        res.setHeader('x-placeholder', headers['x-is-placeholder']);
    }

    // Set CORS headers
    if (origin && allowedOrigins.some(allowed =>
        origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Expose-Headers', 'x-dimensions, x-method, x-device, x-template, x-is-placeholder, x-placeholder, x-warning, Content-Type, Content-Length, x-response-time');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (!isError) {
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    }
}

function createErrorResponse(error, isPlaceholder = true) {
    return {
        success: false,
        error: error.message || 'Screenshot capture failed',
        isPlaceholder: isPlaceholder,
        details: error.details || error.toString()
    };
}

// ================================
// Main Handler - Vercel-Compatible FIXED Version
// ================================

export default async function handler(req, res) {
    const origin = req.headers.origin;

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(405).json({
            error: 'Method not allowed',
            allowed: ['POST']
        });
    }

    try {
        // FIX: Read body ONCE and store it
        let body;

        // In Vercel, req.body might already be parsed if Content-Type is application/json
        if (typeof req.body === 'string') {
            try {
                body = JSON.parse(req.body);
            } catch (parseError) {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid JSON format',
                    isPlaceholder: true,
                    details: parseError.message
                });
            }
        } else if (req.body && typeof req.body === 'object') {
            // Body is already parsed (Vercel does this automatically)
            body = req.body;
        } else {
            // Need to read the raw body
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const rawBody = Buffer.concat(chunks).toString();
            try {
                body = JSON.parse(rawBody);
            } catch {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid JSON format',
                    isPlaceholder: true
                });
            }
        }

        const url = body.url || body.URL;
        if (!url) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: URL',
                isPlaceholder: true
            });
        }

        const templateId = body.templateId || 'screenshots-desktop';
        const customWidth = parseInt(body.width) || null;
        const customHeight = parseInt(body.height) || null;
        const customFullPage = body.fullPage !== undefined ? Boolean(body.fullPage) : undefined;
        const timeout = Math.min(parseInt(body.timeout) || 30000, 60000);

        // Validate and clean URL
        let cleanUrl;
        try {
            cleanUrl = url.trim();
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://' + cleanUrl;
            }
            cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');
            new URL(cleanUrl); // Validate URL format
        } catch {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(400).json({
                success: false,
                error: `Invalid URL format: ${url}`,
                isPlaceholder: true
            });
        }

        // Device templates
        const TEMPLATES = {
            'screenshots-mobile': { width: 375, height: 667, device: 'mobile' },
            'screenshots-tablet': { width: 768, height: 1024, device: 'tablet' },
            'screenshots-desktop': { width: 1280, height: 720, device: 'desktop' },
            'screenshots-desktop-hd': { width: 1920, height: 1080, device: 'desktop-hd' },
            'screenshots-mobile-full': { width: 375, height: null, device: 'mobile', fullPage: true },
            'screenshots-tablet-full': { width: 768, height: null, device: 'tablet', fullPage: true },
            'screenshots-desktop-full': { width: 1280, height: null, device: 'desktop', fullPage: true },
            'screenshots-desktop-hd-full': { width: 1920, height: null, device: 'desktop-hd', fullPage: true }
        };

        const template = TEMPLATES[templateId] || TEMPLATES['screenshots-desktop'];
        const width = customWidth || template.width;
        const height = customFullPage ? null : (customHeight || template.height);
        const fullPage = customFullPage !== undefined ? customFullPage : (template.fullPage || false);

        const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
        if (!BROWSERLESS_API_KEY) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json({
                success: false,
                error: 'Browserless.io API key not configured',
                isPlaceholder: true
            });
        }

        // Browserless API call
        const browserlessUrl = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`;

        const browserlessBody = {
            url: cleanUrl,
            viewport: {
                width: width,
                height: height,
                deviceScaleFactor: 1,
                isMobile: template.device === 'mobile' || template.device === 'tablet',
                hasTouch: template.device === 'mobile' || template.device === 'tablet'
            },
            options: {
                type: 'png',
                encoding: 'binary',
                waitForTimeout: 5000,
                fullPage: fullPage
            }
        };

        console.log('📸 Screenshot request:', {
            url: cleanUrl,
            template: templateId,
            viewport: browserlessBody.viewport,
            fullPage: fullPage
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(browserlessUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'Image-Legendizer/2.6.0'
                },
                body: JSON.stringify(browserlessBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📡 Browserless response:', response.status);

            if (!response.ok) {
                let errorText = 'Unknown error';
                try {
                    errorText = await response.text();
                } catch { }

                console.log('❌ Browserless error:', errorText);

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(200).json({
                    success: false,
                    error: `Screenshot capture failed: ${response.status} ${response.statusText}`,
                    isPlaceholder: true,
                    details: errorText.substring(0, 200)
                });
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('image')) {
                const text = await response.text();
                console.log('⚠️ Non-image response:', text.substring(0, 200));

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(200).json({
                    success: false,
                    error: 'Browserless returned non-image response',
                    isPlaceholder: true,
                    details: text.substring(0, 200)
                });
            }

            const buffer = await response.arrayBuffer();

            console.log(`✅ Screenshot captured: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

            // Set headers and return image
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Length', buffer.byteLength);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Expose-Headers', 'x-dimensions, x-method, x-device, x-template, x-is-placeholder');
            res.setHeader('x-dimensions', JSON.stringify({ width, height, device: template.device }));
            res.setHeader('x-method', 'browserless');
            res.setHeader('x-device', template.device);
            res.setHeader('x-template', templateId);
            res.setHeader('x-is-placeholder', 'false');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            return res.status(200).send(new Uint8Array(buffer));

        } catch (fetchError) {
            clearTimeout(timeoutId);
            console.log('❌ Fetch error:', fetchError.message);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (fetchError.name === 'AbortError') {
                return res.status(200).json({
                    success: false,
                    error: `Screenshot capture timeout after ${timeout}ms`,
                    isPlaceholder: true
                });
            }

            return res.status(200).json({
                success: false,
                error: `Screenshot capture failed: ${fetchError.message}`,
                isPlaceholder: true
            });
        }

    } catch (error) {
        console.log('❌ Handler error:', error.message);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({
            success: false,
            error: `Internal server error: ${error.message}`,
            isPlaceholder: true
        });
    }
}