// api/screenshot.js
import playwright from 'playwright-core';
import chromiumPackage from '@sparticuz/chromium-min';

const chromium = chromiumPackage.default || chromiumPackage;
chromium.setGraphicsMode = false;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { url, device = 'mobile' } = req.query;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const sizes = {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1280, height: 720 }
    };

    const viewport = sizes[device] || sizes.mobile;
    let browser = null;

    try {
        const executablePath = await chromium.executablePath();
        console.log('Chromium path:', executablePath);

        browser = await playwright.chromium.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            executablePath,
            headless: chromium.headless,
            timeout: 30000
        });

        const page = await browser.newPage();
        await page.setViewportSize(viewport);

        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1000);

        const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
        await browser.close();

        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(screenshot);

    } catch (error) {
        console.error('Error:', error);
        if (browser) await browser.close();
        return res.status(500).json({ error: 'Screenshot failed', message: error.message });
    }
}