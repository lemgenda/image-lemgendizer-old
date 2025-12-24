const playwright = require('playwright-core');
const chromium = require('@sparticuz/chromium-min');
const { createCanvas } = require('canvas');

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
    '--disable-features=VizDisplayCompositor',
    '--max-old-space-size=512'
];

const SCREENSHOT_QUALITY = {
    JPEG_QUALITY: 80,
    TIMEOUT: 15000,
    PAGE_LOAD_TIMEOUT: 10000
};

/**
 * Launches and returns a browser instance
 * @returns {Promise<Object>} Browser instance
 */
async function getBrowser() {
    return await playwright.chromium.launch({
        args: BROWSER_LAUNCH_ARGS,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        timeout: 8000,
    });
}

/**
 * Captures a screenshot of the specified URL
 * @param {string} url - The URL to capture
 * @param {string} device - Device type (mobile, tablet, desktop)
 * @returns {Promise<Object>} Screenshot result object
 */
async function captureScreenshot(url, device = 'mobile') {
    let browser = null;
    let page = null;
    let context = null;

    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required');
        }

        const preset = DEVICE_PRESETS[device] || DEVICE_PRESETS.mobile;
        browser = await getBrowser();

        context = await browser.newContext({
            viewport: preset.viewport,
            userAgent: preset.userAgent,
            deviceScaleFactor: preset.deviceScaleFactor,
            isMobile: preset.isMobile,
            hasTouch: preset.hasTouch,
            ignoreHTTPSErrors: true,
            javaScriptEnabled: true,
        });

        page = await context.newPage();

        await page.route('**/*', (route) => {
            const request = route.request();
            const resourceType = request.resourceType();

            if (['document', 'stylesheet', 'script'].includes(resourceType)) {
                route.continue();
            } else {
                route.abort();
            }
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 15 seconds')), SCREENSHOT_QUALITY.TIMEOUT)
        );

        const fullUrl = url.startsWith('http') ? url : `https://${url}`;

        await Promise.race([
            page.goto(fullUrl, {
                waitUntil: 'networkidle',
                timeout: SCREENSHOT_QUALITY.PAGE_LOAD_TIMEOUT,
            }),
            timeoutPromise
        ]);

        await page.waitForLoadState('networkidle');

        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: SCREENSHOT_QUALITY.JPEG_QUALITY,
            omitBackground: true,
        });

        return {
            success: true,
            buffer: screenshotBuffer,
            device: preset.name,
            dimensions: preset.viewport,
            format: 'jpeg'
        };

    } catch (error) {
        const errorImage = await createErrorPlaceholder(
            url,
            device,
            error.message,
            DEVICE_PRESETS[device]?.viewport || { width: 375, height: 667 }
        );

        return {
            success: false,
            buffer: errorImage,
            device: device,
            error: error.message,
            isPlaceholder: true
        };

    } finally {
        if (page) await page.close().catch(() => { });
        if (context) await context.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

/**
 * Creates an error placeholder image
 * @param {string} url - The URL that failed
 * @param {string} device - Device type
 * @param {string} errorMessage - Error message
 * @param {Object} viewport - Viewport dimensions
 * @returns {Buffer} Error placeholder image buffer
 */
async function createErrorPlaceholder(url, device, errorMessage, viewport) {
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.strokeStyle = '#dc3545';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, viewport.width - 20, viewport.height - 20);

    ctx.fillStyle = '#343a40';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Screenshot Failed', viewport.width / 2, 50);

    ctx.font = '12px Arial';
    ctx.fillText(`URL: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`, viewport.width / 2, 80);
    ctx.fillText(`Device: ${device}`, viewport.width / 2, 100);
    ctx.fillText(`Error: ${errorMessage.substring(0, 60)}`, viewport.width / 2, 120);

    return canvas.toBuffer('image/png');
}

/**
 * Main API handler for screenshot capture
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let url, device;

        if (req.method === 'GET') {
            url = req.query.url;
            device = req.query.device || 'mobile';
        } else {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            url = body.url;
            device = body.device || 'mobile';
        }

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const result = await captureScreenshot(url, device);

        if (result.isPlaceholder) {
            res.setHeader('Content-Type', 'image/png');
            return res.status(500).send(result.buffer);
        }

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('X-Device', result.device);
        res.setHeader('X-Dimensions', `${result.dimensions.width}x${result.dimensions.height}`);

        return res.send(result.buffer);

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};