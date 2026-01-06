const fs = require('fs');
const path = require('path');

try {
    // Patch coco-ssd.min.js
    const file1 = path.join(__dirname, 'node_modules', '@tensorflow-models', 'coco-ssd', 'dist', 'coco-ssd.min.js');
    let content1 = fs.readFileSync(file1, 'utf8');
    content1 = content1.replace(/\.dataSync\(\)/g, '.data()');
    fs.writeFileSync(file1, content1);
    console.log('✓ Patched coco-ssd.min.js');

    // Patch coco-ssd.es2017.esm.min.js
    const file2 = path.join(__dirname, 'node_modules', '@tensorflow-models', 'coco-ssd', 'dist', 'coco-ssd.es2017.esm.min.js');
    let content2 = fs.readFileSync(file2, 'utf8');
    content2 = content2.replace(/\.dataSync\(\)/g, '.data()');
    fs.writeFileSync(file2, content2);
    console.log('✓ Patched coco-ssd.es2017.esm.min.js');

    console.log('\nAll dataSync() calls successfully converted to data()');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
