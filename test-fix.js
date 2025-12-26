// test-fix.js
async function testFixedParameters() {
    console.log('🧪 Testing with corrected parameters...');

    const testBody = {
        url: 'https://lemgenda.hr',
        templateId: 'screenshots-desktop'
    };

    try {
        const response = await fetch('https://image-lemgendizer-old-x2qz.vercel.app/api/screenshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'image/png, application/json'
            },
            body: JSON.stringify(testBody)
        });

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));

        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('image')) {
            console.log('✅ SUCCESS: Got image response!');
            const buffer = await response.arrayBuffer();
            console.log(`Image size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

            // Save to file if in Node.js
            if (typeof require !== 'undefined') {
                const fs = require('fs');
                fs.writeFileSync('test-screenshot.png', Buffer.from(buffer));
                console.log('📁 Saved as test-screenshot.png');
            }
        } else {
            const error = await response.json();
            console.log('❌ JSON Error:', error);
        }
    } catch (error) {
        console.log('❌ Request failed:', error.message);
    }
}

testFixedParameters();