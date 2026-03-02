import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Mock URL.createObjectURL
window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

describe('LemGendary Enhance Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows user to enable LemGendary Enhance in Custom Processing', async () => {
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
        const file = new File(['dummy'], 'enhance-test.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Custom Processing tab appears)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        // 2. Locate Enhance Checkbox
        // Validating presence of the checkbox by label text (from i18n)
        // Assuming i18n key 'enhance.title' resolves to something containing "LemGendary Enhance" or "AI Enhance"
        // The label in FormatSelectionCard.tsx uses t('enhance.checkbox') which is "Enable AI Enhance"
        const enhanceCheckbox = screen.getByRole('checkbox', { name: /Enable AI Enhance/i });
        expect(enhanceCheckbox).toBeInTheDocument();
        // 3. Enable Enhance
        if (!(enhanceCheckbox as HTMLInputElement).checked) {
            const user = userEvent.setup();
            await user.click(enhanceCheckbox);
        }

        // await waitFor(() => {
        //     expect(enhanceCheckbox).toBeChecked();
        // });
        // await waitFor(() => {
        //     expect(enhanceCheckbox).toBeChecked();
        // });

        // 4. Trigger Processing
        const processButton = screen.getByRole('button', { name: /Process Images/i });
        fireEvent.click(processButton);

        // 5. Verify orchestrateCustomProcessing called with enhance options
        await waitFor(() => {
            expect(generalUtils.orchestrateCustomProcessing).toHaveBeenCalled();
        });

        const callArgs = vi.mocked(generalUtils.orchestrateCustomProcessing).mock.calls[0];
        const config = callArgs[1];

        expect(config.enhance).toBeDefined();
        expect(config.enhance?.enabled).toBe(true);
        expect(config.enhance?.autoMode).toBe(true); // Default
    }, 15000);
});
