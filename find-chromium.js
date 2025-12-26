// find-chromium.js
import { execSync } from 'child_process';

console.log('=== Finding Real Chromium Location ===');

// Method 1: Ask Playwright directly
try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const version = await browser.version();
    console.log('1. Playwright launched browser version:', version);
    
    // Get the actual executable path from browser process
    console.log('2. Browser process info available');
    await browser.close();
} catch (e) {
    console.log('1. Playwright error:', e.message);
}

// Method 2: Check common Windows locations
console.log('\n3. Checking common Windows paths:');
const paths = [
    "$env:USERPROFILE\\AppData\\Local\\ms-playwright",
    "$env:LOCALAPPDATA\\ms-playwright", 
    "$env:APPDATA\\..\\Local\\ms-playwright",
    "$env:ProgramData\\ms-playwright",
    "C:\\Users\\$env:USERNAME\\AppData\\Local\\ms-playwright"
];

for (const path of paths) {
    const fullPath = path.replace('$env:USERPROFILE', process.env.USERPROFILE)
                        .replace('$env:LOCALAPPDATA', process.env.LOCALAPPDATA)
                        .replace('$env:APPDATA', process.env.APPDATA)
                        .replace('$env:ProgramData', process.env.ProgramData || 'C:\\ProgramData')
                        .replace('$env:USERNAME', process.env.USERNAME);
    
    console.log(`   Checking: ${fullPath}`);
    try {
        const fs = await import('fs');
        if (fs.existsSync(fullPath)) {
            console.log(`   ✓ EXISTS!`);
            // List contents
            const items = fs.readdirSync(fullPath, { withFileTypes: true });
            items.forEach(item => {
                console.log(`     - ${item.name} ${item.isDirectory() ? '(dir)' : ''}`);
                if (item.isDirectory() && item.name.includes('chromium')) {
                    const chromePath = `${fullPath}\\${item.name}\\chrome-win\\chrome.exe`;
                    if (fs.existsSync(chromePath)) {
                        console.log(`       → CHROME.EXE FOUND: ${chromePath}`);
                    }
                }
            });
        }
    } catch (e) {
        // Ignore errors
    }
}

// Method 3: Use where command
console.log('\n4. Using "where" command:');
try {
    const whereResult = execSync('where /r "%USERPROFILE%\\AppData\\Local" chrome.exe 2>nul', { encoding: 'utf-8' });
    if (whereResult.trim()) {
        console.log('Found chrome.exe at:');
        console.log(whereResult);
    } else {
        console.log('No chrome.exe found in search');
    }
} catch (e) {
    console.log('Where command failed or found nothing');
}
