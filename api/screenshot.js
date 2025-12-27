import { Buffer } from 'buffer';

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

/**
 * Retrieves device configuration by name
 * @param {string} deviceName - Device identifier
 * @returns {Object} Device configuration
 */
function getDeviceConfig(deviceName) {
    return DEVICE_CONFIGS[deviceName] || DEVICE_CONFIGS.desktop;
}

/**
 * Retrieves screenshot template configuration by ID
 * @param {string} templateId - Template identifier
 * @returns {Object} Template configuration
 */
function getScreenshotTemplate(templateId) {
    return SCREENSHOT_TEMPLATE_CONFIGS[templateId] || SCREENSHOT_TEMPLATE_CONFIGS['screenshots-desktop'];
}

/**
 * Calculates viewport dimensions based on template and custom parameters
 * @param {string} templateId - Template identifier
 * @param {number|null} customWidth - Custom width override
 * @param {number|null} customHeight - Custom height override
 * @param {boolean|null} customFullPage - Custom full page override
 * @returns {Object} Viewport configuration
 */
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

/**
 * Validates and cleans URL string
 * @param {string} url - URL to validate
 * @returns {string} Cleaned URL
 * @throws {Error} If URL is invalid
 */
function validateAndCleanUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new Error('URL is required');
    }

    let cleanUrl = url.trim();

    if (cleanUrl.length === 0) {
        throw new Error('URL cannot be empty');
    }

    const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?$/i;
    if (!urlRegex.test(cleanUrl)) {
        throw new Error('Invalid URL format');
    }

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

/**
 * Sets response headers including CORS and custom headers
 * @param {Object} res - Response object
 * @param {Object} headers - Custom headers to set
 * @param {string} origin - Request origin for CORS
 * @param {boolean} isError - Whether this is an error response
 */
function setResponseHeaders(res, headers, origin, isError = false) {
    const allowedOrigins = [
        'https://image-lemgendizer.vercel.app',
        'https://image-lemgendizer-old-x2qz.vercel.app',
        'https://lemgenda.github.io',
        'http://localhost:3000',
        'http://localhost:5173'
    ];

    res.setHeader('Content-Type', isError ? 'application/json' : 'image/png');

    if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                res.setHeader(key, value.toString());
            }
        });
    }

    if (headers && headers['x-is-placeholder'] !== undefined) {
        res.setHeader('x-placeholder', headers['x-is-placeholder']);
    }

    // FIXED: Always set Access-Control-Allow-Origin for preflight
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // For development, allow the requesting origin
        res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost:5173');
    }

    // These headers are CRITICAL for CORS
    res.setHeader('Access-Control-Expose-Headers', 'x-dimensions, x-method, x-device, x-template, x-is-placeholder, x-placeholder, x-warning, Content-Type, Content-Length, x-response-time');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (!isError) {
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    }
}

/**
 * Creates standardized error response
 * @param {Error} error - Error object
 * @param {boolean} isPlaceholder - Whether this is a placeholder response
 * @returns {Object} Error response object
 */
function createErrorResponse(error, isPlaceholder = true) {
    return {
        success: false,
        error: error.message || 'Screenshot capture failed',
        isPlaceholder: isPlaceholder,
        details: error.details || error.toString()
    };
}

export default async function handler(req, res) {
    const origin = req.headers.origin || req.headers.host;

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
                    new Error('Invalid JSON format')
                ));
            }
        } else {
            body = req.body || {};
        }

        const url = body.url || body.URL;
        if (!url) {
            setResponseHeaders(res, {}, origin, true);
            return res.status(400).json(createErrorResponse(
                new Error('Missing required parameter: URL')
            ));
        }

        const templateId = body.templateId || 'screenshots-desktop';
        const customWidth = parseInt(body.width) || null;
        const customHeight = parseInt(body.height) || null;
        const customFullPage = body.fullPage !== undefined ? Boolean(body.fullPage) : undefined;
        const timeout = Math.max(Math.min(parseInt(body.timeout) || 30000, 60000), 5000);

        const cleanUrl = validateAndCleanUrl(url);
        const viewport = getTemplateViewport(templateId, customWidth, customHeight, customFullPage);

        const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
        const USE_BROWSERLESS = BROWSERLESS_API_KEY && BROWSERLESS_API_KEY.length > 10;

        if (!USE_BROWSERLESS) {
            setResponseHeaders(res, {}, origin, true);
            return res.status(200).json(createErrorResponse(
                new Error('Browserless.io API key not configured')
            ));
        }

        const browserlessUrl = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`;

        const deviceConfig = getDeviceConfig(viewport.device);

        const browserlessBody = {
            url: cleanUrl,
            options: {
                type: 'png',
                encoding: 'binary',
                fullPage: viewport.fullPage || false,
                waitFor: 'networkidle2', // Wait for page to fully load
                delay: 1000 // Wait 1 second after page load
            },
            userAgent: deviceConfig.userAgent // Add user agent for bot detection avoidance
        };

        if (!viewport.fullPage) {
            browserlessBody.viewport = {
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: viewport.deviceScaleFactor,
                isMobile: deviceConfig.isMobile,
                hasTouch: deviceConfig.hasTouch
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
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch {
                    errorText = 'Could not read error response';
                }

                if (response.status === 500 && errorText.includes('net::ERR_NAME')) {
                    setResponseHeaders(res, {}, origin, true);
                    return res.status(200).json(createErrorResponse(
                        new Error('Cannot resolve URL. Please check the website address.')
                    ));
                }

                if (response.status === 401 || response.status === 403) {
                    setResponseHeaders(res, {}, origin, true);
                    return res.status(200).json(createErrorResponse(
                        new Error(`Invalid Browserless API token (Status: ${response.status})`)
                    ));
                }

                if (response.status === 429) {
                    setResponseHeaders(res, {}, origin, true);
                    return res.status(200).json(createErrorResponse(
                        new Error('Rate limit exceeded. Please try again later.')
                    ));
                }

                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error(`Screenshot capture failed: ${response.status} ${response.statusText}`),
                    true
                ));
            }

            const contentType = response.headers.get('content-type');

            if (!contentType || !contentType.includes('image')) {
                const bodyText = await response.text();
                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error('Browserless returned non-image response')
                ));
            }

            const buffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(buffer);

            setResponseHeaders(res, {
                'Content-Length': imageBuffer.length,
                'x-dimensions': JSON.stringify({
                    width: viewport.width,
                    height: viewport.height,
                    device: viewport.device
                }),
                'x-method': 'browserless',
                'x-device': viewport.device,
                'x-template': templateId,
                'x-is-placeholder': 'false',
                'x-response-time': Date.now().toString()
            }, origin, false);

            return res.status(200).send(imageBuffer);

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error(`Screenshot capture timeout after ${timeout}ms`)
                ));
            }

            if (fetchError.code === 'ECONNREFUSED' || fetchError.code === 'ENOTFOUND') {
                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error('Cannot connect to Browserless service. Please check your network connection.')
                ));
            }

            setResponseHeaders(res, {}, origin, true);
            return res.status(200).json(createErrorResponse(
                new Error(`Screenshot capture failed: ${fetchError.message}`),
                true
            ));
        }

    } catch (error) {
        setResponseHeaders(res, {}, origin, true);
        return res.status(200).json(createErrorResponse(error, true));
    }
}