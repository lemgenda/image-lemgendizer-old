import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ProcessingProvider } from '../../context/ProcessingContext';
import '../../i18n';

import HeaderSection from '../../components/HeaderSection';

// Helper to render with provider
const renderWithProvider = (ui: React.ReactElement) => {
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
        const msg = args[0] instanceof Error ? args[0].stack : args[0];
        throw new Error(`CONSOLE ERROR: ${msg}`);
    });
    const result = render(
        <ProcessingProvider>
            {ui}
        </ProcessingProvider>
    );
    spy.mockRestore();
    return result;
};

describe('Sanity', () => {
    it('renders HeaderSection', () => {
        renderWithProvider(<HeaderSection />);
        expect(screen.getByText(/Image LemGendizer/i)).toBeInTheDocument();
    });
});
