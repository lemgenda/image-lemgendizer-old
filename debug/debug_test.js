
const { spawn } = require('child_process');
const test = spawn('npm.cmd', ['run', 'test', 'src/__tests__/ui-integration/CropFlow.test.tsx', '--', '--reporter=verbose', '--threads=false'], { shell: true });

test.stdout.on('data', (data) => {
    console.log(`STDOUT: ${data}`);
});

test.stderr.on('data', (data) => {
    console.log(`STDERR: ${data}`);
});

test.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
});
