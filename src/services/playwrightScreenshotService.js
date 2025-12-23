// src/services/playwrightScreenshotService.js
import JSZip from 'jszip';

/**
 * Service for capturing screenshots using Playwright on Vercel
 */
export class PlaywrightScreenshotService {
    /**
     * Creates a new screenshot service instance
     * @param {string} apiUrl - The Vercel API endpoint URL
     */
    constructor(apiUrl = process.env.REACT_APP_SCREENSHOT_API_URL) {
        this.apiUrl = apiUrl || 'https://your-app.vercel.app/api/screenshot';
    }

    /**
     * Captures a screenshot for a single device
     * @param {string} url - The URL to capture
     * @param {string} device - Device type (mobile, tablet, desktop)
     * @returns {Promise<Object>} Screenshot result
     */
    async captureSingle(url, device = 'mobile') {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    device,
                    fullPage: false
                }),
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');

            if (contentType.includes('application/json')) {
                const errorData = await response.json();
                if (errorData.placeholder) {
                    return await this.createFrontendPlaceholder(errorData.data);
                }
                throw new Error(errorData.error || 'Unknown error');
            }

            const blob = await response.blob();
            const deviceInfo = response.headers.get('X-Device') || device;
            const dimensions = response.headers.get('X-Dimensions') || 'unknown';

            return {
                success: true,
                device,
                displayName: deviceInfo,
                dimensions,
                blob,
                format: 'webp',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                device,
                error: error.message,
                placeholder: await this.createFrontendPlaceholder({
                    url,
                    device,
                    error: error.message,
                    dimensions: this.getDeviceDimensions(device)
                })
            };
        }
    }

    /**
     * Captures screenshots for all three device types in parallel
     * @param {string} url - The URL to capture
     * @returns {Promise<Object>} Object containing results for each device
     */
    async captureAllDevices(url) {
        const devices = ['mobile', 'tablet', 'desktop'];

        const promises = devices.map(device =>
            this.captureSingle(url, device)
                .catch(error => ({
                    success: false,
                    device,
                    error: error.message,
                    placeholder: this.createFrontendPlaceholder({
                        url,
                        device,
                        error: error.message,
                        dimensions: this.getDeviceDimensions(device)
                    })
                }))
        );

        const results = await Promise.all(promises);

        return devices.reduce((acc, device, index) => {
            acc[device] = results[index];
            return acc;
        }, {});
    }

    /**
     * Creates a ZIP file containing all captured screenshots
     * @param {string} url - The original URL
     * @param {Object} screenshotResults - Results from captureAllDevices
     * @returns {Promise<Blob>} ZIP file blob
     */
    async createScreenshotZip(url, screenshotResults) {
        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hostname = this.extractHostname(url);

        Object.entries(screenshotResults).forEach(([device, result]) => {
            if (result.success && result.blob) {
                const filename = `${hostname}-${device}-${timestamp}.webp`;
                zip.file(filename, result.blob);
            } else if (result.placeholder) {
                const filename = `${hostname}-${device}-error-${timestamp}.png`;
                zip.file(filename, result.placeholder);
            }
        });

        const metadata = {
            url,
            generated: new Date().toISOString(),
            results: Object.entries(screenshotResults).map(([device, result]) => ({
                device,
                success: result.success,
                dimensions: result.dimensions || this.getDeviceDimensions(device),
                error: result.error || null
            })),
            service: 'Playwright on Vercel',
            note: 'Some screenshots may be placeholders due to timeout or website restrictions'
        };

        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        const readme = this.createReadme(url, screenshotResults);
        zip.file('README.txt', readme);

        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE'
        });
    }

    /**
     * Creates a frontend placeholder image for failed screenshots
     * @param {Object} errorData - Error information
     * @returns {Promise<Blob>} Placeholder image blob
     */
    async createFrontendPlaceholder(errorData) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const { width, height } = errorData.dimensions || { width: 375, height: 667 };

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#f8f9fa');
            gradient.addColorStop(1, '#e9ecef');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = '#dee2e6';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, width - 20, height - 20);

            const centerX = width / 2;
            const centerY = height / 2;

            ctx.fillStyle = '#dc3545';
            ctx.font = `bold ${Math.min(48, height / 8)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚠️', centerX, centerY - 50);

            ctx.fillStyle = '#343a40';
            ctx.font = `bold ${Math.min(24, height / 12)}px Arial`;
            ctx.fillText('Screenshot Failed', centerX, centerY);

            ctx.fillStyle = '#6c757d';
            ctx.font = `${Math.min(14, height / 20)}px Arial`;

            const errorMsg = errorData.error || 'Unknown error';
            const maxWidth = width - 40;
            const lines = this.wrapText(ctx, errorMsg, maxWidth);

            lines.forEach((line, index) => {
                ctx.fillText(line, centerX, centerY + 40 + (index * 25));
            });

            ctx.fillStyle = '#495057';
            ctx.font = `${Math.min(12, height / 25)}px Arial`;
            ctx.fillText(`${errorData.device} - ${width}x${height}`, centerX, centerY + 100);

            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png', 0.9);
        });
    }

    /**
     * Wraps text to fit within a specified width
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} text - Text to wrap
     * @param {number} maxWidth - Maximum width in pixels
     * @returns {string[]} Array of wrapped lines
     */
    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;

            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        lines.push(currentLine);
        return lines;
    }

    /**
     * Gets the dimensions for a specific device type
     * @param {string} device - Device type
     * @returns {Object} Width and height dimensions
     */
    getDeviceDimensions(device) {
        const dimensions = {
            mobile: { width: 375, height: 667 },
            tablet: { width: 768, height: 1024 },
            desktop: { width: 1280, height: 720 },
            'desktop-hd': { width: 1920, height: 1080 }
        };

        return dimensions[device] || dimensions.mobile;
    }

    /**
     * Extracts the hostname from a URL
     * @param {string} url - The URL to parse
     * @returns {string} Extracted hostname
     */
    extractHostname(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            return urlObj.hostname.replace(/^www\./, '').split('.')[0] || 'website';
        } catch {
            return 'website';
        }
    }

    /**
     * Creates a README file content for the ZIP archive
     * @param {string} url - The captured URL
     * @param {Object} results - Screenshot results
     * @returns {string} README text content
     */
    createReadme(url, results) {
        const successCount = Object.values(results).filter(r => r.success).length;
        const totalCount = Object.keys(results).length;

        return `
Website Screenshots
===================

URL: ${url}
Generated: ${new Date().toISOString()}
Success Rate: ${successCount}/${totalCount} screenshots captured

DEVICE BREAKDOWN:
${Object.entries(results).map(([device, result]) =>
            `• ${device.toUpperCase()}: ${result.success ? 'Success' : 'Failed'}`).join('\n')}

NOTES:
- Screenshots captured using Playwright automation
- Some websites block automated screenshot capture
- Mobile/tablet emulation provides accurate device rendering
- Failed screenshots show informative error placeholders

TROUBLESHOOTING:
1. Try a different URL
2. Website may have bot protection
3. Complex sites may timeout (10 second limit)
4. Try capturing one device at a time

Service: Playwright on Vercel Free Tier
    `;
    }
}

/**
 * React Hook for using the screenshot service
 * @returns {Object} Screenshot service hook methods and state
 */
export function useScreenshot() {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    const service = new PlaywrightScreenshotService();

    const capture = useCallback(async (url, devices = ['mobile', 'tablet', 'desktop']) => {
        setIsLoading(true);
        setError(null);
        setProgress(0);

        try {
            setProgress(10);

            const results = await service.captureAllDevices(url);
            setProgress(60);

            const zipBlob = await service.createScreenshotZip(url, results);
            setProgress(90);

            const downloadUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `screenshots-${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            setProgress(100);

            return {
                success: true,
                results,
                zipSize: zipBlob.size
            };

        } catch (error) {
            setError(error.message);
            throw error;
        } finally {
            setIsLoading(false);
            setTimeout(() => setProgress(0), 1000);
        }
    }, []);

    return {
        capture,
        isLoading,
        progress,
        error,
        resetError: () => setError(null)
    };
}