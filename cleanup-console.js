const fs = require('fs');
const path = require('path');

console.log('🧹 Starting console statement cleanup...\n');

const files = [
    path.join(__dirname, 'src', 'processors', 'cropProcessor.js'),
    path.join(__dirname, 'src', 'processors', 'imageProcessor.js'),
    path.join(__dirname, 'src', 'utils', 'generalUtils.js')
];

let totalRemoved = 0;

files.forEach(filePath => {
    const fileName = path.basename(filePath);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${fileName} - File not found, skipping`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    const consoleMatches = content.match(/console\.(log|warn|error|info|debug|group|groupEnd)\(/g);
    const beforeCount = consoleMatches ? consoleMatches.length : 0;

    content = content.replace(/^\s*console\.(log|warn|error|info|debug|group|groupEnd)\([^)]*\);?\s*$/gm, '');
    content = content.replace(/\n{4,}/g, '\n\n\n');

    const afterMatches = content.match(/console\.(log|warn|error|info|debug|group|groupEnd)\(/g);
    const afterCount = afterMatches ? afterMatches.length : 0;
    const removed = beforeCount - afterCount;

    totalRemoved += removed;

    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`✅ ${fileName}`);
    console.log(`   Removed: ${removed} console statement(s)`);
    console.log(`   Remaining: ${afterCount}\n`);
});

console.log(`\n🎉 Cleanup complete!`);
console.log(`📊 Total console statements removed: ${totalRemoved}`);
