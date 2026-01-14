const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/';
const TARGET_DIR = path.join(__dirname, '..', 'local_models', 'coco-ssd', 'lite_mobilenet_v2');

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function downloadFile(url, dest) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
    console.log(`Downloaded: ${path.basename(dest)}`);
}

async function downloadModel() {
    console.log('Starting COCO-SSD model download...');

    // 1. Download model.json
    const modelJsonPath = path.join(TARGET_DIR, 'model.json');
    await downloadFile(`${BASE_URL}model.json`, modelJsonPath);

    // 2. Read model.json
    const modelData = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
    const weightFiles = [];
    if (modelData.weightsManifest) {
        modelData.weightsManifest.forEach(manifest => {
            if (manifest.paths) {
                weightFiles.push(...manifest.paths);
            }
        });
    }

    console.log(`Found ${weightFiles.length} weight files.`);

    // 3. Download weights
    for (const weightFile of weightFiles) {
        await downloadFile(`${BASE_URL}${weightFile}`, path.join(TARGET_DIR, weightFile));
    }

    console.log('All model files downloaded successfully.');
}

downloadModel().catch(console.error);
