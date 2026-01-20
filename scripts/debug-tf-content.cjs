const fs = require('fs');
const path = require('path');

const tfPath = path.join(__dirname, '../node_modules/@tensorflow/tfjs/dist/tf.min.js');
const content = fs.readFileSync(tfPath, 'utf8');

let pos = 0;
let count = 0;
while (true) {
    const index = content.indexOf('runKernel', pos);
    if (index === -1) break;

    console.log(`--- Match #${++count} at ${index} ---`);
    console.log('Context:', JSON.stringify(content.substring(Math.max(0, index - 40), Math.min(content.length, index + 60))));

    pos = index + 9;
    if (count >= 10) break; // Limit to first 10 matches
}
if (count === 0) console.log('runKernel not found!');
