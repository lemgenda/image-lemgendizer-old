// src/utils/screenshotUtils.js
import JSZip from 'jszip';
import html2canvas from 'html2canvas';

/**
 * Configuration for multiple Vercel endpoints with load distribution
 * @type {Array<Object>}
 */
const VERCEL_ENDPOINTS = [
    { url: 'https://api1.vercel.app/api/screenshot', priority: 1, lastUsed: 0 },
    { url: 'https://api2.vercel.app/api/screenshot', priority: 2, lastUsed: 0 },
    { url: 'https://api3.vercel.app/api/screenshot', priority: 3, lastUsed: 0 }
];

/**
 * Cache configuration with TTL values
 * @type {Object}
 */
const CACHE_CONFIG = {
    LOCALSTORAGE_TTL: 7 * 24 * 60 * 60 * 1000,
    MEMORY_TTL: 30 * 60 * 1000,
    INDEXEDDB_TTL: 30 * 24 * 60 * 60 * 1000,
    MAX_MEMORY_ENTRIES: 50,
    MAX_INDEXEDDB_ENTRIES: 200
};

/**
 * Timeout configuration for different operations
 * @type {Object}
 */
const TIMEOUT_CONFIG = {
    SERVER_CAPTURE: 10000,
    CLIENT_CAPTURE: 15000,
    IMAGE_LOADING: 10000,
    IFrame_LOADING: 10000
};

/**
 * Screenshot template mapping with capture methods
 * @type {Object}
 */
const TEMPLATE_CAPTURE_METHODS = {
    'screenshots-mobile': { method: 'viewport', device: 'mobile', width: 375, height: 667, fullPage: false },
    'screenshots-tablet': { method: 'viewport', device: 'tablet', width: 768, height: 1024, fullPage: false },
    'screenshots-desktop': { method: 'viewport', device: 'desktop', width: 1280, height: 720, fullPage: false },
    'screenshots-desktop-hd': { method: 'viewport', device: 'desktop-hd', width: 1920, height: 1080, fullPage: false },
    'screenshots-mobile-full': { method: 'fullpage', device: 'mobile', width: 375, height: 'auto', fullPage: true },
    'screenshots-tablet-full': { method: 'fullpage', device: 'tablet', width: 768, height: 'auto', fullPage: true },
    'screenshots-desktop-full': { method: 'fullpage', device: 'desktop', width: 1280, height: 'auto', fullPage: true },
    'screenshots-desktop-hd-full': { method: 'fullpage', device: 'desktop-hd', width: 1920, height: 'auto', fullPage: true }
};

/**
 * Device type mapping for server capture
 * @type {Object}
 */
const DEVICE_TYPE_MAP = {
    mobile: 'mobile',
    tablet: 'tablet',
    desktop: 'desktop',
    'desktop-hd': 'desktop'
};

/**
 * Memory cache for current session
 * @type {Map<string, Object>}
 */
const memoryCache = new Map();

/**
 * IndexedDB database instance
 * @type {IDBDatabase|null}
 */
let indexedDBInstance = null;

/**
 * Active blob URLs to track for cleanup
 * @type {Set<string>}
 */
const activeBlobUrls = new Set();

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
        this.timeout = options.timeout || TIMEOUT_CONFIG.SERVER_CAPTURE;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.activeRequests = 0;
        this.requestQueue = [];
        this.endpointStats = new Map();
        this.initEndpointStats();
        this.initializeIndexedDB();
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
     * Initializes IndexedDB for blob storage
     * @private
     * @returns {Promise<void>}
     */
    async initializeIndexedDB() {
        if (!this.enableCaching || typeof indexedDB === 'undefined') {
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open('screenshotCache', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('screenshots')) {
                    const store = db.createObjectStore('screenshots', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                indexedDBInstance = event.target.result;

                setInterval(() => {
                    this.cleanupExpiredIndexedDB();
                }, 60000);

                resolve();
            };

            request.onerror = (event) => {
                reject(new Error('Failed to initialize IndexedDB'));
            };
        });
    }

    /**
     * Captures screenshots based on selected template IDs with comprehensive optimization
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
            .map(id => TEMPLATE_CAPTURE_METHODS[id])
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
                        templateId: this.getTemplateIdByConfig(template)
                    }))
            );

            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach((item) => {
                if (item.error) {
                    const templateId = item.templateId || this.getTemplateIdByConfig(batch[item.index]);
                    errors.push({ templateId, error: item.error });
                    results[templateId] = this.createErrorPlaceholder(
                        batch[item.index],
                        url,
                        item.error
                    );
                } else {
                    const templateId = this.getTemplateIdByConfig(item.template);
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
     * @param {Object} templateConfig - Template configuration
     * @param {Object} options - Capture options
     * @param {number} startTime - Overall capture start time
     * @returns {Promise<Object>} Capture result
     */
    async processTemplateWithTimeout(url, templateConfig, options, startTime) {
        const remainingTime = this.timeout * 2 - (Date.now() - startTime);
        if (remainingTime <= 0) {
            throw new Error('Insufficient time remaining for capture');
        }

        const captureOptions = {
            ...options,
            width: templateConfig.width,
            height: templateConfig.height === 'auto' ? null : templateConfig.height,
            fullPage: templateConfig.fullPage,
            device: templateConfig.device,
            timeout: Math.min(remainingTime, this.timeout)
        };

        try {
            let result;

            if (this.useServerCapture) {
                result = await this.captureWithServerOptimized(url, captureOptions);
            } else {
                result = await this.captureWithClientOptimized(url, captureOptions);
            }

            return {
                ...result,
                templateId: this.getTemplateIdByConfig(templateConfig),
                templateConfig,
                dimensions: {
                    width: templateConfig.width,
                    height: templateConfig.height
                },
                method: templateConfig.method
            };
        } catch (error) {
            if (this.useServerCapture && captureOptions.timeout > 5000) {
                return await this.captureWithClientOptimized(url, {
                    ...captureOptions,
                    timeout: Math.min(captureOptions.timeout - 2000, TIMEOUT_CONFIG.CLIENT_CAPTURE)
                });
            }
            throw error;
        }
    }

    /**
     * Captures screenshot using server-side Playwright with optimization
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
            const deviceType = DEVICE_TYPE_MAP[options.device] || 'desktop';
            const fullPage = options.fullPage || false;

            const requestBody = {
                url,
                device: deviceType,
                fullPage: fullPage,
                format: this.enableCompression ? 'webp' : 'png',
                quality: this.enableCompression ? 80 : 90
            };

            if (!fullPage && options.width && options.height) {
                requestBody.width = options.width;
                requestBody.height = options.height;
            }

            const response = await fetch(endpoint.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': this.enableCompression ? 'image/webp,image/png,image/jpeg' : 'image/png,image/jpeg'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseTime = Date.now() - startTime;
            this.updateEndpointStats(endpoint.url, true, responseTime);

            if (!response.ok) {
                this.updateEndpointStats(endpoint.url, false, responseTime);
                throw new Error(`Server error ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            const blob = await response.blob();
            const format = this.detectImageFormat(blob, response.headers);

            const optimizedBlob = await this.optimizeBlobSize(blob, format);

            return {
                success: true,
                blob: optimizedBlob,
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
            throw new Error(`Server capture failed: ${error.message}`);
        }
    }

    /**
     * Captures screenshot using client-side html2canvas with optimization
     * @async
     * @private
     * @param {string} url - Website URL
     * @param {Object} options - Capture options
     * @returns {Promise<Object>} Client-captured screenshot
     */
    async captureWithClientOptimized(url, options) {
        const iframe = this.createIframe(options.width);
        document.body.appendChild(iframe);

        try {
            await this.loadIframeWithTimeout(iframe, url, options.timeout);

            let canvas;
            if (options.fullPage) {
                canvas = await this.captureFullPageOptimized(iframe, options);
            } else {
                canvas = await this.captureViewportOptimized(iframe, options);
            }

            const format = this.enableCompression ? 'webp' : 'png';
            const quality = this.enableCompression ? 0.8 : 0.9;
            const blob = await this.canvasToOptimizedBlob(canvas, format, quality);

            const blobUrl = URL.createObjectURL(blob);
            activeBlobUrls.add(blobUrl);

            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
                activeBlobUrls.delete(blobUrl);
            }, 60000);

            document.body.removeChild(iframe);

            return {
                success: true,
                blob,
                format,
                method: 'client',
                fullPage: options.fullPage,
                device: options.device
            };
        } catch (error) {
            if (iframe.parentNode) {
                document.body.removeChild(iframe);
            }
            throw new Error(`Client capture failed: ${error.message}`);
        }
    }

    /**
     * Creates a ZIP file with compression optimization
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

        const filePromises = Object.entries(screenshotResults.results || {}).map(async ([templateId, result]) => {
            if (result.blob) {
                const extension = result.format || 'png';
                const method = result.templateConfig?.method || 'viewport';
                const filename = `${hostname}-${templateId}-${method}-${timestamp}.${extension}`;

                if (this.enableCompression && extension !== 'webp') {
                    const compressedBlob = await this.compressImageBlob(result.blob, extension);
                    zip.file(filename, compressedBlob);
                } else {
                    zip.file(filename, result.blob);
                }
            }
        });

        await Promise.all(filePromises);

        if (screenshotResults.errors && screenshotResults.errors.length > 0) {
            const errorFile = this.createErrorReport(screenshotResults.errors);
            zip.file('errors.txt', errorFile);
        }

        const metadata = this.createMetadataFile(url, screenshotResults, options);
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        const readme = this.createReadmeFile(url, screenshotResults);
        zip.file('README.txt', readme);

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        await this.cleanupMemory();

        return zipBlob;
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
            } catch {
            }
        });
        activeBlobUrls.clear();

        if (typeof window !== 'undefined' && window.gc) {
            window.gc();
        }
    }

    // ========== OPTIMIZATION METHODS ==========

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

            if (priorityOrder[a.method] !== priorityOrder[b.method]) {
                return priorityOrder[a.method] - priorityOrder[b.method];
            }

            if (deviceOrder[a.device] !== deviceOrder[b.device]) {
                return deviceOrder[a.device] - deviceOrder[b.device];
            }

            return (a.width * (a.height === 'auto' ? 1000 : a.height)) -
                (b.width * (b.height === 'auto' ? 1000 : b.height));
        });
    }

    /**
     * Retrieves cached result from multi-level cache
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

        if (indexedDBInstance && this.enableCaching) {
            try {
                const entry = await this.getFromIndexedDB(cacheKey);
                if (entry && Date.now() - entry.timestamp < CACHE_CONFIG.INDEXEDDB_TTL) {
                    memoryCache.set(cacheKey, entry);
                    return entry.data;
                }
            } catch {
            }
        }

        return null;
    }

    /**
     * Caches result in multi-level cache
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

        if (indexedDBInstance && this.enableCaching) {
            try {
                await this.storeInIndexedDB(cacheKey, entry);
            } catch {
            }
        }
    }

    /**
     * Stores data in IndexedDB
     * @async
     * @private
     * @param {string} key - Cache key
     * @param {Object} data - Data to store
     * @returns {Promise<void>}
     */
    async storeInIndexedDB(key, data) {
        return new Promise((resolve, reject) => {
            const transaction = indexedDBInstance.transaction(['screenshots'], 'readwrite');
            const store = transaction.objectStore('screenshots');

            const request = store.put({ key, ...data });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieves data from IndexedDB
     * @async
     * @private
     * @param {string} key - Cache key
     * @returns {Promise<Object|null>} Retrieved data or null
     */
    async getFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = indexedDBInstance.transaction(['screenshots'], 'readonly');
            const store = transaction.objectStore('screenshots');

            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cleans up expired entries from IndexedDB
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async cleanupExpiredIndexedDB() {
        if (!indexedDBInstance) return;

        return new Promise((resolve, reject) => {
            const transaction = indexedDBInstance.transaction(['screenshots'], 'readwrite');
            const store = transaction.objectStore('screenshots');
            const index = store.index('timestamp');

            const cutoff = Date.now() - CACHE_CONFIG.INDEXEDDB_TTL;
            const range = IDBKeyRange.upperBound(cutoff);

            const request = index.openCursor(range);
            const keysToDelete = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keysToDelete.push(cursor.primaryKey);
                    cursor.continue();
                } else {
                    keysToDelete.forEach(key => {
                        store.delete(key);
                    });
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cleans up memory by forcing garbage collection
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async cleanupMemory() {
        activeBlobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch {
            }
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
     * Optimizes blob size based on format and compression settings
     * @async
     * @private
     * @param {Blob} blob - Original image blob
     * @param {string} format - Image format
     * @returns {Promise<Blob>} Optimized blob
     */
    async optimizeBlobSize(blob, format) {
        if (!this.enableCompression || format === 'webp') {
            return blob;
        }

        if (blob.size < 102400) {
            return blob;
        }

        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                URL.revokeObjectURL(url);

                canvas.toBlob((optimizedBlob) => {
                    resolve(optimizedBlob || blob);
                }, 'image/webp', 0.8);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(blob);
            };

            img.src = url;
        });
    }

    /**
     * Converts canvas to optimized blob with format selection
     * @async
     * @private
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} format - Output format
     * @param {number} quality - Compression quality
     * @returns {Promise<Blob>} Optimized blob
     */
    async canvasToOptimizedBlob(canvas, format, quality) {
        return new Promise((resolve) => {
            if (format === 'webp' && canvas.toBlob.length === 3) {
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', quality);
            } else {
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png', quality);
            }
        });
    }

    /**
     * Compresses image blob for storage
     * @async
     * @private
     * @param {Blob} blob - Original image blob
     * @param {string} format - Original format
     * @returns {Promise<Blob>} Compressed blob
     */
    async compressImageBlob(blob, format) {
        if (blob.size < 51200) {
            return blob;
        }

        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const maxDimension = 2048;
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    const ratio = Math.min(maxDimension / width, maxDimension / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                URL.revokeObjectURL(url);

                const targetFormat = format === 'png' ? 'image/png' : 'image/jpeg';
                const quality = format === 'png' ? 0.8 : 0.85;

                canvas.toBlob((compressedBlob) => {
                    resolve(compressedBlob || blob);
                }, targetFormat, quality);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(blob);
            };

            img.src = url;
        });
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
     * Creates hidden iframe element for client capture
     * @private
     * @param {number} width - Iframe width
     * @returns {HTMLIFrameElement} Iframe element
     */
    createIframe(width = 1280) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = `${width}px`;
        iframe.style.height = '720px';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        iframe.style.overflow = 'hidden';
        return iframe;
    }

    /**
     * Loads URL into iframe with timeout
     * @async
     * @private
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @param {string} url - Website URL
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    loadIframeWithTimeout(iframe, url, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Website loading timeout'));
            }, Math.min(timeout, TIMEOUT_CONFIG.IFrame_LOADING));

            iframe.onload = () => {
                clearTimeout(timeoutId);
                try {
                    if (!iframe.contentDocument || !iframe.contentDocument.body) {
                        reject(new Error('Website blocks iframe embedding'));
                    } else {
                        setTimeout(resolve, 500);
                    }
                } catch (error) {
                    reject(new Error('Cannot access iframe content'));
                }
            };

            iframe.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Failed to load website'));
            };

            iframe.src = url;
        });
    }

    /**
     * Captures full page using html2canvas with optimization
     * @async
     * @private
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @param {Object} options - Capture options
     * @returns {Promise<HTMLCanvasElement>} Canvas with full-page screenshot
     */
    async captureFullPageOptimized(iframe, options) {
        const body = iframe.contentDocument.body;
        const html = iframe.contentDocument.documentElement;

        const maxHeight = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
        );

        return await html2canvas(body, {
            width: options.width,
            height: Math.min(maxHeight, 10000),
            scale: 0.8,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: options.width,
            windowHeight: Math.min(maxHeight, 10000),
            removeContainer: true
        });
    }

    /**
     * Captures viewport using html2canvas with optimization
     * @async
     * @private
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @param {Object} options - Capture options
     * @returns {Promise<HTMLCanvasElement>} Canvas with viewport screenshot
     */
    async captureViewportOptimized(iframe, options) {
        return await html2canvas(iframe.contentDocument.body, {
            width: options.width,
            height: options.height,
            scale: 0.9,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            backgroundColor: '#ffffff',
            logging: false,
            removeContainer: true
        });
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
     * @param {Object} templateConfig - Template configuration
     * @param {string} url - Website URL
     * @param {string} error - Error message
     * @returns {Object} Error placeholder result
     */
    async createErrorPlaceholder(templateConfig, url, error) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const width = templateConfig.width || 800;
        const height = templateConfig.height === 'auto' ? 600 : templateConfig.height || 600;

        canvas.width = width;
        canvas.height = height;

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        ctx.fillStyle = '#dc3545';
        ctx.font = `bold ${Math.min(48, height / 10)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Capture Failed', width / 2, height / 2 - 40);

        ctx.fillStyle = '#6c757d';
        ctx.font = `${Math.min(16, height / 20)}px Arial`;
        ctx.fillText(`URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`, width / 2, height / 2);

        ctx.fillStyle = '#856404';
        ctx.font = `${Math.min(14, height / 25)}px Arial`;

        const errorMsg = error.length > 100 ? error.substring(0, 97) + '...' : error;
        const lines = this.wrapText(ctx, errorMsg, width - 40);

        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, height / 2 + 40 + (index * 25));
        });

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png', 0.8);
        });

        return {
            success: false,
            blob,
            format: 'png',
            method: 'placeholder',
            error,
            templateConfig,
            dimensions: { width, height }
        };
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
     * Gets template ID from configuration
     * @private
     * @param {Object} templateConfig - Template configuration
     * @returns {string} Template ID
     */
    getTemplateIdByConfig(templateConfig) {
        for (const [id, config] of Object.entries(TEMPLATE_CAPTURE_METHODS)) {
            if (config === templateConfig ||
                (config.width === templateConfig.width &&
                    config.height === templateConfig.height &&
                    config.fullPage === templateConfig.fullPage &&
                    config.device === templateConfig.device)) {
                return id;
            }
        }
        return 'unknown-template';
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
                templateName: result.templateConfig?.method || 'unknown',
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
            service: 'Optimized Screenshot Service',
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

        return `Website Screenshots - Optimized Capture
==========================================

URL: ${url}
Generated: ${new Date().toISOString()}
Success Rate: ${successCount}/${totalCount} screenshots captured
Total Time: ${(results.totalTime || 0) / 1000} seconds

CAPTURE SUMMARY:
${Object.entries(results.results || {}).map(([templateId, result]) => {
            const method = result.templateConfig?.method === 'fullpage' ? 'Full Page' : 'Viewport';
            const status = result.success ? 'Success' : 'Failed';
            const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
            return `• ${templateId}: ${status} (${method}, ${result.method}, ${time})`;
        }).join('\n')}

OPTIMIZATION FEATURES:
- Multi-endpoint load balancing
- Multi-level caching (Memory + LocalStorage + IndexedDB)
- Intelligent timeout management
- WebP compression when available
- Memory management with automatic cleanup
- Progressive fallback strategies

NOTES:
- Viewport captures fixed dimensions
- Full-page captures entire page height
- Some websites block automated screenshot capture
- Failed captures show informative error placeholders
- Results are cached for faster repeated captures

Service: Optimized Screenshot Service with Vercel Integration`;
    }

    /**
     * Creates error report file
     * @private
     * @param {Array<Object>} errors - Array of error objects
     * @returns {string} Error report content
     */
    createErrorReport(errors) {
        return `Screenshot Capture Errors - Optimized Service
=================================================

Timestamp: ${new Date().toISOString()}
Total Errors: ${errors.length}

ERROR DETAILS:
${errors.map((err, index) => `
${index + 1}. Template: ${err.templateId}
   Error: ${err.error}
`).join('\n')}

OPTIMIZATION NOTES:
- Automatic endpoint failover
- Client-side fallback on server failure
- Timeout-based graceful degradation
- Memory-aware processing

COMMON SOLUTIONS:
1. Check URL accessibility
2. Verify website allows iframe embedding
3. Try client-side capture if server fails
4. Check browser console for CORS errors
5. Reduce number of concurrent captures

Note: Some errors may be due to website security settings or timeout limits.`;
    }
}

/**
 * Legacy function for backward compatibility
 * @async
 * @param {string} url - Website URL to capture
 * @param {string} siteName - Name of the website for filenames
 * @returns {Promise<Blob>} ZIP file containing screenshots or placeholders
 */
export const generateScreenshots = async (url, siteName = 'website') => {
    const service = new UnifiedScreenshotService({
        useServerCapture: true,
        enableCaching: true,
        enableCompression: true
    });
    const results = await service.captureAllDevices(url);
    return await service.createScreenshotZip(url, results, { siteName });
};