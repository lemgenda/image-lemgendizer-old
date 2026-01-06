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
        orchestrateTemplateProcessing: vi.fn().mockResolvedValue([]),
        debounce: (fn: Function) => fn,
    };
});

window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();
// Prevent navigation error during download simulation
HTMLAnchorElement.prototype.click = vi.fn();

describe('Favicons Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows user to generate favicons', async () => {
        render(
            <ProcessingProvider>
                <App />
            </ProcessingProvider>
        );

        // Wait for AI loading
        // Wait for app initialization
        await waitForElementToBeRemoved(() => screen.queryByText(/Initializing Application/i), { timeout: 5000 }).catch(() => {});

        const loading = screen.queryByText(/Loading AI model/i);
        if (loading) {
            await waitForElementToBeRemoved(() => screen.queryByText(/Loading AI model/i), { timeout: 4000 });
        }

        // 1. Upload Image
        const file = new File(['dummy'], 'logo.png', { type: 'image/png' });
        const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(uploadInput, 'files', { value: [file] });
        fireEvent.change(uploadInput);

        // Wait for state update (Tabs appear)
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 5000 });

        await waitFor(() => {
             screen.getByText('logo.png');
        }, { timeout: 5000 });

        // 2. Select image for templates (Favicon uses template engine)
        fireEvent.click(screen.getByText('logo.png'));

        // 3. Switch to Templates (Favicons usually in Templates or specialized)
        // Based on UI knowledge, likely in Templates under "Generate Favicon" section
        fireEvent.click(screen.getByRole('tab', { name: /templates/i }));

        // 3. Find Favicon Toggle/Section
        try {
             // Debug: check what's visible
            const faviconToggle = await screen.findByLabelText(/Toggle Favicon Generation/i);
            fireEvent.click(faviconToggle);
        } catch (e) {

            screen.debug();
            throw e;
        }

        // 4. Process (Download)
        fireEvent.click(screen.getByRole('button', { name: /download template/i }));

        // 5. Verify orchestration
        await waitFor(() => {
            expect(generalUtils.orchestrateTemplateProcessing).toHaveBeenCalled();
        });

        // Check options passed to orchestration
        const callArgs = vi.mocked(generalUtils.orchestrateTemplateProcessing).mock.calls[0];
        const options = callArgs[6]; // 7th arg is processingOptions? Check sharedConstants/types
        // Or checking call signature in orchestrateTemplateProcessing
        // signature: (image, ids, configs, smartCrop, aiLoaded, onProgress, options)

        expect(options.includeFavicon).toBe(true);
    }, 15000);
});
