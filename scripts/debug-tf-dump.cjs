const fs = require('fs');
const path = require('path');

const tfPath = path.join(__dirname, '../node_modules/@tensorflow/tfjs/dist/tf.min.js');
const dumpPath = path.join(__dirname, 'debug_tf_dump.txt');
const content = fs.readFileSync(tfPath, 'utf8');

const index = content.indexOf('runKernel');
if (index === -1) {
    fs.writeFileSync(dumpPath, 'runKernel not found!');
} else {
    // Dump 200 chars before and 300 after
    const start = Math.max(0, index - 200);
    const end = Math.min(content.length, index + 300);
    const snippet = content.substring(start, end);
    fs.writeFileSync(dumpPath, snippet);
    console.log('Dumped to ' + dumpPath);
}
