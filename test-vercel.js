import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const VERCEL_URL = process.env.VERCEL_URL || 'https://image-lemgendizer-old-x2qz.vercel.app/';
const TEST_OUTPUT_DIR = './test-results';
const TIMEOUT = 15000;

function ensureTestDirectory() {
    if (!existsSync(TEST_OUTPUT_DIR)) {
        mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHealthEndpoint() {
    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(`${VERCEL_URL}/api/health`, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Vercel-Test-Script/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                name: 'Health Endpoint',
                success: false,
                duration: Date.now() - startTime,
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        const data = await response.json();

        return {
            name: 'Health Endpoint',
            success: true,
            duration: Date.now() - startTime,
            data: {
                status: data.status,
                hasApiKey: data.hasApiKey,
                browserlessStatus: data.browserlessStatus,
                uptime: data.uptime,
                memory: data.memory
            }
        };

    } catch (error) {
        return {
            name: 'Health Endpoint',
            success: false,
            duration: Date.now() - startTime,
            error: error.name === 'AbortError' ? 'Timeout' : error.message
        };
    }
}

async function testScreenshotEndpoint(params) {
    const startTime = Date.now();
    const testName = `Screenshot: ${params.device || 'default'} (${params.width}x${params.height})`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(`${VERCEL_URL}/api/screenshot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Test-Script/1.0'
            },
            body: JSON.stringify(params),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                name: testName,
                success: false,
                duration: responseTime,
                status: response.status,
                error: `HTTP ${response.status}`,
                details: errorText.substring(0, 200)
            };
        }

        const isImage = contentType && contentType.includes('image');
        const isJson = contentType && contentType.includes('json');

        let resultData = {
            contentType,
            contentLength,
            isImage,
            isJson,
            duration: responseTime
        };

        if (isImage) {
            const buffer = await response.arrayBuffer();
            resultData.size = buffer.byteLength;

            const filename = `screenshot-${params.device || 'default'}-${Date.now()}.png`;
            const filepath = join(TEST_OUTPUT_DIR, filename);
            writeFileSync(filepath, Buffer.from(buffer));
            resultData.fileSaved = filename;

            resultData.imageValid = validatePNG(buffer);
        } else if (isJson) {
            const jsonData = await response.json();
            resultData.jsonResponse = jsonData;
        } else {
            const text = await response.text();
            resultData.textResponse = text.substring(0, 200);
        }

        return {
            name: testName,
            success: true,
            duration: responseTime,
            data: resultData
        };

    } catch (error) {
        return {
            name: testName,
            success: false,
            duration: Date.now() - startTime,
            error: error.name === 'AbortError' ? 'Timeout' : error.message
        };
    }
}

function validatePNG(buffer) {
    if (buffer.byteLength < 8) return false;

    const view = new Uint8Array(buffer);

    const pngSignature = [
        0x89, 0x50, 0x4E, 0x47,
        0x0D, 0x0A, 0x1A, 0x0A
    ];

    for (let i = 0; i < 8; i++) {
        if (view[i] !== pngSignature[i]) {
            return false;
        }
    }

    return true;
}

async function runAllTests() {
    console.log(`\n🚀 Testing Vercel Deployment: ${VERCEL_URL}\n`);
    console.log('='.repeat(60));

    ensureTestDirectory();

    const tests = [];
    const results = {
        passed: 0,
        failed: 0,
        totalDuration: 0
    };

    tests.push(testHealthEndpoint());

    const screenshotTests = [
        { url: 'https://example.com', device: 'desktop', width: 800, height: 600 },
        { url: 'https://example.com', device: 'mobile', width: 375, height: 667 },
        { url: 'https://example.com', device: 'tablet', width: 768, height: 1024 }
    ];

    for (const testParams of screenshotTests) {
        tests.push(testScreenshotEndpoint(testParams));
        await sleep(1000);
    }

    const testResults = await Promise.all(tests);

    console.log('\n📊 TEST RESULTS:\n');

    for (const result of testResults) {
        results.totalDuration += result.duration;

        if (result.success) {
            results.passed++;
            console.log(`✅ ${result.name}`);
            console.log(`   Duration: ${result.duration}ms`);

            if (result.data) {
                if (result.data.isImage) {
                    console.log(`   Image: ${result.data.size} bytes`);
                    console.log(`   Saved: ${result.data.fileSaved}`);
                    console.log(`   Valid PNG: ${result.data.imageValid ? 'Yes' : 'No'}`);
                } else if (result.data.jsonResponse) {
                    console.log(`   JSON Response: ${JSON.stringify(result.data.jsonResponse).substring(0, 100)}...`);
                }
            }
        } else {
            results.failed++;
            console.log(`❌ ${result.name}`);
            console.log(`   Duration: ${result.duration}ms`);
            console.log(`   Error: ${result.error}`);
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
        }
        console.log();
    }

    console.log('='.repeat(60));
    console.log('\n📈 SUMMARY:\n');
    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / testResults.length) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${results.totalDuration}ms`);

    if (results.failed > 0) {
        console.log('\n🔴 DEPLOYMENT ISSUES DETECTED');
        process.exit(1);
    } else {
        console.log('\n✅ DEPLOYMENT SUCCESSFUL');
        console.log(`Test results saved in: ${TEST_OUTPUT_DIR}`);
    }
}

async function main() {
    try {
        await runAllTests();
    } catch (error) {
        console.error('Test script failed:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}