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
        orchestrateTemplateProcessing: vi.fn().mockResolvedValue([]),
        debounce: (fn: (...args: any[]) => any) => fn,
    };
});

window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();
// Prevent navigation error during download simulation
HTMLAnchorElement.prototype.click = vi.fn();

describe('Template Processing Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows user to select templates and process', async () => {
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
        const file = new File(['dummy'], 'template-test.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Tabs appear)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        await waitFor(() => {
            screen.getByText('template-test.png');
        }, { timeout: 5000 });

        // 2. Select the image in the gallery for Template Processing (required)
        const imageCard = screen.getByText('template-test.png');
        fireEvent.click(imageCard);

        // 3. Switch to Templates Tab
        const templatesTab = screen.getByRole('tab', { name: /templates/i });
        fireEvent.click(templatesTab);

        // 3. Select a Template
        // 3. Select a Template
        // Target by ID for robustness
        // ID derived from templateConfigs.ts: 'ig-square' -> 'template-ig-square'
        const checkbox = document.getElementById('template-ig-square') as HTMLInputElement;
        if (!checkbox) throw new Error('Checkbox template-ig-square not found');

        fireEvent.click(checkbox);

        // Verify and force if needed
        if (!checkbox.checked) {

            fireEvent.click(checkbox);
        }

        // 4. Process (Download)
        const processButton = screen.getByRole('button', { name: /download template/i });
        fireEvent.click(processButton);

        // 5. Verify orchestrateTemplateProcessing
        await waitFor(() => {
            expect(generalUtils.orchestrateTemplateProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateTemplateProcessing).mock.calls[0];
        // Check selected template IDs
        const selectedIds = callArgs[1];
        expect(selectedIds).toEqual(expect.arrayContaining(['ig-square']));
    }, 15000);

    it('includes restoration options when enabled in Templates tab', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Upload
        const file = new File(['dummy'], 'template-resto.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for tabs
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        // Select Image
        await waitFor(() => screen.getByText('template-resto.png'));
        fireEvent.click(screen.getByText('template-resto.png'));

        // Switch to Templates
        fireEvent.click(screen.getByRole('tab', { name: /templates/i }));

        // Enable Restoration
        // RestorationCard should be visible
        await waitFor(() => {
            expect(screen.getByText(/AI Image Restoration/i)).toBeInTheDocument();
        });

        // Use ID for robustness
        const restoToggle = document.getElementById('restorationInfoToggle') as HTMLInputElement;

        expect(restoToggle).toBeInTheDocument();
        // Click to enable
        if (!restoToggle.checked) {
            fireEvent.click(restoToggle);
        }

        // Wait for state update - checked should be true
        await waitFor(() => {
            expect(restoToggle.checked).toBe(true);
        });

        const rainRemoval = screen.getByText(/Deraining/i);
        fireEvent.click(rainRemoval);

        // Wait for state update (implicit via waitFor on function call later)
        // verify model selection in function call args instead

        // Select a template
        const checkbox = document.getElementById('template-ig-square') as HTMLInputElement;
        if (checkbox && !checkbox.checked) fireEvent.click(checkbox);

        // Process
        const processButton = screen.getByRole('button', { name: /download template/i });
        fireEvent.click(processButton);

        await waitFor(() => {
            expect(generalUtils.orchestrateTemplateProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateTemplateProcessing).mock.calls[0];
        const options = callArgs[6];

        expect(options.restoration?.enabled).toBe(true);
        expect(options.restoration?.modelName).toBe('MPRNet-Deraining');
    }, 15000);
});
