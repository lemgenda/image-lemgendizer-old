import fetch from 'node-fetch';

async function testDeployment() {
    const baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';

    console.log(`=== Testing Vercel Deployment ===`);
    console.log(`Base URL: ${baseUrl}`);
    console.log('');

    // Test 1: Health endpoint
    try {
        console.log('1. Testing health endpoint...');
        const healthRes = await fetch(`${baseUrl}/api/health`);
        const healthData = await healthRes.json();
        console.log(`   Status: ${healthRes.status}`);
        console.log(`   API Key Configured: ${healthData.hasApiKey ? '✅ Yes' : '❌ No'}`);
        console.log(`   Browserless Reachable: ${healthData.browserlessStatus?.reachable ? '✅ Yes' : '❌ No'}`);

        if (healthData.browserlessStatus?.error) {
            console.log(`   Browserless Error: ${healthData.browserlessStatus.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Health test failed: ${error.message}`);
    }

    // Test 2: Screenshot endpoint
    console.log('\n2. Testing screenshot endpoint...');
    try {
        const screenshotRes = await fetch(`${baseUrl}/api/screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://example.com',
                device: 'desktop',
                width: 1280,
                height: 720,
                timeout: 10000
            })
        });

        const contentType = screenshotRes.headers.get('content-type');
        console.log(`   Status: ${screenshotRes.status}`);
        console.log(`   Content-Type: ${contentType}`);

        if (contentType && contentType.includes('image')) {
            console.log('   ✅ Returns image (API working)');
        } else {
            const data = await screenshotRes.json();
            console.log(`   ${data.isPlaceholder ? '⚠️  Placeholder mode' : '❌ Error'}`);
            if (data.error) console.log(`   Error: ${data.error}`);
            if (data.details) console.log(`   Details: ${data.details}`);
        }
    } catch (error) {
        console.log(`   ❌ Screenshot test failed: ${error.message}`);
    }

    // Test 3: Static assets
    console.log('\n3. Testing static assets...');
    try {
        const indexRes = await fetch(baseUrl);
        console.log(`   Index page: ${indexRes.status === 200 ? '✅ Loaded' : `❌ Failed (${indexRes.status})`}`);
    } catch (error) {
        console.log(`   ❌ Static assets test failed: ${error.message}`);
    }

    console.log('\n=== Deployment Test Complete ===');
    console.log('\nNEXT STEPS:');
    console.log('1. If API key is not configured, set BROWSERLESS_API_KEY in Vercel dashboard');
    console.log('2. If Browserless is not reachable, check your API key validity');
    console.log('3. Redeploy after setting environment variables');
}

testDeployment();