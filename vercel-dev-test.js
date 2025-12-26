// vercel-dev-test.js
console.log('=== Vercel Dev Environment Test ===');
console.log('1. Process env VERCEL:', process.env.VERCEL);
console.log('2. Process env VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('3. Current directory:', process.cwd());
console.log('4. User profile:', process.env.USERPROFILE);
console.log('5. Local app data:', process.env.LOCALAPPDATA);

// Check Chromium paths
import { join } from 'path';
import { existsSync } from 'fs';
import { glob } from 'glob';

const paths = [
    join(process.env.USERPROFILE, 'AppData', 'Local', 'ms-playwright', 'chromium-*', 'chrome-win', 'chrome.exe'),
    join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-*', 'chrome-win', 'chrome.exe'),
];

console.log('\n6. Checking Chromium paths:');
for (const pattern of paths) {
    console.log('  Checking:', pattern);
    try {
        const files = await glob.glob(pattern);
        if (files.length > 0) {
            console.log('    ✓ FOUND:', files[0]);
            console.log('    Exists:', existsSync(files[0]));
        } else {
            console.log('    ✗ Not found');
        }
    } catch (e) {
        console.log('    Error:', e.message);
    }
}

console.log('\n7. Testing direct launch...');
try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    console.log('    ✓ Direct launch works!');
    await browser.close();
} catch (e) {
    console.log('    ✗ Direct launch failed:', e.message);
}
