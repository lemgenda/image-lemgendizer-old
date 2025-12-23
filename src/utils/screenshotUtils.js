// src/utils/screenshotUtils.js
import JSZip from 'jszip';
import { useState, useRef, useCallback } from 'react';

/**
 * Screenshot template mapping with capture methods
 * @type {Object}
 */
const SCREENSHOT_TEMPLATES = {
    'screenshots-mobile': {
        id: 'screenshots-mobile',
        name: 'Mobile Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 375,
        height: 667,
        fullPage: false
    },
    'screenshots-tablet': {
        id: 'screenshots-tablet',
        name: 'Tablet Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 768,
        height: 1024,
        fullPage: false
    },
    'screenshots-desktop': {
        id: 'screenshots-desktop',
        name: 'Desktop Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1280,
        height: 720,
        fullPage: false
    },
    'screenshots-desktop-hd': {
        id: 'screenshots-desktop-hd',
        name: 'Desktop HD Screenshot',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1920,
        height: 1080,
        fullPage: false
    },
    'screenshots-mobile-full': {
        id: 'screenshots-mobile-full',
        name: 'Mobile Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 375,
        height: 'auto',
        fullPage: true
    },
    'screenshots-tablet-full': {
        id: 'screenshots-tablet-full',
        name: 'Tablet Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 768,
        height: 'auto',
        fullPage: true
    },
    'screenshots-desktop-full': {
        id: 'screenshots-desktop-full',
        name: 'Desktop Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1280,
        height: 'auto',
        fullPage: true
    },
    'screenshots-desktop-hd-full': {
        id: 'screenshots-desktop-hd-full',
        name: 'Desktop HD Full Page',
        category: 'screenshots',
        platform: 'Screenshots',
        width: 1920,
        height: 'auto',
        fullPage: true
    }
};

/**
 * Gets all screenshot templates
 * @returns {Array<Object>} Array of screenshot templates
 */
export const getAllScreenshotTemplates = () => {
    return Object.values(SCREENSHOT_TEMPLATES);
};

/**
 * Gets screenshot templates by category
 * @param {string} category - Template category
 * @returns {Array<Object>} Array of screenshot templates
 */
export const getScreenshotTemplatesByCategory = (category) => {
    return getAllScreenshotTemplates().filter(template =>
        template.category === category
    );
};

/**
 * Gets screenshot template by ID
 * @param {string} id - Template ID
 * @returns {Object|null} Template object or null
 */
export const getScreenshotTemplateById = (id) => {
    return SCREENSHOT_TEMPLATES[id] || null;
};

/**
 * Memory cache for current session
 * @type {Map<string, Object>}
 */
const memoryCache = new Map();

/**
 * Unified screenshot service with comprehensive optimization strategies
 */
export class UnifiedScreenshotService {
    /**
     * Creates a new optimized screenshot service instance
     * @param {Object} options - Service configuration options
     */
    constructor(options = {}) {
        this.useServerCapture = options.useServerCapture !== false;
        this.enableCaching = options.enableCaching !== false;
        this.enableCompression = options.enableCompression !== false;
        this.timeout = options.timeout || 10000;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.activeRequests = 0;
        this.requestQueue = [];
    }

    /**
     * Captures screenshots based on selected template IDs
     * @async
     * @param {string} url - Website URL to capture
     * @param {Array<string>} templateIds - Array of template IDs to capture
     * @param {Object} options - Additional capture options
     * @returns {Promise<Object>} Object containing captured screenshots and metadata
     */
    async captureByTemplates(url, templateIds, options = {}) {
        const cacheKey = this.generateCacheKey(url, templateIds, options);

        if (this.enableCaching) {
            const cachedResult = await this.getCachedResult(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
        }

        const templates = templateIds
            .map(id => SCREENSHOT_TEMPLATES[id])
            .filter(t => t);

        if (templates.length === 0) {
            throw new Error('No valid screenshot templates selected');
        }

        const results = {};
        const errors = [];
        const startTime = Date.now();

        const prioritizedTemplates = this.prioritizeTemplates(templates);
        const batchSize = Math.min(prioritizedTemplates.length, this.maxConcurrent);

        let completed = 0;

        for (let i = 0; i < prioritizedTemplates.length; i += batchSize) {
            if (Date.now() - startTime > this.timeout * 2) {
                throw new Error('Overall capture timeout exceeded');
            }

            const batch = prioritizedTemplates.slice(i, i + batchSize);
            const batchPromises = batch.map((template, index) =>
                this.processTemplateWithTimeout(url, template, options, startTime)
                    .then(result => ({ result, index, template }))
                    .catch(error => ({
                        error: error.message,
                        index,
                        templateId: template.id
                    }))
            );

            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach((item) => {
                if (item.error) {
                    const templateId = item.templateId || batch[item.index]?.id;
                    errors.push({ templateId, error: item.error });
                    results[templateId] = this.createErrorPlaceholder(
                        batch[item.index],
                        url,
                        item.error
                    );
                } else {
                    const templateId = item.template.id;
                    results[templateId] = item.result;
                }
                completed++;
            });

            await this.cleanupMemory();
        }

        const finalResult = {
            url,
            timestamp: new Date().toISOString(),
            results,
            errors,
            cacheKey,
            totalTemplates: templates.length,
            successfulCaptures: Object.values(results).filter(r => r && r.success).length,
            totalTime: Date.now() - startTime
        };

        if (this.enableCaching) {
            await this.cacheResult(cacheKey, finalResult);
        }

        await this.cleanupMemory();

        return finalResult;
    }

    /**
     * Processes template capture with individual timeout
     * @async
     * @private
     * @param {string} url - Website URL
     * @param {Object} template - Template configuration
     * @param {Object} options - Capture options
     * @param {number} startTime - Overall capture start time
     * @returns {Promise<Object>} Capture result
     */
    async processTemplateWithTimeout(url, template, options, startTime) {
        const remainingTime = this.timeout * 2 - (Date.now() - startTime);
        if (remainingTime <= 0) {
            throw new Error('Insufficient time remaining for capture');
        }

        const captureOptions = {
            ...options,
            width: template.width,
            height: template.height === 'auto' ? null : template.height,
            fullPage: template.fullPage,
            device: this.getDeviceFromTemplate(template),
            timeout: Math.min(remainingTime, this.timeout)
        };

        try {
            if (this.useServerCapture) {
                const result = await this.captureWithServerOptimized(url, captureOptions);
                return {
                    ...result,
                    template,
                    method: 'server'
                };
            } else {
                const result = await this.createPlaceholderScreenshot(url, captureOptions, template);
                return {
                    ...result,
                    template,
                    method: 'placeholder'
                };
            }
        } catch (error) {
            const result = await this.createPlaceholderScreenshot(url, captureOptions, template);
            return {
                ...result,
                template,
                method: 'placeholder',
                error: error.message
            };
        }
    }

    /**
     * Gets device type from template
     * @private
     * @param {Object} template - Template object
     * @returns {string} Device type
     */
    getDeviceFromTemplate(template) {
        if (template.name.includes('mobile')) return 'mobile';
        if (template.name.includes('tablet')) return 'tablet';
        if (template.name.includes('desktop-hd')) return 'desktop-hd';
        return 'desktop';
    }

    /**
     * Captures screenshot using server-side API
     * @async
     * @private
     * @param {string} url - Website URL
     * @param {Object} options - Capture options
     * @returns {Promise<Object>} Server-captured screenshot
     */
    async captureWithServerOptimized(url, options) {
        const API_ENDPOINT = 'https://image-lemgendizer-old.vercel.app/api/screenshot';

        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);

        try {
            const requestBody = {
                url,
                device: options.device || 'desktop',
                fullPage: options.fullPage || false,
                width: options.width,
                height: options.height,
                format: this.enableCompression ? 'webp' : 'png',
                quality: this.enableCompression ? 80 : 90
            };

            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server error ${response.status}`);
            }

            const blob = await response.blob();
            const format = this.detectImageFormat(blob, response.headers);

            return {
                success: true,
                blob,
                format,
                method: 'server',
                fullPage: options.fullPage,
                device: options.device,
                responseTime: Date.now() - startTime
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw new Error(`Server capture failed: ${error.message}`);
        }
    }

    /**
     * Creates a placeholder screenshot
     * @async
     * @private
     * @param {string} url - Website URL
     * @param {Object} options - Capture options
     * @param {Object} template - Template configuration
     * @returns {Promise<Object>} Placeholder screenshot
     */
    async createPlaceholderScreenshot(url, options, template) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const width = options.width || 1280;
            const height = options.height || (options.fullPage ? 2000 : 720);

            canvas.width = width;
            canvas.height = height;

            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#f0f9ff');
            gradient.addColorStop(1, '#e0f2fe');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#e5e5e5';
            ctx.fillRect(20, 20, width - 40, 60);

            ctx.fillStyle = '#ff5f57';
            ctx.beginPath();
            ctx.arc(45, 50, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffbd2e';
            ctx.beginPath();
            ctx.arc(70, 50, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#28ca42';
            ctx.beginPath();
            ctx.arc(95, 50, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(120, 35, width - 160, 30);
            ctx.strokeStyle = '#d1d5db';
            ctx.strokeRect(120, 35, width - 160, 30);

            ctx.fillStyle = '#4b5563';
            ctx.font = '14px Arial';
            const displayUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
            ctx.fillText(displayUrl, 125, 56);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(20, 100, width - 40, height - 140);
            ctx.strokeStyle = '#e5e7eb';
            ctx.strokeRect(20, 100, width - 40, height - 140);

            ctx.fillStyle = '#1e40af';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(template.name, width / 2, height / 2 - 60);

            ctx.fillStyle = '#374151';
            ctx.font = '18px Arial';
            ctx.fillText(`${width} × ${height}`, width / 2, height / 2 - 20);

            ctx.fillStyle = '#6b7280';
            ctx.font = '16px Arial';
            ctx.fillText(options.device || 'desktop', width / 2, height / 2 + 20);

            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Arial';
            ctx.fillText('Placeholder - Configure Vercel API', width / 2, height / 2 + 60);

            canvas.toBlob((blob) => {
                resolve({
                    success: true,
                    blob,
                    format: 'png',
                    fullPage: options.fullPage,
                    device: options.device,
                    dimensions: { width, height },
                    responseTime: 0
                });
            }, 'image/png', 0.9);
        });
    }

    /**
     * Creates a ZIP file with screenshot results
     * @async
     * @param {string} url - Original website URL
     * @param {Object} screenshotResults - Results from capture methods
     * @param {Object} options - ZIP generation options
     * @returns {Promise<Blob>} ZIP file blob
     */
    async createScreenshotZip(url, screenshotResults, options = {}) {
        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hostname = this.extractHostname(url);
        const siteName = options.siteName || 'website';

        const filePromises = Object.entries(screenshotResults.results || {}).map(async ([templateId, result]) => {
            if (result.blob) {
                const extension = result.format || 'png';
                const template = result.template || SCREENSHOT_TEMPLATES[templateId];
                const method = template?.fullPage ? 'fullpage' : 'viewport';
                const filename = `${siteName}-${templateId}-${method}-${timestamp}.${extension}`;
                zip.file(filename, result.blob);
            }
        });

        await Promise.all(filePromises);

        const metadata = this.createMetadataFile(url, screenshotResults, options);
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        const readme = this.createReadmeFile(url, screenshotResults);
        zip.file('README.txt', readme);

        if (screenshotResults.errors && screenshotResults.errors.length > 0) {
            const errorFile = this.createErrorReport(screenshotResults.errors);
            zip.file('errors.txt', errorFile);
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        await this.cleanupMemory();

        return zipBlob;
    }

    /**
     * Processes screenshots for template processing (used by templateProcessor.js)
     * @async
     * @param {string} url - Website URL
     * @param {Array<Object>} screenshotTemplates - Screenshot template objects
     * @param {Object} options - Screenshot options
     * @returns {Promise<Array<Object>>} Processed screenshot files for template system
     */
    async processScreenshotsForTemplates(url, screenshotTemplates, options = {}) {
        const templateIds = screenshotTemplates.map(t => t.id);
        const results = await this.captureByTemplates(url, templateIds, options);

        const processedImages = [];

        Object.entries(results.results).forEach(([templateId, result]) => {
            const template = screenshotTemplates.find(t => t.id === templateId);
            if (template && result.blob) {
                const baseName = `${template.platform}-${template.name}-${Date.now()}`;
                const extension = result.format || 'png';
                const fileName = `${baseName}.${extension}`;

                processedImages.push({
                    file: new File([result.blob], fileName, { type: `image/${extension}` }),
                    name: fileName,
                    template: template,
                    format: extension,
                    processed: true,
                    success: result.success,
                    method: result.method || 'placeholder',
                    dimensions: result.dimensions
                });
            }
        });

        return processedImages;
    }

    /**
     * Creates screenshot preview for template selection
     * @async
     * @param {File} imageFile - Source image file
     * @param {string} url - Website URL
     * @returns {Promise<File>} Screenshot preview file
     */
    async createScreenshotPreview(imageFile, url) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = 800;
            canvas.height = 450;

            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 0, 800, 450);

            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(50, 30, 700, 40);

            ctx.fillStyle = '#ff5f57';
            ctx.beginPath();
            ctx.arc(75, 50, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffbd2e';
            ctx.beginPath();
            ctx.arc(100, 50, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#28ca42';
            ctx.beginPath();
            ctx.arc(125, 50, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(150, 38, 550, 24);
            ctx.strokeStyle = '#d0d0d0';
            ctx.strokeRect(150, 38, 550, 24);

            ctx.fillStyle = '#666666';
            ctx.font = '14px Arial';
            const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
            ctx.fillText(displayUrl, 155, 55);

            const contentY = 90;
            const contentHeight = 450 - contentY - 30;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(75, contentY, 650, contentHeight);

            ctx.fillStyle = '#4a90e2';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Screenshot Preview', 400, contentY + 40);

            ctx.fillStyle = '#666666';
            ctx.font = '16px Arial';
            ctx.fillText('Will capture from:', 400, contentY + 80);

            ctx.fillStyle = '#333333';
            ctx.font = '14px Arial';
            ctx.fillText(displayUrl, 400, contentY + 110);

            canvas.toBlob((blob) => {
                resolve(new File([blob], 'screenshot-preview.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        });
    }

    /**
     * Cleans up all resources and memory
     */
    cleanup() {
        memoryCache.clear();
        this.requestQueue = [];
        this.activeRequests = 0;
    }

    // ========== HELPER METHODS ==========

    /**
     * Generates cache key for URL and templates
     * @private
     * @param {string} url - Website URL
     * @param {Array<string>} templateIds - Template IDs
     * @param {Object} options - Capture options
     * @returns {string} Cache key
     */
    generateCacheKey(url, templateIds, options) {
        const sortedTemplates = [...templateIds].sort().join(',');
        const optionsStr = JSON.stringify(options);
        return `screenshot:${btoa(url)}:${sortedTemplates}:${optionsStr}`.slice(0, 200);
    }

    /**
     * Creates error placeholder for failed captures
     * @private
     * @param {Object} template - Template configuration
     * @param {string} url - Website URL
     * @param {string} error - Error message
     * @returns {Promise<Object>} Error placeholder result
     */
    async createErrorPlaceholder(template, url, error) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const width = template.width || 800;
        const height = template.height === 'auto' ? 600 : template.height || 600;

        canvas.width = width;
        canvas.height = height;

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#fee2e2');
        gradient.addColorStop(1, '#fecaca');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        ctx.fillStyle = '#dc2626';
        ctx.font = `bold ${Math.min(32, height / 10)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Capture Failed', width / 2, height / 2 - 60);

        ctx.fillStyle = '#4b5563';
        ctx.font = `${Math.min(16, height / 20)}px Arial`;
        ctx.fillText(`URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`, width / 2, height / 2 - 20);

        ctx.fillStyle = '#991b1b';
        ctx.font = `${Math.min(14, height / 25)}px Arial`;

        const errorMsg = error.length > 100 ? error.substring(0, 97) + '...' : error;
        const lines = this.wrapText(ctx, errorMsg, width - 40);

        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, height / 2 + 20 + (index * 25));
        });

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve({
                    success: false,
                    blob,
                    format: 'png',
                    method: 'error',
                    error,
                    template,
                    dimensions: { width, height }
                });
            }, 'image/png', 0.9);
        });
    }

    /**
     * Wraps text to fit within specified width
     * @private
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

        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    /**
     * Extracts hostname from URL
     * @private
     * @param {string} url - Website URL
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
     * Prioritizes templates for optimal capture order
     * @private
     * @param {Array<Object>} templates - Template configurations
     * @returns {Array<Object>} Prioritized templates
     */
    prioritizeTemplates(templates) {
        return [...templates].sort((a, b) => {
            const priorityOrder = { viewport: 1, fullpage: 2 };
            const deviceOrder = { mobile: 1, tablet: 2, desktop: 3, 'desktop-hd': 4 };

            if (priorityOrder[a.fullPage ? 'fullpage' : 'viewport'] !== priorityOrder[b.fullPage ? 'fullpage' : 'viewport']) {
                return priorityOrder[a.fullPage ? 'fullpage' : 'viewport'] - priorityOrder[b.fullPage ? 'fullpage' : 'viewport'];
            }

            const aDevice = this.getDeviceFromTemplate(a);
            const bDevice = this.getDeviceFromTemplate(b);

            if (deviceOrder[aDevice] !== deviceOrder[bDevice]) {
                return deviceOrder[aDevice] - deviceOrder[bDevice];
            }

            return (a.width * (a.height === 'auto' ? 1000 : a.height)) -
                (b.width * (b.height === 'auto' ? 1000 : b.height));
        });
    }

    /**
     * Retrieves cached result from memory cache
     * @async
     * @private
     * @param {string} cacheKey - Cache key
     * @returns {Promise<Object|null>} Cached result or null
     */
    async getCachedResult(cacheKey) {
        const memoryEntry = memoryCache.get(cacheKey);
        if (memoryEntry && Date.now() - memoryEntry.timestamp < 30 * 60 * 1000) {
            return memoryEntry.data;
        }
        return null;
    }

    /**
     * Caches result in memory
     * @async
     * @private
     * @param {string} cacheKey - Cache key
     * @param {Object} data - Data to cache
     */
    async cacheResult(cacheKey, data) {
        const entry = {
            data,
            timestamp: Date.now(),
            size: this.estimateDataSize(data)
        };

        memoryCache.set(cacheKey, entry);

        if (memoryCache.size > 50) {
            const entries = Array.from(memoryCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            memoryCache.delete(entries[0][0]);
        }
    }

    /**
     * Cleans up memory
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async cleanupMemory() {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    /**
     * Estimates data size for cache management
     * @private
     * @param {Object} data - Data to estimate size of
     * @returns {number} Estimated size in bytes
     */
    estimateDataSize(data) {
        const json = JSON.stringify(data);
        return new Blob([json]).size;
    }

    /**
     * Creates metadata file for ZIP
     * @private
     * @param {string} url - Website URL
     * @param {Object} results - Screenshot results
     * @param {Object} options - Capture options
     * @returns {Object} Metadata object
     */
    createMetadataFile(url, results, options) {
        const successCount = Object.values(results.results || {}).filter(r => r && r.success).length;
        const totalCount = Object.keys(results.results || {}).length;

        return {
            url,
            generated: new Date().toISOString(),
            successRate: `${successCount}/${totalCount}`,
            options,
            compression: this.enableCompression,
            caching: this.enableCaching,
            results: Object.entries(results.results || {}).map(([templateId, result]) => ({
                templateId,
                templateName: result.template?.name || 'unknown',
                success: result.success,
                method: result.method,
                format: result.format,
                dimensions: result.dimensions,
                fullPage: result.fullPage,
                device: result.device,
                responseTime: result.responseTime || 0,
                error: result.error || null
            })),
            errors: results.errors || [],
            service: 'Screenshot Service',
            note: 'Placeholder screenshots - Configure Vercel API for real screenshots',
            totalTemplates: results.totalTemplates || 0,
            successfulCaptures: results.successfulCaptures || 0,
            totalTime: results.totalTime || 0
        };
    }

    /**
     * Creates README file for ZIP
     * @private
     * @param {string} url - Website URL
     * @param {Object} results - Screenshot results
     * @returns {string} README content
     */
    createReadmeFile(url, results) {
        const successCount = results.successfulCaptures || 0;
        const totalCount = results.totalTemplates || 0;

        return `Website Screenshots
===================

URL: ${url}
Generated: ${new Date().toISOString()}
Success Rate: ${successCount}/${totalCount} screenshots generated

IMPORTANT NOTE:
These are placeholder screenshots. For actual website screenshots:

1. Deploy a Vercel function with Playwright/Puppeteer
2. Add CORS headers to your Vercel function
3. Update the API endpoint in screenshotUtils.js
4. Enable server capture in the service configuration

Service: Screenshot Service with Placeholder Fallback`;
    }

    /**
     * Creates error report file
     * @private
     * @param {Array<Object>} errors - Array of error objects
     * @returns {string} Error report content
     */
    createErrorReport(errors) {
        return `Screenshot Capture Errors
============================

Timestamp: ${new Date().toISOString()}
Total Errors: ${errors.length}

ERROR DETAILS:
${errors.map((err, index) => `
${index + 1}. Template: ${err.templateId}
   Error: ${err.error}
`).join('\n')}

TROUBLESHOOTING:
1. Check CORS configuration on your Vercel function
2. Ensure the function is deployed and accessible
3. Update API endpoint in screenshotUtils.js`;
    }
}

/**
 * React Hook for using the UnifiedScreenshotService
 * @returns {Object} Hook methods and state
 */
export function useScreenshotService() {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    const service = useRef(new UnifiedScreenshotService({
        useServerCapture: true,
        enableCaching: true,
        enableCompression: true
    }));

    const captureTemplates = useCallback(async (url, templateIds, options = {}) => {
        setIsLoading(true);
        setError(null);
        setProgress(10);

        try {
            const results = await service.current.captureByTemplates(url, templateIds, options);
            setProgress(90);

            const zipBlob = await service.current.createScreenshotZip(url, results, options);
            setProgress(100);

            const downloadUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `screenshots-${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            return {
                success: true,
                results,
                zipSize: zipBlob.size,
                note: 'Placeholder screenshots generated. Configure Vercel API for real screenshots.'
            };
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
            setTimeout(() => setProgress(0), 1000);
        }
    }, []);

    return {
        captureTemplates,
        isLoading,
        progress,
        error,
        resetError: () => setError(null)
    };
}

/**
 * Main screenshot generation function for exportProcessor.js
 * @async
 * @param {string} url - Website URL to capture
 * @param {string} siteName - Name of the website for filenames
 * @param {Object} options - Additional options
 * @returns {Promise<Blob>} ZIP file containing screenshots
 */
export const generateScreenshots = async (url, siteName = 'website', options = {}) => {
    const service = new UnifiedScreenshotService({
        useServerCapture: false,
        enableCaching: true,
        enableCompression: true,
        ...options
    });

    const allTemplateIds = Object.keys(SCREENSHOT_TEMPLATES);
    const results = await service.captureByTemplates(url, allTemplateIds);

    return await service.createScreenshotZip(url, results, { siteName, ...options });
};

/**
 * Generates standalone screenshot ZIP
 * @async
 * @param {string} url - Website URL
 * @param {Object} settings - Screenshot settings
 * @returns {Promise<Blob>} Screenshot ZIP blob
 */
export const createScreenshotZip = async (url, settings = {}) => {
    return await generateScreenshots(url, settings.faviconSiteName || 'Website Screenshots', settings);
};