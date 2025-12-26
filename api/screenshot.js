const DEVICE_CONFIGS = {
    mobile: {
        viewport: { width: 375, height: 667 }
    },
    tablet: {
        viewport: { width: 768, height: 1024 }
    },
    desktop: {
        viewport: { width: 1280, height: 720 }
    },
    'desktop-hd': {
        viewport: { width: 1920, height: 1080 }
    }
};

/**
 * Validates and sanitizes URL input
 * @param {string} url - Raw URL input
 * @returns {string} Validated and cleaned URL
 * @throws {Error} If URL is invalid
 */
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

/**
 * Main API handler for screenshot requests
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {Promise<void>}
 */
async function handler(req, res) {
    const allowedOrigins = [
        'https://image-lemgendizer.vercel.app',
        'https://image-lemgendizer-old-x2qz.vercel.app',
        'https://lemgenda.github.io',
        'http://localhost:3000',
        'http://localhost:5173'
    ];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
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
                return res.status(400).json({
                    error: 'Invalid JSON format'
                });
            }
        } else {
            body = req.body || {};
        }

        const url = body.url || body.URL;
        if (!url) {
            return res.status(400).json({
                error: 'Missing required parameter',
                details: 'URL parameter is required'
            });
        }

        const device = body.device || 'desktop';
        const deviceConfig = DEVICE_CONFIGS[device] || DEVICE_CONFIGS.desktop;
        const width = parseInt(body.width) || deviceConfig.viewport.width;
        const height = parseInt(body.height) || deviceConfig.viewport.height;
        const fullPage = Boolean(body.fullPage) || false;
        const timeout = Math.min(parseInt(body.timeout) || 30000, 60000);
        const templateId = body.templateId || 'desktop';

        const cleanUrl = validateAndCleanUrl(url);

        const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
        const USE_BROWSERLESS = BROWSERLESS_API_KEY && BROWSERLESS_API_KEY.length > 10;

        if (!USE_BROWSERLESS) {
            return res.status(200).json({
                success: false,
                error: 'Browserless.io API key not configured',
                isPlaceholder: true
            });
        }

        const browserlessUrl = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`;

        const browserlessBody = {
            url: cleanUrl,
            options: {
                type: 'png',
                fullPage: fullPage,
                encoding: 'binary',
                waitForTimeout: 5000
            }
        };

        if (!fullPage) {
            browserlessBody.viewport = {
                width: width,
                height: height,
                deviceScaleFactor: 1
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
                    return res.status(200).json({
                        success: false,
                        error: 'Invalid Browserless API token',
                        isPlaceholder: true
                    });
                }

                return res.status(200).json({
                    success: false,
                    error: 'Screenshot capture failed',
                    details: errorText.substring(0, 200),
                    isPlaceholder: true
                });
            }

            const buffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(buffer);

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Length', imageBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
            res.setHeader('X-Dimensions', JSON.stringify({ width, height }));
            res.setHeader('X-Method', 'browserless');
            res.setHeader('X-Device', device);
            res.setHeader('X-Template', templateId);
            res.setHeader('X-Is-Placeholder', 'false');
            res.setHeader('X-Response-Time', Date.now().toString());

            if (origin && allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
                res.setHeader('Access-Control-Expose-Headers', 'X-Dimensions, X-Method, X-Device, X-Template, X-Is-Placeholder, Content-Type, Content-Length, X-Response-Time');
            }

            return res.status(200).send(imageBuffer);

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                return res.status(200).json({
                    error: 'Screenshot capture timeout',
                    isPlaceholder: true
                });
            }

            return res.status(200).json({
                error: 'Screenshot capture failed',
                details: fetchError.message,
                isPlaceholder: true
            });
        }

    } catch (error) {
        return res.status(200).json({
            error: 'Screenshot capture failed',
            details: error.message,
            isPlaceholder: true
        });
    }
}

export default handler;