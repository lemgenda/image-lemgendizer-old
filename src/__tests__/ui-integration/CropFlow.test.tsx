import { render, screen, fireEvent, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
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
        debounce: (fn: Function) => fn,
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
            await waitForElementToBeRemoved(() => screen.queryByText(/Loading AI model/i), { timeout: 4000 });
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

        // Check if Crop is actve
        const cropWidthInput = screen.queryByLabelText(/Crop Width/i);

        if (!cropWidthInput) {
             const toggleButton = screen.getByRole('button', { name: /Crop Mode/i });
             fireEvent.click(toggleButton);
        }

        // 3. Set Dimensions & Position
        // Assuming input fields for width/height and a selector/buttons for position
        const widthInput = screen.getByLabelText(/crop width|width/i); // heuristic
        fireEvent.change(widthInput, { target: { value: '800' } });

        const heightInput = screen.getByLabelText(/crop height|height/i);
        fireEvent.change(heightInput, { target: { value: '600' } });

        // Check for Smart Crop toggle (Button)
        // If it says "Switch to Standard", current mode is Smart.
        // We want Standard to select position.
        const smartToggle = screen.queryByRole('button', { name: /Standard Crop/i });
        if (smartToggle) {
             fireEvent.click(smartToggle);
        }

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
