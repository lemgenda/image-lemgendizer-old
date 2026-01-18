
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../../App';
import * as generalUtils from '../../utils/generalUtils';
import { ProcessingProvider } from '../../context/ProcessingContext';

// Mock dependencies
vi.mock('../../utils/generalUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof generalUtils>();
    return {
        ...actual,
        orchestrateCustomProcessing: vi.fn(),
        debounce: (fn: (...args: any[]) => any) => fn,
    };
});

window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('Watermark Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset processing options mock if needed, or rely on provider reset
    });

    it('allows user to apply watermark settings', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // 1. Upload Image (Required to see Custom Processing)
        const file = new File(['dummy'], 'test-image.jpg', { type: 'image/jpeg' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        await waitFor(() => {
            expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
        }, { timeout: 5000 });

        // 2. Locate Watermark Section
        // Assuming "Custom Processing" tab or similar is visible
        // 3. Enable Watermark
        // It's a button that toggles. Text is "Enable" when disabled.
        const enableBtn = screen.getByRole('button', { name: /enable/i });
        fireEvent.click(enableBtn);

        // 4. Change Watermark Text
        const textInput = screen.getByPlaceholderText(/enter watermark text/i);
        fireEvent.change(textInput, { target: { value: 'My Copyright' } });
        expect(textInput).toHaveValue('My Copyright');

        // 5. Change Position
        const positionSelect = screen.getByRole('combobox', { name: /position/i });
        fireEvent.change(positionSelect, { target: { value: 'center' } });
        expect(positionSelect).toHaveValue('center');

        // 6. Toggle Repeat
        const repeatCheckbox = screen.getByRole('checkbox', { name: /repeat/i });
        fireEvent.click(repeatCheckbox);
        expect(repeatCheckbox).toBeChecked();

        // 7. Start Processing
        const processBtn = screen.getByRole('button', { name: /process images/i });
        fireEvent.click(processBtn);

        // 8. Verify orchestration
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0];
        const processingConfig = callArgs[1]; // Check signature

        if (!processingConfig) throw new Error("Config undefined");
        if (!processingConfig.watermark) throw new Error("Watermark config undefined");

        expect(processingConfig.watermark.enabled).toBe(true);
        expect(processingConfig.watermark.text).toBe('My Copyright');
        expect(processingConfig.watermark.position).toBe('center');
        expect(processingConfig.watermark.repeat).toBe(true);

    }, 20000);
});
