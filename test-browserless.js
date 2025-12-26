import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || "2TfpPHSu17r0zsS7d1859d9555f6a305a16871ced31381f86";
const url = 'https://production-sfo.browserless.io/screenshot';

const data = {
    url: "https://example.com/",
    options: {
        fullPage: false,
        type: "png",
        encoding: "binary"
    },
    viewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1
    }
};

async function testBrowserless() {
    try {
        console.log('=== Testing Browserless.io API ===');
        console.log('API Key:', BROWSERLESS_API_KEY ? `${BROWSERLESS_API_KEY.substring(0, 10)}...` : 'Not set');
        console.log('URL:', url);
        console.log('');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BROWSERLESS_API_KEY}`
            },
            body: JSON.stringify(data),
            timeout: 30000
        });

        console.log('Response Status:', response.status);
        console.log('Response Headers:');
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        console.log(JSON.stringify(headers, null, 2));

        if (response.ok) {
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(`${__dirname}/test-screenshot.png`, Buffer.from(buffer));
            console.log('\n✅ SUCCESS: Screenshot saved as test-screenshot.png');
            console.log('✅ Browserless API key is VALID!');
            console.log(`✅ Image size: ${Math.round(buffer.byteLength / 1024)} KB`);
        } else {
            const errorText = await response.text();
            console.error('\n❌ ERROR: API request failed');
            console.error('Status:', response.status, response.statusText);
            console.error('Error:', errorText.substring(0, 500));

            if (response.status === 401 || response.status === 403) {
                console.error('\n🔑 AUTHENTICATION ISSUE:');
                console.error('- Check if API key is valid');
                console.error('- Make sure API key has credits');
                console.error('- Verify API key format');
            }
        }
    } catch (error) {
        console.error('\n❌ NETWORK ERROR:', error.message);
        console.error('\nTROUBLESHOOTING:');
        console.error('1. Check internet connection');
        console.error('2. Verify Browserless.io is accessible');
        console.error('3. Check firewall/proxy settings');
    }
}

testBrowserless();