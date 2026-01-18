import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App';
import { ProcessingProvider } from '../../context/ProcessingContext';
import '../../i18n';
import '@testing-library/jest-dom/vitest';

// Helper to render with provider
const renderWithProvider = (ui: React.ReactElement) => {
    return render(
        <ProcessingProvider>
            {ui}
        </ProcessingProvider>
    );
};

// Polyfills for JSDOM
if (!global.createImageBitmap) {
    global.createImageBitmap = vi.fn().mockImplementation(() => {
        return Promise.resolve({
            width: 100,
            height: 100,
            close: () => { },
        });
    });
}
if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = vi.fn();
}

// Smart Worker Mock to unblock initAIWorker and warmupAIModels
// FORCE overwrite of Worker to ensure we use mock
const MockWorker = class {
    listeners: Record<string, ((...args: any[]) => void)[]> = {};

    constructor() { }

    postMessage(msg: any) {
        // Simulate async response to ensure init promises resolve
        setTimeout(() => {
            if (msg.type === 'load') {
                this.trigger('message', { data: { type: 'loaded' } });
            }
            if (msg.type === 'warmup') {
                this.trigger('message', { data: { type: 'warmup_complete' } });
            }
        }, 10);
    }

    addEventListener(type: string, listener: (...args: any[]) => void) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: (...args: any[]) => void) {
        if (this.listeners[type]) {
            this.listeners[type] = this.listeners[type].filter(l => l !== listener);
        }
    }

    trigger(type: string, eventData: any) {
        if (this.listeners[type]) {
            this.listeners[type].forEach(l => l(eventData));
        }
    }

    terminate() { }
    dispatchEvent() { return true; }
    onerror = null;
    onmessage = null;
    onmessageerror = null;
} as any;

global.Worker = MockWorker;
// Also set on window if available
if (typeof window !== 'undefined') {
    window.Worker = MockWorker;
}

describe('App Flow Integration', () => {
    vi.setConfig({ testTimeout: 30000 });

    it('renders the application and shows main sections', async () => {
        renderWithProvider(<App />);

        // Wait for Splash Screen to disappear (Initializing AI text)
        await waitFor(() => {
            expect(screen.queryByText(/Initializing AI/i)).not.toBeInTheDocument();
        }, { timeout: 10000 });

        // Check for major sections
        expect(screen.getByRole('heading', { name: /Image LemGendizer/i })).toBeInTheDocument();
        expect(screen.getByText(/Batch Image Processing & Optimization Tool/i)).toBeInTheDocument();
        expect(screen.getByText(/Drop images here or click to upload/i)).toBeInTheDocument();
    });

    it('toggles between Custom and Template processing tabs after upload', async () => {
        const { container } = renderWithProvider(<App />);

        // Wait for Splash Screen to disappear
        await waitFor(() => {
            expect(screen.queryByText(/Initializing AI/i)).not.toBeInTheDocument();
        }, { timeout: 10000 });

        // Initially tabs are not there (images.length === 0)
        expect(screen.queryByText(/Custom Processing/i)).not.toBeInTheDocument();

        // Mock a file upload
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        fireEvent.change(input, { target: { files: [file] } });

        // Now tabs should be visible
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 10000 });

        expect(screen.getByRole('tab', { name: /Templates/i })).toBeInTheDocument();

        // Switch to Templates Tab
        const templatesTab = screen.getByRole('tab', { name: /Templates/i });
        fireEvent.click(templatesTab);

        // Check if Templates Tab content is visible
        expect(screen.getByText(/Select Templates/i)).toBeInTheDocument();
    });

    it('can open the upload dialog', async () => {
        renderWithProvider(<App />);

        // Wait for Splash Screen to disappear
        await waitFor(() => {
            expect(screen.queryByText(/Initializing AI/i)).not.toBeInTheDocument();
        }, { timeout: 10000 });

        const uploadArea = screen.getByText(/Drop images here or click to upload/i);
        expect(uploadArea).toBeInTheDocument();
    });
});
