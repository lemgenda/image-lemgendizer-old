// No import needed for Node.js 18+
const API_URL = process.env.VERCEL_URL || 'https://image-lemgendizer-old-x2qz.vercel.app/';

async function quickTest() {
    console.log('🔍 Quick API Test\n');

    // Test 1: Health endpoint
    console.log('1. Testing /api/health...');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const healthRes = await fetch(`${API_URL}/api/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const healthData = await healthRes.json();
        console.log(`   ✅ Status: ${healthData.status}`);
        console.log(`   📊 Browserless: ${healthData.browserlessStatus.reachable ? 'Connected' : 'Not connected'}`);
        console.log(`   🔑 API Key: ${healthData.hasApiKey ? 'Set' : 'Missing'}`);
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // Test 2: Screenshot endpoint
    console.log('\n2. Testing /api/screenshot...');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const screenshotRes = await fetch(`${API_URL}/api/screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://example.com',
                device: 'desktop',
                width: 800,
                height: 600
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log(`   📊 Status: ${screenshotRes.status}`);

        const contentType = screenshotRes.headers.get('content-type');
        console.log(`   📄 Content-Type: ${contentType}`);

        if (contentType && contentType.includes('image')) {
            const buffer = await screenshotRes.arrayBuffer();
            console.log(`   ✅ Image received: ${buffer.byteLength} bytes`);
        } else {
            const text = await screenshotRes.text();
            console.log(`   📝 Response: ${text.substring(0, 200)}`);
        }
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }

    console.log('\n✅ Quick test complete!');
}

// Run the test
quickTest().catch(console.error);