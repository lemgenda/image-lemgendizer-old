import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App';
import { ProcessingProvider } from '../../context/ProcessingContext';
import userEvent from '@testing-library/user-event';

// Polyfills for JSDOM
if (!global.createImageBitmap) {
    global.createImageBitmap = vi.fn().mockImplementation(() => {
        return Promise.resolve({
            width: 100,
            height: 100,
            close: () => { },
        });
    });
}
if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}

// Mock sibling cards to isolate AIEnhancementsCard testing
vi.mock('../../components/QualityControlsCard', () => ({ default: () => <div data-testid="mock-quality-card">Quality Controls</div> }));
vi.mock('../../components/ResizeCropCard', () => ({ default: () => <div data-testid="mock-resize-card">Resize Logic</div> }));
vi.mock('../../components/FormatSelectionCard', () => ({ default: () => <div data-testid="mock-format-card">Format Selection</div> }));
vi.mock('../../components/FilterSelectionCard', () => ({ default: () => <div data-testid="mock-filter-card">Filter Selection</div> }));
vi.mock('../../components/ColorCorrectionCard', () => ({ default: () => <div data-testid="mock-color-card">Color Correction</div> }));
vi.mock('../../components/WatermarkCard', () => ({ default: () => <div data-testid="mock-watermark-card">Watermark</div> }));

// Mock UploadSection to easily insert a file
vi.mock('../../components/UploadSection', () => ({
    default: ({ onImagesSelected }: { onImagesSelected: (files: File[]) => void }) => (
        <div data-testid="mock-upload-section">
            <button
                onClick={() => onImagesSelected([new File(['(⌐□_□)'], 'image1.png', { type: 'image/png' })])}
                data-testid="mock-upload-btn"
            >
                Mock Upload
            </button>
            Drop images here or click to upload
        </div>
    )
}));

const renderWithProvider = (ui: React.ReactElement) => {
    return {
        user: userEvent.setup(),
        ...render(
            <ProcessingProvider>
                {ui}
            </ProcessingProvider>
        )
    };
};

describe('AI Quality Improvement Flow', () => {
    vi.setConfig({ testTimeout: 30000 });

    it('supports selecting multiple AI enhancements and maintains state', async () => {
        renderWithProvider(<App />);

        // 1. Upload Image via mock
        const mockUploadBtn = await screen.findByTestId('mock-upload-btn');
        fireEvent.click(mockUploadBtn);

        // Wait for upload to complete and image button to appear.
        await screen.findByRole('button', { name: /image1\.png/i }, { timeout: 15000 });

        // 3. Toggle enhancements using REAL UI (AIEnhancementsCard)
        // Find 'Deblurring' button in unselected list.
        // We use findByRole to disambiguate from the status bar tooltip.
        const deblurButton = await screen.findByRole('button', { name: /^Deblurring$/i });

        expect(deblurButton).toBeTruthy();
        if (deblurButton) {
            fireEvent.click(deblurButton);
        }

        // 4. Verify state after updates via UI
        // It should now appear in the "Selected" list, which renders "1. Deblurring"
        await waitFor(() => {
            // We search for text content exactly "1." near "Deblurring" or purely "Deblurring" is present.
            // But since "Deblurring" was present before, we need to check if it has moved to selected list.
            // Selected items have a removal button (icon 'times').
            // Unselected items have addition button (icon 'plus').
            // Or simpler: check if "1." is visible (indicating the first selected task).
            expect(screen.getByText('1.')).toBeInTheDocument();
            // And verifying it is associated with Deblurring is harder without strict selector,
            // but checking for existence of "1." proves at least one task is selected.
        }, { timeout: 10000 });

        // Toggle another one: 'Denoising'
        const denoiseButton = await screen.findByRole('button', { name: /^Denoising$/i });

        expect(denoiseButton).toBeTruthy();
        if (denoiseButton) {
            fireEvent.click(denoiseButton);
        }

        await waitFor(() => {
            // Now we should have "1." and "2."
            expect(screen.getByText('1.')).toBeInTheDocument();
            expect(screen.getByText('2.')).toBeInTheDocument();
        }, { timeout: 10000 });
    });
});
