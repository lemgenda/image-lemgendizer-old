/**
 * Advanced renaming utility functions
 */

/**
 * Formats a date object according to a format string
 * Supported tokens: YYYY, MM, DD, HH, mm, ss
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
    const pad = (n) => n.toString().padStart(2, '0');

    return format
        .replace('YYYY', date.getFullYear())
        .replace('MM', pad(date.getMonth() + 1))
        .replace('DD', pad(date.getDate()))
        .replace('HH', pad(date.getHours()))
        .replace('mm', pad(date.getMinutes()))
        .replace('ss', pad(date.getSeconds()));
};

/**
 * Generates a new filename based on pattern and options
 *
 * @param {string} originalName - Original filename with extension
 * @param {number} index - Index of the file in the batch (0-based)
 * @param {Object} options - Renaming options
 * @param {string} options.pattern - Pattern string (e.g. "{name}_{counter}")
 * @param {string} options.find - String or Regex to find
 * @param {string} options.replace - String to replace with
 * @param {string} options.casing - 'original', 'uppercase', 'lowercase', 'camelCase', 'kebabCase', 'snakeCase'
 * @param {number} options.startSequence - Starting number for counter
 * @param {number} options.stepSequence - Step for counter
 * @param {number} options.zerosPadding - Padding for counter (e.g. 3 for 001)
 * @param {string} options.dateFormat - Date format string
 */
export const generateNewFileName = (originalName, index, options = {}) => {
    const {
        pattern = '{name}',
        find = '',
        replace = '',
        casing = 'original',
        startSequence = 1,
        stepSequence = 1,
        zerosPadding = 3,
        dateFormat = 'YYYY-MM-DD',
        useRegex = false
    } = options;

    const lastDotIndex = originalName.lastIndexOf('.');
    const ext = lastDotIndex !== -1 ? originalName.slice(lastDotIndex) : '';
    const nameWithoutExt = lastDotIndex !== -1 ? originalName.slice(0, lastDotIndex) : originalName;

    // 1. Process Pattern
    let newName = pattern;

    // Tokens
    // {name} - Original name without extension
    // {ext} - Extension (including dot)
    // {counter} - Sequence number
    // {date} - Current date
    // {timestamp} - Unix timestamp
    // {size} - File size (not implemented generally here without file object, but we can skip)

    // Token: {name}
    newName = newName.replace(/{name}/g, nameWithoutExt);

    // Token: {fullname}
    newName = newName.replace(/{fullname}/g, originalName);

    // Token: {ext}
    // If pattern contains {ext}, we use it. If not, we append it at the end automatically later?
    // Usually batch renamers append extension automatically if not present, or user specifies it.
    // Let's assume user might put {ext} in middle.
    newName = newName.replace(/{ext}/g, ext);

    // Token: {counter}
    const currentSeq = startSequence + (index * stepSequence);
    const counterStr = currentSeq.toString().padStart(zerosPadding, '0');
    newName = newName.replace(/{counter}/g, counterStr);

    // Token: {date}
    const dateStr = formatDate(new Date(), dateFormat);
    newName = newName.replace(/{date}/g, dateStr);

    // Token: {timestamp}
    newName = newName.replace(/{timestamp}/g, Date.now().toString());

    // 2. Find and Replace
    if (find) {
        if (useRegex) {
            try {
                const regex = new RegExp(find, 'g');
                newName = newName.replace(regex, replace);
            } catch {
                // Invalid regex, ignore
            }
        } else {
            newName = newName.split(find).join(replace);
        }
    }

    // 3. Casing
    switch (casing) {
        case 'uppercase':
            newName = newName.toUpperCase();
            break;
        case 'lowercase':
            newName = newName.toLowerCase();
            break;
        case 'camelCase':
            newName = newName
                .replace(/[-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
                .replace(/^(.)/, (c) => c.toLowerCase());
            break;
        case 'kebabCase':
            newName = newName
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[_\s.]+/g, '-')
                .toLowerCase();
            break;
        case 'snakeCase':
            newName = newName
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[-\s.]+/g, '_')
                .toLowerCase();
            break;
        default:
            break;
    }

    // Ensure extension is preserved if it was present and not obviously in the pattern
    // If pattern doesn't contain {ext} and {fullname}, we usually want to append it
    const hasExtToken = pattern.includes('{ext}') || pattern.includes('{fullname}');

    if (ext && !hasExtToken) {
        // If the extension is not already at the end (case-insensitive check)
        if (!newName.toLowerCase().endsWith(ext.toLowerCase())) {
            newName += ext;
        }

        // Final casing pass if we appended the extension to ensure it matches
        if (casing === 'uppercase') newName = newName.toUpperCase();
        if (casing === 'lowercase') newName = newName.toLowerCase();
    }

    return newName;
};
