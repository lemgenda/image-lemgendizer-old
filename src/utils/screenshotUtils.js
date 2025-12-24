import JSZip from 'jszip';
import { useState, useRef, useCallback } from 'react';
import {
    SCREENSHOT_TEMPLATES,
    VERCEL_ENDPOINTS,
    CACHE_CONFIG,
    DEFAULT_SCREENSHOT_TIMEOUT,
    MAX_CONCURRENT_SCREENSHOTS
} from '../constants/sharedConstants.js';

const memoryCache = new Map();
const activeBlobUrls = new Set();

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
        this.timeout = options.timeout || DEFAULT_SCREENSHOT_TIMEOUT;
        this.maxConcurrent = options.maxConcurrent || MAX_CONCURRENT_SCREENSHOTS;
        this.activeRequests = 0;
        this.requestQueue = [];
        this.endpointStats = new Map();
        this.initEndpointStats();
        // Disable server capture in development due to CORS issues
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            this.useServerCapture = false;
            console.warn('Server capture disabled in development due to CORS restrictions');
        }
    }

    /**
     * Initializes endpoint usage statistics
     * @private
     */
    initEndpointStats() {
        VERCEL_ENDPOINTS.forEach(endpoint => {
            this.endpointStats.set(endpoint.url, {
                success: 0,
                failures: 0,
                totalTime: 0,
                lastResponseTime: 0
            });
        });
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

        for (const template of prioritizedTemplates) {
            if (Date.now() - startTime > this.timeout * 2) {
                throw new Error('Overall capture timeout exceeded');
            }

            try {
                const result = await this.processTemplate(url, template, options, startTime);
                results[template.id] = result;
            } catch (error) {
                errors.push({
                    templateId: template.id,
                    error: error.message
                });
                results[template.id] = await this.createErrorPlaceholder(template, url, error.message);
            }

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
     * Processes template capture
     * @async
     * @private
     * @param {string} url - Website URL
     * @param {Object} template - Template configuration
     * @param {Object} options - Capture options
     * @param {number} startTime - Overall capture start time
     * @returns {Promise<Object>} Capture result
     */
    async processTemplate(url, template, options, startTime) {
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
                try {
                    const result = await this.captureWithServerOptimized(url, captureOptions);
                    return {
                        ...result,
                        template,
                        method: 'server',
                        success: true
                    };
                } catch (serverError) {
                    // If server capture fails, create placeholder with warning
                    console.warn(`Server capture failed for ${url}: ${serverError.message}. Falling back to placeholder.`);
                    const result = await this.createPlaceholderScreenshot(url, captureOptions, template);
                    return {
                        ...result,
                        template,
                        method: 'placeholder-fallback',
                        success: true,
                        warning: `Server capture failed: ${serverError.message}`
                    };
                }
            } else {
                const result = await this.createPlaceholderScreenshot(url, captureOptions, template);
                return {
                    ...result,
                    template,
                    method: 'placeholder',
                    success: true
                };
            }
        } catch (error) {
            const result = await this.createPlaceholderScreenshot(url, captureOptions, template);
            return {
                ...result,
                template,
                method: 'placeholder-error',
                success: true,
                warning: `Error during capture: ${error.message}`
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
        const endpoint = this.selectOptimalEndpoint();
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);

        try {
            const cleanUrl = url.startsWith('http') ? url : `https://${url}`;

            // Build the request based on whether we're using a relative or absolute URL
            let requestUrl = endpoint.url;
            let requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'image/png,image/webp,image/jpeg'
                },
                body: JSON.stringify({
                    url: cleanUrl,
                    device: options.device || 'mobile',
                    fullPage: options.fullPage || false
                }),
                signal: controller.signal
            };

            // If using a relative URL (starts with /), it's a local API call
            if (endpoint.url.startsWith('/')) {
                // For local API, use the current origin
                requestUrl = window.location.origin + endpoint.url;
            } else {
                // For external API, set CORS mode
                requestOptions.mode = 'cors';
                requestOptions.credentials = 'omit';
            }

            const response = await fetch(requestUrl, requestOptions);

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            this.updateEndpointStats(endpoint.url, true, responseTime);

            if (!response.ok) {
                this.updateEndpointStats(endpoint.url, false, responseTime);
                throw new Error(`Server error ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            const blob = await response.blob();
            const format = this.detectImageFormat(blob, response.headers);

            return {
                success: true,
                blob,
                format,
                method: 'server',
                fullPage: options.fullPage,
                device: options.device,
                responseTime
            };
        } catch (error) {
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            this.updateEndpointStats(endpoint.url, false, responseTime);

            // Check if it's a CORS error
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                throw new Error(`CORS error: Cannot access server API. Please ensure CORS headers are configured on the server.`);
            }

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

            const width = options.width || template.width || 1280;
            const height = options.height || (options.fullPage ? 2000 : (template.height === 'auto' ? 720 : template.height)) || 720;

            canvas.width = width;
            canvas.height = height;

            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#f0f9ff');
            gradient.addColorStop(1, '#e0f2fe');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Browser window top bar
            ctx.fillStyle = '#e5e5e5';
            ctx.fillRect(20, 20, width - 40, 60);

            // Browser window buttons
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

            // URL bar
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(120, 35, width - 160, 30);
            ctx.strokeStyle = '#d1d5db';
            ctx.strokeRect(120, 35, width - 160, 30);

            ctx.fillStyle = '#4b5563';
            ctx.font = '14px Arial, sans-serif';
            const displayUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
            ctx.fillText(displayUrl, 125, 56);

            // Content area
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(20, 100, width - 40, height - 140);
            ctx.strokeStyle = '#e5e7eb';
            ctx.strokeRect(20, 100, width - 40, height - 140);

            // Template info
            ctx.fillStyle = '#1e40af';
            ctx.font = 'bold 24px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(template.name, width / 2, height / 2 - 60);

            ctx.fillStyle = '#374151';
            ctx.font = '18px Arial, sans-serif';
            ctx.fillText(`${width} × ${height}`, width / 2, height / 2 - 20);

            ctx.fillStyle = '#6b7280';
            ctx.font = '16px Arial, sans-serif';
            ctx.fillText(options.device || 'desktop', width / 2, height / 2 + 20);

            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Arial, sans-serif';
            ctx.fillText('Placeholder - Configure Vercel API for real screenshots', width / 2, height / 2 + 60);

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
        const siteName = options.siteName || hostname || 'website';

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
     * Processes screenshots for template processing
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
                    dimensions: result.dimensions,
                    warning: result.warning || null
                });
            }
        });

        return processedImages;
    }

    /**
     * Cleans up all resources and memory
     */
    cleanup() {
        memoryCache.clear();
        this.requestQueue = [];
        this.activeRequests = 0;

        activeBlobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch { }
        });
        activeBlobUrls.clear();

        if (typeof window !== 'undefined' && window.gc) {
            window.gc();
        }
    }

    /**
     * Selects optimal endpoint based on performance statistics
     * @private
     * @returns {Object} Selected endpoint object
     */
    selectOptimalEndpoint() {
        const now = Date.now();
        const availableEndpoints = VERCEL_ENDPOINTS.filter(ep =>
            now - ep.lastUsed > 1000
        );

        if (availableEndpoints.length === 0) {
            VERCEL_ENDPOINTS.forEach(ep => ep.lastUsed = 0);
            return VERCEL_ENDPOINTS[0];
        }

        availableEndpoints.sort((a, b) => {
            const statsA = this.endpointStats.get(a.url);
            const statsB = this.endpointStats.get(b.url);

            const scoreA = this.calculateEndpointScore(statsA);
            const scoreB = this.calculateEndpointScore(statsB);

            return scoreB - scoreA;
        });

        const selected = availableEndpoints[0];
        selected.lastUsed = now;
        return selected;
    }

    /**
     * Calculates endpoint performance score
     * @private
     * @param {Object} stats - Endpoint statistics
     * @returns {number} Performance score
     */
    calculateEndpointScore(stats) {
        if (!stats || stats.success + stats.failures === 0) {
            return 100;
        }

        const successRate = stats.success / (stats.success + stats.failures);
        const avgResponseTime = stats.totalTime / stats.success || 1000;
        const responseTimeScore = Math.max(0, 1000 - avgResponseTime) / 10;

        return (successRate * 70) + (responseTimeScore * 30);
    }

    /**
     * Updates endpoint statistics
     * @private
     * @param {string} endpointUrl - Endpoint URL
     * @param {boolean} success - Whether request succeeded
     * @param {number} responseTime - Response time in milliseconds
     */
    updateEndpointStats(endpointUrl, success, responseTime) {
        const stats = this.endpointStats.get(endpointUrl) || { success: 0, failures: 0, totalTime: 0 };

        if (success) {
            stats.success++;
            stats.totalTime += responseTime;
            stats.lastResponseTime = responseTime;
        } else {
            stats.failures++;
        }

        this.endpointStats.set(endpointUrl, stats);
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

            const aType = a.fullPage ? 'fullpage' : 'viewport';
            const bType = b.fullPage ? 'fullpage' : 'viewport';

            if (priorityOrder[aType] !== priorityOrder[bType]) {
                return priorityOrder[aType] - priorityOrder[bType];
            }

            const aDevice = this.getDeviceFromTemplate(a);
            const bDevice = this.getDeviceFromTemplate(b);

            if (deviceOrder[aDevice] !== deviceOrder[bDevice]) {
                return deviceOrder[aDevice] - deviceOrder[bDevice];
            }

            const aHeight = a.height === 'auto' ? 1000 : a.height;
            const bHeight = b.height === 'auto' ? 1000 : b.height;
            return (a.width * aHeight) - (b.width * bHeight);
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
        if (memoryEntry && Date.now() - memoryEntry.timestamp < CACHE_CONFIG.MEMORY_TTL) {
            return memoryEntry.data;
        }

        if (typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem(cacheKey);
                if (stored) {
                    const entry = JSON.parse(stored);
                    if (Date.now() - entry.timestamp < CACHE_CONFIG.LOCALSTORAGE_TTL) {
                        memoryCache.set(cacheKey, entry);
                        return entry.data;
                    }
                    localStorage.removeItem(cacheKey);
                }
            } catch {
                localStorage.removeItem(cacheKey);
            }
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

        if (memoryCache.size > CACHE_CONFIG.MAX_MEMORY_ENTRIES) {
            const entries = Array.from(memoryCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            memoryCache.delete(entries[0][0]);
        }

        if (typeof localStorage !== 'undefined') {
            try {
                const serialized = JSON.stringify(entry);
                if (serialized.length < 5 * 1024 * 1024) {
                    localStorage.setItem(cacheKey, serialized);
                }
            } catch {
                localStorage.clear();
            }
        }
    }

    /**
     * Cleans up memory
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async cleanupMemory() {
        activeBlobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch { }
        });
        activeBlobUrls.clear();

        if (memoryCache.size > CACHE_CONFIG.MAX_MEMORY_ENTRIES * 2) {
            const entries = Array.from(memoryCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            entries.slice(0, CACHE_CONFIG.MAX_MEMORY_ENTRIES).forEach(([key]) => {
                memoryCache.delete(key);
            });
        }

        if (typeof window !== 'undefined' && window.gc) {
            setTimeout(() => window.gc(), 100);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
    }

    /**
     * Detects image format from blob and headers
     * @private
     * @param {Blob} blob - Image blob
     * @param {Headers} headers - Response headers
     * @returns {string} Image format
     */
    detectImageFormat(blob, headers) {
        const contentType = headers.get('content-type');
        if (contentType) {
            if (contentType.includes('image/webp')) return 'webp';
            if (contentType.includes('image/png')) return 'png';
            if (contentType.includes('image/jpeg')) return 'jpg';
        }
        return blob.type.split('/')[1] || 'png';
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
        ctx.font = `bold ${Math.min(32, height / 10)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Capture Failed', width / 2, height / 2 - 60);

        ctx.fillStyle = '#4b5563';
        ctx.font = `${Math.min(16, height / 20)}px Arial, sans-serif`;
        ctx.fillText(`URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`, width / 2, height / 2 - 20);

        ctx.fillStyle = '#991b1b';
        ctx.font = `${Math.min(14, height / 25)}px Arial, sans-serif`;

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
                error: result.error || null,
                warning: result.warning || null
            })),
            errors: results.errors || [],
            service: 'Screenshot Service',
            note: 'Placeholder screenshots generated - Configure Vercel API with proper CORS for real screenshots',
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
2. Add CORS headers to your Vercel function:
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type
3. Update the API endpoint in screenshotUtils.js
4. Enable server capture in the service configuration

Service: Screenshot Service with Placeholder Fallback

Note: In development (localhost), server capture is automatically disabled due to CORS restrictions.`;
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
3. Update API endpoint in screenshotUtils.js
4. Add proper CORS headers to your server response`;
    }

    /**
     * Generates cache key
     * @private
     * @param {string} url - Website URL
     * @param {Array<string>} templateIds - Template IDs
     * @param {Object} options - Capture options
     * @returns {string} Cache key
     */
    generateCacheKey(url, templateIds, options) {
        return `screenshot_${url}_${templateIds.sort().join('_')}_${JSON.stringify(options)}`;
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
        enableCompression: true,
        timeout: DEFAULT_SCREENSHOT_TIMEOUT
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
                note: 'Screenshots generated successfully'
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
        useServerCapture: true,
        enableCaching: true,
        enableCompression: true,
        timeout: DEFAULT_SCREENSHOT_TIMEOUT,
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