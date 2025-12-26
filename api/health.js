/**
 * Health check endpoint for API status monitoring
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

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
        authMethod: 'token query parameter'
    };

    if (hasApiKey) {
        try {
            const testUrl = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`;
            const testBody = {
                url: 'https://example.com',
                viewport: { width: 800, height: 600 },
                options: { type: 'png' }
            };

            const testResponse = await fetch(testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Image-Legendizer-Health-Check/2.6.0'
                },
                body: JSON.stringify(testBody),
                signal: AbortSignal.timeout(10000)
            });

            browserlessStatus = {
                reachable: testResponse.ok,
                status: testResponse.status,
                statusText: testResponse.statusText,
                endpointTested: 'production-sfo.browserless.io',
                authMethod: 'token query parameter',
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
                authMethod: 'token query parameter'
            };
        }
    }

    const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'image-lemgendizer-screenshot-api',
        version: '2.6.0',
        environment: process.env.NODE_ENV || 'production',
        hasApiKey: hasApiKey,
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
            authMethod: 'token query parameter'
        },
        browserlessStatus: browserlessStatus,
        vercel: {
            region: process.env.VERCEL_REGION || 'unknown',
            url: process.env.VERCEL_URL || 'unknown'
        }
    };

    return res.status(200).json(healthData);
}