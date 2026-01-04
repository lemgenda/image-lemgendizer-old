import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScreenShotsCard from '../../components/ScreenShotsCard';
import { ProcessingProvider } from '../../context/ProcessingContext';
import '../../i18n';
import '@testing-library/jest-dom/vitest';

const mockProps = {
    isSelected: true,
    onToggle: vi.fn(),
    onUrlChange: vi.fn(),
    screenshotUrl: '',
    validation: null as { isValid: boolean; message: string; } | null,
    isCapturing: false,
    captureProgress: 0,
    onCaptureClick: vi.fn(),
    selectedTemplates: [] as string[],
    onTemplateToggle: vi.fn(),
    onSelectAllTemplates: vi.fn(),
    onDeselectAllTemplates: vi.fn()
};

const renderWithContext = (ui: React.ReactElement) => {
    return render(
        <ProcessingProvider>
            {ui}
        </ProcessingProvider>
    );
};

describe('ScreenShots Flow Integration', () => {
    it('renders the screenshot card with URL input and template actions', () => {
        renderWithContext(<ScreenShotsCard {...mockProps} />);

        expect(screen.getByPlaceholderText(/example\.com/i)).toBeInTheDocument();
        expect(screen.getByText(/Select Screenshot Templates/i)).toBeInTheDocument();
    });

    it('validates URL input showing message', () => {
        const validationProps = {
            ...mockProps,
            screenshotUrl: 'invalid-url',
            validation: { isValid: false, message: 'Invalid URL format' }
        };
        renderWithContext(<ScreenShotsCard {...validationProps} />);

        expect(screen.getByText(/Invalid URL format/)).toBeInTheDocument();
    });
});
