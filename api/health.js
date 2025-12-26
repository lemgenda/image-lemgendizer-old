/**
 * Health check endpoint
 * @param {Object} req - Request object
 * @param {Object} res - Response object
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

    let browserlessStatus = { reachable: false, status: null };

    if (hasApiKey) {
        try {
            const testResponse = await fetch('https://chrome.browserless.io/', {
                headers: { 'x-api-key': BROWSERLESS_API_KEY },
                signal: AbortSignal.timeout(5000)
            });

            browserlessStatus = {
                reachable: true,
                status: testResponse.status,
                statusText: testResponse.statusText
            };
        } catch {
            browserlessStatus = {
                reachable: false,
                status: null
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
        hasWsEndpoint: true,
        uptime: process.uptime(),
        memory: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        },
        endpoints: {
            screenshot: '/api/screenshot',
            health: '/api/health'
        },
        methods: ['websocket', 'rest-api', 'placeholder'],
        browserlessStatus: browserlessStatus
    };

    return res.status(200).json(healthData);
}