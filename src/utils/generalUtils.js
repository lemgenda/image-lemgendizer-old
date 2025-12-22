/**
 * Calculates percentage value.
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} value - Current value
 * @returns {number} Percentage
 */
export const calculatePercentage = (min, max, value) => {
    return ((value - min) / (max - min)) * 100;
};

/**
 * Generates tick values for range sliders.
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<number>} Array of tick values
 */
export const generateTicks = (min, max) => {
    return [min, 25, 50, 75, max];
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};