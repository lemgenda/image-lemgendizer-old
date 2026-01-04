import React from 'react';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../../App';
import { ProcessingProvider } from '../../context/ProcessingContext';
import '../../i18n';
import '@testing-library/jest-dom/vitest';

// Helper to render with provider
const renderWithProvider = (ui: React.ReactElement) => {
    return render(
        <ProcessingProvider>
            {ui}
        </ProcessingProvider>
    );
};

describe('Batch Rename Flow Integration', () => {
    it('allows pattern configuration and applies it to custom processing', async () => {
        const { container } = renderWithProvider(<App />);

        // Wait for AI loading to finish
        const loading = screen.queryByText(/Loading AI model/i);
        if (loading) {
            await waitForElementToBeRemoved(() => screen.queryByText(/Loading AI model/i), { timeout: 10000 });
        }

        // Mock a file upload
        const file = new File(['image content'], 'test-image.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for tabs to appear
        const renameTab = await screen.findByRole('tab', { name: /Batch Rename/i }, { timeout: 5000 });
        fireEvent.click(renameTab);

        // Verify Batch Rename content is visible
        await screen.findByTestId('rename-pattern-title');

        // Change the pattern
        const patternInput = screen.getByTestId('rename-pattern-input') as HTMLInputElement;
        fireEvent.change(patternInput, { target: { value: 'custom_pattern_{counter}' } });

        // Verify preview updates correctly
        await screen.findByText(/custom_pattern_001/i);

        // Click Apply to Custom Processing
        const applyBtn = screen.getByTestId('apply-to-custom-btn');
        fireEvent.click(applyBtn);

        // Verify we switched to Custom Processing tab and it is active
        const customTab = await screen.findByRole('tab', { name: /Custom Processing/i, selected: true }, { timeout: 5000 });
        expect(customTab).toHaveClass('tab-panel__tab--active');

        // Verify pattern was successfully transferred to Custom tab's rename field
        const customNameField = await screen.findByLabelText(/New File Name/i, {}, { timeout: 3000 }) as HTMLInputElement;
        expect(customNameField.value).toBe('custom_pattern_{counter}');
    });
});
