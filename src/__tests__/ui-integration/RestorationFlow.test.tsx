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

        // 3. Select a Model (e.g., Deraining)
        // Note: Toggle is removed, selecting a model implicitly enables restoration
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

        // Select Dehazing Indoor
        // Note: Toggle is removed, selecting a model implicitly enables restoration
        // Label is 'Dehazing (Indoor)' in i18n
        const dehazingOption = screen.getByText(/Dehazing.*Indoor/i);
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

    it('allows user to enable CodeFormer (Face Restoration) and adjust fidelity', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Upload Image
        const file = new File(['dummy'], 'face-resto.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        });

        // Select CodeFormer
        const codeformerOption = screen.getByTestId('restoration-option-CodeFormer');
        fireEvent.click(codeformerOption);

        // Verify fidelity slider appears
        const slider = screen.getByTestId('codeformer-fidelity-slider');
        fireEvent.change(slider, { target: { value: '0.85' } });

        // Process
        const processButton = screen.getByRole('button', { name: /Process Images/i });
        fireEvent.click(processButton);

        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const config = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0][1];
        expect(config.restoration?.enabled).toBe(true);
        expect(config.restoration?.selectedModels).toContain('CodeFormer');
        expect(config.restoration?.fidelity).toBe(0.85);
    }, 15000);

    it('allows user to select MIRNet (Low-Light Enhancement)', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Upload Image
        const file = new File(['dummy'], 'dark-test.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        });

        // Select Low-Light
        const lowLightOption = screen.getByTestId('restoration-option-MIRNet(v2)-LowLight');
        fireEvent.click(lowLightOption);

        // Process
        const processButton = screen.getByRole('button', { name: /Process Images/i });
        fireEvent.click(processButton);

        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const config = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0][1];
        expect(config.restoration?.selectedModels).toContain('MIRNet(v2)-LowLight');
    }, 15000);

    it('handles multiple models and verifies priority ordering (Denoise before Deblur)', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Upload Image
        const file = new File(['dummy'], 'multi-resto.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        });

        // Select Deblurring first
        const deblurOption = screen.getByTestId('restoration-option-NAFNet-Debluring(REDS)');
        fireEvent.click(deblurOption);

        // Then select Denoising - RestorationCard should insert it before Deblur
        const denoiseOption = screen.getByTestId('restoration-option-NAFNet-Denoising');
        fireEvent.click(denoiseOption);

        // Process
        const processButton = screen.getByRole('button', { name: /Process Images/i });
        fireEvent.click(processButton);

        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const config = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0][1];

        // Verify order: Denoise should be index 0, Deblur index 1
        expect(config.restoration?.selectedModels[0]).toBe('NAFNet-Denoising');
        expect(config.restoration?.selectedModels[1]).toBe('NAFNet-Debluring(REDS)');
    }, 15000);
});
