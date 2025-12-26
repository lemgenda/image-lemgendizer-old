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
        const timeout = Math.min(parseInt(body.timeout) || 30000, 60000);

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

        // FIXED: Use correct Browserless endpoint and parameters
        const browserlessUrl = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`;

        // FIXED: Use simple, correct parameters that match the health check
        const browserlessBody = {
            url: cleanUrl,
            viewport: {
                width: viewport.width || 1280,
                height: viewport.fullPage ? null : (viewport.height || 720),
                deviceScaleFactor: viewport.deviceScaleFactor || 1,
                isMobile: viewport.isMobile || false,
                hasTouch: viewport.hasTouch || false
            },
            options: {
                type: 'png',
                encoding: 'binary',
                waitForTimeout: 5000,
                fullPage: viewport.fullPage || false
            }
        };

        // Debug logging
        console.log('🔍 Screenshot Request Details:');
        console.log('- URL:', cleanUrl);
        console.log('- Template:', templateId);
        console.log('- Viewport:', browserlessBody.viewport);
        console.log('- Full Page:', viewport.fullPage);
        console.log('- Browserless URL:', browserlessUrl.split('?')[0]);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            console.log('📡 Calling Browserless API...');

            const response = await fetch(browserlessUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'Image-Legendizer-Screenshot-API/2.6.0'
                },
                body: JSON.stringify(browserlessBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('✅ Browserless Response:', response.status, response.statusText);
            console.log('📄 Content-Type:', response.headers.get('content-type'));

            if (!response.ok) {
                let errorDetails = '';
                try {
                    const errorData = await response.json();
                    errorDetails = JSON.stringify(errorData);
                } catch {
                    errorDetails = await response.text();
                }

                console.log('❌ Browserless Error:', errorDetails);

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
                console.log('⚠️ Unexpected response type:', contentType);
                console.log('Response preview:', bodyText.substring(0, 500));

                setResponseHeaders(res, {}, origin, true);
                return res.status(200).json(createErrorResponse(
                    new Error('Browserless returned non-image response')
                ));
            }

            const buffer = await response.arrayBuffer();

            console.log(`✅ Screenshot captured: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

            setResponseHeaders(res, {
                'Content-Length': buffer.byteLength,
                'x-dimensions': JSON.stringify({
                    width: viewport.width,
                    height: viewport.height,
                    device: viewport.device
                }),
                'x-method': 'browserless',
                'x-device': viewport.device,
                'x-template': templateId,
                'x-is-placeholder': 'false',
                'x-response-time': Date.now().toString(),
                'x-cache': 'MISS'
            }, origin, false);

            // Convert ArrayBuffer to Uint8Array for Vercel compatibility
            const imageData = new Uint8Array(buffer);
            return res.status(200).send(imageData);

        } catch (fetchError) {
            clearTimeout(timeoutId);
            console.log('❌ Fetch Error:', fetchError.message);

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
        console.log('❌ Handler Error:', error.message);
        setResponseHeaders(res, {}, origin, true);
        return res.status(200).json(createErrorResponse(error, true));
    }
}