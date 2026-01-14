const { spawn } = require('child_process');
const fs = require('fs');

console.log("Starting test capture...");
const logStream = fs.createWriteStream('debug/full_error.log');

const child = spawn('npm', ['run', 'test', '--', '--run', 'src/__tests__/ui-integration/AiQualityImprovementFlow.test.tsx'], {
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' } // Disable color to make logs cleaner
});

child.stdout.on('data', (data) => {
    logStream.write(data);
});

child.stderr.on('data', (data) => {
    logStream.write(data);
});

child.on('close', (code) => {
    console.log(`Test process exited with code ${code}`);
    logStream.end();
});
