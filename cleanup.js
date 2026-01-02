const fs = require('fs');
const path = require('path');

const files = [
    path.resolve(__dirname, 'src/processors/cropProcessor.js'),
    path.resolve(__dirname, 'src/processors/imageProcessor.js'),
    path.resolve(__dirname, 'src/utils/generalUtils.js')
];

let totalRemoved = 0;

files.forEach(filePath => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const before = (content.match(/console\./g) || []).length;

        const cleaned = content.replace(/\s*console\.(log|warn|error|info|debug|group|groupEnd)\([^;]*\);?\s*/g, '\n');

        const after = (cleaned.match(/console\./g) || []).length;
        const removed = before - after;
        totalRemoved += removed;

        fs.writeFileSync(filePath, cleaned, 'utf8');

        console.log(path.basename(filePath) + ': ' + removed + ' removed');
    } catch (e) {
        console.log('Error: ' + filePath + ' - ' + e.message);
    }
});

console.log('Total removed: ' + totalRemoved);
