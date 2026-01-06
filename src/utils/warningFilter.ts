/**
 * @fileoverview Warning filter utility to suppress specific TensorFlow.js console warnings.
 * This is used to filter out known, benign warnings from third-party libraries like COCO-SSD.
 */

const originalWarn = console.warn;
const suppressedPatterns: RegExp[] = [];

/**
 * Installs the warning filter to suppress specific console.warn messages.
 */
export const installWarningFilter = (): void => {
    // Add patterns for warnings to suppress
    suppressedPatterns.push(
        // COCO-SSD nonMaxSuppression warnings (from third-party library)
        /tf\.nonMaxSuppression\(\) in webgpu locks the UI thread/i,
        /Call tf\.nonMaxSuppressionAsync\(\) instead/i,
        // TensorFlow Backend sync read warnings
        /synchronously reading data from GPU to CPU/i,
        /performance of synchronously reading data/i,
        /tf\.browser\.toPixels is not efficient/i
    );

    // Override console.warn
    console.warn = function(...args: any[]) {
        const message = args.join(' ');

        // Check if this warning should be suppressed
        const shouldSuppress = suppressedPatterns.some(pattern => pattern.test(message));

        if (!shouldSuppress) {
            // Pass through to original warn function
            originalWarn.apply(console, args);
        }
    };
};

/**
 * Restores the original console.warn function.
 * Useful for testing or debugging.
 */
export const uninstallWarningFilter = (): void => {
    console.warn = originalWarn;
};
