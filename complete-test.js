// complete-test-fixed.js
async function runCompleteTestSuite() {
    console.log('🚀 Complete Screenshot API Test Suite\n');
    console.log('='.repeat(60));

    const testCases = [
        {
            name: 'Default desktop screenshot',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-desktop'  // Added templateId
            }
        },
        {
            name: 'Mobile screenshot via template',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-mobile'
            }
        },
        {
            name: 'Tablet screenshot via template',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-tablet'
            }
        },
        {
            name: 'Desktop HD screenshot',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-desktop-hd'
            }
        },
        {
            name: 'Mobile full page',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-mobile-full',
                fullPage: true
            }
        },
        {
            name: 'Custom dimensions override',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-desktop',
                width: 800,
                height: 600
            }
        },
        {
            name: 'Timeout test (should fail with 1 second timeout)',
            body: {
                url: 'https://lemgenda.hr',
                templateId: 'screenshots-desktop',
                timeout: 1000
            },
            shouldPass: false
        },
        {
            name: 'Invalid URL (should return validation error)',
            body: {
                url: 'not-a-valid-url',
                templateId: 'screenshots-desktop'
            },
            shouldPass: false
        },
        {
            name: 'Missing templateId (should use default)',
            body: {
                url: 'https://lemgenda.hr'
                // No templateId - should default to screenshots-desktop
            }
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\n🧪 Test ${testCases.indexOf(testCase) + 1}: ${testCase.name}`);
        console.log(`   Request: ${JSON.stringify(testCase.body)}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch('https://image-lemgendizer-old-x2qz.vercel.app/api/screenshot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'image/png, application/json'
                },
                body: JSON.stringify(testCase.body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log(`   Status: ${response.status} ${response.statusText}`);

            // Log all headers for debugging
            console.log('   Headers:');
            for (const [key, value] of response.headers.entries()) {
                console.log(`     ${key}: ${value}`);
            }

            const contentType = response.headers.get('content-type');

            if (response.ok) {
                if (contentType && contentType.includes('image')) {
                    const buffer = await response.arrayBuffer();
                    console.log(`   ✅ SUCCESS: ${(buffer.byteLength / 1024).toFixed(2)} KB image`);
                    console.log(`   📏 Dimensions: ${response.headers.get('x-dimensions')}`);
                    console.log(`   ⚙️  Method: ${response.headers.get('x-method')}`);
                    console.log(`   📱 Device: ${response.headers.get('x-device')}`);
                    console.log(`   🏷️  Template: ${response.headers.get('x-template')}`);
                    console.log(`   📍 Placeholder: ${response.headers.get('x-is-placeholder')}`);
                    passed++;
                } else if (contentType && contentType.includes('json')) {
                    const errorData = await response.json();
                    console.log(`   ⚠️  JSON Response (expected image):`);
                    console.log(`      Error: ${errorData.error}`);
                    console.log(`      Placeholder: ${errorData.isPlaceholder}`);
                    if (errorData.details) {
                        console.log(`      Details: ${errorData.details}`);
                    }
                    failed++;
                } else {
                    console.log(`   ❓ Unexpected content type: ${contentType}`);
                    failed++;
                }
            } else {
                if (contentType && contentType.includes('json')) {
                    const errorData = await response.json();
                    console.log(`   ❌ Error Response:`);
                    console.log(`      Error: ${errorData.error}`);
                    if (errorData.isPlaceholder !== undefined) {
                        console.log(`      Placeholder: ${errorData.isPlaceholder}`);
                    }
                    failed++;
                } else {
                    const errorText = await response.text();
                    console.log(`   ❌ Error: ${errorText.substring(0, 200)}`);
                    failed++;
                }
            }

        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Summary: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All tests passed! Your screenshot API is working perfectly!');
    } else {
        console.log('⚠️  Some tests failed. Check the logs above for details.');
    }
}

// Run with proper error handling
runCompleteTestSuite().catch(error => {
    console.error('Test suite crashed:', error);
    process.exit(1);
});