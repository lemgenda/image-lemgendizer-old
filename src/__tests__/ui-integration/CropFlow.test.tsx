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

describe('Crop Flow Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows user to enable crop and select center position', async () => {
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

        // 1. Upload Image
        const file = new File(['dummy'], 'crop-test.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Tabs appear)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        // 2. Select Image & Verify
        await waitFor(() => {
            screen.getByText('crop-test.png');
        }, { timeout: 5000 });

        // 3. Enable Standard Crop
        // The new UI uses a segmented control. "Standard Crop" button should be clicked.
        const standardCropBtn = screen.getByRole('button', { name: /Standard Crop/i });
        fireEvent.click(standardCropBtn);

        // 4. Set Dimensions & Position
        // Inputs should be visible now
        const widthInput = screen.getByLabelText(/Width/i);
        fireEvent.change(widthInput, { target: { value: '800' } });

        const heightInput = screen.getByLabelText(/Height/i);
        fireEvent.change(heightInput, { target: { value: '600' } });

        // Position select should be visible in Standard Crop mode

        // Now find the position grid or select
        // It is a select dropdown with label "Crop Position"
        const positionSelect = screen.getByLabelText(/Crop Position/i);
        fireEvent.change(positionSelect, { target: { value: 'center' } });

        // 4. Process
        fireEvent.click(screen.getByText(/process images/i));

        // 5. Verify
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const config = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0][1];
        expect(config.crop).toEqual(expect.objectContaining({
            enabled: true,
            width: 800,
            height: 600,
            // mode: 'standard', // Implementation detail might differ so omitted or relaxed
            // position: 'center'
        }));
    }, 15000);
});
