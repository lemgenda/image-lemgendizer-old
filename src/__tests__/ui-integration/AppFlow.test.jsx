import { render, screen, fireEvent, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../../App';
import { ProcessingProvider } from '../../context/ProcessingContext';
import '../../i18n';
import '@testing-library/jest-dom/vitest';

// Helper to render with provider
const renderWithProvider = (ui) => {
    return render(
        <ProcessingProvider>
            {ui}
        </ProcessingProvider>
    );
};

describe('App Flow Integration', () => {
    it('renders the application and shows main sections', async () => {
        renderWithProvider(<App />);

        // Wait for AI loading to finish if it's showing
        const loading = screen.queryByText(/Loading AI model/i);
        if (loading) {
            await waitForElementToBeRemoved(() => screen.queryByText(/Loading AI model/i), { timeout: 2000 });
        }

        // Check for major sections
        expect(screen.getByRole('heading', { name: /Image LemGendizer/i })).toBeInTheDocument();
        expect(screen.getByText(/Batch Image Processing & Optimization Tool/i)).toBeInTheDocument();
        expect(screen.getByText(/Drop images here or click to upload/i)).toBeInTheDocument();
    });

    it('toggles between Custom and Template processing tabs after upload', async () => {
        const { container } = renderWithProvider(<App />);

        // Wait for AI loading
        const loading = screen.queryByText(/Loading AI model/i);
        if (loading) {
            await waitForElementToBeRemoved(() => screen.queryByText(/Loading AI model/i), { timeout: 2000 });
        }

        // Initially tabs are not there (images.length === 0)
        expect(screen.queryByText(/Custom Processing/i)).not.toBeInTheDocument();

        // Mock a file upload
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]');

        fireEvent.change(input, { target: { files: [file] } });

        // Now tabs should be visible
        await waitFor(() => {
            expect(screen.getByRole('tab', { name: /Custom Processing/i })).toBeInTheDocument();
        }, { timeout: 2000 });

        expect(screen.getByRole('tab', { name: /Templates/i })).toBeInTheDocument();

        // Switch to Templates Tab
        const templatesTab = screen.getByRole('tab', { name: /Templates/i });
        fireEvent.click(templatesTab);

        // Check if Templates Tab content is visible
        expect(screen.getByText(/Select Templates/i)).toBeInTheDocument();
    });

    it('can open the upload dialog', async () => {
        renderWithProvider(<App />);

        // Wait for AI loading
        const loading = screen.queryByText(/Loading AI model/i);
        if (loading) {
            await waitForElementToBeRemoved(() => screen.queryByText(/Loading AI model/i), { timeout: 2000 });
        }

        const uploadArea = screen.getByText(/Drop images here or click to upload/i);
        expect(uploadArea).toBeInTheDocument();
    });
});
