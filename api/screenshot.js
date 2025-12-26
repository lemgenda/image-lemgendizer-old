// ================================
// Unified Device & Screenshot Constants for screenshot.js
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

// Exact match to frontend SCREENSHOT_TEMPLATES
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
        height: null, // 'auto' in frontend becomes null for full page
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
// Template ID to Device Mapping
// ================================

const TEMPLATE_TO_DEVICE_MAP = {
    'screenshots-mobile': 'mobile',
    'screenshots-tablet': 'tablet',
    'screenshots-desktop': 'desktop',
    'screenshots-desktop-hd': 'desktop-hd',
    'screenshots-mobile-full': 'mobile',
    'screenshots-tablet-full': 'tablet',
    'screenshots-desktop-full': 'desktop',
    'screenshots-desktop-hd-full': 'desktop-hd'
};

// ================================
// Response Header Constants
// ================================

const HEADERS = {
    PLACEHOLDER: 'x-is-placeholder',
    PLACEHOLDER_ALT: 'x-placeholder', // For backward compatibility
    DIMENSIONS: 'x-dimensions',
    METHOD: 'x-method',
    DEVICE: 'x-device',
    TEMPLATE: 'x-template',
    RESPONSE_TIME: 'x-response-time',
    WARNING: 'x-warning'
};

// ================================
// Timeout & Performance Constants
// ================================

const TIMEOUTS = {
    DEFAULT_CAPTURE: 30000, // 30 seconds
    MAX_CAPTURE: 60000, // 60 seconds max
    PAGE_LOAD: 5000, // 5 seconds for page load
    REQUEST: 30000 // 30 seconds for fetch request
};

// ================================
// Browserless API Constants
// ================================

const BROWSERLESS_CONFIG = {
    BASE_URL: 'https://production-sfo.browserless.io',
    ENDPOINT: '/screenshot',
    DEFAULT_QUALITY: 80,
    DEFAULT_TYPE: 'png'
};

// ================================
// CORS Configuration
// ================================

const ALLOWED_ORIGINS = [
    'https://image-lemgendizer.vercel.app',
    'https://image-lemgendizer-old-x2qz.vercel.app',
    'https://lemgenda.github.io',
    'http://localhost:3000',
    'http://localhost:5173'
];

const EXPOSED_HEADERS = [
    HEADERS.DIMENSIONS,
    HEADERS.METHOD,
    HEADERS.DEVICE,
    HEADERS.TEMPLATE,
    HEADERS.PLACEHOLDER,
    HEADERS.PLACEHOLDER_ALT,
    HEADERS.WARNING,
    'Content-Type',
    'Content-Length',
    HEADERS.RESPONSE_TIME
];

// ================================
// Error Message Constants
// ================================

const ERROR_MESSAGES = {
    INVALID_URL: 'Invalid URL format',
    MISSING_URL: 'Missing required parameter: URL',
    INVALID_JSON: 'Invalid JSON format',
    BROWSERLESS_NOT_CONFIGURED: 'Browserless.io API key not configured',
    INVALID_API_TOKEN: 'Invalid Browserless API token',
    CAPTURE_FAILED: 'Screenshot capture failed',
    CAPTURE_TIMEOUT: 'Screenshot capture timeout',
    UNKNOWN_ERROR: 'Unknown error occurred'
};

// ================================
// Helper Functions
// ================================

/**
 * Gets device configuration by device name
 */
function getDeviceConfig(deviceName) {
    return DEVICE_CONFIGS[deviceName] || DEVICE_CONFIGS.desktop;
}

/**
 * Gets screenshot template configuration by template ID
 */
function getScreenshotTemplate(templateId) {
    return SCREENSHOT_TEMPLATE_CONFIGS[templateId] || SCREENSHOT_TEMPLATE_CONFIGS['screenshots-desktop'];
}

/**
 * Gets viewport dimensions for template
 */
function getTemplateViewport(templateId, customWidth, customHeight, customFullPage) {
    const template = getScreenshotTemplate(templateId);

    // Use custom values if provided, otherwise use template defaults
    const width = customWidth || template.width;
    const fullPage = customFullPage !== undefined ? customFullPage : template.fullPage;

    // For full page screenshots, height is auto (null in backend)
    const height = fullPage ? null : (customHeight || template.height);

    const device = TEMPLATE_TO_DEVICE_MAP[templateId] || 'desktop';
    const deviceConfig = getDeviceConfig(device);

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

/**
 * Validates and sanitizes URL input
 */
function validateAndCleanUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new Error(ERROR_MESSAGES.MISSING_URL);
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
        throw new Error(`${ERROR_MESSAGES.INVALID_URL}: ${url}`);
    }
}

/**
 * Creates error response object
 */
function createErrorResponse(error, isPlaceholder = true) {
    return {
        success: false,
        error: error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        isPlaceholder: isPlaceholder,
        details: error.details || error.toString()
    };
}

/**
 * Sets response headers consistently
 */
function setResponseHeaders(res, headers, origin, isError = false) {
    // Set content type - JSON for errors, PNG for success
    res.setHeader('Content-Type', isError ? 'application/json' : 'image/png');

    // Set custom headers
    Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            res.setHeader(key, value.toString());
        }
    });

    // Set both placeholder headers for compatibility
    if (headers[HEADERS.PLACEHOLDER] !== undefined) {
        res.setHeader(HEADERS.PLACEHOLDER_ALT, headers[HEADERS.PLACEHOLDER]);
    }

    // Set CORS headers
    if (origin && ALLOWED_ORIGINS.some(allowed =>
        origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
}

// ================================
// Main handler function
// ================================

async function handler(req, res) {
    const origin = req.headers.origin;

    // Handle preflight
    if (req.method === 'OPTIONS') {
        setResponseHeaders(res, {}, origin);
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        setResponseHeaders(res, {}, origin, true);
        return res.status(405).json({
            error: 'Method not allowed',
            allowed: ['POST']
        });
    }

    try {
        let body;
        if (typeof req.body === 'string') {
            try {
                body = JSON.parse(req.body);
            } catch {
                setResponseHeaders(res, {}, origin, true);
                return res.status(400).json(createErrorResponse(
                    new Error(ERROR_MESSAGES.INVALID_JSON)
                ));
            }
        } else {
            body = req.body || {};
        }

        const url = body.url || body.URL;
        if (!url) {
            setResponseHeaders(res, {}, origin, true);
            return res.status(400).json(createErrorResponse(
                new Error(ERROR_MESSAGES.MISSING_URL)
            ));
        }

        const templateId = body.templateId || 'screenshots-desktop';
        const customWidth = parseInt(body.width) || null;
        const customHeight = parseInt(body.height) || null;
        const customFullPage = body.fullPage !== undefined ? Boolean(body.fullPage) : undefined;
        const timeout = Math.min(parseInt(body.timeout) || TIMEOUTS.DEFAULT_CAPTURE, TIMEOUTS.MAX_CAPTURE);

        const cleanUrl = validateAndCleanUrl(url);
        const viewport = getTemplateViewport(templateId, customWidth, customHeight, customFullPage);

        const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
        const USE_BROWSERLESS = BROWSERLESS_API_KEY && BROWSERLESS_API_KEY.length > 10;

        if (!USE_BROWSERLESS) {
            setResponseHeaders(res, {}, origin, true);
            return res.status(200).json(createErrorResponse(
                new Error(ERROR_MESSAGES.BROWSERLESS_NOT_CONFIGURED)
            ));
        }

        const browserlessUrl = `${BROWSERLESS_CONFIG.BASE_URL}${BROWSERLESS_CONFIG.ENDPOINT}?token=${BROWSERLESS_API_KEY}`;

        const browserlessBody = {
            url: cleanUrl,
            options: {
                type: BROWSERLESS_CONFIG.DEFAULT_TYPE,
                fullPage: viewport.fullPage,
                encoding: 'binary',
                waitForTimeout: TIMEOUTS.PAGE_LOAD,
                quality: BROWSERLESS_CONFIG.DEFAULT_QUALITY
            }
        };

        if (!viewport.fullPage) {
            browserlessBody.viewport = {
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: viewport.deviceScaleFactor,
                isMobile: viewport.isMobile,
                hasTouch: viewport.hasTouch
            };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(browserlessUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(browserlessBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();

                if (response.status === 401 || response.status === 403) {
                    setResponseHeaders(res, {}, origin, true);
                    return res.status(200).json(createErrorResponse(
                        new Error(ERROR_MESSAGES.INVALID_API_TOKEN)
                    ));
                }

                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error(ERROR_MESSAGES.CAPTURE_FAILED),
                    true
                ));
            }

            const buffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(buffer);

            setResponseHeaders(res, {
                'Content-Length': imageBuffer.length,
                [HEADERS.DIMENSIONS]: JSON.stringify({
                    width: viewport.width,
                    height: viewport.height
                }),
                [HEADERS.METHOD]: 'browserless',
                [HEADERS.DEVICE]: viewport.device,
                [HEADERS.TEMPLATE]: templateId,
                [HEADERS.PLACEHOLDER]: 'false',
                [HEADERS.RESPONSE_TIME]: Date.now().toString()
            }, origin, false);

            return res.status(200).send(imageBuffer);

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error(ERROR_MESSAGES.CAPTURE_TIMEOUT)
                ));
            }

            setResponseHeaders(res, {}, origin, true);
            return res.status(200).json(createErrorResponse(
                new Error(ERROR_MESSAGES.CAPTURE_FAILED),
                true
            ));
        }

    } catch (error) {
        setResponseHeaders(res, {}, origin, true);
        return res.status(200).json(createErrorResponse(error, true));
    }
}

export default handler;