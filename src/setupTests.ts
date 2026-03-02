import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'vitest-canvas-mock';
import './i18n';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock URL APIs
window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
window.URL.revokeObjectURL = vi.fn();

// Mock matchMedia
window.matchMedia = window.matchMedia || vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const store: Record<string, string> = {};
(window as any).localStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    length: 0,
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
};

// Mock navigator.languages
Object.defineProperty(window.navigator, 'languages', {
    value: ['en-US', 'en'],
    configurable: true
});

// AI Mocks
(window as any).tf = {
    memory: vi.fn(() => ({ numBytesInGPU: 0 })),
    disposeVariables: vi.fn(),
    engine: vi.fn(() => ({
        startScope: vi.fn(),
        endScope: vi.fn()
    })),
    ENV: { reset: vi.fn() }
};

(window as any).cocoSsd = {
    load: vi.fn(() => Promise.resolve({
        detect: vi.fn(() => Promise.resolve([])),
        modelType: 'mock'
    }))
};

// Mock Image loading for JSDOM
// We use a simple mock that triggers onload and provides dummy dimensions
Object.defineProperty(global.HTMLImageElement.prototype, 'src', {
    set(src: string) {
        (this as any)._src = src;
        if (src) {
            setTimeout(() => {
                if (this.onload) this.onload(new Event('load'));
            }, 10);
        }
    },
    get() {
        return (this as any)._src;
    }
});

Object.defineProperty(global.HTMLImageElement.prototype, 'naturalWidth', { get: () => 100 });
Object.defineProperty(global.HTMLImageElement.prototype, 'naturalHeight', { get: () => 100 });
Object.defineProperty(global.HTMLImageElement.prototype, 'width', { get: () => 100 });
Object.defineProperty(global.HTMLImageElement.prototype, 'height', { get: () => 100 });

// Mock Worker
class MockWorker {
    url: string;
    onmessage: (e: MessageEvent) => void;
    onerror: (e: ErrorEvent) => void;
    listeners: Record<string, EventListenerOrEventListenerObject[]> = {};

    constructor(stringUrl: string) {
        this.url = stringUrl;
        this.onmessage = () => { };
        this.onerror = () => { };
    }

    postMessage(msg: any) {
        const { type } = msg;

        setTimeout(() => {
            let response: any = { type: 'complete', result: 'mock-result' };

            switch (type) {
                case 'load':
                    response = { type: 'loaded' };
                    break;
                case 'warmup':
                    response = { type: 'warmup_complete' };
                    break;
                case 'detect':
                    response = { type: 'result', data: [] };
                    break;
                case 'upscale':
                    response = { type: 'upscale_result', data: new ImageData(100, 100), shape: [100, 100, 3], scale: 2 };
                    break;
                case 'restore':
                    response = { type: 'restore_result', data: new ImageData(100, 100) };
                    break;
                case 'enhance':
                    response = { type: 'enhance_result', data: new ImageData(100, 100), nimaScore: 8.0, opsApplied: ['MockOp'] };
                    break;
                case 'preload':
                    return;
                default:
                    break;
            }

            const event = { data: response } as MessageEvent;

            if (this.onmessage) {
                this.onmessage(event);
            }

            if (this.listeners['message']) {
                this.listeners['message'].forEach(listener => {
                    if (typeof listener === 'function') {
                        listener(event);
                    } else if (listener && typeof listener.handleEvent === 'function') {
                        listener.handleEvent(event);
                    }
                });
            }
        }, 10);
    }

    terminate() { }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (this.listeners[type]) {
            this.listeners[type] = this.listeners[type].filter(l => l !== listener);
        }
    }

    dispatchEvent() { return true; }
}

(global as any).Worker = MockWorker;

// Mock tiffUtils to prevent network requests
vi.mock('./utils/tiffUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./utils/tiffUtils')>();
    return {
        ...actual,
        loadUTIFLibrary: vi.fn(() => Promise.resolve(true)),
    };
});

// Mock aiWorkerUtils to prevent test hangs during AI initialization
vi.mock('./utils/aiWorkerUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./utils/aiWorkerUtils')>();
    return {
        ...actual,
        initAIWorker: vi.fn(() => Promise.resolve()),
        prewarmCropModels: vi.fn(() => Promise.resolve()),
        warmupAIModels: vi.fn(() => Promise.resolve()),
        detectObjectsInWorker: vi.fn(() => Promise.resolve([])),
        upscaleInWorker: vi.fn(() => Promise.resolve({ data: new ImageData(1, 1), shape: [1, 1], scale: 2 })),
        restoreInWorker: vi.fn(() => Promise.resolve(new ImageData(1, 1))),
        enhanceInWorker: vi.fn(() => Promise.resolve({ data: new ImageData(1, 1), nimaScore: 8.0, opsApplied: [] })),
    };
});
