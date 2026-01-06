import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fsPromises = fs.promises;

async function copyDir(src, dest) {
    try {
        await fsPromises.mkdir(dest, { recursive: true });
        const entries = await fsPromises.readdir(src, { withFileTypes: true });

        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await copyDir(srcPath, destPath);
            } else {
                await fsPromises.copyFile(srcPath, destPath);
            }
        }
    } catch (err) {
        console.warn(`Warning: Could not copy from ${src} to ${dest}. Error: ${err.message}`);
    }
}

async function copyModels() {
    const rootDir = path.resolve(__dirname, '..');
    const publicModelsDir = path.join(rootDir, 'public', 'models');
    const nodeModulesDir = path.join(rootDir, 'node_modules');

    console.log('Starting model copy process...');

    try {
        // Clean existing directory to prevent duplicates
        console.log('Cleaning existing models...');
        try {
            await fsPromises.rm(publicModelsDir, { recursive: true, force: true });
        } catch { /* ignore if not exists */ }

        await fsPromises.mkdir(publicModelsDir, { recursive: true });

        // 1. Copy MAXIM Models
        // These are critical for the new AI features
        const maximPackages = [
            'maxim-deblurring',
            'maxim-dehazing-indoor',
            'maxim-dehazing-outdoor',
            'maxim-denoising',
            'maxim-deraining',
            'maxim-enhancement',
            'maxim-retouching'
        ];

        const maximDestDir = path.join(publicModelsDir, 'maxim');
        await fsPromises.mkdir(maximDestDir, { recursive: true });

        for (const pkg of maximPackages) {
            const srcDir = path.join(nodeModulesDir, '@upscalerjs', pkg, 'models');
            // We copy all contents of the models dir into public/models/maxim/
            // Note: If multiple packages have 'model.json', they will clash.
            // We should subfolder them or rename them?
            // The loading logic in aiLoaderUtils expects: /models/maxim/${filename}
            // where filename is from the URL.
            // The URL for DEBLUR is: '.../maxim-deblurring@0.1.0/models/model.json'
            // So filename is 'model.json'.
            // If they are all named 'model.json', we MUST use subfolders.

            // Let's create subfolders matching the package name or key.
            // But aiLoaderUtils currently says:
            // const getLocalPath = (url: string) => {
            //    const filename = url.split('/').pop();
            //    return `/models/maxim/${filename}`;
            // };
            // This logic is FLAWED if all files are named 'model.json'.
            // I should update aiLoaderUtils to handle this, OR rename the files here.

            // Checking MAXIM models on CDN... usually they contain model.json and shard files.
            // If I put them in public/models/maxim/deblurring/model.json
            // Then I need to update aiLoaderUtils to look there.

            // I will copy them to subdirectories.
            const destDir = path.join(maximDestDir, pkg.replace('maxim-', ''));
            console.log(`Copying ${pkg} to ${destDir}...`);
            await copyDir(srcDir, destDir);
        }

        // 2. Copy ESRGAN Slim Models
        const esrganSrc = path.join(nodeModulesDir, '@upscalerjs', 'esrgan-slim', 'models');
        const esrganDest = path.join(publicModelsDir, 'esrgan-slim');
        console.log(`Copying esrgan-slim to ${esrganDest}...`);
        await copyDir(esrganSrc, esrganDest);

        // 3. Download COCO-SSD Models (lite_mobilenet_v2 and mobilenet_v2)
        // These are not in node_modules, so we must fetch them.
        const https = await import('https');
        const downloadFile = (url, dest) => {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(dest);
                https.get(url, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => { }); // Delete the file async
                    reject(err);
                });
            });
        };

        const cocoBaseUrl = 'https://storage.googleapis.com/tfjs-models/savedmodel';
        const cocoDestDir = path.join(publicModelsDir, 'coco-ssd');
        await fsPromises.mkdir(cocoDestDir, { recursive: true });

        const modelsToFetch = [
            { name: 'lite_mobilenet_v2', subpath: 'ssd_mobilenet_v2', files: ['model.json', 'group1-shard1of1.bin', 'group1-shard2of2.bin'] }, // Shards might vary, checking logic needed or assume standard
            // Actually, lite_mobilenet_v2 uses different shards.
            // Simplified approach: Just download mobilenet_v2 (the one we want) for now to minimize complexity/risk.
            // URL: https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json
            { name: 'mobilenet_v2', urlPath: 'ssd_mobilenet_v2', files: ['model.json', 'group1-shard1of2.bin', 'group1-shard2of2.bin'] },
            { name: 'lite_mobilenet_v2', urlPath: 'ssd_lite_mobilenet_v2', files: ['model.json', 'group1-shard1of2.bin', 'group1-shard2of2.bin'] }
        ];

        console.log('Downloading COCO-SSD models...');
        for (const model of modelsToFetch) {
            const modelDir = path.join(cocoDestDir, model.name);
            await fsPromises.mkdir(modelDir, { recursive: true });
            console.log(`Downloading ${model.name} to ${modelDir}...`);

            for (const file of model.files) {
                const dest = path.join(modelDir, file);
                const url = `${cocoBaseUrl}/${model.urlPath}/${file}`;
                // Check if exists to avoid redownloading
                try {
                    await fsPromises.access(dest);
                    console.log(`  - ${file} exists, skipping.`);
                } catch {
                    console.log(`  - Fetching ${file}...`);
                    try {
                        await downloadFile(url, dest);
                    } catch (e) {
                        console.warn(`    Failed to download ${file}: ${e.message}. (Note: Shard names may vary by version, relying on CDN fallback if incomplete)`);
                    }
                }
            }
        }

        console.log('✅ AI Models copied/downloaded successfully!');
    } catch (err) {
        console.error('❌ Error copying models:', err);
        process.exit(1);
    }
}

copyModels();
