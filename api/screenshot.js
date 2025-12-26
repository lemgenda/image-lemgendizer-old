// Replace the entire screenshot.js content with this simplified version:

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
        const body = req.body || {};
        const url = body.url || body.URL;

        if (!url) {
            return res.status(400).json({
                error: 'Missing required parameter: url'
            });
        }

        const device = body.device || 'desktop';
        const width = parseInt(body.width) || 1280;
        const height = parseInt(body.height) || 720;
        const fullPage = Boolean(body.fullPage) || false;
        const quality = Math.min(Math.max(parseInt(body.quality) || 80, 1), 100);

        // Validate and clean URL
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }
        cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

        try {
            new URL(cleanUrl);
        } catch {
            return res.status(400).json({
                error: `Invalid URL format: ${url}`
            });
        }

        const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
        const USE_BROWSERLESS = BROWSERLESS_API_KEY && BROWSERLESS_API_KEY.length > 10;

        if (!USE_BROWSERLESS) {
            return res.status(200).json({
                success: true,
                placeholder: true,
                message: 'Browserless.io API key not configured',
                url: cleanUrl,
                dimensions: { width, height },
                device: device,
                suggestion: 'Set BROWSERLESS_API_KEY environment variable for real screenshots'
            });
        }

        // Call Browserless.io REST API
        const browserlessBody = {
            url: cleanUrl,
            options: {
                type: 'png',
                fullPage: fullPage,
                encoding: 'binary',
                quality: quality
            }
        };

        if (!fullPage) {
            browserlessBody.options.viewport = {
                width: width,
                height: height
            };
        }

        const response = await fetch('https://chrome.browserless.io/screenshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'x-api-key': BROWSERLESS_API_KEY
            },
            body: JSON.stringify(browserlessBody),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Browserless.io error:', response.status, errorText);

            return res.status(200).json({
                success: true,
                placeholder: true,
                message: 'Browserless.io API call failed',
                url: cleanUrl,
                dimensions: { width, height },
                device: device,
                warning: `Browserless.io error: ${response.status}`,
                details: errorText.substring(0, 200)
            });
        }

        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', imageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Dimensions', JSON.stringify({ width, height }));
        res.setHeader('X-Method', 'browserless-rest');
        res.setHeader('X-Placeholder', 'false');

        return res.status(200).send(imageBuffer);

    } catch (error) {
        console.error('Screenshot handler error:', error);

        if (error.name === 'AbortError') {
            return res.status(200).json({
                success: true,
                placeholder: true,
                message: 'Screenshot capture timeout',
                warning: 'Request took too long'
            });
        }

        return res.status(200).json({
            success: true,
            placeholder: true,
            message: 'Screenshot capture failed',
            error: error.message
        });
    }
}