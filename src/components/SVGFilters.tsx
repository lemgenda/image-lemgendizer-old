/**
 * @file SVGFilters.tsx
 * @description Global SVG filter definitions (currently deprecated in favor of CamanJS).
 */
import '../styles/SVGFilters.css';

/**
 * Invisible SVG filters for use in CSS filter: url(#id)
 */
const SVGFilters = () => (
    <svg className="svg-filters-hidden">
        <defs>
            {/* SVG Filters Removed in favor of CamanJS */}
        </defs>
    </svg>
);

export default SVGFilters;
