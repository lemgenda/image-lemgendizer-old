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
});
