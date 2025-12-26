const DEVICE_CONFIGS = {
    mobile: {
        viewport: { width: 375, height: 667 }
    },
    tablet: {
        viewport: { width: 768, height: 1024 }
    },
    desktop: {
        viewport: { width: 1280, height: 720 }
    }
};

/**
 * Validates and sanitizes URL input
 * @param {string} url - Raw URL input from request
 * @returns {string} Validated and cleaned URL
 * @throws {Error} If URL is invalid or malformed
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
export default async function handler(req, res) {
    // Define allowed origins
    const allowedOrigins = [
        'https://image-lemgendizer.vercel.app',
        'https://image-lemgendizer-old-x2qz.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://lemgenda.github.io/image-lemgendizer-old/'
    ];

    // Get the origin from the request
    const origin = req.headers.origin;

    // Set CORS headers if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
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
            } catch (parseError) {
                return res.status(400).json({
                    error: 'Invalid JSON format',
                    details: parseError.message
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
        const quality = parseInt(body.quality) || 80;
        const timeout = parseInt(body.timeout) || 30000;
        const templateId = body.templateId || 'desktop';

        const cleanUrl = validateAndCleanUrl(url);

        const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
        const USE_BROWSERLESS = BROWSERLESS_API_KEY && BROWSERLESS_API_KEY.length > 10;

        if (!USE_BROWSERLESS) {
            return res.status(200).json({
                success: false,
                error: 'Browserless.io API key not configured',
                suggestion: 'Set BROWSERLESS_API_KEY environment variable',
                isPlaceholder: true
            });
        }

        const browserlessBody = {
            url: cleanUrl,
            options: {
                type: 'png',
                fullPage: fullPage,
                encoding: 'binary',
                quality: Math.min(Math.max(quality, 1), 100)
            }
        };

        if (!fullPage) {
            browserlessBody.viewport = {
                width: width,
                height: height
            };
        }

        const browserlessUrl = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`;

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
                throw new Error(`Browserless.io error: ${errorText}`);
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

            // Add CORS headers for the image response
            if (origin && allowedOrigins.includes(origin)) {
                res.setHeader('Access-Control-Expose-Headers', 'X-Dimensions, X-Method, X-Device, X-Template, X-Is-Placeholder, Content-Type, Content-Length');
            }

            return res.status(200).send(imageBuffer);

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                return res.status(408).json({
                    error: 'Screenshot capture timeout',
                    details: `Request took too long to complete (${timeout}ms)`,
                    isPlaceholder: true
                });
            }

            throw fetchError;
        }

    } catch (error) {
        console.error('Screenshot capture error:', error);

        return res.status(500).json({
            error: 'Screenshot capture failed',
            details: error.message,
            isPlaceholder: true,
            suggestion: 'Check the URL and try again. If the issue persists, the website may block automated screenshot capture.'
        });
    }
}