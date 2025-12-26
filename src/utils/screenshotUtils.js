import JSZip from 'jszip';
import { useState, useRef, useCallback } from 'react';
import {
    VERCEL_ENDPOINTS,
    CACHE_CONFIG,
    DEFAULT_SCREENSHOT_TIMEOUT,
    MAX_CONCURRENT_SCREENSHOTS,
    DEFAULT_FONT_FAMILY,
    HEADLINE_FONT_SIZE,
    BODY_FONT_SIZE,
    CAPTION_FONT_SIZE,
    ERROR_MESSAGES
} from '../constants/sharedConstants';

import {
    SCREENSHOT_TEMPLATES,
    SOCIAL_MEDIA_TEMPLATES,
    getViewportSize,
    getUserAgent
} from '../configs/templateConfigs';

const memoryCache = new Map();
const activeBlobUrls = new Set();

/**
 * Unified screenshot service with comprehensive optimization strategies
 */
export class UnifiedScreenshotService {
    /**
     * Creates a new optimized screenshot service instance
     * @param {object} options - Service configuration options
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

        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            this.useServerCapture = false;
        }
    }

    /**
     * Initializes endpoint usage statistics
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
     * @param {string} url - Website URL to capture
     * @param {Array<string>} templateIds - Array of template IDs to capture
     * @param {object} options - Additional capture options
     * @returns {Promise<object>} Object containing captured screenshots and metadata
     */
    async captureByTemplates(url, templateIds, options = {}) {
        const cacheKey = this.generateCacheKey(url, templateIds, options);

        if (this.enableCaching) {
            const cachedResult = await this.getCachedResult(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
        }

        // Get templates from centralized config
        const templates = this.getTemplatesByIds(templateIds);

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
     * Gets templates by their IDs from centralized configs
     * @param {Array<string>} templateIds - Template identifiers
     * @returns {Array<object>} Template objects
     */
    getTemplatesByIds(templateIds) {
        // First check screenshot templates
        const screenshotTemplates = templateIds
            .map(id => SCREENSHOT_TEMPLATES[id])
            .filter(t => t);

        // Then check social media templates
        const socialTemplates = templateIds
            .map(id => SOCIAL_MEDIA_TEMPLATES.find(t => t.id === id))
            .filter(t => t);

        // Combine both
        return [...screenshotTemplates, ...socialTemplates];
    }

    /**
     * Processes template capture
     * @param {string} url - Website URL
     * @param {object} template - Template configuration
     * @param {object} options - Capture options
     * @param {number} startTime - Overall capture start time
     * @returns {Promise<object>} Capture result
     */
    async processTemplate(url, template, options, startTime) {
        const remainingTime = this.timeout * 2 - (Date.now() - startTime);
        if (remainingTime <= 0) {
            throw new Error('Insufficient time remaining for capture');
        }

        // Use template dimensions - get viewport size if available
        const viewport = getViewportSize ? getViewportSize(template.id) : null;
        const width = viewport?.width || template.width || 1280;
        const height = viewport?.height || (template.height === 'auto' ? null : template.height) || 720;
        const fullPage = template.fullPage || options.fullPage || false;

        // Determine device from template or options
        const device = this.getDeviceFromTemplate(template) || options.device || 'desktop';

        const captureOptions = {
            ...options,
            width,
            height,
            fullPage,
            device,
            timeout: Math.min(remainingTime, this.timeout)
        };

        try {
            if (this.useServerCapture) {
                try {
                    // Call your API endpoint with template info
                    const result = await this.captureWithApi(url, captureOptions, template.id);
                    return {
                        ...result,
                        template,
                        method: 'api',
                        success: true
                    };
                } catch (serverError) {
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
     * Captures screenshot using your API endpoint
     * @param {string} url - Website URL
     * @param {object} options - Capture options
     * @param {string} templateId - Template ID
     * @returns {Promise<object>} Screenshot result
     */
    async captureWithApi(url, options, templateId) {
        const startTime = Date.now();

        try {
            const response = await fetch('/api/screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    device: options.device,
                    fullPage: options.fullPage,
                    templateId: templateId,
                    width: options.width,
                    height: options.height
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `API error: ${response.status}`);
            }

            const screenshotBuffer = await response.arrayBuffer();
            const responseTime = Date.now() - startTime;
            const dimensions = JSON.parse(response.headers.get('x-dimensions') || '{}');

            return {
                success: true,
                blob: new Blob([screenshotBuffer], { type: 'image/png' }),
                format: 'png',
                fullPage: options.fullPage,
                device: options.device,
                dimensions,
                responseTime,
            };
        } catch (error) {
            throw new Error(`API capture failed: ${error.message}`);
        }
    }

    /**
     * Creates a placeholder screenshot
     * @param {string} url - Website URL
     * @param {object} options - Capture options
     * @param {object} template - Template configuration
     * @returns {Promise<object>} Placeholder screenshot
     */
    async createPlaceholderScreenshot(url, options, template) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const width = options.width || template.width || 1280;
            const height = options.height || (options.fullPage ? 2000 : (template.height === 'auto' ? 720 : template.height)) || 720;

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
            ctx.font = `14px ${DEFAULT_FONT_FAMILY}`;
            const displayUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
            ctx.fillText(displayUrl, 125, 56);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(20, 100, width - 40, height - 140);
            ctx.strokeStyle = '#e5e7eb';
            ctx.strokeRect(20, 100, width - 40, height - 140);

            // Use HEADLINE_FONT_SIZE
            ctx.fillStyle = '#1e40af';
            ctx.font = `bold ${HEADLINE_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.fillText(template.name, width / 2, height / 2 - 60);

            // Use BODY_FONT_SIZE
            ctx.fillStyle = '#374151';
            ctx.font = `${BODY_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText(`${width} × ${height}`, width / 2, height / 2 - 20);

            ctx.fillStyle = '#6b7280';
            ctx.font = `${CAPTION_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText(options.device || 'desktop', width / 2, height / 2 + 20);

            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Arial, sans-serif';
            ctx.fillText('Placeholder - Configure Browserless API for real screenshots', width / 2, height / 2 + 60);

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
     * @param {string} url - Original website URL
     * @param {object} screenshotResults - Results from capture methods
     * @param {object} options - ZIP generation options
     * @returns {Promise<Blob>} ZIP file blob
     */
    async createScreenshotZip(url, screenshotResults, options = {}) {
        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hostname = this.extractHostname(url);
        const siteName = options.siteName || hostname || 'website';

        const filePromises = Object.entries(screenshotResults.results || {}).map(async ([templateId, result]) => {
            if (result.blob && result.blob instanceof Blob) {
                try {
                    const extension = result.format || 'png';
                    const template = result.template || SCREENSHOT_TEMPLATES[templateId];
                    const method = template?.fullPage ? 'fullpage' : 'viewport';
                    const filename = `${siteName}-${templateId}-${method}-${timestamp}.${extension}`;

                    zip.file(filename, result.blob);
                } catch (error) {
                    // File addition error
                }
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
     * @param {string} url - Website URL
     * @param {Array<object>} screenshotTemplates - Screenshot template objects
     * @param {object} options - Screenshot options
     * @returns {Promise<Array<object>>} Processed screenshot files for template system
     */
    async processScreenshotsForTemplates(url, screenshotTemplates, options = {}) {
        const templateIds = screenshotTemplates.map(t => t.id);
        const results = await this.captureByTemplates(url, templateIds, options);

        const processedImages = [];

        Object.entries(results.results).forEach(([templateId, result]) => {
            const template = screenshotTemplates.find(t => t.id === templateId);
            if (template && result.blob && result.blob instanceof Blob) {
                const baseName = `${template.platform}-${template.name}-${Date.now()}`;
                const extension = result.format || 'png';
                const fileName = `${baseName}.${extension}`;

                const file = new File([result.blob], fileName, {
                    type: `image/${extension}`,
                    lastModified: Date.now()
                });

                processedImages.push({
                    file: file,
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
    }

    /**
     * Gets device type from template
     * @param {object} template - Template object
     * @returns {string} Device type
     */
    getDeviceFromTemplate(template) {
        if (template.name && template.name.toLowerCase().includes('mobile')) return 'mobile';
        if (template.name && template.name.toLowerCase().includes('tablet')) return 'tablet';
        if (template.name && template.name.toLowerCase().includes('desktop-hd')) return 'desktop-hd';
        if (template.name && template.name.toLowerCase().includes('desktop')) return 'desktop';
        return null;
    }

    /**
     * Gets user agent for device type
     * @param {string} device - Device type
     * @returns {string} User agent string
     */
    getUserAgent(device) {
        // Use imported getUserAgent if available, otherwise use local fallback
        if (getUserAgent) {
            return getUserAgent(device);
        }

        const agents = {
            mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            tablet: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'desktop-hd': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        return agents[device] || agents.desktop;
    }

    /**
     * Selects optimal endpoint based on performance statistics
     * @returns {object} Selected endpoint object
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
     * @param {object} stats - Endpoint statistics
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
     * @param {Array<object>} templates - Template configurations
     * @returns {Array<object>} Prioritized templates
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
     * @param {string} cacheKey - Cache key
     * @returns {Promise<object|null>} Cached result or null
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
     * @param {string} cacheKey - Cache key
     * @param {object} data - Data to cache
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
     * Creates error placeholder for failed captures
     * @param {object} template - Template configuration
     * @param {string} url - Website URL
     * @param {string} error - Error message
     * @returns {Promise<object>} Error placeholder result
     */
    async createErrorPlaceholder(template, url, error) {
        return new Promise((resolve) => {
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

            // Use ERROR_MESSAGES constant
            ctx.fillStyle = '#dc2626';
            ctx.font = `bold ${Math.min(HEADLINE_FONT_SIZE * 2, height / 10)}px ${DEFAULT_FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ERROR_MESSAGES.SCREENSHOT_CAPTURE_FAILED, width / 2, height / 2 - 40);

            ctx.fillStyle = '#4b5563';
            ctx.font = `bold ${Math.min(HEADLINE_FONT_SIZE, height / 15)}px ${DEFAULT_FONT_FAMILY}`;
            ctx.fillText('Processing Error', width / 2, height / 2);

            ctx.fillStyle = '#991b1b';
            ctx.font = `${Math.min(BODY_FONT_SIZE, height / 20)}px ${DEFAULT_FONT_FAMILY}`;

            const errorMessage = error || ERROR_MESSAGES.SCREENSHOT_CAPTURE_FAILED;
            const maxWidth = width - 40;
            const words = errorMessage.split(' ');
            const lines = [];
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine !== '') {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);

            lines.forEach((line, index) => {
                ctx.fillText(
                    line,
                    width / 2,
                    height / 2 + 40 + (index * 30)
                );
            });

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
     * @param {object} data - Data to estimate size of
     * @returns {number} Estimated size in bytes
     */
    estimateDataSize(data) {
        const json = JSON.stringify(data);
        return new Blob([json]).size;
    }

    /**
     * Creates metadata file for ZIP
     * @param {string} url - Website URL
     * @param {object} results - Screenshot results
     * @param {object} options - Capture options
     * @returns {object} Metadata object
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
            totalTemplates: results.totalTemplates || 0,
            successfulCaptures: results.successfulCaptures || 0,
            totalTime: results.totalTime || 0
        };
    }

    /**
     * Creates README file for ZIP
     * @param {string} url - Website URL
     * @param {object} results - Screenshot results
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

Service: Screenshot Service with Browserless.io integration

Note: Placeholder screenshots are generated when Browserless capture fails.`;
    }

    /**
     * Creates error report file
     * @param {Array<object>} errors - Array of error objects
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
1. Check your Browserless.io API key and quota
2. Ensure the website URL is accessible
3. Check network connectivity`;
    }

    /**
     * Generates cache key
     * @param {string} url - Website URL
     * @param {Array<string>} templateIds - Template IDs
     * @param {object} options - Capture options
     * @returns {string} Cache key
     */
    generateCacheKey(url, templateIds, options) {
        return `screenshot_${url}_${templateIds.sort().join('_')}_${JSON.stringify(options)}`;
    }
}

/**
 * React Hook for using the UnifiedScreenshotService
 * @returns {object} Hook methods and state
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
 * @param {string} url - Website URL to capture
 * @param {string} siteName - Name of the website for filenames
 * @param {Array<string>} templateIds - Template IDs to capture
 * @param {object} options - Additional options
 * @returns {Promise<Blob>} ZIP file containing screenshots
 */
export const generateScreenshots = async (url, siteName = 'website', templateIds = [], options = {}) => {
    const service = new UnifiedScreenshotService({
        useServerCapture: true,
        enableCaching: true,
        enableCompression: true,
        timeout: DEFAULT_SCREENSHOT_TIMEOUT,
        ...options
    });

    const templatesToCapture = templateIds.length > 0
        ? templateIds
        : Object.keys(SCREENSHOT_TEMPLATES);

    const results = await service.captureByTemplates(url, templatesToCapture);

    const zipBlob = await service.createScreenshotZip(url, results, { siteName, ...options });

    if (!(zipBlob instanceof Blob)) {
        const errorZip = new JSZip();
        errorZip.file('error.txt', `Failed to generate screenshots for ${url}`);
        return await errorZip.generateAsync({ type: 'blob' });
    }

    return zipBlob;
};

/**
 * Generates standalone screenshot ZIP
 * @param {string} url - Website URL
 * @param {object} settings - Screenshot settings
 * @returns {Promise<Blob>} Screenshot ZIP blob
 */
export const createScreenshotZip = async (url, settings = {}) => {
    const templateIds = settings.selectedScreenshotTemplates || [];
    return await generateScreenshots(
        url,
        settings.faviconSiteName || 'Website Screenshots',
        templateIds,
        settings
    );
};

/**
 * Gets screenshot templates by category
 * @param {string} category - Template category
 * @returns {Array<object>} Array of screenshot templates
 */
export const getScreenshotTemplatesByCategory = (category) => {
    return Object.values(SCREENSHOT_TEMPLATES || {}).filter(template =>
        template.category === category
    );
};