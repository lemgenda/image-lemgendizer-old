import React, { useState } from 'react';
import { captureScreenshot } from '../utils/api'; // Import your working API
import { DEVICE_PRESETS } from '../constants/sharedConstants';
import { SCREENSHOT_TEMPLATES } from '../configs/templateConfigs';

/**
 * Screenshot capture component that uses the working backend
 * @param {Object} props - Component props
 * @param {string} props.url - The URL to capture
 * @param {Function} props.onComplete - Callback when capture completes
 * @returns {JSX.Element} ScreenshotCapture component
 */
const ScreenshotCapture = ({ url, onComplete }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [selectedDevices, setSelectedDevices] = useState({
        mobile: true,
        tablet: true,
        desktop: true
    });

    // Map device names to template IDs
    const DEVICE_TO_TEMPLATE = {
        mobile: 'screenshots-mobile',
        tablet: 'screenshots-tablet',
        desktop: 'screenshots-desktop',
        'desktop-hd': 'screenshots-desktop-hd'
    };

    // Get all screenshot templates
    const screenshotTemplates = Object.values(SCREENSHOT_TEMPLATES)
        .filter(template => template.category === 'screenshots');

    /**
     * Captures screenshots using the backend API
     * @param {string} url - URL to capture
     * @param {Array} devices - Array of device types
     * @returns {Promise<Object>} Capture result
     */
    const capture = async (url, devices) => {
        setIsLoading(true);
        setProgress(0);
        setError(null);

        try {
            const results = [];
            const totalDevices = devices.length;

            for (let i = 0; i < devices.length; i++) {
                const device = devices[i];
                const templateId = DEVICE_TO_TEMPLATE[device];

                if (!templateId) {
                    results.push({
                        device: device,
                        templateId: 'unknown',
                        error: `No template found for device: ${device}`
                    });
                    continue;
                }

                const template = SCREENSHOT_TEMPLATES[templateId];

                // Update progress
                setProgress(Math.round((i / totalDevices) * 100));

                try {
                    // Call the working backend API
                    const result = await captureScreenshot(url, templateId, {
                        timeout: 30000
                    });

                    if (result.success) {
                        results.push({
                            device: device,
                            templateId: templateId,
                            templateName: template?.name || device,
                            success: true,
                            blob: result.blob,
                            url: result.url,
                            dimensions: result.dimensions || {
                                width: template?.width || 1280,
                                height: template?.height || 720
                            },
                            isPlaceholder: result.isPlaceholder,
                            method: result.method
                        });
                    } else {
                        results.push({
                            device: device,
                            templateId: templateId,
                            templateName: template?.name || device,
                            success: false,
                            error: result.error || 'Capture failed'
                        });
                    }
                } catch (err) {
                    results.push({
                        device: device,
                        templateId: templateId,
                        templateName: template?.name || device,
                        success: false,
                        error: err.message || 'API call failed'
                    });
                }

                // Small delay between captures to avoid rate limiting
                if (i < devices.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            setProgress(100);

            // Return final results
            return {
                success: results.some(r => r.success),
                results: results,
                total: results.length,
                successful: results.filter(r => r.success).length
            };

        } catch (err) {
            throw new Error(err.message || 'Screenshot capture failed');
        } finally {
            setIsLoading(false);
            // Reset progress after a delay
            setTimeout(() => setProgress(0), 1000);
        }
    };

    /**
     * Handles the screenshot capture process
     */
    const handleCapture = async () => {
        if (!url || url.trim() === '') {
            setError('Please enter a URL first');
            return;
        }

        const devices = Object.keys(selectedDevices).filter(key => selectedDevices[key]);

        if (devices.length === 0) {
            setError('Please select at least one device');
            return;
        }

        try {
            const result = await capture(url, devices);
            onComplete?.(result);
        } catch (error) {
            setError(error.message || 'Failed to capture screenshots');
        }
    };

    /**
     * Toggles device selection
     * @param {string} device - Device to toggle
     */
    const handleDeviceToggle = (device) => {
        setSelectedDevices(prev => ({
            ...prev,
            [device]: !prev[device]
        }));
    };

    /**
     * Gets device icon from template
     * @param {string} device - Device name
     * @returns {string} Icon class
     */
    const getDeviceIcon = (device) => {
        const templateId = DEVICE_TO_TEMPLATE[device];
        const template = SCREENSHOT_TEMPLATES[templateId];
        return template?.icon || 'fas fa-question-circle';
    };

    /**
     * Gets device display name
     * @param {string} device - Device name
     * @returns {string} Display name
     */
    const getDeviceDisplayName = (device) => {
        const templateId = DEVICE_TO_TEMPLATE[device];
        const template = SCREENSHOT_TEMPLATES[templateId];
        return template?.name || DEVICE_PRESETS[device]?.name || device;
    };

    return (
        <div className="screenshot-capture p-4 bg-white rounded-lg shadow">
            <div className="device-selection mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Select Devices:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.keys(DEVICE_PRESETS).map(device => {
                        const preset = DEVICE_PRESETS[device];
                        const templateId = DEVICE_TO_TEMPLATE[device];
                        const template = SCREENSHOT_TEMPLATES[templateId];

                        return (
                            <div
                                key={device}
                                className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedDevices[device] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                                onClick={() => handleDeviceToggle(device)}
                            >
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedDevices[device]}
                                        onChange={() => handleDeviceToggle(device)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="ml-2">
                                        <div className="flex items-center">
                                            {template?.icon && (
                                                <i className={`${template.icon} mr-2 text-gray-600`}></i>
                                            )}
                                            <span className="text-sm font-medium capitalize text-gray-700">
                                                {getDeviceDisplayName(device)}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">
                                            {preset.viewport.width} × {preset.viewport.height}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button
                onClick={handleCapture}
                disabled={isLoading || !url}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${isLoading || !url ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        <span>Capturing... {progress}%</span>
                    </div>
                ) : (
                    'Capture Screenshots'
                )}
            </button>

            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <div className="flex items-center">
                        <i className="fas fa-exclamation-circle mr-2"></i>
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <div className="mt-6 text-sm text-gray-600 space-y-2">
                <div className="flex items-center">
                    <i className="fas fa-check-circle mr-2 text-green-500"></i>
                    <span>Uses production backend API</span>
                </div>
                <div className="flex items-center">
                    <i className="fas fa-check-circle mr-2 text-green-500"></i>
                    <span>Real browser screenshots</span>
                </div>
                <div className="flex items-center">
                    <i className="fas fa-check-circle mr-2 text-green-500"></i>
                    <span>Fast serverless processing</span>
                </div>
                <div className="flex items-center">
                    <i className="fas fa-check-circle mr-2 text-green-500"></i>
                    <span>Cross-origin compatible</span>
                </div>
            </div>
        </div>
    );
};

export default ScreenshotCapture;