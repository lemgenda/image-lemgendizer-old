// test-screenshot.js
async function testScreenshotAPI() {
    console.log('Testing Screenshot API...\n');

    const testCases = [
        {
            name: 'Default Desktop Screenshot',
            body: { url: 'https://lemgenda.hr', templateId: 'screenshots-desktop' }
        },
        {
            name: 'Mobile Screenshot',
            body: { url: 'https://lemgenda.hr', templateId: 'screenshots-mobile' }
        },
        {
            name: 'Full Page Desktop',
            body: { url: 'https://lemgenda.hr', templateId: 'screenshots-desktop-full' }
        },
        {
            name: 'Custom Dimensions',
            body: { url: 'https://lemgenda.hr', templateId: 'screenshots-desktop', width: 800, height: 600 }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n🧪 ${testCase.name}`);
        console.log(`   Request: ${JSON.stringify(testCase.body)}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch('/api/screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testCase.body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log(`   Status: ${response.status}`);

            const contentType = response.headers.get('content-type');

            if (response.ok) {
                if (contentType && contentType.includes('image')) {
                    const buffer = await response.arrayBuffer();
                    console.log(`   ✅ SUCCESS: Got ${(buffer.byteLength / 1024).toFixed(2)} KB image`);
                    console.log(`   📏 Dimensions: ${response.headers.get('x-dimensions')}`);
                    console.log(`   ⚙️  Method: ${response.headers.get('x-method')}`);
                    console.log(`   📱 Device: ${response.headers.get('x-device')}`);
                    console.log(`   🏷️  Template: ${response.headers.get('x-template')}`);
                    console.log(`   📍 Placeholder: ${response.headers.get('x-is-placeholder')}`);
                } else if (contentType && contentType.includes('json')) {
                    const data = await response.json();
                    console.log(`   ⚠️  JSON Response:`);
                    console.log(`      Success: ${data.success}`);
                    console.log(`      Error: ${data.error}`);
                    console.log(`      Placeholder: ${data.isPlaceholder}`);
                }
            } else {
                const error = await response.text();
                console.log(`   ❌ Error: ${error.substring(0, 200)}`);
            }
        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
        }
    }
}

// Run the test
testScreenshotAPI();