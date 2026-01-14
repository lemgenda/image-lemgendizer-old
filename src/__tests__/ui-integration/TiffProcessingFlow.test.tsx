import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../../App';
import { ProcessingProvider } from '../../context/ProcessingContext';
import * as generalUtils from '../../utils/generalUtils';
import * as tiffUtils from '../../utils/tiffUtils';

// Mock dependencies
vi.mock('../../utils/generalUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof generalUtils>();
    return {
        ...actual,
        orchestrateCustomProcessing: vi.fn().mockResolvedValue([]),
        debounce: (fn: (...args: any[]) => any) => fn,
    };
});

vi.mock('../../utils/tiffUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof tiffUtils>();
    return {
        ...actual,
        convertTIFFForProcessing: vi.fn(() => Promise.resolve(new File(['converted'], 'converted.png', { type: 'image/png' }))),
    };
});

// Mock URL.createObjectURL since it's not available in jsdom
window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('TIFF Processing Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles TIFF upload and triggers conversion logic during processing', async () => {
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

        // 1. Upload TIFF Image
        const file = new File(['tiff data'], 'image.tiff', { type: 'image/tiff' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Tabs appear)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        // Wait for it to appear
        await waitFor(() => {
            screen.getByText('image.tiff');
        }, { timeout: 5000 });

        // 2. Select Format to enable processing button
        const pngCheckbox = screen.getByLabelText(/PNG/i);
        if (!(pngCheckbox as HTMLInputElement).checked) {
            fireEvent.click(pngCheckbox);
        }

        // 3. Click Process
        fireEvent.click(screen.getByText(/process images/i));

        // 3. Verify that the orchestrator was called
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0];
        const images = callArgs[0];
        expect(images[0].name).toBe('image.tiff');
        expect(images[0].type).toBe('image/tiff');
    }, 15000);
});
