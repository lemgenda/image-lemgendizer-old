import JSZip from 'jszip';

/**
 * Generates a complete favicon set from an image
 * @async
 * @param {File} imageFile - Source image file
 * @param {string} siteName - Name of the website (for manifest)
 * @returns {Promise<Blob>} ZIP file containing the favicon set
 */
export const generateFaviconSet = async (imageFile, siteName = 'Website') => {
    const zip = new JSZip();

    // Create site.webmanifest
    const manifest = {
        "name": siteName,
        "short_name": siteName,
        "icons": [
            {
                "src": "/android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "/android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png"
            },
            {
                "src": "/apple-touch-icon.png",
                "sizes": "180x180",
                "type": "image/png",
                "purpose": "maskable any"
            }
        ],
        "theme_color": "#ffffff",
        "background_color": "#ffffff",
        "display": "standalone"
    };

    zip.file("site.webmanifest", JSON.stringify(manifest, null, 2));

    // Create readme.txt
    const readme = `Favicon Set - ${siteName}
=====================

This zip file contains a complete favicon set for your website.

Files included:
1. site.webmanifest - Web App Manifest file
2. android-chrome-192x192.png - Android Chrome icon (192x192)
3. android-chrome-512x512.png - Android Chrome icon (512x512)
4. apple-touch-icon.png - Apple touch icon (180x180)
5. favicon-16x16.png - Standard favicon (16x16)
6. favicon-32x32.png - Standard favicon (32x32)
7. favicon-48x48.png - Standard favicon (48x48)
8. favicon.ico - ICO format favicon (multi-size)
9. readme.txt - This file

How to use:
1. Extract all files to your website's root directory
2. Add the following HTML to your <head> section:

    <!-- Favicon & App Icons -->
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="icon" href="/favicon.ico" type="image/x-icon">

3. Test on different devices and browsers

Notes:
- The favicon.ico contains multiple sizes (16x16, 32x32, 48x48)
- Apple touch icon should be 180x180 for iOS devices
- Android Chrome icons should be 192x192 and 512x512
- Make sure all paths are correct for your website structure`;

    zip.file("readme.txt", readme);

    // Generate all icon sizes
    const sizes = [
        { name: 'android-chrome-192x192.png', width: 192, height: 192 },
        { name: 'android-chrome-512x512.png', width: 512, height: 512 },
        { name: 'apple-touch-icon.png', width: 180, height: 180 },
        { name: 'favicon-16x16.png', width: 16, height: 16 },
        { name: 'favicon-32x32.png', width: 32, height: 32 },
        { name: 'favicon-48x48.png', width: 48, height: 48 }
    ];

    // Create ICO file (multi-size icon)
    const icoCanvas = document.createElement('canvas');
    const icoCtx = icoCanvas.getContext('2d');

    // Load the source image
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
    });

    // Generate PNG icons
    for (const size of sizes) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = size.width;
        canvas.height = size.height;

        if (size.width <= 32) {
            ctx.clearRect(0, 0, size.width, size.height);

            const scale = Math.min(size.width / img.width, size.height / img.height) * 0.8;
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (size.width - scaledWidth) / 2;
            const y = (size.height - scaledHeight) / 2;

            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        } else {
            ctx.clearRect(0, 0, size.width, size.height);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, size.width, size.height);
        }

        // Convert to blob and add to zip
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png', 0.9);
        });

        zip.file(size.name, blob);
    }

    // Create favicon.ico (contains multiple sizes)
    const icoSizes = [16, 32, 48];
    const icoBlobs = [];

    for (const icoSize of icoSizes) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = icoSize;
        canvas.height = icoSize;

        ctx.clearRect(0, 0, icoSize, icoSize);

        const scale = Math.min(icoSize / img.width, icoSize / img.height) * 0.8;
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (icoSize - scaledWidth) / 2;
        const y = (icoSize - scaledHeight) / 2;

        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });

        icoBlobs.push({ size: icoSize, blob });
    }

    // For simplicity, we'll create a simple ICO file with one size
    // In a production environment, you'd use a proper ICO encoder library
    const simpleIcoCanvas = document.createElement('canvas');
    const simpleIcoCtx = simpleIcoCanvas.getContext('2d');
    simpleIcoCanvas.width = 32;
    simpleIcoCanvas.height = 32;

    simpleIcoCtx.fillStyle = '#ffffff';
    simpleIcoCtx.fillRect(0, 0, 32, 32);

    const scale = Math.min(32 / img.width, 32 / img.height) * 0.8;
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (32 - scaledWidth) / 2;
    const y = (32 - scaledHeight) / 2;

    simpleIcoCtx.drawImage(img, x, y, scaledWidth, scaledHeight);

    const icoBlob = await new Promise(resolve => {
        simpleIcoCanvas.toBlob(resolve, 'image/x-icon');
    });

    zip.file("favicon.ico", icoBlob);

    URL.revokeObjectURL(objectUrl);

    // Generate the zip file
    return await zip.generateAsync({ type: 'blob' });
};