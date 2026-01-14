import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../../App';
import { ProcessingProvider } from '../../context/ProcessingContext';
import * as generalUtils from '../../utils/generalUtils';

// Mock dependencies
vi.mock('../../utils/generalUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof generalUtils>();
    return {
        ...actual,
        orchestrateCustomProcessing: vi.fn().mockResolvedValue([]),
        debounce: (fn: (...args: any[]) => any) => fn,
    };
});

window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('SVG Processing Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles SVG upload and allows processing', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Wait for AI loading
        const loading = screen.queryByText(/Loading AI model/i);
        if (loading) {
            await waitFor(() => expect(screen.queryByText(/Loading AI model/i)).not.toBeInTheDocument(), { timeout: 4000 });
        }

        // 1. Upload SVG
        const file = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Tabs appear)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        await waitFor(() => {
            screen.getByText('icon.svg');
        }, { timeout: 5000 });

        // 2. Select Format (e.g. PNG) to enable processing
        // Find format checkbox. "PNG" text should coincide with label
        const pngCheckbox = screen.getByLabelText(/PNG/i);
        if (!(pngCheckbox as HTMLInputElement).checked) {
            fireEvent.click(pngCheckbox);
        }

        // 3. Click Process
        fireEvent.click(screen.getByText(/process images/i));

        // 3. Verify
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0];
        const images = callArgs[0];
        expect(images[0].name).toBe('icon.svg');
        expect(images[0].type).toBe('image/svg+xml');
    }, 15000);
});
