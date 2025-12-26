// api/screenshot.cjs
const playwright = require('playwright-core');
const chromium = require('@sparticuz/chromium-min');

// Optimize for Vercel
chromium.setGraphicsMode = false;

const DEVICE_PRESETS = {
    mobile: {
        name: 'Mobile',
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    },
    tablet: {
        name: 'Tablet',
        viewport: { width: 768, height: 1024 },
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    },
    desktop: {
        name: 'Desktop',
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
};

const BROWSER_LAUNCH_ARGS = [
    ...chromium.args,
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-features=VizDisplayCompositor'
];

/**
 * Main API handler for screenshot capture
 */
module.exports = async (req, res) => {
    console.log('API function started');

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS preflight');
        return res.status(200).end();
    }

    // Only allow GET and POST
    if (!['GET', 'POST'].includes(req.method)) {
        console.log(`Method not allowed: ${req.method}`);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let browser = null;
    let page = null;

    try {
        let url, device;

        // Parse request
        if (req.method === 'GET') {
            url = req.query.url;
            device = req.query.device || 'mobile';
        } else {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            url = body.url;
            device = body.device || 'mobile';
        }

        console.log(`Request received for URL: ${url}, Device: ${device}`);

        // Validate URL
        if (!url) {
            console.log('URL parameter missing');
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const preset = DEVICE_PRESETS[device] || DEVICE_PRESETS.mobile;

        console.log('Launching browser...');

        // Launch browser with error handling
        try {
            const executablePath = await chromium.executablePath();
            console.log(`Chromium executable path: ${executablePath}`);

            browser = await playwright.chromium.launch({
                args: BROWSER_LAUNCH_ARGS,
                executablePath: executablePath,
                headless: chromium.headless,
                timeout: 30000,
            });

            console.log('Browser launched successfully');
        } catch (browserError) {
            console.error('Failed to launch browser:', browserError);
            return res.status(500).json({
                error: 'Failed to launch browser',
                message: browserError.message
            });
        }

        // Create context and page
        const context = await browser.newContext({
            viewport: preset.viewport,
            userAgent: preset.userAgent,
            deviceScaleFactor: preset.deviceScaleFactor,
            isMobile: preset.isMobile,
            hasTouch: preset.hasTouch,
            ignoreHTTPSErrors: true,
        });

        page = await context.newPage();

        console.log('Navigating to URL...');

        // Navigate with timeout
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;

        try {
            await page.goto(fullUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 10000,
            });
            console.log('Page loaded successfully');
        } catch (navError) {
            console.log('Navigation error:', navError.message);
            // Continue anyway to try to capture something
        }

        // Wait a moment for page to settle
        await page.waitForTimeout(1000);

        console.log('Taking screenshot...');

        // Take screenshot
        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 80,
        });

        console.log('Screenshot captured successfully');

        // Clean up
        await page.close();
        await browser.close();

        // Return successful response
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('X-Device', preset.name);
        res.setHeader('X-Dimensions', `${preset.viewport.width}x${preset.viewport.height}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        return res.send(screenshotBuffer);

    } catch (error) {
        console.error('Unhandled error:', error);

        // Clean up resources
        if (page) {
            try { await page.close(); } catch { }
        }
        if (browser) {
            try { await browser.close(); } catch { }
        }

        // Return JSON error instead of image
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};