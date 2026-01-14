import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterSelectionCard from '../../components/FilterSelectionCard';
import { IMAGE_FILTERS } from '../../constants';

// Mock filterProcessor
vi.mock('../../processors/filterProcessor', () => ({
    applyImageFilter: vi.fn((src) => Promise.resolve(src))
}));

describe('Filter Flow Integration', () => {
    const mockT = (key: string) => key;
    const mockOnFilterChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders filter selection card with options', () => {
        render(
            <FilterSelectionCard
                selectedFilter={IMAGE_FILTERS.NONE}
                onFilterChange={mockOnFilterChange}
                t={mockT}
            />
        );

        expect(screen.getByText('filters.title')).toBeInTheDocument();
        // Check for some known filters
        expect(screen.getByText('filters.name.' + IMAGE_FILTERS.SEPIA)).toBeInTheDocument();
        expect(screen.getByText('filters.name.' + IMAGE_FILTERS.VINTAGE)).toBeInTheDocument();
    });

    it('handles filter selection', () => {
        render(
            <FilterSelectionCard
                selectedFilter={IMAGE_FILTERS.NONE}
                onFilterChange={mockOnFilterChange}
                t={mockT}
            />
        );

        // Find the button for Sepia
        const sepiaButton = screen.getByText('filters.name.' + IMAGE_FILTERS.SEPIA).closest('button');
        expect(sepiaButton).toBeInTheDocument();

        fireEvent.click(sepiaButton!);
        expect(mockOnFilterChange).toHaveBeenCalledWith(IMAGE_FILTERS.SEPIA);
    });

    it('highlights active filter', () => {
        const { rerender } = render(
            <FilterSelectionCard
                selectedFilter={IMAGE_FILTERS.NONE}
                onFilterChange={mockOnFilterChange}
                t={mockT}
            />
        );

        // NONE should be active
        const noneButton = screen.getByText('filters.name.' + IMAGE_FILTERS.NONE).closest('button');
        expect(noneButton).toHaveClass('active');

        // Render with SEPIA selected
        rerender(
            <FilterSelectionCard
                selectedFilter={IMAGE_FILTERS.SEPIA}
                onFilterChange={mockOnFilterChange}
                t={mockT}
            />
        );

        const sepiaButton = screen.getByText('filters.name.' + IMAGE_FILTERS.SEPIA).closest('button');
        expect(sepiaButton).toHaveClass('active');
        expect(noneButton).not.toHaveClass('active');
    });

    it('filters support localized names', () => {
        const localizedMockT = (key: string) => {
            if (key === 'filters.name.' + IMAGE_FILTERS.SEPIA) return 'Sepia Filter';
            return key;
        };

        render(
            <FilterSelectionCard
                selectedFilter={IMAGE_FILTERS.NONE}
                onFilterChange={mockOnFilterChange}
                t={localizedMockT}
            />
        );

        expect(screen.getByText('Sepia Filter')).toBeInTheDocument();
    });
});
