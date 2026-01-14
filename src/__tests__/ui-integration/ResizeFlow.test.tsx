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

// Mock URL.createObjectURL since it's not available in jsdom
window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('Resize Flow Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows user to enable resize and set dimensions', async () => {
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

        // 1. Simulate Image Upload
        const file = new File(['dummy content'], 'test-image.png', { type: 'image/png' });
        // Input is hidden, so we need to select it by selector or direct querying
        // The DropZone div has the label, but the input is separate
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        // Use fireEvent.change for file inputs as per RTL best practices
        // Note: property definition is needed for react-testing-library to trigger onChange properly with files
        Object.defineProperty(uploadInput, 'files', {
            value: [file],
        });
        fireEvent.change(uploadInput);

        // Wait for state update (Tabs appear) - Confirm upload recognized
        // Wait for state update (Tabs appear) - Confirm upload recognized
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        // Wait for image to be "loaded" into list - Confirm Gallery rendered
        // Wait for image to be "loaded" into list - Confirm Gallery rendered
        await waitFor(() => {
            expect(screen.getByText('test-image.png')).toBeInTheDocument();
        }, { timeout: 5000 });

        // 2. Navigate to Resize Controls
        const resizeInput = screen.queryByLabelText(/Resize Dimension/i);

        if (!resizeInput) {
            // If not active, click the toggle button
            const toggleButton = screen.getByRole('button', { name: /Resize Mode/i });
            fireEvent.click(toggleButton);
        }

        // 3. Set Width (Resize Dimension)
        const dimensionInput = screen.getByLabelText(/Resize Dimension/i);
        fireEvent.change(dimensionInput, { target: { value: '500' } });

        // 4. Trigger Processing
        const processButton = screen.getByText(/process images/i);
        fireEvent.click(processButton);

        // 5. Verify orchestrateCustomProcessing call
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0];
        const config = callArgs[1]; // Second arg is processingConfig

        expect(config.resize).toEqual(expect.objectContaining({
            enabled: true,
            dimension: 500,
        }));
    }, 15000); // Increased timeout
});
