/**
 * @file FilterSelectionCard.tsx
 * @description UI component for selecting and applying image filters (CamanJS presets).
 */
import { useRef, useEffect } from 'react';
import { IMAGE_FILTERS } from '../constants';
import '../styles/FilterSelectionCard.css';

interface FilterSelectionCardProps {
    selectedFilter: string;
    onFilterChange: (filter: string) => void;
    t: (key: string, params?: any) => string;
    disabled?: boolean;
}

/**
 * FilterSelectionCard component.
 * @component
 * @param {FilterSelectionCardProps} props - Component props.
 * @returns {JSX.Element} The rendered filter selection card.
 */
const FilterSelectionCard = ({ selectedFilter, onFilterChange, t, disabled = false }: FilterSelectionCardProps) => {
    const filtersGridRef = useRef<HTMLDivElement>(null);

    const filters = [
        { id: IMAGE_FILTERS.NONE, icon: 'fa-ban' },
        // Standard Allowed
        { id: IMAGE_FILTERS.SEPIA, icon: 'fa-history' },
        { id: IMAGE_FILTERS.RETRO_VINTAGE, icon: 'fa-camera-retro' },
        { id: IMAGE_FILTERS.HDR, icon: 'fa-adjust' },
        { id: IMAGE_FILTERS.BW, icon: 'fa-tint-slash' },
        { id: IMAGE_FILTERS.VIGNETTE, icon: 'fa-compress-arrows-alt' },
        { id: IMAGE_FILTERS.INVERT, icon: 'fa-exchange-alt' },

        // Caman Presets
        { id: IMAGE_FILTERS.VINTAGE, icon: 'fa-clock' },
        { id: IMAGE_FILTERS.LOMO, icon: 'fa-film' },
        { id: IMAGE_FILTERS.CLARITY, icon: 'fa-glasses' },
        { id: IMAGE_FILTERS.SIN_CITY, icon: 'fa-city' },
        { id: IMAGE_FILTERS.SUNRISE, icon: 'fa-sun' },
        { id: IMAGE_FILTERS.CROSS_PROCESS, icon: 'fa-random' },
        { id: IMAGE_FILTERS.ORANGE_PEEL, icon: 'fa-palette' },
        { id: IMAGE_FILTERS.LOVE, icon: 'fa-heart' },
        { id: IMAGE_FILTERS.GRUNGY, icon: 'fa-mask' },
        { id: IMAGE_FILTERS.JARQUES, icon: 'fa-user-secret' },
        { id: IMAGE_FILTERS.PINHOLE, icon: 'fa-dot-circle' },
        { id: IMAGE_FILTERS.OLD_BOOT, icon: 'fa-shoe-prints' },
        { id: IMAGE_FILTERS.GLOWING_SUN, icon: 'fa-lightbulb' },
        { id: IMAGE_FILTERS.HAZY_DAYS, icon: 'fa-smog' },
        { id: IMAGE_FILTERS.HER_MAJESTY, icon: 'fa-crown' },
        { id: IMAGE_FILTERS.NOSTALGIA, icon: 'fa-music' },
        { id: IMAGE_FILTERS.HEMINGWAY, icon: 'fa-book' },
        { id: IMAGE_FILTERS.CONCENTRATE, icon: 'fa-bullseye' },
        { id: IMAGE_FILTERS.NIGHT_VISION, icon: 'fa-moon' },
    ];

    // Enable horizontal scroll with mouse wheel
    useEffect(() => {
        const filtersGrid = filtersGridRef.current;
        if (!filtersGrid) return;

        const handleWheel = (e: WheelEvent) => {
            // Only handle horizontal scroll when hovering over filters grid
            if (e.deltaY !== 0) {
                e.preventDefault();
                filtersGrid.scrollLeft += e.deltaY;
            }
        };

        filtersGrid.addEventListener('wheel', handleWheel, { passive: false });
        return () => filtersGrid.removeEventListener('wheel', handleWheel);
    }, []);

    return (
        <div className={`card filter-selection-card ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="card-title">
                <i className="fas fa-magic"></i> {t('filters.title')}
            </h3>

            <div className="filters-grid" ref={filtersGridRef}>
                {filters.map((filter) => (
                    <button
                        key={filter.id}
                        className={`filter-item ${selectedFilter === filter.id ? 'active' : ''}`}
                        onClick={() => !disabled && onFilterChange(filter.id)}
                        disabled={disabled}
                        title={t(`filters.description.${filter.id}`) || filter.id}
                    >
                        <div className="filter-icon">
                            <i className={`fas ${filter.icon}`}></i>
                        </div>
                        <span className="filter-name">
                            {t(`filters.name.${filter.id}`) || filter.id.replace(/_/g, ' ')}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FilterSelectionCard;
