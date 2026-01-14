/**
 * @file filterStyles.ts
 * @description Provides CSS filter approximations for real-time UI previews in the gallery.
 */
import { IMAGE_FILTERS } from '../constants';

/**
 * Returns the CSS filter string for a given filter ID.
 * Used for live previews in the gallery.
 * Note: CamanJS filters are approximated with CSS - actual output will differ slightly.
 */
export const getFilterStyle = (filterId: string): string => {
    switch (filterId) {
        case IMAGE_FILTERS.SEPIA:
            return 'sepia(100%)';
        case IMAGE_FILTERS.BW:
            return 'grayscale(100%)';
        case IMAGE_FILTERS.INVERT:
            return 'invert(100%)';
        case IMAGE_FILTERS.VIGNETTE:
            // CSS Approximation for Vignette
            return 'drop-shadow(0px 0px 10px rgba(0,0,0,0.5))';
        case IMAGE_FILTERS.RETRO_VINTAGE:
            return 'sepia(30%) contrast(90%) brightness(110%) saturate(80%)';
        case IMAGE_FILTERS.HDR:
            return 'contrast(140%) saturate(150%) brightness(105%)';

        // CamanJS Presets - CSS approximations
        case IMAGE_FILTERS.VINTAGE:
            // greyscale + sepia + contrast
            return 'grayscale(100%) sepia(100%) contrast(105%) saturate(80%)';
        case IMAGE_FILTERS.LOMO:
            // high contrast with boosted brightness
            return 'brightness(115%) saturate(80%) contrast(130%)';
        case IMAGE_FILTERS.CLARITY:
            // vibrant with sharpness simulation
            return 'saturate(120%) contrast(110%) brightness(105%)';
        case IMAGE_FILTERS.SIN_CITY:
            // high contrast B&W
            return 'grayscale(100%) contrast(200%) brightness(115%)';
        case IMAGE_FILTERS.SUNRISE:
            // warm orange glow
            return 'sepia(60%) saturate(120%) hue-rotate(-10deg) brightness(105%)';
        case IMAGE_FILTERS.CROSS_PROCESS:
            // cross-processed film look
            return 'sepia(20%) saturate(150%) contrast(115%) hue-rotate(5deg)';
        case IMAGE_FILTERS.ORANGE_PEEL:
            // orange tint with enhanced saturation
            return 'sepia(50%) saturate(180%) hue-rotate(-20deg) contrast(95%) brightness(105%)';
        case IMAGE_FILTERS.LOVE:
            // intense red romantic overlay
            return 'saturate(200%) brightness(105%) hue-rotate(-15deg) contrast(108%) sepia(40%)';
        // Approximates the strong red colorization
        case IMAGE_FILTERS.GRUNGY:
            // desaturated gritty
            return 'saturate(40%) contrast(105%) brightness(95%)';
        case IMAGE_FILTERS.JARQUES:
            // cool-toned vintage
            return 'saturate(65%) hue-rotate(10deg) contrast(105%)';
        case IMAGE_FILTERS.PINHOLE:
            // pinhole camera effect
            return 'grayscale(100%) sepia(10%) contrast(115%) brightness(110%)';
        case IMAGE_FILTERS.OLD_BOOT:
            // faded vintage
            return 'saturate(80%) sepia(30%) brightness(95%) contrast(95%)';
        case IMAGE_FILTERS.GLOWING_SUN:
            // soft golden glow
            return 'brightness(110%) saturate(110%) sepia(10%) contrast(95%)';
        case IMAGE_FILTERS.HAZY_DAYS:
            // soft dreamy haze
            return 'brightness(105%) saturate(85%) blur(0.3px) contrast(95%) hue-rotate(5deg)';
        case IMAGE_FILTERS.HER_MAJESTY:
            // magenta vintage
            return 'brightness(140%) saturate(110%) hue-rotate(-10deg) sepia(20%)';
        case IMAGE_FILTERS.NOSTALGIA:
            // classic sepia nostalgia
            return 'grayscale(100%) sepia(100%) contrast(110%) brightness(110%)';
        case IMAGE_FILTERS.HEMINGWAY:
            // literary greyscale
            return 'grayscale(100%) sepia(30%) contrast(110%)';
        case IMAGE_FILTERS.CONCENTRATE:
            // sharp desaturated focus
            return 'saturate(50%) contrast(120%) brightness(110%)';
        case IMAGE_FILTERS.NIGHT_VISION:
            // dark tactical night vision with strong vignette
            return 'grayscale(100%) sepia(100%) hue-rotate(70deg) saturate(250%) contrast(90%) brightness(40%)';
        // Approximates concentrate base + dark green overlay + vignette
        default:
            return 'none';
    }
};
