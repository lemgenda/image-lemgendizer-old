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

        // 2. Copy ESRGAN Slim Models (Optional, but good for completeness)
        const esrganSrc = path.join(nodeModulesDir, '@upscalerjs', 'esrgan-slim', 'models');
        const esrganDest = path.join(publicModelsDir, 'esrgan-slim');
        console.log(`Copying esrgan-slim to ${esrganDest}...`);
        await copyDir(esrganSrc, esrganDest);

        console.log('✅ AI Models copied successfully!');
    } catch (err) {
        console.error('❌ Error copying models:', err);
        process.exit(1);
    }
}

copyModels();
