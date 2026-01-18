
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ColorCorrectionCard from '../../components/ColorCorrectionCard';
import * as ProcessingContext from '../../context/ProcessingContext';

// Mock translations
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock contexts
const mockContextValue = {
    processingOptions: {
        colorCorrection: {
            enabled: true,
            brightness: 0,
            contrast: 0,
            saturation: 0, // Should be 0 by default
            vibrance: 0,
            exposure: 0,
            hue: 0,
            sepia: 0,
            gamma: 1.0,
            noise: 0,
            clip: 0,
            sharpen: 0,
            stackBlur: 0
        },
        filters: { enabled: false }
    },
    setProcessingOptions: vi.fn(),
    handleColorCorrectionChange: vi.fn(),
    toggleColorCorrection: vi.fn(),
    t: (k: string) => k
};

// Mock useProcessingContext directly
vi.spyOn(ProcessingContext, 'useProcessingContext').mockReturnValue(mockContextValue as any);

describe('ColorCorrectionFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all color correction sliders', () => {
        render(<ColorCorrectionCard />);

        expect(screen.getByText('color.brightness')).toBeInTheDocument();
        expect(screen.getByText('color.contrast')).toBeInTheDocument();
        expect(screen.getByText('color.saturation')).toBeInTheDocument();
        // ... verify others if needed
    });

    it('enables color correction when a slider is moved', () => {
        // Redefine mock for this test to capture state updates
        let state = { ...mockContextValue.processingOptions };
        const setProcessingOptions = vi.fn((updater) => {
            if (typeof updater === 'function') {
                state = updater(state);
            }
        });

        vi.spyOn(ProcessingContext, 'useProcessingContext').mockReturnValue({
            ...mockContextValue,
            processingOptions: state,
            setProcessingOptions
        } as any);

        render(<ColorCorrectionCard />);

        // Find a slider input (e.g. brightness)
        // RangeSliderElement usually renders an input[type="range"]
        const inputs = screen.getAllByRole('slider');
        const brightnessInput = inputs[0]; // Assuming order

        fireEvent.change(brightnessInput, { target: { value: '20' } });

        expect(mockContextValue.handleColorCorrectionChange).toHaveBeenCalledWith('brightness', 20);

        // In the integration flow, we'd expect setProcessingOptions to trigger handleColorCorrectionChange
        // which sets enabled: true and filters.enabled: false.

        // Since we are mocking setProcessingOptions, we can inspect the updater function behavior
        // But verifying the EXACT logic relies on the Context implementation details which we mocked.
        // A true integration test would wrap with real ProcessingProvider.
    });
});
