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
const store = {};
window.localStorage = {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    clear: vi.fn(() => { for (let key in store) delete store[key]; }),
    removeItem: vi.fn(key => { delete store[key]; }),
    length: 0,
    key: vi.fn(i => Object.keys(store)[i] || null),
};

// Mock navigator.languages
Object.defineProperty(window.navigator, 'languages', {
    value: ['en-US', 'en'],
    configurable: true
});

// AI Mocks
window.tf = {
    memory: vi.fn(() => ({ numBytesInGPU: 0 })),
    disposeVariables: vi.fn(),
    engine: vi.fn(() => ({
        startScope: vi.fn(),
        endScope: vi.fn()
    })),
    ENV: { reset: vi.fn() }
};

window.cocoSsd = {
    load: vi.fn(() => Promise.resolve({
        detect: vi.fn(() => Promise.resolve([])),
        modelType: 'mock'
    }))
};

// Mock Image loading for JSDOM
// We use a simple mock that triggers onload and provides dummy dimensions
Object.defineProperty(global.HTMLImageElement.prototype, 'src', {
    set(src) {
        this._src = src;
        if (src) {
            setTimeout(() => {
                if (this.onload) this.onload();
            }, 10);
        }
    },
    get() {
        return this._src;
    }
});

Object.defineProperty(global.HTMLImageElement.prototype, 'naturalWidth', { get: () => 100 });
Object.defineProperty(global.HTMLImageElement.prototype, 'naturalHeight', { get: () => 100 });
Object.defineProperty(global.HTMLImageElement.prototype, 'width', { get: () => 100 });
Object.defineProperty(global.HTMLImageElement.prototype, 'height', { get: () => 100 });
