// test-chromium.js
import { chromium } from 'playwright';

async function test() {
    console.log('Testing Chromium installation...');
    
    try {
        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox']
        });
        console.log('✓ Chromium launched successfully!');
        
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('✓ Page loaded successfully!');
        
        await page.screenshot({ path: 'test-screenshot.jpg' });
        console.log('✓ Screenshot taken! Saved as test-screenshot.jpg');
        
        await browser.close();
        console.log('✓ Test completed successfully!');
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.log('\nTry running: npx playwright install chromium --force');
    }
}

test();
