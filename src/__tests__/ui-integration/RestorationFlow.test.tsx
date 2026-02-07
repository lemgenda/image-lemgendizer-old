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
        processLemGendaryRestoration: vi.fn(),
        debounce: (fn: (...args: any[]) => any) => fn,
    };
});

window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('Restoration Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows user to enable restoration and select Deraining model in Custom Processing', async () => {
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
        const file = new File(['dummy'], 'restoration-test.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Custom Processing tab appears)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        // 2. Locate Restoration Card
        // It should be visible in Custom Processing tab (default tab)
        expect(screen.getByText(/AI Image Restoration/i)).toBeInTheDocument();

        // 3. Enable Restoration
        const toggle = document.getElementById('restorationInfoToggle') as HTMLInputElement;
        expect(toggle).toBeInTheDocument();
        fireEvent.click(toggle);
        expect(toggle.checked).toBe(true);

        // 4. Select a Model (e.g., Deraining)
        const derainingOption = screen.getByText(/Deraining/i);
        fireEvent.click(derainingOption);

        // 5. Trigger Processing
        const processButton = screen.getByRole('button', { name: /Process Images/i });
        fireEvent.click(processButton);

        // 6. Verify orchestrateCustomProcessing called with restoration options
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0];
        const config = callArgs[1];

        expect(config.restoration).toBeDefined();
        expect(config.restoration?.enabled).toBe(true);
        expect(config.restoration?.enabled).toBe(true);
        expect(config.restoration?.modelName).toBe('MPRNet-Deraining');
    }, 15000);

    it('allows user to select Dehazing Indoor model (FFA-Net)', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Upload Image
        const file = new File(['dummy'], 'haze-resto.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        });

        // Enable Restoration
        const toggle = document.getElementById('restorationInfoToggle') as HTMLInputElement;
        fireEvent.click(toggle);

        // Select Dehazing Indoor
        // Label is 'Indoor Dehazing' in i18n
        const dehazingOption = screen.getByText(/Indoor Dehazing/i);
        fireEvent.click(dehazingOption);

        // Process
        const processButton = screen.getByRole('button', { name: /Process Images/i });
        fireEvent.click(processButton);

        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const config = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0][1];
        expect(config.restoration?.modelName).toBe('FFANet-Dehazing(Indoor)');
    }, 15000);
});
