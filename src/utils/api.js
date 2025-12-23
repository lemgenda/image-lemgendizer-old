// src/utils/api.js
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

        // Check if it's an image
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
            // Handle JSON error response
            const error = await response.json();
            throw new Error(error.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}