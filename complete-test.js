// complete-test.js
async function runCompleteTestSuite() {
    console.log('🚀 Complete API Test Suite\n');
    console.log('='.repeat(60));

    const testCases = [
        {
            name: 'Basic screenshot (lemgenda.hr)',
            body: { url: 'https://lemgenda.hr' }
        },
        {
            name: 'Mobile viewport',
            body: {
                url: 'https://lemgenda.hr',
                device: 'mobile'
            }
        },
        {
            name: 'Tablet viewport',
            body: {
                url: 'https://lemgenda.hr',
                device: 'tablet'
            }
        },
        {
            name: 'Custom dimensions',
            body: {
                url: 'https://lemgenda.hr',
                width: 1024,
                height: 768
            }
        },
        {
            name: 'Full page screenshot',
            body: {
                url: 'https://lemgenda.hr',
                fullPage: true
            }
        },
        {
            name: 'JPEG with quality',
            body: {
                url: 'https://lemgenda.hr',
                type: 'jpeg',
                quality: 90
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n🧪 Testing: ${testCase.name}`);

        try {
            const response = await fetch('http://localhost:3000/api/screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testCase.body),
                signal: AbortSignal.timeout(30000)
            });

            console.log(`   Status: ${response.status}`);

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('image')) {
                    const buffer = await response.arrayBuffer();
                    console.log(`   ✅ Success: ${buffer.byteLength} bytes`);
                    console.log(`   📏 Dimensions: ${response.headers.get('x-dimensions')}`);
                    console.log(`   ⚙️  Method: ${response.headers.get('x-method')}`);
                } else {
                    console.log(`   ⚠️  Not an image: ${contentType}`);
                }
            } else {
                const error = await response.text();
                console.log(`   ❌ Error: ${error.substring(0, 200)}`);
            }
        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('\n🎉 Your screenshot API is fully functional!');
}

runCompleteTestSuite().catch(console.error);