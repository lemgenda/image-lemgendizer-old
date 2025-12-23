// src/components/ScreenshotCapture.jsx
import React, { useState } from 'react';
import { useScreenshot } from '../utils';

/**
 * Screenshot capture component for mobile, tablet, and desktop screenshots
 * @param {Object} props - Component props
 * @param {string} props.url - The URL to capture
 * @param {Function} props.onComplete - Callback when capture completes
 */
const ScreenshotCapture = ({ url, onComplete }) => {
    const { capture, isLoading, progress, error } = useScreenshotService();
    const [selectedDevices, setSelectedDevices] = useState({
        mobile: true,
        tablet: true,
        desktop: true
    });

    /**
     * Handles the screenshot capture process
     */
    const handleCapture = async () => {
        const devices = Object.keys(selectedDevices).filter(key => selectedDevices[key]);

        try {
            const result = await capture(url, devices);
            onComplete?.(result);
        } catch (error) {
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

    return (
        <div className="screenshot-capture">
            <div className="device-selection mb-4">
                <h4 className="text-sm font-medium mb-2">Select Devices:</h4>
                <div className="flex gap-2">
                    {['mobile', 'tablet', 'desktop'].map(device => (
                        <label key={device} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedDevices[device]}
                                onChange={() => handleDeviceToggle(device)}
                                className="rounded"
                            />
                            <span className="capitalize">{device}</span>
                        </label>
                    ))}
                </div>
            </div>

            <button
                onClick={handleCapture}
                disabled={isLoading}
                className="btn btn-primary w-full"
            >
                {isLoading ? (
                    <>
                        <span className="spinner spinner-sm mr-2"></span>
                        Capturing {progress}%
                    </>
                ) : (
                    'Capture Screenshots'
                )}
            </button>

            {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    <strong>Error:</strong> {error}
                </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
                <p className="mb-1">Captures full-page screenshots</p>
                <p className="mb-1">Cross-origin compatible</p>
                <p className="mb-1">No iframe restrictions</p>
                <p className="mb-1">Fast serverless processing</p>
            </div>
        </div>
    );
};

export default ScreenshotCapture;