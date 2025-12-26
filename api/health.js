/**
 * Health check endpoint for API status monitoring
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {Promise<void>}
 */
async function handler(req, res) {
    // CORS headers
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            allowed: ['GET']
        });
    }

    const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
    const hasApiKey = Boolean(BROWSERLESS_API_KEY && BROWSERLESS_API_KEY.length > 10);

    let browserlessStatus = {
        reachable: false,
        status: null,
        endpointTested: 'production-sfo.browserless.io',
        authMethod: 'Bearer token in headers',
        error: null
    };

    if (hasApiKey) {
        try {
            const testUrl = 'https://production-sfo.browserless.io/screenshot';
            const testBody = {
                url: 'https://example.com',
                viewport: { width: 800, height: 600 },
                options: { type: 'png', fullPage: false }
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const testResponse = await fetch(testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Image-Legendizer-Health-Check/2.6.0',
                    'Authorization': `Bearer ${BROWSERLESS_API_KEY}`
                },
                body: JSON.stringify(testBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            browserlessStatus = {
                reachable: testResponse.ok,
                status: testResponse.status,
                statusText: testResponse.statusText,
                endpointTested: 'production-sfo.browserless.io',
                authMethod: 'Bearer token in headers',
                headers: {
                    'x-ratelimit-limit': testResponse.headers.get('x-ratelimit-limit'),
                    'x-ratelimit-remaining': testResponse.headers.get('x-ratelimit-remaining'),
                    'x-ratelimit-reset': testResponse.headers.get('x-ratelimit-reset')
                }
            };

        } catch (error) {
            browserlessStatus = {
                reachable: false,
                status: null,
                error: error.message,
                endpointTested: 'production-sfo.browserless.io',
                authMethod: 'Bearer token in headers'
            };
        }
    }

    const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'image-lemgendizer-screenshot-api',
        version: '2.6.0',
        environment: process.env.NODE_ENV || 'production',
        vercel: process.env.VERCEL ? 'true' : 'false',
        region: process.env.VERCEL_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'unknown',
        hasApiKey: hasApiKey,
        apiKeyLength: BROWSERLESS_API_KEY ? BROWSERLESS_API_KEY.length : 0,
        uptime: process.uptime(),
        memory: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
        },
        endpoints: {
            screenshot: '/api/screenshot',
            health: '/api/health'
        },
        browserlessConfig: {
            endpoint: 'production-sfo.browserless.io',
            authMethod: 'Bearer token in headers',
            keyConfigured: hasApiKey
        },
        browserlessStatus: browserlessStatus,
        recommendations: hasApiKey && !browserlessStatus.reachable ? [
            'Check if Browserless API key is valid',
            'Verify API key has sufficient credits',
            'Check network connectivity to Browserless'
        ] : ['All systems operational']
    };

    return res.status(200).json(healthData);
}

export default handler;