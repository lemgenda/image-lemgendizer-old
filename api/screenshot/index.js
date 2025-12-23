// api/screenshot/index.js
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

async function getBrowser() {
    return await playwright.chromium.launch({
        args: [
            ...chromium.args,
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-features=VizDisplayCompositor',
            '--max-old-space-size=512'
        ],
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        timeout: 8000,
    });
}

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

        // Block unnecessary resources for speed
        await page.route('**/*', (route) => {
            const request = route.request();
            const resourceType = request.resourceType();

            // Allow only essential resources
            if (['document', 'stylesheet', 'script'].includes(resourceType)) {
                route.continue();
            } else {
                route.abort();
            }
        });

        // Add timeout for the entire operation
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 15 seconds')), 15000)
        );

        const fullUrl = url.startsWith('http') ? url : `https://${url}`;

        await Promise.race([
            page.goto(fullUrl, {
                waitUntil: 'networkidle',
                timeout: 10000,
            }),
            timeoutPromise
        ]);

        // Wait for page to stabilize
        await page.waitForLoadState('networkidle');

        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 80,
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
        console.error('Screenshot error:', error);
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
        // Cleanup
        if (page) await page.close().catch(() => { });
        if (context) await context.close().catch(() => { });
        if (browser) await browser.close().catch(() => { });
    }
}

async function createErrorPlaceholder(url, device, errorMessage, viewport) {
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Border
    ctx.strokeStyle = '#dc3545';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, viewport.width - 20, viewport.height - 20);

    // Error text
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

module.exports = async (req, res) => {
    // CORS headers
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
        console.error('API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};