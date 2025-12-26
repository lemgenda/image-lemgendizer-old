import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const API_TOKEN = BROWSERLESS_API_KEY;
const url = `https://production-sfo.browserless.io/screenshot?token=${API_TOKEN}`;

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
        console.log('=== Testing Browserless.io API (Corrected Authentication) ===');
        console.log('API Token Present:', BROWSERLESS_API_KEY ? 'Yes' : 'No');
        console.log('Endpoint:', url.replace(API_TOKEN, '[REDACTED]'));
        console.log('');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(data)
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
            console.log('✅ Browserless API token is VALID!');
            console.log(`✅ Image size: ${Math.round(buffer.byteLength / 1024)} KB`);
        } else {
            const errorText = await response.text();
            console.error('\n❌ ERROR: API request failed');
            console.error('Status:', response.status, response.statusText);
            console.error('Error:', errorText.substring(0, 500));

            if (response.status === 401 || response.status === 403) {
                console.error('\n🔑 AUTHENTICATION ISSUE:');
                console.error('- Check if API token is valid');
                console.error('- Make sure API token has credits');
                console.error('- Verify API token format');
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