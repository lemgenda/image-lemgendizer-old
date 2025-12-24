/**
 * Capture screenshot using API
 * @async
 * @param {string} url - Website URL
 * @param {string} device - Device type
 * @returns {Promise<Object>} Screenshot result
 */
export async function captureScreenshot(url, device = 'mobile') {
    try {
        const params = new URLSearchParams({
            url,
            device
        });

        const response = await fetch(`/api/screenshot?${params}`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('image')) {
            const blob = await response.blob();
            return {
                success: true,
                blob,
                url: URL.createObjectURL(blob),
                device,
                dimensions: response.headers.get('x-dimensions')
            };
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Unknown error');
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}